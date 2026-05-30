"""Red Alerts API Lambda handler.

Thin entrypoint: FastAPI app wrapped with Mangum so it runs behind API Gateway.
Third-party deps (fastapi, mangum, pymysql, requests, pydantic) come from the
manual ``common-layer``; shared business code comes from ``backend-code-layer``
(``codebase.*``).
"""

import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from mangum import Mangum

from routes.alerts import router as alerts_router
from routes.health import router as health_router

logging.basicConfig(level=logging.INFO)

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

# API Gateway (HTTP API) entrypoint.
handler = Mangum(app)
