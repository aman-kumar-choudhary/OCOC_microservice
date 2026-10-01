from fastapi import APIRouter, Depends, HTTPException
import asyncpg
import datetime
from datetime import timezone
import uuid
from typing import Dict, Any, List, Optional
from pydantic import BaseModel
from app.core.database import get_db
from app.core.security import Claims, require_role, get_current_claims
router = APIRouter(prefix="/api/v1/devices", tags=["devices"])

class DeviceCreate(BaseModel):
    mac_address: str
    type: str
    location_id: uuid.UUID
    firmware_version: str = "1.0.0"
class DeviceHeartbeat(BaseModel):
    status: str = "ONLINE"
    firmware_version: Optional[str] = None

@router.get("", response_model=Dict[str, Any])
async def list_devices(conn: asyncpg.Connection = Depends(get_db), claims: Claims = Depends(require_role("SUPER_ADMIN", "ADMIN"))):
    devices = await conn.fetch("""
        SELECT d.*, l.name as location_name 
        FROM devices d
        LEFT JOIN locations l ON d.location_id = l.id
        ORDER BY d.created_at DESC
    """)
    # Automatically mark devices offline if heartbeat is older than 5 minutes
    now = datetime.datetime.now(datetime.timezone.utc)
    result = []
    for d in devices:
        status = d["status"]
        if status == "ONLINE" and d["last_heartbeat"]:
            last_hb = d["last_heartbeat"]
            # Ensure timezone-aware comparison
            if last_hb.tzinfo is None:
                last_hb = last_hb.replace(tzinfo=timezone.utc)
            if (now - last_hb).total_seconds() > 300:
                status = "OFFLINE"
        
        d_dict = dict(d)
        d_dict["status"] = status
        result.append(d_dict)
        
    return {"success": True, "data": result}

@router.post("", response_model=Dict[str, Any])
async def register_device(req: DeviceCreate, conn: asyncpg.Connection = Depends(get_db), claims: Claims = Depends(require_role("SUPER_ADMIN", "ADMIN"))):
    try:
        row = await conn.fetchrow("""
            INSERT INTO devices (mac_address, type, location_id, firmware_version)
            VALUES ($1, $2, $3, $4)
            RETURNING *
        """, req.mac_address, req.type, req.location_id, req.firmware_version)
        return {"success": True, "data": dict(row)}
    except asyncpg.exceptions.UniqueViolationError:
        raise HTTPException(status_code=400, detail="Device with this MAC address already registered")

@router.post("/{device_id}/heartbeat", response_model=Dict[str, Any])
async def device_heartbeat(device_id: uuid.UUID, req: DeviceHeartbeat, conn: asyncpg.Connection = Depends(get_db)):
    # This endpoint is called by hardware, usually secured via API Key or mTLS in production,
    # leaving unprotected for microservice internal network demo.
    row = await conn.fetchrow("""
        UPDATE devices 
        SET last_heartbeat = NOW(), status = $2, firmware_version = COALESCE($3, firmware_version)
        WHERE id = $1
        RETURNING *
    """, device_id, req.status, req.firmware_version)
    if not row:
        raise HTTPException(status_code=404, detail="Device not found")
    return {"success": True, "data": dict(row)}
