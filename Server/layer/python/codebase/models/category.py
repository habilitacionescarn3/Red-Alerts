"""Category lookup table: maps the Oref ``cat`` code to our UUID."""

from __future__ import annotations

from typing import TYPE_CHECKING, Any, Dict, List, Optional

from sqlalchemy import String
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Mapped, mapped_column, relationship

from codebase.models.base import Base, TimestampMixin, UUIDMixin

if TYPE_CHECKING:
    from sqlalchemy.orm import Session

    from codebase.models.event import Event


class Category(UUIDMixin, TimestampMixin, Base):
    """An alert category (Oref ``cat``), stored once and referenced by UUID."""

    __tablename__ = "categories"

    code: Mapped[str] = mapped_column(
        String(32),
        nullable=False,
        unique=True,
        index=True,
        doc="Oref category code, e.g. '1' (rockets), '10' (all-clear). Natural key.",
    )
    label: Mapped[Optional[str]] = mapped_column(
        String(255),
        nullable=True,
        doc="Optional human-readable label for the category.",
    )

    events: Mapped[List["Event"]] = relationship(back_populates="category")

    @classmethod
    def get_or_create(
        cls, session: "Session", code: str, label: Optional[str] = None
    ) -> "Category":
        """Return the existing category with this code, or insert it once."""
        code = (code or "").strip()
        existing = session.query(cls).filter_by(code=code).one_or_none()
        if existing is not None:
            return existing

        category = cls(code=code, label=label)
        session.add(category)
        try:
            session.flush()
        except IntegrityError:
            session.rollback()
            return session.query(cls).filter_by(code=code).one()
        return category

    @classmethod
    def list_all(cls, session: "Session", limit: int = 500) -> List["Category"]:
        """Return all categories ordered by code."""
        limit = max(1, min(int(limit), 5000))
        return session.query(cls).order_by(cls.code.asc()).limit(limit).all()

    def to_dict(self) -> Dict[str, Any]:
        """JSON-friendly representation."""
        return {
            "id": self.id,
            "code": self.code,
            "label": self.label,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
