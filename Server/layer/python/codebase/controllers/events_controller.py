"""Event use-cases used by BOTH the API Lambda (read) and the worker (write).

Each function owns a short-lived session (via ``session_scope``) that draws a
connection from the shared, reused engine pool. The ORM objects are serialized
to plain dicts inside the session so callers get JSON-ready data with no lazy
loads escaping the session.
"""

from typing import Any, Dict, Iterable, List, Optional

from codebase.database.engine import session_scope
from codebase.models.event import Event


def _collect_cities(events: Iterable[Event]) -> List[Dict[str, Any]]:
    """Distinct cities across ``events`` with their geocoded points, once each.

    Coordinates live here (response-level) rather than inside every event, so a
    city referenced by many events carries its (potentially large) points array
    a single time. ``coordinates`` is null until geocoded, then an
    [[lng, lat], ...] array: one point -> marker, many -> polygon area.
    """
    seen: Dict[str, Dict[str, Any]] = {}
    for event in events:
        for city in event.cities:
            seen.setdefault(
                city.id,
                {"id": city.id, "name": city.name, "coordinates": city.coordinates},
            )
    return list(seen.values())


def serialize_alerts(events: Iterable[Event]) -> Dict[str, Any]:
    """Envelope shared by every event-returning endpoint.

    Shape::

        {"events": [ ...event.to_dict()... ],
         "cities": [ {"id", "name", "coordinates"} ]}

    so per-city points are sent once (in ``cities``) and events just reference
    cities by id/name. Must be called while the session is open (it reads the
    eager-loaded ``event.cities`` / ``city.coordinates``).
    """
    events = list(events)
    return {
        "events": [event.to_dict() for event in events],
        "cities": _collect_cities(events),
    }


def ingest_alert(raw: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """Fold a raw Oref alert into its event (see ``Event.ingest`` for grouping).

    Returns a publishable result, or ``None`` when nothing worth broadcasting
    happened (the id was already absorbed, or the alert only repeated/removed
    cities of an open event). The result shape mirrors the API envelope so the
    client has one parsing path for REST + realtime::

        {
            "status": "created" | "updated",
            "added_cities": [<city name>, ...],   # what this alert contributed
            "event": { ...full event.to_dict()... },
            "cities": [ {"id", "name", "coordinates"} ],  # this event's cities
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
            "cities": _collect_cities([result.event]),
        }


def list_recent(limit: int = 50) -> Dict[str, Any]:
    """Return the most recent events, newest first (deduped-cities envelope)."""
    with session_scope() as session:
        return serialize_alerts(Event.recent(session, limit=limit))


def list_last_24h(limit: int = 500) -> Dict[str, Any]:
    """Return every event received in the last 24 hours, newest first."""
    with session_scope() as session:
        return serialize_alerts(
            Event.in_last_hours(session, hours=24, limit=limit)
        )


def list_by_city(city: str, limit: int = 50) -> Dict[str, Any]:
    """Return recent events affecting a city (matched by name or UUID)."""
    with session_scope() as session:
        return serialize_alerts(Event.by_city(session, city, limit=limit))


def list_by_category(category: str, limit: int = 50) -> Dict[str, Any]:
    """Return recent events of a category (matched by code or UUID)."""
    with session_scope() as session:
        return serialize_alerts(Event.by_category(session, category, limit=limit))
