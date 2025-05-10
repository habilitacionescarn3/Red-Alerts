#!/usr/bin/env python3
"""
Health Check Route Module
"""

import os
from datetime import datetime

from fastapi import APIRouter
from pydantic import BaseModel


class HealthResponse(BaseModel):
    status: str
    message: str
    timestamp: str
    service: str
    secret: str


# Create router
router = APIRouter()


@router.get("/api/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint with secret from environment"""
    return HealthResponse(
        status="healthy",
        message="Red Alerts Backend is running",
        timestamp=datetime.utcnow().isoformat() + "Z",
        service="Red Alerts Backend",
        secret=os.getenv("SECRET", "secret-not-set")
    )