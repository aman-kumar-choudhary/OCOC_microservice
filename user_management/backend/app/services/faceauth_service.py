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

        entry = await self._row_to_entry(conn, log_id)

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
            SELECT fal.id, fal.person_external_id, fal.person_name, fal.result, fal.similarity_score,
                   fal.liveness_score, fal.reason, fal.auth_type, fal.ip_address, fal.created_at,
                   COALESCE(sp.photo_reference, fp.photo_reference, wp.photo_reference, vp.photo_reference) AS photo_reference
            FROM face_auth_logs fal
            LEFT JOIN users u ON u.id::text = fal.person_external_id
            LEFT JOIN student_profiles sp ON sp.user_id = u.id
            LEFT JOIN faculty_profiles fp ON fp.user_id = u.id
            LEFT JOIN worker_profiles wp ON wp.user_id = u.id
            LEFT JOIN visitor_profiles vp ON vp.user_id = u.id
            {where_sql}
            ORDER BY created_at DESC
            LIMIT ${idx} OFFSET ${idx + 1}
        """
        rows = await conn.fetch(query, *args, limit, offset)

        logs = [self._entry_from_row(r) for r in rows]

        total_pages = (total + limit - 1) // limit if total > 0 else 1
        return FaceAuthListResult(logs=logs, total=total, page=page, limit=limit, total_pages=total_pages)

    async def _row_to_entry(self, conn: asyncpg.Connection, log_id: uuid.UUID) -> LogEntry:
        row = await conn.fetchrow(
            """
            SELECT fal.*, COALESCE(sp.photo_reference, fp.photo_reference, wp.photo_reference, vp.photo_reference) AS photo_reference
            FROM face_auth_logs fal
            LEFT JOIN users u ON u.id::text = fal.person_external_id
            LEFT JOIN student_profiles sp ON sp.user_id = u.id
            LEFT JOIN faculty_profiles fp ON fp.user_id = u.id
            LEFT JOIN worker_profiles wp ON wp.user_id = u.id
            LEFT JOIN visitor_profiles vp ON vp.user_id = u.id
            WHERE fal.id=$1
            """, log_id,
        )
        return self._entry_from_row(row)

    @staticmethod
    def _entry_from_row(row: asyncpg.Record) -> LogEntry:
        return LogEntry(
            id=str(row["id"]), person_external_id=row["person_external_id"] or "",
            person_name=row["person_name"], photo_reference=row["photo_reference"],
            result=row["result"], similarity_score=row["similarity_score"],
            liveness_score=row["liveness_score"], reason=row["reason"],
            auth_type=row["auth_type"], ip_address=row["ip_address"],
            created_at=row["created_at"].isoformat(),
        )


faceauth_service = FaceAuthService()
