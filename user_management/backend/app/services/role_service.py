from __future__ import annotations

import logging
import secrets
from typing import Any, List, Optional
import uuid
import asyncpg

from app.schemas.role import CreateRoleRequest, Role
from app.services.audit_service import audit_service
from app.core.keycloak_client import keycloak_client
from app.config import settings

logger = logging.getLogger(__name__)

# This list is intentionally limited to the roles Access Management owns.
# ADMIN and SUPER_ADMIN continue to be administered by their existing flow.
OPERATIONAL_ROLES = {
    "GUARD", "WARDEN", "FACULTY",
    "STUDENT", "SECURITY_GUARD", "STAFF", "WORKER", "VISITOR",
}


class RoleService:
    async def list_roles(self, conn: asyncpg.Connection) -> List[Role]:
        rows = await conn.fetch("SELECT id, name, description, user_type, created_at, updated_at FROM roles ORDER BY name")
        return [
            Role(
                id=str(r["id"]),
                name=r["name"],
                description=r["description"] or "",
                user_type=r["user_type"],
                created_at=r["created_at"].isoformat(),
                updated_at=r["updated_at"].isoformat(),
            )
            for r in rows
        ]

    async def create_role(self, conn: asyncpg.Connection, actor_id: Optional[str], req: CreateRoleRequest) -> Role:
        role_id = uuid.uuid4()
        await conn.execute(
            """
            INSERT INTO roles (id, name, description, user_type, created_at, updated_at)
            VALUES ($1, $2, $3, $4, now(), now())
            """,
            role_id,
            req.name.upper(),
            req.description,
            req.user_type,
        )
        row = await conn.fetchrow("SELECT id, name, description, user_type, created_at, updated_at FROM roles WHERE id=$1", role_id)
        role = Role(
            id=str(row["id"]),
            name=row["name"],
            description=row["description"] or "",
            user_type=row["user_type"],
            created_at=row["created_at"].isoformat(),
            updated_at=row["updated_at"].isoformat(),
        )

        await audit_service.log(
            conn=conn,
            actor_id=actor_id,
            operation="ROLE_CREATED",
            entity_type="role",
            entity_id=str(role_id),
            after_state=role.model_dump(),
        )
        return role

    async def assign_to_user(
        self,
        conn: asyncpg.Connection,
        actor_id: Optional[str],
        user_id: uuid.UUID,
        role_id: uuid.UUID,
    ) -> None:
        actor_uuid = None
        if actor_id:
            try:
                actor_uuid = uuid.UUID(actor_id)
            except Exception:
                pass

        await conn.execute(
            """
            INSERT INTO user_roles (user_id, role_id, assigned_at, assigned_by)
            VALUES ($1, $2, now(), $3)
            ON CONFLICT (user_id, role_id) DO NOTHING
            """,
            user_id,
            role_id,
            actor_uuid,
        )

        await audit_service.log(
            conn=conn,
            actor_id=actor_id,
            operation="ROLE_ASSIGNED_TO_USER",
            entity_type="user",
            entity_id=str(user_id),
            after_state={"role_id": str(role_id)},
        )

    async def remove_from_user(
        self,
        conn: asyncpg.Connection,
        actor_id: Optional[str],
        user_id: uuid.UUID,
        role_id: uuid.UUID,
    ) -> None:
        await conn.execute(
            "DELETE FROM user_roles WHERE user_id=$1 AND role_id=$2",
            user_id,
            role_id,
        )

        await audit_service.log(
            conn=conn,
            actor_id=actor_id,
            operation="ROLE_REMOVED_FROM_USER",
            entity_type="user",
            entity_id=str(user_id),
            after_state={"role_id": str(role_id)},
        )

    async def get_user_access(self, conn: asyncpg.Connection, user_id: uuid.UUID) -> dict[str, Any]:
        user = await conn.fetchrow("SELECT id, keycloak_user_id FROM users WHERE id=$1", user_id)
        if not user:
            raise ValueError("User not found")
        roles = await conn.fetch(
            "SELECT r.name FROM user_roles ur JOIN roles r ON r.id=ur.role_id WHERE ur.user_id=$1 AND r.name = ANY($2::text[]) ORDER BY r.name",
            user_id, list(OPERATIONAL_ROLES),
        )
        hostels = await conn.fetch(
            "SELECT h.id, h.name, h.code FROM warden_hostels wh JOIN hostels h ON h.id=wh.hostel_id WHERE wh.user_id=$1 ORDER BY h.name",
            user_id,
        )
        return {"user_id": str(user_id), "roles": [row["name"] for row in roles], "hostels": [dict(row) for row in hostels]}

    @staticmethod
    def _temporary_password() -> str:
        # Compatible with the existing password policy without storing the
        # secret anywhere outside Keycloak.
        alphabet = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789@$!%*?&#"
        return "Aa1!" + "".join(secrets.choice(alphabet) for _ in range(16))

    async def _provision_keycloak_identity(
        self, conn: asyncpg.Connection, user_id: uuid.UUID,
    ) -> tuple[str, Optional[str]]:
        """Create/link a Keycloak identity on first operational access grant."""
        target = await conn.fetchrow(
            """
            SELECT u.keycloak_user_id, u.email, u.user_type,
                   COALESCE(sp.full_name, fp.full_name, wp.full_name, vp.full_name, u.email) AS full_name
            FROM users u
            LEFT JOIN student_profiles sp ON sp.user_id=u.id
            LEFT JOIN faculty_profiles fp ON fp.user_id=u.id
            LEFT JOIN worker_profiles wp ON wp.user_id=u.id
            LEFT JOIN visitor_profiles vp ON vp.user_id=u.id
            WHERE u.id=$1
            """,
            user_id,
        )
        if not target:
            raise ValueError("User not found")
        if target["keycloak_user_id"]:
            return target["keycloak_user_id"], None

        username = target["email"].lower()
        temporary_password = self._temporary_password()
        existing = await keycloak_client.get_user_by_email(target["email"])
        if existing:
            keycloak_id = existing["id"]
            username = existing.get("username") or username
            await keycloak_client.reset_password(keycloak_id, temporary_password, temporary=False)
        else:
            name_parts = str(target["full_name"]).strip().split(maxsplit=1)
            keycloak_id = await keycloak_client.create_user(
                username=username,
                email=target["email"].lower(),
                first_name=name_parts[0] if name_parts else username,
                last_name=name_parts[1] if len(name_parts) > 1 else "",
                password=temporary_password,
                attributes={"user_type": [target["user_type"]], "user_id": [str(user_id)]},
            )
        await conn.execute("UPDATE users SET keycloak_user_id=$1, updated_at=now() WHERE id=$2", keycloak_id, user_id)
        return keycloak_id, temporary_password

    def _log_temporary_credentials(self, username: str, password: str, roles: set[str], hostels: list[dict[str, Any]]) -> None:
        if settings.ENVIRONMENT.lower() not in {"development", "dev", "test"}:
            return
        hostel_names = ", ".join(str(hostel["name"]) for hostel in hostels) or "None"
        logger.warning(
            "USER ACCESS CREATED\n\nUsername: %s\nTemporary Password: %s\nRole: %s\nHostels: %s\nLogin: http://localhost:5173/login",
            username, password, " + ".join(sorted(roles)), hostel_names,
        )

    async def update_user_access(
        self, conn: asyncpg.Connection, actor_id: Optional[str], user_id: uuid.UUID,
        role_names: List[str], hostel_ids: List[uuid.UUID],
    ) -> dict[str, Any]:
        requested_roles = {name.strip().upper() for name in role_names if name.strip()}
        if not requested_roles.issubset(OPERATIONAL_ROLES):
            invalid = sorted(requested_roles - OPERATIONAL_ROLES)
            raise ValueError(f"Unsupported operational roles: {', '.join(invalid)}")
        if hostel_ids and "WARDEN" not in requested_roles:
            raise ValueError("Hostel assignments require the WARDEN role")

        before = await self.get_user_access(conn, user_id)
        actor_local_id = await conn.fetchval("SELECT id FROM users WHERE keycloak_user_id=$1", actor_id) if actor_id else None
        audit_actor_id = str(actor_local_id) if actor_local_id else actor_id
        target = await conn.fetchrow("SELECT id, keycloak_user_id, email FROM users WHERE id=$1", user_id)
        if not target:
            raise ValueError("User not found")
        available_roles = await conn.fetch("SELECT id, name FROM roles WHERE name = ANY($1::text[])", list(requested_roles))
        role_ids = {row["name"]: row["id"] for row in available_roles}
        if set(role_ids) != requested_roles:
            raise ValueError("One or more selected roles are not configured locally")
        if hostel_ids:
            valid_hostels = await conn.fetchval("SELECT COUNT(*) FROM hostels WHERE id = ANY($1::uuid[])", hostel_ids)
            if valid_hostels != len(set(hostel_ids)):
                raise ValueError("One or more selected hostels do not exist")
        # Keycloak has no distributed transaction with PostgreSQL.  Update it
        # first; if the local transaction fails, restore its prior roles.
        keycloak_id = target["keycloak_user_id"]
        temporary_password = None
        if requested_roles and not keycloak_id:
            keycloak_id, temporary_password = await self._provision_keycloak_identity(conn, user_id)
        if keycloak_id:
            await keycloak_client.update_user_roles(keycloak_id, list(requested_roles), list(OPERATIONAL_ROLES))
        try:
            async with conn.transaction():
                await conn.execute(
                    "DELETE FROM user_roles WHERE user_id=$1 AND role_id IN (SELECT id FROM roles WHERE name = ANY($2::text[]))",
                    user_id, list(OPERATIONAL_ROLES),
                )
                if role_ids:
                    await conn.executemany(
                        "INSERT INTO user_roles (user_id, role_id, assigned_at) VALUES ($1, $2, now())",
                        [(user_id, role_id) for role_id in role_ids.values()],
                    )
                await conn.execute("DELETE FROM warden_hostels WHERE user_id=$1", user_id)
                if hostel_ids:
                    await conn.executemany(
                        "INSERT INTO warden_hostels (user_id, hostel_id, created_at, updated_at) VALUES ($1, $2, now(), now())",
                        [(user_id, hostel_id) for hostel_id in set(hostel_ids)],
                    )
                after = await self.get_user_access(conn, user_id)
                before_roles, after_roles = set(before["roles"]), set(after["roles"])
                before_hostels = {str(hostel["id"]) for hostel in before["hostels"]}
                after_hostels = {str(hostel["id"]) for hostel in after["hostels"]}
                for role in sorted(after_roles - before_roles):
                    await audit_service.log(conn, audit_actor_id, "ROLE_ASSIGNED", "user", str(user_id), after_state={"role": role})
                for role in sorted(before_roles - after_roles):
                    await audit_service.log(conn, audit_actor_id, "ROLE_REMOVED", "user", str(user_id), before_state={"role": role})
                for hostel_id in sorted(after_hostels - before_hostels):
                    await audit_service.log(conn, audit_actor_id, "HOSTEL_ACCESS_GRANTED", "user", str(user_id), after_state={"hostel_id": hostel_id})
                for hostel_id in sorted(before_hostels - after_hostels):
                    await audit_service.log(conn, audit_actor_id, "HOSTEL_ACCESS_REVOKED", "user", str(user_id), before_state={"hostel_id": hostel_id})
                await audit_service.log(conn, audit_actor_id, "ACCESS_CONFIGURATION_UPDATED", "user", str(user_id), before, after)
        except Exception:
            try:
                if keycloak_id:
                    await keycloak_client.update_user_roles(keycloak_id, before["roles"], list(OPERATIONAL_ROLES))
            except Exception as rollback_error:
                logger.critical("Keycloak role rollback failed for user %s: %s", user_id, rollback_error)
            raise
        if temporary_password:
            self._log_temporary_credentials(target["email"].lower(), temporary_password, requested_roles, after["hostels"])
        return after


role_service = RoleService()
