"""Event use-cases used by BOTH the API Lambda (read) and the worker (write).

Each function owns a short-lived session (via ``session_scope``) that draws a
connection from the shared, reused engine pool. The ORM objects are serialized
to plain dicts inside the session so callers get JSON-ready data with no lazy
loads escaping the session.
"""

from typing import Any, Dict, List, Optional

from codebase.database.engine import session_scope
from codebase.models.event import Event


def ingest_alert(raw: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """Fold a raw Oref alert into its event (see ``Event.ingest`` for grouping).

    Returns a publishable result, or ``None`` when nothing worth broadcasting
    happened (the id was already absorbed, or the alert only repeated/removed
    cities of an open event). The result shape is::

        {
            "status": "created" | "updated",
            "added_cities": [<city name>, ...],   # what this alert contributed
            "event": { ...full event.to_dict()... },
        }

    so the caller can both log what changed and broadcast the complete, current
    event (every city accumulated so far) to clients.
    """
    with session_scope() as session:
        result = Event.ingest(session, raw)
        if result is None or result.status == "unchanged":
            return None
        return {
            "status": result.status,
            "added_cities": result.added_cities,
            "event": result.event.to_dict(),
        }


def list_recent(limit: int = 50) -> List[Dict[str, Any]]:
    """Return the most recent events, newest first."""
    with session_scope() as session:
        return [event.to_dict() for event in Event.recent(session, limit=limit)]


def list_last_24h(limit: int = 500) -> List[Dict[str, Any]]:
    """Return every event received in the last 24 hours, newest first."""
    with session_scope() as session:
        return [
            event.to_dict()
            for event in Event.in_last_hours(session, hours=24, limit=limit)
        ]


def list_by_city(city: str, limit: int = 50) -> List[Dict[str, Any]]:
    """Return recent events affecting a city (matched by name or UUID)."""
    with session_scope() as session:
        return [
            event.to_dict()
            for event in Event.by_city(session, city, limit=limit)
        ]


def list_by_category(category: str, limit: int = 50) -> List[Dict[str, Any]]:
    """Return recent events of a category (matched by code or UUID)."""
    with session_scope() as session:
        return [
            event.to_dict()
            for event in Event.by_category(session, category, limit=limit)
        ]
