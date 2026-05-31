"""City lookup table: maps a city name (from the Oref ``data[]``) to our UUID."""

from __future__ import annotations

from typing import TYPE_CHECKING, Any, Dict, List, Optional

from sqlalchemy import JSON, String
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Mapped, mapped_column, relationship

from codebase.models.base import Base, TimestampMixin, UUIDMixin

# A point is an [lng, lat] pair (GeoJSON order); a city's coordinates are a flat
# list of such points.
Point = List[float]
PointList = List[Point]

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

    coordinates: Mapped[Optional[PointList]] = mapped_column(
        JSON,
        nullable=True,
        default=None,
        doc="Geocoded points as a flat [[lng, lat], ...] array. The column "
        "doubles as the geocoding queue state: NULL = never looked up (queued); "
        "[] = looked up, nothing found (won't retry); a single point = map "
        "marker; many points = polygon ring (map area).",
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

    @classmethod
    def next_unresolved(
        cls, session: "Session", limit: int = 1
    ) -> List["City"]:
        """Return the oldest cities still awaiting geocoding (``coordinates IS NULL``).

        ``coordinates IS NULL`` is the implicit queue: a city is enqueued simply
        by being inserted (its coordinates default to NULL) and leaves the queue
        once any value - points or ``[]`` - is stored. Ordered by creation so the
        queue is roughly FIFO.
        """
        limit = max(1, min(int(limit), 5000))
        return (
            session.query(cls)
            .filter(cls.coordinates.is_(None))
            .order_by(cls.created_at.asc())
            .limit(limit)
            .all()
        )

    def apply_coordinates(self, points: PointList) -> None:
        """Store the geocoding result (the points array, or ``[]`` if none found).

        Storing any non-NULL value removes the city from the unresolved queue, so
        callers must only call this once they have a definitive answer; transient
        lookup failures should leave ``coordinates`` NULL so the city is retried.
        """
        self.coordinates = list(points or [])

    def to_dict(self) -> Dict[str, Any]:
        """JSON-friendly representation."""
        return {
            "id": self.id,
            "name": self.name,
            "coordinates": self.coordinates,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
