"""Israel-local calendar helpers for alert date queries."""

from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from typing import Tuple
from zoneinfo import ZoneInfo

ISRAEL_TZ = ZoneInfo("Asia/Jerusalem")


def israel_month_utc_bounds(year: int, month: int) -> Tuple[datetime, datetime]:
    """UTC-naive bounds ``[start, end)`` covering an Israel-local calendar month."""
    start_local = datetime(year, month, 1, tzinfo=ISRAEL_TZ)
    if month == 12:
        end_local = datetime(year + 1, 1, 1, tzinfo=ISRAEL_TZ)
    else:
        end_local = datetime(year, month + 1, 1, tzinfo=ISRAEL_TZ)
    return (
        start_local.astimezone(timezone.utc).replace(tzinfo=None),
        end_local.astimezone(timezone.utc).replace(tzinfo=None),
    )


def israel_day_utc_bounds(date_str: str) -> Tuple[datetime, datetime]:
    """UTC-naive bounds ``[start, end)`` for one Israel-local day (YYYY-MM-DD)."""
    day = date.fromisoformat(date_str)
    start_local = datetime(day.year, day.month, day.day, tzinfo=ISRAEL_TZ)
    end_local = start_local + timedelta(days=1)
    return (
        start_local.astimezone(timezone.utc).replace(tzinfo=None),
        end_local.astimezone(timezone.utc).replace(tzinfo=None),
    )


def utc_to_israel_date(dt: datetime) -> str:
    """Format a stored UTC-naive timestamp as YYYY-MM-DD in Israel."""
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    local = dt.astimezone(ISRAEL_TZ)
    return local.date().isoformat()
