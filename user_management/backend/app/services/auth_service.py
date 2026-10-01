from __future__ import annotations
import logging
import re
import secrets
from typing import Optional
import asyncpg

from app.config import settings
from app.core.keycloak_client import (
    AccountSetupRequiredError,
    InvalidCredentialsError,
    keycloak_client,
)
from app.core.redis_client import redis_client
from app.schemas.auth import (
    ForgotPasswordRequest,
    LoginRequest,
    LoginResponse,
    RefreshRequest,
    ResetPasswordRequest,
    VerifyOTPRequest,
    VerifyOTPResponse,
)
from app.services.audit_service import audit_service
logger = logging.getLogger(__name__)

PASSWORD_REGEX = re.compile(
    r"^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#])[A-Za-z\d@$!%*?&#]{8,32}$"
)


class AuthService:
    async def login(self, req: LoginRequest) -> LoginResponse:
        tokens = await keycloak_client.user_login(req.username, req.password)
        return LoginResponse(
            access_token=tokens["access_token"],
            refresh_token=tokens.get("refresh_token", ""),
            expires_in=tokens.get("expires_in", 300),
            refresh_expires_in=tokens.get("refresh_expires_in", 1800),
            token_type=tokens.get("token_type", "Bearer"),
        )

    async def refresh_token(self, req: RefreshRequest) -> LoginResponse:
        tokens = await keycloak_client.refresh_token(req.refresh_token)
        return LoginResponse(
            access_token=tokens["access_token"],
            refresh_token=tokens.get("refresh_token", ""),
            expires_in=tokens.get("expires_in", 300),
            refresh_expires_in=tokens.get("refresh_expires_in", 1800),
            token_type=tokens.get("token_type", "Bearer"),
        )

    async def logout(self, refresh_token: str) -> None:
        await keycloak_client.logout(refresh_token)

    async def forgot_password(self, conn: asyncpg.Connection, email: str) -> None:
        # Check if user exists in database
        row = await conn.fetchrow(
            "SELECT id, keycloak_user_id FROM users WHERE LOWER(email) = LOWER($1)",
            email,
        )
        if not row:
            logger.info("Forgot-password requested for non-existent email: %s", email)
            return

        # Generate 6-digit numeric OTP
        otp = str(secrets.randbelow(900000) + 100000)
        await redis_client.set_otp(email, otp, ttl_seconds=settings.OTP_TTL_SECONDS)

        # Log OTP to console for dev / simulated email dispatch
        logger.info("[AUTH] Password reset OTP for %s: %s (valid for %ds)", email, otp, settings.OTP_TTL_SECONDS)

        await audit_service.log(
            conn=conn,
            actor_id=None,
            operation="PASSWORD_RESET_REQUESTED",
            entity_type="user",
            entity_id=str(row["id"]),
            after_state={"email": email},
        )

    async def verify_otp(self, req: VerifyOTPRequest) -> VerifyOTPResponse:
        stored_otp = await redis_client.get_otp(req.email)
        if not stored_otp or stored_otp != req.otp.strip():
            raise ValueError("Invalid or expired OTP")

        # Invalidate OTP after successful verification
        await redis_client.delete_otp(req.email)

        # Generate one-time reset token (valid for 15 minutes)
        reset_token = secrets.token_urlsafe(32)
        await redis_client.set_reset_token(reset_token, req.email, ttl_seconds=900)

        return VerifyOTPResponse(reset_token=reset_token)

    async def reset_password(self, conn: asyncpg.Connection, req: ResetPasswordRequest) -> None:
        saved_email = await redis_client.get_reset_token(req.reset_token)
        if not saved_email or saved_email.lower() != req.email.lower():
            raise ValueError("Invalid or expired reset token")

        if not PASSWORD_REGEX.match(req.new_password):
            raise ValueError(
                "Password must be 8-32 characters, contain at least one uppercase letter, "
                "one lowercase letter, one digit, and one special character"
            )

        row = await conn.fetchrow(
            "SELECT id, keycloak_user_id FROM users WHERE LOWER(email) = LOWER($1)",
            req.email,
        )
        if not row:
            raise ValueError("User not found")

        keycloak_id = row["keycloak_user_id"]
        if not keycloak_id:
            # Look up Keycloak ID by email if not linked in DB
            kc_user = await keycloak_client.get_user_by_email(req.email)
            if kc_user:
                keycloak_id = kc_user["id"]
                await conn.execute("UPDATE users SET keycloak_user_id=$1 WHERE id=$2", keycloak_id, row["id"])
            else:
                raise ValueError("User account is not registered in authentication provider")

        # Update password in Keycloak
        await keycloak_client.reset_password(keycloak_id, req.new_password, temporary=False)

        # Invalidate the reset token
        await redis_client.delete_reset_token(req.reset_token)

        await audit_service.log(
            conn=conn,
            actor_id=None,
            operation="PASSWORD_RESET_COMPLETED",
            entity_type="user",
            entity_id=str(row["id"]),
            after_state={"email": req.email},
        )


auth_service = AuthService()
