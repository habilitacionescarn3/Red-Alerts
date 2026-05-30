"""Category attribute use-cases: get-or-create + listing.

Thin orchestration over the ``Category`` Active-Record model.
"""

from typing import Any, Dict, List, Optional

from codebase.database.engine import session_scope
from codebase.models.category import Category


def get_or_create_category(code: str, label: Optional[str] = None) -> Dict[str, Any]:
    """Return the category for this code, inserting it once if new."""
    with session_scope() as session:
        return Category.get_or_create(session, code, label=label).to_dict()


def list_categories(limit: int = 500) -> List[Dict[str, Any]]:
    """Return all known categories."""
    with session_scope() as session:
        return [c.to_dict() for c in Category.list_all(session, limit=limit)]
