"""Title attribute use-cases: get-or-create + listing.

Thin orchestration over the ``Title`` Active-Record model.
"""

from typing import Any, Dict, List

from codebase.database.engine import session_scope
from codebase.models.title import Title


def get_or_create_title(text: str) -> Dict[str, Any]:
    """Return the title for this text, inserting it once if new."""
    with session_scope() as session:
        return Title.get_or_create(session, text).to_dict()


def list_titles(limit: int = 500) -> List[Dict[str, Any]]:
    """Return all known titles."""
    with session_scope() as session:
        return [title.to_dict() for title in Title.list_all(session, limit=limit)]
