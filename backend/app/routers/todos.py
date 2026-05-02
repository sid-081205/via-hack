from datetime import datetime

from fastapi import APIRouter, HTTPException
from app.db import todos_col, trips_col
from app.models import TodoModel, ConfirmTodoRequest, ConfirmTodoResponse

router = APIRouter(tags=["todos"])


@router.get("/trips/{trip_id}/todos", response_model=list[TodoModel])
async def get_trip_todos(trip_id: str):
    """Get all todos for a trip, ordered by creation time."""
    cursor = todos_col.find(
        {"trip_id": trip_id},
        sort=[("created_at", 1)],
    )
    docs = [doc async for doc in cursor]
    for doc in docs:
        doc["_id"] = str(doc["_id"])
    return [TodoModel(**doc) for doc in docs]


@router.post("/todos/{todo_id}/confirm", response_model=ConfirmTodoResponse)
async def confirm_todo(todo_id: str, body: ConfirmTodoRequest):
    """Mark a todo as done (user confirmed they booked it)."""
    doc = await todos_col.find_one({"_id": todo_id})
    if not doc:
        raise HTTPException(status_code=404, detail=f"Todo '{todo_id}' not found")

    update: dict = {
        "status": "done",
        "sub_status": "Booked ✓",
        "updated_at": datetime.utcnow(),
    }
    if body.booking_ref:
        update["result"] = {**(doc.get("result") or {}), "booking_ref": body.booking_ref}

    await todos_col.update_one({"_id": todo_id}, {"$set": update})

    updated = await todos_col.find_one({"_id": todo_id})
    updated["_id"] = str(updated["_id"])
    return ConfirmTodoResponse(todo=TodoModel(**updated))
