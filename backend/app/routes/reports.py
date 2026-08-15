# backend/app/routes/reports.py
import datetime
from typing import List, Optional
from enum import Enum
from fastapi import APIRouter, HTTPException, Query

from backend.app.database import get_db_connection
from backend.app.models.schemas import (
    ReportCreate,
    ReportUpdate,
    ReportResponse,
    PriorityEnum,
    StatusEnum
)

router = APIRouter(prefix="/reports", tags=["Reports"])

@router.post("/", response_model=ReportResponse, status_code=201)
def create_report(report: ReportCreate):
    # Determine priority defensively
    priority = "Medium"
    if report.priority:
        priority = report.priority.value
    else:
        # Check for teammate's services
        try:
            from backend.app.services import ai_service
            if ai_service and hasattr(ai_service, "get_report_priority"):
                priority_val = ai_service.get_report_priority(report.title, report.description)
                if priority_val in ["High", "Medium", "Low"]:
                    priority = priority_val
        except Exception:
            try:
                from backend.app.services import fallback
                if fallback and hasattr(fallback, "get_fallback_priority"):
                    priority_val = fallback.get_fallback_priority(report.title, report.description)
                    if priority_val in ["High", "Medium", "Low"]:
                        priority = priority_val
            except Exception:
                pass

    created_at = datetime.datetime.now(datetime.timezone.utc).isoformat()
    status = "Reported"

    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO reports (
                title, description, category, latitude, longitude, image_url, status, ai_priority, admin_notes, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            report.title,
            report.description,
            report.category,
            report.latitude,
            report.longitude,
            report.image_url,
            status,
            priority,
            None,
            created_at
        ))
        conn.commit()
        report_id = cursor.lastrowid

        cursor.execute("SELECT * FROM reports WHERE id = ?", (report_id,))
        row = cursor.fetchone()

    return dict(row)

@router.get("/", response_model=List[ReportResponse])
def get_reports(
    status: Optional[StatusEnum] = Query(None, description="Filter by status"),
    priority: Optional[PriorityEnum] = Query(None, description="Filter by priority (maps to ai_priority)"),
    category: Optional[str] = Query(None, description="Filter by category")
):
    query = "SELECT * FROM reports"
    params = []
    conditions = []

    if status is not None:
        conditions.append("status = ?")
        params.append(status.value)
    if priority is not None:
        conditions.append("ai_priority = ?")
        params.append(priority.value)
    if category is not None:
        conditions.append("category = ?")
        params.append(category)

    if conditions:
        query += " WHERE " + " AND ".join(conditions)

    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(query, params)
        rows = cursor.fetchall()

    return [dict(row) for row in rows]

@router.patch("/{report_id}/", response_model=ReportResponse)
def update_report(report_id: int, report_update: ReportUpdate):
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM reports WHERE id = ?", (report_id,))
        row = cursor.fetchone()

    if not row:
        raise HTTPException(status_code=404, detail=f"Report with ID {report_id} not found")

    update_data = report_update.model_dump(exclude_unset=True)
    if not update_data:
        return dict(row)

    fields = []
    params = []
    for key, val in update_data.items():
        if key in ["status", "admin_notes"]:
            fields.append(f"{key} = ?")
            if isinstance(val, Enum):
                params.append(val.value)
            else:
                params.append(val)

    if fields:
        params.append(report_id)
        with get_db_connection() as conn:
            conn.execute(f"UPDATE reports SET {', '.join(fields)} WHERE id = ?", params)
            conn.commit()

            cursor = conn.cursor()
            cursor.execute("SELECT * FROM reports WHERE id = ?", (report_id,))
            row = cursor.fetchone()

    return dict(row)
