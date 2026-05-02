"""Itinerary specialist agent: plans restaurants, activities, and day-by-day schedule.

Only runs in the 'confirmed' phase. All output is lowercase.
"""
from __future__ import annotations

import asyncio
import json
import logging
from datetime import datetime

from app.db import todos_col
from app.agents.llm import generate_text
from app.agents.tools.places_search import (
    load_restaurants,
    build_maps_url,
    format_restaurant_summary,
)

logger = logging.getLogger(__name__)


async def _update_todo(todo_id: str, update: dict) -> None:
    update["updated_at"] = datetime.utcnow()
    await todos_col.update_one({"_id": todo_id}, {"$set": update})


async def run_itinerary_agent(
    todo: dict,
    memory_context: list[str],
    trip_context: dict,
) -> dict:
    """
    Plan restaurants and activities based on user preferences.
    Updates todo status: pending → running → needs_user/failed.
    """
    todo_id = todo["_id"]

    await _update_todo(todo_id, {"status": "running", "sub_status": "planning itinerary..."})

    try:
        restaurants = load_restaurants()
        memory_str = "\n".join(f"- {f}" for f in memory_context) if memory_context else "no preferences on file."

        trip_dates = trip_context.get("dates", {})
        dest = trip_context.get("destination", "lisbon")

        restaurants_json = json.dumps(restaurants, indent=2)

        prompt = f"""you are an itinerary specialist for via, a personal travel agent. always write in lowercase.

user request: {todo['text']}
destination: {dest}
travel dates: {trip_dates}

user preferences and memory facts:
{memory_str}

available restaurants (json):
{restaurants_json}

task: create a brief itinerary recommendation focusing on what the user asked for.
apply all preferences (e.g. if partner is vegetarian with no shellfish, only recommend vegetarian-friendly places;
if user prefers hole-in-the-wall over fine dining, avoid michelin-starred restaurants unless specifically asked;
if romantic dinner requested, choose romantic options).

return your response as a json object with these exact fields:
{{
  "primary_recommendation_id": "rs001",
  "summary": "brief overview of the recommended plan",
  "day_plan": [
    {{
      "time": "saturday evening",
      "activity": "dinner at taberna da rua das flores",
      "restaurant_id": "rs001",
      "notes": "perfect hole-in-the-wall, veggie-friendly"
    }}
  ],
  "preference_notes": "brief note on which preferences you applied"
}}

return only valid json, no other text."""

        await _update_todo(todo_id, {"sub_status": "curating recommendations..."})

        system_prompt = (
            "you are an itinerary planning specialist. return only valid json. always lowercase."
        )
        print(f"[ITINERARY_AGENT] calling LLM for todo {todo_id}")
        raw = await generate_text(f"{system_prompt}\n\n{prompt}", timeout=10.0)
        print(f"[ITINERARY_AGENT] got response for todo {todo_id} (len={len(raw)})")
        raw = (raw or "").strip()
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        plan = json.loads(raw)

        restaurants_by_id = {r["id"]: r for r in restaurants}
        primary_id = plan.get("primary_recommendation_id", restaurants[0]["id"])
        primary_restaurant = restaurants_by_id.get(primary_id, restaurants[0])

        booking_url = build_maps_url(primary_restaurant["name"])

        day_plan = plan.get("day_plan", [])
        for item in day_plan:
            if "restaurant_id" in item:
                r = restaurants_by_id.get(item["restaurant_id"])
                if r:
                    item["booking_url"] = build_maps_url(r["name"])
                    item["restaurant"] = r

        result = {
            "type": "itinerary",
            "primary_restaurant": primary_restaurant,
            "summary": plan.get("summary", format_restaurant_summary(primary_restaurant)),
            "booking_url": booking_url,
            "day_plan": day_plan,
            "preference_notes": plan.get("preference_notes", ""),
        }

        await _update_todo(todo_id, {
            "status": "needs_user",
            "sub_status": "itinerary ready",
            "result": result,
        })

        return {"todo_id": todo_id, "status": "needs_user", "result": result}

    except asyncio.TimeoutError:
        logger.error(f"ItineraryAgent timed out for todo {todo_id}")
        await _update_todo(todo_id, {
            "status": "failed",
            "sub_status": "timed out planning itinerary",
        })
        return {"todo_id": todo_id, "status": "failed"}

    except Exception as e:
        logger.error(f"ItineraryAgent error for todo {todo_id}: {e}")
        await _update_todo(todo_id, {
            "status": "failed",
            "sub_status": f"could not plan itinerary: {str(e)[:80]}",
        })
        return {"todo_id": todo_id, "status": "failed"}
