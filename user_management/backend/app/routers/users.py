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
from app.core.security import Claims, require_permission, get_current_claims, resolve_warden_hostel_scope, ADMIN_ROLES, ensure_local_user
from app.schemas.common import error_response, success_response
from app.schemas.role import AssignRoleRequest
from app.schemas.user import CreateUserRequest, ProfileRequest, UpdateUserRequest, BulkTransferRequest, UpdateStatusRequest
from app.core.redis_client import redis_client
from app.services.role_service import role_service
from app.services.user_service import user_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/users", tags=["users"])


@router.get("/me")
async def get_current_user_profile(
    claims: Claims = Depends(get_current_claims),
    conn: asyncpg.Connection = Depends(get_db),
):
    """Return profile, roles, assigned locations, and dashboard details for current authenticated user."""
    cache_key = f"user:me:{claims.sub}"
    cached = await redis_client.get(cache_key)
    if cached is not None and isinstance(cached, dict):
        return success_response(data=cached)

    # Ensure local record exists and is mapped to claims.sub
    resolved_user_id = await ensure_local_user(conn, claims)

    user = await conn.fetchrow(
        """
        SELECT u.id, u.email, u.phone, u.user_type, u.status, u.keycloak_user_id,
               COALESCE(sp.full_name, fp.full_name, wp.full_name, vp.full_name, u.email) AS full_name,
               sp.roll_number, sp.course, sp.semester,
               d.name AS department_name, d.code AS department_code,
               h.name AS hostel_name, h.code AS hostel_code,
               fp.employee_id AS faculty_employee_id, fp.designation AS faculty_designation,
               wp.employee_id AS worker_employee_id, wp.designation AS worker_designation,
               vp.visit_purpose AS visitor_purpose, vp.host_contact AS visitor_contact, (vp.visit_start + (COALESCE(vp.visit_duration_days, 1) || ' days')::interval) AS visitor_valid_until
        FROM users u
        LEFT JOIN student_profiles sp ON sp.user_id = u.id
        LEFT JOIN faculty_profiles fp ON fp.user_id = u.id
        LEFT JOIN worker_profiles wp ON wp.user_id = u.id
        LEFT JOIN visitor_profiles vp ON vp.user_id = u.id
        LEFT JOIN departments d ON d.id = COALESCE(sp.department_id, fp.department_id)
        LEFT JOIN hostels h ON h.id = sp.hostel_id
        WHERE u.id = $1
        LIMIT 1
        """,
        resolved_user_id,
    )
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User profile not found")

    user_id = user["id"]

    # Roles
    user_roles = await conn.fetch(
        "SELECT r.name FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE ur.user_id = $1 ORDER BY r.name",
        user_id,
    )
    roles = [r["name"] for r in user_roles]
    combined_roles = list(set(roles + [r for r in claims.roles if not r.startswith("default-") and r != "uma_authorization"]))

    # Location grants
    loc_rows = await conn.fetch(
        """
        SELECT l.id, l.name, l.type, ula.access_level, ula.valid_until
        FROM user_location_access ula
        JOIN locations l ON l.id = ula.location_id
        WHERE ula.user_id = $1 AND ula.status = 'active'
          AND (ula.valid_until IS NULL OR ula.valid_until >= now())
        ORDER BY l.name
        """,
        user_id,
    )
    locations = [
        {
            "id": str(r["id"]),
            "name": r["name"],
            "type": r["type"],
            "access_level": r["access_level"],
            "valid_until": r["valid_until"].isoformat() if r["valid_until"] else None,
        }
        for r in loc_rows
    ]

    # RFID card info
    rfid_card = await conn.fetchrow(
        """
        SELECT rc.uid, rc.status
        FROM user_rfid_cards urc
        JOIN rfid_cards rc ON rc.id = urc.rfid_card_id
        WHERE urc.user_id = $1 AND urc.unassigned_at IS NULL AND rc.status = 'active'
        LIMIT 1
        """,
        user_id,
    )

    # Student specific details
    student_status = None
    if user["user_type"] == "student":
        status_row = await conn.fetchrow(
            "SELECT current_status, last_event_time FROM student_hostel_status WHERE student_id = $1",
            user_id,
        )
        active_perm = await conn.fetchrow(
            """
            SELECT 
                lr.id as request_id,
                COALESCE(lt.name, lr.category, 'CAMPUS_EXIT') as permission_type,
                COALESCE(lr.destination, 'Authorized Leave') as destination,
                lr.reason,
                lrp.starts_at as start_time,
                lrp.ends_at as end_time,
                lr.status
            FROM leave_rfid_permissions lrp
            JOIN leave_requests lr ON lr.id = lrp.request_id
            LEFT JOIN leave_types lt ON lt.id = lr.leave_type_id
            WHERE lrp.student_id = $1 
              AND lrp.status = 'ACTIVE'
              AND lr.status = 'APPROVED'
              AND lrp.ends_at >= now()
            ORDER BY lrp.starts_at DESC LIMIT 1
            """,
            user_id,
        )
        if not active_perm:
            active_perm = await conn.fetchrow(
                """
                SELECT 
                    id as request_id,
                    permission_type,
                    reason,
                    reason as destination,
                    start_time,
                    end_time,
                    status
                FROM hostel_permissions
                WHERE student_id = $1 
                  AND status IN ('APPROVED', 'ACTIVE')
                  AND end_time >= now()
                ORDER BY start_time DESC LIMIT 1
                """,
                user_id,
            )
        active_perm_dict = None
        if active_perm:
            active_perm_dict = {
                "id": str(active_perm["request_id"]) if active_perm["request_id"] else None,
                "permission_type": active_perm["permission_type"],
                "reason": active_perm["reason"],
                "destination": active_perm["destination"] or "Authorized Leave",
                "start_time": active_perm["start_time"].isoformat() if active_perm["start_time"] else None,
                "end_time": active_perm["end_time"].isoformat() if active_perm["end_time"] else None,
                "status": active_perm["status"],
            }
        student_status = {
            "current_status": status_row["current_status"] if status_row else "INSIDE",
            "last_movement": status_row["last_event_time"].isoformat() if status_row and status_row["last_event_time"] else None,
            "active_permission": active_perm_dict,
        }

    # Role-specific profiles
    sp = fp = warden = wp = vp = None
    try:
        sp = await conn.fetchrow(
            "SELECT sp.*, h.name as hostel_name, d.name as department_name FROM student_profiles sp LEFT JOIN hostels h ON h.id = sp.hostel_id LEFT JOIN departments d ON d.id = sp.department_id WHERE sp.user_id = $1",
            user_id,
        )
    except Exception as e:
        logger.warning("Could not fetch student_profiles for %s: %s", user_id, e)

    try:
        fp = await conn.fetchrow(
            "SELECT fp.*, d.name as department_name FROM faculty_profiles fp LEFT JOIN departments d ON d.id = fp.department_id WHERE fp.user_id = $1",
            user_id,
        )
    except Exception as e:
        logger.warning("Could not fetch faculty_profiles for %s: %s", user_id, e)

    try:
        warden = await conn.fetchrow(
            "SELECT wp.*, h.name as hostel_name FROM warden_profiles wp LEFT JOIN hostels h ON h.id = wp.hostel_id WHERE wp.user_id = $1",
            user_id,
        )
    except Exception as e:
        logger.warning("Could not fetch warden_profiles for %s: %s", user_id, e)

    try:
        wp = await conn.fetchrow(
            "SELECT wp.*, d.name as department_name, l.name as location_name FROM worker_profiles wp LEFT JOIN departments d ON d.id = wp.department_id LEFT JOIN locations l ON l.id = wp.assigned_location_id WHERE wp.user_id = $1",
            user_id,
        )
    except Exception as e:
        logger.warning("Could not fetch worker_profiles for %s: %s", user_id, e)

    try:
        vp = await conn.fetchrow(
            "SELECT * FROM visitor_profiles WHERE user_id = $1",
            user_id,
        )
    except Exception as e:
        logger.warning("Could not fetch visitor_profiles for %s: %s", user_id, e)

    role_profiles = {}
    sp_d = dict(sp) if sp else {}
    fp_d = dict(fp) if fp else {}
    warden_d = dict(warden) if warden else {}
    wp_d = dict(wp) if wp else {}
    vp_d = dict(vp) if vp else {}

    if sp:
        role_profiles["student"] = {
            "student_id": sp_d.get("roll_number"),
            "course": sp_d.get("course"),
            "department": sp_d.get("department_name"),
            "semester": sp_d.get("semester"),
            "batch": sp_d.get("batch"),
            "hostel": sp_d.get("hostel_name"),
            "room_number": sp_d.get("room_number"),
        }
    if fp:
        role_profiles["faculty"] = {
            "faculty_id": fp_d.get("employee_id"),
            "department": fp_d.get("department_name"),
            "designation": fp_d.get("designation"),
            "courses": fp_d.get("courses"),
            "assigned_students": fp_d.get("assigned_students"),
        }
    if warden:
        role_profiles["warden"] = {
            "hostel": warden_d.get("hostel_name"),
            "hostel_block": warden_d.get("hostel_block"),
            "responsibilities": warden_d.get("responsibilities"),
        }
    if wp:
        role_profiles["worker"] = {
            "worker_id": wp_d.get("employee_id"),
            "job_type": wp_d.get("job_type") or wp_d.get("designation"),
            "department": wp_d.get("department_name"),
            "assigned_location": wp_d.get("location_name"),
            "work_area": wp_d.get("work_area"),
            "shift": wp_d.get("shift"),
        }
    if vp:
        role_profiles["visitor"] = {
            "visit_purpose": vp_d.get("visit_purpose"),
            "host_person": vp_d.get("host_person"),
            "host_contact": vp_d.get("host_contact"),
            "visit_start": vp_d.get("visit_start").isoformat() if vp_d.get("visit_start") else None,
            "visit_duration_days": vp_d.get("visit_duration_days"),
            "valid_until": vp_d.get("valid_until").isoformat() if vp_d.get("valid_until") else None,
        }

    dash = role_service.get_dashboard_info(combined_roles)

    data = {
        "id": str(user["id"]),
        "email": user["email"],
        "phone": user["phone"],
        "user_type": user["user_type"],
        "status": user["status"],
        "full_name": user["full_name"],
        "roll_number": sp_d.get("roll_number") if sp else user["roll_number"],
        "course": sp_d.get("course") if sp else user["course"],
        "semester": sp_d.get("semester") if sp else user["semester"],
        "batch": sp_d.get("batch") if sp else None,
        "room_number": sp_d.get("room_number") if sp else None,
        "department": (sp_d.get("department_name") if sp else None) or (fp_d.get("department_name") if fp else None) or user["department_name"],
        "hostel": (sp_d.get("hostel_name") if sp else None) or (warden_d.get("hostel_name") if warden else None) or user["hostel_name"],
        "hostel_block": warden_d.get("hostel_block") if warden else None,
        "warden_responsibilities": warden_d.get("responsibilities") if warden else None,
        "employee_id": (fp_d.get("employee_id") if fp else None) or (wp_d.get("employee_id") if wp else None) or user["faculty_employee_id"] or user["worker_employee_id"],
        "designation": (fp_d.get("designation") if fp else None) or (wp_d.get("job_type") if wp else None) or user["faculty_designation"] or user["worker_designation"],
        "courses": fp_d.get("courses") if fp else None,
        "assigned_students": fp_d.get("assigned_students") if fp else None,
        "job_type": wp_d.get("job_type") if wp else None,
        "work_area": wp_d.get("work_area") if wp else None,
        "shift": wp_d.get("shift") if wp else None,
        "assigned_location": wp_d.get("location_name") if wp else None,
        "visitor_purpose": vp_d.get("visit_purpose") if vp else user["visitor_purpose"],
        "host_person": vp_d.get("host_person") if vp else None,
        "roles": combined_roles,
        "role_profiles": role_profiles,
        "locations": locations,
        "rfid_card": dict(rfid_card) if rfid_card else None,
        "student_hostel_status": student_status,
        "dashboard_path": dash["path"],
        "dashboard_name": dash["name"],
        "dashboard_category": dash["category"],
    }
    await redis_client.set(cache_key, data, ex=300)
    if claims.sub != str(user["id"]):
        await redis_client.set(f"user:me:{user['id']}", data, ex=300)
    return success_response(data=data)


@router.get("")
async def list_users(
    search: Optional[str] = Query(None),
    user_type: Optional[str] = Query(None),
    user_status: Optional[str] = Query(None, alias="status"),
    school: Optional[str] = Query(None),
    department: Optional[str] = Query(None),
    course: Optional[str] = Query(None),
    semester: Optional[str] = Query(None),
    hostel_id: Optional[str] = Query(None),
    hostel_status: Optional[str] = Query(None),
    role: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=2000),
    claims: Claims = Depends(require_permission("user:read")),
    conn: asyncpg.Connection = Depends(get_db),
):
    try:
        scoped_hostel_id = hostel_id
        scoped_hostel_ids = None
        scoped_user_type = user_type

        # Scope for Warden
        if claims.has_any_role("WARDEN") and not claims.has_any_role(*ADMIN_ROLES):
            warden_hostels = await resolve_warden_hostel_scope(conn, claims)
            if not warden_hostels:
                return success_response(data={"users": [], "total": 0, "page": page, "limit": limit, "total_pages": 1})
            if hostel_id and hostel_id.strip():
                try:
                    h_uuid = uuid.UUID(hostel_id.strip())
                    if h_uuid not in warden_hostels:
                        return success_response(data={"users": [], "total": 0, "page": page, "limit": limit, "total_pages": 1})
                except Exception:
                    return success_response(data={"users": [], "total": 0, "page": page, "limit": limit, "total_pages": 1})
            else:
                scoped_hostel_ids = warden_hostels
            if not scoped_user_type:
                scoped_user_type = "student"

        result = await user_service.list_users(
            conn=conn,
            search=search,
            user_type=scoped_user_type,
            status=user_status,
            school=school,
            department=department,
            course=course,
            semester=semester,
            hostel_id=scoped_hostel_id,
            hostel_ids=scoped_hostel_ids,
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


@router.patch("/{user_id}/status")
async def update_user_status(
    user_id: uuid.UUID,
    req: UpdateStatusRequest,
    conn: asyncpg.Connection = Depends(get_db),
    claims: Claims = Depends(require_permission("user:suspend")),
):
    try:
        await user_service.update_status(conn, actor_id=claims.sub, user_id=user_id, new_status=req.status, reason=req.reason or "")
        return success_response(message=f"user status updated to {req.status}")
    except ValueError as e:
        return error_response("STATUS_UPDATE_FAILED", str(e), status_code=status.HTTP_400_BAD_REQUEST)
    except Exception as e:
        logger.error("Update status failed: %s", e)
        return error_response("STATUS_UPDATE_FAILED", str(e), status_code=status.HTTP_500_INTERNAL_SERVER_ERROR)


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

@router.post("/bulk/transfer-hostel")
async def bulk_transfer_hostel(
    req: BulkTransferRequest,
    conn: asyncpg.Connection = Depends(get_db),
    claims: Claims = Depends(require_permission("user:update")),
):
    try:
        await user_service.bulk_transfer_hostel(conn, actor_id=claims.sub, user_ids=req.user_ids, new_hostel_id=req.new_hostel_id)
        return success_response(message="students transferred successfully")
    except Exception as e:
        return error_response("TRANSFER_FAILED", str(e), status_code=status.HTTP_500_INTERNAL_SERVER_ERROR)


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
