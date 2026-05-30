"""Description lookup table: maps an alert description to our UUID.

Descriptions can be long, so the column is ``TEXT`` and the UNIQUE key is a
sha-256 ``content_hash`` of the text (MySQL can't index a full TEXT column).
"""

from __future__ import annotations

import hashlib
from typing import TYPE_CHECKING, Any, Dict, List

from sqlalchemy import CHAR, Text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Mapped, mapped_column, relationship

from codebase.models.base import Base, TimestampMixin, UUIDMixin

if TYPE_CHECKING:
    from sqlalchemy.orm import Session

    from codebase.models.event import Event


def _hash(text: str) -> str:
    """Stable sha-256 hex digest used as the unique natural key."""
    return hashlib.sha256((text or "").encode("utf-8")).hexdigest()


class Description(UUIDMixin, TimestampMixin, Base):
    """An alert description, stored once and referenced by UUID."""

    __tablename__ = "descriptions"

    text: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        doc="Description text as delivered by Oref.",
    )
    content_hash: Mapped[str] = mapped_column(
        CHAR(64),
        nullable=False,
        unique=True,
        index=True,
        doc="sha-256 of text - the unique natural key (avoids long-text index).",
    )

    events: Mapped[List["Event"]] = relationship(back_populates="description")

    @classmethod
    def get_or_create(cls, session: "Session", text: str) -> "Description":
        """Return the existing description with this text, or insert it once."""
        text = (text or "").strip()
        digest = _hash(text)
        existing = session.query(cls).filter_by(content_hash=digest).one_or_none()
        if existing is not None:
            return existing

        description = cls(text=text, content_hash=digest)
        session.add(description)
        try:
            session.flush()
        except IntegrityError:
            session.rollback()
            return session.query(cls).filter_by(content_hash=digest).one()
        return description

    @classmethod
    def list_all(cls, session: "Session", limit: int = 500) -> List["Description"]:
        """Return all descriptions, newest-created first."""
        limit = max(1, min(int(limit), 5000))
        return session.query(cls).order_by(cls.created_at.desc()).limit(limit).all()

    def to_dict(self) -> Dict[str, Any]:
        """JSON-friendly representation."""
        return {
            "id": self.id,
            "text": self.text,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
