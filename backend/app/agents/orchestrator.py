"""Main orchestrator: process_user_turn ties the full pipeline together.

Pipeline:
  adaptive_retrieve → planner → [deploy background agents if needed]

Memory extraction is currently a no-op and is not invoked from this pipeline.
"""
from __future__ import annotations

import asyncio
import logging
import time
import uuid
from datetime import datetime
from typing import Any

from app.config import settings
from app.db import messages_col, trips_col, agent_tasks_col
from app.models import RetrievalPack
from app.agents.retrieval import adaptive_retrieve
from app.agents.planner import run_planner
from app.agents.background_agents import run_background_agent

logger = logging.getLogger(__name__)


async def _save_message(trip_id: str, user_id: str, role: str, content: str) -> None:
    await messages_col.insert_one({
        "_id": str(uuid.uuid4()),
        "trip_id": trip_id,
        "user_id": user_id,
        "role": role,
        "content": content,
        "ts": datetime.utcnow(),
    })


async def _get_current_phase(trip_id: str) -> str:
    """Read the current conversation phase from the trip document."""
    doc = await trips_col.find_one(
        {"_id": trip_id},
        {"conversation_phase": 1, "_id": 0},
    )
    if doc and doc.get("conversation_phase"):
        return doc["conversation_phase"]
    return "discovery"


async def _deploy_agents(
    trip_id: str,
    deploy_specs: list[dict],
) -> list[dict]:
    """Deploy background agents and return their task IDs."""
    deployed = []
    for spec in deploy_specs:
        agent_type = spec.get("agent_type") if isinstance(spec, dict) else spec.agent_type
        query = spec.get("query") if isinstance(spec, dict) else spec.query

        task_id = f"task_{uuid.uuid4().hex[:12]}"
        now = datetime.utcnow()

        doc = {
            "_id": task_id,
            "trip_id": trip_id,
            "agent_type": agent_type,
            "status": "running",
            "query": query,
            "results": [],
            "created_at": now,
            "updated_at": now,
        }
        await agent_tasks_col.insert_one(doc)

        asyncio.create_task(
            run_background_agent(task_id, trip_id, agent_type, query)
        )

        deployed.append({"task_id": task_id, "agent_type": agent_type, "query": query})

    return deployed


async def process_user_turn(
    user_id: str,
    trip_id: str,
    user_message: str,
) -> tuple[str, list[dict], str, list[dict[str, Any]] | None, list[dict[str, Any]] | None]:
    """
    Full pipeline: retrieve → plan → [deploy agents if needed] → bg memory.

    Returns (final_reply, todo_docs, phase, suggestions, deployed_agents).
    """
    t0 = time.time()
    print(f"[ORCHESTRATOR] ▶ START process_user_turn user={user_id} trip={trip_id} msg={user_message[:60]!r}")

    # 1. Save user message
    await _save_message(trip_id, user_id, "user", user_message)
    print(f"[ORCHESTRATOR]   saved user message ({time.time()-t0:.2f}s)")

    # 2. Read current phase from trip doc
    current_phase = await _get_current_phase(trip_id)
    print(f"[ORCHESTRATOR]   phase={current_phase} ({time.time()-t0:.2f}s)")

    # 3. Adaptive retrieval (multi-source)
    retrieval: RetrievalPack = await adaptive_retrieve(user_id, trip_id, user_message)
    print(f"[ORCHESTRATOR]   retrieval done ({time.time()-t0:.2f}s)")

    # 4. Planner — outputs chat reply + phase + suggestions + deploy_agents
    chat_reply, todo_docs, new_phase, suggestions, deploy_specs = await run_planner(
        user_id=user_id,
        trip_id=trip_id,
        user_message=user_message,
        retrieval=retrieval,
        current_phase=current_phase,
    )
    print(f"[ORCHESTRATOR]   planner done phase={new_phase} ({time.time()-t0:.2f}s)")

    # 5. Deploy background agents if planner requested them
    deployed_agents: list[dict] | None = None
    if deploy_specs:
        deployed_agents = await _deploy_agents(trip_id, deploy_specs)
        print(f"[ORCHESTRATOR]   deployed {len(deployed_agents)} agents ({time.time()-t0:.2f}s)")

    # Enforce lowercase
    final_reply = chat_reply.lower()

    # 6. Save assistant message
    await _save_message(trip_id, user_id, "assistant", final_reply)

    elapsed = time.time() - t0
    print(f"[ORCHESTRATOR] ✓ DONE in {elapsed:.2f}s reply={final_reply[:80]!r}")
    return final_reply, todo_docs, new_phase, suggestions, deployed_agents
