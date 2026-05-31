"""Geocoding use-cases: drain the implicit "unresolved cities" queue.

A city is enqueued for geocoding simply by existing with ``coordinates IS NULL``
(that is how ``get_or_create_city`` already inserts new cities). These functions
pick an unresolved city, look it up against Nominatim, and store the resulting
points - or ``[]`` when Nominatim has no match. A transient lookup failure leaves
the row NULL so it is retried on a later pass.

Transport-agnostic and side-effect-light: the worker calls them from a throttled
background thread, and the same functions back a future bulk-import script.
"""

import logging
from typing import NamedTuple, Optional, Set

from codebase.controllers.cities_controller import get_or_create_city
from codebase.database.engine import session_scope
from codebase.geo import NominatimError, geocode_city
from codebase.models.city import City

logger = logging.getLogger(__name__)

# How many unresolved cities to look at when picking the next one, so a city in
# ``skip_ids`` (recently errored) doesn't block the ones behind it.
_PICK_BATCH = 25


class ResolveOutcome(NamedTuple):
    """Result of one ``resolve_next_unresolved`` pass.

    ``attempted`` is True when a city was picked and looked up (regardless of
    whether points were found). ``errored_city_id`` is set only on a transient
    Nominatim failure, so the caller can back that city off and move on.
    """

    attempted: bool
    errored_city_id: Optional[str] = None


def enqueue_city(name: str) -> str:
    """Ensure a city row exists (auto-enqueued for geocoding if new); return its id."""
    return get_or_create_city(name)["id"]


def resolve_next_unresolved(skip_ids: Optional[Set[str]] = None) -> ResolveOutcome:
    """Geocode the oldest still-unresolved city.

    Steps (each DB touch is a short transaction so we never hold a connection
    open across the network call):
      1. Pick the oldest city with ``coordinates IS NULL`` (skipping ``skip_ids``).
      2. Look it up against Nominatim.
      3. Re-check it still lacks coordinates, then store the points (or ``[]``).

    On a transient :class:`NominatimError` the row is left NULL so it retries
    later, and the offending city id is returned in the outcome so the caller can
    apply a back-off.
    """
    skip_ids = skip_ids or set()

    with session_scope() as session:
        candidates = City.next_unresolved(session, limit=_PICK_BATCH)
        target = next((c for c in candidates if c.id not in skip_ids), None)
        if target is None:
            return ResolveOutcome(attempted=False)
        city_id, city_name = target.id, target.name

    try:
        points = geocode_city(city_name)
    except NominatimError as exc:
        logger.warning("Geocoding deferred for '%s': %s", city_name, exc)
        return ResolveOutcome(attempted=True, errored_city_id=city_id)

    with session_scope() as session:
        city = session.get(City, city_id)
        # Re-check: another pass (or the API) may have filled it meanwhile.
        if city is None or city.coordinates is not None:
            return ResolveOutcome(attempted=True)
        city.apply_coordinates(points)

    logger.info("Stored %d point(s) for city '%s'", len(points), city_name)
    return ResolveOutcome(attempted=True)


def resolve_unresolved_batch(limit: int = 100) -> int:
    """Resolve up to ``limit`` unresolved cities in a row; return how many were done.

    Used by the future bulk-import backfill. Still one Nominatim call per city, so
    callers should pace it (the worker's thread does this via its sleep interval).
    Cities that transiently error are skipped within the batch so the loop keeps
    making progress instead of retrying the same row.
    """
    done = 0
    skip_ids: Set[str] = set()
    for _ in range(max(0, int(limit))):
        outcome = resolve_next_unresolved(skip_ids=skip_ids)
        if not outcome.attempted:
            break
        if outcome.errored_city_id is not None:
            skip_ids.add(outcome.errored_city_id)
        else:
            done += 1
    return done
