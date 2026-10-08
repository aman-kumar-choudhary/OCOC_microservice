import datetime
import uuid
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
import asyncpg
from app.core.database import get_db
from app.core.security import Claims, require_role, require_permission, resolve_warden_hostel_scope
from app.schemas.common import success_response, error_response
from app.schemas.hostel import (
    HostelDashboardStats, StudentHostelStatus, CreatePermissionRequest, 
    HostelPermission, MovementHistory, HostelAlert, EmergencyHeadcount,
    RFIDScanRequest, ScanResponse
)
from app.services.hostel_service import hostel_service
from app.services.hostel_rfid_service import hostel_rfid_service

router = APIRouter(prefix="/api/v1/hostel", tags=["hostel"])


class HostelAccessPolicyRequest(BaseModel):
    curfew_enabled: bool
    curfew_start: datetime.time
    curfew_end: datetime.time
    visitor_cutoff_enabled: bool
    visitor_cutoff: datetime.time


@router.get("/access-policy", response_model=Dict[str, Any])
async def get_access_policy(
    conn: asyncpg.Connection = Depends(get_db),
    claims: Claims = Depends(require_role("SUPER_ADMIN", "WARDEN")),
):
    """Return the campus gate timings managed from Hostel Management."""
    row = await conn.fetchrow("""
        SELECT curfew_enabled, curfew_start, curfew_end,
               visitor_cutoff_enabled, visitor_cutoff, updated_at
        FROM hostel_access_policy WHERE id = TRUE
    """)
    if not row:
        return success_response(data={
            "curfew_enabled": True, "curfew_start": "22:00",
            "curfew_end": "05:00", "visitor_cutoff_enabled": True,
            "visitor_cutoff": "17:00", "updated_at": None,
        })
    data = dict(row)
    for field in ("curfew_start", "curfew_end", "visitor_cutoff"):
        data[field] = data[field].strftime("%H:%M")
    data["updated_at"] = data["updated_at"].isoformat() if data["updated_at"] else None
    return success_response(data=data)


@router.put("/access-policy", response_model=Dict[str, Any])
async def update_access_policy(
    req: HostelAccessPolicyRequest,
    conn: asyncpg.Connection = Depends(get_db),
    claims: Claims = Depends(require_role("SUPER_ADMIN", "WARDEN")),
):
    """Allow wardens to configure curfew and visitor cut-off times."""
    actor_id = await conn.fetchval("SELECT id FROM users WHERE keycloak_user_id = $1", claims.sub)
    row = await conn.fetchrow("""
        INSERT INTO hostel_access_policy (
            id, curfew_enabled, curfew_start, curfew_end,
            visitor_cutoff_enabled, visitor_cutoff, updated_by, updated_at
        ) VALUES (TRUE, $1, $2, $3, $4, $5, $6, now())
        ON CONFLICT (id) DO UPDATE SET
            curfew_enabled = EXCLUDED.curfew_enabled,
            curfew_start = EXCLUDED.curfew_start,
            curfew_end = EXCLUDED.curfew_end,
            visitor_cutoff_enabled = EXCLUDED.visitor_cutoff_enabled,
            visitor_cutoff = EXCLUDED.visitor_cutoff,
            updated_by = EXCLUDED.updated_by,
            updated_at = now()
        RETURNING curfew_enabled, curfew_start, curfew_end,
                  visitor_cutoff_enabled, visitor_cutoff, updated_at
    """, req.curfew_enabled, req.curfew_start, req.curfew_end,
        req.visitor_cutoff_enabled, req.visitor_cutoff, actor_id)
    data = dict(row)
    for field in ("curfew_start", "curfew_end", "visitor_cutoff"):
        data[field] = data[field].strftime("%H:%M")
    data["updated_at"] = data["updated_at"].isoformat()
    return success_response(data=data, message="Hostel gate access policy updated")
@router.get("/assigned-hostels", response_model=Dict[str, Any])
async def get_assigned_hostels(
    conn: asyncpg.Connection = Depends(get_db),
    claims: Claims = Depends(require_role("SUPER_ADMIN", "WARDEN")),
):
    scope = await resolve_warden_hostel_scope(conn, claims)
    if scope is None:
        rows = await conn.fetch("SELECT id, name, code, capacity FROM hostels ORDER BY name")
    else:
        rows = await conn.fetch("SELECT id, name, code, capacity FROM hostels WHERE id = ANY($1::uuid[]) ORDER BY name", scope)
    return success_response(data=[dict(row) for row in rows])

@router.get("/wardens", response_model=Dict[str, Any])
async def list_wardens(
    conn: asyncpg.Connection = Depends(get_db),
    claims: Claims = Depends(require_role("SUPER_ADMIN", "ADMIN")),
):
    """Admin-only: list all users with role WARDEN and their assigned hostel details."""
    query = """
        SELECT 
            u.id,
            u.email,
            u.phone,
            u.status,
            u.created_at,
            COALESCE(fp.full_name, sp.full_name, wp.full_name, u.email) AS full_name,
            COALESCE(fp.employee_id, wp.employee_id) AS employee_id,
            wdp.hostel_block,
            wdp.responsibilities AS warden_responsibilities,
            wdp.emergency_contact,
            COALESCE(
                (
                    SELECT json_agg(
                        json_build_object(
                            'id', wh_h.id,
                            'name', wh_h.name,
                            'code', wh_h.code,
                            'capacity', wh_h.capacity
                        ) ORDER BY wh_h.name
                    )
                    FROM warden_hostels wh
                    JOIN hostels wh_h ON wh_h.id = wh.hostel_id
                    WHERE wh.user_id = u.id
                ),
                '[]'::json
            ) AS assigned_hostels
        FROM users u
        LEFT JOIN faculty_profiles fp ON fp.user_id = u.id
        LEFT JOIN student_profiles sp ON sp.user_id = u.id
        LEFT JOIN worker_profiles wp ON wp.user_id = u.id
        LEFT JOIN warden_profiles wdp ON wdp.user_id = u.id
        WHERE u.user_type = 'warden'
           OR EXISTS (
               SELECT 1 FROM user_roles ur 
               JOIN roles r ON r.id = ur.role_id 
               WHERE ur.user_id = u.id AND UPPER(r.name) = 'WARDEN'
           )
        ORDER BY full_name, u.email
    """
    rows = await conn.fetch(query)
    data = []
    for r in rows:
        d = dict(r)
        d["id"] = str(d["id"])
        if d.get("created_at"):
            d["created_at"] = d["created_at"].isoformat()
        if isinstance(d.get("assigned_hostels"), str):
            import json
            d["assigned_hostels"] = json.loads(d["assigned_hostels"])
        data.append(d)
    return success_response(data=data)

@router.get("/dashboard", response_model=Dict[str, Any])
async def get_dashboard(
    hostel_id: Optional[uuid.UUID] = None,
    conn: asyncpg.Connection = Depends(get_db),
    claims: Claims = Depends(require_role("SUPER_ADMIN", "WARDEN"))
):
    scope = await resolve_warden_hostel_scope(conn, claims, hostel_id)
    stats = await hostel_service.get_dashboard_stats(conn, hostel_id, scope)
    return success_response(data=stats.model_dump(mode='json'))

@router.get("/students/live", response_model=Dict[str, Any])
async def get_live_status(
    hostel_id: Optional[uuid.UUID] = None,
    conn: asyncpg.Connection = Depends(get_db),
    claims: Claims = Depends(require_role("SUPER_ADMIN", "WARDEN"))
):
    scope = await resolve_warden_hostel_scope(conn, claims, hostel_id)
    status_list = await hostel_service.get_live_status(conn, hostel_id, scope)
    return success_response(data=[s.model_dump(mode='json') for s in status_list])

@router.post("/permissions", response_model=Dict[str, Any])
async def grant_permission(
    req: CreatePermissionRequest,
    conn: asyncpg.Connection = Depends(get_db),
    claims: Claims = Depends(require_role("SUPER_ADMIN", "WARDEN"))
):
    try:
        import datetime
        if req.start_time.tzinfo is None:
            req.start_time = req.start_time.replace(tzinfo=datetime.timezone.utc)
        if req.end_time.tzinfo is None:
            req.end_time = req.end_time.replace(tzinfo=datetime.timezone.utc)

        # Resolve the local actor exclusively from the validated Keycloak subject.
        internal_user_id = await conn.fetchval("SELECT id FROM users WHERE keycloak_user_id = $1", claims.sub)
        student_hostel_id = await conn.fetchval("SELECT hostel_id FROM student_profiles WHERE user_id=$1", req.student_id)
        if student_hostel_id is None:
            raise HTTPException(status_code=404, detail="Student hostel assignment not found")
        await resolve_warden_hostel_scope(conn, claims, student_hostel_id)
        perm = await hostel_service.grant_permission(conn, internal_user_id, req)
        return success_response(data=perm.model_dump(mode='json'))
    except HTTPException:
        raise
    except Exception as e:
        import logging
        import traceback
        return error_response("GRANT_FAILED", str(e), status_code=400)

@router.delete("/permissions/{permission_id}", response_model=Dict[str, Any])
async def revoke_permission(
    permission_id: uuid.UUID,
    conn: asyncpg.Connection = Depends(get_db),
    claims: Claims = Depends(require_role("SUPER_ADMIN", "WARDEN"))
):
    permission_hostel_id = await conn.fetchval("SELECT sp.hostel_id FROM hostel_permissions hp JOIN student_profiles sp ON sp.user_id=hp.student_id WHERE hp.id=$1", permission_id)
    if permission_hostel_id is None:
        raise HTTPException(status_code=404, detail="Permission not found")
    await resolve_warden_hostel_scope(conn, claims, permission_hostel_id)
    await hostel_service.revoke_permission(conn, permission_id)
    return success_response(message="Permission revoked successfully")

@router.get("/permissions", response_model=Dict[str, Any])
async def list_permissions(
    student_id: Optional[uuid.UUID] = None,
    hostel_id: Optional[uuid.UUID] = None,
    conn: asyncpg.Connection = Depends(get_db),
    claims: Claims = Depends(require_role("SUPER_ADMIN", "WARDEN"))
):
    requested_hostel_id = hostel_id
    if student_id is not None:
        requested_hostel_id = await conn.fetchval("SELECT hostel_id FROM student_profiles WHERE user_id=$1", student_id)
    scope = await resolve_warden_hostel_scope(conn, claims, requested_hostel_id)
    perms = await hostel_service.get_permissions(conn, student_id, hostel_id, scope)
    return success_response(data=[p.model_dump(mode='json') for p in perms])

@router.get("/movement", response_model=Dict[str, Any])
async def get_movement_history(
    hostel_id: Optional[uuid.UUID] = None,
    conn: asyncpg.Connection = Depends(get_db),
    claims: Claims = Depends(require_role("SUPER_ADMIN", "WARDEN"))
):
    scope = await resolve_warden_hostel_scope(conn, claims, hostel_id)
    history = await hostel_service.get_movement_history(conn, hostel_id, scope)
    return success_response(data=[m.model_dump(mode='json') for m in history])

@router.get("/alerts", response_model=Dict[str, Any])
async def get_alerts(
    hostel_id: Optional[uuid.UUID] = None,
    conn: asyncpg.Connection = Depends(get_db),
    claims: Claims = Depends(require_role("SUPER_ADMIN", "WARDEN"))
):
    scope = await resolve_warden_hostel_scope(conn, claims, hostel_id)
    alerts = await hostel_service.get_alerts(conn, hostel_id, scope)
    return success_response(data=[a.model_dump(mode='json') for a in alerts])

@router.get("/emergency-headcount", response_model=Dict[str, Any])
async def get_emergency_headcount(
    hostel_id: Optional[uuid.UUID] = None,
    conn: asyncpg.Connection = Depends(get_db),
    claims: Claims = Depends(require_role("SUPER_ADMIN", "WARDEN"))
):
    scope = await resolve_warden_hostel_scope(conn, claims, hostel_id)
    headcount = await hostel_service.get_emergency_headcount(conn, hostel_id, scope)
    return success_response(data=headcount.model_dump(mode='json'))

# --- Hardware Integration Point ---
@router.post("/rfid/scan", response_model=Dict[str, Any])
async def handle_rfid_scan(
    req: RFIDScanRequest,
    conn: asyncpg.Connection = Depends(get_db)
):
    """
    Called by the RFID hardware reader when a card is scanned.
    No auth required for this specific endpoint (in a real system, would use a hardware token or mTLS).
    """
    try:
        result = await hostel_rfid_service.handle_scan(conn, req.uid, req.reader_id)
        if result.success:
            return success_response(data=result.model_dump(mode='json'))
        else:
            return error_response(result.reason, result.message, status_code=403, details=result.model_dump(mode='json'))
    except Exception as e:
        return error_response("SCAN_ERROR", str(e), status_code=500)
