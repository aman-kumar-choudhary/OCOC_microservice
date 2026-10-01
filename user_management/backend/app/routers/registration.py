from __future__ import annotations

import logging
from typing import Optional
from fastapi import APIRouter, Depends, Query, status
import asyncpg
from app.core.database import get_db
from app.core.security import Claims, get_current_claims
from app.schemas.common import error_response, success_response
from app.schemas.registration import RegistrationRequest
from app.services.registration_service import registration_service

logger = logging.getLogger(__name__)

router = APIRouter(tags=["registration"])

@router.post("/api/v1/register", status_code=status.HTTP_201_CREATED)
async def public_register(
    req: RegistrationRequest,
    conn: asyncpg.Connection = Depends(get_db),
):
    try:
        user = await registration_service.register(conn, req)
        return success_response(data=user.model_dump(), status_code=status.HTTP_201_CREATED)
    except ValueError as e:
        status_code = status.HTTP_409_CONFLICT if "already" in str(e) else status.HTTP_400_BAD_REQUEST
        code = "DUPLICATE_EMAIL" if "already" in str(e) else "VALIDATION_ERROR"
        return error_response(code, str(e), status_code=status_code)
    except Exception as e:
        logger.error("Public registration failed: %s", e)
        return error_response("REGISTRATION_FAILED", str(e), status_code=status.HTTP_500_INTERNAL_SERVER_ERROR)


@router.get("/api/v1/registrations")
async def list_registrations(
    role: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=200),
    conn: asyncpg.Connection = Depends(get_db),
    claims: Claims = Depends(get_current_claims),
):
    try:
        result = await registration_service.list_registrations(
            conn=conn,
            role=role,
            search=search,
            page=page,
            limit=limit,
        )
        return success_response(data=result.model_dump())
    except Exception as e:
        logger.error("List registrations failed: %s", e)
        return error_response("LIST_FAILED", str(e), status_code=status.HTTP_500_INTERNAL_SERVER_ERROR)


@router.get("/api/v1/registrations/stats")
async def registration_stats(
    conn: asyncpg.Connection = Depends(get_db),
    claims: Claims = Depends(get_current_claims),
):
    try:
        stats = await registration_service.get_stats(conn)
        return success_response(data=stats.model_dump())
    except Exception as e:
        logger.error("Registration stats failed: %s", e)
        return error_response("STATS_FAILED", str(e), status_code=status.HTTP_500_INTERNAL_SERVER_ERROR)
