"""Stay search tool: loads and filters the hardcoded hotel corpus."""
from __future__ import annotations

import json
import logging
from pathlib import Path
from urllib.parse import quote

logger = logging.getLogger(__name__)

_DATA_PATH = Path(__file__).parent.parent / "data" / "hotels.json"


def load_hotels() -> list[dict]:
    """Load all hotels from the hardcoded JSON corpus."""
    with open(_DATA_PATH) as f:
        return json.load(f)


def build_booking_url(hotel_name: str) -> str:
    """Build a Booking.com search URL for a hotel."""
    query = quote(f"{hotel_name} Lisbon")
    return f"https://www.booking.com/search.html?ss={query}"


def format_hotel_summary(hotel: dict, nights: int = 2) -> str:
    """Format a hotel dict into a concise summary string."""
    total = hotel["price_per_night_gbp"] * nights
    return (
        f"{hotel['name']} | "
        f"{'⭐' * hotel['stars']} | "
        f"{hotel['area']} | "
        f"£{hotel['price_per_night_gbp']}/night (£{total} total) | "
        f"{hotel['vibe']}"
    )
