from __future__ import annotations

from datetime import datetime
import logging
from typing import Optional
from fastapi import APIRouter, Depends, Query, status
import asyncpg

from app.core.database import get_db
from app.core.security import Claims, require_role
from app.schemas.common import error_response, success_response
from app.services.dashboard_service import dashboard_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/dashboard", tags=["dashboard"])


@router.get("/overview")
async def get_overview(
    claims: Claims = Depends(require_role("SUPER_ADMIN", "ADMIN")),
    conn: asyncpg.Connection = Depends(get_db),
):
    try:
        overview = await dashboard_service.get_overview(conn)
        return success_response(data=overview.model_dump())
    except Exception as e:
        logger.error("Dashboard overview failed: %s", e)
        return error_response("OVERVIEW_FAILED", str(e), status_code=status.HTTP_500_INTERNAL_SERVER_ERROR)


@router.get("/analytics")
async def get_analytics(
    start: Optional[str] = Query(None),
    end: Optional[str] = Query(None),
    claims: Claims = Depends(require_role("SUPER_ADMIN", "ADMIN", "VIEWER")),
    conn: asyncpg.Connection = Depends(get_db),
):
    try:
        start_dt = datetime.fromisoformat(start) if start else None
        end_dt = datetime.fromisoformat(end) if end else None
        analytics = await dashboard_service.get_analytics(conn, start_date=start_dt, end_date=end_dt)
        return success_response(data=analytics.model_dump())
    except Exception as e:
        logger.error("Dashboard analytics failed: %s", e)
        return error_response("ANALYTICS_FAILED", str(e), status_code=status.HTTP_500_INTERNAL_SERVER_ERROR)
