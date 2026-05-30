"""Red Alerts ORM models + the ``sync_database`` migration runner.

Importing this package registers every table on ``Base.metadata`` and exposes the
Active-Record-style model classes used by both the API Lambda and the ECS worker.
``sync_database`` makes the live DB match the models (Sequelize ``sync({alter:true})``
style - diff + apply, no migration files).
"""

from codebase.models.base import Base
from codebase.models.category import Category
from codebase.models.city import City
from codebase.models.description import Description
from codebase.models.event import Event, EventOrefId, IngestResult, event_cities
from codebase.models.title import Title
from codebase.models.sync import sync_database

__all__ = [
    "Base",
    "Category",
    "City",
    "Description",
    "Event",
    "EventOrefId",
    "IngestResult",
    "Title",
    "event_cities",
    "sync_database",
]
