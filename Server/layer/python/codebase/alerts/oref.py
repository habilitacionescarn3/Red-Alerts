"""Fetch and normalize alerts from the Oref live endpoint.

The endpoint returns an (almost) empty body when there is no active alert, and a
JSON object shaped like ``example.md`` when there is:

    {"id": "...", "cat": "1", "title": "...", "data": ["area", ...], "desc": "..."}
"""

import json
import logging
from datetime import datetime, timezone
from typing import Any, Dict, Optional

import requests

logger = logging.getLogger(__name__)

# Oref sends JSON without a charset, sometimes with a User-Agent gate, so be
# explicit about who we are and that we accept JSON.
_REQUEST_HEADERS = {
    "Accept": "application/json, text/plain, */*",
    "Referer": "https://www.oref.org.il/",
}


def fetch_alert(url: str, timeout: int = 30) -> Optional[Dict[str, Any]]:
    """Fetch the current alert.

    Returns the raw alert dict, or ``None`` when there is no active alert or the
    request fails.

    Oref's quirks we must handle here:
      * When IDLE the body is a UTF-8 BOM + CRLF (bytes ``EF BB BF 0D 0A``) - it
        is NOT empty, so a naive length check lets it through and JSON parsing
        then fails on every poll.
      * When ALERTING the JSON itself is ALSO prefixed with that BOM, which
        ``response.json()`` chokes on (``\\ufeff{...}`` is not valid JSON).
    Decoding the raw bytes as ``utf-8-sig`` strips the BOM in both cases; we then
    treat a blank remainder as "no active alert" (the normal idle state).
    """
    try:
        response = requests.get(url, headers=_REQUEST_HEADERS, timeout=timeout)
    except requests.RequestException as exc:
        logger.error("Oref request failed: %s", exc)
        return None

    if response.status_code != 200:
        logger.warning("Oref returned status %s", response.status_code)
        return None

    # Decode the raw bytes ourselves with utf-8-sig so the BOM is stripped, then
    # drop surrounding whitespace/CRLF.
    body = response.content.decode("utf-8-sig", errors="replace").strip()
    if not body:
        # Normal idle response (was just a BOM + newline) - no active alert.
        return None

    try:
        return json.loads(body)
    except ValueError:
        logger.warning("Oref response was not valid JSON: %r", body[:200])
        return None


def normalize_alert(raw: Dict[str, Any]) -> Dict[str, Any]:
    """Convert a raw Oref payload into our internal, storable shape."""
    return {
        "id": str(raw.get("id")),
        "category": raw.get("cat"),
        "title": raw.get("title"),
        "description": raw.get("desc"),
        "areas": raw.get("data", []),
        "received_at": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S"),
    }
