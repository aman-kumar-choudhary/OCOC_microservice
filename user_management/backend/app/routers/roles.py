from __future__ import annotations

import logging
from fastapi import APIRouter, Depends, status
import asyncpg

from app.core.database import get_db
from app.core.security import Claims, get_current_claims, require_permission
from app.schemas.common import error_response, success_response
from app.schemas.role import CreateRoleRequest
from app.services.role_service import role_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/roles", tags=["roles"])

@router.get("")
async def list_roles(
    conn: asyncpg.Connection = Depends(get_db),
    claims: Claims = Depends(get_current_claims),
):
    try:
        roles = await role_service.list_roles(conn)
        return success_response(data=[r.model_dump() for r in roles])
    except Exception as e:
        logger.error("List roles failed: %s", e)
        return error_response("LIST_ROLES_FAILED", str(e), status_code=status.HTTP_500_INTERNAL_SERVER_ERROR)


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_role(
    req: CreateRoleRequest,
    conn: asyncpg.Connection = Depends(get_db),
    claims: Claims = Depends(require_permission("role:manage")),
):
    try:
        role = await role_service.create_role(conn, actor_id=claims.sub, req=req)
        return success_response(data=role.model_dump(), status_code=status.HTTP_201_CREATED)
    except Exception as e:
        logger.error("Create role failed: %s", e)
        return error_response("CREATE_ROLE_FAILED", str(e), status_code=status.HTTP_500_INTERNAL_SERVER_ERROR)
