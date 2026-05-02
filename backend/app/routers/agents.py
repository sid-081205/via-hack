"""Router for background agent tasks: deploy, poll, and query."""
from __future__ import annotations

import asyncio
import uuid
from datetime import datetime

from fastapi import APIRouter, HTTPException

from app.db import agent_tasks_col
from app.models import AgentTaskModel, DeployAgentRequest
from app.agents.background_agents import run_background_agent

router = APIRouter(tags=["agents"])


@router.post("/trips/{trip_id}/agents/deploy")
async def deploy_agent(trip_id: str, body: DeployAgentRequest):
    """Deploy a background specialist agent. Returns the task_id immediately."""
    task_id = f"task_{uuid.uuid4().hex[:12]}"
    now = datetime.utcnow()

    doc = {
        "_id": task_id,
        "trip_id": trip_id,
        "agent_type": body.agent_type,
        "status": "running",
        "query": body.query,
        "results": [],
        "created_at": now,
        "updated_at": now,
    }
    await agent_tasks_col.insert_one(doc)

    asyncio.create_task(
        run_background_agent(task_id, trip_id, body.agent_type, body.query)
    )

    return {"task_id": task_id, "status": "running"}


@router.get("/trips/{trip_id}/agents")
async def get_trip_agents(trip_id: str):
    """Get all agent tasks for a trip (for polling)."""
    cursor = agent_tasks_col.find(
        {"trip_id": trip_id},
        sort=[("created_at", -1)],
    )
    docs = []
    async for doc in cursor:
        doc["_id"] = str(doc["_id"])
        docs.append(doc)
    return docs


@router.get("/agents/{task_id}")
async def get_agent_task(task_id: str):
    """Get a single agent task with current results."""
    doc = await agent_tasks_col.find_one({"_id": task_id})
    if not doc:
        raise HTTPException(status_code=404, detail=f"Agent task '{task_id}' not found")
    doc["_id"] = str(doc["_id"])
    return doc
