"""Local-only geocoding correction tool routes.

NOT mounted in the cloud: ``api.py`` only includes this router when the
``GEO_ADMIN_ENABLED`` env var is truthy, which is set solely by the local
``make serve`` run (Lambda never sets it). It lets an operator look up a city,
search Nominatim for the right place when the automatic top-hit was wrong, and
overwrite that city's stored coordinates.
"""

from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from codebase.controllers import list_cities, set_city_coordinates
from codebase.geo import NominatimError, geocode_search

router = APIRouter(prefix="/api/admin/geo", tags=["admin-geo"])

Point = List[float]


class SaveCoordinatesRequest(BaseModel):
    """Body for overwriting a city's points ([[lng, lat], ...]; [] clears it)."""

    points: List[Point]


@router.get("/cities")
async def admin_list_cities(
    q: Optional[str] = Query(None, description="Filter to cities whose name contains this."),
    limit: int = Query(1000, ge=1, le=5000),
) -> List[Dict[str, Any]]:
    """Cities (id, name, coordinates) for the correction-tool picker."""
    return list_cities(limit=limit, name_contains=q)


@router.get("/search")
async def admin_search_locations(
    q: str = Query(..., min_length=1, description="Free-text place query (sent as-is)."),
    limit: int = Query(10, ge=1, le=25),
) -> List[Dict[str, Any]]:
    """Return multiple Nominatim candidates so the operator can pick the right one."""
    try:
        return geocode_search(q, limit=limit)
    except NominatimError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@router.put("/cities/{city_id}/coordinates")
async def admin_save_coordinates(
    city_id: str,
    body: SaveCoordinatesRequest,
) -> Dict[str, Any]:
    """Overwrite a city's stored points with the chosen candidate's points."""
    updated = set_city_coordinates(city_id, body.points)
    if updated is None:
        raise HTTPException(status_code=404, detail=f"No city with id '{city_id}'.")
    return updated
