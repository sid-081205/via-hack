"""Memory tools — disabled (no-op stubs).

The memory/vector-search feature is skipped for now.
All functions return empty results without calling any external API.
"""
from __future__ import annotations

import logging

logger = logging.getLogger(__name__)


async def search_memory(user_id: str, query: str, k: int = 5) -> list[str]:
    """No-op: returns an empty list."""
    return []


async def store_memory(user_id: str, fact: str, source_trip_id: str = "") -> str:
    """No-op: does nothing."""
    return ""


async def extract_facts(
    user_id: str,
    trip_id: str,
    user_message: str,
    assistant_reply: str,
    llm=None,
) -> list[str]:
    """No-op: returns an empty list."""
    return []
