from __future__ import annotations

import json
import logging
from typing import Any, Optional
import uuid
import asyncpg

from app.schemas.audit import AuditListResult, Log

logger = logging.getLogger(__name__)


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
                actor_uuid = uuid.UUID(actor_id)
            except Exception:
                pass

        before_json = json.dumps(before_state, default=str) if before_state is not None else None
        after_json = json.dumps(after_state, default=str) if after_state is not None else None

        try:
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
            SELECT id, COALESCE(actor_id::text, '') as actor_id, operation, entity_type, entity_id,
                   before_state, after_state, COALESCE(ip_address, '') as ip_address,
                   COALESCE(user_agent, '') as user_agent, created_at
            FROM audit_logs WHERE id=$1
            """,
            log_id,
        )
        if not row:
            return None
        return Log(
            id=str(row["id"]),
            actor_id=row["actor_id"] or None,
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
                clauses.append(f"actor_id = ${idx}")
                args.append(actor_uuid)
                idx += 1
            except Exception:
                pass
        if operation:
            clauses.append(f"operation = ${idx}")
            args.append(operation)
            idx += 1
        if entity_type:
            clauses.append(f"entity_type = ${idx}")
            args.append(entity_type)
            idx += 1
        if entity_id:
            clauses.append(f"entity_id = ${idx}")
            args.append(entity_id)
            idx += 1

        where_sql = f"WHERE {' AND '.join(clauses)}" if clauses else ""

        total = await conn.fetchval(f"SELECT COUNT(*) FROM audit_logs {where_sql}", *args)

        query = f"""
            SELECT id, COALESCE(actor_id::text, '') as actor_id, operation, entity_type, entity_id,
                   before_state, after_state, COALESCE(ip_address, '') as ip_address,
                   COALESCE(user_agent, '') as user_agent, created_at
            FROM audit_logs {where_sql}
            ORDER BY created_at DESC
            LIMIT ${idx} OFFSET ${idx + 1}
        """
        rows = await conn.fetch(query, *args, limit, offset)

        logs = [
            Log(
                id=str(r["id"]),
                actor_id=r["actor_id"] or None,
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
