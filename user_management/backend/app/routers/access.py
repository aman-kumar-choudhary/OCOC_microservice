from typing import List, Dict, Any, Optional
import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from app.schemas.access import (
    AccessRule, CreateAccessRuleRequest, UpdateAccessRuleRequest,
    TemporaryAccessGrant, CreateTemporaryAccessRequest, AccessEvent,
    EvaluateAccessRequest, Location, RFIDAccessScanRequest, FaceVerificationRequest, AccessGroup, CreateAccessGroupRequest, AddAccessGroupMemberRequest, UpdateUserAccessRequest
)
from app.services.access_service import access_service
from app.services.hostel_service import hostel_service
from app.core.security import Claims, get_current_claims, require_permission, require_role
from app.core.database import get_db
from app.services.role_service import role_service
import asyncpg

router = APIRouter(prefix="/api/v1/access", tags=["access_management"])

# ── Operational role and WARDEN-hostel assignment ──────────────────────────

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
        access = await role_service.update_user_access(conn, claims.sub, user_id, req.roles, req.hostel_ids)
        return {"success": True, "data": access}
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
    try:
        admin_id = uuid.UUID(claims.sub)
    except (ValueError, AttributeError):
        from fastapi.responses import JSONResponse
        return JSONResponse(status_code=400, content={"success": False, "error": {"code": "INVALID_ACTOR", "message": "Actor ID is not a valid UUID"}})
    grant = await access_service.create_temporary_grant(conn, req, admin_id)
    return {"success": True, "data": grant}


# ── Evaluation Engine (Simulate Access) ───────────────────────────────────

@router.post("/evaluate", response_model=Dict[str, Any])
async def evaluate_access(req: EvaluateAccessRequest, conn: asyncpg.Connection = Depends(get_db), claims: Claims = Depends(require_permission("gate.review.manual"))):
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
    event = await access_service.evaluate_rfid_scan(conn, req.uid, req.location_id, req.action, req.reader_id, req.device_id, req.face_confidence)
    return {"success": True, "data": event}

@router.post("/verify-face", response_model=Dict[str, Any])
async def verify_gate_face(req: FaceVerificationRequest, conn: asyncpg.Connection = Depends(get_db), claims: Claims = Depends(require_permission("gate.review.manual"))):
    event = await access_service.verify_face(conn, req.verification_id, req.user_id, req.matched, req.face_confidence, req.reason)
    return {"success": True, "data": event}
