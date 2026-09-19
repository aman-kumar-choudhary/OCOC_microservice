from typing import List, Dict, Any, Optional
import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from app.schemas.access import (
    AccessRule, CreateAccessRuleRequest, UpdateAccessRuleRequest,
    TemporaryAccessGrant, CreateTemporaryAccessRequest, AccessEvent,
    EvaluateAccessRequest, Location
)
from app.services.access_service import access_service
from app.core.security import Claims, get_current_claims, require_role
from app.core.database import get_db
import asyncpg

router = APIRouter(prefix="/api/v1/access", tags=["access_management"])

# ── Locations ────────────────────────────────────────────────────────────

@router.get("/locations", response_model=Dict[str, Any])
async def list_locations(conn: asyncpg.Connection = Depends(get_db), claims: Claims = Depends(get_current_claims)):
    locs = await access_service.get_locations(conn)
    return {"success": True, "data": locs}

# ── Access Rules ──────────────────────────────────────────────────────────

@router.get("/rules", response_model=Dict[str, Any])
async def list_rules(conn: asyncpg.Connection = Depends(get_db), claims: Claims = Depends(require_role("SUPER_ADMIN", "ADMIN", "SECURITY_ADMIN"))):
    rules = await access_service.get_rules(conn)
    return {"success": True, "data": rules}

@router.post("/rules", response_model=Dict[str, Any])
async def create_rule(req: CreateAccessRuleRequest, conn: asyncpg.Connection = Depends(get_db), claims: Claims = Depends(require_role("SUPER_ADMIN", "ADMIN"))):
    rule = await access_service.create_rule(conn, req)
    return {"success": True, "data": rule}

@router.patch("/rules/{rule_id}", response_model=Dict[str, Any])
async def update_rule(rule_id: uuid.UUID, req: UpdateAccessRuleRequest, conn: asyncpg.Connection = Depends(get_db), claims: Claims = Depends(require_role("SUPER_ADMIN", "ADMIN"))):
    rule = await access_service.update_rule(conn, rule_id, req)
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")
    return {"success": True, "data": rule}

# ── Temporary Access ──────────────────────────────────────────────────────

@router.get("/temporary-grants", response_model=Dict[str, Any])
async def list_temporary_grants(conn: asyncpg.Connection = Depends(get_db), claims: Claims = Depends(require_role("SUPER_ADMIN", "ADMIN", "SECURITY_ADMIN"))):
    grants = await access_service.get_temporary_grants(conn)
    return {"success": True, "data": grants}

@router.post("/temporary-grants", response_model=Dict[str, Any])
async def create_temporary_grant(req: CreateTemporaryAccessRequest, conn: asyncpg.Connection = Depends(get_db), claims: Claims = Depends(require_role("SUPER_ADMIN", "ADMIN", "SECURITY_ADMIN"))):
    try:
        admin_id = uuid.UUID(claims.sub)
    except (ValueError, AttributeError):
        from fastapi.responses import JSONResponse
        return JSONResponse(status_code=400, content={"success": False, "error": {"code": "INVALID_ACTOR", "message": "Actor ID is not a valid UUID"}})
    grant = await access_service.create_temporary_grant(conn, req, admin_id)
    return {"success": True, "data": grant}


# ── Evaluation Engine (Simulate Access) ───────────────────────────────────

@router.post("/evaluate", response_model=Dict[str, Any])
async def evaluate_access(req: EvaluateAccessRequest, conn: asyncpg.Connection = Depends(get_db), claims: Claims = Depends(require_role("SUPER_ADMIN", "ADMIN", "SECURITY_ADMIN"))):
    event = await access_service.evaluate_access(conn, req.user_id, req.location_id, req.action)
    return {"success": True, "data": event}

# ── Access Events / Alerts ────────────────────────────────────────────────

@router.get("/events", response_model=Dict[str, Any])
async def list_events(limit: int = 50, only_denied: bool = False, user_id: Optional[uuid.UUID] = None, conn: asyncpg.Connection = Depends(get_db), claims: Claims = Depends(require_role("SUPER_ADMIN", "ADMIN", "SECURITY_ADMIN"))):
    events = await access_service.get_events(conn, limit, only_denied, user_id)
    return {"success": True, "data": events}
