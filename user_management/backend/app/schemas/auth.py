from __future__ import annotations

from typing import Optional
from pydantic import BaseModel, EmailStr

class LoginRequest(BaseModel):
    username: str
    password: str


class LoginResponse(BaseModel):
    access_token: str
    refresh_token: str
    expires_in: int
    refresh_expires_in: int
    token_type: str = "Bearer"


class RefreshRequest(BaseModel):
    refresh_token: str


class LogoutRequest(BaseModel):
    refresh_token: str


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class VerifyOTPRequest(BaseModel):
    email: EmailStr
    otp: str


class VerifyOTPResponse(BaseModel):
    reset_token: str


class ResetPasswordRequest(BaseModel):
    email: EmailStr
    reset_token: str
    new_password: str
