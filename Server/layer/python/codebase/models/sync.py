"""Schema sync for Red Alerts - the Sequelize ``sync({ alter: true })`` equivalent.

``sync_database()`` compares the SQLAlchemy models (``Base.metadata``) against the
LIVE database and applies whatever is needed to make the database match: create
missing tables, add missing columns, add/drop indexes and constraints, fix
nullability. There are NO migration files and NO ``alembic_version`` table to
keep in sync - you just edit a model and run ``make sync`` (or
``app/sync_db.py``). It is triggered MANUALLY; the worker never syncs on boot.

How it works: we reuse Alembic's *autogenerate* engine (``produce_migrations``)
purely in-memory to compute the diff between the models and the reflected DB,
then execute the resulting operations against the connection with ``Operations``.
This is exactly what ``alembic revision --autogenerate`` would have written to a
file - we just run it immediately instead of saving it.

Safety: by default we DO NOT drop tables or columns (``allow_drops=False``), so a
model you delete or rename never silently destroys data - the drop is logged and
skipped. Pass ``allow_drops=True`` for the full destructive ``alter`` behaviour.
Requires the DB user to have DDL privileges (CREATE / ALTER / INDEX) on the schema.
"""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING, List, Optional

from sqlalchemy.exc import InternalError, OperationalError, ProgrammingError

from codebase.database.engine import get_engine

if TYPE_CHECKING:
    from sqlalchemy.engine import Engine

logger = logging.getLogger(__name__)

# Operation classes that DROP data. Skipped unless allow_drops=True so an
# accidental model change can never wipe a table/column on a sync.
_DESTRUCTIVE_OPS = {"DropTableOp", "DropColumnOp"}

# MySQL error codes meaning "the desired end-state already exists / is already
# gone" - i.e. the operation is a no-op we can safely skip. This makes sync
# IDEMPOTENT: re-running converges, and a partially-applied run can be re-run to
# finish. (It also absorbs Alembic's quirk where adding an ``index=True`` column
# both adds the column AND emits a separate, now-duplicate, create-index.)
_ALREADY_DONE_ERRNOS = {
    1050,  # table already exists
    1060,  # duplicate column name
    1061,  # duplicate key/index name
    1022,  # can't write; duplicate key
    1826,  # duplicate foreign key constraint name
    1091,  # can't DROP ...; it doesn't exist (idempotent drops)
}


def _mysql_errno(exc: BaseException) -> Optional[int]:
    """Pull the numeric MySQL error code out of a wrapped DBAPI exception."""
    orig = getattr(exc, "orig", None)
    args = getattr(orig, "args", None)
    if args and isinstance(args[0], int):
        return args[0]
    return None


def _iter_leaf_ops(container):
    """Flatten Alembic's nested op tree into individual ops, in execution order.

    ``produce_migrations`` returns an ``UpgradeOps`` tree: top-level entries are
    things like ``CreateTableOp``/``CreateIndexOp`` plus ``ModifyTableOps`` groups
    that themselves hold per-column ops. Containers expose ``.ops``; leaves don't.
    """
    for op in container.ops:
        if hasattr(op, "ops"):
            yield from _iter_leaf_ops(op)
        else:
            yield op


def sync_database(
    engine: "Optional[Engine]" = None, *, allow_drops: bool = False
) -> List[str]:
    """Make the live DB schema match the models. Returns the ops applied.

    The returned list contains a short description per applied operation (empty
    when the schema was already up to date). Set ``allow_drops=True`` to also
    apply destructive drops (off by default - see module docstring).
    """
    # Importing the package registers every table on Base.metadata so the diff
    # sees the full schema (events, cities, event_oref_ids, ...).
    import codebase.models  # noqa: F401
    from alembic.autogenerate import produce_migrations
    from alembic.migration import MigrationContext
    from alembic.operations import Operations

    from codebase.models.base import Base

    engine = engine or get_engine()
    applied: List[str] = []
    skipped_drops: List[str] = []
    already_present: List[str] = []

    logger.info("sync: comparing models to the live database...")
    with engine.connect() as connection:
        context = MigrationContext.configure(
            connection,
            opts={
                "target_metadata": Base.metadata,
                # Compare column TYPES too (catches e.g. String(64) -> String(128)).
                "compare_type": True,
                # We never set server-side defaults in the models, so ignore them
                # to avoid noisy/false-positive ALTERs.
                "compare_server_default": False,
            },
        )
        migrations = produce_migrations(context, Base.metadata)
        operations = Operations(context)

        # Apply each op in its own transaction so one failure/skip never poisons
        # the rest (MySQL auto-commits DDL anyway, but this keeps every dialect
        # clean and lets us catch + skip already-applied changes).
        for op in _iter_leaf_ops(migrations.upgrade_ops):
            name = type(op).__name__
            if not allow_drops and name in _DESTRUCTIVE_OPS:
                skipped_drops.append(name)
                logger.warning(
                    "sync: SKIPPING destructive %s (run with allow_drops=True to "
                    "apply drops)",
                    name,
                )
                continue
            logger.info("sync: applying %s", name)
            try:
                operations.invoke(op)
                connection.commit()
                applied.append(name)
            except (OperationalError, ProgrammingError, InternalError) as exc:
                connection.rollback()
                errno = _mysql_errno(exc)
                if errno in _ALREADY_DONE_ERRNOS:
                    already_present.append(name)
                    logger.info(
                        "sync: %s already applied (errno %s) - skipping",
                        name,
                        errno,
                    )
                    continue
                raise

    if applied:
        logger.info(
            "sync: applied %d change(s): %s", len(applied), ", ".join(applied)
        )
    else:
        logger.info("sync: schema already up to date - nothing to do.")
    if already_present:
        logger.info(
            "sync: %d op(s) were already present and skipped", len(already_present)
        )
    if skipped_drops:
        logger.warning(
            "sync: skipped %d destructive op(s): %s",
            len(skipped_drops),
            ", ".join(skipped_drops),
        )
    return applied
