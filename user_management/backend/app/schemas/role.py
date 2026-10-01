from __future__ import annotations

from typing import Optional
from pydantic import BaseModel


class Role(BaseModel):
    id: str
    name: str
    description: str
    user_type: Optional[str] = None
    created_at: str
    updated_at: str

class CreateRoleRequest(BaseModel):
    name: str
    description: str
    user_type: Optional[str] = None


class AssignRoleRequest(BaseModel):
    role_id: str
