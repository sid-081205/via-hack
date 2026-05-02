"""
Seed script: creates Alex and the Lisbon trip.

Run from backend/ directory:
  python -m app.seed

Idempotent: uses upsert so it's safe to run multiple times.
"""
from __future__ import annotations

import asyncio
import sys
import logging
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from app.db import users_col, trips_col, todos_col, messages_col

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger(__name__)

# ── Seed data ──────────────────────────────────────────────────────────────────

USER = {
    "_id": "alex",
    "name": "Alex",
    "home_airport": "LHR",
    "preferences": {
        "seat": "aisle",
        "departure_time": "morning preferred, no before 8am",
        "accommodation": "boutique hotels in historic neighbourhoods",
        "dining": "hole-in-the-wall over fine dining",
        "dietary_notes": "partner Sam is vegetarian, no shellfish",
        "alcohol": "cutting back on red wine",
    },
    "created_at": datetime.utcnow(),
}

TRIP = {
    "_id": "trip_lisbon",
    "user_id": "alex",
    "destination": "Lisbon",
    "dates": {"start": "2026-05-09", "end": "2026-05-11"},
    "status": "planning",
    "flights": [],
    "stays": [],
    "itinerary": [],
    "trip_documents": [],
    "created_at": datetime.utcnow(),
    "updated_at": datetime.utcnow(),
}


async def ensure_indexes() -> None:
    """Create regular indexes."""
    await todos_col.create_index([("trip_id", 1), ("updated_at", -1)])
    await messages_col.create_index([("trip_id", 1), ("ts", 1)])
    logger.info("Indexes ensured.")


async def seed_user() -> None:
    result = await users_col.update_one(
        {"_id": "alex"},
        {"$setOnInsert": USER},
        upsert=True,
    )
    if result.upserted_id:
        logger.info("Created user: alex")
    else:
        logger.info("User alex already exists — skipped")


async def seed_trip() -> None:
    result = await trips_col.update_one(
        {"_id": "trip_lisbon"},
        {"$setOnInsert": TRIP},
        upsert=True,
    )
    if result.upserted_id:
        logger.info("Created trip: trip_lisbon")
    else:
        logger.info("Trip trip_lisbon already exists — skipped")


async def main() -> None:
    logger.info("=== Via seed script starting ===")
    await ensure_indexes()
    await seed_user()
    await seed_trip()
    logger.info("=== Seed complete ✓ ===")


if __name__ == "__main__":
    asyncio.run(main())
