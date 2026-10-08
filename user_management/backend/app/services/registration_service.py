from __future__ import annotations
import logging
from typing import Any, Dict, List, Optional, Set
import uuid
from datetime import datetime, timedelta, timezone
import asyncpg

from app.schemas.registration import (
    RegisteredUser,
    RegistrationListResult,
    RegistrationRequest,
    RegistrationStats,
)
from app.services.audit_service import audit_service
from app.services.user_service import user_service
from app.services.role_service import role_service
from app.core.keycloak_client import keycloak_client

logger = logging.getLogger(__name__)


class RegistrationService:
    @staticmethod
    def _resolve_roles(role_str: Optional[str], roles_list: Optional[List[str]], job_type: Optional[str] = None) -> List[str]:
        resolved: Set[str] = set()

        # Add explicit list if provided
        if roles_list:
            for r in roles_list:
                cleaned = str(r).strip().upper()
                if cleaned in {"FACULTY_WARDEN", "FACULTY+WARDEN"}:
                    resolved.add("FACULTY")
                    resolved.add("WARDEN")
                elif cleaned:
                    resolved.add(cleaned)

        # Add single role if provided
        if role_str:
            cleaned = str(role_str).strip().upper()
            if cleaned in {"FACULTY_WARDEN", "FACULTY+WARDEN"}:
                resolved.add("FACULTY")
                resolved.add("WARDEN")
            elif cleaned:
                resolved.add(cleaned)

        # If job type indicates security/guard
        if job_type and any(kw in str(job_type).lower() for kw in ["guard", "security"]):
            resolved.add("GUARD")
            resolved.add("SECURITY_GUARD")

        if not resolved:
            resolved.add("STUDENT")

        return sorted(resolved)

    @staticmethod
    def _determine_primary_user_type(roles: List[str]) -> str:
        role_set = set(roles)
        if "STUDENT" in role_set:
            return "student"
        if "FACULTY" in role_set or "WARDEN" in role_set:
            return "faculty"
        if "WORKER" in role_set or "GUARD" in role_set or "SECURITY_GUARD" in role_set:
            return "worker"
        if "VISITOR" in role_set:
            return "visitor"
        return "student"

    async def register(self, conn: asyncpg.Connection, req: RegistrationRequest) -> RegisteredUser:
        roles = self._resolve_roles(req.role, req.roles, req.job_type or req.worker_type)
        primary_user_type = self._determine_primary_user_type(roles)

        # 1. Check if user already exists (deduplication)
        existing_user = await conn.fetchrow(
            "SELECT id, user_type, email, phone, keycloak_user_id, status FROM users WHERE LOWER(email) = LOWER($1)",
            req.email,
        )

        is_existing_user = existing_user is not None
        user_id = existing_user["id"] if is_existing_user else uuid.uuid4()
        keycloak_id = existing_user["keycloak_user_id"] if is_existing_user else None

        # Resolve department UUID if string/name provided
        dept_uuid: Optional[uuid.UUID] = None
        if req.department_id:
            try:
                dept_uuid = uuid.UUID(str(req.department_id))
            except Exception:
                pass
        elif req.department:
            d_row = await conn.fetchrow("SELECT id FROM departments WHERE name ILIKE $1 OR code ILIKE $1", req.department)
            if d_row:
                dept_uuid = d_row["id"]

        # Resolve hostel UUID if string/name provided
        hostel_uuid: Optional[uuid.UUID] = None
        if req.hostel_id:
            try:
                hostel_uuid = uuid.UUID(str(req.hostel_id))
            except Exception:
                pass
        elif req.hostel:
            h_row = await conn.fetchrow("SELECT id FROM hostels WHERE name ILIKE $1 OR code ILIKE $1", req.hostel)
            if h_row:
                hostel_uuid = h_row["id"]

        # Resolve assigned worker location UUID if provided
        loc_uuid: Optional[uuid.UUID] = None
        if req.assigned_location_id:
            try:
                loc_uuid = uuid.UUID(str(req.assigned_location_id))
            except Exception:
                pass
        elif req.assigned_location:
            l_row = await conn.fetchrow("SELECT id FROM locations WHERE name ILIKE $1", req.assigned_location)
            if l_row:
                loc_uuid = l_row["id"]

        # 2. Keycloak user sync if password is provided or new user
        first_name, last_name = req.full_name, "User"
        if " " in req.full_name.strip():
            parts = req.full_name.strip().split(" ", 1)
            first_name, last_name = parts[0], parts[1]

        if not keycloak_id and req.password:
            try:
                keycloak_id = await keycloak_client.create_user(
                    username=req.email.lower(),
                    email=req.email.lower(),
                    first_name=first_name,
                    last_name=last_name,
                    password=req.password,
                    attributes={"user_type": [primary_user_type], "user_id": [str(user_id)]},
                )
            except Exception as e:
                logger.warning("Keycloak user creation warning: %s", e)
        elif keycloak_id and req.password:
            try:
                await keycloak_client.reset_password(keycloak_id, req.password, temporary=False)
                await keycloak_client.clear_required_actions(keycloak_id)
            except Exception as e:
                logger.warning("Keycloak password reset warning: %s", e)

        # 3. Insert or update users record
        if not is_existing_user:
            await conn.execute(
                """
                INSERT INTO users (id, user_type, status, email, phone, keycloak_user_id, created_at, updated_at)
                VALUES ($1, $2, 'active', $3, $4, $5, now(), now())
                """,
                user_id,
                primary_user_type,
                req.email.lower(),
                req.phone,
                keycloak_id,
            )
        else:
            await conn.execute(
                """
                UPDATE users
                SET phone = COALESCE($1, phone),
                    keycloak_user_id = COALESCE($2, keycloak_user_id),
                    updated_at = now()
                WHERE id = $3
                """,
                req.phone,
                keycloak_id,
                user_id,
            )

        # 4. Save Role-Specific Details
        role_profiles_data: Dict[str, Any] = {}

        # ── STUDENT ──
        if "STUDENT" in roles:
            s_id = req.student_id or req.roll_number
            await conn.execute(
                """
                INSERT INTO student_profiles (
                    user_id, full_name, roll_number, department_id, course, semester,
                    batch, hostel_id, room_number, emergency_contact, guardian_contact,
                    nationality, gov_id_type, gov_id_number, updated_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, now())
                ON CONFLICT (user_id) DO UPDATE SET
                    full_name = EXCLUDED.full_name,
                    roll_number = COALESCE(EXCLUDED.roll_number, student_profiles.roll_number),
                    department_id = COALESCE(EXCLUDED.department_id, student_profiles.department_id),
                    course = COALESCE(EXCLUDED.course, student_profiles.course),
                    semester = COALESCE(EXCLUDED.semester, student_profiles.semester),
                    batch = COALESCE(EXCLUDED.batch, student_profiles.batch),
                    hostel_id = COALESCE(EXCLUDED.hostel_id, student_profiles.hostel_id),
                    room_number = COALESCE(EXCLUDED.room_number, student_profiles.room_number),
                    emergency_contact = COALESCE(EXCLUDED.emergency_contact, student_profiles.emergency_contact),
                    guardian_contact = COALESCE(EXCLUDED.guardian_contact, student_profiles.guardian_contact),
                    nationality = COALESCE(EXCLUDED.nationality, student_profiles.nationality),
                    gov_id_type = COALESCE(EXCLUDED.gov_id_type, student_profiles.gov_id_type),
                    gov_id_number = COALESCE(EXCLUDED.gov_id_number, student_profiles.gov_id_number),
                    updated_at = now()
                """,
                user_id, req.full_name, s_id, dept_uuid, req.course, req.semester,
                req.batch, hostel_uuid, req.room_number, req.emergency_contact, req.guardian_contact,
                req.nationality, req.gov_id_type, req.gov_id_number,
            )
            # Ensure hostel status is ready if hosteller
            if hostel_uuid:
                await conn.execute(
                    """
                    INSERT INTO student_hostel_status (student_id, current_status, last_event_time)
                    VALUES ($1, 'INSIDE', now())
                    ON CONFLICT (student_id) DO NOTHING
                    """,
                    user_id,
                )
            role_profiles_data["student"] = {
                "student_id": s_id,
                "course": req.course,
                "department": req.department,
                "semester": req.semester,
                "batch": req.batch,
                "hostel_id": str(hostel_uuid) if hostel_uuid else None,
                "room_number": req.room_number,
            }

        # ── FACULTY ──
        if "FACULTY" in roles:
            f_id = req.faculty_id or req.employee_id
            await conn.execute(
                """
                INSERT INTO faculty_profiles (
                    user_id, full_name, employee_id, department_id, designation,
                    courses, assigned_students, emergency_contact, updated_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now())
                ON CONFLICT (user_id) DO UPDATE SET
                    full_name = EXCLUDED.full_name,
                    employee_id = COALESCE(EXCLUDED.employee_id, faculty_profiles.employee_id),
                    department_id = COALESCE(EXCLUDED.department_id, faculty_profiles.department_id),
                    designation = COALESCE(EXCLUDED.designation, faculty_profiles.designation),
                    courses = COALESCE(EXCLUDED.courses, faculty_profiles.courses),
                    assigned_students = COALESCE(EXCLUDED.assigned_students, faculty_profiles.assigned_students),
                    emergency_contact = COALESCE(EXCLUDED.emergency_contact, faculty_profiles.emergency_contact),
                    updated_at = now()
                """,
                user_id, req.full_name, f_id, dept_uuid, req.designation,
                req.courses, req.assigned_students, req.emergency_contact,
            )
            role_profiles_data["faculty"] = {
                "faculty_id": f_id,
                "department": req.department,
                "designation": req.designation,
                "courses": req.courses,
                "assigned_students": req.assigned_students,
            }

        # ── WARDEN (Faculty + Warden or Warden) ──
        if "WARDEN" in roles:
            resp = req.warden_responsibilities or "Hostel Caretaker & Disciplinary Warden"
            await conn.execute(
                """
                INSERT INTO warden_profiles (
                    user_id, hostel_id, hostel_block, responsibilities, emergency_contact, updated_at
                ) VALUES ($1, $2, $3, $4, $5, now())
                ON CONFLICT (user_id) DO UPDATE SET
                    hostel_id = COALESCE(EXCLUDED.hostel_id, warden_profiles.hostel_id),
                    hostel_block = COALESCE(EXCLUDED.hostel_block, warden_profiles.hostel_block),
                    responsibilities = COALESCE(EXCLUDED.responsibilities, warden_profiles.responsibilities),
                    emergency_contact = COALESCE(EXCLUDED.emergency_contact, warden_profiles.emergency_contact),
                    updated_at = now()
                """,
                user_id, hostel_uuid, req.hostel_block, resp, req.emergency_contact,
            )
            if hostel_uuid:
                await conn.execute(
                    """
                    INSERT INTO warden_hostels (id, user_id, hostel_id, hostel_block, responsibilities, created_at, updated_at)
                    VALUES (gen_random_uuid(), $1, $2, $3, $4, now(), now())
                    ON CONFLICT DO NOTHING
                    """,
                    user_id, hostel_uuid, req.hostel_block, resp,
                )
            role_profiles_data["warden"] = {
                "hostel_id": str(hostel_uuid) if hostel_uuid else None,
                "hostel_block": req.hostel_block,
                "responsibilities": resp,
            }

        # ── WORKER ──
        if "WORKER" in roles or "GUARD" in roles or "SECURITY_GUARD" in roles:
            w_id = req.worker_id or req.employee_id
            job = req.job_type or req.worker_type or req.designation or "Campus Operations"
            await conn.execute(
                """
                INSERT INTO worker_profiles (
                    user_id, full_name, employee_id, department_id, designation,
                    job_type, work_area, shift, assigned_location_id, emergency_contact, updated_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, now())
                ON CONFLICT (user_id) DO UPDATE SET
                    full_name = EXCLUDED.full_name,
                    employee_id = COALESCE(EXCLUDED.employee_id, worker_profiles.employee_id),
                    department_id = COALESCE(EXCLUDED.department_id, worker_profiles.department_id),
                    designation = COALESCE(EXCLUDED.designation, worker_profiles.designation),
                    job_type = COALESCE(EXCLUDED.job_type, worker_profiles.job_type),
                    work_area = COALESCE(EXCLUDED.work_area, worker_profiles.work_area),
                    shift = COALESCE(EXCLUDED.shift, worker_profiles.shift),
                    assigned_location_id = COALESCE(EXCLUDED.assigned_location_id, worker_profiles.assigned_location_id),
                    emergency_contact = COALESCE(EXCLUDED.emergency_contact, worker_profiles.emergency_contact),
                    updated_at = now()
                """,
                user_id, req.full_name, w_id, dept_uuid, job,
                job, req.work_area, req.shift, loc_uuid, req.emergency_contact,
            )
            # Grant location access for assigned work area if provided
            if loc_uuid:
                await conn.execute(
                    """
                    INSERT INTO user_location_access (id, user_id, location_id, access_level, status, reason, created_at, updated_at)
                    VALUES (gen_random_uuid(), $1, $2, 'ENTRY', 'active', $3, now(), now())
                    ON CONFLICT (user_id, location_id, access_level) DO NOTHING
                    """,
                    user_id, loc_uuid, f"Shift: {req.shift or 'Standard'} | Area: {req.work_area or 'General'}",
                )
            role_profiles_data["worker"] = {
                "worker_id": w_id,
                "job_type": job,
                "department": req.department,
                "work_area": req.work_area,
                "shift": req.shift,
                "assigned_location_id": str(loc_uuid) if loc_uuid else None,
            }

        # ── VISITOR ──
        if "VISITOR" in roles:
            v_start: Optional[datetime] = None
            if req.visit_start:
                try:
                    v_start = datetime.fromisoformat(req.visit_start.replace("Z", "+00:00"))
                except Exception:
                    v_start = datetime.now(timezone.utc)
            else:
                v_start = datetime.now(timezone.utc)

            duration = req.visit_duration_days or 1
            valid_until_dt: datetime = v_start + timedelta(days=duration)

            allowed_uuids: List[uuid.UUID] = []
            if req.allowed_location_ids:
                for a_id in req.allowed_location_ids:
                    try:
                        allowed_uuids.append(uuid.UUID(str(a_id)))
                    except Exception:
                        pass

            await conn.execute(
                """
                INSERT INTO visitor_profiles (
                    user_id, full_name, gov_id_type, gov_id_number, visit_purpose,
                    host_person, host_contact, visit_start, visit_duration_days,
                    valid_until, allowed_location_ids, accompanying_count, accompanying_details, updated_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, now())
                ON CONFLICT (user_id) DO UPDATE SET
                    full_name = EXCLUDED.full_name,
                    gov_id_type = COALESCE(EXCLUDED.gov_id_type, visitor_profiles.gov_id_type),
                    gov_id_number = COALESCE(EXCLUDED.gov_id_number, visitor_profiles.gov_id_number),
                    visit_purpose = COALESCE(EXCLUDED.visit_purpose, visitor_profiles.visit_purpose),
                    host_person = COALESCE(EXCLUDED.host_person, visitor_profiles.host_person),
                    host_contact = COALESCE(EXCLUDED.host_contact, visitor_profiles.host_contact),
                    visit_start = COALESCE(EXCLUDED.visit_start, visitor_profiles.visit_start),
                    visit_duration_days = COALESCE(EXCLUDED.visit_duration_days, visitor_profiles.visit_duration_days),
                    valid_until = COALESCE(EXCLUDED.valid_until, visitor_profiles.valid_until),
                    allowed_location_ids = COALESCE(EXCLUDED.allowed_location_ids, visitor_profiles.allowed_location_ids),
                    accompanying_count = EXCLUDED.accompanying_count,
                    accompanying_details = EXCLUDED.accompanying_details,
                    updated_at = now()
                """,
                user_id, req.full_name, req.gov_id_type, req.gov_id_number, req.visit_purpose,
                req.host_person, req.host_contact, v_start, duration, valid_until_dt, allowed_uuids,
                max(0, req.accompanying_count or 0), (req.accompanying_details or "").strip(),
            )

            # Grant temporary access to allowed locations
            for a_uuid in allowed_uuids:
                await conn.execute(
                    """
                    INSERT INTO user_location_access (
                        id, user_id, location_id, access_level, status, valid_from, valid_until, reason, created_at, updated_at
                    ) VALUES (gen_random_uuid(), $1, $2, 'ENTRY', 'active', $3, $4, $5, now(), now())
                    ON CONFLICT (user_id, location_id, access_level) DO NOTHING
                    """,
                    user_id, a_uuid, v_start, valid_until_dt, f"Visitor Pass: {req.visit_purpose or 'Campus Visit'}",
                )

            role_profiles_data["visitor"] = {
                "purpose": req.visit_purpose,
                "host_person": req.host_person,
                "host_contact": req.host_contact,
                "valid_until": valid_until_dt.isoformat(),
                "allowed_locations": [str(x) for x in allowed_uuids],
            }

        # 5. Assign roles in user_roles and Keycloak
        db_roles = await conn.fetch("SELECT id, name FROM roles WHERE name = ANY($1::text[])", roles)
        for r_row in db_roles:
            await conn.execute(
                """
                INSERT INTO user_roles (user_id, role_id, assigned_at)
                VALUES ($1, $2, now())
                ON CONFLICT (user_id, role_id) DO NOTHING
                """,
                user_id,
                r_row["id"],
            )

        if keycloak_id:
            try:
                await role_service.sync_keycloak_roles(keycloak_id, roles)
            except Exception as e:
                logger.warning("Keycloak role mapping sync warning: %s", e)

        # 6. Synchronize denormalized user_profiles table for backwards compatibility
        try:
            await conn.execute(
                """
                INSERT INTO user_profiles (
                    user_id, full_name, roll_number, employee_id, department_id, department,
                    course, semester, batch, room_number, designation, courses, assigned_students,
                    hostel_flag, hostel_id, hostel_block, warden_responsibilities,
                    job_type, work_area, shift, assigned_location_id,
                    emergency_contact, guardian_contact, gov_id_type, gov_id_number,
                    visit_purpose, host_person, host_contact, valid_until, updated_at
                ) VALUES (
                    $1, $2, $3, $4, $5, $6,
                    $7, $8, $9, $10, $11, $12, $13,
                    $14, $15, $16, $17,
                    $18, $19, $20, $21,
                    $22, $23, $24, $25,
                    $26, $27, $28, $29, now()
                ) ON CONFLICT (user_id) DO UPDATE SET
                    full_name = EXCLUDED.full_name,
                    roll_number = COALESCE(EXCLUDED.roll_number, user_profiles.roll_number),
                    employee_id = COALESCE(EXCLUDED.employee_id, user_profiles.employee_id),
                    department_id = COALESCE(EXCLUDED.department_id, user_profiles.department_id),
                    department = COALESCE(EXCLUDED.department, user_profiles.department),
                    course = COALESCE(EXCLUDED.course, user_profiles.course),
                    semester = COALESCE(EXCLUDED.semester, user_profiles.semester),
                    batch = COALESCE(EXCLUDED.batch, user_profiles.batch),
                    room_number = COALESCE(EXCLUDED.room_number, user_profiles.room_number),
                    designation = COALESCE(EXCLUDED.designation, user_profiles.designation),
                    courses = COALESCE(EXCLUDED.courses, user_profiles.courses),
                    assigned_students = COALESCE(EXCLUDED.assigned_students, user_profiles.assigned_students),
                    hostel_flag = COALESCE(EXCLUDED.hostel_flag, user_profiles.hostel_flag),
                    hostel_id = COALESCE(EXCLUDED.hostel_id, user_profiles.hostel_id),
                    hostel_block = COALESCE(EXCLUDED.hostel_block, user_profiles.hostel_block),
                    warden_responsibilities = COALESCE(EXCLUDED.warden_responsibilities, user_profiles.warden_responsibilities),
                    job_type = COALESCE(EXCLUDED.job_type, user_profiles.job_type),
                    work_area = COALESCE(EXCLUDED.work_area, user_profiles.work_area),
                    shift = COALESCE(EXCLUDED.shift, user_profiles.shift),
                    assigned_location_id = COALESCE(EXCLUDED.assigned_location_id, user_profiles.assigned_location_id),
                    emergency_contact = COALESCE(EXCLUDED.emergency_contact, user_profiles.emergency_contact),
                    guardian_contact = COALESCE(EXCLUDED.guardian_contact, user_profiles.guardian_contact),
                    gov_id_type = COALESCE(EXCLUDED.gov_id_type, user_profiles.gov_id_type),
                    gov_id_number = COALESCE(EXCLUDED.gov_id_number, user_profiles.gov_id_number),
                    visit_purpose = COALESCE(EXCLUDED.visit_purpose, user_profiles.visit_purpose),
                    host_person = COALESCE(EXCLUDED.host_person, user_profiles.host_person),
                    host_contact = COALESCE(EXCLUDED.host_contact, user_profiles.host_contact),
                    valid_until = COALESCE(EXCLUDED.valid_until, user_profiles.valid_until),
                    updated_at = now()
                """,
                user_id, req.full_name, req.student_id or req.roll_number, req.faculty_id or req.worker_id or req.employee_id,
                dept_uuid, req.department, req.course, req.semester, req.batch, req.room_number,
                req.designation, req.courses, req.assigned_students,
                bool(hostel_uuid), hostel_uuid, req.hostel_block, req.warden_responsibilities,
                req.job_type or req.worker_type, req.work_area, req.shift, loc_uuid,
                req.emergency_contact, req.guardian_contact, req.gov_id_type, req.gov_id_number,
                req.visit_purpose, req.host_person, req.host_contact,
                (datetime.now(timezone.utc) + timedelta(days=req.visit_duration_days or 1)) if req.visit_purpose else None,
            )
        except Exception as e:
            logger.warning("user_profiles compatibility sync warning: %s", e)

        dash_info = role_service.get_dashboard_info(roles)

        await audit_service.log(
            conn=conn,
            actor_id=None,
            operation="USER_REGISTERED_MULTI_ROLE",
            entity_type="user",
            entity_id=str(user_id),
            after_state={
                "roles": roles,
                "primary_type": primary_user_type,
                "is_existing": is_existing_user,
            },
        )

        return RegisteredUser(
            id=str(user_id),
            role=primary_user_type,
            roles=roles,
            full_name=req.full_name,
            email=req.email.lower(),
            phone=req.phone or "",
            status="active",
            created_at=datetime.now(timezone.utc).isoformat(),
            is_existing_user=is_existing_user,
            dashboard_path=dash_info["path"],
            dashboard_name=dash_info["name"],
            role_profiles=role_profiles_data,
            roll_number=req.student_id or req.roll_number,
            employee_id=req.faculty_id or req.worker_id or req.employee_id,
            department=req.department,
            hostel=req.hostel,
            batch=req.batch,
            room_number=req.room_number,
            designation=req.designation,
            courses=req.courses,
            job_type=req.job_type or req.worker_type,
            shift=req.shift,
            work_area=req.work_area,
            emergency_contact=req.emergency_contact,
            guardian_contact=req.guardian_contact,
            gov_id_type=req.gov_id_type,
            gov_id_number=req.gov_id_number,
            visit_purpose=req.visit_purpose,
            host_person=req.host_person,
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
                    roles=u.roles,
                    full_name=prof.full_name if prof else "",
                    email=u.email,
                    phone=u.phone or "",
                    status=u.status,
                    created_at=u.created_at,
                    roll_number=prof.roll_number if prof else None,
                    employee_id=prof.employee_id if prof else None,
                    department=prof.department if prof else None,
                    batch=prof.batch if prof else None,
                    room_number=prof.room_number if prof else None,
                    designation=prof.designation if prof else None,
                    courses=prof.courses if prof else None,
                    job_type=prof.job_type if prof else None,
                    shift=prof.shift if prof else None,
                    work_area=prof.work_area if prof else None,
                    emergency_contact=prof.emergency_contact if prof else None,
                    guardian_contact=prof.guardian_contact if prof else None,
                    gov_id_type=prof.gov_id_type if prof else None,
                    gov_id_number=prof.gov_id_number if prof else None,
                    visit_purpose=prof.visit_purpose if prof else None,
                    host_person=prof.host_person if prof else None,
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
