from __future__ import annotations

from typing import Any, Dict, List, Optional
import uuid
from pydantic import BaseModel, EmailStr, Field


class ProfileRequest(BaseModel):
    full_name: str
    roll_number: Optional[str] = None
    employee_id: Optional[str] = None
    department_id: Optional[str] = None
    department: Optional[str] = None
    school: Optional[str] = None
    course: Optional[str] = None
    semester: Optional[str] = None
    designation: Optional[str] = None
    hostel_flag: Optional[bool] = False
    hostel_id: Optional[str] = None
    emergency_contact: Optional[str] = None
    guardian_contact: Optional[str] = None
    photo_reference: Optional[str] = None
    gov_id_type: Optional[str] = None
    gov_id_number: Optional[str] = None
    visit_purpose: Optional[str] = None
    host_contact: Optional[str] = None
    visit_start: Optional[str] = None
    visit_duration_days: Optional[int] = None


class Profile(ProfileRequest):
    user_id: str
    updated_at: Optional[str] = None


class CreateUserRequest(BaseModel):
    user_type: Optional[str] = Field(None, pattern="^(student|faculty|worker|visitor)$")
    email: EmailStr
    phone: Optional[str] = None
    password: Optional[str] = ""
    profile: ProfileRequest


class UpdateUserRequest(BaseModel):
    phone: Optional[str] = None
    profile: Optional[ProfileRequest] = None


class BulkTransferRequest(BaseModel):
    user_ids: List[uuid.UUID]
    new_hostel_id: uuid.UUID


class User(BaseModel):
    id: str
    keycloak_user_id: Optional[str] = None
    user_type: str
    status: str
    email: str
    phone: Optional[str] = None
    created_at: str
    updated_at: str
    profile: Optional[Profile] = None
    roles: List[str] = Field(default_factory=list)
    active_rfid: Optional[str] = None
    has_face_auth: bool = False


class UserListResult(BaseModel):
    users: List[User]
    total: int
    page: int
    limit: int
    total_pages: int


class Department(BaseModel):
    id: str
    name: str
    code: Optional[str] = None
    school: Optional[str] = None


class Hostel(BaseModel):
    id: str
    name: str
    code: Optional[str] = None
    capacity: Optional[int] = None


class Stats(BaseModel):
    total_users: int
    active_users: int
    suspended_users: int
    deactivated_users: int
    students: int
    faculty: int
    workers: int
    visitors: int
