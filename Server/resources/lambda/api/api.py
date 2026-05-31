"""Red Alerts API Lambda handler.

Thin entrypoint: FastAPI app wrapped with Mangum so it runs behind API Gateway.
Third-party deps (fastapi, mangum, pymysql, requests, pydantic) come from the
manual ``common-layer``; shared business code comes from ``backend-code-layer``
(``codebase.*``).
"""

import logging
import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from mangum import Mangum

from routes.alerts import router as alerts_router
from routes.health import router as health_router

logging.basicConfig(level=logging.INFO)


def _geo_admin_enabled() -> bool:
    """The local-only geo correction tool is mounted only when explicitly enabled.

    Set by ``make serve`` (local dev) via ``GEO_ADMIN_ENABLED``; the Lambda
    runtime never sets it, so the admin routes simply don't exist in the cloud.
    """
    return os.environ.get("GEO_ADMIN_ENABLED", "").strip().lower() in {"1", "true", "yes"}

app = FastAPI(
    title="Red Alerts API",
    description="Read API for Red Alerts (health + recent alerts).",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health_router)
app.include_router(alerts_router)

if _geo_admin_enabled():
    from routes.admin_geo import router as admin_geo_router

    app.include_router(admin_geo_router)
    logging.getLogger(__name__).info("Geo admin routes ENABLED (local correction tool).")

# API Gateway (HTTP API) entrypoint.
handler = Mangum(app)
