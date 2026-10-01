from __future__ import annotations

import logging
from fastapi import APIRouter, Depends, HTTPException, status
import asyncpg

from app.core.database import get_db
from app.core.keycloak_client import (
    AccountSetupRequiredError,
    InvalidCredentialsError,
    KeycloakError,
)
from app.schemas.auth import (
    ForgotPasswordRequest,
    LoginRequest,
    LogoutRequest,
    RefreshRequest,
    ResetPasswordRequest,
    VerifyOTPRequest,
)
from app.schemas.common import error_response, success_response
from app.services.auth_service import auth_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/auth", tags=["auth"])


@router.post("/login")
async def login(req: LoginRequest):
    try:
        resp = await auth_service.login(req)
        return success_response(data=resp.model_dump())
    except InvalidCredentialsError:
        return error_response("INVALID_CREDENTIALS", "invalid username or password", status.HTTP_401_UNAUTHORIZED)
    except AccountSetupRequiredError:
        return error_response(
            "ACCOUNT_SETUP_REQUIRED",
            "complete the required Keycloak account action before signing in",
            status.HTTP_403_FORBIDDEN,
        )
    except Exception as e:
        logger.error("Login failed: %s", e)
        return error_response("LOGIN_FAILED", "login failed", status.HTTP_500_INTERNAL_SERVER_ERROR)


@router.post("/logout")
async def logout(req: LogoutRequest):
    try:
        await auth_service.logout(req.refresh_token)
        return success_response(message="logged out")
    except Exception as e:
        logger.error("Logout failed: %s", e)
        return error_response("LOGOUT_FAILED", "logout failed", status.HTTP_500_INTERNAL_SERVER_ERROR)


@router.post("/refresh")
async def refresh_token(req: RefreshRequest):
    try:
        resp = await auth_service.refresh_token(req)
        return success_response(data=resp.model_dump())
    except Exception as e:
        logger.error("Refresh failed: %s", e)
        return error_response("REFRESH_FAILED", "token refresh failed", status.HTTP_401_UNAUTHORIZED)


@router.post("/forgot-password")
async def forgot_password(req: ForgotPasswordRequest, conn: asyncpg.Connection = Depends(get_db)):
    try:
        # Always return 200 to prevent email enumeration
        await auth_service.forgot_password(conn, req.email)
    except Exception as e:
        logger.error("Forgot password error: %s", e)

    return success_response(message="If that email is registered, you will receive an OTP shortly")


@router.post("/verify-otp")
async def verify_otp(req: VerifyOTPRequest):
    try:
        resp = await auth_service.verify_otp(req)
        return success_response(data=resp.model_dump())
    except ValueError as e:
        return error_response("INVALID_OTP", str(e), status.HTTP_400_BAD_REQUEST)
    except Exception as e:
        logger.error("OTP verification error: %s", e)
        return error_response("VERIFY_FAILED", "OTP verification failed", status.HTTP_500_INTERNAL_SERVER_ERROR)


@router.post("/reset-password")
async def reset_password(req: ResetPasswordRequest, conn: asyncpg.Connection = Depends(get_db)):
    try:
        await auth_service.reset_password(conn, req)
        return success_response(message="password reset successfully")
    except ValueError as e:
        return error_response("RESET_FAILED", str(e), status.HTTP_400_BAD_REQUEST)
    except Exception as e:
        logger.error("Reset password error: %s", e)
        return error_response("RESET_FAILED", "password reset failed", status.HTTP_500_INTERNAL_SERVER_ERROR)
