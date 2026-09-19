from __future__ import annotations

import datetime
from typing import List, Optional
import uuid
from pydantic import BaseModel, Field

# ── Locations ───────────────────────────────────────────────────────────────

class Location(BaseModel):
    id: uuid.UUID
    name: str
    type: str
    parent_id: Optional[uuid.UUID] = None
    created_at: Optional[datetime.datetime] = None

class CreateLocationRequest(BaseModel):
    name: str
    type: str
    parent_id: Optional[uuid.UUID] = None

# ── Access Rules ────────────────────────────────────────────────────────────

class AccessRule(BaseModel):
    id: uuid.UUID
    name: str
    description: Optional[str] = None
    subject_type: str
    subject_id: str
    location_id: Optional[uuid.UUID] = None
    schedule_days: List[int] = Field(default_factory=lambda: [1,2,3,4,5,6,7])
    schedule_start_time: Optional[datetime.time] = None
    schedule_end_time: Optional[datetime.time] = None
    valid_from: Optional[datetime.date] = None
    valid_to: Optional[datetime.date] = None
    effect: str = "ALLOW"
    priority: int = 0
    is_active: bool = True
    created_at: Optional[datetime.datetime] = None
    updated_at: Optional[datetime.datetime] = None

class CreateAccessRuleRequest(BaseModel):
    name: str
    description: Optional[str] = None
    subject_type: str
    subject_id: str
    location_id: Optional[uuid.UUID] = None
    schedule_days: List[int] = Field(default_factory=lambda: [1,2,3,4,5,6,7])
    schedule_start_time: Optional[datetime.time] = None
    schedule_end_time: Optional[datetime.time] = None
    valid_from: Optional[datetime.date] = None
    valid_to: Optional[datetime.date] = None
    effect: str = "ALLOW"
    priority: int = 0

class UpdateAccessRuleRequest(BaseModel):
    is_active: bool

# ── Temporary Access Grants ──────────────────────────────────────────────────

class TemporaryAccessGrant(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    location_id: uuid.UUID
    valid_from: datetime.datetime
    valid_to: datetime.datetime
    granted_by: Optional[uuid.UUID] = None
    reason: Optional[str] = None
    created_at: Optional[datetime.datetime] = None

class CreateTemporaryAccessRequest(BaseModel):
    user_id: uuid.UUID
    location_id: uuid.UUID
    valid_from: datetime.datetime
    valid_to: datetime.datetime
    reason: Optional[str] = None

# ── Access Events ───────────────────────────────────────────────────────────

class AccessEvent(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    location_id: uuid.UUID
    action: str
    status: str
    reason: Optional[str] = None
    event_time: Optional[datetime.datetime] = None
    
    # Optional fields for UI
    user_name: Optional[str] = None
    user_identifier: Optional[str] = None
    location_name: Optional[str] = None

class EvaluateAccessRequest(BaseModel):
    user_id: uuid.UUID
    location_id: uuid.UUID
    action: str = "ENTRY"
