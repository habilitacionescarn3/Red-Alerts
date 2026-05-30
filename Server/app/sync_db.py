#!/usr/bin/env python3
"""CLI entrypoint for the schema sync (used by `make sync`).

Runs ``sync_database()``: diffs the models against the live DB and applies the
changes in place (create tables, add columns/indexes, ...) - the Sequelize
``sync({alter:true})`` equivalent, with NO migration files. Triggered MANUALLY
(the worker never syncs on boot). Requires the DB user to have DDL privileges
(CREATE / ALTER / INDEX) on the target schema. Drops are skipped by default; see
``sync_database(allow_drops=True)`` for the destructive variant.
"""

import logging

from codebase.models import sync_database

if __name__ == "__main__":
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    )
    sync_database()
