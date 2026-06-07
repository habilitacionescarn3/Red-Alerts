"""Publish alerts to the single IoT broadcast topic.

The worker calls ``publish_alert`` ONCE per new alert. Every browser subscribed
to the topic receives the same message (broadcast, not personalized).
"""

import json
import logging
import os
from typing import Any, Dict, Optional

import boto3

logger = logging.getLogger(__name__)

_DEFAULT_TOPIC = os.environ.get("IOT_TOPIC", "alerts")

# Set IOT_ENABLED=false to skip publishing entirely (handy for local dev, where
# the IoT data endpoint usually isn't reachable). Defaults to enabled.
_IOT_ENABLED = os.environ.get("IOT_ENABLED", "true").lower() == "true"

# AWS IoT Core hard limit for a single MQTT message. We enforce our own limit
# (_WARN_BYTES) well below it so a future payload regression shows up in
# CloudWatch before it hits the service limit.
_MQTT_MAX_BYTES = 131_072   # 128 KB — AWS service hard limit
_WARN_BYTES = 65_536        # 64 KB — log a warning at 50% of the limit

# Cache the data-plane client (its endpoint is account/region specific).
_cached_data_client = None


def _get_data_client():
    """Resolve the account's IoT data endpoint and return an iot-data client."""
    global _cached_data_client
    if _cached_data_client is not None:
        return _cached_data_client

    control = boto3.client("iot")
    endpoint = control.describe_endpoint(endpointType="iot:Data-ATS")["endpointAddress"]
    _cached_data_client = boto3.client(
        "iot-data", endpoint_url=f"https://{endpoint}"
    )
    return _cached_data_client


def _event_id(payload: Dict[str, Any]) -> Any:
    """Best-effort id for logging.

    ``payload`` is the broadcast wrapper ``{status, added_cities, event}``; fall
    back to a flat event dict for any direct callers.
    """
    event = payload.get("event") if isinstance(payload, dict) else None
    if isinstance(event, dict):
        return event.get("id") or event.get("oref_id")
    return payload.get("id") or payload.get("oref_id")


def _slim_for_broadcast(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Reduce the broadcast to a pure event-signal: metadata only, no cities.

    The broadcast is intentionally NOT a data payload — it is a signal that
    tells connected browsers "something changed, go fetch." The full event
    (cities, coordinates, everything) arrives via the HTTP refetch that the
    client triggers on every broadcast (``invalidateTodayAlerts``).

    Stripping all city data gives a consistent, fixed-shape message regardless
    of alert size, and keeps the payload tiny:

        { status, event: { id, oref_id, received_at, last_seen_at,
                           category, title, description } }

    No ``cities``, no ``added_cities``, no ``event.cities``.

    1. ``cities``       — geocoded polygon rings. 200 cities ≈ 200 KB alone.
    2. ``event.cities`` — id-only refs. 2 000 cities ≈ 92 KB; still enough to
                          blow the 128 KB IoT limit once ``added_cities`` is
                          included.
    3. ``added_cities`` — Hebrew name strings. 2 000 cities ≈ 44 KB; fine on
                          its own, but the point is a unified pipeline that
                          looks identical for 1 city or 2 000.

    After stripping, every broadcast is ~2 KB regardless of city count.
    """
    event = payload.get("event")
    slim_event = {k: v for k, v in event.items() if k != "cities"} if isinstance(event, dict) else event
    return {"status": payload.get("status"), "event": slim_event}


def _size_guarded(payload: Dict[str, Any], eid: Any) -> bytes:
    """Serialise ``payload`` to UTF-8 bytes, applying layered size guards.

    After _slim_for_broadcast the payload is always ~2 KB (fixed-size event
    metadata, no city data). The tiers below are belt-and-suspenders against
    future regressions — a new field with large data would need to be added
    to the broadcast dict before any of these could fire:

      Tier 1 (normal, ~2 KB)  – passes cleanly.
      Tier 2 (>64 KB warn)    – strip description.text (long instruction).
      Tier 3 (>100 KB)        – strip added_cities (should already be []).
      Tier 4 (>128 KB)        – raise; caller logs it and skips publish.
    """
    raw = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    size = len(raw)

    if size > _WARN_BYTES:
        logger.warning(
            "Broadcast payload for event %s is %d bytes (>50%% of IoT limit). "
            "Stripping description text.",
            eid, size,
        )
        event = payload.get("event") or {}
        if isinstance(event.get("description"), dict):
            payload = {
                **payload,
                "event": {**event, "description": {**event["description"], "text": ""}},
            }
        raw = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        size = len(raw)

    if size > 100_000:
        logger.warning(
            "Broadcast payload for event %s is %d bytes after description strip. "
            "Stripping added_cities list.",
            eid, size,
        )
        payload = {**payload, "added_cities": []}
        raw = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        size = len(raw)

    if size > _MQTT_MAX_BYTES:
        raise ValueError(
            f"Broadcast payload for event {eid} is {size:,} bytes after all "
            f"stripping tiers — exceeds IoT hard limit of {_MQTT_MAX_BYTES:,} bytes. "
            "Skipping publish."
        )

    return raw


def publish_alert(payload: Dict[str, Any], topic: Optional[str] = None) -> None:
    """Publish a single JSON payload to the broadcast topic (QoS 1)."""
    if not _IOT_ENABLED:
        logger.info("IOT_ENABLED=false - skipping publish of alert %s", _event_id(payload))
        return

    eid = _event_id(payload)
    target_topic = topic or _DEFAULT_TOPIC
    client = _get_data_client()
    slim = _slim_for_broadcast(payload)
    encoded = _size_guarded(slim, eid)
    client.publish(
        topic=target_topic,
        qos=1,
        payload=encoded,
    )
    logger.info(
        "Published alert %s to topic '%s' (%d bytes)",
        eid, target_topic, len(encoded),
    )
