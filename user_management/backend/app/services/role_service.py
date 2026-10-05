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
    "GUARD", "SECURITY_GUARD", "SECURITY_SUPERVISOR", "GATE_OPERATOR",
    "WARDEN", "HOSTEL_OPERATOR", "FACULTY",
    "STUDENT", "STAFF", "WORKER", "VISITOR", "USER_MANAGER",
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
        user = await conn.fetchrow("SELECT id, keycloak_user_id, email FROM users WHERE id=$1", user_id)
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
        return {
            "user_id": str(user_id), "email": user["email"],
            "keycloak_user_id": user["keycloak_user_id"],
            "roles": [row["name"] for row in roles],
            "hostels": [dict(row) for row in hostels],
        }

    @staticmethod
    def _temporary_password() -> str:
        # Generates a shell-safe, human-readable temporary password compatible
        # with Keycloak password policies (uppercase, lowercase, number, special char).
        # Avoids $, %, &, #, *, ? or ambiguous characters (l, 1, I, 0, O) to prevent
        # shell variable expansion or copy-paste corruption.
        alphabet = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789"
        return "Aa1!" + "".join(secrets.choice(alphabet) for _ in range(12))

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
        username = target["email"].lower()
        # A stored ID can become stale if the Keycloak user was removed or the
        # realm was recreated. Validate it before using it for role mappings.
        if target["keycloak_user_id"]:
            linked_user = await keycloak_client.get_user_by_id(target["keycloak_user_id"])
            if linked_user:
                await keycloak_client.clear_required_actions(target["keycloak_user_id"])
                return target["keycloak_user_id"], None

        existing = await keycloak_client.get_user_by_email(target["email"])
        if existing:
            keycloak_id = existing["id"]
            # Link the existing identity without changing its credentials.
            temporary_password = None
        else:
            temporary_password = self._temporary_password()
            name_parts = str(target["full_name"]).strip().split(maxsplit=1)
            first_name = name_parts[0] if name_parts else username
            last_name = name_parts[1] if len(name_parts) > 1 else (str(target["user_type"]).capitalize() if "user_type" in target and target["user_type"] else "User")
            keycloak_id = await keycloak_client.create_user(
                username=username,
                email=target["email"].lower(),
                first_name=first_name,
                last_name=last_name,
                password=temporary_password,
                attributes={"user_type": [target["user_type"]], "user_id": [str(user_id)]},
                temporary_password=False,
            )
        await keycloak_client.clear_required_actions(keycloak_id)
        await conn.execute("UPDATE users SET keycloak_user_id=$1, updated_at=now() WHERE id=$2", keycloak_id, user_id)
        return keycloak_id, temporary_password

    def _log_temporary_credentials(
        self, username: str, password: str, roles: set[str],
        hostels: list[dict[str, Any]], user_id: str, keycloak_id: Optional[str],
    ) -> None:
        if settings.ENVIRONMENT.lower() not in {"development", "dev", "test"}:
            return
        hostel_names = ", ".join(str(hostel["name"]) for hostel in hostels) or "None"
        logger.warning(
            "USER ACCESS CREATED\n\nUser ID: %s\nKeycloak ID: %s\nEmail: %s\nTemporary Password: %s\nAssigned Roles: %s\nHostels: %s\nLogin: http://localhost:5173/login",
            user_id, keycloak_id or "unlinked", username, password,
            " + ".join(sorted(roles)) or "None", hostel_names,
        )

    @staticmethod
    def get_dashboard_info(roles: set[str] | list[str]) -> dict[str, str]:
        r = {str(x).upper() for x in roles}
        if "SUPER_ADMIN" in r or "ADMIN" in r or "USER_MANAGER" in r:
            return {"path": "/dashboard", "name": "Campus Operations Workspace", "category": "ADMIN"}
        if "WARDEN" in r:
            return {"path": "/hostel", "name": "Hostel Management Workspace", "category": "WARDEN"}
        if "GUARD" in r or "SECURITY_GUARD" in r or "SECURITY_ADMIN" in r:
            return {"path": "/guard", "name": "Guard Console Workspace", "category": "GUARD"}
        if "VIEWER" in r:
            return {"path": "/analytics", "name": "Campus Analytics Workspace", "category": "VIEWER"}
        if "FACULTY" in r:
            return {"path": "/dashboard", "name": "Faculty & Academic Workspace", "category": "FACULTY"}
        if "STUDENT" in r:
            return {"path": "/dashboard", "name": "Student Identity Workspace", "category": "STUDENT"}
        if "WORKER" in r or "STAFF" in r:
            return {"path": "/dashboard", "name": "Campus Staff & Operations Workspace", "category": "WORKER"}
        if "VISITOR" in r:
            return {"path": "/dashboard", "name": "Visitor Access Workspace", "category": "VISITOR"}
        return {"path": "/dashboard", "name": "Personal Identity Workspace", "category": "USER"}

    async def update_user_access(
        self, conn: asyncpg.Connection, actor_id: Optional[str], user_id: uuid.UUID,
        role_names: List[str], hostel_ids: List[uuid.UUID],
        location_ids: Optional[List[uuid.UUID]] = None,
        issue_password: bool = False,
        custom_password: Optional[str] = None,
    ) -> dict[str, Any]:
        requested_roles = {name.strip().upper() for name in role_names if name.strip()}
        if not requested_roles.issubset(OPERATIONAL_ROLES):
            invalid = sorted(requested_roles - OPERATIONAL_ROLES)
            raise ValueError(f"Unsupported operational roles: {', '.join(invalid)}")
        if hostel_ids and not any(r in requested_roles for r in ("WARDEN", "HOSTEL_OPERATOR")):
            raise ValueError("Hostel assignments require the WARDEN or HOSTEL_OPERATOR role")

        before = await self.get_user_access(conn, user_id)
        actor_local_id = await conn.fetchval("SELECT id FROM users WHERE keycloak_user_id=$1", actor_id) if actor_id else None
        audit_actor_id = str(actor_local_id) if actor_local_id else None
        target = await conn.fetchrow("SELECT id, keycloak_user_id, email FROM users WHERE id=$1", user_id)
        if not target:
            raise ValueError("User not found")

        # Ensure any missing operational roles exist in local roles table
        for r_name in requested_roles:
            await conn.execute(
                "INSERT INTO roles (name, description, user_type) VALUES ($1, 'OCOC operational role', NULL) ON CONFLICT (name) DO NOTHING",
                r_name,
            )

        available_roles = await conn.fetch("SELECT id, name FROM roles WHERE name = ANY($1::text[])", list(requested_roles))
        role_ids = {row["name"]: row["id"] for row in available_roles}
        if set(role_ids) != requested_roles:
            raise ValueError("One or more selected roles are not configured locally")
        if hostel_ids:
            valid_hostels = await conn.fetchval("SELECT COUNT(*) FROM hostels WHERE id = ANY($1::uuid[])", hostel_ids)
            if valid_hostels != len(set(hostel_ids)):
                raise ValueError("One or more selected hostels do not exist")

        keycloak_id = target["keycloak_user_id"]
        if requested_roles and not keycloak_id:
            keycloak_id, _ = await self._provision_keycloak_identity(conn, user_id)
        if keycloak_id:
            await keycloak_client.update_user_roles(keycloak_id, list(requested_roles), list(OPERATIONAL_ROLES))

        # NOTE: Changing roles, location grants, or access control NEVER resets the user's password.
        # Password resets are strictly explicit and handled via issue_or_reset_credentials.

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

                # Cascading Revocation of dependent location grants
                guard_roles = {"GUARD", "SECURITY_GUARD", "SECURITY_SUPERVISOR", "GATE_OPERATOR"}
                warden_roles = {"WARDEN", "HOSTEL_OPERATOR"}

                had_guard = bool(before_roles.intersection(guard_roles))
                has_guard = bool(after_roles.intersection(guard_roles))
                if had_guard and not has_guard:
                    # Guard role removed: revoke all gate and checkpoint location grants
                    gate_grants = await conn.fetch("""
                        SELECT ula.id, ula.location_id, l.name AS location_name
                        FROM user_location_access ula
                        JOIN locations l ON l.id = ula.location_id
                        WHERE ula.user_id = $1 AND ula.status = 'active'
                          AND (l.type IN ('gate', 'checkpoint', 'turnstile', 'security', 'control_room')
                               OR l.name ILIKE '%gate%' OR l.name ILIKE '%barrier%')
                    """, user_id)
                    for gg in gate_grants:
                        await conn.execute("""
                            UPDATE user_location_access
                            SET status = 'revoked', revoked_at = now(), revoked_by = $1, updated_at = now()
                            WHERE id = $2
                        """, actor_local_id, gg["id"])
                        await audit_service.log(
                            conn, audit_actor_id, "LOCATION_ACCESS_REVOKED", "user", str(user_id),
                            before_state={"location_id": str(gg["location_id"]), "location_name": gg["location_name"], "reason": "Operational role (Guard) removed"},
                        )

                had_warden = bool(before_roles.intersection(warden_roles))
                has_warden = bool(after_roles.intersection(warden_roles))
                if had_warden and not has_warden:
                    # Warden role removed: revoke all hostel location grants
                    hostel_grants = await conn.fetch("""
                        SELECT ula.id, ula.location_id, l.name AS location_name
                        FROM user_location_access ula
                        JOIN locations l ON l.id = ula.location_id
                        WHERE ula.user_id = $1 AND ula.status = 'active'
                          AND (l.type IN ('hostel', 'residential', 'zone') OR l.name ILIKE '%hostel%')
                    """, user_id)
                    for hg in hostel_grants:
                        await conn.execute("""
                            UPDATE user_location_access
                            SET status = 'revoked', revoked_at = now(), revoked_by = $1, updated_at = now()
                            WHERE id = $2
                        """, actor_local_id, hg["id"])
                        await audit_service.log(
                            conn, audit_actor_id, "LOCATION_ACCESS_REVOKED", "user", str(user_id),
                            before_state={"location_id": str(hg["location_id"]), "location_name": hg["location_name"], "reason": "Operational role (Warden) removed"},
                        )

                if before_roles and not after_roles:
                    # All operational roles removed: revoke any operational location grants
                    all_grants = await conn.fetch("""
                        SELECT ula.id, ula.location_id, l.name AS location_name
                        FROM user_location_access ula
                        JOIN locations l ON l.id = ula.location_id
                        WHERE ula.user_id = $1 AND ula.status = 'active'
                    """, user_id)
                    for ag in all_grants:
                        await conn.execute("""
                            UPDATE user_location_access
                            SET status = 'revoked', revoked_at = now(), revoked_by = $1, updated_at = now()
                            WHERE id = $2
                        """, actor_local_id, ag["id"])
                        await audit_service.log(
                            conn, audit_actor_id, "LOCATION_ACCESS_REVOKED", "user", str(user_id),
                            before_state={"location_id": str(ag["location_id"]), "location_name": ag["location_name"], "reason": "All operational roles removed"},
                        )

                await audit_service.log(conn, audit_actor_id, "ACCESS_CONFIGURATION_UPDATED", "user", str(user_id), before, after)
        except Exception:
            try:
                if keycloak_id:
                    await keycloak_client.update_user_roles(keycloak_id, before["roles"], list(OPERATIONAL_ROLES))
            except Exception as rollback_error:
                logger.critical("Keycloak role rollback failed for user %s: %s", user_id, rollback_error)
            raise

        # If location_ids was explicitly passed, synchronize location grants as well
        if location_ids is not None:
            from app.services.access_service import access_service
            await access_service.sync_user_location_grants(
                conn=conn,
                user_id=user_id,
                location_ids=location_ids,
                access_level="ENTRY",
                admin_id=actor_local_id,
                reason="Synchronized via Access Management",
            )

        logger.info(
            "ACCESS ROLES SYNCHRONIZED | User ID: %s | Email: %s | Keycloak ID: %s | Roles: %s | Hostels: %s",
            user_id, target["email"], keycloak_id or "unlinked",
            ", ".join(sorted(requested_roles)) or "None",
            ", ".join(h["name"] for h in after["hostels"]) or "None",
        )
        dash = self.get_dashboard_info(requested_roles)
        after["credentials_issued"] = False
        after["credentials_printed"] = False
        after["dashboard_path"] = dash["path"]
        after["dashboard_name"] = dash["name"]
        after["credentials"] = {
            "username": target["email"].lower(),
            "email": target["email"].lower(),
            "password": None,
            "dashboard_path": dash["path"],
            "dashboard_name": dash["name"],
            "roles": sorted(list(requested_roles)),
        }
        return after

    async def issue_or_reset_credentials(
        self, conn: asyncpg.Connection, actor_id: Optional[str], user_id: uuid.UUID,
        custom_password: Optional[str] = None
    ) -> dict[str, Any]:
        """Generate or reset Keycloak credentials and return full access and dashboard details."""
        target = await conn.fetchrow(
            """
            SELECT u.id, u.keycloak_user_id, u.email, u.user_type,
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

        password_to_set = custom_password.strip() if custom_password and custom_password.strip() else self._temporary_password()

        keycloak_id = target["keycloak_user_id"]
        if keycloak_id:
            kc_user = await keycloak_client.get_user_by_id(keycloak_id)
            if not kc_user:
                keycloak_id = None

        if not keycloak_id:
            existing = await keycloak_client.get_user_by_email(target["email"])
            if existing:
                keycloak_id = existing["id"]
            else:
                name_parts = str(target["full_name"]).strip().split(maxsplit=1)
                first_name = name_parts[0] if name_parts else target["email"].lower()
                last_name = name_parts[1] if len(name_parts) > 1 else (str(target["user_type"]).capitalize() if "user_type" in target and target["user_type"] else "User")
                keycloak_id = await keycloak_client.create_user(
                    username=target["email"].lower(),
                    email=target["email"].lower(),
                    first_name=first_name,
                    last_name=last_name,
                    password=password_to_set,
                    attributes={"user_type": [target["user_type"]], "user_id": [str(user_id)]},
                    temporary_password=False,
                )
            await conn.execute("UPDATE users SET keycloak_user_id=$1, updated_at=now() WHERE id=$2", keycloak_id, user_id)

        # Set password and clear required actions in Keycloak
        await keycloak_client.reset_password(keycloak_id, password_to_set, temporary=False)
        await keycloak_client.clear_required_actions(keycloak_id)

        # Ensure current roles are mapped in Keycloak
        current_access = await self.get_user_access(conn, user_id)
        current_roles = current_access["roles"]
        if current_roles:
            await keycloak_client.update_user_roles(keycloak_id, current_roles, list(OPERATIONAL_ROLES))

        # Fetch active location grants
        locations = await conn.fetch(
            """
            SELECT l.id, l.name, l.type, ula.access_level, ula.valid_until
            FROM user_location_access ula
            JOIN locations l ON l.id = ula.location_id
            WHERE ula.user_id = $1 AND ula.status = 'active'
            ORDER BY l.name
            """,
            user_id
        )

        dash = self.get_dashboard_info(current_roles)

        actor_local_id = await conn.fetchval("SELECT id FROM users WHERE keycloak_user_id=$1", actor_id) if actor_id else None
        audit_actor_id = str(actor_local_id) if actor_local_id else None
        await audit_service.log(
            conn=conn,
            actor_id=audit_actor_id,
            operation="CREDENTIALS_ISSUED",
            entity_type="user",
            entity_id=str(user_id),
            after_state={"email": target["email"], "roles": current_roles},
        )

        return {
            "user_id": str(user_id),
            "email": target["email"].lower(),
            "username": target["email"].lower(),
            "full_name": target["full_name"],
            "password": password_to_set,
            "keycloak_user_id": keycloak_id,
            "roles": current_roles,
            "hostels": current_access["hostels"],
            "locations": [
                {
                    "id": str(loc["id"]),
                    "name": loc["name"],
                    "type": loc["type"],
                    "access_level": loc["access_level"],
                    "valid_until": loc["valid_until"].isoformat() if loc["valid_until"] else None,
                }
                for loc in locations
            ],
            "dashboard_path": dash["path"],
            "dashboard_name": dash["name"],
            "category": dash["category"],
        }


role_service = RoleService()
