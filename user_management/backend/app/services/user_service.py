from __future__ import annotations

import csv
import io
import logging
from typing import Any, Dict, List, Optional, Tuple
import uuid
import asyncpg

from app.core.keycloak_client import keycloak_client
from app.schemas.user import (
    CreateUserRequest,
    Department,
    Hostel,
    Profile,
    ProfileRequest,
    Stats,
    UpdateUserRequest,
    User,
    UserListResult,
)
from app.services.audit_service import audit_service

logger = logging.getLogger(__name__)


class UserService:
    async def list_users(
        self,
        conn: asyncpg.Connection,
        search: Optional[str] = None,
        user_type: Optional[str] = None,
        status: Optional[str] = None,
        school: Optional[str] = None,
        department: Optional[str] = None,
        course: Optional[str] = None,
        semester: Optional[str] = None,
        hostel_id: Optional[str] = None,
        hostel_status: Optional[str] = None,
        role: Optional[str] = None,
        page: int = 1,
        limit: int = 20,
    ) -> UserListResult:
        page = max(1, page)
        limit = min(max(1, limit), 200)
        offset = (page - 1) * limit

        clauses = []
        args = []
        idx = 1

        if user_type and user_type.strip():
            clauses.append(f"u.user_type = ${idx}")
            args.append(user_type.strip().lower())
            idx += 1
        if status and status.strip():
            clauses.append(f"u.status = ${idx}")
            args.append(status.strip().lower())
            idx += 1
        if school and school.strip():
            clauses.append(f"d.school = ${idx}")
            args.append(school.strip())
            idx += 1
        if department and department.strip():
            clauses.append(f"d.name = ${idx}")
            args.append(department.strip())
            idx += 1
        if course and course.strip():
            clauses.append(f"sp.course = ${idx}")
            args.append(course.strip())
            idx += 1
        if semester and semester.strip():
            clauses.append(f"sp.semester = ${idx}")
            args.append(semester.strip())
            idx += 1
        if hostel_id and hostel_id.strip():
            try:
                h_uuid = uuid.UUID(hostel_id.strip())
                clauses.append(f"sp.hostel_id = ${idx}")
                args.append(h_uuid)
                idx += 1
            except Exception:
                pass
        if hostel_status and hostel_status.strip() == "hosteller":
            clauses.append("sp.hostel_id IS NOT NULL")
        elif hostel_status and hostel_status.strip() == "day_scholar":
            clauses.append("sp.hostel_id IS NULL")

        if search and search.strip():
            s_pat = f"%{search.strip()}%"
            clauses.append(
                f"(u.email ILIKE ${idx} OR u.phone ILIKE ${idx} OR "
                f"sp.full_name ILIKE ${idx} OR fp.full_name ILIKE ${idx} OR "
                f"wp.full_name ILIKE ${idx} OR vp.full_name ILIKE ${idx} OR "
                f"sp.roll_number ILIKE ${idx} OR fp.employee_id ILIKE ${idx} OR "
                f"wp.employee_id ILIKE ${idx})"
            )
            args.append(s_pat)
            idx += 1

        if role and role.strip():
            clauses.append(f"EXISTS (SELECT 1 FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE ur.user_id = u.id AND r.name = ${idx})")
            args.append(role.strip())
            idx += 1

        where_sql = f"WHERE {' AND '.join(clauses)}" if clauses else ""

        base_from = f"""
            FROM users u
            LEFT JOIN student_profiles sp ON sp.user_id = u.id AND u.user_type = 'student'
            LEFT JOIN faculty_profiles fp ON fp.user_id = u.id AND u.user_type = 'faculty'
            LEFT JOIN worker_profiles wp ON wp.user_id = u.id AND u.user_type = 'worker'
            LEFT JOIN visitor_profiles vp ON vp.user_id = u.id AND u.user_type = 'visitor'
            LEFT JOIN departments d ON d.id = COALESCE(sp.department_id, fp.department_id, wp.department_id)
            {where_sql}
        """

        total = await conn.fetchval(f"SELECT COUNT(*) {base_from}", *args)

        query = f"""
            SELECT u.id, u.keycloak_user_id, u.user_type, u.status, u.email, u.phone, u.created_at, u.updated_at,
                COALESCE(sp.full_name, fp.full_name, wp.full_name, vp.full_name) as full_name,
                sp.roll_number,
                COALESCE(fp.employee_id, wp.employee_id) as employee_id,
                COALESCE(sp.department_id, fp.department_id, wp.department_id) as department_id,
                sp.hostel_id,
                d.name as department,
                d.school as school,
                sp.course,
                sp.semester,
                COALESCE(fp.designation, wp.designation) as designation,
                CASE WHEN sp.hostel_id IS NOT NULL THEN TRUE ELSE FALSE END as hostel_flag,
                COALESCE(sp.emergency_contact, fp.emergency_contact, wp.emergency_contact) as emergency_contact,
                sp.guardian_contact,
                COALESCE(sp.photo_reference, fp.photo_reference, wp.photo_reference, vp.photo_reference) as photo_reference,
                sp.nationality, COALESCE(sp.gov_id_type, vp.gov_id_type) AS gov_id_type,
                COALESCE(sp.gov_id_number, vp.gov_id_number) AS gov_id_number,
                vp.visit_purpose, vp.host_contact,
                vp.visit_start, vp.visit_duration_days,
                COALESCE(sp.updated_at, fp.updated_at, wp.updated_at, vp.updated_at) as p_updated_at,
                (SELECT rc.uid FROM rfid_cards rc JOIN user_rfid_cards urc ON urc.rfid_card_id=rc.id
                 WHERE urc.user_id=u.id AND urc.is_primary=true AND urc.unassigned_at IS NULL AND rc.status='active' LIMIT 1) AS active_rfid,
                EXISTS(SELECT 1 FROM freco_people fp_reco JOIN freco_face_embeddings fe ON fe.person_id = fp_reco.id WHERE fp_reco.external_id = u.id) AS has_face_auth
            {base_from}
            ORDER BY u.created_at DESC
            LIMIT ${idx} OFFSET ${idx + 1}
        """
        rows = await conn.fetch(query, *args, limit, offset)

        users = [self._row_to_user(r) for r in rows]
        total_pages = (total + limit - 1) // limit if total > 0 else 1
        return UserListResult(users=users, total=total, page=page, limit=limit, total_pages=total_pages)

    async def get_by_id(self, conn: asyncpg.Connection, user_id: uuid.UUID) -> Optional[User]:
        query = """
            SELECT u.id, u.keycloak_user_id, u.user_type, u.status, u.email, u.phone, u.created_at, u.updated_at,
                COALESCE(sp.full_name, fp.full_name, wp.full_name, vp.full_name) as full_name,
                sp.roll_number,
                COALESCE(fp.employee_id, wp.employee_id) as employee_id,
                COALESCE(sp.department_id, fp.department_id, wp.department_id) as department_id,
                sp.hostel_id,
                d.name as department,
                d.school as school,
                sp.course,
                sp.semester,
                COALESCE(fp.designation, wp.designation) as designation,
                CASE WHEN sp.hostel_id IS NOT NULL THEN TRUE ELSE FALSE END as hostel_flag,
                COALESCE(sp.emergency_contact, fp.emergency_contact, wp.emergency_contact) as emergency_contact,
                sp.guardian_contact,
                COALESCE(sp.photo_reference, fp.photo_reference, wp.photo_reference, vp.photo_reference) as photo_reference,
                sp.nationality, COALESCE(sp.gov_id_type, vp.gov_id_type) AS gov_id_type,
                COALESCE(sp.gov_id_number, vp.gov_id_number) AS gov_id_number,
                vp.visit_purpose, vp.host_contact,
                vp.visit_start, vp.visit_duration_days,
                COALESCE(sp.updated_at, fp.updated_at, wp.updated_at, vp.updated_at) as p_updated_at,
                (SELECT rc.uid FROM rfid_cards rc JOIN user_rfid_cards urc ON urc.rfid_card_id=rc.id
                 WHERE urc.user_id=u.id AND urc.is_primary=true AND urc.unassigned_at IS NULL AND rc.status='active' LIMIT 1) AS active_rfid,
                EXISTS(SELECT 1 FROM freco_people fp_reco JOIN freco_face_embeddings fe ON fe.person_id = fp_reco.id WHERE fp_reco.external_id = u.id) AS has_face_auth
            FROM users u
            LEFT JOIN student_profiles sp ON sp.user_id = u.id AND u.user_type = 'student'
            LEFT JOIN faculty_profiles fp ON fp.user_id = u.id AND u.user_type = 'faculty'
            LEFT JOIN worker_profiles wp ON wp.user_id = u.id AND u.user_type = 'worker'
            LEFT JOIN visitor_profiles vp ON vp.user_id = u.id AND u.user_type = 'visitor'
            LEFT JOIN departments d ON d.id = COALESCE(sp.department_id, fp.department_id, wp.department_id)
            WHERE u.id = $1
        """
        row = await conn.fetchrow(query, user_id)
        if not row:
            return None

        # Fetch roles
        role_rows = await conn.fetch(
            "SELECT r.name FROM roles r JOIN user_roles ur ON ur.role_id = r.id WHERE ur.user_id = $1",
            user_id,
        )
        user = self._row_to_user(row)
        user.roles = [r["name"] for r in role_rows]
        return user

    async def create_user(
        self,
        conn: asyncpg.Connection,
        actor_id: Optional[str],
        req: CreateUserRequest,
    ) -> User:
        raw_type = (req.user_type or "student").lower()
        is_faculty_warden = raw_type in ("faculty_warden", "faculty+warden")
        user_type = "faculty" if is_faculty_warden else raw_type

        # Check if user already exists (deduplication)
        existing_user = await conn.fetchrow(
            "SELECT id, user_type, email, phone, keycloak_user_id, status FROM users WHERE LOWER(email) = LOWER($1)",
            req.email,
        )

        is_existing = existing_user is not None
        user_id = existing_user["id"] if is_existing else uuid.uuid4()
        keycloak_id = existing_user["keycloak_user_id"] if is_existing else None

        # Department & hostel UUID validation
        dept_uuid = None
        if req.profile.department_id:
            try:
                dept_uuid = uuid.UUID(str(req.profile.department_id))
            except Exception:
                pass
        elif req.profile.department:
            d_row = await conn.fetchrow("SELECT id FROM departments WHERE name ILIKE $1 OR code ILIKE $1", req.profile.department)
            if d_row:
                dept_uuid = d_row["id"]

        hostel_uuid = None
        if req.profile.hostel_id:
            try:
                hostel_uuid = uuid.UUID(str(req.profile.hostel_id))
            except Exception:
                pass
        elif getattr(req.profile, "hostel", None):
            h_row = await conn.fetchrow("SELECT id FROM hostels WHERE name ILIKE $1 OR code ILIKE $1", req.profile.hostel)
            if h_row:
                hostel_uuid = h_row["id"]

        loc_uuid = None
        if req.profile.assigned_location_id:
            try:
                loc_uuid = uuid.UUID(str(req.profile.assigned_location_id))
            except Exception:
                pass

        # 1. Insert or update users table
        async with conn.transaction():
            if not is_existing:
                await conn.execute(
                    """
                    INSERT INTO users (id, user_type, status, email, phone, created_at, updated_at)
                    VALUES ($1, $2, 'active', $3, $4, now(), now())
                    """,
                    user_id,
                    user_type,
                    req.email.lower(),
                    req.phone,
                )
            else:
                await conn.execute(
                    """
                    UPDATE users
                    SET phone = COALESCE($1, phone), updated_at = now()
                    WHERE id = $2
                    """,
                    req.phone,
                    user_id,
                )

            # Role-specific profiles
            if user_type == "student":
                await conn.execute(
                    """
                    INSERT INTO student_profiles (
                        user_id, full_name, roll_number, department_id, course, semester,
                        batch, hostel_id, room_number, emergency_contact, guardian_contact, photo_reference,
                        nationality, gov_id_type, gov_id_number, updated_at
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, now())
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
                        photo_reference = COALESCE(EXCLUDED.photo_reference, student_profiles.photo_reference),
                        nationality = COALESCE(EXCLUDED.nationality, student_profiles.nationality),
                        gov_id_type = COALESCE(EXCLUDED.gov_id_type, student_profiles.gov_id_type),
                        gov_id_number = COALESCE(EXCLUDED.gov_id_number, student_profiles.gov_id_number),
                        updated_at = now()
                    """,
                    user_id,
                    req.profile.full_name,
                    req.profile.roll_number,
                    dept_uuid,
                    req.profile.course,
                    req.profile.semester,
                    req.profile.batch,
                    hostel_uuid,
                    req.profile.room_number,
                    req.profile.emergency_contact,
                    req.profile.guardian_contact,
                    req.profile.photo_reference,
                    req.profile.nationality,
                    req.profile.gov_id_type,
                    req.profile.gov_id_number,
                )
                if hostel_uuid:
                    await conn.execute(
                        """
                        INSERT INTO student_hostel_status (student_id, current_status, last_event_time)
                        VALUES ($1, 'INSIDE', now())
                        ON CONFLICT (student_id) DO NOTHING
                        """,
                        user_id,
                    )

            if user_type == "faculty" or is_faculty_warden:
                await conn.execute(
                    """
                    INSERT INTO faculty_profiles (
                        user_id, full_name, employee_id, department_id, designation,
                        courses, assigned_students, emergency_contact, photo_reference, updated_at
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, now())
                    ON CONFLICT (user_id) DO UPDATE SET
                        full_name = EXCLUDED.full_name,
                        employee_id = COALESCE(EXCLUDED.employee_id, faculty_profiles.employee_id),
                        department_id = COALESCE(EXCLUDED.department_id, faculty_profiles.department_id),
                        designation = COALESCE(EXCLUDED.designation, faculty_profiles.designation),
                        courses = COALESCE(EXCLUDED.courses, faculty_profiles.courses),
                        assigned_students = COALESCE(EXCLUDED.assigned_students, faculty_profiles.assigned_students),
                        emergency_contact = COALESCE(EXCLUDED.emergency_contact, faculty_profiles.emergency_contact),
                        photo_reference = COALESCE(EXCLUDED.photo_reference, faculty_profiles.photo_reference),
                        updated_at = now()
                    """,
                    user_id,
                    req.profile.full_name,
                    req.profile.employee_id,
                    dept_uuid,
                    req.profile.designation,
                    req.profile.courses,
                    req.profile.assigned_students,
                    req.profile.emergency_contact,
                    req.profile.photo_reference,
                )

            if is_faculty_warden or req.profile.hostel_block or req.profile.warden_responsibilities:
                resp = req.profile.warden_responsibilities or "Hostel Caretaker & Disciplinary Warden"
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
                    user_id, hostel_uuid, req.profile.hostel_block, resp, req.profile.emergency_contact,
                )
                if hostel_uuid:
                    await conn.execute(
                        """
                        INSERT INTO warden_hostels (id, user_id, hostel_id, hostel_block, responsibilities, created_at, updated_at)
                        VALUES (gen_random_uuid(), $1, $2, $3, $4, now(), now())
                        ON CONFLICT DO NOTHING
                        """,
                        user_id, hostel_uuid, req.profile.hostel_block, resp,
                    )

            if user_type == "worker":
                job = req.profile.job_type or req.profile.designation or "Campus Operations"
                await conn.execute(
                    """
                    INSERT INTO worker_profiles (
                        user_id, full_name, employee_id, department_id, designation,
                        job_type, work_area, shift, assigned_location_id,
                        emergency_contact, photo_reference, updated_at
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, now())
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
                        photo_reference = COALESCE(EXCLUDED.photo_reference, worker_profiles.photo_reference),
                        updated_at = now()
                    """,
                    user_id,
                    req.profile.full_name,
                    req.profile.employee_id,
                    dept_uuid,
                    req.profile.designation,
                    job,
                    req.profile.work_area,
                    req.profile.shift,
                    loc_uuid,
                    req.profile.emergency_contact,
                    req.profile.photo_reference,
                )
                if loc_uuid:
                    await conn.execute(
                        """
                        INSERT INTO user_location_access (id, user_id, location_id, access_level, status, reason, created_at, updated_at)
                        VALUES (gen_random_uuid(), $1, $2, 'ENTRY', 'active', $3, now(), now())
                        ON CONFLICT (user_id, location_id, access_level) DO NOTHING
                        """,
                        user_id, loc_uuid, f"Shift: {req.profile.shift or 'Standard'} | Area: {req.profile.work_area or 'General'}",
                    )

            if user_type == "visitor":
                await conn.execute(
                    """
                    INSERT INTO visitor_profiles (
                        user_id, full_name, gov_id_type, gov_id_number, visit_purpose,
                        host_person, host_contact, visit_duration_days, photo_reference, updated_at
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, now())
                    ON CONFLICT (user_id) DO UPDATE SET
                        full_name = EXCLUDED.full_name,
                        gov_id_type = COALESCE(EXCLUDED.gov_id_type, visitor_profiles.gov_id_type),
                        gov_id_number = COALESCE(EXCLUDED.gov_id_number, visitor_profiles.gov_id_number),
                        visit_purpose = COALESCE(EXCLUDED.visit_purpose, visitor_profiles.visit_purpose),
                        host_person = COALESCE(EXCLUDED.host_person, visitor_profiles.host_person),
                        host_contact = COALESCE(EXCLUDED.host_contact, visitor_profiles.host_contact),
                        visit_duration_days = COALESCE(EXCLUDED.visit_duration_days, visitor_profiles.visit_duration_days),
                        photo_reference = COALESCE(EXCLUDED.photo_reference, visitor_profiles.photo_reference),
                        updated_at = now()
                    """,
                    user_id,
                    req.profile.full_name,
                    req.profile.gov_id_type,
                    req.profile.gov_id_number,
                    req.profile.visit_purpose,
                    req.profile.host_person or req.profile.host_contact,
                    req.profile.host_contact,
                    req.profile.visit_duration_days,
                    req.profile.photo_reference,
                )

            # Assign roles in user_roles
            roles_to_assign = set()
            if req.roles:
                for r in req.roles:
                    roles_to_assign.add(str(r).strip().upper())
            elif is_faculty_warden:
                roles_to_assign.add("FACULTY")
                roles_to_assign.add("WARDEN")
            else:
                roles_to_assign.add(user_type.upper())

            if roles_to_assign:
                db_roles = await conn.fetch("SELECT id, name FROM roles WHERE name = ANY($1::text[])", list(roles_to_assign))
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

        # 2. Keycloak Account sync
        first_name, last_name = req.profile.full_name, "User"
        if " " in req.profile.full_name.strip():
            parts = req.profile.full_name.strip().split(" ", 1)
            first_name, last_name = parts[0], parts[1]

        if not keycloak_id and req.password:
            try:
                keycloak_id = await keycloak_client.create_user(
                    username=req.email.lower(),
                    email=req.email.lower(),
                    first_name=first_name,
                    last_name=last_name,
                    password=req.password,
                    attributes={"user_type": [user_type], "user_id": [str(user_id)]},
                )
                await conn.execute("UPDATE users SET keycloak_user_id=$1 WHERE id=$2", keycloak_id, user_id)
            except Exception as e:
                logger.warning("Keycloak user sync failed (continuing in dev/test): %s", e)
        elif keycloak_id and req.password:
            try:
                await keycloak_client.reset_password(keycloak_id, req.password, temporary=False)
                await keycloak_client.clear_required_actions(keycloak_id)
            except Exception as e:
                logger.warning("Keycloak password reset warning: %s", e)

        # 3. Synchronize Keycloak realm roles
        if keycloak_id and roles_to_assign:
            try:
                from app.services.role_service import role_service
                await role_service.sync_keycloak_roles(keycloak_id, list(roles_to_assign))
            except Exception as e:
                logger.warning("Keycloak role mapping sync warning: %s", e)

        created_user = await self.get_by_id(conn, user_id)
        if not created_user:
            raise RuntimeError("User created but could not be retrieved")

        await audit_service.log(
            conn=conn,
            actor_id=actor_id,
            operation="USER_CREATED",
            entity_type="user",
            entity_id=str(user_id),
            after_state=created_user.model_dump(),
        )

        return created_user

    async def update_user(
        self,
        conn: asyncpg.Connection,
        actor_id: Optional[str],
        user_id: uuid.UUID,
        req: UpdateUserRequest,
    ) -> User:
        current_user = await self.get_by_id(conn, user_id)
        if not current_user:
            raise ValueError("User not found")

        user_type = current_user.user_type.lower()

        async with conn.transaction():
            if req.phone is not None:
                await conn.execute(
                    "UPDATE users SET phone=$1, updated_at=now() WHERE id=$2",
                    req.phone,
                    user_id,
                )

            if req.profile:
                p = req.profile
                dept_uuid = uuid.UUID(str(p.department_id)) if p.department_id else None
                hostel_uuid = uuid.UUID(str(p.hostel_id)) if p.hostel_id else None

                if user_type == "student":
                    await conn.execute(
                        """
                        UPDATE student_profiles SET
                            full_name = COALESCE($2, full_name),
                            roll_number = COALESCE($3, roll_number),
                            department_id = COALESCE($4, department_id),
                            course = COALESCE($5, course),
                            semester = COALESCE($6, semester),
                            hostel_id = COALESCE($7, hostel_id),
                            emergency_contact = COALESCE($8, emergency_contact),
                            guardian_contact = COALESCE($9, guardian_contact),
                            photo_reference = COALESCE($10, photo_reference),
                            nationality = COALESCE($11, nationality),
                            gov_id_type = COALESCE($12, gov_id_type),
                            gov_id_number = COALESCE($13, gov_id_number),
                            updated_at = now()
                        WHERE user_id = $1
                        """,
                        user_id,
                        p.full_name,
                        p.roll_number,
                        dept_uuid,
                        p.course,
                        p.semester,
                        hostel_uuid,
                        p.emergency_contact,
                        p.guardian_contact,
                        p.photo_reference,
                        p.nationality,
                        p.gov_id_type,
                        p.gov_id_number,
                    )
                elif user_type == "faculty":
                    await conn.execute(
                        """
                        UPDATE faculty_profiles SET
                            full_name = COALESCE($2, full_name),
                            employee_id = COALESCE($3, employee_id),
                            department_id = COALESCE($4, department_id),
                            designation = COALESCE($5, designation),
                            emergency_contact = COALESCE($6, emergency_contact),
                            photo_reference = COALESCE($7, photo_reference),
                            updated_at = now()
                        WHERE user_id = $1
                        """,
                        user_id,
                        p.full_name,
                        p.employee_id,
                        dept_uuid,
                        p.designation,
                        p.emergency_contact,
                        p.photo_reference,
                    )
                elif user_type == "worker":
                    await conn.execute(
                        """
                        UPDATE worker_profiles SET
                            full_name = COALESCE($2, full_name),
                            employee_id = COALESCE($3, employee_id),
                            department_id = COALESCE($4, department_id),
                            designation = COALESCE($5, designation),
                            emergency_contact = COALESCE($6, emergency_contact),
                            photo_reference = COALESCE($7, photo_reference),
                            updated_at = now()
                        WHERE user_id = $1
                        """,
                        user_id,
                        p.full_name,
                        p.employee_id,
                        dept_uuid,
                        p.designation,
                        p.emergency_contact,
                        p.photo_reference,
                    )
                elif user_type == "visitor":
                    await conn.execute(
                        """
                        UPDATE visitor_profiles SET
                            full_name = COALESCE($2, full_name),
                            gov_id_type = COALESCE($3, gov_id_type),
                            gov_id_number = COALESCE($4, gov_id_number),
                            visit_purpose = COALESCE($5, visit_purpose),
                            host_contact = COALESCE($6, host_contact),
                            visit_duration_days = COALESCE($7, visit_duration_days),
                            photo_reference = COALESCE($8, photo_reference),
                            updated_at = now()
                        WHERE user_id = $1
                        """,
                        user_id,
                        p.full_name,
                        p.gov_id_type,
                        p.gov_id_number,
                        p.visit_purpose,
                        p.host_contact,
                        p.visit_duration_days,
                        p.photo_reference,
                    )

        updated_user = await self.get_by_id(conn, user_id)
        await audit_service.log(
            conn=conn,
            actor_id=actor_id,
            operation="USER_UPDATED",
            entity_type="user",
            entity_id=str(user_id),
            before_state=current_user.model_dump(),
            after_state=updated_user.model_dump() if updated_user else None,
        )
        return updated_user or current_user

    async def update_status(
        self,
        conn: asyncpg.Connection,
        actor_id: Optional[str],
        user_id: uuid.UUID,
        new_status: str,
        reason: str = "",
    ) -> None:
        valid_statuses = {"active", "suspended", "deactivated"}
        if new_status not in valid_statuses:
            raise ValueError(f"Invalid status: {new_status}")

        current_user = await self.get_by_id(conn, user_id)
        if not current_user:
            raise ValueError("User not found")

        is_active = new_status == "active"

        async with conn.transaction():
            await conn.execute(
                "UPDATE users SET status=$1, updated_at=now() WHERE id=$2",
                new_status,
                user_id,
            )
            # Sync freco
            await conn.execute(
                "UPDATE freco_people SET active=$1, updated_at=now() WHERE external_id=$2",
                is_active,
                user_id,  # external_id is UUID type, pass UUID object directly
            )
            # If deactivating or suspending, unassign or deactivate user RFID
            if not is_active:
                await conn.execute(
                    """
                    UPDATE rfid_cards SET status='inactive', updated_at=now()
                    WHERE id IN (
                        SELECT rfid_card_id FROM user_rfid_cards
                        WHERE user_id=$1 AND unassigned_at IS NULL
                    )
                    """,
                    user_id,
                )
            else:
                # Reactivate currently assigned RFID card if user is activated
                await conn.execute(
                    """
                    UPDATE rfid_cards SET status='active', updated_at=now()
                    WHERE id IN (
                        SELECT rfid_card_id FROM user_rfid_cards
                        WHERE user_id=$1 AND unassigned_at IS NULL
                    )
                    """,
                    user_id,
                )

        # Sync Keycloak enabled status
        if current_user.keycloak_user_id:
            try:
                await keycloak_client.set_user_enabled(current_user.keycloak_user_id, is_active)
            except Exception as e:
                logger.warning("Keycloak status sync failed: %s", e)

        await audit_service.log(
            conn=conn,
            actor_id=actor_id,
            operation=f"USER_{new_status.upper()}",
            entity_type="user",
            entity_id=str(user_id),
            before_state={"status": current_user.status},
            after_state={"status": new_status, "reason": reason},
        )

    async def bulk_transfer_hostel(
        self,
        conn: asyncpg.Connection,
        actor_id: Optional[str],
        user_ids: List[uuid.UUID],
        new_hostel_id: uuid.UUID
    ) -> None:
        if not user_ids:
            return
            
        async with conn.transaction():
            await conn.execute(
                "UPDATE student_profiles SET hostel_id = $1, updated_at = now() WHERE user_id = ANY($2::uuid[])",
                new_hostel_id,
                user_ids
            )
            
            # Log audit for each
            for uid in user_ids:
                await audit_service.log(
                    conn=conn,
                    actor_id=actor_id,
                    operation="USER_UPDATED",
                    entity_type="user",
                    entity_id=str(uid),
                    before_state={"bulk_transfer": True},
                    after_state={"hostel_id": str(new_hostel_id)}
                )


    async def delete_user(self, conn: asyncpg.Connection, actor_id: Optional[str], user_id: uuid.UUID) -> None:
        current_user = await self.get_by_id(conn, user_id)
        if not current_user:
            raise ValueError("User not found")

        # Delete from Keycloak if linked
        if current_user.keycloak_user_id:
            try:
                await keycloak_client.delete_user(current_user.keycloak_user_id)
            except Exception as e:
                logger.warning("Keycloak user deletion failed: %s", e)

        # Delete in DB (cascades)
        await conn.execute("DELETE FROM users WHERE id=$1", user_id)

        await audit_service.log(
            conn=conn,
            actor_id=actor_id,
            operation="USER_DELETED",
            entity_type="user",
            entity_id=str(user_id),
            before_state=current_user.model_dump(),
        )

    async def advance_semesters(self, conn: asyncpg.Connection, actor_id: Optional[str]) -> int:
        result = await self.list_users(conn, user_type="student", status="active", limit=10000)
        updated_count = 0

        for u in result.users:
            if not u.profile or not u.profile.semester:
                continue

            try:
                sem_int = int(u.profile.semester.strip())
            except ValueError:
                continue

            user_uuid = uuid.UUID(u.id)
            if 1 <= sem_int < 8:
                new_sem = str(sem_int + 1)
                req = UpdateUserRequest(profile=ProfileRequest(full_name=u.profile.full_name, semester=new_sem))
                await self.update_user(conn, actor_id, user_uuid, req)
                updated_count += 1
            elif sem_int >= 8:
                await self.update_status(conn, actor_id, user_uuid, "deactivated", "semester_advance_graduation")
                updated_count += 1

        return updated_count

    async def list_departments(self, conn: asyncpg.Connection) -> List[Department]:
        rows = await conn.fetch("SELECT id, name, code, school FROM departments ORDER BY name")
        return [
            Department(
                id=str(r["id"]),
                name=r["name"],
                code=r["code"],
                school=r["school"],
            )
            for r in rows
        ]

    async def list_hostels(self, conn: asyncpg.Connection) -> List[Hostel]:
        rows = await conn.fetch("SELECT id, name, code, capacity FROM hostels ORDER BY name")
        return [
            Hostel(
                id=str(r["id"]),
                name=r["name"],
                code=r["code"],
                capacity=r["capacity"],
            )
            for r in rows
        ]

    async def list_locations(self, conn: asyncpg.Connection) -> List[Dict[str, Any]]:
        rows = await conn.fetch("SELECT id, name, type, description FROM locations ORDER BY name")
        return [
            {
                "id": str(r["id"]),
                "name": r["name"],
                "type": r["type"],
                "description": r["description"] or "",
            }
            for r in rows
        ]

    async def get_stats(self, conn: asyncpg.Connection) -> Stats:
        row = await conn.fetchrow(
            """
            SELECT
                COUNT(*) as total_users,
                COUNT(*) FILTER (WHERE status='active') as active_users,
                COUNT(*) FILTER (WHERE status='suspended') as suspended_users,
                COUNT(*) FILTER (WHERE status='deactivated') as deactivated_users,
                COUNT(*) FILTER (WHERE user_type='student') as students,
                COUNT(*) FILTER (WHERE user_type='faculty') as faculty,
                COUNT(*) FILTER (WHERE user_type='worker') as workers,
                COUNT(*) FILTER (WHERE user_type='visitor') as visitors
            FROM users
            """
        )
        return Stats(
            total_users=row["total_users"],
            active_users=row["active_users"],
            suspended_users=row["suspended_users"],
            deactivated_users=row["deactivated_users"],
            students=row["students"],
            faculty=row["faculty"],
            workers=row["workers"],
            visitors=row["visitors"],
        )

    def _row_to_user(self, r: Any) -> User:
        p = Profile(
            user_id=str(r["id"]),
            full_name=r["full_name"] or "",
            roll_number=r["roll_number"],
            employee_id=r["employee_id"],
            department_id=str(r["department_id"]) if r["department_id"] else None,
            department=r["department"],
            school=r["school"],
            course=r["course"],
            semester=r["semester"],
            designation=r["designation"],
            hostel_flag=r["hostel_flag"] or False,
            hostel_id=str(r["hostel_id"]) if r["hostel_id"] else None,
            emergency_contact=r["emergency_contact"],
            guardian_contact=r["guardian_contact"],
            photo_reference=r["photo_reference"],
            nationality=r["nationality"],
            gov_id_type=r["gov_id_type"],
            gov_id_number=r["gov_id_number"],
            visit_purpose=r["visit_purpose"],
            host_contact=r["host_contact"],
            visit_start=r["visit_start"].isoformat() if r["visit_start"] else None,
            batch=r["batch"] if "batch" in r else None,
            room_number=r["room_number"] if "room_number" in r else None,
            courses=r["courses"] if "courses" in r else None,
            assigned_students=r["assigned_students"] if "assigned_students" in r else None,
            hostel_block=r["hostel_block"] if "hostel_block" in r else None,
            warden_responsibilities=r["warden_responsibilities"] if "warden_responsibilities" in r else None,
            job_type=r["job_type"] if "job_type" in r else None,
            work_area=r["work_area"] if "work_area" in r else None,
            shift=r["shift"] if "shift" in r else None,
            assigned_location_id=str(r["assigned_location_id"]) if "assigned_location_id" in r and r["assigned_location_id"] else None,
            host_person=r["host_person"] if "host_person" in r else None,
            updated_at=r["p_updated_at"].isoformat() if r["p_updated_at"] else None,
        )

        return User(
            id=str(r["id"]),
            keycloak_user_id=r["keycloak_user_id"],
            user_type=r["user_type"],
            status=r["status"],
            email=r["email"],
            phone=r["phone"],
            created_at=r["created_at"].isoformat() if r["created_at"] else "",
            updated_at=r["updated_at"].isoformat() if r["updated_at"] else "",
            profile=p,
            roles=[],
            active_rfid=r["active_rfid"],
            has_face_auth=r["has_face_auth"] or False,
        )


user_service = UserService()
