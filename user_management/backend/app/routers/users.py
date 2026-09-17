from __future__ import annotations

import csv
import io
import logging
from typing import Optional
import uuid
from fastapi import APIRouter, Depends, File, HTTPException, Query, Response, UploadFile, status
from fastapi.responses import PlainTextResponse
import asyncpg

from app.core.database import get_db
from app.core.security import Claims, require_permission
from app.schemas.common import error_response, success_response
from app.schemas.role import AssignRoleRequest
from app.schemas.user import CreateUserRequest, ProfileRequest, UpdateUserRequest
from app.services.role_service import role_service
from app.services.user_service import user_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/users", tags=["users"])


@router.get("")
async def list_users(
    search: Optional[str] = Query(None),
    user_type: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    school: Optional[str] = Query(None),
    department: Optional[str] = Query(None),
    course: Optional[str] = Query(None),
    semester: Optional[str] = Query(None),
    hostel_id: Optional[str] = Query(None),
    hostel_status: Optional[str] = Query(None),
    role: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=200),
    claims: Claims = Depends(require_permission("user:read")),
    conn: asyncpg.Connection = Depends(get_db),
):
    try:
        result = await user_service.list_users(
            conn=conn,
            search=search,
            user_type=user_type,
            status=status,
            school=school,
            department=department,
            course=course,
            semester=semester,
            hostel_id=hostel_id,
            hostel_status=hostel_status,
            role=role,
            page=page,
            limit=limit,
        )
        return success_response(data=result.model_dump())
    except Exception as e:
        logger.error("List users failed: %s", e)
        return error_response("LIST_FAILED", str(e), status_code=status.HTTP_500_INTERNAL_SERVER_ERROR)


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_user(
    req: CreateUserRequest,
    conn: asyncpg.Connection = Depends(get_db),
    claims: Claims = Depends(require_permission("user:create")),
):
    try:
        u = await user_service.create_user(conn, actor_id=claims.sub, req=req)
        return success_response(data=u.model_dump(), status_code=status.HTTP_201_CREATED)
    except ValueError as e:
        code = "DUPLICATE_EMAIL" if "already registered" in str(e) else "VALIDATION_ERROR"
        status_code = status.HTTP_409_CONFLICT if "already" in str(e) else status.HTTP_400_BAD_REQUEST
        return error_response(code, str(e), status_code=status_code)
    except Exception as e:
        logger.error("Create user failed: %s", e)
        return error_response("CREATE_FAILED", str(e), status_code=status.HTTP_500_INTERNAL_SERVER_ERROR)


@router.get("/export")
async def export_users(
    conn: asyncpg.Connection = Depends(get_db),
    claims: Claims = Depends(require_permission("user:export")),
):
    try:
        result = await user_service.list_users(conn, limit=10000)
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow([
            "id", "user_type", "status", "email", "phone", "full_name",
            "roll_number", "employee_id", "department", "school", "course",
            "semester", "designation", "active_rfid", "created_at"
        ])
        for u in result.users:
            p = u.profile
            writer.writerow([
                u.id, u.user_type, u.status, u.email, u.phone or "",
                p.full_name if p else "",
                p.roll_number if p and p.roll_number else "",
                p.employee_id if p and p.employee_id else "",
                p.department if p and p.department else "",
                p.school if p and p.school else "",
                p.course if p and p.course else "",
                p.semester if p and p.semester else "",
                p.designation if p and p.designation else "",
                u.active_rfid or "",
                u.created_at,
            ])
        csv_data = output.getvalue()
        return Response(
            content=csv_data,
            media_type="text/csv",
            headers={"Content-Disposition": 'attachment; filename="users_export.csv"'},
        )
    except Exception as e:
        logger.error("Export users failed: %s", e)
        return error_response("EXPORT_FAILED", str(e), status_code=status.HTTP_500_INTERNAL_SERVER_ERROR)


@router.get("/import/template")
async def import_template(claims: Claims = Depends(require_permission("user:import"))):
    template = "user_type,email,full_name,phone,roll_number,employee_id,department,course,semester,designation\nstudent,student@example.com,John Doe,+919876543210,CS2024001,,Department of Computer Sciences,B.Tech,1,\n"
    return Response(
        content=template,
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="user_import_template.csv"'},
    )


@router.post("/import/validate")
async def import_validate(
    file: UploadFile = File(...),
    claims: Claims = Depends(require_permission("user:import")),
):
    try:
        content = await file.read()
        text = content.decode("utf-8")
        reader = csv.DictReader(io.StringIO(text))
        rows = list(reader)
        valid_count = 0
        errors = []
        for i, row in enumerate(rows, start=1):
            if not row.get("email") or not row.get("full_name") or not row.get("user_type"):
                errors.append(f"Row {i}: missing required fields (email, full_name, user_type)")
            else:
                valid_count += 1
        return success_response(data={"total_rows": len(rows), "valid_rows": valid_count, "errors": errors})
    except Exception as e:
        return error_response("VALIDATE_FAILED", str(e), status_code=status.HTTP_400_BAD_REQUEST)


@router.post("/import")
async def import_users(
    file: UploadFile = File(...),
    conn: asyncpg.Connection = Depends(get_db),
    claims: Claims = Depends(require_permission("user:import")),
):
    try:
        content = await file.read()
        text = content.decode("utf-8")
        reader = csv.DictReader(io.StringIO(text))
        imported_count = 0
        errors = []
        for i, row in enumerate(reader, start=1):
            try:
                p_req = ProfileRequest(
                    full_name=row.get("full_name", "").strip(),
                    roll_number=row.get("roll_number", "").strip() or None,
                    employee_id=row.get("employee_id", "").strip() or None,
                    department=row.get("department", "").strip() or None,
                    course=row.get("course", "").strip() or None,
                    semester=row.get("semester", "").strip() or None,
                    designation=row.get("designation", "").strip() or None,
                )
                req = CreateUserRequest(
                    user_type=row.get("user_type", "student").strip().lower(),
                    email=row.get("email", "").strip().lower(),
                    phone=row.get("phone", "").strip() or None,
                    profile=p_req,
                )
                await user_service.create_user(conn, actor_id=claims.sub, req=req)
                imported_count += 1
            except Exception as row_err:
                errors.append(f"Row {i} ({row.get('email')}): {row_err}")

        return success_response(data={"imported_count": imported_count, "errors": errors})
    except Exception as e:
        return error_response("IMPORT_FAILED", str(e), status_code=status.HTTP_500_INTERNAL_SERVER_ERROR)


@router.get("/{user_id}")
async def get_user_by_id(
    user_id: uuid.UUID,
    conn: asyncpg.Connection = Depends(get_db),
    claims: Claims = Depends(require_permission("user:read")),
):
    u = await user_service.get_by_id(conn, user_id)
    if not u:
        return error_response("USER_NOT_FOUND", "user not found", status_code=status.HTTP_404_NOT_FOUND)
    return success_response(data=u.model_dump())


@router.put("/{user_id}")
@router.patch("/{user_id}")
async def update_user(
    user_id: uuid.UUID,
    req: UpdateUserRequest,
    conn: asyncpg.Connection = Depends(get_db),
    claims: Claims = Depends(require_permission("user:update")),
):
    try:
        u = await user_service.update_user(conn, actor_id=claims.sub, user_id=user_id, req=req)
        return success_response(data=u.model_dump())
    except ValueError as e:
        return error_response("UPDATE_FAILED", str(e), status_code=status.HTTP_400_BAD_REQUEST)
    except Exception as e:
        logger.error("Update user failed: %s", e)
        return error_response("UPDATE_FAILED", str(e), status_code=status.HTTP_500_INTERNAL_SERVER_ERROR)


@router.delete("/{user_id}")
async def delete_user(
    user_id: uuid.UUID,
    conn: asyncpg.Connection = Depends(get_db),
    claims: Claims = Depends(require_permission("user:delete")),
):
    try:
        await user_service.delete_user(conn, actor_id=claims.sub, user_id=user_id)
        return success_response(message="user deleted successfully")
    except ValueError as e:
        return error_response("DELETE_FAILED", str(e), status_code=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        logger.error("Delete user failed: %s", e)
        return error_response("DELETE_FAILED", str(e), status_code=status.HTTP_500_INTERNAL_SERVER_ERROR)


@router.patch("/{user_id}/suspend")
async def suspend_user(
    user_id: uuid.UUID,
    conn: asyncpg.Connection = Depends(get_db),
    claims: Claims = Depends(require_permission("user:suspend")),
):
    try:
        await user_service.update_status(conn, actor_id=claims.sub, user_id=user_id, new_status="suspended")
        return success_response(message="user suspended")
    except Exception as e:
        return error_response("SUSPEND_FAILED", str(e), status_code=status.HTTP_500_INTERNAL_SERVER_ERROR)


@router.patch("/{user_id}/activate")
async def activate_user(
    user_id: uuid.UUID,
    conn: asyncpg.Connection = Depends(get_db),
    claims: Claims = Depends(require_permission("user:update")),
):
    try:
        await user_service.update_status(conn, actor_id=claims.sub, user_id=user_id, new_status="active")
        return success_response(message="user activated")
    except Exception as e:
        return error_response("ACTIVATE_FAILED", str(e), status_code=status.HTTP_500_INTERNAL_SERVER_ERROR)


@router.patch("/{user_id}/deactivate")
async def deactivate_user(
    user_id: uuid.UUID,
    conn: asyncpg.Connection = Depends(get_db),
    claims: Claims = Depends(require_permission("user:deactivate")),
):
    try:
        await user_service.update_status(conn, actor_id=claims.sub, user_id=user_id, new_status="deactivated")
        return success_response(message="user deactivated")
    except Exception as e:
        return error_response("DEACTIVATE_FAILED", str(e), status_code=status.HTTP_500_INTERNAL_SERVER_ERROR)


@router.post("/{user_id}/roles")
async def assign_role_to_user(
    user_id: uuid.UUID,
    req: AssignRoleRequest,
    conn: asyncpg.Connection = Depends(get_db),
    claims: Claims = Depends(require_permission("role:assign")),
):
    try:
        role_uuid = uuid.UUID(req.role_id)
        await role_service.assign_to_user(conn, actor_id=claims.sub, user_id=user_id, role_id=role_uuid)
        return success_response(message="role assigned")
    except Exception as e:
        return error_response("ROLE_ASSIGN_FAILED", str(e), status_code=status.HTTP_500_INTERNAL_SERVER_ERROR)


@router.delete("/{user_id}/roles/{role_id}")
async def remove_role_from_user(
    user_id: uuid.UUID,
    role_id: uuid.UUID,
    conn: asyncpg.Connection = Depends(get_db),
    claims: Claims = Depends(require_permission("role:assign")),
):
    try:
        await role_service.remove_from_user(conn, actor_id=claims.sub, user_id=user_id, role_id=role_id)
        return success_response(message="role removed")
    except Exception as e:
        return error_response("ROLE_REMOVE_FAILED", str(e), status_code=status.HTTP_500_INTERNAL_SERVER_ERROR)
