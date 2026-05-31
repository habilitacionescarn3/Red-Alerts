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
import time
from types import FrameType
from typing import Optional

from codebase.alerts import fetch_alert
from codebase.controllers import ingest_alert
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

_running = True


def _handle_signal(signum: int, _frame: Optional[FrameType]) -> None:
    """Stop the loop gracefully on SIGTERM/SIGINT (ECS task stop)."""
    global _running
    logger.info("Received signal %s, shutting down...", signum)
    _running = False


def run() -> None:
    signal.signal(signal.SIGTERM, _handle_signal)
    signal.signal(signal.SIGINT, _handle_signal)

    logger.info("Starting Red Alerts worker. Polling %s every %ss", OREF_URL, POLL_INTERVAL_SECONDS)

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
                        # ({status, added_cities, event}) - the shape the browser
                        # client expects (it reads broadcast.event / added_cities).
                        publish_alert(result)
                    except Exception as exc:  # noqa: BLE001
                        logger.error(
                            "Failed to publish event %s: %s", event["oref_id"], exc
                        )
        except Exception as exc:  # noqa: BLE001 - never let the loop die
            logger.error("Worker iteration error: %s", exc)

        time.sleep(POLL_INTERVAL_SECONDS)

    logger.info("Red Alerts worker stopped")


if __name__ == "__main__":
    run()
