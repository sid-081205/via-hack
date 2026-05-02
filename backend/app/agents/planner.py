"""Planner agent: guides the user through a structured travel-planning conversation.

Phases: discovery → trip_shape → hotels → flights → activities → confirmed.
Supports deploy_agents to kick off background specialist tasks.
All output is always lowercase.

Uses the raw Gemini SDK (google-generativeai) via app.agents.llm.
"""
from __future__ import annotations

import asyncio
import json
import logging
import re
import time
from datetime import date, datetime
from typing import Any

from app.db import trips_col
from app.models import PlannerOutput, RetrievalPack
from app.agents.llm import generate_text

logger = logging.getLogger(__name__)


DESTINATION_IMAGES = {
    "lisbon": "https://images.unsplash.com/photo-1585208798174-6cedd86e019a?w=400&h=250&fit=crop",
    "barcelona": "https://images.unsplash.com/photo-1583422409516-2895a77efded?w=400&h=250&fit=crop",
    "nice": "https://images.unsplash.com/photo-1491166617655-0723a0999cfc?w=400&h=250&fit=crop",
    "malaga": "https://images.unsplash.com/photo-1509840841025-9088ba78a826?w=400&h=250&fit=crop",
    "porto": "https://images.unsplash.com/photo-1555881400-74d7acaacd8b?w=400&h=250&fit=crop",
}


_SYSTEM_PROMPT = (
    'you are via, a personal travel agent. you always write entirely in lowercase '
    '— never capitalize anything, not even the first letter of a sentence or proper nouns. '
    'you are friendly, casual, knowledgeable, and concise. never formal.\n\n'
    '## conversation phases — follow this flow\n\n'
    '1. **discovery** — user mentions wanting to travel or a vibe. suggest 3 destinations with images. '
    'set phase to "discovery". return destination suggestions in `suggestions` as a list with keys: '
    'name, description, image_url, tagline. use these exact image URLs:\n'
    '   - lisbon: https://images.unsplash.com/photo-1585208798174-6cedd86e019a?w=400&h=250&fit=crop\n'
    '   - barcelona: https://images.unsplash.com/photo-1583422409516-2895a77efded?w=400&h=250&fit=crop\n'
    '   - nice: https://images.unsplash.com/photo-1491166617655-0723a0999cfc?w=400&h=250&fit=crop\n\n'
    '2. **trip_shape** — user selected a destination. ask about accommodation preferences '
    '(hotel vs airbnb, budget). set phase to "trip_shape".\n\n'
    '3. **hotels** — user stated hotel preference. deploy hotel agent: '
    'deploy_agents: [{"agent_type": "hotel", "query": "<preference> in <destination>"}]. '
    'ask about flight preferences. set phase to "hotels".\n\n'
    '4. **flights** — user states flight preference. deploy flight agent: '
    'deploy_agents: [{"agent_type": "flight", "query": "<preference> <origin> to <destination>"}]. '
    'set phase to "flights".\n\n'
    '5. **activities** — after hotel+flight agents deployed, suggest planning restaurants. '
    'when user agrees, deploy itinerary agent: '
    'deploy_agents: [{"agent_type": "itinerary", "query": "restaurants and activities in <destination>"}]. '
    'set phase to "activities".\n\n'
    '6. **confirmed** — everything planned. suggest transport/logistics. set phase to "confirmed".\n\n'
    '## key rules\n'
    '- advance phases naturally. don\'t skip.\n'
    '- deploy_agents: include ONLY when user confirmed a preference.\n'
    '- after deploying an agent, ask about the next thing.\n'
    '- suggestions: only for destination cards in discovery phase.\n'
    '- todos: always empty [].\n'
    '- all text in chat_reply must be entirely lowercase.\n'
    '- be concise. 2-4 sentences max.\n'
    '- "anything that makes the most of my time" means early/direct flights.\n\n'
    'respond with valid JSON only. no markdown, no backticks.\n'
    '{"chat_reply": "...", "phase": "...", "suggestions": null, "deploy_agents": null, "todos": []}'
)


def _build_user_prompt(
    user_message: str,
    retrieval: RetrievalPack,
    current_phase: str,
    trip_context: dict[str, Any],
    is_on_trip: bool,
) -> str:
    today_str = date.today().strftime("%A, %B %d, %Y").lower()
    dest = trip_context.get("destination", "unknown")
    dates = trip_context.get("dates", {})

    memory_str = (
        "\n".join(f"- {f}" for f in retrieval.memory_context)
        if retrieval.memory_context
        else "none"
    )

    recent = retrieval.recent_messages
    if recent:
        history_str = "\n".join(
            f"{m['role']}: {m['content']}" for m in recent[-6:]
        )
    else:
        history_str = "none"

    in_trip_note = ""
    if is_on_trip:
        in_trip_note = f"\nNOTE: the user is currently in {dest}. suggest things they can do today.\n"

    return (
        f"today: {today_str}\n"
        f"destination: {dest}\n"
        f"dates: {json.dumps(dates)}\n"
        f"current phase: {current_phase}\n"
        f"{in_trip_note}\n"
        f"memory facts about this user:\n{memory_str}\n\n"
        f"recent conversation:\n{history_str}\n\n"
        f"user message: {user_message}\n\n"
        f"respond with JSON."
    )


def _parse_planner_json(raw_text: str) -> PlannerOutput:
    """Parse LLM response text into PlannerOutput, handling markdown fences."""
    text = raw_text.strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*\n?", "", text)
        text = re.sub(r"\n?```\s*$", "", text)
        text = text.strip()

    try:
        parsed = json.loads(text)
        return PlannerOutput.model_validate(parsed)
    except (json.JSONDecodeError, Exception):
        pass

    match = re.search(r"\{[\s\S]*\}", text)
    if match:
        try:
            parsed = json.loads(match.group())
            return PlannerOutput.model_validate(parsed)
        except (json.JSONDecodeError, Exception) as inner_e:
            print(f"[PLANNER] JSON extraction fallback failed: {repr(inner_e)}")
            print(f"[PLANNER] Raw text (first 300 chars): {raw_text[:300]}")
            raise inner_e

    print(f"[PLANNER] No JSON found in response (len={len(raw_text)}): {raw_text[:300]}")
    raise ValueError(f"No valid JSON in LLM response (length={len(raw_text)})")


async def run_planner(
    user_id: str,
    trip_id: str,
    user_message: str,
    retrieval: RetrievalPack,
    current_phase: str = "discovery",
    max_retries: int = 0,
) -> tuple[str, list[dict], str, list[dict] | None, list[dict] | None]:
    """
    Run the planner. Returns (chat_reply, todo_docs, new_phase, suggestions, deploy_agents).

    deploy_agents is a list of {agent_type, query} dicts when agents should be deployed.
    """
    if not retrieval.recent_messages:
        greeting = (
            "hey! i'm via, your personal travel agent ✈️ tell me where you'd like to go "
            "— or just tell me the vibe you're after and i'll suggest some spots!"
        )
        return greeting, [], "discovery", None, None

    user_prompt = _build_user_prompt(
        user_message, retrieval, current_phase,
        retrieval.trip_context, retrieval.is_on_trip,
    )
    combined_prompt = f"{_SYSTEM_PROMPT}\n\n{user_prompt}"

    planner_output: PlannerOutput | None = None
    last_error: Exception | None = None
    max_attempts = 3

    for attempt in range(max_attempts):
        t0 = time.time()
        try:
            print(f"[PLANNER] attempt {attempt+1}/{max_attempts} calling LLM...")
            raw_text = await generate_text(combined_prompt, timeout=45.0)
            elapsed = time.time() - t0
            raw_text = (raw_text or "").strip()
            print(f"[PLANNER] got response in {elapsed:.2f}s (len={len(raw_text)})")
            planner_output = _parse_planner_json(raw_text)
            print(f"[PLANNER] ✓ parsed: phase={planner_output.phase}")
            break
        except asyncio.TimeoutError:
            elapsed = time.time() - t0
            print(f"[PLANNER] ✗ TIMEOUT after {elapsed:.2f}s (attempt {attempt+1})")
            last_error = asyncio.TimeoutError(f"LLM call timed out after {elapsed:.1f}s")
        except Exception as e:
            elapsed = time.time() - t0
            err_str = str(e)
            is_rate_limit = "429" in err_str or "RESOURCE_EXHAUSTED" in err_str
            print(f"[PLANNER] ✗ {'RATE_LIMITED' if is_rate_limit else 'ERROR'} after {elapsed:.2f}s (attempt {attempt+1}): {type(e).__name__}: {e}")
            last_error = e
            if is_rate_limit and attempt < max_attempts - 1:
                wait_time = 2.0 * (attempt + 1)
                print(f"[PLANNER]   waiting {wait_time}s before retry...")
                await asyncio.sleep(wait_time)
                continue
        if attempt < max_attempts - 1 and planner_output is None:
            await asyncio.sleep(1.0)

    if planner_output is None:
        print(f"[PLANNER] ✗ FAILED after all retries: {repr(last_error)}")
        return (
            "hmm, i'm having a moment — give me a sec and try again.",
            [],
            current_phase,
            None,
            None,
        )

    chat_reply = planner_output.chat_reply.lower()
    new_phase = planner_output.phase
    suggestions = planner_output.suggestions
    deploy_agents = None

    if planner_output.deploy_agents:
        deploy_agents = [
            {"agent_type": spec.agent_type, "query": spec.query}
            for spec in planner_output.deploy_agents
        ]

    await trips_col.update_one(
        {"_id": trip_id},
        {"$set": {
            "conversation_phase": new_phase,
            "updated_at": datetime.utcnow(),
        }},
    )

    return chat_reply, [], new_phase, suggestions, deploy_agents
