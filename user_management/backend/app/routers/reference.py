from __future__ import annotations

import logging
from fastapi import APIRouter, Depends, status
import asyncpg

from app.core.database import get_db
from app.core.security import Claims, require_permission
from app.schemas.common import error_response, success_response
from app.services.user_service import user_service

logger = logging.getLogger(__name__)

router = APIRouter(tags=["reference"])


@router.get("/api/v1/departments")
async def list_departments(conn: asyncpg.Connection = Depends(get_db)):
    try:
        departments = await user_service.list_departments(conn)
        return success_response(data=[d.model_dump() for d in departments])
    except Exception as e:
        logger.error("List departments failed: %s", e)
        return error_response("DEPARTMENTS_FAILED", str(e), status_code=status.HTTP_500_INTERNAL_SERVER_ERROR)


@router.get("/api/v1/hostels")
async def list_hostels(conn: asyncpg.Connection = Depends(get_db)):
    try:
        hostels = await user_service.list_hostels(conn)
        return success_response(data=[h.model_dump() for h in hostels])
    except Exception as e:
        logger.error("List hostels failed: %s", e)
        return error_response("HOSTELS_FAILED", str(e), status_code=status.HTTP_500_INTERNAL_SERVER_ERROR)


@router.post("/api/admin/semester/advance")
async def advance_semester(
    conn: asyncpg.Connection = Depends(get_db),
    claims: Claims = Depends(require_permission("user:manage")),
):
    try:
        updated = await user_service.advance_semesters(conn, actor_id=claims.sub)
        return success_response(data={"updated_count": updated}, message=f"Advanced {updated} students")
    except Exception as e:
        logger.error("Semester advance failed: %s", e)
        return error_response("ADVANCE_FAILED", str(e), status_code=status.HTTP_500_INTERNAL_SERVER_ERROR)
