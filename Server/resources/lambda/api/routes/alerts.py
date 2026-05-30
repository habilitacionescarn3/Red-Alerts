"""Recent alerts route (reads normalized events from MySQL via controllers)."""

from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Query

from codebase.controllers import (
    list_by_category,
    list_by_city,
    list_last_24h,
    list_recent,
)

router = APIRouter()


@router.get("/api/alerts/last-24h")
async def list_alerts_last_24h(
    limit: int = Query(500, ge=1, le=500),
) -> List[Dict[str, Any]]:
    """Return every event received in the last 24 hours, newest first."""
    return list_last_24h(limit=limit)


@router.get("/api/alerts")
async def list_alerts(
    limit: int = Query(50, ge=1, le=500),
    city: Optional[str] = Query(
        None, description="Filter to events affecting this city (name or UUID)."
    ),
    category: Optional[str] = Query(
        None, description="Filter to events of this category (code or UUID)."
    ),
) -> List[Dict[str, Any]]:
    """Return recent events, newest first.

    Optionally filter by ``city`` or ``category`` (city takes precedence if
    both are supplied).
    """
    if city:
        return list_by_city(city, limit=limit)
    if category:
        return list_by_category(category, limit=limit)
    return list_recent(limit=limit)
