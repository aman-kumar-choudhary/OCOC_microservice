from __future__ import annotations

import logging
from typing import Optional
import uuid
from fastapi import APIRouter, Depends, Query, status
import asyncpg
from app.core.database import get_db
from app.core.security import Claims, require_permission
from app.schemas.common import error_response, success_response
from app.schemas.rfid import AssignRequest, ReplaceRequest, ValidateRequest
from app.services.rfid_service import rfid_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/rfid", tags=["rfid"])

@router.get("")
async def list_cards(
    status: Optional[str] = Query(None),
    user_id: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=200),
    claims: Claims = Depends(require_permission("rfid:read")),
    conn: asyncpg.Connection = Depends(get_db),
):
    try:
        result = await rfid_service.list_cards(conn, status=status, user_id=user_id, page=page, limit=limit)
        return success_response(data=result.model_dump())
    except Exception as e:
        logger.error("List RFID cards failed: %s", e)
        return error_response("LIST_FAILED", str(e), status_code=500)


@router.post("/validate")
async def validate_card(
    req: ValidateRequest,
    claims: Claims = Depends(require_permission("rfid:read")),
    conn: asyncpg.Connection = Depends(get_db),
):
    valid, reason = await rfid_service.validate_uid(conn, req.uid)
    return success_response(data={"valid": valid, "reason": reason})


@router.post("/assign", status_code=status.HTTP_201_CREATED)
async def assign_card(
    req: AssignRequest,
    claims: Claims = Depends(require_permission("rfid:assign")),
    conn: asyncpg.Connection = Depends(get_db),
):
    try:
        user_uuid = uuid.UUID(req.user_id)
        card = await rfid_service.assign(conn, actor_id=claims.sub, user_id=user_uuid, uid=req.uid)
        return success_response(data=card.model_dump(), status_code=status.HTTP_201_CREATED)
    except ValueError as e:
        return error_response("ASSIGN_FAILED", str(e), status_code=400)
    except Exception as e:
        logger.error("Assign RFID failed: %s", e)
        return error_response("ASSIGN_FAILED", str(e), status_code=500)


@router.post("/replace")
async def replace_card(
    req: ReplaceRequest,
    claims: Claims = Depends(require_permission("rfid:replace")),
    conn: asyncpg.Connection = Depends(get_db),
):
    try:
        user_uuid = uuid.UUID(req.user_id)
        card = await rfid_service.replace(conn, actor_id=claims.sub, user_id=user_uuid, new_uid=req.new_uid, reason=req.reason)
        return success_response(data=card.model_dump())
    except ValueError as e:
        return error_response("REPLACE_FAILED", str(e), status_code=400)
    except Exception as e:
        logger.error("Replace RFID failed: %s", e)
        return error_response("REPLACE_FAILED", str(e), status_code=500)


@router.post("/scan")
async def scan_card(claims: Claims = Depends(require_permission("rfid:read"))):
    uid = rfid_service.scan_simulated()
    return success_response(data={"uid": uid, "status": "success"})


@router.get("/reader/status")
async def reader_status(claims: Claims = Depends(require_permission("rfid:read"))):
    return success_response(data={"status": "idle", "simulated": True})


@router.get("/{uid}")
async def get_by_uid(
    uid: str,
    claims: Claims = Depends(require_permission("rfid:read")),
    conn: asyncpg.Connection = Depends(get_db),
):
    card = await rfid_service.get_by_uid(conn, uid)
    if not card:
        return error_response("CARD_NOT_FOUND", "card not found", status_code=404)
    return success_response(data=card.model_dump())


@router.patch("/{card_id}/activate")
async def activate_card(
    card_id: uuid.UUID,
    claims: Claims = Depends(require_permission("rfid:assign")),
    conn: asyncpg.Connection = Depends(get_db),
):
    try:
        await rfid_service.update_status(conn, actor_id=claims.sub, card_id=card_id, new_status="active")
        return success_response(message="card activated")
    except Exception as e:
        return error_response("ACTIVATE_FAILED", str(e), status_code=500)


@router.patch("/{card_id}/deactivate")
async def deactivate_card(
    card_id: uuid.UUID,
    claims: Claims = Depends(require_permission("rfid:assign")),
    conn: asyncpg.Connection = Depends(get_db),
):
    try:
        await rfid_service.update_status(conn, actor_id=claims.sub, card_id=card_id, new_status="inactive")
        return success_response(message="card deactivated")
    except Exception as e:
        return error_response("DEACTIVATE_FAILED", str(e), status_code=500)


@router.patch("/{card_id}/revoke")
async def revoke_card(
    card_id: uuid.UUID,
    claims: Claims = Depends(require_permission("rfid:revoke")),
    conn: asyncpg.Connection = Depends(get_db),
):
    try:
        await rfid_service.update_status(conn, actor_id=claims.sub, card_id=card_id, new_status="revoked")
        return success_response(message="card revoked")
    except Exception as e:
        return error_response("REVOKE_FAILED", str(e), status_code=500)
