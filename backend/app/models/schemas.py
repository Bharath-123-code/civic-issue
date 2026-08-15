# backend/app/models/schemas.py
from enum import Enum
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field


class StatusEnum(str, Enum):
    REPORTED = "Reported"
    IN_REVIEW = "In Review"
    RESOLVED = "Resolved"


class PriorityEnum(str, Enum):
    HIGH = "High"
    MEDIUM = "Medium"
    LOW = "Low"


class ReportCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    description: str = Field(..., min_length=1)
    category: str = Field(..., min_length=1)
    latitude: float = Field(..., ge=-90.0, le=90.0)
    longitude: float = Field(..., ge=-180.0, le=180.0)
    image_url: Optional[str] = None
    priority: Optional[PriorityEnum] = None


class ReportUpdate(BaseModel):
    status: Optional[StatusEnum] = None
    admin_notes: Optional[str] = None


class ReportResponse(BaseModel):
    id: int
    title: str
    description: str
    category: str
    latitude: float
    longitude: float
    image_url: Optional[str] = None
    status: StatusEnum
    ai_priority: PriorityEnum
    admin_notes: Optional[str] = None
    created_at: str

    model_config = ConfigDict(
        from_attributes=True,
        json_schema_extra={
            "example": {
                "id": 1,
                "title": "Broken street light",
                "description": "Street light is not working.",
                "category": "Electricity",
                "latitude": 16.1234,
                "longitude": 81.5678,
                "image_url": "https://example.com/image.jpg",
                "status": "Reported",
                "ai_priority": "High",
                "admin_notes": None,
                "created_at": "2026-08-15T09:30:00",
            }
        },
    )


# ============================================================
# Member 4 - GenAI Output Schemas
# ============================================================

CivicCategory = Literal[
    "Pothole",
    "Garbage",
    "Lighting",
    "Drainage",
    "Water Leakage",
    "Road Damage",
    "Traffic/Signage",
    "Other",
]

IssuePriority = Literal["High", "Medium", "Low"]


class AIEvaluationResult(BaseModel):
    """Structured AI output schema for civic issue classification."""

    category: CivicCategory = Field(
        ...,
        description="The classified category of the civic issue.",
    )

    priority: IssuePriority = Field(
        ...,
        description="Assessed urgency/severity level: High, Medium, or Low.",
    )

    department: str = Field(
        ...,
        description="The municipal department responsible for resolving the issue.",
    )


class AdminActionDraft(BaseModel):
    """Schema for AI-generated administrative work-order/action summary."""

    suggested_action: str = Field(
        ...,
        description="Concise actionable administrative work-order draft.",
    )