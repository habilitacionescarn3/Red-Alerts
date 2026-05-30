"""Health check route."""

import logging
from datetime import datetime, timezone

from fastapi import APIRouter
from pydantic import BaseModel

from codebase.database import ping

logger = logging.getLogger(__name__)

router = APIRouter()


class HealthResponse(BaseModel):
    status: str
    service: str
    database: str
    timestamp: str


@router.get("/api/health", response_model=HealthResponse)
async def health_check() -> HealthResponse:
    """Liveness check including MySQL connectivity."""
    try:
        database_status = "connected" if ping() else "unreachable"
    except Exception as exc:  # noqa: BLE001 - report any DB error as degraded
        logger.warning("Database health check failed: %s", exc)
        database_status = "error"

    return HealthResponse(
        status="healthy",
        service="Red Alerts API",
        database=database_status,
        timestamp=datetime.now(timezone.utc).isoformat(),
    )
