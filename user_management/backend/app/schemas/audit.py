from __future__ import annotations

from typing import Any, List, Optional
from pydantic import BaseModel


class Log(BaseModel):
    id: str
    actor_id: Optional[str] = None
    operation: str
    entity_type: str
    entity_id: str
    before_state: Optional[Any] = None
    after_state: Optional[Any] = None
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    created_at: str


class AuditListResult(BaseModel):
    logs: List[Log]
    total: int
    page: int
    limit: int
    total_pages: int
