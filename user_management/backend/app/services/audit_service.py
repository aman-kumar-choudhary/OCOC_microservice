from __future__ import annotations
import json
import logging
from datetime import datetime
from typing import Any, Optional
import uuid
import asyncpg

from app.schemas.audit import AuditListResult, Log

logger = logging.getLogger(__name__)


def _parse_date_filter(value: datetime | str) -> datetime:
    if isinstance(value, datetime):
        return value
    if value.endswith("Z"):
        value = f"{value[:-1]}+00:00"
    return datetime.fromisoformat(value)


class AuditService:
    async def log(
        self,
        conn: asyncpg.Connection,
        actor_id: Optional[str],
        operation: str,
        entity_type: str,
        entity_id: str,
        before_state: Any = None,
        after_state: Any = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
    ) -> None:
        actor_uuid = None
        if actor_id:
            try:
                candidate = uuid.UUID(actor_id)
            except Exception:
                pass
            else:
                # JWT `sub` is a Keycloak ID, while audit_logs.actor_id is a
                # local users.id foreign key. Resolve either supported input
                # form and write NULL for service/admin identities not linked
                # to a local user.
                actor_uuid = await conn.fetchval(
                    "SELECT id FROM users WHERE keycloak_user_id=$1 OR id=$2 "
                    "ORDER BY CASE WHEN keycloak_user_id=$1 THEN 0 ELSE 1 END LIMIT 1",
                    actor_id, candidate,
                )

        before_json = json.dumps(before_state, default=str) if before_state is not None else None
        after_json = json.dumps(after_state, default=str) if after_state is not None else None

        try:
            # Nested asyncpg transactions use a savepoint. If audit storage is
            # unavailable, roll back just this insert instead of poisoning an
            # enclosing role/location update transaction.
            async with conn.transaction():
                await conn.execute(
                    """
                    INSERT INTO audit_logs (id, actor_id, operation, entity_type, entity_id, before_state, after_state, ip_address, user_agent, created_at)
                    VALUES (gen_random_uuid(), $1, $2, $3, $4, $5::jsonb, $6::jsonb, $7, $8, now())
                    """,
                    actor_uuid,
                    operation,
                    entity_type,
                    str(entity_id),
                    before_json,
                    after_json,
                    ip_address,
                    user_agent,
                )
        except Exception as e:
            logger.error("Audit logging failed: %s", e)

    async def get_by_id(self, conn: asyncpg.Connection, log_id: uuid.UUID) -> Optional[Log]:
        row = await conn.fetchrow(
            """
            SELECT a.id, COALESCE(a.actor_id::text, '') as actor_id, a.operation, a.entity_type, a.entity_id,
                   a.before_state, a.after_state, COALESCE(a.ip_address, '') as ip_address,
                   COALESCE(a.user_agent, '') as user_agent, a.created_at,
                   COALESCE(sp.full_name, fp.full_name, wp.full_name, vp.full_name, u.email, 'System') as actor_name,
                   COALESCE(u.email, '') as actor_email
            FROM audit_logs a
            LEFT JOIN users u ON a.actor_id = u.id
            LEFT JOIN student_profiles sp ON u.id = sp.user_id
            LEFT JOIN faculty_profiles fp ON u.id = fp.user_id
            LEFT JOIN worker_profiles wp ON u.id = wp.user_id
            LEFT JOIN visitor_profiles vp ON u.id = vp.user_id
            WHERE a.id=$1
            """,
            log_id,
        )
        if not row:
            return None
        return Log(
            id=str(row["id"]),
            actor_id=row["actor_id"] or None,
            actor_name=row["actor_name"] or "System",
            actor_email=row["actor_email"] or None,
            operation=row["operation"],
            entity_type=row["entity_type"],
            entity_id=row["entity_id"],
            before_state=json.loads(row["before_state"]) if row["before_state"] else None,
            after_state=json.loads(row["after_state"]) if row["after_state"] else None,
            ip_address=row["ip_address"] or None,
            user_agent=row["user_agent"] or None,
            created_at=row["created_at"].isoformat(),
        )

    async def list_logs(
        self,
        conn: asyncpg.Connection,
        actor_id: Optional[str] = None,
        operation: Optional[str] = None,
        entity_type: Optional[str] = None,
        entity_id: Optional[str] = None,
        search: Optional[str] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        page: int = 1,
        limit: int = 20,
    ) -> AuditListResult:
        page = max(1, page)
        limit = min(max(1, limit), 200)
        offset = (page - 1) * limit

        clauses = []
        args = []
        idx = 1

        if actor_id:
            try:
                actor_uuid = uuid.UUID(actor_id)
                clauses.append(f"a.actor_id = ${idx}")
                args.append(actor_uuid)
                idx += 1
            except Exception:
                pass
        if operation:
            clauses.append(f"a.operation = ${idx}")
            args.append(operation)
            idx += 1
        if entity_type:
            clauses.append(f"a.entity_type = ${idx}")
            args.append(entity_type)
            idx += 1
        if entity_id:
            clauses.append(f"a.entity_id = ${idx}")
            args.append(entity_id)
            idx += 1
        if start_date:
            clauses.append(f"a.created_at >= ${idx}")
            args.append(_parse_date_filter(start_date))
            idx += 1
        if end_date:
            clauses.append(f"a.created_at <= ${idx}")
            args.append(_parse_date_filter(end_date))
            idx += 1
        if search:
            clauses.append(f"(a.operation ILIKE ${idx} OR a.entity_type ILIKE ${idx} OR a.entity_id ILIKE ${idx} OR COALESCE(sp.full_name, fp.full_name, wp.full_name, vp.full_name, u.email, '') ILIKE ${idx})")
            args.append(f"%{search}%")
            idx += 1

        where_sql = f"WHERE {' AND '.join(clauses)}" if clauses else ""

        count_query = f"""
            SELECT COUNT(*)
            FROM audit_logs a
            LEFT JOIN users u ON a.actor_id = u.id
            LEFT JOIN student_profiles sp ON u.id = sp.user_id
            LEFT JOIN faculty_profiles fp ON u.id = fp.user_id
            LEFT JOIN worker_profiles wp ON u.id = wp.user_id
            LEFT JOIN visitor_profiles vp ON u.id = vp.user_id
            {where_sql}
        """
        total = await conn.fetchval(count_query, *args)

        query = f"""
            SELECT a.id, COALESCE(a.actor_id::text, '') as actor_id, a.operation, a.entity_type, a.entity_id,
                   a.before_state, a.after_state, COALESCE(a.ip_address, '') as ip_address,
                   COALESCE(a.user_agent, '') as user_agent, a.created_at,
                   COALESCE(sp.full_name, fp.full_name, wp.full_name, vp.full_name, u.email, 'System') as actor_name,
                   COALESCE(u.email, '') as actor_email
            FROM audit_logs a
            LEFT JOIN users u ON a.actor_id = u.id
            LEFT JOIN student_profiles sp ON u.id = sp.user_id
            LEFT JOIN faculty_profiles fp ON u.id = fp.user_id
            LEFT JOIN worker_profiles wp ON u.id = wp.user_id
            LEFT JOIN visitor_profiles vp ON u.id = vp.user_id
            {where_sql}
            ORDER BY a.created_at DESC
            LIMIT ${idx} OFFSET ${idx + 1}
        """
        rows = await conn.fetch(query, *args, limit, offset)

        logs = [
            Log(
                id=str(r["id"]),
                actor_id=r["actor_id"] or None,
                actor_name=r["actor_name"] or "System",
                actor_email=r["actor_email"] or None,
                operation=r["operation"],
                entity_type=r["entity_type"],
                entity_id=r["entity_id"],
                before_state=json.loads(r["before_state"]) if r["before_state"] else None,
                after_state=json.loads(r["after_state"]) if r["after_state"] else None,
                ip_address=r["ip_address"] or None,
                user_agent=r["user_agent"] or None,
                created_at=r["created_at"].isoformat(),
            )
            for r in rows
        ]
        total_pages = (total + limit - 1) // limit if total > 0 else 1
        return AuditListResult(logs=logs, total=total, page=page, limit=limit, total_pages=total_pages)


audit_service = AuditService()
