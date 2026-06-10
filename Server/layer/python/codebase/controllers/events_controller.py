"""Event use-cases used by BOTH the API Lambda (read) and the worker (write).

Each function owns a short-lived session (via ``session_scope``) that draws a
connection from the shared, reused engine pool. Read endpoints execute exactly
ONE SQL statement (the database assembles the whole JSON envelope - see
``_fetch_envelope``); the worker's write path serializes its ORM objects to
plain dicts inside the session so no lazy loads escape it.
"""

import json
from datetime import datetime
from typing import TYPE_CHECKING, Any, Dict, Iterable, List, Optional

from sqlalchemy import case, func, null, select

from codebase.database.engine import session_scope
from codebase.models.category import Category
from codebase.models.city import City
from codebase.models.description import Description
from codebase.models.event import Event, event_cities
from codebase.models.title import Title

if TYPE_CHECKING:
    from sqlalchemy.orm import Query, Session

# DATE_FORMAT pattern producing the same string as datetime.isoformat() for
# whole-second DATETIME values, so the SQL-built envelope matches the old
# Python-built one byte for byte.
_ISO_DATETIME = "%Y-%m-%dT%H:%i:%s"


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


def _fetch_envelope(session: "Session", events_query: "Query") -> Dict[str, Any]:
    """Standard envelope, assembled BY THE DATABASE in one SQL statement.

    ``events_query`` is one of the ``Event`` read queries (filters + order +
    limit over the narrow event columns). It becomes a CTE, and the statement
    builds the whole ``{"events": [...], "cities": [...]}`` JSON around it with
    JSON_OBJECT/JSON_ARRAYAGG - so one client request = exactly one round trip
    to the database, returning a single JSON row. Each distinct city's
    (potentially large) ``coordinates`` JSON is serialized once, in the
    response-level ``cities`` array; events reference cities by id only.

    MySQL's JSON_ARRAYAGG does not define element order, so events are
    re-sorted newest-first in Python after parsing (ISO timestamps sort
    lexically). City order inside the arrays is non-contractual - the client
    joins by id.
    """
    sel = events_query.cte("sel")

    per_event_cities = func.coalesce(
        select(func.json_arrayagg(func.json_object("id", event_cities.c.city_id)))
        .where(event_cities.c.event_id == sel.c.id)
        .scalar_subquery(),
        func.json_array(),
    )
    events_json = (
        select(
            func.json_arrayagg(
                func.json_object(
                    "id",
                    sel.c.id,
                    "oref_id",
                    sel.c.oref_id,
                    "received_at",
                    func.date_format(sel.c.received_at, _ISO_DATETIME),
                    "last_seen_at",
                    func.date_format(sel.c.last_seen_at, _ISO_DATETIME),
                    "category",
                    case(
                        (Category.id.is_(None), null()),
                        else_=func.json_object(
                            "id",
                            Category.id,
                            "code",
                            Category.code,
                            "label",
                            Category.label,
                        ),
                    ),
                    "title",
                    case(
                        (Title.id.is_(None), null()),
                        else_=func.json_object("id", Title.id, "text", Title.text),
                    ),
                    "description",
                    case(
                        (Description.id.is_(None), null()),
                        else_=func.json_object(
                            "id", Description.id, "text", Description.text
                        ),
                    ),
                    "cities",
                    per_event_cities,
                )
            )
        )
        .select_from(sel)
        .outerjoin(Category, Category.id == sel.c.category_id)
        .outerjoin(Title, Title.id == sel.c.title_id)
        .outerjoin(Description, Description.id == sel.c.description_id)
        .scalar_subquery()
    )

    seen_city_ids = (
        select(event_cities.c.city_id)
        .where(event_cities.c.event_id.in_(select(sel.c.id)))
        .distinct()
    )
    cities_json = (
        select(
            func.json_arrayagg(
                func.json_object(
                    "id", City.id, "name", City.name, "coordinates", City.coordinates
                )
            )
        )
        .where(City.id.in_(seen_city_ids))
        .scalar_subquery()
    )

    stmt = select(
        func.json_object(
            "events",
            func.coalesce(events_json, func.json_array()),
            "cities",
            func.coalesce(cities_json, func.json_array()),
        )
    )
    payload = json.loads(session.execute(stmt).scalar_one())
    payload["events"].sort(key=lambda event: event["received_at"] or "", reverse=True)
    return payload


def ingest_alert(
    raw: Dict[str, Any], now: Optional[datetime] = None
) -> Optional[Dict[str, Any]]:
    """Fold a raw Oref alert into its event (see ``Event.ingest`` for grouping).

    ``now`` (UTC) is passed straight through to ``Event.ingest``; it defaults to
    the current time for live ingest, while a historical backfill supplies each
    row's own timestamp so events group and are dated as they originally were.

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
        result = Event.ingest(session, raw, now=now)
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
        return _fetch_envelope(session, Event.recent(session, limit=limit))


def list_last_24h(limit: int = 500) -> Dict[str, Any]:
    """Return every event received in the last 24 hours, newest first."""
    with session_scope() as session:
        return _fetch_envelope(
            session, Event.in_last_hours(session, hours=24, limit=limit)
        )


def list_dates_in_month(year: int, month: int) -> Dict[str, Any]:
    """Return Israel-local dates in a month that have at least one event."""
    with session_scope() as session:
        return {"dates": Event.dates_with_events_in_month(session, year, month)}


def list_by_date(date: str, limit: int = 500) -> Dict[str, Any]:
    """Return every event on an Israel-local calendar day, newest first."""
    with session_scope() as session:
        return _fetch_envelope(
            session, Event.on_date(session, date.strip(), limit=limit)
        )


def list_by_date_range(
    from_date: str, to_date: str, limit: int = 2000
) -> Dict[str, Any]:
    """Return every event in an inclusive Israel-local date range, newest first."""
    with session_scope() as session:
        return _fetch_envelope(
            session,
            Event.in_date_range(
                session, from_date.strip(), to_date.strip(), limit=limit
            ),
        )


def list_by_city(city: str, limit: int = 50) -> Dict[str, Any]:
    """Return recent events affecting a city (matched by name or UUID)."""
    with session_scope() as session:
        return _fetch_envelope(session, Event.by_city(session, city, limit=limit))


def list_by_category(category: str, limit: int = 50) -> Dict[str, Any]:
    """Return recent events of a category (matched by code or UUID)."""
    with session_scope() as session:
        return _fetch_envelope(
            session, Event.by_category(session, category, limit=limit)
        )


def get_event(event_id: str) -> Optional[Dict[str, Any]]:
    """Return one event by our UUID in the standard envelope, or ``None``."""
    with session_scope() as session:
        data = _fetch_envelope(session, Event.by_id(session, event_id))
        return data if data["events"] else None
