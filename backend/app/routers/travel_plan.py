"""Router for travel plan items (the right panel in the UI)."""
from __future__ import annotations

import uuid
from datetime import datetime

from fastapi import APIRouter, HTTPException

from app.db import travel_plan_col
from app.models import AddTravelPlanRequest, TravelPlanItemModel

router = APIRouter(tags=["travel-plan"])


@router.post("/trips/{trip_id}/travel-plan")
async def add_travel_plan_item(trip_id: str, body: AddTravelPlanRequest):
    """Add a confirmed item to the travel plan."""
    item_id = str(uuid.uuid4())
    now = datetime.utcnow()

    doc = {
        "_id": item_id,
        "trip_id": trip_id,
        "item_type": body.item_type,
        "name": body.name,
        "details": body.details,
        "booking_url": body.booking_url,
        "status": "planned",
        "day": body.day,
        "time_slot": body.time_slot,
        "created_at": now,
    }
    await travel_plan_col.insert_one(doc)
    doc["_id"] = item_id
    return doc


@router.get("/trips/{trip_id}/travel-plan")
async def get_travel_plan(trip_id: str):
    """Get all travel plan items for a trip."""
    cursor = travel_plan_col.find(
        {"trip_id": trip_id},
        sort=[("created_at", 1)],
    )
    docs = []
    async for doc in cursor:
        doc["_id"] = str(doc["_id"])
        docs.append(doc)
    return docs


@router.patch("/travel-plan/{item_id}/book")
async def mark_booked(item_id: str):
    """Mark a travel plan item as booked."""
    doc = await travel_plan_col.find_one({"_id": item_id})
    if not doc:
        raise HTTPException(status_code=404, detail=f"Item '{item_id}' not found")
    await travel_plan_col.update_one(
        {"_id": item_id},
        {"$set": {"status": "booked"}},
    )
    return {"status": "booked"}
