"""Event table: one row per logical Oref alert episode, fully normalized.

An "event" is a real-world alert episode (e.g. a rocket barrage on the north).
Oref re-issues the SAME episode many times with a NEW ``id`` every couple of
seconds - adding/removing cities as it evolves - so the raw id is useless for
dedupe. We instead GROUP consecutive alerts of the same category that happen
close together in time into ONE event and accumulate their cities. The full
grouping rules (and their edge cases) live in ``Event.ingest``.

Every raw id we absorb is recorded in ``event_oref_ids`` so an id is processed
exactly once (idempotency) and we keep an audit trail of what fed each event. An
event references a category/title/description by UUID (each stored once in its
own lookup table) and links to many cities via ``event_cities``.
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import TYPE_CHECKING, Any, Dict, List, Optional

from sqlalchemy import (
    CHAR,
    Column,
    DateTime,
    ForeignKey,
    Index,
    String,
    Table,
)
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Mapped, mapped_column, relationship, selectinload

from codebase.models.base import Base, TimestampMixin, UUIDMixin, _utcnow
from codebase.models.category import Category
from codebase.models.city import City
from codebase.models.description import Description
from codebase.models.title import Title

if TYPE_CHECKING:
    from sqlalchemy.orm import Session

# Two alerts of the SAME category are considered the SAME ongoing event when the
# later one arrives within this many seconds of the event's most recent update
# (``last_seen_at``). A longer gap means the previous episode ended, so a new
# alert starts a NEW event - this time window is how we separate two distinct
# events that happen to share a category. Oref episodes typically last ~1 minute
# and refresh every few seconds, so the default comfortably groups one episode's
# updates while keeping episodes that are minutes apart separate. The window
# slides on every update, so a long-running episode stays "open" as long as
# updates keep arriving. Tune via the EVENT_MERGE_WINDOW_SECONDS env var.
_MERGE_WINDOW_SECONDS = int(os.environ.get("EVENT_MERGE_WINDOW_SECONDS", "120"))


@dataclass
class IngestResult:
    """Outcome of ingesting one raw Oref alert.

    ``status`` is one of:
      * ``"created"``   - a brand new event was opened.
      * ``"updated"``   - an existing open event gained one or more new cities.
      * ``"unchanged"`` - the alert belonged to an open event but added nothing
                          new (a refresh, or only removed cities, which we keep).
    """

    event: "Event"
    status: str
    added_cities: List[str] = field(default_factory=list)

# Many-to-many link between events and cities. Composite PK prevents duplicate
# links; the extra index on city_id makes "all events for city X" fast.
event_cities = Table(
    "event_cities",
    Base.metadata,
    Column(
        "event_id",
        CHAR(36),
        ForeignKey("events.id", ondelete="CASCADE"),
        primary_key=True,
    ),
    Column(
        "city_id",
        CHAR(36),
        ForeignKey("cities.id", ondelete="CASCADE"),
        primary_key=True,
    ),
    Index("ix_event_cities_city_id", "city_id"),
)


class Event(UUIDMixin, TimestampMixin, Base):
    """A distinct alert event, normalized across the lookup tables."""

    __tablename__ = "events"

    oref_id: Mapped[str] = mapped_column(
        String(64),
        nullable=False,
        unique=True,
        index=True,
        doc="Oref id of the alert that OPENED this event. Every id absorbed into "
        "the event (this one included) is also recorded in event_oref_ids.",
    )
    received_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        default=_utcnow,
        index=True,
        doc="When the event STARTED (first alert ingested, UTC). Indexed for "
        "time-ordered queries.",
    )
    last_seen_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        default=_utcnow,
        index=True,
        doc="Most recent time an alert belonging to this event was ingested "
        "(UTC). Drives the time-window grouping in ingest().",
    )

    category_id: Mapped[str] = mapped_column(
        CHAR(36), ForeignKey("categories.id"), nullable=False, index=True
    )
    title_id: Mapped[str] = mapped_column(
        CHAR(36), ForeignKey("titles.id"), nullable=False, index=True
    )
    description_id: Mapped[str] = mapped_column(
        CHAR(36), ForeignKey("descriptions.id"), nullable=False, index=True
    )

    category: Mapped["Category"] = relationship(back_populates="events")
    title: Mapped["Title"] = relationship(back_populates="events")
    description: Mapped["Description"] = relationship(back_populates="events")
    cities: Mapped[List["City"]] = relationship(
        secondary=event_cities, back_populates="events"
    )
    oref_ids: Mapped[List["EventOrefId"]] = relationship(
        back_populates="event", cascade="all, delete-orphan"
    )

    # --- write side ---------------------------------------------------------

    @classmethod
    def ingest(
        cls, session: "Session", raw: Dict[str, Any]
    ) -> Optional[IngestResult]:
        """Fold a raw Oref alert into the right event, applying the grouping rules.

        Oref hands us a NEW ``id`` every couple of seconds for the same evolving
        episode, so we never dedupe on the id alone. Instead we decide whether
        this alert continues an open event or starts a new one. The rules (and
        every edge case we care about):

        1. Same id seen again - every 1s poll re-sends the active alert(s). The
           id is recorded in ``event_oref_ids`` the first time, so a repeat is a
           no-op -> returns ``None``.
        2. No open event of this category - first alert of an episode. Open a
           new event -> ``status="created"``.
        3. Open event of this category exists and the alert lists a NEW city -
           the episode grew. Append the city (union), bump ``last_seen_at`` ->
           ``status="updated"``.
        4. Open event exists but the alert only repeats / drops cities - a city
           leaving is normal as an episode winds down; we KEEP every city we
           ever saw and never remove. Nothing new -> ``status="unchanged"``.
        5. Same category but the previous episode ended (its ``last_seen_at`` is
           older than the merge window) - treated as a brand new event (rule 2).
           The time gap is what separates two distinct same-category episodes.

        "Open" = the most recent event of this category whose ``last_seen_at`` is
        within ``_MERGE_WINDOW_SECONDS`` of now.

        Known trade-off: two genuinely distinct episodes of the SAME category
        that overlap within the window are merged into one (their cities are
        unioned). Oref's feed exposes no reliable signal to split those apart, so
        we lean on time, exactly as the lifecycle (start -> end -> new start)
        implies. Widen/narrow EVENT_MERGE_WINDOW_SECONDS to taste.

        Returns an :class:`IngestResult`, or ``None`` if the id was already
        absorbed or the payload had no usable id.
        """
        oref_id = str(raw.get("id") or "").strip()
        if not oref_id:
            return None

        # Rule 1: exact-id idempotency. If we've already absorbed this id, the
        # poll is just re-reporting a still-active alert - do nothing.
        if session.get(EventOrefId, oref_id) is not None:
            return None

        now = _utcnow()

        # Resolve the category and cities up front (each get_or_create may
        # autoflush); the open-event lookup needs the category id.
        category = Category.get_or_create(session, raw.get("cat") or "")
        cities = [
            City.get_or_create(session, str(name))
            for name in (raw.get("data") or [])
            if name and str(name).strip()
        ]

        open_event = cls._open_event_for_category(session, category.id, now)
        if open_event is not None:
            # Rules 3 & 4: continue the existing episode, accumulating cities.
            added = open_event._absorb(session, oref_id, cities, now)
            try:
                session.flush()
            except IntegrityError:
                session.rollback()
                return None
            status = "updated" if added else "unchanged"
            return IngestResult(event=open_event, status=status, added_cities=added)

        # Rules 2 & 5: open a brand new event.
        title = Title.get_or_create(session, raw.get("title") or "")
        description = Description.get_or_create(session, raw.get("desc") or "")
        event = cls(
            oref_id=oref_id,
            received_at=now,
            last_seen_at=now,
            category=category,
            title=title,
            description=description,
            cities=cities,
        )
        event.oref_ids.append(EventOrefId(oref_id=oref_id, seen_at=now))
        session.add(event)
        try:
            session.flush()
        except IntegrityError:
            # Lost a race - another worker opened this event concurrently.
            session.rollback()
            return None
        return IngestResult(
            event=event,
            status="created",
            added_cities=[c.name for c in cities],
        )

    @classmethod
    def _open_event_for_category(
        cls, session: "Session", category_id: str, now: datetime
    ) -> Optional["Event"]:
        """Most recent still-open event of a category, or ``None``.

        "Open" = updated within ``_MERGE_WINDOW_SECONDS`` of ``now``. Cities are
        eager-loaded so the caller can union into them without an extra query.
        """
        window_start = now - timedelta(seconds=_MERGE_WINDOW_SECONDS)
        query = cls._with_relations(session.query(cls)).filter(
            cls.category_id == category_id,
            cls.last_seen_at >= window_start,
        )
        return query.order_by(cls.last_seen_at.desc()).first()

    def _absorb(
        self,
        session: "Session",
        oref_id: str,
        cities: List["City"],
        now: datetime,
    ) -> List[str]:
        """Fold another alert into this event; return the names of cities added.

        Cities are unioned (never removed - rule 4). ``last_seen_at`` always
        slides forward so the event stays open while updates keep arriving, and
        the raw id is recorded for idempotency/audit.
        """
        existing_ids = {c.id for c in self.cities}
        added: List[str] = []
        for city in cities:
            if city.id not in existing_ids:
                self.cities.append(city)
                existing_ids.add(city.id)
                added.append(city.name)
        self.last_seen_at = now
        self.oref_ids.append(EventOrefId(oref_id=oref_id, seen_at=now))
        return added

    # --- read side ----------------------------------------------------------

    @classmethod
    def _with_relations(cls, query):
        """Eager-load relations to avoid N+1 when serializing."""
        return query.options(
            selectinload(cls.category),
            selectinload(cls.title),
            selectinload(cls.description),
            selectinload(cls.cities),
        )

    @classmethod
    def recent(cls, session: "Session", limit: int = 50) -> List["Event"]:
        """Return the most recent events, newest first."""
        limit = max(1, min(int(limit), 500))
        query = cls._with_relations(session.query(cls))
        return query.order_by(cls.received_at.desc()).limit(limit).all()

    @classmethod
    def by_city(
        cls, session: "Session", city: str, limit: int = 50
    ) -> List["Event"]:
        """Return recent events affecting a city (matched by name or UUID)."""
        limit = max(1, min(int(limit), 500))
        city = (city or "").strip()
        query = cls._with_relations(session.query(cls)).join(cls.cities)
        query = query.filter((City.name == city) | (City.id == city))
        return query.order_by(cls.received_at.desc()).limit(limit).all()

    @classmethod
    def by_category(
        cls, session: "Session", category: str, limit: int = 50
    ) -> List["Event"]:
        """Return recent events of a category (matched by code or UUID)."""
        limit = max(1, min(int(limit), 500))
        category = (category or "").strip()
        query = cls._with_relations(session.query(cls)).join(cls.category)
        query = query.filter((Category.code == category) | (Category.id == category))
        return query.order_by(cls.received_at.desc()).limit(limit).all()

    @classmethod
    def in_last_hours(
        cls, session: "Session", hours: int = 24, limit: int = 500
    ) -> List["Event"]:
        """Return events received within the last ``hours`` hours, newest first."""
        limit = max(1, min(int(limit), 500))
        cutoff = _utcnow() - timedelta(hours=max(1, int(hours)))
        query = cls._with_relations(session.query(cls)).filter(
            cls.received_at >= cutoff
        )
        return query.order_by(cls.received_at.desc()).limit(limit).all()

    # --- serialization ------------------------------------------------------

    def to_dict(self) -> Dict[str, Any]:
        """JSON-friendly representation with resolved lookups and ids."""
        return {
            "id": self.id,
            "oref_id": self.oref_id,
            "received_at": self.received_at.isoformat() if self.received_at else None,
            "last_seen_at": self.last_seen_at.isoformat()
            if self.last_seen_at
            else None,
            "category": {
                "id": self.category.id,
                "code": self.category.code,
                "label": self.category.label,
            }
            if self.category
            else None,
            "title": {"id": self.title.id, "text": self.title.text}
            if self.title
            else None,
            "description": {
                "id": self.description.id,
                "text": self.description.text,
            }
            if self.description
            else None,
            "cities": [{"id": c.id, "name": c.name} for c in self.cities],
        }


class EventOrefId(Base):
    """Every raw Oref id we've absorbed, mapped to the event it fed.

    The ``oref_id`` is the primary key, so inserting one twice is impossible -
    that is exactly how ``Event.ingest`` guarantees each poll is processed once
    (idempotency). It also gives a full audit trail of which raw alerts rolled
    up into each grouped event.
    """

    __tablename__ = "event_oref_ids"

    oref_id: Mapped[str] = mapped_column(
        String(64),
        primary_key=True,
        doc="Raw Oref alert id (globally unique across all events).",
    )
    event_id: Mapped[str] = mapped_column(
        CHAR(36),
        ForeignKey("events.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    seen_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        default=_utcnow,
        doc="When this raw id was absorbed (UTC).",
    )

    event: Mapped["Event"] = relationship(back_populates="oref_ids")
