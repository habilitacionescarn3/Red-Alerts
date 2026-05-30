"""Declarative base + shared mixins for every Red Alerts model.

Design rules (best practices we hold across all tables):
  * Every table's PRIMARY KEY is OUR OWN UUID (``CHAR(36)``) - we never use a
    value we received from the Oref API as a primary key.
  * Every table carries a ``created_at`` audit timestamp.
"""

import uuid
from datetime import datetime, timezone

from sqlalchemy import CHAR, DateTime
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


def _utcnow() -> datetime:
    """Timezone-aware UTC now (stored as naive UTC in MySQL DATETIME)."""
    return datetime.now(timezone.utc)


def _new_uuid() -> str:
    """Generate a fresh primary-key UUID (string form, e.g. for CHAR(36))."""
    return str(uuid.uuid4())


class Base(DeclarativeBase):
    """Shared declarative base; ``Base.metadata`` drives Alembic autogenerate."""


class UUIDMixin:
    """Adds an application-generated UUID primary key (never the API's id)."""

    id: Mapped[str] = mapped_column(
        CHAR(36),
        primary_key=True,
        default=_new_uuid,
        doc="Application-generated UUID primary key.",
    )


class TimestampMixin:
    """Adds a ``created_at`` audit column set at insert time."""

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        default=_utcnow,
        doc="Row creation time (UTC).",
    )
