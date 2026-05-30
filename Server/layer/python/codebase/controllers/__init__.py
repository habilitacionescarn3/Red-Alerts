"""Controllers: orchestration over the ORM models, shared by API + worker.

- ``events_controller`` - the Event use-cases (ingest + read queries).
- ``*_controller`` (cities/categories/titles/descriptions) - the per-attribute
  get-or-create + listing use-cases (the lookup tables behind an event).
"""

from codebase.controllers.categories_controller import (
    get_or_create_category,
    list_categories,
)
from codebase.controllers.cities_controller import (
    get_or_create_city,
    list_cities,
)
from codebase.controllers.descriptions_controller import (
    get_or_create_description,
    list_descriptions,
)
from codebase.controllers.events_controller import (
    ingest_alert,
    list_by_category,
    list_by_city,
    list_last_24h,
    list_recent,
)
from codebase.controllers.titles_controller import (
    get_or_create_title,
    list_titles,
)

__all__ = [
    # events
    "ingest_alert",
    "list_by_category",
    "list_by_city",
    "list_last_24h",
    "list_recent",
    # attributes
    "get_or_create_category",
    "list_categories",
    "get_or_create_city",
    "list_cities",
    "get_or_create_description",
    "list_descriptions",
    "get_or_create_title",
    "list_titles",
]
