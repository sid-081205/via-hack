"""Places search tool: loads and filters the hardcoded restaurant/activity corpus."""
from __future__ import annotations

import json
import logging
from pathlib import Path
from urllib.parse import quote

logger = logging.getLogger(__name__)

_DATA_PATH = Path(__file__).parent.parent / "data" / "restaurants.json"


def load_restaurants() -> list[dict]:
    """Load all restaurants from the hardcoded JSON corpus."""
    with open(_DATA_PATH) as f:
        return json.load(f)


def build_maps_url(name: str) -> str:
    """Build a Google Maps search URL for a restaurant."""
    query = quote(f"{name} Lisbon")
    return f"https://www.google.com/maps/search/{query}"


def format_restaurant_summary(r: dict) -> str:
    """Format a restaurant dict into a concise summary string."""
    veg = " | ✓ vegetarian-friendly" if r.get("vegetarian_friendly") else ""
    return (
        f"{r['name']} | "
        f"{r['cuisine']} | "
        f"{r['area']} | "
        f"{r['price_range']} | "
        f"{r['vibe']}{veg}"
    )
