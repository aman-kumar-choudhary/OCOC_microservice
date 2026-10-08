from typing import List, Dict, Any, Optional
import uuid
import datetime
from fastapi import APIRouter, Depends, HTTPException, Query, status
from app.schemas.access import (
    AccessRule, CreateAccessRuleRequest, UpdateAccessRuleRequest,
    TemporaryAccessGrant, CreateTemporaryAccessRequest, AccessEvent,
    EvaluateAccessRequest, Location, RFIDAccessScanRequest, FaceVerificationRequest,
    AccessGroup, CreateAccessGroupRequest, AddAccessGroupMemberRequest, UpdateUserAccessRequest,
    ResetCredentialsRequest, BulkLocationGrantsRequest,
    # Enhanced schemas
    CreateLocationGrantRequest, UpdateLocationGrantRequest,
    GuardManualMovementRequest, GuardVisitorRegisterRequest, AssignGuardDutyRequest,
    SecurityCommandRequest,
)
from app.services.access_service import access_service
from app.services.hostel_service import hostel_service
from app.core.security import Claims, get_current_claims, require_permission, require_role, ADMIN_ROLES, resolve_user_location_scope, ensure_local_user
from app.core.database import get_db
from app.services.role_service import role_service
from app.services.audit_service import audit_service
from app.routers.ws import manager
import asyncpg
router = APIRouter(prefix="/api/v1/access", tags=["access_management"])
# ── Operational role, Keycloak Sync & Credential Management ───────────────────

@router.get("/users/{user_id}/access", response_model=Dict[str, Any])
async def get_user_access_configuration(
    user_id: uuid.UUID,
    conn: asyncpg.Connection = Depends(get_db),
    claims: Claims = Depends(require_role("SUPER_ADMIN", "ADMIN")),
):
    try:
        return {"success": True, "data": await role_service.get_user_access(conn, user_id)}
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))

@router.put("/users/{user_id}/access", response_model=Dict[str, Any])
async def update_user_access_configuration(
    user_id: uuid.UUID,
    req: UpdateUserAccessRequest,
    conn: asyncpg.Connection = Depends(get_db),
    claims: Claims = Depends(require_role("SUPER_ADMIN", "ADMIN")),
):
    try:
        access = await role_service.update_user_access(
            conn=conn,
            actor_id=claims.sub,
            user_id=user_id,
            role_names=req.roles,
            hostel_ids=req.hostel_ids,
            location_ids=req.location_ids,
            issue_password=bool(req.issue_password),
            custom_password=req.custom_password,
        )
        return {"success": True, "data": access}
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

@router.put("/users/{user_id}/locations", response_model=Dict[str, Any])
async def update_user_locations(
    user_id: uuid.UUID,
    req: BulkLocationGrantsRequest,
    conn: asyncpg.Connection = Depends(get_db),
    claims: Claims = Depends(require_role("SUPER_ADMIN", "ADMIN", "SECURITY_ADMIN")),
):
    """Synchronize user location grants from checkbox selection."""
    admin_id = await _resolve_actor_user_id(conn, claims)
    try:
        grants = await access_service.sync_user_location_grants(
            conn=conn,
            user_id=user_id,
            location_ids=req.location_ids,
            access_level=req.access_level,
            admin_id=admin_id,
            reason=req.reason,
        )
        return {"success": True, "data": grants}
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

@router.post("/users/{user_id}/credentials", response_model=Dict[str, Any])
async def issue_user_credentials(
    user_id: uuid.UUID,
    req: ResetCredentialsRequest = ResetCredentialsRequest(),
    conn: asyncpg.Connection = Depends(get_db),
    claims: Claims = Depends(require_role("SUPER_ADMIN", "ADMIN")),
):
    """Generate or reset Keycloak login credentials and return role/dashboard routing details."""
    try:
        creds = await role_service.issue_or_reset_credentials(
            conn=conn,
            actor_id=claims.sub,
            user_id=user_id,
            custom_password=req.custom_password,
        )
        return {"success": True, "data": creds}
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

# ── Locations ────────────────────────────────────────────────────────────

@router.get("/locations", response_model=Dict[str, Any])
async def list_locations(conn: asyncpg.Connection = Depends(get_db), claims: Claims = Depends(get_current_claims)):
    locs = await access_service.get_locations(conn)
    return {"success": True, "data": locs}

@router.get("/groups", response_model=Dict[str, Any])
async def list_groups(conn: asyncpg.Connection = Depends(get_db), claims: Claims = Depends(require_permission("access.rule.read"))):
    return {"success": True, "data": await access_service.get_groups(conn)}

@router.post("/groups", response_model=Dict[str, Any])
async def create_group(req: CreateAccessGroupRequest, conn: asyncpg.Connection = Depends(get_db), claims: Claims = Depends(require_permission("access.rule.manage"))):
    return {"success": True, "data": await access_service.create_group(conn, req)}

@router.put("/groups/{group_id}/members", response_model=Dict[str, Any])
async def add_group_member(group_id: uuid.UUID, req: AddAccessGroupMemberRequest, conn: asyncpg.Connection = Depends(get_db), claims: Claims = Depends(require_permission("access.rule.manage"))):
    await access_service.add_group_member(conn, group_id, req.user_id)
    return {"success": True}

# ── Access Rules ──────────────────────────────────────────────────────────

@router.get("/rules", response_model=Dict[str, Any])
async def list_rules(conn: asyncpg.Connection = Depends(get_db), claims: Claims = Depends(require_permission("access.rule.read"))):
    rules = await access_service.get_rules(conn)
    return {"success": True, "data": rules}

@router.post("/rules", response_model=Dict[str, Any])
async def create_rule(req: CreateAccessRuleRequest, conn: asyncpg.Connection = Depends(get_db), claims: Claims = Depends(require_permission("access.rule.manage"))):
    rule = await access_service.create_rule(conn, req)
    return {"success": True, "data": rule}

@router.patch("/rules/{rule_id}", response_model=Dict[str, Any])
async def update_rule(rule_id: uuid.UUID, req: UpdateAccessRuleRequest, conn: asyncpg.Connection = Depends(get_db), claims: Claims = Depends(require_permission("access.rule.manage"))):
    rule = await access_service.update_rule(conn, rule_id, req)
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")
    return {"success": True, "data": rule}

# ── Temporary Access ──────────────────────────────────────────────────────

@router.get("/temporary-grants", response_model=Dict[str, Any])
async def list_temporary_grants(conn: asyncpg.Connection = Depends(get_db), claims: Claims = Depends(require_permission("access.grant.temporary"))):
    grants = await access_service.get_temporary_grants(conn)
    return {"success": True, "data": grants}

@router.post("/temporary-grants", response_model=Dict[str, Any])
async def create_temporary_grant(req: CreateTemporaryAccessRequest, conn: asyncpg.Connection = Depends(get_db), claims: Claims = Depends(require_permission("access.grant.temporary"))):
    admin_id = await conn.fetchval(
        "SELECT id FROM users WHERE keycloak_user_id = $1 OR (email IS NOT NULL AND LOWER(email) = LOWER($2)) ORDER BY CASE WHEN keycloak_user_id = $1 THEN 0 ELSE 1 END LIMIT 1",
        str(claims.sub),
        str(claims.email or claims.preferred_username or ""),
    )
    if not admin_id:
        try:
            admin_id = await conn.fetchval("SELECT id FROM users WHERE id = $1", uuid.UUID(claims.sub))
        except (ValueError, AttributeError):
            pass

    if not admin_id:
        from fastapi.responses import JSONResponse
        return JSONResponse(status_code=400, content={"success": False, "error": {"code": "INVALID_ACTOR", "message": "Actor account has no local user record in database"}})

    grant = await access_service.create_temporary_grant(conn, req, admin_id)
    return {"success": True, "data": grant}


# ── Evaluation Engine (Simulate Access) ───────────────────────────────────

@router.post("/evaluate", response_model=Dict[str, Any])
async def evaluate_access(req: EvaluateAccessRequest, conn: asyncpg.Connection = Depends(get_db), claims: Claims = Depends(require_permission("gate.review.manual"))):
    if not claims.has_any_role(*ADMIN_ROLES):
        await resolve_user_location_scope(conn, claims, required_level="ENTRY", requested_location_id=req.location_id)
    event = await access_service.evaluate_access(conn, req.user_id, req.location_id, req.action, reader_id=req.reader_id, device_id=req.device_id, face_confidence=req.face_confidence)
    return {"success": True, "data": event}

# ── Access Events / Alerts ────────────────────────────────────────────────

@router.get("/guard/hostel-leaves", response_model=Dict[str, Any])
async def guard_hostel_leaves(
    conn: asyncpg.Connection = Depends(get_db),
    claims: Claims = Depends(require_permission("guard.console.read")),
):
    """Approved hostel permissions and students currently outside for guards."""
    return {"success": True, "data": await hostel_service.get_guard_leave_monitor(conn)}

@router.get("/events", response_model=Dict[str, Any])
async def list_events(limit: int = 50, only_denied: bool = False, user_id: Optional[uuid.UUID] = None, conn: asyncpg.Connection = Depends(get_db), claims: Claims = Depends(require_permission("access.rule.read"))):
    events = await access_service.get_events(conn, limit, only_denied, user_id)
    return {"success": True, "data": events}

@router.get("/rules/stats", response_model=Dict[str, Any])
async def rule_stats(conn: asyncpg.Connection = Depends(get_db), claims: Claims = Depends(require_permission("access.rule.read"))):
    return {"success": True, "data": await access_service.get_rule_stats(conn)}

@router.get("/devices", response_model=Dict[str, Any])
async def access_devices(conn: asyncpg.Connection = Depends(get_db), claims: Claims = Depends(require_permission("access.rule.read"))):
    return {"success": True, "data": await access_service.get_devices(conn)}

@router.get("/occupancy", response_model=Dict[str, Any])
async def occupancy(location_id: Optional[uuid.UUID] = None, conn: asyncpg.Connection = Depends(get_db), claims: Claims = Depends(require_permission("access.occupancy.view"))):
    return {"success": True, "data": await access_service.get_occupancy(conn, location_id)}

@router.post("/scan", response_model=Dict[str, Any])
async def scan_access(req: RFIDAccessScanRequest, conn: asyncpg.Connection = Depends(get_db), claims: Claims = Depends(require_permission("gate.review.manual"))):
    if not claims.has_any_role(*ADMIN_ROLES):
        location_id = req.location_id
        if not location_id and req.device_id:
            location_id = await conn.fetchval(
                "SELECT location_id FROM devices WHERE id = $1",
                req.device_id,
            )
        if not location_id and req.reader_id:
            location_id = await conn.fetchval(
                """SELECT hg.hostel_id FROM rfid_readers rr
                   JOIN hostel_gates hg ON hg.id = rr.gate_id
                   WHERE rr.id = $1""",
                req.reader_id,
            )
        if not location_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={"code": "LOCATION_SCOPE_FORBIDDEN", "message": "scan location could not be resolved"},
            )
        await resolve_user_location_scope(
            conn, claims, required_level="ENTRY", requested_location_id=location_id
        )
    event = await access_service.evaluate_rfid_scan(conn, req.uid, req.location_id, req.action, req.reader_id, req.device_id, req.face_confidence)
    return {"success": True, "data": event}

@router.post("/verify-face", response_model=Dict[str, Any])
async def verify_gate_face(req: FaceVerificationRequest, conn: asyncpg.Connection = Depends(get_db), claims: Claims = Depends(require_permission("gate.review.manual"))):
    event = await access_service.verify_face(conn, req.verification_id, req.user_id, req.matched, req.face_confidence, req.reason)
    return {"success": True, "data": event}


# ══════════════════════════════════════════════════════════════════════════════
# Enhanced Access Management — User Search, Grants, Location Tree
# ══════════════════════════════════════════════════════════════════════════════


@router.get("/manage/users", response_model=Dict[str, Any])
async def search_access_users(
    search: Optional[str] = Query(None, description="Search by name, email, ID, phone"),
    user_type: Optional[str] = Query(None),
    role: Optional[str] = Query(None),
    school: Optional[str] = Query(None),
    department: Optional[str] = Query(None),
    course: Optional[str] = Query(None),
    semester: Optional[str] = Query(None),
    hostel: Optional[str] = Query(None),
    designation: Optional[str] = Query(None),
    job_type: Optional[str] = Query(None),
    work_area: Optional[str] = Query(None),
    shift: Optional[str] = Query(None),
    visit_purpose: Optional[str] = Query(None),
    host_person: Optional[str] = Query(None),
    campus: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    access_filter: Optional[str] = Query(None, description="no_access | partial | full"),
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=50),
    conn: asyncpg.Connection = Depends(get_db),
    claims: Claims = Depends(require_role("SUPER_ADMIN", "ADMIN", "SECURITY_ADMIN")),
):
    """Server-side paginated user search for the access management panel."""
    result = await access_service.search_access_users(
        conn, search=search, user_type=user_type, role=role,
        school=school, department=department, course=course, semester=semester,
        hostel=hostel, designation=designation, job_type=job_type,
        work_area=work_area, shift=shift, visit_purpose=visit_purpose,
        host_person=host_person, campus=campus, status=status,
        access_filter=access_filter, page=page, page_size=page_size,
    )
    return {"success": True, "data": result}


@router.get("/manage/users/{user_id}", response_model=Dict[str, Any])
async def get_access_user_detail(
    user_id: uuid.UUID,
    conn: asyncpg.Connection = Depends(get_db),
    claims: Claims = Depends(require_role("SUPER_ADMIN", "ADMIN", "SECURITY_ADMIN")),
):
    """Detailed user info with roles, location grants, and temporary grants."""
    try:
        detail = await access_service.get_user_access_detail(conn, user_id)
        return {"success": True, "data": detail}
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))


@router.get("/manage/users/{user_id}/permissions", response_model=Dict[str, Any])
async def get_user_effective_permissions(
    user_id: uuid.UUID,
    conn: asyncpg.Connection = Depends(get_db),
    claims: Claims = Depends(require_role("SUPER_ADMIN", "ADMIN", "SECURITY_ADMIN")),
):
    """Compute effective permissions including hierarchy inheritance."""
    perms = await access_service.get_user_effective_permissions(conn, user_id)
    return {"success": True, "data": perms}


@router.get("/locations/tree", response_model=Dict[str, Any])
async def get_location_tree(
    conn: asyncpg.Connection = Depends(get_db),
    claims: Claims = Depends(get_current_claims),
):
    """Hierarchical location tree."""
    tree = await access_service.get_location_tree(conn)
    return {"success": True, "data": tree}


async def _resolve_actor_user_id(conn: asyncpg.Connection, claims: Claims) -> Optional[uuid.UUID]:
    if not claims or not claims.sub:
        return None
    try:
        return await ensure_local_user(conn, claims)
    except Exception:
        return None


@router.post("/grants", response_model=Dict[str, Any])
async def create_location_grant(
    req: CreateLocationGrantRequest,
    conn: asyncpg.Connection = Depends(get_db),
    claims: Claims = Depends(require_role("SUPER_ADMIN", "ADMIN", "SECURITY_ADMIN")),
):
    """Create a new location access grant."""
    admin_id = await _resolve_actor_user_id(conn, claims)
    try:
        grant = await access_service.create_location_grant(conn, req, admin_id)
        return {"success": True, "data": grant}
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.put("/grants/{grant_id}", response_model=Dict[str, Any])
async def update_location_grant(
    grant_id: uuid.UUID,
    req: UpdateLocationGrantRequest,
    conn: asyncpg.Connection = Depends(get_db),
    claims: Claims = Depends(require_role("SUPER_ADMIN", "ADMIN", "SECURITY_ADMIN")),
):
    """Update an existing location access grant."""
    admin_id = await _resolve_actor_user_id(conn, claims)
    try:
        grant = await access_service.update_location_grant(conn, grant_id, req, admin_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    if not grant:
        raise HTTPException(status_code=404, detail="Grant not found")
    return {"success": True, "data": grant}


@router.delete("/grants/{grant_id}", response_model=Dict[str, Any])
async def revoke_location_grant(
    grant_id: uuid.UUID,
    conn: asyncpg.Connection = Depends(get_db),
    claims: Claims = Depends(require_role("SUPER_ADMIN", "ADMIN", "SECURITY_ADMIN")),
):
    """Revoke a location access grant."""
    admin_id = await _resolve_actor_user_id(conn, claims)
    revoked = await access_service.revoke_location_grant(conn, grant_id, admin_id)
    if not revoked:
        raise HTTPException(status_code=404, detail="Grant not found")
    return {"success": True, "data": {"revoked": True}}


@router.get("/audit-logs", response_model=Dict[str, Any])
async def get_access_audit_logs(
    user_id: Optional[uuid.UUID] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    conn: asyncpg.Connection = Depends(get_db),
    claims: Claims = Depends(require_role("SUPER_ADMIN", "ADMIN", "SECURITY_ADMIN")),
):
    """Access-management-specific audit logs."""
    result = await access_service.get_access_audit_logs(
        conn, user_id=user_id, page=page, page_size=page_size,
    )
    return {"success": True, "data": result}


# ══════════════════════════════════════════════════════════════════════════════
# Dedicated Guard Console Operations & Visitor Desk
# ══════════════════════════════════════════════════════════════════════════════

@router.post("/guard/movement", response_model=Dict[str, Any])
async def guard_record_movement(
    req: GuardManualMovementRequest,
    conn: asyncpg.Connection = Depends(get_db),
    claims: Claims = Depends(require_role("SUPER_ADMIN", "ADMIN", "SECURITY_ADMIN", "GUARD", "SECURITY_GUARD")),
):
    """Record student gate entry or exit directly from the Guard Console."""
    now = datetime.datetime.now(datetime.timezone.utc)
    raw_action = req.action.upper()
    direction = "OUT" if raw_action in ("OUT", "EXIT") else "IN"
    action_label = "EXIT" if direction == "OUT" else "ENTRY"

    student = await conn.fetchrow("""
        SELECT sp.user_id, sp.full_name, sp.roll_number, sp.hostel_id, h.name as hostel_name
        FROM student_profiles sp
        LEFT JOIN hostels h ON h.id = sp.hostel_id
        WHERE sp.user_id = $1
    """, req.student_id)
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    # Fetch active leave or hostel permission
    perm = await conn.fetchrow("""
        SELECT hp.id, hp.start_time, hp.end_time, hp.permission_type, hp.reason
        FROM hostel_permissions hp
        WHERE hp.student_id = $1 AND hp.status IN ('ACTIVE', 'APPROVED')
        ORDER BY hp.end_time DESC LIMIT 1
    """, req.student_id)

    if not perm:
        lr = await conn.fetchrow("""
            SELECT r.id, r.start_at as start_time, r.end_at as end_time, t.name as permission_type, r.reason
            FROM leave_requests r
            JOIN leave_types t ON t.id = r.leave_type_id
            WHERE r.student_id = $1 AND r.status IN ('APPROVED', 'ACTIVE')
            ORDER BY r.end_at DESC LIMIT 1
        """, req.student_id)
        if lr:
            perm = lr

    # Determine status & timeliness
    late_early_status = "ON_TIME"
    diff_minutes = 0

    if perm:
        start_time = perm["start_time"]
        end_time = perm["end_time"]
        if start_time and start_time.tzinfo is None:
            start_time = start_time.replace(tzinfo=datetime.timezone.utc)
        if end_time and end_time.tzinfo is None:
            end_time = end_time.replace(tzinfo=datetime.timezone.utc)

        if direction == "OUT":
            if now < start_time:
                diff_minutes = int((start_time - now).total_seconds() / 60)
                late_early_status = f"EARLY_EXIT ({diff_minutes}m early)"
            else:
                late_early_status = "ON_TIME_EXIT"
            new_student_status = "ON_LEAVE"
        else: # direction == "IN"
            if now > end_time:
                diff_minutes = int((now - end_time).total_seconds() / 60)
                late_early_status = f"LATE_RETURN ({diff_minutes}m late)"
            elif now < start_time:
                diff_minutes = int((start_time - now).total_seconds() / 60)
                late_early_status = f"EARLY_RETURN ({diff_minutes}m early)"
            else:
                late_early_status = "ON_TIME_ENTRY"
            new_student_status = "INSIDE"
    else:
        new_student_status = "OUTSIDE" if direction == "OUT" else "INSIDE"
        late_early_status = "NO_ACTIVE_LEAVE"

    reason_str = req.reason or late_early_status

    # Record in hostel_movement
    movement_id = await conn.fetchval("""
        INSERT INTO hostel_movement (
            student_id, event_type, status, reason, permission_id, event_time
        ) VALUES ($1, $2, 'ALLOWED', $3, $4, $5)
        RETURNING id
    """, req.student_id, direction, reason_str, perm["id"] if perm else None, now)

    # Update or insert student_hostel_status
    await conn.execute("""
        INSERT INTO student_hostel_status (
            student_id, current_status, last_movement_id, last_event_time, active_permission_id, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (student_id) DO UPDATE SET
            current_status = EXCLUDED.current_status,
            last_movement_id = EXCLUDED.last_movement_id,
            last_event_time = EXCLUDED.last_event_time,
            active_permission_id = EXCLUDED.active_permission_id,
            updated_at = EXCLUDED.updated_at
    """, req.student_id, new_student_status, movement_id, now, perm["id"] if perm else None, now)

    # Log in access_events for live turnstile stream
    event_id = await conn.fetchval("""
        INSERT INTO access_events (
            user_id, action, status, reason, event_time
        ) VALUES ($1, $2, 'GRANTED', $3, $4)
        RETURNING id
    """, req.student_id, action_label, f"Manual Guard Check: {reason_str}", now)

    # Broadcast WebSocket update
    event_payload = {
        "id": str(event_id),
        "user_id": str(req.student_id),
        "user_name": student["full_name"],
        "user_identifier": student["roll_number"] or student["full_name"],
        "action": action_label,
        "location_name": req.gate_name or "Main Campus Gate",
        "status": "GRANTED",
        "reason": reason_str,
        "event_time": now.isoformat(),
    }

    try:
        await manager.broadcast({"type": "ACCESS_EVENT", "data": event_payload})
        await manager.broadcast({"type": "HOSTEL_STATUS_UPDATED", "data": {"student_id": str(req.student_id), "status": new_student_status}})
    except Exception:
        pass

    return {
        "success": True,
        "data": {
            "movement_id": str(movement_id),
            "student_id": str(req.student_id),
            "student_name": student["full_name"],
            "action": action_label,
            "direction": direction,
            "current_status": new_student_status,
            "timeliness_status": late_early_status,
            "timestamp": now.isoformat(),
            "gate_name": req.gate_name or "Main Campus Gate",
        },
        "message": f"Successfully recorded {action_label} for {student['full_name']} ({late_early_status})"
    }


@router.post("/guard/visitor", response_model=Dict[str, Any])
async def guard_register_visitor(
    req: GuardVisitorRegisterRequest,
    conn: asyncpg.Connection = Depends(get_db),
    claims: Claims = Depends(require_role("SUPER_ADMIN", "ADMIN", "SECURITY_ADMIN", "GUARD", "SECURITY_GUARD")),
):
    """Guard registers a visitor with Day Pass (5 AM - 5 PM) or Special Function ID card."""
    now = datetime.datetime.now(datetime.timezone.utc)
    ist_tz = datetime.timezone(datetime.timedelta(hours=5, minutes=30))
    now_ist = now.astimezone(ist_tz)

    pass_number = f"DSVV-VP-{now_ist.strftime('%Y%m%d')}-{uuid.uuid4().hex[:4].upper()}"

    # Calculate validity
    if req.pass_type == "TEMPORARY_DAY":
        policy = await conn.fetchrow("""
            SELECT visitor_cutoff_enabled, visitor_cutoff
            FROM hostel_access_policy WHERE id = TRUE
        """)
        # Day passes begin at 05:00 AM and end at the Warden-configured
        # departure cut-off (05:00 PM by default).
        visitor_cutoff = policy["visitor_cutoff"] if policy and policy["visitor_cutoff_enabled"] else datetime.time(17, 0)
        v_start_ist = now_ist.replace(hour=5, minute=0, second=0, microsecond=0)
        v_end_ist = now_ist.replace(
            hour=visitor_cutoff.hour, minute=visitor_cutoff.minute,
            second=0, microsecond=0,
        )
        valid_from = v_start_ist.astimezone(datetime.timezone.utc)
        valid_until = v_end_ist.astimezone(datetime.timezone.utc)
    else:
        # Long-term / Special function pass
        valid_from = req.valid_from or now
        if valid_from.tzinfo is None:
            valid_from = valid_from.replace(tzinfo=datetime.timezone.utc)
        valid_until = req.valid_until or (valid_from + datetime.timedelta(days=7))
        if valid_until.tzinfo is None:
            valid_until = valid_until.replace(tzinfo=datetime.timezone.utc)

    # Find or create visitor user record
    email = req.email or f"guest.{uuid.uuid4().hex[:6]}@visitor.ococ.org"
    existing_user = await conn.fetchrow(
        "SELECT id FROM users WHERE phone = $1 OR LOWER(email) = LOWER($2) LIMIT 1",
        req.phone, email
    )
    if existing_user:
        user_id = existing_user["id"]
    else:
        user_id = await conn.fetchval("""
            INSERT INTO users (user_type, status, email, phone, created_at, updated_at)
            VALUES ('visitor', 'active', $1, $2, now(), now())
            RETURNING id
        """, email, req.phone)

    # Ensure role is assigned
    v_role_id = await conn.fetchval("SELECT id FROM roles WHERE name = 'VISITOR' LIMIT 1")
    if v_role_id:
        await conn.execute("""
            INSERT INTO user_roles (user_id, role_id)
            VALUES ($1, $2) ON CONFLICT DO NOTHING
        """, user_id, v_role_id)

    # Insert or update visitor profile
    days = max(1, int((valid_until - valid_from).total_seconds() / 86400))
    acc_count = max(0, req.accompanying_count or 0)
    acc_details = (req.accompanying_details or "").strip()
    total_persons = acc_count + 1

    await conn.execute("""
        INSERT INTO visitor_profiles (
            user_id, full_name, gov_id_type, gov_id_number, visit_purpose,
            host_person, host_contact, visit_start, visit_duration_days,
            valid_until, accompanying_count, accompanying_details, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, now())
        ON CONFLICT (user_id) DO UPDATE SET
            full_name = EXCLUDED.full_name,
            gov_id_type = COALESCE(EXCLUDED.gov_id_type, visitor_profiles.gov_id_type),
            gov_id_number = COALESCE(EXCLUDED.gov_id_number, visitor_profiles.gov_id_number),
            visit_purpose = EXCLUDED.visit_purpose,
            host_person = EXCLUDED.host_person,
            host_contact = EXCLUDED.host_contact,
            visit_start = EXCLUDED.visit_start,
            visit_duration_days = EXCLUDED.visit_duration_days,
            valid_until = EXCLUDED.valid_until,
            accompanying_count = EXCLUDED.accompanying_count,
            accompanying_details = EXCLUDED.accompanying_details,
            updated_at = now()
    """, user_id, req.full_name, req.gov_id_type, req.gov_id_number, req.visit_purpose,
       req.host_person, req.host_contact, valid_from, days, valid_until, acc_count, acc_details)

    # Handle Assigned RFID / ID Card UID if provided
    card_assigned = False
    card_uid_clean = None
    if req.assigned_card_uid and req.assigned_card_uid.strip():
        card_uid_clean = req.assigned_card_uid.strip().replace(":", "").replace("-", "").upper()
        # Insert or activate card
        card_id = await conn.fetchval("""
            INSERT INTO rfid_cards (uid, status, created_at, updated_at)
            VALUES ($1, 'active', now(), now())
            ON CONFLICT (uid) DO UPDATE SET status = 'active', updated_at = now()
            RETURNING id
        """, card_uid_clean)
        # Link card to visitor
        await conn.execute("""
            INSERT INTO user_rfid_cards (user_id, rfid_card_id, assigned_at)
            VALUES ($1, $2, now())
            ON CONFLICT (rfid_card_id) DO UPDATE SET user_id = EXCLUDED.user_id, unassigned_at = NULL
        """, user_id, card_id)
        card_assigned = True

    # Log visitor ENTRY event
    entry_desc = f"Visitor Onboarded ({req.pass_type}) - Total {total_persons} person{'s' if total_persons > 1 else ''}"
    await conn.fetchval("""
        INSERT INTO access_events (
            user_id, action, status, reason, event_time
        ) VALUES ($1, 'ENTRY', 'GRANTED', $2, $3)
        RETURNING id
    """, user_id, entry_desc, now)

    # Broadcast visitor arrival
    try:
        await manager.broadcast({
            "type": "ACCESS_EVENT",
            "data": {
                "id": str(uuid.uuid4()),
                "user_id": str(user_id),
                "user_name": req.full_name,
                "user_identifier": pass_number,
                "action": "ENTRY",
                "location_name": "Main Visitor Checkpoint",
                "status": "GRANTED",
                "reason": f"Visitor Pass Issued: {req.visit_purpose} ({total_persons} pers.)",
                "event_time": now.isoformat(),
            }
        })
    except Exception:
        pass

    return {
        "success": True,
        "data": {
            "visitor_id": str(user_id),
            "pass_number": pass_number,
            "full_name": req.full_name,
            "phone": req.phone,
            "email": email,
            "pass_type": req.pass_type,
            "pass_type_label": "Temporary Day Pass (5:00 AM – 5:00 PM IST)" if req.pass_type == "TEMPORARY_DAY" else "Special Function ID Card Pass",
            "visit_purpose": req.visit_purpose,
            "host_person": req.host_person,
            "host_contact": req.host_contact or "—",
            "gov_id_type": req.gov_id_type or "—",
            "gov_id_number": req.gov_id_number or "—",
            "valid_from": valid_from.isoformat(),
            "valid_until": valid_until.isoformat(),
            "valid_from_ist": valid_from.astimezone(ist_tz).strftime("%d-%m-%Y, %I:%M %p IST"),
            "valid_until_ist": valid_until.astimezone(ist_tz).strftime("%d-%m-%Y, %I:%M %p IST"),
            "assigned_card_uid": card_uid_clean,
            "card_assigned": card_assigned,
            "event_name": req.event_name or req.visit_purpose,
            "accompanying_count": acc_count,
            "accompanying_details": acc_details,
            "total_persons": total_persons,
            "status": "ACTIVE_ON_CAMPUS",
            "issued_by": claims.preferred_username or claims.email or "Campus Guard Console",
            "issued_at_ist": now_ist.strftime("%d-%m-%Y, %I:%M %p IST"),
        },
        "message": f"Visitor pass {pass_number} successfully generated."
    }


@router.get("/guard/visitors", response_model=Dict[str, Any])
async def guard_list_visitors(
    limit: int = 50,
    conn: asyncpg.Connection = Depends(get_db),
    claims: Claims = Depends(require_role("SUPER_ADMIN", "ADMIN", "SECURITY_ADMIN", "GUARD", "SECURITY_GUARD")),
):
    """List recent visitors registered on campus for Guard Console inspection."""
    ist_tz = datetime.timezone(datetime.timedelta(hours=5, minutes=30))
    rows = await conn.fetch("""
        SELECT
            u.id as visitor_id,
            vp.full_name,
            u.phone,
            u.email,
            vp.gov_id_type,
            vp.gov_id_number,
            vp.visit_purpose,
            vp.host_person,
            vp.host_contact,
            vp.visit_start as valid_from,
            vp.valid_until,
            COALESCE(vp.accompanying_count, 0) as accompanying_count,
            COALESCE(vp.accompanying_details, '') as accompanying_details,
            rc.uid as card_uid,
            u.created_at,
            COALESCE(
                (SELECT action FROM access_events WHERE user_id = u.id ORDER BY event_time DESC LIMIT 1),
                'ENTRY'
            ) as last_action,
            (SELECT event_time FROM access_events WHERE user_id = u.id ORDER BY event_time DESC LIMIT 1) as last_event_time
        FROM users u
        JOIN visitor_profiles vp ON vp.user_id = u.id
        LEFT JOIN user_rfid_cards urc ON urc.user_id = u.id AND urc.unassigned_at IS NULL
        LEFT JOIN rfid_cards rc ON rc.id = urc.rfid_card_id
        WHERE u.user_type = 'visitor'
        ORDER BY u.created_at DESC
        LIMIT $1
    """, limit)

    result = []
    now = datetime.datetime.now(datetime.timezone.utc)
    for r in rows:
        v_from = r["valid_from"]
        if v_from and v_from.tzinfo is None:
            v_from = v_from.replace(tzinfo=datetime.timezone.utc)

        v_until = r["valid_until"]
        if v_until and v_until.tzinfo is None:
            v_until = v_until.replace(tzinfo=datetime.timezone.utc)

        c_at = r["created_at"]
        if c_at and c_at.tzinfo is None:
            c_at = c_at.replace(tzinfo=datetime.timezone.utc)

        is_expired = bool(v_until and now > v_until)
        is_inside = r["last_action"] == "ENTRY"
        acc_cnt = int(r["accompanying_count"] or 0)
        acc_det = str(r["accompanying_details"] or "")

        result.append({
            "visitor_id": str(r["visitor_id"]),
            "full_name": r["full_name"],
            "phone": r["phone"],
            "email": r["email"],
            "gov_id_type": r["gov_id_type"] or "ID Proof",
            "gov_id_number": r["gov_id_number"] or "—",
            "visit_purpose": r["visit_purpose"],
            "host_person": r["host_person"],
            "host_contact": r["host_contact"] or "—",
            "card_uid": r["card_uid"],
            "valid_from": v_from.isoformat() if v_from else None,
            "valid_until": v_until.isoformat() if v_until else None,
            "valid_until_ist": v_until.astimezone(ist_tz).strftime("%d-%m-%Y, %I:%M %p") if v_until else "—",
            "created_at_ist": c_at.astimezone(ist_tz).strftime("%d-%m-%Y, %I:%M %p") if c_at else "—",
            "last_action": r["last_action"],
            "is_inside": is_inside,
            "is_expired": is_expired,
            "accompanying_count": acc_cnt,
            "accompanying_details": acc_det,
            "total_persons": acc_cnt + 1,
            "status": "CHECKED_OUT" if not is_inside else ("EXPIRED" if is_expired else "INSIDE_CAMPUS"),
        })

    return {"success": True, "data": result}


@router.post("/guard/visitor/{visitor_id}/checkout", response_model=Dict[str, Any])
async def guard_checkout_visitor(
    visitor_id: uuid.UUID,
    conn: asyncpg.Connection = Depends(get_db),
    claims: Claims = Depends(require_role("SUPER_ADMIN", "ADMIN", "SECURITY_ADMIN", "GUARD", "SECURITY_GUARD")),
):
    """Mark visitor departure at campus gate."""
    now = datetime.datetime.now(datetime.timezone.utc)
    visitor = await conn.fetchrow("""
        SELECT vp.full_name, u.phone FROM users u
        JOIN visitor_profiles vp ON vp.user_id = u.id WHERE u.id = $1
    """, visitor_id)
    if not visitor:
        raise HTTPException(status_code=404, detail="Visitor not found")

    await conn.execute("""
        INSERT INTO access_events (
            user_id, action, status, reason, event_time
        ) VALUES ($1, 'EXIT', 'GRANTED', 'Visitor Departed Campus Gate', $2)
    """, visitor_id, now)

    try:
        await manager.broadcast({
            "type": "ACCESS_EVENT",
            "data": {
                "id": str(uuid.uuid4()),
                "user_id": str(visitor_id),
                "user_name": visitor["full_name"],
                "user_identifier": visitor["phone"],
                "action": "EXIT",
                "location_name": "Main Visitor Checkpoint",
                "status": "GRANTED",
                "reason": "Visitor Checked Out",
                "event_time": now.isoformat(),
            }
        })
    except Exception:
        pass

    return {
        "success": True,
        "data": {"visitor_id": str(visitor_id), "status": "CHECKED_OUT"},
        "message": f"Visitor {visitor['full_name']} successfully checked out."
    }


# ══════════════════════════════════════════════════════════════════════════════
# Security Admin Command Center & Duty Assignment
# ══════════════════════════════════════════════════════════════════════════════

@router.post("/security-admin/assign-duty", response_model=Dict[str, Any])
async def security_admin_assign_duty(
    req: AssignGuardDutyRequest,
    conn: asyncpg.Connection = Depends(get_db),
    claims: Claims = Depends(require_role("SUPER_ADMIN", "ADMIN", "SECURITY_ADMIN")),
):
    """Assign guard duty post, shift, and instructions."""
    guard = await conn.fetchrow("SELECT id, user_type FROM users WHERE id = $1", req.guard_id)
    if not guard:
        raise HTTPException(status_code=404, detail="Guard user not found")

    # Update or insert in worker_profiles
    wp = await conn.fetchrow("SELECT user_id FROM worker_profiles WHERE user_id = $1", req.guard_id)
    if wp:
        await conn.execute("""
            UPDATE worker_profiles SET
                designation = $2,
                updated_at = now()
            WHERE user_id = $1
        """, req.guard_id, f"Security Guard - {req.post_location}")
    else:
        await conn.execute("""
            INSERT INTO worker_profiles (user_id, full_name, employee_id, designation, updated_at)
            VALUES ($1, 'Security Officer', $2, $3, now())
            ON CONFLICT (user_id) DO UPDATE SET designation = EXCLUDED.designation, updated_at = now()
        """, req.guard_id, f"SG-{str(req.guard_id)[:6].upper()}", f"Security Guard - {req.post_location}")

    return {
        "success": True,
        "data": {
            "guard_id": str(req.guard_id),
            "post_location": req.post_location,
            "shift": req.shift,
            "duty_status": req.duty_status,
            "instructions": req.instructions,
            "assigned_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        },
        "message": f"Duty assignment successfully updated: {req.post_location} ({req.shift})"
    }


@router.get("/security-admin/overview", response_model=Dict[str, Any])
async def security_admin_overview(
    conn: asyncpg.Connection = Depends(get_db),
    claims: Claims = Depends(require_role("SUPER_ADMIN", "ADMIN", "SECURITY_ADMIN")),
):
    """Campus security conditions and personnel metrics for Security Admin."""
    total_guards = await conn.fetchval("""
        SELECT COUNT(DISTINCT u.id) FROM users u
        JOIN user_roles ur ON ur.user_id = u.id
        JOIN roles r ON r.id = ur.role_id
        WHERE UPPER(r.name) IN ('GUARD', 'SECURITY_GUARD', 'SECURITY_ADMIN')
    """) or 0

    active_guards = await conn.fetchval("""
        SELECT COUNT(DISTINCT u.id) FROM users u
        JOIN user_roles ur ON ur.user_id = u.id
        JOIN roles r ON r.id = ur.role_id
        WHERE UPPER(r.name) IN ('GUARD', 'SECURITY_GUARD', 'SECURITY_ADMIN')
          AND u.status = 'active'
    """) or 0

    students_outside = await conn.fetchval("""
        SELECT COUNT(*) FROM student_hostel_status WHERE current_status IN ('OUTSIDE', 'ON_LEAVE', 'LATE_RETURN')
    """) or 0

    students_on_leave = await conn.fetchval("""
        SELECT COUNT(*) FROM student_hostel_status WHERE current_status = 'ON_LEAVE'
    """) or 0

    overdue_returns = await conn.fetchval("""
        SELECT COUNT(*) FROM student_hostel_status shs
        JOIN hostel_permissions hp ON hp.id = shs.active_permission_id
        WHERE shs.current_status IN ('OUTSIDE', 'ON_LEAVE', 'LATE_RETURN')
          AND hp.end_time < NOW()
    """) or 0

    recent_alerts = await conn.fetch("""
        SELECT id, alert_type, message, severity, created_at
        FROM system_alerts
        ORDER BY created_at DESC LIMIT 10
    """) if await conn.fetchval("SELECT to_regclass('system_alerts') IS NOT NULL") else []

    # Current IST time for curfew evaluation
    ist_tz = datetime.timezone(datetime.timedelta(hours=5, minutes=30))
    now_ist = datetime.datetime.now(datetime.timezone.utc).astimezone(ist_tz)
    curfew_active = (now_ist.hour >= 22 or now_ist.hour < 5)

    return {
        "success": True,
        "data": {
            "total_guards": total_guards,
            "active_guards": active_guards,
            "students_outside": students_outside,
            "students_on_leave": students_on_leave,
            "overdue_returns": overdue_returns,
            "curfew_active": curfew_active,
            "curfew_timing": "10:00 PM – 05:00 AM IST",
            "lockdown_mode": False,
            "visitor_policy": "Day passes 05:00 AM – 05:00 PM IST; Special ID card for approved functions",
            "posts_staffed": 5,
            "total_posts": 6,
            "alerts": [dict(a) for a in recent_alerts],
            "timestamp_ist": now_ist.strftime("%d-%m-%Y, %I:%M:%S %p IST"),
        }
    }


@router.post("/security-admin/command", response_model=Dict[str, Any])
async def execute_security_command(
    req: SecurityCommandRequest,
    conn: asyncpg.Connection = Depends(get_db),
    claims: Claims = Depends(require_role("SUPER_ADMIN", "SECURITY_ADMIN")),
):
    """Execute real-time security command (lockdown, curfew, visitor cutoff, 2fa, alarm) and broadcast via WebSocket."""
    cmd = req.command.upper()
    timestamp_ist = datetime.datetime.now(datetime.timezone.utc).astimezone(
        datetime.timezone(datetime.timedelta(hours=5, minutes=30))
    ).strftime("%d-%m-%Y, %I:%M:%S %p IST")

    event_payload = {
        "type": "SECURITY_COMMAND",
        "command": cmd,
        "action": req.action or "EXECUTE",
        "enabled": req.enabled,
        "reason": req.reason or f"Security command {cmd} executed by {claims.email or 'Security Admin'}",
        "issuer": claims.email or claims.sub,
        "timestamp": timestamp_ist,
    }

    # Broadcast to all connected guard consoles and devices
    await manager.broadcast({
        "type": "SECURITY_COMMAND",
        "data": event_payload,
    })

    # Log audit entry
    actor_id = await _resolve_actor_user_id(conn, claims)
    await audit_service.log(
        conn=conn,
        actor_id=str(actor_id) if actor_id else None,
        operation=f"SECURITY_COMMAND_{cmd}",
        entity_type="security_command",
        entity_id=cmd,
        after_state=event_payload,
    )

    return {
        "success": True,
        "data": event_payload,
        "message": f"Security command {cmd} successfully executed and broadcasted to campus gates."
    }
