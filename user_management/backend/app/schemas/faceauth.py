from __future__ import annotations

from typing import List, Optional
import uuid
from pydantic import BaseModel, Field
class LogRequest(BaseModel):
    person_external_id: str
    person_name: Optional[str] = None
    result: str = Field(..., pattern="^(success|failed|liveness_failed|unknown)$")
    similarity_score: Optional[float] = None
    liveness_score: Optional[float] = None
    reason: Optional[str] = None
    auth_type: str = Field("single", pattern="^(single|mass)$")
    # Supplied only when this FRECO result completes a pending RFID 2-SV scan.
    access_verification_id: Optional[uuid.UUID] = None


class LogEntry(BaseModel):
    id: str
    person_external_id: str
    person_name: Optional[str] = None
    photo_reference: Optional[str] = None
    result: str
    similarity_score: Optional[float] = None
    liveness_score: Optional[float] = None
    reason: Optional[str] = None
    auth_type: str
    ip_address: Optional[str] = None
    created_at: str


class FaceAuthListResult(BaseModel):
    logs: List[LogEntry]
    total: int
    page: int
    limit: int
    total_pages: int
