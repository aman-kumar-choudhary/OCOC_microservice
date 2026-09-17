from __future__ import annotations

from typing import List, Optional
from pydantic import BaseModel, Field


class Card(BaseModel):
    id: str
    uid: str
    status: str
    user_id: Optional[str] = None
    user_name: Optional[str] = None
    user_email: Optional[str] = None
    user_type: Optional[str] = None
    department: Optional[str] = None
    issued_at: Optional[str] = None
    revoked_at: Optional[str] = None
    revoked_reason: Optional[str] = None
    created_at: str
    updated_at: str


class AssignRequest(BaseModel):
    user_id: str
    uid: str


class ReplaceRequest(BaseModel):
    user_id: str
    new_uid: str
    reason: str = Field("lost", pattern="^(lost|stolen|damaged|upgraded)$")


class ValidateRequest(BaseModel):
    uid: str


class ScanResult(BaseModel):
    uid: str
    status: str = "success"


class RFIDListResult(BaseModel):
    cards: List[Card]
    total: int
    page: int
    limit: int
    total_pages: int
