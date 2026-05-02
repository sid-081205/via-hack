"""Shared Gemini LLM helper — direct google-generativeai SDK.

One lazily-initialized GenerativeModel per process. Every call is wrapped in
an asyncio timeout so a slow LLM response can never hang the turn.
"""
from __future__ import annotations

import asyncio
import logging
from typing import Any

import google.generativeai as genai

from app.config import settings

logger = logging.getLogger(__name__)

_model: genai.GenerativeModel | None = None


def get_model() -> genai.GenerativeModel:
    """Lazy-init the shared Gemini model."""
    global _model
    if _model is None:
        genai.configure(api_key=settings.GOOGLE_API_KEY)
        _model = genai.GenerativeModel(settings.LLM_MODEL)
    return _model


async def generate_text(prompt: str, timeout: float = 45.0) -> str:
    """Plain-text generation with a hard timeout. Raises asyncio.TimeoutError on timeout."""
    model = get_model()
    response = await asyncio.wait_for(
        model.generate_content_async(prompt),
        timeout=timeout,
    )
    return response.text or ""


async def generate_json(
    prompt: str,
    schema: Any,
    timeout: float = 12.0,
):
    """Structured JSON generation. `schema` is a Pydantic model class.

    Returns a parsed instance of `schema`. Raises asyncio.TimeoutError on timeout.
    """
    model = get_model()
    response = await asyncio.wait_for(
        model.generate_content_async(
            prompt,
            generation_config={
                "response_mime_type": "application/json",
                "response_schema": schema,
            },
        ),
        timeout=timeout,
    )
    return schema.model_validate_json(response.text or "{}")
