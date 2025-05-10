#!/usr/bin/env python3
"""
Red Alerts Monolithic Backend
FastAPI application with worker for periodic API polling
"""

import logging
from contextlib import asynccontextmanager
from datetime import datetime
from typing import Dict

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Import route modules
from routes.health import router as health_router

# Import worker module
import worker

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    FastAPI lifespan event handler for startup and shutdown
    """
    # Startup
    logger.info("Starting Red Alerts Backend...")
    worker.start_worker()
    
    yield  # Application runs here
    
    # Shutdown  
    logger.info("Shutting down Red Alerts Backend...")
    worker.stop_worker()


# FastAPI app instance with lifespan
app = FastAPI(
    title="Red Alerts Backend",
    description="Red Alerts Backend - Polls Israeli alert API every 5 seconds",
    version="2.0.0",
    lifespan=lifespan
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(health_router)


# Simple hello world endpoint
@app.get("/", response_model=Dict[str, str])
async def hello_world():
    """Hello World endpoint"""
    return {
        "message": "Hello World from Red Alerts Backend!",
        "service": "Red Alerts Backend",
        "version": "2.0.0",
        "timestamp": datetime.utcnow().isoformat() + "Z"
    }


# Lifespan events now handled by the @asynccontextmanager above


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)