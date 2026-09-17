from __future__ import annotations

import logging
import uuid
from fastapi import APIRouter, Depends, status
import asyncpg

from app.core.database import get_db
from app.core.security import Claims, require_permission
from app.schemas.common import error_response, success_response
from app.schemas.onboarding import OnboardingRequest, RFIDEnrollRequest
from app.schemas.user import CreateUserRequest
from app.services.onboarding_service import onboarding_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/onboarding", tags=["onboarding"])


@router.post("")
async def onboard_generic(
    req: OnboardingRequest,
    conn: asyncpg.Connection = Depends(get_db),
    claims: Claims = Depends(require_permission("user:create")),
):
    try:
        res = await onboarding_service.onboard(conn, actor_id=claims.sub, req=req)
        return success_response(data=res.model_dump(), status_code=status.HTTP_201_CREATED)
    except Exception as e:
        logger.error("Onboarding failed: %s", e)
        return error_response("ONBOARDING_FAILED", str(e), status_code=400)


@router.post("/student")
async def onboard_student(
    user_req: CreateUserRequest,
    conn: asyncpg.Connection = Depends(get_db),
    claims: Claims = Depends(require_permission("user:create")),
):
    req = OnboardingRequest(persona="student", user=user_req)
    return await onboard_generic(req, conn, claims)


@router.post("/faculty")
async def onboard_faculty(
    user_req: CreateUserRequest,
    conn: asyncpg.Connection = Depends(get_db),
    claims: Claims = Depends(require_permission("user:create")),
):
    req = OnboardingRequest(persona="faculty", user=user_req)
    return await onboard_generic(req, conn, claims)


@router.post("/worker")
async def onboard_worker(
    user_req: CreateUserRequest,
    conn: asyncpg.Connection = Depends(get_db),
    claims: Claims = Depends(require_permission("user:create")),
):
    req = OnboardingRequest(persona="worker", user=user_req)
    return await onboard_generic(req, conn, claims)


@router.post("/visitor")
async def onboard_visitor(
    user_req: CreateUserRequest,
    conn: asyncpg.Connection = Depends(get_db),
    claims: Claims = Depends(require_permission("user:create")),
):
    req = OnboardingRequest(persona="visitor", user=user_req)
    return await onboard_generic(req, conn, claims)


@router.post("/{user_id}/rfid")
async def enroll_rfid(
    user_id: uuid.UUID,
    req: RFIDEnrollRequest,
    conn: asyncpg.Connection = Depends(get_db),
    claims: Claims = Depends(require_permission("user:create")),
):
    try:
        card = await onboarding_service.enroll_rfid(conn, actor_id=claims.sub, user_id=user_id, uid=req.uid)
        return success_response(data=card.model_dump())
    except Exception as e:
        logger.error("Enroll RFID failed: %s", e)
        return error_response("RFID_ENROLL_FAILED", str(e), status_code=400)


@router.post("/{user_id}/issue-card")
async def issue_card(
    user_id: uuid.UUID,
    conn: asyncpg.Connection = Depends(get_db),
    claims: Claims = Depends(require_permission("user:create")),
):
    try:
        res = await onboarding_service.issue_card(conn, actor_id=claims.sub, user_id=user_id)
        return success_response(data=res.model_dump())
    except Exception as e:
        logger.error("Issue card failed: %s", e)
        return error_response("ISSUE_CARD_FAILED", str(e), status_code=400)
