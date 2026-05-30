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


def publish_alert(payload: Dict[str, Any], topic: Optional[str] = None) -> None:
    """Publish a single JSON payload to the broadcast topic (QoS 1)."""
    if not _IOT_ENABLED:
        logger.info("IOT_ENABLED=false - skipping publish of alert %s", payload.get("oref_id") or payload.get("id"))
        return

    target_topic = topic or _DEFAULT_TOPIC
    client = _get_data_client()
    client.publish(
        topic=target_topic,
        qos=1,
        payload=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
    )
    logger.info("Published alert %s to topic '%s'", payload.get("id"), target_topic)
