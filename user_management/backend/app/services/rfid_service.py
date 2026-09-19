from __future__ import annotations

import logging
import re
import secrets
from typing import Any, Optional, Tuple
import uuid
import asyncpg

from app.schemas.rfid import Card, RFIDListResult
from app.services.audit_service import audit_service

logger = logging.getLogger(__name__)

UID_REGEX = re.compile(r"^[0-9A-Fa-f]{8,14}$")


class RFIDService:
    def validate_uid_format(self, uid: str) -> Tuple[bool, str]:
        clean = uid.strip().replace(":", "").replace("-", "")
        if not clean:
            return False, "UID is required"
        if not UID_REGEX.match(clean):
            return False, "UID must be 8-14 hex characters"
        return True, ""

    async def validate_uid(self, conn: asyncpg.Connection, uid: str) -> Tuple[bool, str]:
        valid_fmt, reason = self.validate_uid_format(uid)
        if not valid_fmt:
            return False, reason

        clean_uid = uid.strip().upper()
        row = await conn.fetchrow(
            """
            SELECT rc.id, rc.status, urc.user_id, COALESCE(sp.full_name, fp.full_name, wp.full_name, vp.full_name) as full_name
            FROM rfid_cards rc
            LEFT JOIN user_rfid_cards urc ON urc.rfid_card_id = rc.id AND urc.unassigned_at IS NULL
            LEFT JOIN users u ON u.id = urc.user_id
            LEFT JOIN student_profiles sp ON sp.user_id = u.id AND u.user_type = 'student'
            LEFT JOIN faculty_profiles fp ON fp.user_id = u.id AND u.user_type = 'faculty'
            LEFT JOIN worker_profiles wp ON wp.user_id = u.id AND u.user_type = 'worker'
            LEFT JOIN visitor_profiles vp ON vp.user_id = u.id AND u.user_type = 'visitor'
            WHERE UPPER(rc.uid) = $1
            """,
            clean_uid,
        )
        if not row:
            return True, "UID is available"

        if row["status"] == "active" and row["user_id"]:
            return False, f"UID already assigned to {row['full_name'] or 'another user'}"
        if row["status"] in ("lost", "stolen", "revoked"):
            return False, f"UID is marked as {row['status']}"

        return True, "UID is available"

    async def list_cards(
        self,
        conn: asyncpg.Connection,
        status: Optional[str] = None,
        user_id: Optional[str] = None,
        page: int = 1,
        limit: int = 20,
    ) -> RFIDListResult:
        page = max(1, page)
        limit = min(max(1, limit), 200)
        offset = (page - 1) * limit

        clauses = []
        args = []
        idx = 1

        if status and status.strip():
            clauses.append(f"rc.status = ${idx}")
            args.append(status.strip().lower())
            idx += 1
        if user_id and user_id.strip():
            try:
                u_uuid = uuid.UUID(user_id)
                clauses.append(f"urc.user_id = ${idx}")
                args.append(u_uuid)
                idx += 1
            except Exception:
                pass

        where_sql = f"WHERE {' AND '.join(clauses)}" if clauses else ""

        base_from = f"""
            FROM rfid_cards rc
            LEFT JOIN user_rfid_cards urc ON urc.rfid_card_id = rc.id AND urc.unassigned_at IS NULL
            LEFT JOIN users u ON u.id = urc.user_id
            LEFT JOIN student_profiles sp ON sp.user_id = u.id AND u.user_type = 'student'
            LEFT JOIN faculty_profiles fp ON fp.user_id = u.id AND u.user_type = 'faculty'
            LEFT JOIN worker_profiles wp ON wp.user_id = u.id AND u.user_type = 'worker'
            LEFT JOIN visitor_profiles vp ON vp.user_id = u.id AND u.user_type = 'visitor'
            LEFT JOIN departments d ON d.id = COALESCE(sp.department_id, fp.department_id, wp.department_id)
            {where_sql}
        """

        total = await conn.fetchval(f"SELECT COUNT(*) {base_from}", *args)

        query = f"""
            SELECT rc.id, rc.uid, rc.status, rc.issued_at, rc.revoked_at, rc.revoked_reason,
                   rc.created_at, rc.updated_at,
                   urc.user_id,
                   COALESCE(sp.full_name, fp.full_name, wp.full_name, vp.full_name) as user_name,
                   u.email as user_email,
                   u.user_type,
                   d.name as department
            {base_from}
            ORDER BY rc.created_at DESC
            LIMIT ${idx} OFFSET ${idx + 1}
        """
        rows = await conn.fetch(query, *args, limit, offset)

        cards = [self._row_to_card(r) for r in rows]
        total_pages = (total + limit - 1) // limit if total > 0 else 1
        return RFIDListResult(cards=cards, total=total, page=page, limit=limit, total_pages=total_pages)

    async def get_by_uid(self, conn: asyncpg.Connection, uid: str) -> Optional[Card]:
        clean_uid = uid.strip().upper()
        query = """
            SELECT rc.id, rc.uid, rc.status, rc.issued_at, rc.revoked_at, rc.revoked_reason,
                   rc.created_at, rc.updated_at,
                   urc.user_id,
                   COALESCE(sp.full_name, fp.full_name, wp.full_name, vp.full_name) as user_name,
                   u.email as user_email,
                   u.user_type,
                   d.name as department
            FROM rfid_cards rc
            LEFT JOIN user_rfid_cards urc ON urc.rfid_card_id = rc.id AND urc.unassigned_at IS NULL
            LEFT JOIN users u ON u.id = urc.user_id
            LEFT JOIN student_profiles sp ON sp.user_id = u.id AND u.user_type = 'student'
            LEFT JOIN faculty_profiles fp ON fp.user_id = u.id AND u.user_type = 'faculty'
            LEFT JOIN worker_profiles wp ON wp.user_id = u.id AND u.user_type = 'worker'
            LEFT JOIN visitor_profiles vp ON vp.user_id = u.id AND u.user_type = 'visitor'
            LEFT JOIN departments d ON d.id = COALESCE(sp.department_id, fp.department_id, wp.department_id)
            WHERE UPPER(rc.uid) = $1
        """
        row = await conn.fetchrow(query, clean_uid)
        if not row:
            return None
        return self._row_to_card(row)

    async def assign(self, conn: asyncpg.Connection, actor_id: Optional[str], user_id: uuid.UUID, uid: str) -> Card:
        # Normalize UID the same way validate_uid_format does
        clean_uid = uid.strip().replace(":", "").replace("-", "").upper()
        valid, reason = self.validate_uid_format(clean_uid)
        if not valid:
            raise ValueError(reason)

        # Check user exists
        user_exists = await conn.fetchval("SELECT EXISTS(SELECT 1 FROM users WHERE id=$1)", user_id)
        if not user_exists:
            raise ValueError("User not found")

        # Check if card is currently assigned to someone else
        existing_assignee = await conn.fetchval(
            """
            SELECT urc.user_id FROM rfid_cards rc
            JOIN user_rfid_cards urc ON urc.rfid_card_id = rc.id AND urc.unassigned_at IS NULL
            WHERE UPPER(rc.uid) = $1 AND urc.user_id != $2
            """,
            clean_uid,
            user_id,
        )
        if existing_assignee:
            raise ValueError("RFID card is already assigned to another user")

        async with conn.transaction():
            # 1. Unassign any existing active card for this user
            await conn.execute(
                """
                UPDATE user_rfid_cards SET unassigned_at=now(), is_primary=false
                WHERE user_id=$1 AND unassigned_at IS NULL
                """,
                user_id,
            )

            # 2. Insert or update rfid_cards
            card_id = await conn.fetchval(
                """
                INSERT INTO rfid_cards (id, uid, status, issued_at, created_at, updated_at)
                VALUES (gen_random_uuid(), $1, 'active', now(), now(), now())
                ON CONFLICT (uid) DO UPDATE SET
                    status = 'active',
                    issued_at = now(),
                    revoked_at = NULL,
                    revoked_reason = NULL,
                    updated_at = now()
                RETURNING id
                """,
                clean_uid,
            )

            # 3. Insert assignment
            await conn.execute(
                """
                INSERT INTO user_rfid_cards (user_id, rfid_card_id, assigned_at, is_primary)
                VALUES ($1, $2, now(), true)
                ON CONFLICT (user_id, rfid_card_id) DO UPDATE SET
                    assigned_at = now(),
                    unassigned_at = NULL,
                    is_primary = true
                """,
                user_id,
                card_id,
            )

        card = await self.get_by_uid(conn, clean_uid)
        if not card:
            raise RuntimeError("Card assigned but not found")

        await audit_service.log(
            conn=conn,
            actor_id=actor_id,
            operation="RFID_ASSIGNED",
            entity_type="rfid_card",
            entity_id=str(card.id),
            after_state=card.model_dump(),
        )
        return card

    async def replace(
        self,
        conn: asyncpg.Connection,
        actor_id: Optional[str],
        user_id: uuid.UUID,
        new_uid: str,
        reason: str = "lost",
    ) -> Card:
        clean_new_uid = new_uid.strip().upper()
        valid, msg = self.validate_uid_format(clean_new_uid)
        if not valid:
            raise ValueError(msg)

        # Find current active card
        current_card_id = await conn.fetchval(
            """
            SELECT urc.rfid_card_id FROM user_rfid_cards urc
            JOIN rfid_cards rc ON rc.id = urc.rfid_card_id
            WHERE urc.user_id = $1 AND urc.unassigned_at IS NULL AND rc.status = 'active'
            LIMIT 1
            """,
            user_id,
        )

        async with conn.transaction():
            if current_card_id:
                # Mark old card with reason
                await conn.execute(
                    """
                    UPDATE rfid_cards SET
                        status = $2,
                        revoked_at = now(),
                        revoked_reason = $3,
                        updated_at = now()
                    WHERE id = $1
                    """,
                    current_card_id,
                    reason,
                    f"Replaced due to {reason}",
                )
                await conn.execute(
                    """
                    UPDATE user_rfid_cards SET
                        unassigned_at = now(),
                        is_primary = false
                    WHERE user_id = $1 AND rfid_card_id = $2
                    """,
                    user_id,
                    current_card_id,
                )

            # Assign new card
            new_card_id = await conn.fetchval(
                """
                INSERT INTO rfid_cards (id, uid, status, issued_at, created_at, updated_at)
                VALUES (gen_random_uuid(), $1, 'active', now(), now(), now())
                ON CONFLICT (uid) DO UPDATE SET
                    status = 'active',
                    issued_at = now(),
                    revoked_at = NULL,
                    revoked_reason = NULL,
                    updated_at = now()
                RETURNING id
                """,
                clean_new_uid,
            )

            await conn.execute(
                """
                INSERT INTO user_rfid_cards (user_id, rfid_card_id, assigned_at, is_primary)
                VALUES ($1, $2, now(), true)
                ON CONFLICT (user_id, rfid_card_id) DO UPDATE SET
                    assigned_at = now(),
                    unassigned_at = NULL,
                    is_primary = true
                """,
                user_id,
                new_card_id,
            )

        card = await self.get_by_uid(conn, clean_new_uid)
        if not card:
            raise RuntimeError("New replacement card not found")

        await audit_service.log(
            conn=conn,
            actor_id=actor_id,
            operation="RFID_REPLACED",
            entity_type="rfid_card",
            entity_id=str(card.id),
            before_state={"old_card_id": str(current_card_id) if current_card_id else None},
            after_state=card.model_dump(),
        )
        return card

    async def update_status(
        self,
        conn: asyncpg.Connection,
        actor_id: Optional[str],
        card_id: uuid.UUID,
        new_status: str,
        reason: Optional[str] = None,
    ) -> None:
        async with conn.transaction():
            if new_status == "revoked":
                await conn.execute(
                    """
                    UPDATE rfid_cards SET status='revoked', revoked_at=now(), revoked_reason=$2, updated_at=now()
                    WHERE id=$1
                    """,
                    card_id,
                    reason or "Manually revoked",
                )
                await conn.execute(
                    "UPDATE user_rfid_cards SET unassigned_at=now(), is_primary=false WHERE rfid_card_id=$1",
                    card_id,
                )
            elif new_status == "active":
                await conn.execute(
                    "UPDATE rfid_cards SET status='active', revoked_at=NULL, revoked_reason=NULL, updated_at=now() WHERE id=$1",
                    card_id,
                )
            elif new_status == "inactive":
                await conn.execute(
                    "UPDATE rfid_cards SET status='inactive', updated_at=now() WHERE id=$1",
                    card_id,
                )

        await audit_service.log(
            conn=conn,
            actor_id=actor_id,
            operation=f"RFID_{new_status.upper()}",
            entity_type="rfid_card",
            entity_id=str(card_id),
            after_state={"status": new_status, "reason": reason},
        )

    def scan_simulated(self) -> str:
        """Simulate scanning an RFID tag by returning a random 8-character hex string."""
        return secrets.token_hex(4).upper()

    def _row_to_card(self, r: Any) -> Card:
        return Card(
            id=str(r["id"]),
            uid=r["uid"],
            status=r["status"],
            user_id=str(r["user_id"]) if r["user_id"] else None,
            user_name=r["user_name"],
            user_email=r["user_email"],
            user_type=r["user_type"],
            department=r["department"],
            issued_at=r["issued_at"].isoformat() if r["issued_at"] else None,
            revoked_at=r["revoked_at"].isoformat() if r["revoked_at"] else None,
            revoked_reason=r["revoked_reason"],
            created_at=r["created_at"].isoformat() if r["created_at"] else "",
            updated_at=r["updated_at"].isoformat() if r["updated_at"] else "",
        )


rfid_service = RFIDService()
