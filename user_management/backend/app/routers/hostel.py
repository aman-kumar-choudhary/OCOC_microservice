import uuid
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, status
import asyncpg

from app.core.database import get_db
from app.core.security import Claims, require_role, require_permission
from app.schemas.common import success_response, error_response
from app.schemas.hostel import (
    HostelDashboardStats, StudentHostelStatus, CreatePermissionRequest, 
    HostelPermission, MovementHistory, HostelAlert, EmergencyHeadcount,
    RFIDScanRequest, ScanResponse
)
from app.services.hostel_service import hostel_service
from app.services.hostel_rfid_service import hostel_rfid_service

router = APIRouter(prefix="/api/v1/hostel", tags=["hostel"])

@router.get("/dashboard", response_model=Dict[str, Any])
async def get_dashboard(
    hostel_id: Optional[uuid.UUID] = None,
    conn: asyncpg.Connection = Depends(get_db),
    claims: Claims = Depends(require_role("SUPER_ADMIN", "ADMIN", "WARDEN"))
):
    stats = await hostel_service.get_dashboard_stats(conn, hostel_id)
    return success_response(data=stats.model_dump(mode='json'))

@router.get("/students/live", response_model=Dict[str, Any])
async def get_live_status(
    hostel_id: Optional[uuid.UUID] = None,
    conn: asyncpg.Connection = Depends(get_db),
    claims: Claims = Depends(require_role("SUPER_ADMIN", "ADMIN", "WARDEN"))
):
    status_list = await hostel_service.get_live_status(conn, hostel_id)
    return success_response(data=[s.model_dump(mode='json') for s in status_list])

@router.post("/permissions", response_model=Dict[str, Any])
async def grant_permission(
    req: CreatePermissionRequest,
    conn: asyncpg.Connection = Depends(get_db),
    claims: Claims = Depends(require_role("SUPER_ADMIN", "ADMIN", "WARDEN"))
):
    try:
        import datetime
        if req.start_time.tzinfo is None:
            req.start_time = req.start_time.replace(tzinfo=datetime.timezone.utc)
        if req.end_time.tzinfo is None:
            req.end_time = req.end_time.replace(tzinfo=datetime.timezone.utc)

        # Resolve internal user ID from keycloak_user_id
        internal_user_id = await conn.fetchval("SELECT id FROM users WHERE keycloak_user_id = $1", claims.sub)
        if not internal_user_id:
            try:
                sub_uuid = uuid.UUID(claims.sub)
                exists = await conn.fetchval("SELECT id FROM users WHERE id = $1", sub_uuid)
                if exists:
                    internal_user_id = sub_uuid
                else:
                    internal_user_id = None
            except ValueError:
                internal_user_id = None
        
        perm = await hostel_service.grant_permission(conn, internal_user_id, req)
        return success_response(data=perm.model_dump(mode='json'))
    except Exception as e:
        import logging
        import traceback
        logging.getLogger(__name__).error(f"Failed to grant permission: {e}\n{traceback.format_exc()}")
        return error_response("GRANT_FAILED", str(e) + "\n" + traceback.format_exc(), status_code=400)

@router.delete("/permissions/{permission_id}", response_model=Dict[str, Any])
async def revoke_permission(
    permission_id: uuid.UUID,
    conn: asyncpg.Connection = Depends(get_db),
    claims: Claims = Depends(require_role("SUPER_ADMIN", "ADMIN", "WARDEN"))
):
    await hostel_service.revoke_permission(conn, permission_id)
    return success_response(message="Permission revoked successfully")

@router.get("/permissions", response_model=Dict[str, Any])
async def list_permissions(
    student_id: Optional[uuid.UUID] = None,
    hostel_id: Optional[uuid.UUID] = None,
    conn: asyncpg.Connection = Depends(get_db),
    claims: Claims = Depends(require_role("SUPER_ADMIN", "ADMIN", "WARDEN"))
):
    perms = await hostel_service.get_permissions(conn, student_id, hostel_id)
    return success_response(data=[p.model_dump(mode='json') for p in perms])

@router.get("/movement", response_model=Dict[str, Any])
async def get_movement_history(
    hostel_id: Optional[uuid.UUID] = None,
    conn: asyncpg.Connection = Depends(get_db),
    claims: Claims = Depends(require_role("SUPER_ADMIN", "ADMIN", "WARDEN"))
):
    history = await hostel_service.get_movement_history(conn, hostel_id)
    return success_response(data=[m.model_dump(mode='json') for m in history])

@router.get("/alerts", response_model=Dict[str, Any])
async def get_alerts(
    hostel_id: Optional[uuid.UUID] = None,
    conn: asyncpg.Connection = Depends(get_db),
    claims: Claims = Depends(require_role("SUPER_ADMIN", "ADMIN", "WARDEN"))
):
    alerts = await hostel_service.get_alerts(conn, hostel_id)
    return success_response(data=[a.model_dump(mode='json') for a in alerts])

@router.get("/emergency-headcount", response_model=Dict[str, Any])
async def get_emergency_headcount(
    hostel_id: Optional[uuid.UUID] = None,
    conn: asyncpg.Connection = Depends(get_db),
    claims: Claims = Depends(require_role("SUPER_ADMIN", "ADMIN", "WARDEN"))
):
    headcount = await hostel_service.get_emergency_headcount(conn, hostel_id)
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
