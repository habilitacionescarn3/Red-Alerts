#!/usr/bin/env python3
"""Backfill city coordinates for EVERY city in the database (used by `make geocode`).

Drains the implicit geocoding queue - all cities with ``coordinates IS NULL`` -
through the SAME shared ``geocoding_controller`` the worker thread uses, one
Nominatim lookup at a time. Pacing is enforced here (a sleep between lookups) so
a one-shot backfill of thousands of cities stays under Nominatim's ~1 req/sec
policy, exactly like the live worker.

This is the reusable seam for the future historical import: insert every city
(``get_or_create_city`` leaves new rows NULL = enqueued), then run this once.

Usage:
    make geocode prod local                 # drain all unresolved cities
    make geocode prod local LIMIT=500        # cap how many to do this run
    make geocode prod local INTERVAL=1.5     # slow the pace down
    make geocode prod local RESET=1          # re-geocode EVERY city from scratch

``RESET=1`` first sets every city's ``coordinates`` back to NULL, so even cities
already resolved (or stored as ``[]`` "no match") are looked up again.
"""

import argparse
import logging
import os
import sys
import time

from codebase.controllers import resolve_next_unresolved
from codebase.database.engine import session_scope
from codebase.models.city import City

# City names are Hebrew; force UTF-8 stdout so progress prints don't blow up on
# consoles that default to a non-UTF-8 codepage (e.g. Windows cp1252).
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")  # type: ignore[union-attr]

logger = logging.getLogger("red-alerts-geocode")

_DEFAULT_INTERVAL = float(os.environ.get("GEOCODER_INTERVAL_SECONDS", "1.1"))


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Backfill city coordinates via Nominatim.")
    parser.add_argument(
        "--limit",
        type=int,
        default=int(os.environ.get("LIMIT", "0") or 0),
        help="Max cities to resolve this run (0 = no limit; drain the whole queue).",
    )
    parser.add_argument(
        "--interval",
        type=float,
        default=float(os.environ.get("INTERVAL", "") or _DEFAULT_INTERVAL),
        help="Seconds to wait between lookups (must stay >= ~1s for Nominatim).",
    )
    parser.add_argument(
        "--reset",
        action="store_true",
        default=os.environ.get("RESET", "").lower() in {"1", "true", "yes"},
        help="Null out EVERY city's coordinates first, forcing a full re-geocode.",
    )
    return parser.parse_args()


def _reset_all_coordinates() -> int:
    """Set ``coordinates`` back to NULL for every city; return how many rows changed."""
    with session_scope() as session:
        return (
            session.query(City)
            .update({City.coordinates: None}, synchronize_session=False)
        )


def _count_unresolved() -> int:
    with session_scope() as session:
        return session.query(City).filter(City.coordinates.is_(None)).count()


def main() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    )
    args = _parse_args()
    interval = max(0.0, args.interval)

    if args.reset:
        reset = _reset_all_coordinates()
        logger.info("RESET: cleared coordinates on %d cities.", reset)

    pending = _count_unresolved()
    if pending == 0:
        logger.info("Nothing to do - every city already has coordinates.")
        return
    logger.info(
        "Geocoding %d unresolved cities (interval=%ss, limit=%s)...",
        pending,
        interval,
        args.limit or "none",
    )

    # Cities whose lookup transiently errored: skip them for the rest of THIS run
    # so they don't block the queue (they stay NULL and get retried by the worker
    # / a later backfill).
    skip_ids: set = set()
    resolved = 0
    errored = 0
    attempts = 0

    while True:
        if args.limit and attempts >= args.limit:
            logger.info("Reached limit of %d.", args.limit)
            break

        outcome = resolve_next_unresolved(skip_ids=skip_ids)
        if not outcome.attempted:
            break  # queue drained (or only skipped cities remain)

        attempts += 1
        if outcome.errored_city_id is not None:
            errored += 1
            skip_ids.add(outcome.errored_city_id)
        else:
            resolved += 1

        if attempts % 25 == 0:
            logger.info(
                "Progress: %d resolved, %d errored (%d remaining).",
                resolved,
                errored,
                _count_unresolved(),
            )

        # Pace ourselves to respect Nominatim's rate limit.
        if interval:
            time.sleep(interval)

    logger.info(
        "Done. %d resolved, %d errored/deferred, %d still unresolved.",
        resolved,
        errored,
        _count_unresolved(),
    )


if __name__ == "__main__":
    main()
