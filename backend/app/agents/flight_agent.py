"""Flight specialist agent: finds and ranks flights for the user.

Only runs in the 'confirmed' phase. All output is lowercase.
"""
from __future__ import annotations

import asyncio
import json
import logging
from datetime import datetime

from app.db import todos_col
from app.agents.llm import generate_text
from app.agents.tools.flight_search import (
    load_flights,
    build_skyscanner_url,
    format_flight_summary,
)

logger = logging.getLogger(__name__)


async def _update_todo(todo_id: str, update: dict) -> None:
    update["updated_at"] = datetime.utcnow()
    await todos_col.update_one({"_id": todo_id}, {"$set": update})


async def run_flight_agent(
    todo: dict,
    memory_context: list[str],
    trip_context: dict,
) -> dict:
    """
    Search flights and recommend the best option based on user preferences.
    Updates todo status in MongoDB: pending → running → needs_user/failed.
    """
    todo_id = todo["_id"]

    await _update_todo(todo_id, {"status": "running", "sub_status": "searching flights..."})

    try:
        flights = load_flights()
        memory_str = "\n".join(f"- {f}" for f in memory_context) if memory_context else "no preferences on file."

        trip_dates = trip_context.get("dates", {})
        dest = trip_context.get("destination", "lisbon")

        flights_json = json.dumps(flights, indent=2)

        prompt = f"""you are a flight specialist for via, a personal travel agent. always write in lowercase.

user request: {todo['text']}
destination: {dest}
travel dates: {trip_dates}

user preferences and memory facts:
{memory_str}

available flights (json):
{flights_json}

task: select the best flight for this user based on their preferences.
apply preferences literally (e.g. if they hate early mornings, avoid pre-8am departures; if they prefer direct flights, prefer those).

return your response as a json object with these exact fields:
{{
  "recommended_flight_id": "fl001",
  "summary": "one sentence explaining the recommendation and why it fits their preferences",
  "alternatives": ["fl002", "fl003"],
  "preference_notes": "brief note on which preferences you applied"
}}

return only valid json, no other text."""

        await _update_todo(todo_id, {"sub_status": "ranking options..."})

        system_prompt = (
            "you are a flight booking specialist. return only valid json. always lowercase."
        )
        print(f"[FLIGHT_AGENT] calling LLM for todo {todo_id}")
        raw = await generate_text(f"{system_prompt}\n\n{prompt}", timeout=10.0)
        print(f"[FLIGHT_AGENT] got response for todo {todo_id} (len={len(raw)})")
        raw = (raw or "").strip()
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        ranking = json.loads(raw)

        flights_by_id = {f["id"]: f for f in flights}
        rec_id = ranking.get("recommended_flight_id", flights[0]["id"])
        rec_flight = flights_by_id.get(rec_id, flights[0])

        dep_date = rec_flight["departure"][:10]
        booking_url = build_skyscanner_url(rec_flight["origin"], rec_flight["dest"], dep_date)

        result = {
            "type": "flight",
            "flight": rec_flight,
            "summary": ranking.get("summary", format_flight_summary(rec_flight)),
            "booking_url": booking_url,
            "alternatives": [
                flights_by_id[alt_id]
                for alt_id in ranking.get("alternatives", [])
                if alt_id in flights_by_id
            ][:2],
            "preference_notes": ranking.get("preference_notes", ""),
        }

        await _update_todo(todo_id, {
            "status": "needs_user",
            "sub_status": "flight found — ready to book",
            "result": result,
        })

        return {"todo_id": todo_id, "status": "needs_user", "result": result}

    except asyncio.TimeoutError:
        logger.error(f"FlightAgent timed out for todo {todo_id}")
        await _update_todo(todo_id, {
            "status": "failed",
            "sub_status": "timed out searching flights",
        })
        return {"todo_id": todo_id, "status": "failed"}

    except Exception as e:
        logger.error(f"FlightAgent error for todo {todo_id}: {e}")
        await _update_todo(todo_id, {
            "status": "failed",
            "sub_status": f"could not find flights: {str(e)[:80]}",
        })
        return {"todo_id": todo_id, "status": "failed"}
