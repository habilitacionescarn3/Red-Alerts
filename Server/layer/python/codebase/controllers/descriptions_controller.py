"""Description attribute use-cases: get-or-create + listing.

Thin orchestration over the ``Description`` Active-Record model.
"""

from typing import Any, Dict, List

from codebase.database.engine import session_scope
from codebase.models.description import Description


def get_or_create_description(text: str) -> Dict[str, Any]:
    """Return the description for this text, inserting it once if new."""
    with session_scope() as session:
        return Description.get_or_create(session, text).to_dict()


def list_descriptions(limit: int = 500) -> List[Dict[str, Any]]:
    """Return all known descriptions."""
    with session_scope() as session:
        return [d.to_dict() for d in Description.list_all(session, limit=limit)]
