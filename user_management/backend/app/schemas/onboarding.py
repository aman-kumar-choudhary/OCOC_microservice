from __future__ import annotations

from typing import List, Optional
from pydantic import BaseModel, Field
from app.schemas.user import CreateUserRequest, User
from app.schemas.rfid import Card


class OnboardingRequest(BaseModel):
    persona: str = Field(..., pattern="^(student|faculty|faculty_warden|warden|worker|visitor)$")
    roles: Optional[List[str]] = None
    user: CreateUserRequest


class OnboardingResult(BaseModel):
    user: User
    rfid_card: Optional[Card] = None
    card_issued: bool = False
    message: str


class RFIDEnrollRequest(BaseModel):
    uid: str


class WrappedUserRequest(BaseModel):
    """
    The shape the frontend Onboarding form sends for persona-specific routes.
    Wraps CreateUserRequest so user_type is NOT required in the body —
    it is injected server-side from the URL path (/onboarding/student etc.).
    """
    user: CreateUserRequest

