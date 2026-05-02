"""Memory extraction agent — disabled (no-op).

The memory/vector-search feature is skipped for now.
extract_memory is kept as a callable no-op so existing callers don't break.
"""
from __future__ import annotations

import logging

logger = logging.getLogger(__name__)


async def extract_memory(
    user_id: str,
    trip_id: str,
    user_message: str,
    assistant_reply: str,
) -> None:
    """No-op: memory extraction is disabled."""
    return
