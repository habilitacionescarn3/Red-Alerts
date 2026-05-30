"""City lookup table: maps a city name (from the Oref ``data[]``) to our UUID."""

from __future__ import annotations

from typing import TYPE_CHECKING, Any, Dict, List

from sqlalchemy import String
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Mapped, mapped_column, relationship

from codebase.models.base import Base, TimestampMixin, UUIDMixin

if TYPE_CHECKING:
    from sqlalchemy.orm import Session

    from codebase.models.event import Event


class City(UUIDMixin, TimestampMixin, Base):
    """A single protected-area city, stored once and referenced by UUID."""

    __tablename__ = "cities"

    name: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        unique=True,
        index=True,
        doc="City name as delivered by Oref (natural key, unique).",
    )

    events: Mapped[List["Event"]] = relationship(
        secondary="event_cities",
        back_populates="cities",
        viewonly=True,
    )

    @classmethod
    def get_or_create(cls, session: "Session", name: str) -> "City":
        """Return the existing city with this name, or insert it once.

        Idempotent under the unique ``name`` constraint: if a concurrent writer
        inserted it between our SELECT and INSERT, we recover and re-fetch.
        """
        name = (name or "").strip()
        existing = session.query(cls).filter_by(name=name).one_or_none()
        if existing is not None:
            return existing

        city = cls(name=name)
        session.add(city)
        try:
            session.flush()
        except IntegrityError:
            session.rollback()
            return session.query(cls).filter_by(name=name).one()
        return city

    @classmethod
    def list_all(cls, session: "Session", limit: int = 500) -> List["City"]:
        """Return cities alphabetically (newest-created first on ties)."""
        limit = max(1, min(int(limit), 5000))
        return session.query(cls).order_by(cls.name.asc()).limit(limit).all()

    def to_dict(self) -> Dict[str, Any]:
        """JSON-friendly representation."""
        return {
            "id": self.id,
            "name": self.name,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
