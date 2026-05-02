from fastapi import APIRouter, HTTPException
from app.db import trips_col
from app.models import TripModel

router = APIRouter(prefix="/trips", tags=["trips"])


@router.get("/{trip_id}", response_model=TripModel)
async def get_trip(trip_id: str):
    """Get a trip document by ID."""
    doc = await trips_col.find_one({"_id": trip_id})
    if not doc:
        raise HTTPException(status_code=404, detail=f"Trip '{trip_id}' not found")
    doc["_id"] = str(doc["_id"])
    return TripModel(**doc)
