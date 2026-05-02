import asyncio
import time

from fastapi import APIRouter, HTTPException
from app.db import trips_col, messages_col
from app.models import MessageModel, SendMessageRequest, SendMessageResponse
from app.agents.orchestrator import process_user_turn

router = APIRouter(prefix="/trips", tags=["messages"])

OVERALL_TIMEOUT = 55.0


@router.get("/{trip_id}/messages", response_model=list[MessageModel])
async def get_trip_messages(trip_id: str):
    """Get all messages for a trip, ordered chronologically."""
    cursor = messages_col.find({"trip_id": trip_id}).sort("ts", 1)
    docs = [doc async for doc in cursor]
    for doc in docs:
        doc["_id"] = str(doc["_id"])
    return [MessageModel(**doc) for doc in docs]


@router.post("/{trip_id}/messages", response_model=SendMessageResponse)
async def send_message(trip_id: str, body: SendMessageRequest):
    """Send a message to the Via agent for a trip. Runs the full multi-agent pipeline."""
    t0 = time.time()
    print(f"[API] POST /trips/{trip_id}/messages text={body.text[:60]!r}")

    trip = await trips_col.find_one({"_id": trip_id})
    if not trip:
        raise HTTPException(status_code=404, detail=f"Trip '{trip_id}' not found")

    user_id = body.user_id or "alex"

    try:
        reply, todo_docs, phase, suggestions, deployed_agents = await asyncio.wait_for(
            process_user_turn(
                user_id=user_id,
                trip_id=trip_id,
                user_message=body.text,
            ),
            timeout=OVERALL_TIMEOUT,
        )
    except asyncio.TimeoutError:
        elapsed = time.time() - t0
        print(f"[API] ✗ TIMEOUT after {elapsed:.1f}s for message: {body.text[:60]!r}")
        return SendMessageResponse(
            reply="sorry, i took too long thinking about that. try again?",
            todos=[],
            phase="discovery",
            suggestions=None,
            deploy_agents=None,
        )
    except Exception as e:
        elapsed = time.time() - t0
        print(f"[API] ✗ ERROR after {elapsed:.1f}s: {type(e).__name__}: {e}")
        return SendMessageResponse(
            reply="something went wrong on my end — try sending that again.",
            todos=[],
            phase="discovery",
            suggestions=None,
            deploy_agents=None,
        )

    elapsed = time.time() - t0
    print(f"[API] ✓ responded in {elapsed:.2f}s phase={phase}")

    return SendMessageResponse(
        reply=reply,
        todos=[],
        phase=phase,
        suggestions=suggestions,
        deploy_agents=deployed_agents,
    )
