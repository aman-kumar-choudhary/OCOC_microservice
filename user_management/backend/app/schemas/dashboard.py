from __future__ import annotations

from typing import List
from pydantic import BaseModel
class Overview(BaseModel):
    total_users: int
    active_users: int
    suspended_users: int
    deactivated_users: int
    students: int
    faculty: int
    workers: int
    visitors: int
    rfid_issued: int
    rfid_active: int
    rfid_revoked: int


class TrendPoint(BaseModel):
    date: str
    count: int


class Analytics(BaseModel):
    onboarding_trend: List[TrendPoint]
    card_issuance_trend: List[TrendPoint]
