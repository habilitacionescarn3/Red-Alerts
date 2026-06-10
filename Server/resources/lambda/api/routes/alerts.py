"""Recent alerts route (reads normalized events from MySQL via controllers)."""

from datetime import date, datetime, timezone
from typing import Any, Dict, Optional

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import JSONResponse

from codebase.controllers import (
    get_event,
    list_by_category,
    list_by_city,
    list_by_date,
    list_by_date_range,
    list_dates_in_month,
    list_last_24h,
    list_recent,
)
from codebase.time.israel import utc_to_israel_date

router = APIRouter()

# CloudFront respects s-maxage; browsers see max-age=0 and always ask the CDN.
# The 3-second s-maxage collapses a broadcast-triggered thundering herd (all
# browsers refetching at the same moment) into a single origin request.
_LAST_24H_CACHE_CONTROL = "public, max-age=0, s-maxage=5"

# Whole-past ranges barely change (only the background geocoder backfills city
# coordinates), but a minute at the CDN is enough to absorb repeat views while
# keeping freshly-geocoded polygons visible quickly.
_PAST_RANGE_CACHE_CONTROL = "public, max-age=0, s-maxage=60"

# Hard cap on the date-range span: keeps a single response bounded and the
# CloudFront cache key space small (the analytics client never asks for more).
_RANGE_MAX_DAYS = 31


@router.get("/api/alerts/last-24h")
async def list_alerts_last_24h(
    limit: int = Query(500, ge=1, le=500),
) -> JSONResponse:
    """Return every event received in the last 24 hours, newest first."""
    data = list_last_24h(limit=limit)
    return JSONResponse(content=data, headers={"Cache-Control": _LAST_24H_CACHE_CONTROL})


@router.get("/api/alerts/dates")
async def list_alert_dates(
    year: int = Query(..., ge=2000, le=2100),
    month: int = Query(..., ge=1, le=12),
) -> Dict[str, Any]:
    """Return Israel-local dates in a month that have at least one event."""
    return list_dates_in_month(year=year, month=month)


@router.get("/api/alerts/range")
async def list_alerts_range(
    from_: str = Query(
        ..., alias="from", description="Israel-local start day (YYYY-MM-DD), inclusive."
    ),
    to: str = Query(..., description="Israel-local end day (YYYY-MM-DD), inclusive."),
    limit: int = Query(2000, ge=1, le=5000),
) -> JSONResponse:
    """Return every event in an inclusive Israel-local date range, newest first.

    One parameterized endpoint (instead of N per-day calls) so CloudFront can
    cache each distinct range URL: fully-past ranges for a minute, ranges that
    touch today for the same 5 seconds as ``/last-24h``.
    """
    try:
        start = date.fromisoformat(from_.strip())
        end = date.fromisoformat(to.strip())
    except ValueError as exc:
        raise HTTPException(
            status_code=400, detail="Dates must be YYYY-MM-DD."
        ) from exc
    if start > end:
        raise HTTPException(status_code=400, detail="'from' must not be after 'to'.")
    if (end - start).days + 1 > _RANGE_MAX_DAYS:
        raise HTTPException(
            status_code=400, detail=f"Range is capped at {_RANGE_MAX_DAYS} days."
        )

    data = list_by_date_range(
        from_date=start.isoformat(), to_date=end.isoformat(), limit=limit
    )
    today = utc_to_israel_date(datetime.now(timezone.utc))
    cache_control = (
        _PAST_RANGE_CACHE_CONTROL if end.isoformat() < today else _LAST_24H_CACHE_CONTROL
    )
    return JSONResponse(content=data, headers={"Cache-Control": cache_control})


@router.get("/api/alerts/by-date")
async def list_alerts_by_date(
    date: str = Query(..., description="Israel-local day (YYYY-MM-DD)."),
    limit: int = Query(500, ge=1, le=500),
) -> Dict[str, Any]:
    """Return every event on the given Israel-local day, newest first."""
    return list_by_date(date=date, limit=limit)


@router.get("/api/alerts")
async def list_alerts(
    limit: int = Query(50, ge=1, le=500),
    city: Optional[str] = Query(
        None, description="Filter to events affecting this city (name or UUID)."
    ),
    category: Optional[str] = Query(
        None, description="Filter to events of this category (code or UUID)."
    ),
) -> Dict[str, Any]:
    """Return recent events, newest first.

    Optionally filter by ``city`` or ``category`` (city takes precedence if
    both are supplied).
    """
    if city:
        return list_by_city(city, limit=limit)
    if category:
        return list_by_category(category, limit=limit)
    return list_recent(limit=limit)


# NOTE: keep this path-parameter route registered LAST. Starlette matches
# routes in declaration order, so any literal /api/alerts/... route added
# below it would be swallowed by {event_id} and 404 as an unknown UUID.
@router.get("/api/alerts/{event_id}")
async def get_alert(event_id: str) -> Dict[str, Any]:
    """Return one event by its UUID (the standard single-event envelope).

    Backs shareable deep links (?event=<id> on the client): the home page
    fetches an event by id when it is outside the windows it already loaded.
    """
    data = get_event(event_id)
    if data is None:
        raise HTTPException(
            status_code=404, detail=f"No event with id '{event_id}'."
        )
    return data
