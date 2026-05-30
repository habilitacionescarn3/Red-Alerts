"""City attribute use-cases: get-or-create + listing.

Thin orchestration over the ``City`` Active-Record model. ``get_or_create_city``
inserts the city only if its name is new, otherwise returns the existing row -
the "if new, add it; then reference it" behavior, in one place.
"""

from typing import Any, Dict, List

from codebase.database.engine import session_scope
from codebase.models.city import City


def get_or_create_city(name: str) -> Dict[str, Any]:
    """Return the city for this name, inserting it once if new."""
    with session_scope() as session:
        return City.get_or_create(session, name).to_dict()


def list_cities(limit: int = 500) -> List[Dict[str, Any]]:
    """Return all known cities."""
    with session_scope() as session:
        return [city.to_dict() for city in City.list_all(session, limit=limit)]
