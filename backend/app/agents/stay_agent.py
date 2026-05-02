"""Stay specialist agent: finds and ranks hotels for the user.

Only runs in the 'confirmed' phase. All output is lowercase.
"""
from __future__ import annotations

import asyncio
import json
import logging
from datetime import datetime

from app.db import todos_col
from app.agents.llm import generate_text
from app.agents.tools.stay_search import (
    load_hotels,
    build_booking_url,
    format_hotel_summary,
)

logger = logging.getLogger(__name__)


async def _update_todo(todo_id: str, update: dict) -> None:
    update["updated_at"] = datetime.utcnow()
    await todos_col.update_one({"_id": todo_id}, {"$set": update})


async def run_stay_agent(
    todo: dict,
    memory_context: list[str],
    trip_context: dict,
) -> dict:
    """
    Search hotels and recommend the best option based on user preferences.
    Updates todo status in MongoDB: pending → running → needs_user/failed.
    """
    todo_id = todo["_id"]

    await _update_todo(todo_id, {"status": "running", "sub_status": "searching hotels..."})

    try:
        hotels = load_hotels()
        memory_str = "\n".join(f"- {f}" for f in memory_context) if memory_context else "no preferences on file."

        trip_dates = trip_context.get("dates", {})
        dest = trip_context.get("destination", "lisbon")

        nights = 2
        if isinstance(trip_dates, dict):
            try:
                from datetime import date
                start = date.fromisoformat(trip_dates.get("start", "2026-05-09"))
                end = date.fromisoformat(trip_dates.get("end", "2026-05-11"))
                nights = max(1, (end - start).days)
            except Exception:
                pass

        hotels_json = json.dumps(hotels, indent=2)

        prompt = f"""you are a hotel specialist for via, a personal travel agent. always write in lowercase.

user request: {todo['text']}
destination: {dest}
travel dates: {trip_dates}
number of nights: {nights}

user preferences and memory facts:
{memory_str}

available hotels (json):
{hotels_json}

task: select the best hotel for this user based on their preferences.
apply preferences literally (e.g. if they prefer boutique hotels in historic neighbourhoods, choose those over chain hotels;
if travelling romantically, consider romantic options; if vegetarian partner, consider hotel restaurant options).

return your response as a json object with these exact fields:
{{
  "recommended_hotel_id": "ht001",
  "summary": "one sentence explaining the recommendation and why it fits their preferences",
  "alternatives": ["ht002"],
  "preference_notes": "brief note on which preferences you applied"
}}

return only valid json, no other text."""

        await _update_todo(todo_id, {"sub_status": "ranking options..."})

        system_prompt = (
            "you are a hotel booking specialist. return only valid json. always lowercase."
        )
        print(f"[STAY_AGENT] calling LLM for todo {todo_id}")
        raw = await generate_text(f"{system_prompt}\n\n{prompt}", timeout=10.0)
        print(f"[STAY_AGENT] got response for todo {todo_id} (len={len(raw)})")
        raw = (raw or "").strip()
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        ranking = json.loads(raw)

        hotels_by_id = {h["id"]: h for h in hotels}
        rec_id = ranking.get("recommended_hotel_id", hotels[0]["id"])
        rec_hotel = hotels_by_id.get(rec_id, hotels[0])

        booking_url = build_booking_url(rec_hotel["name"])

        result = {
            "type": "hotel",
            "hotel": rec_hotel,
            "nights": nights,
            "total_gbp": rec_hotel["price_per_night_gbp"] * nights,
            "summary": ranking.get("summary", format_hotel_summary(rec_hotel, nights)),
            "booking_url": booking_url,
            "alternatives": [
                hotels_by_id[alt_id]
                for alt_id in ranking.get("alternatives", [])
                if alt_id in hotels_by_id
            ][:2],
            "preference_notes": ranking.get("preference_notes", ""),
        }

        await _update_todo(todo_id, {
            "status": "needs_user",
            "sub_status": "hotel found — ready to book",
            "result": result,
        })

        return {"todo_id": todo_id, "status": "needs_user", "result": result}

    except asyncio.TimeoutError:
        logger.error(f"StayAgent timed out for todo {todo_id}")
        await _update_todo(todo_id, {
            "status": "failed",
            "sub_status": "timed out searching hotels",
        })
        return {"todo_id": todo_id, "status": "failed"}

    except Exception as e:
        logger.error(f"StayAgent error for todo {todo_id}: {e}")
        await _update_todo(todo_id, {
            "status": "failed",
            "sub_status": f"could not find hotels: {str(e)[:80]}",
        })
        return {"todo_id": todo_id, "status": "failed"}
