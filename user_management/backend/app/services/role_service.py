from __future__ import annotations

import logging
from typing import List, Optional
import uuid
import asyncpg

from app.schemas.role import CreateRoleRequest, Role
from app.services.audit_service import audit_service

logger = logging.getLogger(__name__)


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


role_service = RoleService()
