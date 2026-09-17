from __future__ import annotations

import logging
from typing import Optional
from fastapi import APIRouter, Depends, Query, Request, status
import asyncpg

from app.core.database import get_db
from app.core.security import Claims, require_permission
from app.schemas.common import error_response, success_response
from app.schemas.faceauth import LogRequest
from app.services.faceauth_service import faceauth_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/face-auth", tags=["face-auth"])


@router.post("/log", status_code=status.HTTP_201_CREATED)
async def create_log(
    req: LogRequest,
    request: Request,
    conn: asyncpg.Connection = Depends(get_db),
    claims: Claims = Depends(require_permission("user:read")),
):
    try:
        ip = request.client.host if request.client else None
        entry = await faceauth_service.create_log(conn, req, ip_address=ip)
        return success_response(data=entry.model_dump(), status_code=status.HTTP_201_CREATED)
    except Exception as e:
        logger.error("Create face auth log failed: %s", e)
        return error_response("FACE_AUTH_LOG_FAILED", str(e), status_code=status.HTTP_400_BAD_REQUEST)


@router.get("/logs")
async def list_logs(
    person_id: Optional[str] = Query(None),
    result: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=200),
    conn: asyncpg.Connection = Depends(get_db),
    claims: Claims = Depends(require_permission("audit:read")),
):
    try:
        res = await faceauth_service.list_logs(conn, person_external_id=person_id, result=result, page=page, limit=limit)
        return success_response(data=res.model_dump())
    except Exception as e:
        logger.error("List face auth logs failed: %s", e)
        return error_response("LIST_LOGS_FAILED", str(e), status_code=status.HTTP_500_INTERNAL_SERVER_ERROR)
