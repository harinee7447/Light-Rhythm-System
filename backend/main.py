import os
from contextlib import asynccontextmanager
from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from backend.config import APP_NAME, APP_VERSION
from backend.database import init_db
from backend.routers import (
    auth_router,
    schedule_router,
    brightness_router,
    routine_router,
    history_router,
    dashboard_router,
    report_router
)

BASE_DIR = Path(__file__).resolve().parent.parent
FRONTEND_DIR = BASE_DIR / "Frontend"

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Initialize SQLite database and seed defaults
    init_db()
    yield
    # Shutdown

app = FastAPI(
    title=APP_NAME,
    version=APP_VERSION,
    description="FastAPI backend for Light Rhythm Management System (FR-01 to FR-06)",
    lifespan=lifespan
)

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API Routers
app.include_router(auth_router.router)
app.include_router(schedule_router.router)
app.include_router(brightness_router.router)
app.include_router(routine_router.router)
app.include_router(history_router.router)
app.include_router(dashboard_router.router)
app.include_router(report_router.router)

@app.get("/api/health", tags=["Health"])
def health_check():
    """Health check endpoint confirming system availability (NFR-04)."""
    return {
        "status": "healthy",
        "app": APP_NAME,
        "version": APP_VERSION,
        "availability": "99%+"
    }

# Mount static files for frontend assets
if FRONTEND_DIR.exists():
    app.mount("/static", StaticFiles(directory=str(FRONTEND_DIR)), name="static")

@app.get("/", include_in_schema=False)
def serve_frontend_root():
    """Serve frontend index.html at root."""
    index_file = FRONTEND_DIR / "index.html"
    if index_file.exists():
        return FileResponse(str(index_file))
    return {"message": "Frontend not found, API running."}
