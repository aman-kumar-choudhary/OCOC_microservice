from __future__ import annotations

from typing import Optional
from pydantic import BaseModel, Field
from app.schemas.user import CreateUserRequest, User
from app.schemas.rfid import Card


class OnboardingRequest(BaseModel):
    persona: str = Field(..., pattern="^(student|faculty|worker|visitor)$")
    user: CreateUserRequest


class OnboardingResult(BaseModel):
    user: User
    rfid_card: Optional[Card] = None
    card_issued: bool = False
    message: str


class RFIDEnrollRequest(BaseModel):
    uid: str
