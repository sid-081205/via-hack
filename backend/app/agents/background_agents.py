"""Background agent execution: runs specialist agents as background tasks.

Each agent loads its corpus, uses Gemini to rank/filter, and pushes results
incrementally to MongoDB with small delays for the demo effect.
"""
from __future__ import annotations

import asyncio
import json
import logging
import time
from datetime import datetime

from app.db import agent_tasks_col
from app.agents.llm import generate_text
from app.agents.tools.flight_search import load_flights, build_skyscanner_url
from app.agents.tools.stay_search import load_hotels, build_booking_url
from app.agents.tools.places_search import load_restaurants, build_maps_url

logger = logging.getLogger(__name__)


async def _push_result(task_id: str, result: dict) -> None:
    """Push a single result to the agent_tasks results array."""
    result["found_at"] = datetime.utcnow().isoformat()
    await agent_tasks_col.update_one(
        {"_id": task_id},
        {
            "$push": {"results": result},
            "$set": {"updated_at": datetime.utcnow()},
        },
    )


async def _mark_done(task_id: str) -> None:
    await agent_tasks_col.update_one(
        {"_id": task_id},
        {"$set": {"status": "done", "updated_at": datetime.utcnow()}},
    )


async def _mark_failed(task_id: str) -> None:
    await agent_tasks_col.update_one(
        {"_id": task_id},
        {"$set": {"status": "failed", "updated_at": datetime.utcnow()}},
    )


async def run_background_agent(
    task_id: str,
    trip_id: str,
    agent_type: str,
    query: str,
) -> None:
    """Dispatch to the appropriate background agent."""
    t0 = time.time()
    print(f"[BG_AGENT] ▶ START {agent_type} task={task_id} query={query[:60]!r}")
    try:
        memory_context: list[str] = []

        if agent_type == "hotel":
            await _run_hotel_agent(task_id, query, memory_context)
        elif agent_type == "flight":
            await _run_flight_agent(task_id, query, memory_context)
        elif agent_type == "itinerary":
            await _run_itinerary_agent(task_id, query, memory_context)
        else:
            print(f"[BG_AGENT] ✗ unknown agent_type={agent_type}")
            await _mark_failed(task_id)
            return

        print(f"[BG_AGENT] ✓ {agent_type} done in {time.time()-t0:.1f}s")
    except Exception as e:
        print(f"[BG_AGENT] ✗ {agent_type} FAILED after {time.time()-t0:.1f}s: {type(e).__name__}: {e}")
        await _mark_failed(task_id)


async def _run_hotel_agent(task_id: str, query: str, memory_context: list[str]) -> None:
    """Find hotels incrementally based on query and user preferences."""
    hotels = load_hotels()
    memory_str = "\n".join(f"- {f}" for f in memory_context) if memory_context else "none"

    prompt = f"""you are a hotel search agent. given these hotels and user preferences, rank the top 4 best matches.

user query: {query}

user preferences:
{memory_str}

available hotels:
{json.dumps(hotels, indent=2)}

return a json array of the top 4 hotel IDs in order of best match, like: ["ht004", "ht006", "ht003", "ht002"]
consider the query carefully — if they want "cheap" hotels, prioritize budget options.
return only the json array, nothing else."""

    try:
        print(f"[BG_HOTEL] calling LLM task={task_id}")
        system_prompt = "you are a hotel ranking agent. return only valid json."
        raw = await generate_text(f"{system_prompt}\n\n{prompt}", timeout=12.0)
        print(f"[BG_HOTEL] got response task={task_id} (len={len(raw)})")
        raw = (raw or "").strip()
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        ranked_ids = json.loads(raw)
    except Exception as e:
        logger.warning(f"Hotel ranking LLM failed, using price sort: {e}")
        print(f"[BG_HOTEL] ✗ LLM failed task={task_id}, falling back to price sort: {type(e).__name__}: {e}")
        ranked_ids = [h["id"] for h in sorted(hotels, key=lambda x: x["price_per_night_gbp"])][:4]

    hotels_by_id = {h["id"]: h for h in hotels}

    for hotel_id in ranked_ids[:4]:
        hotel = hotels_by_id.get(hotel_id)
        if not hotel:
            continue

        result = {
            "name": hotel["name"],
            "description": f"{hotel['stars']}★ · {hotel['area']} · {hotel['vibe']}",
            "price": f"£{hotel['price_per_night_gbp']}/night",
            "image_url": hotel.get("image_url", ""),
            "booking_url": build_booking_url(hotel["name"]),
            "details": {
                "id": hotel["id"],
                "stars": hotel["stars"],
                "area": hotel["area"],
                "price_per_night_gbp": hotel["price_per_night_gbp"],
                "price_tier": hotel.get("price_tier", "mid"),
                "vibe": hotel["vibe"],
                "highlights": hotel.get("highlights", []),
            },
        }
        await _push_result(task_id, result)
        await asyncio.sleep(3)

    await _mark_done(task_id)


async def _run_flight_agent(task_id: str, query: str, memory_context: list[str]) -> None:
    """Find flights incrementally based on query and user preferences."""
    flights = load_flights()
    memory_str = "\n".join(f"- {f}" for f in memory_context) if memory_context else "none"

    prompt = f"""you are a flight search agent. given these flights and user preferences, rank the top 4 best matches.

user query: {query}

user preferences:
{memory_str}

available flights:
{json.dumps(flights, indent=2)}

return a json array of the top 4 flight IDs in order of best match, like: ["fl001", "fl002", "fl004", "fl006"]
consider: if they want to "make the most of their time", prioritize early departures (but not before 8am if they hate early mornings). if they want comfort, prioritize direct flights with baggage.
return only the json array, nothing else."""

    try:
        print(f"[BG_FLIGHT] calling LLM task={task_id}")
        system_prompt = "you are a flight ranking agent. return only valid json."
        raw = await generate_text(f"{system_prompt}\n\n{prompt}", timeout=12.0)
        print(f"[BG_FLIGHT] got response task={task_id} (len={len(raw)})")
        raw = (raw or "").strip()
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        ranked_ids = json.loads(raw)
    except Exception as e:
        logger.warning(f"Flight ranking LLM failed, using departure sort: {e}")
        print(f"[BG_FLIGHT] ✗ LLM failed task={task_id}, falling back to departure sort: {type(e).__name__}: {e}")
        ranked_ids = [f["id"] for f in sorted(flights, key=lambda x: x["departure"])][:4]

    flights_by_id = {f["id"]: f for f in flights}

    for flight_id in ranked_ids[:4]:
        flight = flights_by_id.get(flight_id)
        if not flight:
            continue

        dep_time = flight["departure"][11:16]
        arr_time = flight["arrival"][11:16]
        dep_date = flight["departure"][:10]
        stops_text = "direct" if flight["stops"] == 0 else f"{flight['stops']} stop"

        result = {
            "name": f"{flight['airline']} {flight['flight_no']}",
            "description": f"{flight['origin']} → {flight['dest']} · {dep_time}–{arr_time} · {stops_text}",
            "price": f"£{flight['price_gbp']}",
            "image_url": "",
            "booking_url": build_skyscanner_url(flight["origin"], flight["dest"], dep_date),
            "details": {
                "id": flight["id"],
                "airline": flight["airline"],
                "flight_no": flight["flight_no"],
                "origin": flight["origin"],
                "dest": flight["dest"],
                "departure": flight["departure"],
                "arrival": flight["arrival"],
                "price_gbp": flight["price_gbp"],
                "stops": flight["stops"],
                "baggage_included": flight.get("baggage_included", False),
            },
        }
        await _push_result(task_id, result)
        await asyncio.sleep(3)

    await _mark_done(task_id)


async def _run_itinerary_agent(task_id: str, query: str, memory_context: list[str]) -> None:
    """Find restaurants and activities incrementally."""
    restaurants = load_restaurants()
    memory_str = "\n".join(f"- {f}" for f in memory_context) if memory_context else "none"

    prompt = f"""you are an itinerary planning agent. given these restaurants and user preferences, pick the top 4 best matches for a 2-day trip.

user query: {query}

user preferences:
{memory_str}

available restaurants:
{json.dumps(restaurants, indent=2)}

return a json array of the top 4 restaurant IDs in order of recommendation for a 2-day itinerary, like: ["rs001", "rs007", "rs005", "rs008"]
consider dietary needs (vegetarian partner), vibe preferences (hole-in-the-wall over fine dining), and mix dinner/lunch options across the days.
return only the json array, nothing else."""

    try:
        print(f"[BG_ITINERARY] calling LLM task={task_id}")
        system_prompt = "you are an itinerary planning agent. return only valid json."
        raw = await generate_text(f"{system_prompt}\n\n{prompt}", timeout=12.0)
        print(f"[BG_ITINERARY] got response task={task_id} (len={len(raw)})")
        raw = (raw or "").strip()
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        ranked_ids = json.loads(raw)
    except Exception as e:
        logger.warning(f"Itinerary ranking LLM failed, using default order: {e}")
        print(f"[BG_ITINERARY] ✗ LLM failed task={task_id}, falling back to default order: {type(e).__name__}: {e}")
        ranked_ids = [r["id"] for r in restaurants[:4]]

    restaurants_by_id = {r["id"]: r for r in restaurants}
    time_slots = ["day 1 dinner", "day 1 lunch", "day 2 dinner", "day 2 lunch"]

    for i, rest_id in enumerate(ranked_ids[:4]):
        rest = restaurants_by_id.get(rest_id)
        if not rest:
            continue

        slot = time_slots[i] if i < len(time_slots) else ""
        veg_tag = " · veggie-friendly ✓" if rest.get("vegetarian_friendly") else ""

        result = {
            "name": rest["name"],
            "description": f"{rest['cuisine']} · {rest['area']} · {rest['price_range']}{veg_tag}",
            "price": rest["price_range"],
            "image_url": rest.get("image_url", ""),
            "booking_url": build_maps_url(rest["name"]),
            "details": {
                "id": rest["id"],
                "cuisine": rest["cuisine"],
                "area": rest["area"],
                "vibe": rest["vibe"],
                "time_slot": slot,
                "meal_type": rest.get("meal_type", "any"),
                "vegetarian_friendly": rest.get("vegetarian_friendly", False),
            },
        }
        await _push_result(task_id, result)
        await asyncio.sleep(3)

    await _mark_done(task_id)
