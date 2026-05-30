"""Title lookup table: maps an alert title to our UUID.

Titles are short but can still exceed a comfortable index length, so the UNIQUE
key is a sha-256 ``content_hash`` of the text rather than the text column itself
(MySQL index-length best practice).
"""

from __future__ import annotations

import hashlib
from typing import TYPE_CHECKING, Any, Dict, List

from sqlalchemy import CHAR, String
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Mapped, mapped_column, relationship

from codebase.models.base import Base, TimestampMixin, UUIDMixin

if TYPE_CHECKING:
    from sqlalchemy.orm import Session

    from codebase.models.event import Event


def _hash(text: str) -> str:
    """Stable sha-256 hex digest used as the unique natural key."""
    return hashlib.sha256((text or "").encode("utf-8")).hexdigest()


class Title(UUIDMixin, TimestampMixin, Base):
    """An alert title, stored once and referenced by UUID."""

    __tablename__ = "titles"

    text: Mapped[str] = mapped_column(
        String(512),
        nullable=False,
        doc="Title text as delivered by Oref.",
    )
    content_hash: Mapped[str] = mapped_column(
        CHAR(64),
        nullable=False,
        unique=True,
        index=True,
        doc="sha-256 of text - the unique natural key (avoids long-text index).",
    )

    events: Mapped[List["Event"]] = relationship(back_populates="title")

    @classmethod
    def get_or_create(cls, session: "Session", text: str) -> "Title":
        """Return the existing title with this text, or insert it once."""
        text = (text or "").strip()
        digest = _hash(text)
        existing = session.query(cls).filter_by(content_hash=digest).one_or_none()
        if existing is not None:
            return existing

        title = cls(text=text, content_hash=digest)
        session.add(title)
        try:
            session.flush()
        except IntegrityError:
            session.rollback()
            return session.query(cls).filter_by(content_hash=digest).one()
        return title

    @classmethod
    def list_all(cls, session: "Session", limit: int = 500) -> List["Title"]:
        """Return all titles, newest-created first."""
        limit = max(1, min(int(limit), 5000))
        return session.query(cls).order_by(cls.created_at.desc()).limit(limit).all()

    def to_dict(self) -> Dict[str, Any]:
        """JSON-friendly representation."""
        return {
            "id": self.id,
            "text": self.text,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
