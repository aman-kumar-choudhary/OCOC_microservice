from __future__ import annotations

from typing import List, Optional
from pydantic import BaseModel, EmailStr, Field


class RegistrationRequest(BaseModel):
    role: str = Field(..., pattern="^(student|faculty|worker|visitor)$")
    full_name: str
    email: EmailStr
    phone: str
    # The public registration form supplies this value.  Keeping it in the
    # request schema ensures it reaches Keycloak instead of being silently
    # discarded by Pydantic.
    password: Optional[str] = Field(None, min_length=8, max_length=128)
    roll_number: Optional[str] = None
    employee_id: Optional[str] = None
    department: Optional[str] = None
    department_id: Optional[str] = None
    hostel: Optional[str] = None
    hostel_id: Optional[str] = None
    emergency_contact: Optional[str] = None
    guardian_contact: Optional[str] = None
    gov_id_type: Optional[str] = None
    gov_id_number: Optional[str] = None
    visit_purpose: Optional[str] = None
    host_contact: Optional[str] = None
    visit_start: Optional[str] = None
    visit_duration_days: Optional[int] = None
    worker_type: Optional[str] = None


class RegisteredUser(BaseModel):
    id: str
    role: str
    full_name: str
    email: str
    phone: str
    status: str
    created_at: str
    roll_number: Optional[str] = None
    employee_id: Optional[str] = None
    department: Optional[str] = None
    hostel: Optional[str] = None
    emergency_contact: Optional[str] = None
    guardian_contact: Optional[str] = None
    gov_id_type: Optional[str] = None
    gov_id_number: Optional[str] = None
    visit_purpose: Optional[str] = None
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
