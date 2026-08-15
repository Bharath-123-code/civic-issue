# backend/app/main.py
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

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

@app.get("/")
def read_root():
    return {
        "message": "Welcome to CivicFix API",
        "docs_url": "/docs",
        "status": "Running"
    }
