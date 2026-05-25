"""In-memory latest sensor values — instant UI updates without waiting on Neon."""
from datetime import datetime, timezone
from typing import Any

_latest: dict[str, dict[str, Any]] = {}


def set_reading(bin_id: str, payload: dict[str, Any]) -> None:
    _latest[str(bin_id)] = payload


def get_reading(bin_id: str) -> dict[str, Any] | None:
    return _latest.get(str(bin_id))


def all_readings() -> list[dict[str, Any]]:
    return list(_latest.values())
