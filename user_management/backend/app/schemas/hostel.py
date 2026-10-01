from __future__ import annotations
from typing import Optional, List, Any
import datetime
from uuid import UUID
from pydantic import BaseModel, Field
class HostelGate(BaseModel):
    id: UUID
    hostel_id: UUID
    name: str
    gate_type: str
    created_at: datetime.datetime


class GateRule(BaseModel):
    id: UUID
    hostel_id: UUID
    gate_id: Optional[UUID] = None
    opening_time: datetime.time
    closing_time: datetime.time
    is_active: bool
    created_at: datetime.datetime
    updated_at: datetime.datetime


class CreatePermissionRequest(BaseModel):
    student_id: UUID
    permission_type: str = Field(..., pattern="^(HOSTEL_EXIT|CAMPUS_EXIT|OVERNIGHT|EMERGENCY)$")
    start_time: datetime.datetime
    end_time: datetime.datetime
    reason: Optional[str] = None


class HostelPermission(BaseModel):
    id: UUID
    student_id: UUID
    granted_by: Optional[UUID] = None
    permission_type: str
    start_time: datetime.datetime
    end_time: datetime.datetime
    reason: Optional[str] = None
    status: str
    created_at: datetime.datetime
    updated_at: datetime.datetime
    
    # Optional joined fields for UI
    student_name: Optional[str] = None
    student_roll: Optional[str] = None
    granted_by_name: Optional[str] = None


class RFIDScanRequest(BaseModel):
    uid: str
    reader_id: str


class ScanResponse(BaseModel):
    success: bool
    status: str  # ALLOWED, DENIED
    reason: Optional[str] = None
    student_name: Optional[str] = None
    student_id: Optional[UUID] = None
    event_time: datetime.datetime
    message: str


class StudentHostelStatus(BaseModel):
    student_id: UUID
    current_status: str
    last_event_time: Optional[datetime.datetime] = None
    active_permission_id: Optional[UUID] = None
    
    # Joined fields for UI
    student_name: Optional[str] = None
    student_roll: Optional[str] = None
    hostel_name: Optional[str] = None
    last_movement_type: Optional[str] = None
    last_gate_name: Optional[str] = None
    active_permission_type: Optional[str] = None


class HostelDashboardStats(BaseModel):
    total_students: int
    inside: int
    outside: int
    on_leave: int
    attendance_marked: int
    attendance_missing: int
    unauthorized_outside: int
    late_returns: int
    active_permissions: int


class MovementHistory(BaseModel):
    id: UUID
    student_id: UUID
    gate_name: Optional[str] = None
    event_type: str
    status: str
    reason: Optional[str] = None
    event_time: datetime.datetime
    
    # Joined fields
    student_name: Optional[str] = None
    student_roll: Optional[str] = None


class EmergencyHeadcount(BaseModel):
    total_students: int
    inside: int
    outside: int
    on_leave: int
    unaccounted: int
    unaccounted_students: List[StudentHostelStatus]


class SetAttendanceCutoffRequest(BaseModel):
    hostel_id: UUID
    cutoff_time: datetime.time


class HostelAlert(BaseModel):
    id: UUID
    student_id: UUID
    alert_type: str
    description: Optional[str] = None
    severity: str
    is_resolved: bool
    created_at: datetime.datetime
    resolved_at: Optional[datetime.datetime] = None
    
    # Joined
    student_name: Optional[str] = None
    student_roll: Optional[str] = None
