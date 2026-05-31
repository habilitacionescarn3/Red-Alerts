#!/usr/bin/env python3
"""Fire a synthetic alert to the IoT broadcast topic for end-to-end testing.

Builds one fake event (same shape as ``Event.to_dict()``) wrapped in the
broadcast envelope ``{status, added_cities, event, cities}`` and publishes it
through the normal ``publish_alert`` path - so every connected browser (local or
cloud) receives it exactly like a real Oref alert, without waiting for one.

Usage (publishes to the REAL AWS IoT topic; needs AWS creds + IOT_TOPIC set so it
matches the topic browsers subscribe to):

    make publish-test prod CITY="תל אביב - מרכז העיר"
"""

import sys
import uuid
from datetime import datetime, timezone
from typing import Any, Dict

from codebase.iot import publish_alert

# City/title text is Hebrew. Some consoles (e.g. Windows cp1252) can't encode it
# and the success print below fails with a write error - so force UTF-8 stdout.
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")  # type: ignore[union-attr]

DEFAULT_CITY = "חניתה"


def _city_arg() -> str:
    """First non-empty CLI arg, or the default city."""
    args = [arg.strip() for arg in sys.argv[1:] if arg.strip()]
    return args[0] if args else DEFAULT_CITY


def build_event(city: str, city_id: str) -> Dict[str, Any]:
    """A single synthetic event matching the live ``Event.to_dict()`` contract."""
    now = datetime.now(timezone.utc).isoformat()
    return {
        "id": str(uuid.uuid4()),
        "oref_id": f"test-{uuid.uuid4().hex[:12]}",
        "received_at": now,
        "last_seen_at": now,
        "category": {"id": str(uuid.uuid4()), "code": "1", "label": None},
        "title": {"id": str(uuid.uuid4()), "text": "ירי רקטות וטילים (בדיקה)"},
        "description": {
            "id": str(uuid.uuid4()),
            "text": "התרעת בדיקה - אין צורך לפעול.",
        },
        "cities": [{"id": city_id}],
    }


def main() -> None:
    city = _city_arg()
    city_id = str(uuid.uuid4())
    event = build_event(city, city_id)
    # Match the API envelope: per-city points live in ``cities`` (null here -> the
    # client renders the bundled-centroid fallback for this synthetic city).
    payload = {
        "status": "created",
        "added_cities": [city],
        "event": event,
        "cities": [{"id": city_id, "name": city, "coordinates": None}],
    }
    publish_alert(payload)
    print(f"Published test alert for '{city}' (event {event['id']}).")


if __name__ == "__main__":
    main()
