"""Flight search tool: loads and filters the hardcoded flight corpus."""
from __future__ import annotations

import json
import logging
from pathlib import Path

logger = logging.getLogger(__name__)

_DATA_PATH = Path(__file__).parent.parent / "data" / "flights.json"

def load_flights() -> list[dict]:
    """Load all flights from the hardcoded JSON corpus."""
    with open(_DATA_PATH) as f:
        return json.load(f)


def build_skyscanner_url(origin: str, dest: str, date: str) -> str:
    """Build a Skyscanner deep-link URL for a flight search."""
    date_compact = date[:10].replace("-", "")
    return f"https://www.skyscanner.net/transport/flights/{origin.lower()}/{dest.lower()}/{date_compact}/"


def format_flight_summary(flight: dict) -> str:
    """Format a flight dict into a concise summary string."""
    dep = flight["departure"][11:16]
    arr = flight["arrival"][11:16]
    stops = "Direct" if flight["stops"] == 0 else f"{flight['stops']} stop"
    return (
        f"{flight['airline']} {flight['flight_no']} | "
        f"{flight['origin']} → {flight['dest']} | "
        f"{dep}–{arr} | "
        f"{stops} | "
        f"£{flight['price_gbp']}"
    )
