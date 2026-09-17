from __future__ import annotations

import logging
from typing import Optional
import uuid
import asyncpg

from app.schemas.faceauth import FaceAuthListResult, LogEntry, LogRequest
from app.services.audit_service import audit_service

logger = logging.getLogger(__name__)


class FaceAuthService:
    async def create_log(
        self,
        conn: asyncpg.Connection,
        req: LogRequest,
        ip_address: Optional[str] = None,
    ) -> LogEntry:
        log_id = uuid.uuid4()
        auth_type = req.auth_type or "single"

        await conn.execute(
            """
            INSERT INTO face_auth_logs (
                id, person_external_id, person_name, result, similarity_score,
                liveness_score, reason, auth_type, ip_address, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, now())
            """,
            log_id,
            req.person_external_id,
            req.person_name,
            req.result,
            req.similarity_score,
            req.liveness_score,
            req.reason,
            auth_type,
            ip_address,
        )

        row = await conn.fetchrow("SELECT * FROM face_auth_logs WHERE id=$1", log_id)
        entry = LogEntry(
            id=str(row["id"]),
            person_external_id=row["person_external_id"] or "",
            person_name=row["person_name"],
            result=row["result"],
            similarity_score=row["similarity_score"],
            liveness_score=row["liveness_score"],
            reason=row["reason"],
            auth_type=row["auth_type"],
            ip_address=row["ip_address"],
            created_at=row["created_at"].isoformat(),
        )

        await audit_service.log(
            conn=conn,
            actor_id=None,
            operation="FACE_AUTH_EVENT",
            entity_type="face_auth_log",
            entity_id=str(log_id),
            after_state=entry.model_dump(),
            ip_address=ip_address,
        )

        return entry

    async def list_logs(
        self,
        conn: asyncpg.Connection,
        person_external_id: Optional[str] = None,
        result: Optional[str] = None,
        page: int = 1,
        limit: int = 20,
    ) -> FaceAuthListResult:
        page = max(1, page)
        limit = min(max(1, limit), 200)
        offset = (page - 1) * limit

        clauses = []
        args = []
        idx = 1

        if person_external_id:
            clauses.append(f"person_external_id = ${idx}")
            args.append(person_external_id)
            idx += 1
        if result:
            clauses.append(f"result = ${idx}")
            args.append(result)
            idx += 1

        where_sql = f"WHERE {' AND '.join(clauses)}" if clauses else ""

        total = await conn.fetchval(f"SELECT COUNT(*) FROM face_auth_logs {where_sql}", *args)

        query = f"""
            SELECT id, person_external_id, person_name, result, similarity_score,
                   liveness_score, reason, auth_type, ip_address, created_at
            FROM face_auth_logs {where_sql}
            ORDER BY created_at DESC
            LIMIT ${idx} OFFSET ${idx + 1}
        """
        rows = await conn.fetch(query, *args, limit, offset)

        logs = [
            LogEntry(
                id=str(r["id"]),
                person_external_id=r["person_external_id"] or "",
                person_name=r["person_name"],
                result=r["result"],
                similarity_score=r["similarity_score"],
                liveness_score=r["liveness_score"],
                reason=r["reason"],
                auth_type=r["auth_type"],
                ip_address=r["ip_address"],
                created_at=r["created_at"].isoformat(),
            )
            for r in rows
        ]

        total_pages = (total + limit - 1) // limit if total > 0 else 1
        return FaceAuthListResult(logs=logs, total=total, page=page, limit=limit, total_pages=total_pages)


faceauth_service = FaceAuthService()
