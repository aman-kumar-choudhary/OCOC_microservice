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

class AccessGroup(BaseModel):
    id: uuid.UUID
    name: str
    description: Optional[str] = None

class CreateAccessGroupRequest(BaseModel):
    name: str
    description: Optional[str] = None

class AddAccessGroupMemberRequest(BaseModel):
    user_id: uuid.UUID

# ── Access Rules ────────────────────────────────────────────────────────────

class AccessRule(BaseModel):
    id: uuid.UUID
    name: str
    description: Optional[str] = None
    subject_type: str
    subject_id: str
    location_id: Optional[uuid.UUID] = None
    device_id: Optional[uuid.UUID] = None
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
    device_id: Optional[uuid.UUID] = None
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
    user_id: Optional[uuid.UUID] = None
    location_id: Optional[uuid.UUID] = None
    action: str
    status: str
    reason: Optional[str] = None
    event_time: Optional[datetime.datetime] = None
    
    # Optional fields for UI
    user_name: Optional[str] = None
    user_identifier: Optional[str] = None
    location_name: Optional[str] = None
    rfid_uid: Optional[str] = None
    reader_id: Optional[uuid.UUID] = None
    device_id: Optional[uuid.UUID] = None
    face_confidence: Optional[float] = None
    verification_id: Optional[uuid.UUID] = None

class EvaluateAccessRequest(BaseModel):
    user_id: uuid.UUID
    location_id: uuid.UUID
    action: str = "ENTRY"
    reader_id: Optional[uuid.UUID] = None
    device_id: Optional[uuid.UUID] = None
    face_confidence: Optional[float] = None

class RFIDAccessScanRequest(BaseModel):
    uid: str
    location_id: Optional[uuid.UUID] = None
    action: str = "ENTRY"
    reader_id: Optional[uuid.UUID] = None
    device_id: Optional[uuid.UUID] = None
    face_confidence: Optional[float] = None

class FaceVerificationRequest(BaseModel):
    verification_id: uuid.UUID
    user_id: uuid.UUID
    matched: bool
    face_confidence: Optional[float] = None
    reason: Optional[str] = None


class UpdateUserAccessRequest(BaseModel):
    roles: List[str] = Field(default_factory=list)
    hostel_ids: List[uuid.UUID] = Field(default_factory=list)
    location_ids: Optional[List[uuid.UUID]] = None
    issue_password: Optional[bool] = False
    custom_password: Optional[str] = None


class BulkLocationGrantsRequest(BaseModel):
    location_ids: List[uuid.UUID] = Field(default_factory=list)
    access_level: str = "ENTRY"
    reason: Optional[str] = "Assigned via Access Management"


class ResetCredentialsRequest(BaseModel):
    custom_password: Optional[str] = None


# ── Enhanced Access Management Schemas ──────────────────────────────────────

# -- User search & filtering --

class AccessUserSummary(BaseModel):
    """Minimal user info returned in the access-user search list."""
    id: uuid.UUID
    email: str
    full_name: Optional[str] = None
    user_type: str
    status: str
    phone: Optional[str] = None
    roll_number: Optional[str] = None
    employee_id: Optional[str] = None
    department: Optional[str] = None
    school: Optional[str] = None
    course: Optional[str] = None
    semester: Optional[str] = None
    hostel_name: Optional[str] = None
    photo_reference: Optional[str] = None
    roles: List[str] = Field(default_factory=list)
    locations: List[str] = Field(default_factory=list)
    role_count: int = 0
    grant_count: int = 0
    keycloak_linked: bool = False


class AccessUserSearchResult(BaseModel):
    """Paginated result for access-user search."""
    users: List[AccessUserSummary]
    total: int
    page: int
    page_size: int
    total_pages: int


# -- User access detail --

class UserLocationAccessGrant(BaseModel):
    """A single location-access grant row."""
    id: uuid.UUID
    location_id: uuid.UUID
    location_name: Optional[str] = None
    location_type: Optional[str] = None
    access_level: str
    valid_from: Optional[datetime.datetime] = None
    valid_until: Optional[datetime.datetime] = None
    status: str
    granted_by: Optional[uuid.UUID] = None
    granted_by_name: Optional[str] = None
    revoked_at: Optional[datetime.datetime] = None
    revoked_by: Optional[uuid.UUID] = None
    reason: Optional[str] = None
    created_at: Optional[datetime.datetime] = None
    updated_at: Optional[datetime.datetime] = None


class UserAccessDetail(BaseModel):
    """Full user record with roles, Keycloak info, and location grants."""
    # Identity
    id: uuid.UUID
    email: str
    phone: Optional[str] = None
    user_type: str
    status: str
    full_name: Optional[str] = None
    roll_number: Optional[str] = None
    employee_id: Optional[str] = None
    department: Optional[str] = None
    department_id: Optional[uuid.UUID] = None
    school: Optional[str] = None
    course: Optional[str] = None
    semester: Optional[str] = None
    designation: Optional[str] = None
    hostel_name: Optional[str] = None
    hostel_id: Optional[uuid.UUID] = None
    photo_reference: Optional[str] = None

    # Keycloak
    keycloak_user_id: Optional[str] = None
    keycloak_linked: bool = False

    # Roles
    roles: List[str] = Field(default_factory=list)

    # Location grants
    location_grants: List[UserLocationAccessGrant] = Field(default_factory=list)

    # Temporary grants (existing system)
    temporary_grants: List[TemporaryAccessGrant] = Field(default_factory=list)

    created_at: Optional[datetime.datetime] = None
    updated_at: Optional[datetime.datetime] = None


# -- Location tree --

class LocationTreeNode(BaseModel):
    """Recursive location tree node."""
    id: uuid.UUID
    name: str
    type: str
    description: Optional[str] = None
    parent_id: Optional[uuid.UUID] = None
    status: Optional[str] = "active"
    children: List["LocationTreeNode"] = Field(default_factory=list)


# -- Location grants CRUD --

class CreateLocationGrantRequest(BaseModel):
    user_id: uuid.UUID
    location_id: uuid.UUID
    access_level: str = "ENTRY"
    valid_from: Optional[datetime.datetime] = None
    valid_until: Optional[datetime.datetime] = None
    reason: Optional[str] = None


class UpdateLocationGrantRequest(BaseModel):
    access_level: Optional[str] = None
    valid_until: Optional[datetime.datetime] = None
    status: Optional[str] = None
    reason: Optional[str] = None


# -- Effective permissions --

class EffectivePermission(BaseModel):
    """Computed permission including inheritance info."""
    location_id: uuid.UUID
    location_name: str
    location_type: str
    access_level: str
    source: str  # "explicit" or "inherited"
    inherited_from: Optional[uuid.UUID] = None
    inherited_from_name: Optional[str] = None


# -- Access audit log --

class AccessAuditLogEntry(BaseModel):
    id: uuid.UUID
    actor_id: Optional[str] = None
    actor_email: Optional[str] = None
    operation: str
    entity_type: str
    entity_id: str
    before_state: Optional[dict] = None
    after_state: Optional[dict] = None
    created_at: Optional[datetime.datetime] = None


class AccessAuditLogResult(BaseModel):
    logs: List[AccessAuditLogEntry]
    total: int
    page: int
    page_size: int
    total_pages: int


# ── Guard Operations & Visitor Desk Schemas ───────────────────────────────────

class GuardManualMovementRequest(BaseModel):
    student_id: uuid.UUID
    action: str = Field(..., pattern="^(ENTRY|EXIT|IN|OUT)$")
    gate_name: Optional[str] = "Main Campus Gate"
    reason: Optional[str] = None


class GuardVisitorRegisterRequest(BaseModel):
    full_name: str = Field(min_length=2, max_length=150)
    phone: str = Field(min_length=5, max_length=20)
    email: Optional[str] = None
    visit_purpose: str = Field(default="Campus Visit", max_length=300)
    host_person: str = Field(default="Campus Administration", max_length=150)
    host_contact: Optional[str] = None
    gov_id_type: Optional[str] = "Aadhaar Card"
    gov_id_number: Optional[str] = None
    pass_type: str = Field(default="TEMPORARY_DAY", pattern="^(TEMPORARY_DAY|SPECIAL_FUNCTION)$")
    valid_from: Optional[datetime.datetime] = None
    valid_until: Optional[datetime.datetime] = None
    assigned_card_uid: Optional[str] = None
    event_name: Optional[str] = None
    notes: Optional[str] = None
    accompanying_count: Optional[int] = Field(default=0, ge=0, le=100)
    accompanying_details: Optional[str] = Field(default=None, max_length=1000)


class AssignGuardDutyRequest(BaseModel):
    guard_id: uuid.UUID
    post_location: str
    shift: str
    duty_status: Optional[str] = "ON_DUTY"
    instructions: Optional[str] = None


class SecurityCommandRequest(BaseModel):
    command: str = Field(description="Command type: LOCKDOWN, CURFEW, VISITOR_CUTOFF, TWO_FACTOR, EMERGENCY_ALARM")
    action: Optional[str] = "TOGGLE"
    enabled: Optional[bool] = None
    reason: Optional[str] = None


