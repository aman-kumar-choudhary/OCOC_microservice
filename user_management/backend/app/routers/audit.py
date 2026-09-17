from __future__ import annotations

import logging
from typing import Optional
import uuid
from fastapi import APIRouter, Depends, Query, status
import asyncpg

from app.core.database import get_db
from app.core.security import Claims, require_permission
from app.schemas.common import error_response, success_response
from app.services.audit_service import audit_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/audit", tags=["audit"])


@router.get("")
async def list_audit_logs(
    actor_id: Optional[str] = Query(None),
    operation: Optional[str] = Query(None),
    entity_type: Optional[str] = Query(None),
    entity_id: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=200),
    claims: Claims = Depends(require_permission("audit:read")),
    conn: asyncpg.Connection = Depends(get_db),
):
    try:
        result = await audit_service.list_logs(
            conn=conn,
            actor_id=actor_id,
            operation=operation,
            entity_type=entity_type,
            entity_id=entity_id,
            page=page,
            limit=limit,
        )
        return success_response(data=result.model_dump())
    except Exception as e:
        logger.error("List audit logs failed: %s", e)
        return error_response("LIST_AUDIT_FAILED", str(e), status_code=status.HTTP_500_INTERNAL_SERVER_ERROR)


@router.get("/{log_id}")
async def get_audit_log(
    log_id: uuid.UUID,
    claims: Claims = Depends(require_permission("audit:read")),
    conn: asyncpg.Connection = Depends(get_db),
):
    log_entry = await audit_service.get_by_id(conn, log_id)
    if not log_entry:
        return error_response("AUDIT_LOG_NOT_FOUND", "audit log not found", status_code=status.HTTP_404_NOT_FOUND)
    return success_response(data=log_entry.model_dump())
