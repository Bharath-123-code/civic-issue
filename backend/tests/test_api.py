# backend/tests/test_api.py
import os
import pytest
from pathlib import Path
from fastapi.testclient import TestClient

# Override database path for testing before importing app components
from backend.app.config import settings
TEST_DB_PATH = "backend/data/test_civic_issue.db"
settings.DATABASE_PATH = TEST_DB_PATH

# Delete test db if it already exists from a previous run
if Path(TEST_DB_PATH).exists():
    try:
        os.remove(TEST_DB_PATH)
    except Exception:
        pass

from backend.app.main import app
from backend.app.database import init_db

# Initialize clean test database
init_db()

client = TestClient(app)

def test_create_report():
    payload = {
        "title": "Water leakage in sector 4",
        "description": "Main water supply pipeline is leaking, wasting water.",
        "category": "Water supply",
        "latitude": 28.6139,
        "longitude": 77.2090,
        "image_url": "https://example.com/leakage.jpg"
    }
    response = client.post("/api/reports/", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["title"] == payload["title"]
    assert data["status"] == "Reported"
    assert data["ai_priority"] == "Medium"  # Default fallback
    assert data["id"] is not None

def test_create_report_invalid_coords():
    payload = {
        "title": "Water leakage",
        "description": "Leaking pipe",
        "category": "Water",
        "latitude": 120.0,  # Invalid latitude (> 90)
        "longitude": 77.2090
    }
    response = client.post("/api/reports/", json=payload)
    assert response.status_code == 422  # Pydantic validation error

def test_get_reports_and_filters():
    # Insert distinct reports for query filter tests
    client.post("/api/reports/", json={
        "title": "Pothole on Main Road",
        "description": "Dangerous pothole",
        "category": "Roads",
        "latitude": 28.1234,
        "longitude": 77.5678,
        "priority": "High"
    })
    client.post("/api/reports/", json={
        "title": "Graffiti on Park Wall",
        "description": "Vandalism in public park",
        "category": "Vandalism",
        "latitude": 28.5678,
        "longitude": 77.1234,
        "priority": "Low"
    })

    # Fetch all
    response = client.get("/api/reports/")
    assert response.status_code == 200
    all_reports = response.json()
    assert len(all_reports) >= 3

    # Filter by category
    response = client.get("/api/reports/?category=Roads")
    assert response.status_code == 200
    roads = response.json()
    assert len(roads) == 1
    assert roads[0]["title"] == "Pothole on Main Road"

    # Filter by priority
    response = client.get("/api/reports/?priority=Low")
    assert response.status_code == 200
    low_priority = response.json()
    assert len(low_priority) == 1
    assert low_priority[0]["category"] == "Vandalism"

def test_patch_report():
    # Fetch first report to get its ID
    response = client.get("/api/reports/")
    reports = response.json()
    report_id = reports[0]["id"]

    # Apply partial update
    update_payload = {
        "status": "In Review",
        "admin_notes": "Assigned team has been dispatched."
    }
    response = client.patch(f"/api/reports/{report_id}/", json=update_payload)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "In Review"
    assert data["admin_notes"] == "Assigned team has been dispatched."
    assert data["title"] == reports[0]["title"]  # Checks other fields remain unchanged

def test_patch_report_invalid_status():
    response = client.patch("/api/reports/1/", json={"status": "Completed"})
    assert response.status_code == 422  # Enum constraint validation failure

def test_patch_report_not_found():
    response = client.patch("/api/reports/99999/", json={"status": "Resolved"})
    assert response.status_code == 404

def test_teardown():
    # Delete test database file to clean up
    if Path(TEST_DB_PATH).exists():
        try:
            os.remove(TEST_DB_PATH)
        except Exception:
            pass
