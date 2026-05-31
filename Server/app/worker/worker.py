#!/usr/bin/env python3
"""Red Alerts always-on worker (runs on ECS/EC2).

Loop: poll Oref every second -> group the alert into its event (see
``Event.ingest``) -> when something new happens (a new event opened, or an open
event gained a city) persist it and publish the current event ONCE to the IoT
broadcast topic so every subscribed browser receives it. Repeats and city
removals are absorbed silently.

Shared logic lives in ``codebase`` (the same modules the API Lambda uses via the
backend-code-layer); here it is COPYed into the container image.
"""

import logging
import os
import signal
import threading
import time
from types import FrameType
from typing import Dict, Optional

from codebase.alerts import fetch_alert
from codebase.controllers import ingest_alert, resolve_next_unresolved
from codebase.iot import publish_alert

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger("red-alerts-worker")

OREF_URL = os.environ.get(
    "OREF_URL", "https://www.oref.org.il/WarningMessages/alert/alerts.json"
)
# Poll Oref once per second by default (overridable via POLL_INTERVAL_SECONDS).
POLL_INTERVAL_SECONDS = int(os.environ.get("POLL_INTERVAL_SECONDS", "1"))

# Background geocoding (resolve city names -> coordinates) runs in its OWN thread
# so it never blocks the 1s poll/publish loop. Disable locally with
# GEOCODER_ENABLED=false. The interval must stay above Nominatim's ~1 req/sec
# policy; when the queue is empty the thread idles for GEOCODER_IDLE_SECONDS.
GEOCODER_ENABLED = os.environ.get("GEOCODER_ENABLED", "true").lower() == "true"
GEOCODER_INTERVAL_SECONDS = float(os.environ.get("GEOCODER_INTERVAL_SECONDS", "1.1"))
GEOCODER_IDLE_SECONDS = float(os.environ.get("GEOCODER_IDLE_SECONDS", "10"))
# Cooldown before re-attempting a city whose lookup transiently errored, so one
# bad lookup doesn't block the cities queued behind it.
GEOCODER_ERROR_COOLDOWN_SECONDS = float(
    os.environ.get("GEOCODER_ERROR_COOLDOWN_SECONDS", "60")
)

_running = True
# Lets the geocoder thread wake immediately on shutdown instead of sleeping out
# its full interval.
_stop_event = threading.Event()


def _handle_signal(signum: int, _frame: Optional[FrameType]) -> None:
    """Stop the loop gracefully on SIGTERM/SIGINT (ECS task stop)."""
    global _running
    logger.info("Received signal %s, shutting down...", signum)
    _running = False
    _stop_event.set()


class GeoResolverThread(threading.Thread):
    """Throttled background drainer of the unresolved-cities geocoding queue.

    Independent of the poll loop: each tick resolves at most one city via
    Nominatim, then sleeps GEOCODER_INTERVAL_SECONDS (longer when the queue is
    empty). Cities whose lookup transiently errors are skipped for a cooldown so
    they don't stall the queue.
    """

    def __init__(self) -> None:
        super().__init__(name="geo-resolver", daemon=True)
        self._cooldowns: Dict[str, float] = {}

    def _active_skip_ids(self) -> set:
        now = time.monotonic()
        expired = [cid for cid, until in self._cooldowns.items() if until <= now]
        for cid in expired:
            del self._cooldowns[cid]
        return set(self._cooldowns)

    def run(self) -> None:
        logger.info(
            "Starting geocoder thread (interval=%ss, idle=%ss)",
            GEOCODER_INTERVAL_SECONDS,
            GEOCODER_IDLE_SECONDS,
        )
        while not _stop_event.is_set():
            attempted = False
            try:
                outcome = resolve_next_unresolved(skip_ids=self._active_skip_ids())
                attempted = outcome.attempted
                if outcome.errored_city_id is not None:
                    self._cooldowns[outcome.errored_city_id] = (
                        time.monotonic() + GEOCODER_ERROR_COOLDOWN_SECONDS
                    )
            except Exception as exc:  # noqa: BLE001 - never let the thread die
                logger.error("Geocoder iteration error: %s", exc)
            delay = GEOCODER_INTERVAL_SECONDS if attempted else GEOCODER_IDLE_SECONDS
            _stop_event.wait(delay)
        logger.info("Geocoder thread stopped")


def run() -> None:
    signal.signal(signal.SIGTERM, _handle_signal)
    signal.signal(signal.SIGINT, _handle_signal)

    logger.info("Starting Red Alerts worker. Polling %s every %ss", OREF_URL, POLL_INTERVAL_SECONDS)

    geo_thread: Optional[GeoResolverThread] = None
    if GEOCODER_ENABLED:
        geo_thread = GeoResolverThread()
        geo_thread.start()
    else:
        logger.info("GEOCODER_ENABLED=false - skipping background geocoder thread")

    while _running:
        try:
            raw = fetch_alert(OREF_URL)
            if raw:
                # Grouping is authoritative in Event.ingest: returns a result
                # only when a new event opened or an open one gained cities,
                # else None (repeat / city removal / already absorbed id).
                try:
                    result = ingest_alert(raw)
                except Exception as exc:  # noqa: BLE001
                    logger.error("Failed to persist alert %s: %s", raw.get("id"), exc)
                    result = None

                if result is not None:
                    event = result["event"]
                    title = (event.get("title") or {}).get("text")
                    if result["status"] == "created":
                        logger.info("New event %s: %s", event["oref_id"], title)
                    else:
                        logger.info(
                            "Event %s +%d cities (%s): %s",
                            event["oref_id"],
                            len(result["added_cities"]),
                            ", ".join(result["added_cities"]),
                            title,
                        )
                    try:
                        # Broadcast the full result wrapper
                        # ({status, added_cities, event, cities}) - the shape the
                        # browser client expects (it reads broadcast.event /
                        # added_cities and joins per-city points from cities).
                        publish_alert(result)
                    except Exception as exc:  # noqa: BLE001
                        logger.error(
                            "Failed to publish event %s: %s", event["oref_id"], exc
                        )
        except Exception as exc:  # noqa: BLE001 - never let the loop die
            logger.error("Worker iteration error: %s", exc)

        time.sleep(POLL_INTERVAL_SECONDS)

    _stop_event.set()
    if geo_thread is not None:
        geo_thread.join(timeout=5)

    logger.info("Red Alerts worker stopped")


if __name__ == "__main__":
    run()
