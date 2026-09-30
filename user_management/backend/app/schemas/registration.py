from __future__ import annotations

from typing import List, Optional
from pydantic import BaseModel, EmailStr, Field


class RegistrationRequest(BaseModel):
    role: Optional[str] = "student"
    roles: Optional[List[str]] = None
    full_name: str
    email: EmailStr
    phone: str
    password: Optional[str] = Field(None, min_length=8, max_length=128)
    # Common / Shared
    department: Optional[str] = None
    department_id: Optional[str] = None
    emergency_contact: Optional[str] = None
    guardian_contact: Optional[str] = None
    nationality: Optional[str] = None
    gov_id_type: Optional[str] = None
    gov_id_number: Optional[str] = None

    # Student Details
    student_id: Optional[str] = None
    roll_number: Optional[str] = None
    course: Optional[str] = None
    semester: Optional[str] = None
    batch: Optional[str] = None
    hostel: Optional[str] = None
    hostel_id: Optional[str] = None
    room_number: Optional[str] = None

    # Faculty Details
    faculty_id: Optional[str] = None
    employee_id: Optional[str] = None
    designation: Optional[str] = None
    courses: Optional[str] = None
    assigned_students: Optional[str] = None

    # Warden Details (for Faculty + Warden or Warden)
    hostel_block: Optional[str] = None
    warden_responsibilities: Optional[str] = None

    # Worker Details
    worker_id: Optional[str] = None
    job_type: Optional[str] = None
    worker_type: Optional[str] = None
    work_area: Optional[str] = None
    shift: Optional[str] = None
    assigned_location_id: Optional[str] = None
    assigned_location: Optional[str] = None

    # Visitor Details
    visit_purpose: Optional[str] = None
    host_person: Optional[str] = None
    host_contact: Optional[str] = None
    visit_start: Optional[str] = None
    visit_duration_days: Optional[int] = None
    valid_until: Optional[str] = None
    allowed_location_ids: Optional[List[str]] = None
    allowed_locations: Optional[str] = None


class RegisteredUser(BaseModel):
    id: str
    role: str
    roles: List[str] = Field(default_factory=list)
    full_name: str
    email: str
    phone: str
    status: str
    created_at: str
    is_existing_user: bool = False
    dashboard_path: Optional[str] = None
    dashboard_name: Optional[str] = None
    role_profiles: Optional[dict] = None
    # Flat convenience fields for backward compatibility
    roll_number: Optional[str] = None
    employee_id: Optional[str] = None
    department: Optional[str] = None
    hostel: Optional[str] = None
    batch: Optional[str] = None
    room_number: Optional[str] = None
    designation: Optional[str] = None
    courses: Optional[str] = None
    job_type: Optional[str] = None
    shift: Optional[str] = None
    work_area: Optional[str] = None
    emergency_contact: Optional[str] = None
    guardian_contact: Optional[str] = None
    gov_id_type: Optional[str] = None
    gov_id_number: Optional[str] = None
    visit_purpose: Optional[str] = None
    host_person: Optional[str] = None
    host_contact: Optional[str] = None


class RegistrationListResult(BaseModel):
    users: List[RegisteredUser]
    total: int
    page: int
    limit: int
    total_pages: int


class RegistrationStats(BaseModel):
    total: int
    students: int
    faculty: int
    workers: int
    visitors: int
