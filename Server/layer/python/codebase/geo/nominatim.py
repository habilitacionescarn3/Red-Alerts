"""Free OSM Nominatim geocoding for Hebrew locality names.

Resolves a city name to a flat list of ``[lng, lat]`` points:
  * a single point  -> the locality's centre (used as a map marker), or
  * an outer polygon ring -> the locality's area (used as a map fill).

Nominatim's public instance enforces a strict usage policy (max ~1 request per
second, a descriptive ``User-Agent`` required), which is why the caller drains a
queue at ~1/sec rather than calling this inline. This module is transport-only;
it never touches the database.
"""

from __future__ import annotations

import logging
import os
import re
from typing import Any, Dict, List, Optional

import requests

logger = logging.getLogger(__name__)

Point = List[float]
PointList = List[Point]

_NOMINATIM_URL = os.environ.get(
    "NOMINATIM_URL", "https://nominatim.openstreetmap.org/search"
)
# Nominatim's policy REQUIRES a descriptive User-Agent identifying the app.
_USER_AGENT = os.environ.get(
    "NOMINATIM_USER_AGENT",
    "RedAlerts/1.0 (https://github.com/Shalev396/red-Alerts)",
)
_REQUEST_TIMEOUT_SECONDS = int(os.environ.get("NOMINATIM_TIMEOUT_SECONDS", "15"))

# Cap how many points we keep for a polygon ring so a huge boundary doesn't bloat
# the row / payload. 0 disables the cap.
_MAX_RING_POINTS = int(os.environ.get("NOMINATIM_MAX_RING_POINTS", "120"))

_NIQQUD_RE = re.compile(r"[\u0591-\u05C7]")
_QUOTES_RE = re.compile(r"['\"\u05f3\u05f4`]")
_DASH_RE = re.compile(r"[\u05be\u2013\u2014]")
_WS_RE = re.compile(r"\s+")


class NominatimError(RuntimeError):
    """Transient failure talking to Nominatim (network/HTTP).

    Raised so the caller can leave the city unresolved (``coordinates`` NULL) and
    retry it later, rather than recording a definitive "no result".
    """


def clean_name(name: str) -> str:
    """Normalise an Oref area label down to a plain locality name for searching.

    Mirrors the frontend cleaner (``Client/src/lib/geo/index.ts``): strip niqqud
    and gershayim/quotes, unify dash variants, drop the Oref sub-area suffix
    after `` - `` (e.g. ``"תל אביב - מרכז העיר"`` -> ``"תל אביב"``), and collapse
    whitespace.
    """
    value = (name or "").strip()
    value = _NIQQUD_RE.sub("", value)
    value = _QUOTES_RE.sub("", value)
    value = _DASH_RE.sub("-", value)
    if " - " in value:
        value = value.split(" - ")[0]
    value = value.replace("-", " ")
    value = _WS_RE.sub(" ", value).strip()
    return value


def _ring_from_polygon(polygon: List[Any]) -> PointList:
    """Outer ring (first ring) of a GeoJSON Polygon coordinate array."""
    if not polygon:
        return []
    outer = polygon[0] or []
    return [[float(pt[0]), float(pt[1])] for pt in outer if len(pt) >= 2]


def _largest_ring(multipolygon: List[Any]) -> PointList:
    """Outer ring of the polygon with the most points in a MultiPolygon."""
    best: PointList = []
    for polygon in multipolygon or []:
        ring = _ring_from_polygon(polygon)
        if len(ring) > len(best):
            best = ring
    return best


def _simplify(ring: PointList) -> PointList:
    """Down-sample a ring to at most ``_MAX_RING_POINTS`` points (evenly)."""
    if _MAX_RING_POINTS <= 0 or len(ring) <= _MAX_RING_POINTS:
        return ring
    step = len(ring) / _MAX_RING_POINTS
    sampled = [ring[int(i * step)] for i in range(_MAX_RING_POINTS)]
    # Keep the ring closed if the source was.
    if ring and sampled and ring[0] == ring[-1] and sampled[-1] != ring[0]:
        sampled.append(ring[0])
    return sampled


def _points_from_result(result: Dict[str, Any]) -> PointList:
    """Flatten one Nominatim result to a list of ``[lng, lat]`` points."""
    geojson = result.get("geojson") or {}
    geo_type = geojson.get("type")
    coords = geojson.get("coordinates")

    if geo_type == "Polygon" and isinstance(coords, list):
        return _simplify(_ring_from_polygon(coords))
    if geo_type == "MultiPolygon" and isinstance(coords, list):
        return _simplify(_largest_ring(coords))
    if geo_type == "Point" and isinstance(coords, list) and len(coords) >= 2:
        return [[float(coords[0]), float(coords[1])]]

    # No usable geometry; fall back to the result's lat/lon centre as a point.
    lat, lon = result.get("lat"), result.get("lon")
    if lat is not None and lon is not None:
        return [[float(lon), float(lat)]]
    return []


def geocode_city(name: str) -> PointList:
    """Resolve a Hebrew city name to a list of ``[lng, lat]`` points.

    Returns the points (one for a marker, many for an area), or an empty list
    when Nominatim has no match for the name. Raises :class:`NominatimError` on a
    transient network/HTTP failure so the caller can retry later.
    """
    query = clean_name(name)
    if not query:
        return []

    params = {
        "q": query,
        "format": "jsonv2",
        "accept-language": "he",
        "countrycodes": "il",
        "polygon_geojson": 1,
        "limit": 1,
    }
    try:
        response = requests.get(
            _NOMINATIM_URL,
            params=params,
            headers={"User-Agent": _USER_AGENT},
            timeout=_REQUEST_TIMEOUT_SECONDS,
        )
        response.raise_for_status()
        results: Optional[List[Dict[str, Any]]] = response.json()
    except (requests.RequestException, ValueError) as exc:
        raise NominatimError(f"Nominatim lookup failed for '{query}': {exc}") from exc

    if not results:
        logger.info("Nominatim found no match for '%s'", query)
        return []

    points = _points_from_result(results[0])
    logger.info("Nominatim resolved '%s' to %d point(s)", query, len(points))
    return points
