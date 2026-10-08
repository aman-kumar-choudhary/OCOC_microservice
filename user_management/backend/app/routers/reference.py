from __future__ import annotations

import logging
from typing import Optional
from fastapi import APIRouter, Depends, Query, status
import asyncpg
import uuid
from app.core.database import get_db
from app.core.security import Claims, require_permission, require_role, resolve_warden_hostel_scope
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


@router.get("/api/v1/courses")
@router.get("/api/v1/reference/courses")
async def list_reference_courses(
    school: Optional[str] = Query(None),
    department: Optional[str] = Query(None),
    conn: asyncpg.Connection = Depends(get_db),
):
    try:
        courses = await user_service.list_courses(conn, school=school, department=department)
        return success_response(data=courses)
    except Exception as e:
        logger.error("List reference courses failed: %s", e)
        return error_response("COURSES_FAILED", str(e), status_code=status.HTTP_500_INTERNAL_SERVER_ERROR)


@router.get("/api/v1/reference/hostels")
async def list_reference_hostels(conn: asyncpg.Connection = Depends(get_db)):
    try:
        hostels = await user_service.list_hostels(conn)
        return success_response(data=[h.model_dump() for h in hostels])
    except Exception as e:
        logger.error("List reference hostels failed: %s", e)
        return error_response("HOSTELS_FAILED", str(e), status_code=status.HTTP_500_INTERNAL_SERVER_ERROR)


@router.get("/api/v1/locations")
@router.get("/api/v1/reference/locations")
async def list_reference_locations(conn: asyncpg.Connection = Depends(get_db)):
    try:
        locations = await user_service.list_locations(conn)
        return success_response(data=locations)
    except Exception as e:
        logger.error("List reference locations failed: %s", e)
        return error_response("LOCATIONS_FAILED", str(e), status_code=status.HTTP_500_INTERNAL_SERVER_ERROR)


@router.get("/api/v1/hostels")
async def list_hostels(
    conn: asyncpg.Connection = Depends(get_db),
    claims: Claims = Depends(require_role("SUPER_ADMIN", "WARDEN")),
):
    try:
        scope = await resolve_warden_hostel_scope(conn, claims)
        if scope is None:
            hostels = await user_service.list_hostels(conn)
            data = [h.model_dump() for h in hostels]
        else:
            rows = await conn.fetch("SELECT id, name, code, capacity FROM hostels WHERE id = ANY($1::uuid[]) ORDER BY name", scope)
            data = [dict(row) for row in rows]
        return success_response(data=data)
    except Exception as e:
        logger.error("List hostels failed: %s", e)
        return error_response("HOSTELS_FAILED", str(e), status_code=status.HTTP_500_INTERNAL_SERVER_ERROR)


@router.get("/api/v1/hostels/{hostel_id}/occupancy")
async def get_hostel_occupancy(
    hostel_id: uuid.UUID,
    conn: asyncpg.Connection = Depends(get_db),
    claims: Claims = Depends(require_role("SUPER_ADMIN", "ADMIN", "WARDEN")),
):
    try:
        await resolve_warden_hostel_scope(conn, claims, hostel_id)
        stats = await conn.fetchrow("""
            SELECT 
                COUNT(*) as total,
                COUNT(CASE WHEN COALESCE(shs.current_status, 'INSIDE') = 'INSIDE' THEN 1 END) as inside,
                COUNT(CASE WHEN shs.current_status IN ('OUTSIDE', 'ON_LEAVE', 'UNAUTHORIZED', 'LATE_RETURN') THEN 1 END) as outside
            FROM student_profiles sp
            LEFT JOIN student_hostel_status shs ON shs.student_id = sp.user_id
            WHERE sp.hostel_id = $1
        """, hostel_id)
        
        total = (stats["total"] if stats else 0) or 0
        inside = (stats["inside"] if stats else 0) or 0
        outside = (stats["outside"] if stats else 0) or 0
        
        return success_response(data={"inside": inside, "outside": outside, "total": total})
    except Exception as e:
        logger.error("Occupancy failed: %s", e)
        return error_response("OCCUPANCY_FAILED", str(e), status_code=status.HTTP_500_INTERNAL_SERVER_ERROR)


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
