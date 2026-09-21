from __future__ import annotations

import logging
from typing import Any, Optional
import uuid
import asyncpg

from app.schemas.registration import (
    RegisteredUser,
    RegistrationListResult,
    RegistrationRequest,
    RegistrationStats,
)
from app.schemas.user import CreateUserRequest, ProfileRequest
from app.services.audit_service import audit_service
from app.services.user_service import user_service

logger = logging.getLogger(__name__)


class RegistrationService:
    async def register(self, conn: asyncpg.Connection, req: RegistrationRequest) -> RegisteredUser:
        p_req = ProfileRequest(
            full_name=req.full_name,
            roll_number=req.roll_number,
            employee_id=req.employee_id,
            department=req.department,
            department_id=req.department_id,
            hostel_id=req.hostel_id,
            emergency_contact=req.emergency_contact,
            guardian_contact=req.guardian_contact,
            gov_id_type=req.gov_id_type,
            gov_id_number=req.gov_id_number,
            visit_purpose=req.visit_purpose,
            host_contact=req.host_contact,
            visit_start=req.visit_start,
            visit_duration_days=req.visit_duration_days,
            designation=req.worker_type,
        )

        user_req = CreateUserRequest(
            user_type=req.role.lower(),
            email=req.email,
            phone=req.phone,
            password=req.password or "",
            profile=p_req,
        )

        u = await user_service.create_user(conn, actor_id=None, req=user_req)

        await audit_service.log(
            conn=conn,
            actor_id=None,
            operation="PUBLIC_REGISTRATION",
            entity_type="user",
            entity_id=u.id,
            after_state=u.model_dump(),
        )

        return RegisteredUser(
            id=u.id,
            role=u.user_type,
            full_name=req.full_name,
            email=u.email,
            phone=u.phone or "",
            status=u.status,
            created_at=u.created_at,
            roll_number=req.roll_number,
            employee_id=req.employee_id,
            department=req.department,
            hostel=req.hostel,
            emergency_contact=req.emergency_contact,
            guardian_contact=req.guardian_contact,
            gov_id_type=req.gov_id_type,
            gov_id_number=req.gov_id_number,
            visit_purpose=req.visit_purpose,
            host_contact=req.host_contact,
        )

    async def list_registrations(
        self,
        conn: asyncpg.Connection,
        role: Optional[str] = None,
        search: Optional[str] = None,
        page: int = 1,
        limit: int = 20,
    ) -> RegistrationListResult:
        res = await user_service.list_users(
            conn=conn,
            search=search,
            user_type=role,
            page=page,
            limit=limit,
        )

        reg_users = []
        for u in res.users:
            prof = u.profile
            reg_users.append(
                RegisteredUser(
                    id=u.id,
                    role=u.user_type,
                    full_name=prof.full_name if prof else "",
                    email=u.email,
                    phone=u.phone or "",
                    status=u.status,
                    created_at=u.created_at,
                    roll_number=prof.roll_number if prof else None,
                    employee_id=prof.employee_id if prof else None,
                    department=prof.department if prof else None,
                    emergency_contact=prof.emergency_contact if prof else None,
                    guardian_contact=prof.guardian_contact if prof else None,
                    gov_id_type=prof.gov_id_type if prof else None,
                    gov_id_number=prof.gov_id_number if prof else None,
                    visit_purpose=prof.visit_purpose if prof else None,
                    host_contact=prof.host_contact if prof else None,
                )
            )

        return RegistrationListResult(
            users=reg_users,
            total=res.total,
            page=res.page,
            limit=res.limit,
            total_pages=res.total_pages,
        )

    async def get_stats(self, conn: asyncpg.Connection) -> RegistrationStats:
        stats = await user_service.get_stats(conn)
        return RegistrationStats(
            total=stats.total_users,
            students=stats.students,
            faculty=stats.faculty,
            workers=stats.workers,
            visitors=stats.visitors,
        )


registration_service = RegistrationService()
