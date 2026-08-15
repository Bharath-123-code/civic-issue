# backend/app/main.py
import os
from pathlib import Path
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from backend.app.database import init_db
from backend.app.routes.reports import router as reports_router

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize SQLite database and tables
    init_db()
    yield

app = FastAPI(
    title="CivicFix API",
    description="Backend engine for reporting and managing civic issues.",
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routes under /api
app.include_router(reports_router, prefix="/api")

# Mount frontend directories if they exist
admin_dir = Path("frontend/admin")
if admin_dir.exists():
    app.mount("/admin", StaticFiles(directory=str(admin_dir), html=True), name="admin")

resident_dir = Path("frontend/resident")
if resident_dir.exists():
    app.mount("/resident", StaticFiles(directory=str(resident_dir), html=True), name="resident")

frontend_dir = Path("frontend")
if frontend_dir.exists():
    app.mount("/frontend", StaticFiles(directory=str(frontend_dir), html=True), name="frontend")

@app.get("/")
def read_root():
    return {
        "message": "Welcome to CivicFix API",
        "admin_dashboard": "/admin/",
        "docs_url": "/docs",
        "status": "Running"
    }

