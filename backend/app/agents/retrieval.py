"""Adaptive multi-source retrieval for the Via orchestrator.

Combines:
1. Structured slice from messages collection (last 6 messages)
2. Structured slice from trips collection (explicit projection)
3. Corpus hints (keyword detection for background agents)
4. In-trip detection: checks if today falls within trip dates
5. Memory facts from vector search (when available)
"""
from __future__ import annotations

import asyncio
import logging
import time
from datetime import date
from typing import Any

from app.db import messages_col, trips_col, db
from app.models import RetrievalPack

logger = logging.getLogger(__name__)


async def _fetch_recent_messages(trip_id: str, limit: int = 6) -> list[dict[str, Any]]:
    cursor = messages_col.find(
        {"trip_id": trip_id},
        {"_id": 0, "role": 1, "content": 1, "ts": 1},
        sort=[("ts", -1)],
        limit=limit,
    )
    msgs = [doc async for doc in cursor]
    return list(reversed(msgs))


async def _fetch_trip_context(trip_id: str) -> dict[str, Any]:
    doc = await trips_col.find_one(
        {"_id": trip_id},
        {
            "destination": 1,
            "dates": 1,
            "status": 1,
            "conversation_phase": 1,
            "flights": {"$slice": 3},
            "stays": {"$slice": 2},
            "itinerary": {"$slice": 3},
            "_id": 0,
        },
    )
    return doc or {}


async def _fetch_memory_facts(user_id: str, limit: int = 5) -> list[str]:
    """Fetch recent memory facts for the user (non-vector, simple query)."""
    try:
        cursor = db.memory_facts.find(
            {"user_id": user_id},
            {"fact": 1, "_id": 0},
        ).sort("created_at", -1).limit(limit)
        facts = [doc["fact"] async for doc in cursor]
        return facts
    except Exception as e:
        print(f"[RETRIEVAL] memory_facts fetch failed (non-critical): {e}")
        return []


def _detect_in_trip(trip_context: dict[str, Any]) -> tuple[bool, list[dict[str, Any]]]:
    """Check if today falls within trip dates. Returns (is_on_trip, today_itinerary)."""
    dates = trip_context.get("dates", {})
    if not dates:
        return False, []

    try:
        start = date.fromisoformat(dates.get("start", ""))
        end = date.fromisoformat(dates.get("end", ""))
        today = date.today()

        if start <= today <= end:
            itinerary = trip_context.get("itinerary", [])
            day_num = (today - start).days + 1
            today_items = [
                item for item in itinerary
                if item.get("day") == day_num
            ]
            return True, today_items
    except (ValueError, TypeError):
        pass

    return False, []


def _corpus_hints(user_message: str) -> dict[str, Any]:
    lower = user_message.lower()
    hints: dict[str, Any] = {}

    flight_kws = {"flight", "fly", "depart", "arrive", "airline", "airport", "seat"}
    stay_kws = {"hotel", "stay", "accommodation", "room", "night", "check"}
    food_kws = {"restaurant", "dinner", "lunch", "eat", "food", "vegan", "vegetarian", "bar", "cafe"}

    if any(k in lower for k in flight_kws):
        hints["flights"] = "relevant"
    if any(k in lower for k in stay_kws):
        hints["hotels"] = "relevant"
    if any(k in lower for k in food_kws):
        hints["restaurants"] = "relevant"

    if not hints:
        hints = {"flights": "relevant", "hotels": "relevant", "restaurants": "relevant"}

    return hints


async def adaptive_retrieve(
    user_id: str,
    trip_id: str,
    user_message: str,
) -> RetrievalPack:
    """
    Multi-source adaptive retrieval.

    Returns a RetrievalPack with trip_context, recent_messages,
    memory_context, corpus_hints, and in-trip detection.

    NOTE: corpus_data is NOT loaded here — it's only used by background agents,
    not the planner prompt (keeps the planner prompt small and fast).
    """
    t0 = time.time()
    print(f"[RETRIEVAL] starting for user={user_id} trip={trip_id}")

    try:
        recent_messages, trip_context, memory_context = await asyncio.wait_for(
            asyncio.gather(
                _fetch_recent_messages(trip_id),
                _fetch_trip_context(trip_id),
                _fetch_memory_facts(user_id),
            ),
            timeout=8.0,
        )
    except asyncio.TimeoutError:
        print(f"[RETRIEVAL] ✗ TIMEOUT after {time.time()-t0:.2f}s — using empty context")
        recent_messages = []
        trip_context = {}
        memory_context = []
    except Exception as e:
        print(f"[RETRIEVAL] ✗ ERROR: {type(e).__name__}: {e}")
        recent_messages = []
        trip_context = {}
        memory_context = []

    corpus_hints = _corpus_hints(user_message)
    is_on_trip, today_itinerary = _detect_in_trip(trip_context)

    elapsed = time.time() - t0
    print(f"[RETRIEVAL] done in {elapsed:.2f}s: {len(recent_messages)} msgs, {len(memory_context)} memories, on_trip={is_on_trip}")

    return RetrievalPack(
        memory_context=memory_context,
        trip_context=trip_context,
        recent_messages=recent_messages,
        corpus_hints=corpus_hints,
        corpus_data={},
        is_on_trip=is_on_trip,
        today_itinerary=today_itinerary,
    )
