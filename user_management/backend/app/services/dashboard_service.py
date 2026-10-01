from __future__ import annotations

from datetime import datetime, timedelta
import logging
from typing import List, Optional
import asyncpg

from app.schemas.dashboard import Analytics, Overview, TrendPoint

logger = logging.getLogger(__name__)


class DashboardService:
    async def get_overview(self, conn: asyncpg.Connection) -> Overview:
        user_row = await conn.fetchrow(
            """
            SELECT
                COUNT(*) as total_users,
                COUNT(*) FILTER (WHERE status='active') as active_users,
                COUNT(*) FILTER (WHERE status='suspended') as suspended_users,
                COUNT(*) FILTER (WHERE status='deactivated') as deactivated_users,
                COUNT(*) FILTER (WHERE user_type='student') as students,
                COUNT(*) FILTER (WHERE user_type='faculty') as faculty,
                COUNT(*) FILTER (WHERE user_type='worker') as workers,
                COUNT(*) FILTER (WHERE user_type='visitor') as visitors
            FROM users
            """
        )
        rfid_row = await conn.fetchrow(
            """
            SELECT
                COUNT(*) as rfid_issued,
                COUNT(*) FILTER (WHERE status='active') as rfid_active,
                COUNT(*) FILTER (WHERE status IN ('revoked','lost','stolen','replaced')) as rfid_revoked
            FROM rfid_cards
            """
        )

        return Overview(
            total_users=user_row["total_users"],
            active_users=user_row["active_users"],
            suspended_users=user_row["suspended_users"],
            deactivated_users=user_row["deactivated_users"],
            students=user_row["students"],
            faculty=user_row["faculty"],
            workers=user_row["workers"],
            visitors=user_row["visitors"],
            rfid_issued=rfid_row["rfid_issued"],
            rfid_active=rfid_row["rfid_active"],
            rfid_revoked=rfid_row["rfid_revoked"],
        )

    async def get_analytics(
        self,
        conn: asyncpg.Connection,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
    ) -> Analytics:
        if not end_date:
            end_date = datetime.utcnow()
        if not start_date:
            start_date = end_date - timedelta(days=14)

        # Onboarding trend
        onboarding_rows = await conn.fetch(
            """
            SELECT date_trunc('day', created_at)::date AS d, COUNT(*) as cnt
            FROM users
            WHERE created_at >= $1 AND created_at <= $2
            GROUP BY d ORDER BY d
            """,
            start_date,
            end_date,
        )
        onboarding_trend = [
            TrendPoint(date=r["d"].strftime("%Y-%m-%d"), count=r["cnt"])
            for r in onboarding_rows
        ]

        # Card issuance trend
        card_rows = await conn.fetch(
            """
            SELECT date_trunc('day', issued_at)::date AS d, COUNT(*) as cnt
            FROM rfid_cards
            WHERE issued_at >= $1 AND issued_at <= $2
            GROUP BY d ORDER BY d
            """,
            start_date,
            end_date,
        )
        card_issuance_trend = [
            TrendPoint(date=r["d"].strftime("%Y-%m-%d"), count=r["cnt"])
            for r in card_rows
        ]

        return Analytics(
            onboarding_trend=onboarding_trend,
            card_issuance_trend=card_issuance_trend,
        )


dashboard_service = DashboardService()
