"""SQLAlchemy engine + session management for Red Alerts.

The connection string is read from a single ``DATABASE_URL`` environment
variable, e.g. ``mysql://user:password@host:3306/red_alerts``. That URL contains
the password, so it is a SECRET: it lives only in the environment (a GitHub
Environment Secret in CI, a local ``.env.<env>`` file for local runs) and is
never committed to git.

The ``Engine`` is created ONCE at module scope (i.e. OUTSIDE the request handler)
and cached, so on a warm Lambda container - and for the whole life of the ECS
worker process - the same connection pool is reused across every invocation. We
never open a new connection per request, so we don't exhaust the database. The
pool is configured with ``pool_pre_ping`` (revive dropped links) and
``pool_recycle`` (rotate connections before MySQL's ``wait_timeout``).
"""

import logging
import os
from contextlib import contextmanager
from typing import Iterator, Optional

from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker

logger = logging.getLogger(__name__)

_DB_URL_ENV = "DATABASE_URL"

# Keep the pool small: one warm Lambda container handles one request at a time,
# and the worker is single-threaded, so a single reused connection is plenty.
_POOL_SIZE = 1
_MAX_OVERFLOW = 2
# Recycle a connection before MySQL's default wait_timeout (often 300s) drops it.
_POOL_RECYCLE_SECONDS = 280

# Cached at module scope -> created once per process / warm container, reused
# by every later call (this is the "connection lives outside the handler" part).
_engine: Optional[Engine] = None
_SessionLocal: Optional[sessionmaker] = None


def _normalize_url(url: str) -> str:
    """Make the URL explicit about the PyMySQL driver for SQLAlchemy.

    Our env stores ``mysql://...`` (driver-agnostic); SQLAlchemy needs to know
    which DBAPI to use, so we upgrade it to ``mysql+pymysql://...``. Any URL that
    already names a driver (``mysql+pymysql://``, ``mysql+mysqldb://``, ...) is
    left untouched.
    """
    if url.startswith("mysql://"):
        return "mysql+pymysql://" + url[len("mysql://") :]
    return url


def get_engine() -> Engine:
    """Return the shared SQLAlchemy engine, creating it on first use."""
    global _engine, _SessionLocal
    if _engine is not None:
        return _engine

    url = os.environ.get(_DB_URL_ENV)
    if not url:
        raise RuntimeError(f"{_DB_URL_ENV} environment variable is not set")

    _engine = create_engine(
        _normalize_url(url),
        pool_pre_ping=True,
        pool_recycle=_POOL_RECYCLE_SECONDS,
        pool_size=_POOL_SIZE,
        max_overflow=_MAX_OVERFLOW,
        future=True,
        # utf8mb4 so Hebrew alert text round-trips correctly.
        connect_args={"charset": "utf8mb4", "connect_timeout": 10},
    )
    _SessionLocal = sessionmaker(
        bind=_engine, autoflush=False, expire_on_commit=False, future=True
    )
    return _engine


def _get_session_factory() -> sessionmaker:
    """Return the cached session factory (building the engine if needed)."""
    if _SessionLocal is None:
        get_engine()
    assert _SessionLocal is not None  # set as a side effect of get_engine()
    return _SessionLocal


@contextmanager
def session_scope() -> Iterator[Session]:
    """Provide a transactional session: commit on success, rollback on error.

    Usage:
        with session_scope() as session:
            Event.ingest(session, raw)
    """
    session = _get_session_factory()()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def ping() -> bool:
    """Return True if the database is reachable (reuses the shared pool)."""
    with get_engine().connect() as connection:
        connection.execute(text("SELECT 1"))
    return True
