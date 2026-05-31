"""City attribute use-cases: get-or-create + listing.

Thin orchestration over the ``City`` Active-Record model. ``get_or_create_city``
inserts the city only if its name is new, otherwise returns the existing row -
the "if new, add it; then reference it" behavior, in one place.
"""

from typing import Any, Dict, List, Optional

from codebase.database.engine import session_scope
from codebase.models.city import City, PointList


def get_or_create_city(name: str) -> Dict[str, Any]:
    """Return the city for this name, inserting it once if new."""
    with session_scope() as session:
        return City.get_or_create(session, name).to_dict()


def list_cities(limit: int = 500, name_contains: Optional[str] = None) -> List[Dict[str, Any]]:
    """Return known cities, optionally filtered to names containing a substring."""
    with session_scope() as session:
        query = session.query(City)
        name_contains = (name_contains or "").strip()
        if name_contains:
            query = query.filter(City.name.contains(name_contains))
        limit = max(1, min(int(limit), 5000))
        cities = query.order_by(City.name.asc()).limit(limit).all()
        return [city.to_dict() for city in cities]


def set_city_coordinates(city_id: str, points: PointList) -> Optional[Dict[str, Any]]:
    """Overwrite a city's geocoded points (used by the local correction tool).

    Returns the updated city dict, or ``None`` if no city has that id. ``points``
    is the [[lng, lat], ...] shape stored on ``City.coordinates`` (one point ->
    marker, many -> polygon area, ``[]`` -> "no geometry").
    """
    with session_scope() as session:
        city = session.get(City, city_id)
        if city is None:
            return None
        city.apply_coordinates(points)
        session.flush()
        return city.to_dict()
