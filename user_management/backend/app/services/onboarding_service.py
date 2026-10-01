from __future__ import annotations
import logging
from typing import Optional
import uuid
import asyncpg

from app.schemas.onboarding import OnboardingRequest, OnboardingResult
from app.schemas.rfid import Card
from app.services.audit_service import audit_service
from app.services.rfid_service import rfid_service
from app.services.user_service import user_service

logger = logging.getLogger(__name__)

class OnboardingService:
    async def onboard(
        self,
        conn: asyncpg.Connection,
        actor_id: Optional[str],
        req: OnboardingRequest,
    ) -> OnboardingResult:
        req.user.user_type = req.persona.lower()
        if req.roles:
            req.user.roles = req.roles
        created_user = await user_service.create_user(conn, actor_id, req.user)

        await audit_service.log(
            conn=conn,
            actor_id=actor_id,
            operation="ONBOARDING_STARTED",
            entity_type="user",
            entity_id=created_user.id,
            after_state=created_user.model_dump(),
        )

        return OnboardingResult(
            user=created_user,
            card_issued=False,
            message="user created — proceed to RFID enrollment",
        )

    async def enroll_rfid(
        self,
        conn: asyncpg.Connection,
        actor_id: Optional[str],
        user_id: uuid.UUID,
        uid: str,
    ) -> Card:
        card = await rfid_service.assign(conn, actor_id, user_id, uid)
        await audit_service.log(
            conn=conn,
            actor_id=actor_id,
            operation="RFID_ENROLLED",
            entity_type="rfid_card",
            entity_id=card.id,
            after_state=card.model_dump(),
        )
        return card

    async def issue_card(
        self,
        conn: asyncpg.Connection,
        actor_id: Optional[str],
        user_id: uuid.UUID,
    ) -> OnboardingResult:
        user = await user_service.get_by_id(conn, user_id)
        if not user:
            raise ValueError("User not found")

        active_card = None
        if user.active_rfid:
            active_card = await rfid_service.get_by_uid(conn, user.active_rfid)

        await audit_service.log(
            conn=conn,
            actor_id=actor_id,
            operation="ONBOARDING_COMPLETED",
            entity_type="user",
            entity_id=str(user_id),
            after_state=user.model_dump(),
        )

        return OnboardingResult(
            user=user,
            rfid_card=active_card,
            card_issued=active_card is not None,
            message="Card issued successfully" if active_card else "User onboarding finalized",
        )


onboarding_service = OnboardingService()
