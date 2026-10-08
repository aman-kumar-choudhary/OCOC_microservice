from __future__ import annotations
import asyncio
import datetime
import json
import logging
from typing import Any, Dict, List, Optional
import uuid
import asyncpg

from app.routers.ws import manager
from app.schemas.access import (
    AccessEvent, AccessGroup, AccessRule, AddAccessGroupMemberRequest,
    CreateAccessGroupRequest, CreateAccessRuleRequest, CreateTemporaryAccessRequest,
    Location, TemporaryAccessGrant, UpdateAccessRuleRequest,
    # Enhanced schemas
    AccessUserSummary, AccessUserSearchResult, UserAccessDetail,
    UserLocationAccessGrant, LocationTreeNode, CreateLocationGrantRequest,
    UpdateLocationGrantRequest, EffectivePermission,
    AccessAuditLogEntry, AccessAuditLogResult,
)
from app.core.redis_client import redis_client

logger = logging.getLogger(__name__)

ACCESS_LEVELS_ORDER = {"VIEW": 0, "ENTRY": 1, "MANAGE": 2, "ADMIN": 3}


class AccessService:
    """The single access-decision path for RFID and manual evaluations."""

    async def get_locations(self, conn: asyncpg.Connection) -> List[Location]:
        cached = await redis_client.get("access:locations:active-v1")
        if cached is not None and isinstance(cached, list):
            return [Location(**r) for r in cached]
        rows = await conn.fetch("SELECT * FROM locations WHERE status = 'active' ORDER BY type, name")
        res = [Location(**dict(row)) for row in rows]
        await redis_client.set("access:locations:active-v1", [r.model_dump() for r in res], ex=3600)
        return res

    async def get_devices(self, conn: asyncpg.Connection) -> list[dict]:
        rows = await conn.fetch("""SELECT d.id,d.mac_address,d.type,d.status,d.location_id,l.name AS location_name
            FROM devices d LEFT JOIN locations l ON l.id=d.location_id
            WHERE d.type IN ('RFID_READER','TURNSTILE','FACE_CAMERA','CAMERA_BARRIER','TURNSTILE_GATE','BIOMETRIC_KIOSK') ORDER BY d.type,d.mac_address""")
        return [dict(row) for row in rows]

    async def get_groups(self, conn: asyncpg.Connection) -> List[AccessGroup]:
        rows = await conn.fetch("SELECT id,name,description FROM access_groups ORDER BY name")
        return [AccessGroup(**dict(row)) for row in rows]

    async def create_group(self, conn: asyncpg.Connection, req: CreateAccessGroupRequest) -> AccessGroup:
        row = await conn.fetchrow("INSERT INTO access_groups(name,description) VALUES($1,$2) RETURNING id,name,description", req.name, req.description)
        return AccessGroup(**dict(row))

    async def add_group_member(self, conn: asyncpg.Connection, group_id: uuid.UUID, user_id: uuid.UUID) -> None:
        await conn.execute("INSERT INTO access_group_members(group_id,user_id) VALUES($1,$2) ON CONFLICT DO NOTHING", group_id, user_id)
        await redis_client.invalidate_user_cache(user_id)

    async def create_rule(self, conn: asyncpg.Connection, req: CreateAccessRuleRequest) -> AccessRule:
        row = await conn.fetchrow("""INSERT INTO access_rules (name,description,subject_type,subject_id,location_id,device_id,schedule_days,schedule_start_time,schedule_end_time,valid_from,valid_to,effect,priority)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *""",
            req.name, req.description, req.subject_type.lower(), req.subject_id, req.location_id, req.device_id,
            req.schedule_days, req.schedule_start_time, req.schedule_end_time, req.valid_from, req.valid_to, req.effect.upper(), req.priority)
        await redis_client.invalidate_access_rules()
        return AccessRule(**dict(row))

    async def get_rules(self, conn: asyncpg.Connection) -> List[AccessRule]:
        cached = await redis_client.get("access:rules")
        if cached is not None and isinstance(cached, list):
            return [AccessRule(**r) for r in cached]
        rows = await conn.fetch("SELECT * FROM access_rules ORDER BY priority DESC,created_at DESC")
        res = [AccessRule(**dict(row)) for row in rows]
        await redis_client.set("access:rules", [r.model_dump() for r in res], ex=300)
        return res

    async def get_rule_stats(self, conn: asyncpg.Connection) -> dict:
        row = await conn.fetchrow("""SELECT COUNT(*) AS total,COUNT(*) FILTER(WHERE is_active) AS enabled,
            COUNT(*) FILTER(WHERE is_active AND effect='ALLOW') AS allow_count,
            COUNT(*) FILTER(WHERE is_active AND effect='DENY') AS deny_count FROM access_rules""")
        return dict(row)

    async def update_rule(self, conn: asyncpg.Connection, rule_id: uuid.UUID, req: UpdateAccessRuleRequest) -> Optional[AccessRule]:
        row = await conn.fetchrow("UPDATE access_rules SET is_active=$1,updated_at=NOW() WHERE id=$2 RETURNING *", req.is_active, rule_id)
        await redis_client.invalidate_access_rules()
        return AccessRule(**dict(row)) if row else None

    async def create_temporary_grant(self, conn: asyncpg.Connection, req: CreateTemporaryAccessRequest, admin_id: uuid.UUID) -> TemporaryAccessGrant:
        if req.valid_to <= req.valid_from:
            raise ValueError("valid_to must be after valid_from")
        row = await conn.fetchrow("""INSERT INTO temporary_access_grants(user_id,location_id,valid_from,valid_to,granted_by,reason)
            VALUES($1,$2,$3,$4,$5,$6) RETURNING *""", req.user_id,req.location_id,req.valid_from,req.valid_to,admin_id,req.reason)
        grant = TemporaryAccessGrant(**dict(row))
        await redis_client.invalidate_user_cache(req.user_id)
        return grant

    async def get_temporary_grants(self, conn: asyncpg.Connection) -> List[dict]:
        rows = await conn.fetch("""SELECT t.*,u.email,l.name AS location_name,COALESCE(sp.full_name,fp.full_name,wp.full_name,vp.full_name,'Unknown') AS user_name
            FROM temporary_access_grants t JOIN users u ON u.id=t.user_id LEFT JOIN locations l ON l.id=t.location_id
            LEFT JOIN student_profiles sp ON sp.user_id=u.id LEFT JOIN faculty_profiles fp ON fp.user_id=u.id
            LEFT JOIN worker_profiles wp ON wp.user_id=u.id LEFT JOIN visitor_profiles vp ON vp.user_id=u.id ORDER BY t.created_at DESC""")
        return [dict(row) for row in rows]

    async def get_occupancy(self, conn: asyncpg.Connection, location_id: Optional[uuid.UUID] = None) -> list[dict]:
        where,args="WHERE ull.location_id IS NOT NULL",[]
        if location_id: where+=" AND ull.location_id=$1"; args.append(location_id)
        rows=await conn.fetch(f"""SELECT l.id AS location_id,l.name AS location_name,l.type,COUNT(ull.user_id) AS occupancy
            FROM user_last_locations ull JOIN locations l ON l.id=ull.location_id {where} GROUP BY l.id,l.name,l.type ORDER BY l.name""",*args)
        return [dict(row) for row in rows]

    async def evaluate_rfid_scan(self, conn: asyncpg.Connection, uid: str, location_id: Optional[uuid.UUID], action: str,
                                 reader_id: Optional[uuid.UUID]=None, device_id: Optional[uuid.UUID]=None, face_confidence: Optional[float]=None) -> AccessEvent:
        uid=uid.strip().replace(":","").replace("-","").upper()
        if device_id and not location_id: location_id=await conn.fetchval("SELECT location_id FROM devices WHERE id=$1",device_id)
        if reader_id and not location_id: location_id=await conn.fetchval("SELECT hg.hostel_id FROM rfid_readers rr JOIN hostel_gates hg ON hg.id=rr.gate_id WHERE rr.id=$1",reader_id)
        user_id=await conn.fetchval("""SELECT urc.user_id FROM rfid_cards rc JOIN user_rfid_cards urc ON urc.rfid_card_id=rc.id
            WHERE UPPER(rc.uid)=$1 AND rc.status='active' AND urc.unassigned_at IS NULL LIMIT 1""",uid)
        if not location_id: return await self._log_event(conn,user_id,None,action,"DENIED","Reader has no zone",uid,reader_id,device_id,face_confidence)
        if not user_id: return await self._log_event(conn,None,location_id,action,"DENIED","Unknown or inactive RFID card",uid,reader_id,device_id,face_confidence)
        two_factor = await conn.fetchval("SELECT requires_two_factor FROM locations WHERE id=$1", location_id)
        if two_factor:
            verification_id = await conn.fetchval("""INSERT INTO pending_access_verifications(user_id,location_id,rfid_uid,reader_id,device_id,action,expires_at)
                VALUES($1,$2,$3,$4,$5,$6,NOW() + INTERVAL '90 seconds') RETURNING id""", user_id, location_id, uid, reader_id, device_id, action.upper())
            return await self._log_event(conn,user_id,location_id,action.upper(),"PENDING","RFID accepted; face verification required",uid,reader_id,device_id,None,verification_id)
        return await self.evaluate_access(conn,user_id,location_id,action,uid,reader_id,device_id,face_confidence)

    async def verify_face(self, conn: asyncpg.Connection, verification_id: uuid.UUID, user_id: uuid.UUID,
                          matched: bool, face_confidence: Optional[float], reason: Optional[str] = None) -> AccessEvent:
        pending = await conn.fetchrow("""SELECT * FROM pending_access_verifications
            WHERE id=$1 AND user_id=$2 AND verified_at IS NULL AND expires_at >= NOW()""", verification_id, user_id)
        if not pending:
            return await self._log_event(conn,user_id,None,"ENTRY","DENIED","Face verification expired or does not match the RFID scan",None,None,None,face_confidence)
        await conn.execute("UPDATE pending_access_verifications SET verified_at=NOW() WHERE id=$1", verification_id)
        if not matched:
            return await self._log_event(conn,user_id,pending["location_id"],pending["action"],"DENIED",reason or "Face verification failed",pending["rfid_uid"],pending["reader_id"],pending["device_id"],face_confidence)
        return await self.evaluate_access(conn,user_id,pending["location_id"],pending["action"],pending["rfid_uid"],pending["reader_id"],pending["device_id"],face_confidence)

    async def evaluate_access(self, conn: asyncpg.Connection, user_id: uuid.UUID, location_id: uuid.UUID, action: str="ENTRY",
                              rfid_uid: Optional[str]=None, reader_id: Optional[uuid.UUID]=None, device_id: Optional[uuid.UUID]=None, face_confidence: Optional[float]=None) -> AccessEvent:
        action=action.upper()
        if action not in {"ENTRY","EXIT"}: raise ValueError("action must be ENTRY or EXIT")
        now=datetime.datetime.now(datetime.timezone.utc)
        user=await conn.fetchrow("""SELECT u.id,u.user_type,u.status,sp.hostel_id,COALESCE(sp.full_name,fp.full_name,wp.full_name,vp.full_name,'Unknown') AS full_name
            FROM users u LEFT JOIN student_profiles sp ON sp.user_id=u.id LEFT JOIN faculty_profiles fp ON fp.user_id=u.id
            LEFT JOIN worker_profiles wp ON wp.user_id=u.id LEFT JOIN visitor_profiles vp ON vp.user_id=u.id WHERE u.id=$1""",user_id)
        if not user: return await self._log_event(conn,user_id,location_id,action,"DENIED","User not found",rfid_uid,reader_id,device_id,face_confidence)
        if user["status"]!="active": return await self._log_event(conn,user_id,location_id,action,"DENIED",f"User status is {user['status']}",rfid_uid,reader_id,device_id,face_confidence)
        location = await conn.fetchrow("SELECT name,type FROM locations WHERE id=$1", location_id)
        # An exit without an active approved leave is a guard warning, not an
        # automatic rejection: the configured access rules still decide entry.
        if action == "EXIT" and user["user_type"] == "student" and location and "gate" in location["name"].lower():
            has_leave = await conn.fetchval("""SELECT EXISTS(
                SELECT 1 FROM leave_rfid_permissions p
                JOIN leave_requests r ON r.id = p.request_id
                WHERE p.student_id = $1 AND p.status = 'ACTIVE' AND r.status = 'APPROVED'
                  AND p.starts_at <= $2 AND p.ends_at >= $2
                UNION ALL
                SELECT 1 FROM hostel_permissions
                WHERE student_id = $1 AND status IN ('ACTIVE', 'APPROVED')
                  AND start_time <= $2 AND end_time >= $2
                UNION ALL
                SELECT 1 FROM student_leaves
                WHERE user_id = $1 AND status = 'APPROVED'
                  AND valid_from <= $2 AND valid_to >= $2
            )""", user_id, now)
            if not has_leave:
                await self._notify_alert(conn, "LEAVE_EXPIRY_WARNING", f"{user['full_name']} has no active leave/pass at exit.", user_id, location_id)
        if action == "ENTRY" and user["user_type"] == "student" and location and location["type"].lower() == "hostel":
            current_time = now.timetz().replace(tzinfo=None)
            if current_time >= datetime.time(20, 0) or current_time < datetime.time(5, 0):
                await self._notify_alert(conn, "CURFEW_VIOLATION", f"Late hostel return: {user['full_name']} checked in at {now.strftime('%H:%M UTC')}.", user_id, location_id)

            # Hostel Gender Isolation Policy: Boys cannot enter Girls hostel, Girls cannot enter Boys hostel
            BOYS_HOSTELS = {"arvind", "paninni"}
            GIRLS_HOSTELS = {"shanghmitra", "nivedita"}

            target_loc_name = (location["name"] or "").lower()
            student_hostel_name = (await conn.fetchval("SELECT lower(name) FROM hostels WHERE id=$1", user["hostel_id"])) or ""

            is_student_boy = any(b in student_hostel_name for b in BOYS_HOSTELS)
            is_student_girl = any(g in student_hostel_name for g in GIRLS_HOSTELS)
            is_target_girls = any(g in target_loc_name for g in GIRLS_HOSTELS)
            is_target_boys = any(b in target_loc_name for b in BOYS_HOSTELS)

            if is_student_boy and is_target_girls:
                return await self._log_event(conn, user_id, location_id, action, "DENIED", "Gender Protection Policy: Male student strictly restricted from Girls Hostel", rfid_uid, reader_id, device_id, face_confidence)
            if is_student_girl and is_target_boys:
                return await self._log_event(conn, user_id, location_id, action, "DENIED", "Gender Protection Policy: Female student strictly restricted from Boys Hostel", rfid_uid, reader_id, device_id, face_confidence)

        # Faculty All-Campus Privilege: Faculty can access all locations across campus
        if user["user_type"] == "faculty":
            return await self._log_event(conn, user_id, location_id, action, "GRANTED", "Faculty campus-wide unrestricted access", rfid_uid, reader_id, device_id, face_confidence)

        if action=="ENTRY":
            last=await conn.fetchval("""SELECT action FROM access_events WHERE rfid_uid=$1 AND location_id=$2 AND status='GRANTED' ORDER BY event_time DESC LIMIT 1""",rfid_uid,location_id) if rfid_uid else await conn.fetchval("SELECT last_action FROM user_last_locations WHERE user_id=$1 AND location_id=$2",user_id,location_id)
            if last=="ENTRY": return await self._log_event(conn,user_id,location_id,action,"DENIED","Anti-passback: card is already inside this zone",rfid_uid,reader_id,device_id,face_confidence)
        temporary=await conn.fetchval("""SELECT
            EXISTS(SELECT 1 FROM temporary_access_grants WHERE user_id=$1 AND location_id=$2 AND valid_from<=$3 AND valid_to>=$3)
            OR ($4='EXIT' AND EXISTS(SELECT 1 FROM locations gate WHERE gate.id=$2 AND lower(gate.type)='gate')
                AND EXISTS(SELECT 1 FROM leave_rfid_permissions p JOIN leave_requests r ON r.id=p.request_id
                WHERE p.student_id=$1 AND p.status='ACTIVE' AND r.status='APPROVED'
                  AND p.starts_at<=$3 AND p.ends_at>=$3))""",user_id,location_id,now,action)
        tree=await conn.fetch("""WITH RECURSIVE tree AS (SELECT id,parent_id FROM locations WHERE id=$1 UNION ALL SELECT l.id,l.parent_id FROM locations l JOIN tree t ON t.parent_id=l.id) SELECT id FROM tree""",location_id)
        location_ids=[row["id"] for row in tree]
        db_roles=await conn.fetch("SELECT r.name FROM user_roles ur JOIN roles r ON r.id=ur.role_id WHERE ur.user_id=$1",user_id)
        roles={user["user_type"].lower(),*(str(row["name"]).lower() for row in db_roles)}
        groups={str(row["group_id"]) for row in await conn.fetch("SELECT group_id FROM access_group_members WHERE user_id=$1",user_id)}
        rules=await conn.fetch("""SELECT * FROM access_rules WHERE is_active AND (location_id IS NULL OR location_id=ANY($1::uuid[])) AND (device_id IS NULL OR device_id=$2)
            ORDER BY priority DESC,CASE WHEN effect='DENY' THEN 0 ELSE 1 END,created_at DESC""",location_ids,device_id)
        effect,reason=None,"Default deny: no matching rule"
        for rule in rules:
            if not self._rule_is_current(rule,now): continue
            subject,target=rule["subject_type"].lower(),rule["subject_id"].lower()
            match=(subject=="all" or subject=="user" and target==str(user_id) or subject=="role" and target in roles or subject=="group" and target in groups or subject=="hostel" and user["hostel_id"] and target==str(user["hostel_id"]) or subject=="student_own_hostel" and user["hostel_id"] and user["user_type"]=="student" and str(user["hostel_id"])==str(location_id))
            if match: effect,reason=rule["effect"],f"Matched rule: {rule['name']}"; break
        if effect=="DENY": return await self._log_event(conn,user_id,location_id,action,"DENIED",reason,rfid_uid,reader_id,device_id,face_confidence)
        # A location grant applies to its child locations. `location_ids`
        # contains the requested location and its ancestors, so an active grant
        # on any of them authorizes this request unless an explicit deny matched.
        direct_grant = await conn.fetchval("""SELECT EXISTS(
            SELECT 1 FROM user_location_access
            WHERE user_id=$1 AND location_id = ANY($2::uuid[]) AND status='active'
              AND (valid_from IS NULL OR valid_from <= $3)
              AND (valid_until IS NULL OR valid_until >= $3)
        )""", user_id, location_ids, now)
        if direct_grant:
            return await self._log_event(conn,user_id,location_id,action,"GRANTED","Direct location access grant",rfid_uid,reader_id,device_id,face_confidence)
        if temporary: return await self._log_event(conn,user_id,location_id,action,"GRANTED","Temporary access grant",rfid_uid,reader_id,device_id,face_confidence)
        if user["user_type"] == "student" and (not location or location["type"].lower() != "hostel"):
            return await self._log_event(conn, user_id, location_id, action, "GRANTED", "Campus Freedom: Student authorized for general campus zone", rfid_uid, reader_id, device_id, face_confidence)
        if effect!="ALLOW": return await self._log_event(conn,user_id,location_id,action,"DENIED",reason,rfid_uid,reader_id,device_id,face_confidence)
        return await self._log_event(conn,user_id,location_id,action,"GRANTED",reason,rfid_uid,reader_id,device_id,face_confidence)

    @staticmethod
    def _rule_is_current(rule, now: datetime.datetime) -> bool:
        if (rule["valid_from"] and now.date()<rule["valid_from"]) or (rule["valid_to"] and now.date()>rule["valid_to"]): return False
        if rule["schedule_days"] and now.isoweekday() not in rule["schedule_days"]: return False
        current=now.timetz().replace(tzinfo=None)
        return not ((rule["schedule_start_time"] and current<rule["schedule_start_time"]) or (rule["schedule_end_time"] and current>rule["schedule_end_time"]))

    async def _notify_alert(self, conn, alert_type: str, message: str, user_id: uuid.UUID, location_id: uuid.UUID) -> None:
        row = await conn.fetchrow("""INSERT INTO alerts(type,message,user_id,location_id) VALUES($1,$2,$3,$4)
            RETURNING id,created_at""", alert_type, message, user_id, location_id)
        asyncio.create_task(manager.broadcast({"type":"SYSTEM_ALERT","data":{"id":str(row["id"]),"alert_type":alert_type,"message":message,"user_id":str(user_id),"location_id":str(location_id),"created_at":row["created_at"].isoformat()}}))

    async def _log_event(self,conn,user_id,location_id,action,status,reason,rfid_uid=None,reader_id=None,device_id=None,face_confidence=None,verification_id=None)->AccessEvent:
        row=await conn.fetchrow("""INSERT INTO access_events(user_id,location_id,action,status,reason,rfid_uid,reader_id,device_id,face_confidence)
            VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id,event_time""",user_id,location_id,action,status,reason,rfid_uid,reader_id,device_id,face_confidence)
        if status=="GRANTED" and user_id: await conn.execute("""INSERT INTO user_last_locations(user_id,location_id,last_event_time,last_action) VALUES($1,$2,$3,$4)
            ON CONFLICT(user_id) DO UPDATE SET location_id=EXCLUDED.location_id,last_event_time=EXCLUDED.last_event_time,last_action=EXCLUDED.last_action""",user_id,location_id if action=="ENTRY" else None,row["event_time"],action)
        details=await conn.fetchrow("""SELECT u.email,COALESCE(sp.full_name,fp.full_name,wp.full_name,vp.full_name,'Unknown') AS full_name,l.name AS location_name FROM users u
            LEFT JOIN student_profiles sp ON sp.user_id=u.id LEFT JOIN faculty_profiles fp ON fp.user_id=u.id LEFT JOIN worker_profiles wp ON wp.user_id=u.id LEFT JOIN visitor_profiles vp ON vp.user_id=u.id
            LEFT JOIN locations l ON l.id=$2 WHERE u.id=$1""",user_id,location_id) if user_id else None
        event=AccessEvent(id=row["id"],user_id=user_id,location_id=location_id,action=action,status=status,reason=reason,event_time=row["event_time"],rfid_uid=rfid_uid,reader_id=reader_id,device_id=device_id,face_confidence=face_confidence,verification_id=verification_id,user_name=details["full_name"] if details else "Unknown",user_identifier=details["email"] if details else rfid_uid,location_name=details["location_name"] if details else None)
        payload=event.model_dump(mode="json")
        asyncio.create_task(manager.broadcast({"type":"ACCESS_EVENT","data":payload}))
        if status=="DENIED": asyncio.create_task(manager.broadcast_review({"type":"DENIED_ACCESS_REVIEW","data":payload}))
        if status=="GRANTED": asyncio.create_task(manager.broadcast({"type":"ZONE_OCCUPANCY_UPDATED","data":await self.get_occupancy(conn,location_id)}))
        return event

    async def get_events(self,conn,limit:int=50,only_denied:bool=False,user_id:Optional[uuid.UUID]=None)->List[AccessEvent]:
        clauses,args=["1=1"],[]
        if only_denied: clauses.append("e.status='DENIED'")
        if user_id: args.append(user_id);clauses.append(f"e.user_id=${len(args)}")
        args.append(min(max(limit,1),500))
        rows=await conn.fetch(f"""SELECT e.*,COALESCE(sp.full_name,fp.full_name,wp.full_name,vp.full_name,'Unknown') AS user_name,
            COALESCE(sp.roll_number,fp.employee_id,wp.employee_id,vp.gov_id_number,u.email,e.rfid_uid) AS user_identifier,l.name AS location_name FROM access_events e
            LEFT JOIN users u ON u.id=e.user_id LEFT JOIN student_profiles sp ON sp.user_id=u.id LEFT JOIN faculty_profiles fp ON fp.user_id=u.id LEFT JOIN worker_profiles wp ON wp.user_id=u.id LEFT JOIN visitor_profiles vp ON vp.user_id=u.id LEFT JOIN locations l ON l.id=e.location_id
            WHERE {' AND '.join(clauses)} ORDER BY e.event_time DESC LIMIT ${len(args)}""",*args)
        return [AccessEvent(**dict(row)) for row in rows]

    # ══════════════════════════════════════════════════════════════════════════
    # Enhanced Access Management methods
    # ══════════════════════════════════════════════════════════════════════════

    async def search_access_users(
        self, conn: asyncpg.Connection, *,
        search: Optional[str] = None,
        user_type: Optional[str] = None,
        role: Optional[str] = None,
        department: Optional[str] = None,
        course: Optional[str] = None,
        semester: Optional[str] = None,
        hostel: Optional[str] = None,
        designation: Optional[str] = None,
        job_type: Optional[str] = None,
        work_area: Optional[str] = None,
        shift: Optional[str] = None,
        visit_purpose: Optional[str] = None,
        host_person: Optional[str] = None,
        campus: Optional[str] = None,
        status: Optional[str] = None,
        access_filter: Optional[str] = None,  # no_access | partial | full
        page: int = 1,
        page_size: int = 25,
    ) -> AccessUserSearchResult:
        """Server-side paginated user search for the access management panel."""
        page = max(1, page)
        page_size = min(max(1, page_size), 50)
        offset = (page - 1) * page_size

        clauses: list[str] = []
        args: list[Any] = []
        idx = 1

        if user_type and user_type.strip():
            clauses.append(f"u.user_type = ${idx}")
            args.append(user_type.strip().lower())
            idx += 1
        if status and status.strip():
            clauses.append(f"u.status = ${idx}")
            args.append(status.strip().lower())
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
        if hostel and hostel.strip():
            clauses.append(f"h.name = ${idx}")
            args.append(hostel.strip())
            idx += 1
        if designation and designation.strip():
            clauses.append(f"COALESCE(fp.designation, wp.designation) = ${idx}")
            args.append(designation.strip())
            idx += 1
        if job_type and job_type.strip():
            clauses.append(f"wp.job_type = ${idx}")
            args.append(job_type.strip())
            idx += 1
        if work_area and work_area.strip():
            clauses.append(f"wp.work_area = ${idx}")
            args.append(work_area.strip())
            idx += 1
        if shift and shift.strip():
            clauses.append(f"wp.shift = ${idx}")
            args.append(shift.strip())
            idx += 1
        if visit_purpose and visit_purpose.strip():
            clauses.append(f"vp.visit_purpose = ${idx}")
            args.append(visit_purpose.strip())
            idx += 1
        if host_person and host_person.strip():
            clauses.append(f"vp.host_person ILIKE ${idx}")
            args.append(f"%{host_person.strip()}%")
            idx += 1
        if role and role.strip():
            clauses.append(f"EXISTS (SELECT 1 FROM user_roles ur2 JOIN roles r2 ON r2.id=ur2.role_id WHERE ur2.user_id=u.id AND r2.name=${idx})")
            args.append(role.strip().upper())
            idx += 1
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

        # Access-level filter
        if access_filter == "no_access":
            clauses.append("NOT EXISTS (SELECT 1 FROM user_location_access ula WHERE ula.user_id=u.id AND ula.status='active')")
        elif access_filter == "partial":
            clauses.append("EXISTS (SELECT 1 FROM user_location_access ula WHERE ula.user_id=u.id AND ula.status='active')")
            clauses.append("NOT EXISTS (SELECT 1 FROM user_location_access ula WHERE ula.user_id=u.id AND ula.status='active' AND ula.access_level='ADMIN' AND EXISTS (SELECT 1 FROM locations lc WHERE lc.id=ula.location_id AND lc.type='campus'))")
        elif access_filter == "full":
            clauses.append("EXISTS (SELECT 1 FROM user_location_access ula JOIN locations lc ON lc.id=ula.location_id WHERE ula.user_id=u.id AND ula.status='active' AND ula.access_level='ADMIN' AND lc.type='campus')")

        where_sql = f"WHERE {' AND '.join(clauses)}" if clauses else ""

        base_from = f"""
            FROM users u
            LEFT JOIN student_profiles sp ON sp.user_id=u.id AND u.user_type='student'
            LEFT JOIN faculty_profiles fp ON fp.user_id=u.id AND u.user_type='faculty'
            LEFT JOIN worker_profiles wp ON wp.user_id=u.id AND u.user_type='worker'
            LEFT JOIN visitor_profiles vp ON vp.user_id=u.id AND u.user_type='visitor'
            LEFT JOIN departments d ON d.id=COALESCE(sp.department_id,fp.department_id,wp.department_id)
            LEFT JOIN hostels h ON h.id=sp.hostel_id
            {where_sql}
        """

        total = await conn.fetchval(f"SELECT COUNT(*) {base_from}", *args)

        query = f"""
            SELECT
                u.id, u.email, u.user_type, u.status, u.phone, u.keycloak_user_id,
                COALESCE(sp.full_name,fp.full_name,wp.full_name,vp.full_name) AS full_name,
                sp.roll_number,
                COALESCE(fp.employee_id,wp.employee_id) AS employee_id,
                d.name AS department,
                sp.course, sp.semester,
                h.name AS hostel_name,
                COALESCE(sp.photo_reference,fp.photo_reference,wp.photo_reference,vp.photo_reference) AS photo_reference,
                COALESCE((SELECT array_agg(r.name ORDER BY r.name)
                          FROM user_roles ur JOIN roles r ON r.id=ur.role_id
                          WHERE ur.user_id=u.id), ARRAY[]::text[]) AS roles,
                COALESCE((SELECT array_agg(DISTINCT l.name ORDER BY l.name)
                          FROM user_location_access ula JOIN locations l ON l.id=ula.location_id
                          WHERE ula.user_id=u.id AND ula.status='active'), ARRAY[]::text[]) AS locations,
                (SELECT COUNT(*) FROM user_roles ur WHERE ur.user_id=u.id) AS role_count,
                (SELECT COUNT(*) FROM user_location_access ula WHERE ula.user_id=u.id AND ula.status='active') AS grant_count
            {base_from}
            ORDER BY u.created_at DESC
            LIMIT ${idx} OFFSET ${idx + 1}
        """
        rows = await conn.fetch(query, *args, page_size, offset)

        users = [
            AccessUserSummary(
                id=r["id"], email=r["email"], user_type=r["user_type"],
                status=r["status"], phone=r["phone"],
                full_name=r["full_name"], roll_number=r["roll_number"],
                employee_id=r["employee_id"], department=r["department"],
                course=r["course"], semester=r["semester"],
                hostel_name=r["hostel_name"], photo_reference=r["photo_reference"],
                roles=r["roles"] or [],
                locations=r["locations"] or [],
                role_count=r["role_count"], grant_count=r["grant_count"],
                keycloak_linked=bool(r["keycloak_user_id"]),
            )
            for r in rows
        ]
        total_pages = (total + page_size - 1) // page_size if total > 0 else 1
        return AccessUserSearchResult(
            users=users, total=total, page=page,
            page_size=page_size, total_pages=total_pages,
        )

    async def get_user_access_detail(
        self, conn: asyncpg.Connection, user_id: uuid.UUID,
    ) -> UserAccessDetail:
        """Load full user detail with roles, location grants, and temp grants."""
        user = await conn.fetchrow("""
            SELECT u.id, u.email, u.phone, u.user_type, u.status,
                   u.keycloak_user_id, u.created_at, u.updated_at,
                   COALESCE(sp.full_name,fp.full_name,wp.full_name,vp.full_name) AS full_name,
                   sp.roll_number,
                   COALESCE(fp.employee_id,wp.employee_id) AS employee_id,
                   COALESCE(sp.department_id,fp.department_id,wp.department_id) AS department_id,
                   d.name AS department, d.school,
                   sp.course, sp.semester,
                   COALESCE(fp.designation,wp.designation) AS designation,
                   sp.hostel_id, h.name AS hostel_name,
                   COALESCE(sp.photo_reference,fp.photo_reference,wp.photo_reference,vp.photo_reference) AS photo_reference
            FROM users u
            LEFT JOIN student_profiles sp ON sp.user_id=u.id AND u.user_type='student'
            LEFT JOIN faculty_profiles fp ON fp.user_id=u.id AND u.user_type='faculty'
            LEFT JOIN worker_profiles wp ON wp.user_id=u.id AND u.user_type='worker'
            LEFT JOIN visitor_profiles vp ON vp.user_id=u.id AND u.user_type='visitor'
            LEFT JOIN departments d ON d.id=COALESCE(sp.department_id,fp.department_id,wp.department_id)
            LEFT JOIN hostels h ON h.id=sp.hostel_id
            WHERE u.id=$1
        """, user_id)
        if not user:
            raise ValueError("User not found")

        # Roles
        role_rows = await conn.fetch(
            "SELECT r.name FROM roles r JOIN user_roles ur ON ur.role_id=r.id WHERE ur.user_id=$1 ORDER BY r.name",
            user_id,
        )
        roles = [r["name"] for r in role_rows]

        # Location grants
        grant_rows = await conn.fetch("""
            SELECT ula.*, l.name AS location_name, l.type AS location_type,
                   COALESCE(sp2.full_name,fp2.full_name,wp2.full_name,vp2.full_name) AS granted_by_name
            FROM user_location_access ula
            JOIN locations l ON l.id=ula.location_id
            LEFT JOIN users u2 ON u2.id=ula.granted_by
            LEFT JOIN student_profiles sp2 ON sp2.user_id=u2.id
            LEFT JOIN faculty_profiles fp2 ON fp2.user_id=u2.id
            LEFT JOIN worker_profiles wp2 ON wp2.user_id=u2.id
            LEFT JOIN visitor_profiles vp2 ON vp2.user_id=u2.id
            WHERE ula.user_id=$1
            ORDER BY ula.status ASC, l.name
        """, user_id)
        location_grants = [
            UserLocationAccessGrant(
                id=g["id"], location_id=g["location_id"],
                location_name=g["location_name"], location_type=g["location_type"],
                access_level=g["access_level"],
                valid_from=g["valid_from"], valid_until=g["valid_until"],
                status=g["status"], granted_by=g["granted_by"],
                granted_by_name=g["granted_by_name"],
                revoked_at=g["revoked_at"], revoked_by=g["revoked_by"],
                reason=g["reason"],
                created_at=g["created_at"], updated_at=g["updated_at"],
            )
            for g in grant_rows
        ]

        # Temporary grants
        temp_rows = await conn.fetch("""
            SELECT id, user_id, location_id, valid_from, valid_to, granted_by, reason, created_at
            FROM temporary_access_grants
            WHERE user_id=$1 ORDER BY created_at DESC
        """, user_id)
        temp_grants = [TemporaryAccessGrant(**dict(t)) for t in temp_rows]

        return UserAccessDetail(
            id=user["id"], email=user["email"], phone=user["phone"],
            user_type=user["user_type"], status=user["status"],
            full_name=user["full_name"], roll_number=user["roll_number"],
            employee_id=user["employee_id"],
            department=user["department"], department_id=user["department_id"],
            school=user["school"], course=user["course"], semester=user["semester"],
            designation=user["designation"],
            hostel_name=user["hostel_name"], hostel_id=user["hostel_id"],
            photo_reference=user["photo_reference"],
            keycloak_user_id=user["keycloak_user_id"],
            keycloak_linked=bool(user["keycloak_user_id"]),
            roles=roles,
            location_grants=location_grants,
            temporary_grants=temp_grants,
            created_at=user["created_at"], updated_at=user["updated_at"],
        )

    async def get_user_effective_permissions(
        self, conn: asyncpg.Connection, user_id: uuid.UUID,
    ) -> List[EffectivePermission]:
        """Compute effective permissions including explicit grants, roles, profile affiliations, and hierarchy inheritance."""
        # 1. Fetch user roles and profile assignments
        user_info = await conn.fetchrow("""
            SELECT u.id, u.user_type, u.status,
                   sp.hostel_id AS student_hostel_id,
                   COALESCE(sp.department_id, fp.department_id, wp.department_id) AS department_id
            FROM users u
            LEFT JOIN student_profiles sp ON sp.user_id = u.id
            LEFT JOIN faculty_profiles fp ON fp.user_id = u.id
            LEFT JOIN worker_profiles wp ON wp.user_id = u.id
            WHERE u.id = $1
        """, user_id)
        if not user_info:
            return []

        role_rows = await conn.fetch(
            "SELECT r.name FROM roles r JOIN user_roles ur ON ur.role_id=r.id WHERE ur.user_id=$1", user_id
        )
        user_roles = set(r["name"].upper() for r in role_rows)
        is_admin = bool(user_roles.intersection({"SUPER_ADMIN", "ADMIN"}))
        is_security = bool(user_roles.intersection({"SECURITY_GUARD", "GUARD", "SECURITY_ADMIN"}))
        is_warden = "WARDEN" in user_roles

        # 2. Get explicit grants
        grants = await conn.fetch("""
            SELECT ula.location_id, ula.access_level, l.name AS location_name, l.type AS location_type
            FROM user_location_access ula
            JOIN locations l ON l.id=ula.location_id
            WHERE ula.user_id=$1 AND ula.status='active'
              AND (ula.valid_until IS NULL OR ula.valid_until >= now())
        """, user_id)

        effective_map: Dict[uuid.UUID, dict] = {}

        # If user is Admin / Super Admin, they have ADMIN access to all locations
        if is_admin:
            all_locs = await conn.fetch("SELECT id, name, type FROM locations WHERE status='active' ORDER BY name")
            for loc in all_locs:
                effective_map[loc["id"]] = {
                    "location_name": loc["name"],
                    "location_type": loc["type"],
                    "access_level": "ADMIN",
                    "source": "role",
                }

        # Profile/Role based entitlements:
        # A) Student Hostel
        if user_info["student_hostel_id"]:
            # Find location matching hostel
            h_locs = await conn.fetch("""
                SELECT l.id, l.name, l.type FROM locations l
                JOIN hostels h ON h.id = $1
                WHERE l.name ILIKE '%' || h.name || '%' OR l.id = h.id
            """, user_info["student_hostel_id"])
            for h_loc in h_locs:
                loc_id = h_loc["id"]
                if loc_id not in effective_map or ACCESS_LEVELS_ORDER["ENTRY"] > ACCESS_LEVELS_ORDER.get(effective_map[loc_id]["access_level"], 0):
                    effective_map[loc_id] = {
                        "location_name": h_loc["name"], "location_type": h_loc["type"],
                        "access_level": "ENTRY", "source": "hostel_resident"
                    }

        # B) Warden Assigned Hostels
        if is_warden:
            w_hostel_ids = await conn.fetchval("""
                SELECT COALESCE(array_agg(DISTINCT h_id), ARRAY[]::uuid[]) FROM (
                    SELECT hostel_id AS h_id FROM warden_hostels WHERE user_id = $1 AND hostel_id IS NOT NULL
                    UNION
                    SELECT hostel_id AS h_id FROM warden_profiles WHERE user_id = $1 AND hostel_id IS NOT NULL
                ) sub
            """, user_id)
            if w_hostel_ids:
                w_locs = await conn.fetch("""
                    SELECT l.id, l.name, l.type FROM locations l
                    JOIN hostels h ON h.id = ANY($1::uuid[])
                    WHERE l.name ILIKE '%' || h.name || '%' OR l.id = h.id
                """, list(w_hostel_ids))
                for w_loc in w_locs:
                    loc_id = w_loc["id"]
                    if loc_id not in effective_map or ACCESS_LEVELS_ORDER["MANAGE"] > ACCESS_LEVELS_ORDER.get(effective_map[loc_id]["access_level"], 0):
                        effective_map[loc_id] = {
                            "location_name": w_loc["name"], "location_type": w_loc["type"],
                            "access_level": "MANAGE", "source": "warden_jurisdiction"
                        }

        # C) Security Personnel Gates & Checkpoints
        if is_security:
            sec_locs = await conn.fetch("""
                SELECT id, name, type FROM locations
                WHERE status='active' AND (
                    type IN ('gate', 'checkpoint', 'turnstile', 'security', 'control_room')
                    OR name ILIKE '%gate%' OR name ILIKE '%barrier%'
                )
            """)
            sec_level = "MANAGE" if "SECURITY_ADMIN" in user_roles else "ENTRY"
            for s_loc in sec_locs:
                loc_id = s_loc["id"]
                if loc_id not in effective_map or ACCESS_LEVELS_ORDER[sec_level] > ACCESS_LEVELS_ORDER.get(effective_map[loc_id]["access_level"], 0):
                    effective_map[loc_id] = {
                        "location_name": s_loc["name"], "location_type": s_loc["type"],
                        "access_level": sec_level, "source": "security_assignment"
                    }

        # D) Academic Department
        if user_info["department_id"]:
            dept_locs = await conn.fetch("""
                SELECT l.id, l.name, l.type FROM locations l
                JOIN departments d ON d.id = $1
                WHERE l.name ILIKE '%' || d.name || '%' OR l.id = d.id
            """, user_info["department_id"])
            dept_level = "MANAGE" if "FACULTY" in user_roles else "ENTRY"
            for d_loc in dept_locs:
                loc_id = d_loc["id"]
                if loc_id not in effective_map or ACCESS_LEVELS_ORDER[dept_level] > ACCESS_LEVELS_ORDER.get(effective_map[loc_id]["access_level"], 0):
                    effective_map[loc_id] = {
                        "location_name": d_loc["name"], "location_type": d_loc["type"],
                        "access_level": dept_level, "source": "department_member"
                    }

        # E) Campus Common / Public Zones for all active users
        if user_info["status"] == "active":
            common_locs = await conn.fetch("""
                SELECT id, name, type FROM locations
                WHERE status='active' AND (
                    type IN ('public', 'common', 'campus', 'library', 'temple', 'canteen', 'garden')
                    OR name ILIKE '%library%' OR name ILIKE '%main campus%' OR name ILIKE '%mandir%'
                )
                AND type <> 'campus' AND name NOT ILIKE '%main campus%'
            """)
            for c_loc in common_locs:
                loc_id = c_loc["id"]
                if loc_id not in effective_map:
                    effective_map[loc_id] = {
                        "location_name": c_loc["name"], "location_type": c_loc["type"],
                        "access_level": "ENTRY", "source": "campus_common"
                    }

        # F) Explicit grants override/enrich default levels
        for g in grants:
            loc_id = g["location_id"]
            if loc_id not in effective_map or ACCESS_LEVELS_ORDER.get(g["access_level"], 0) >= ACCESS_LEVELS_ORDER.get(effective_map[loc_id]["access_level"], 0):
                effective_map[loc_id] = {
                    "location_name": g["location_name"],
                    "location_type": g["location_type"],
                    "access_level": g["access_level"],
                    "source": "explicit",
                }

        permissions: List[EffectivePermission] = []
        for loc_id, g in effective_map.items():
            permissions.append(EffectivePermission(
                location_id=loc_id, location_name=g["location_name"],
                location_type=g["location_type"], access_level=g["access_level"],
                source=g.get("source", "explicit"),
            ))

        # 3. Expand inherited permissions for child locations in hierarchy
        base_locations = list(effective_map.items())
        for loc_id, g in base_locations:
            children = await conn.fetch("""
                WITH RECURSIVE subtree AS (
                    SELECT id, name, type FROM locations WHERE parent_id=$1 AND status='active'
                    UNION ALL
                    SELECT l.id, l.name, l.type FROM locations l JOIN subtree s ON l.parent_id=s.id WHERE l.status='active'
                ) SELECT id, name, type FROM subtree
            """, loc_id)
            for child in children:
                child_id = child["id"]
                if child_id not in effective_map:
                    already = next((p for p in permissions if p.location_id == child_id), None)
                    if not already or ACCESS_LEVELS_ORDER.get(g["access_level"], 0) > ACCESS_LEVELS_ORDER.get(already.access_level, 0):
                        if already:
                            permissions.remove(already)
                        permissions.append(EffectivePermission(
                            location_id=child_id, location_name=child["name"],
                            location_type=child["type"], access_level=g["access_level"],
                            source="inherited", inherited_from=loc_id,
                            inherited_from_name=g["location_name"],
                        ))

        return sorted(permissions, key=lambda p: p.location_name)

    async def get_location_tree(self, conn: asyncpg.Connection) -> List[LocationTreeNode]:
        """Build the full location hierarchy as a nested tree."""
        rows = await conn.fetch(
            "SELECT id, name, type, description, parent_id, status FROM locations ORDER BY name"
        )
        nodes: Dict[uuid.UUID, LocationTreeNode] = {}
        for r in rows:
            nodes[r["id"]] = LocationTreeNode(
                id=r["id"], name=r["name"], type=r["type"],
                description=r["description"], parent_id=r["parent_id"],
                status=r["status"],
            )

        roots: List[LocationTreeNode] = []
        for node in nodes.values():
            if node.parent_id and node.parent_id in nodes:
                nodes[node.parent_id].children.append(node)
            else:
                roots.append(node)
        return roots

    async def create_location_grant(
        self, conn: asyncpg.Connection, req: CreateLocationGrantRequest,
        admin_id: Optional[uuid.UUID] = None,
    ) -> UserLocationAccessGrant:
        """Create or update a location access grant with audit logging."""
        level = req.access_level.upper()
        if level not in ACCESS_LEVELS_ORDER:
            raise ValueError(f"Invalid access_level: {level}")

        # Verify user and location exist
        user_exists = await conn.fetchval("SELECT EXISTS(SELECT 1 FROM users WHERE id=$1)", req.user_id)
        if not user_exists:
            raise ValueError("User not found")
        loc = await conn.fetchrow("SELECT name, type FROM locations WHERE id=$1", req.location_id)
        if not loc:
            raise ValueError("Location not found")

        # Check if grant already exists for this (user_id, location_id)
        existing_id = await conn.fetchval(
            "SELECT id FROM user_location_access WHERE user_id = $1 AND location_id = $2 ORDER BY updated_at DESC LIMIT 1",
            req.user_id, req.location_id,
        )
        if existing_id:
            row = await conn.fetchrow("""
                UPDATE user_location_access
                SET access_level = $1, valid_from = $2, valid_until = $3, status = 'active',
                    granted_by = $4, reason = $5, revoked_at = NULL, revoked_by = NULL, updated_at = now()
                WHERE id = $6
                RETURNING *
            """, level, req.valid_from, req.valid_until, admin_id, req.reason, existing_id)
        else:
            row = await conn.fetchrow("""
                INSERT INTO user_location_access
                    (user_id, location_id, access_level, valid_from, valid_until, status, granted_by, reason)
                VALUES ($1, $2, $3, $4, $5, 'active', $6, $7)
                ON CONFLICT (user_id, location_id, access_level) DO UPDATE SET
                    valid_from=EXCLUDED.valid_from, valid_until=EXCLUDED.valid_until,
                    status='active', granted_by=EXCLUDED.granted_by, reason=EXCLUDED.reason,
                    revoked_at=NULL, revoked_by=NULL, updated_at=now()
                RETURNING *
            """, req.user_id, req.location_id, level,
                 req.valid_from, req.valid_until, admin_id, req.reason)

        # Audit log
        from app.services.audit_service import audit_service
        await audit_service.log(
            conn, str(admin_id) if admin_id else None, "LOCATION_ACCESS_GRANTED", "user", str(req.user_id),
            after_state={
                "location_id": str(req.location_id), "location_name": loc["name"],
                "access_level": level, "valid_until": str(req.valid_until) if req.valid_until else "permanent",
                "reason": req.reason,
            },
        )

        grant = UserLocationAccessGrant(
            id=row["id"], location_id=row["location_id"],
            location_name=loc["name"], location_type=loc["type"],
            access_level=row["access_level"],
            valid_from=row["valid_from"], valid_until=row["valid_until"],
            status=row["status"], granted_by=row["granted_by"],
            reason=row["reason"],
            created_at=row["created_at"], updated_at=row["updated_at"],
        )
        await redis_client.invalidate_user_cache(req.user_id)
        return grant

    async def update_location_grant(
        self, conn: asyncpg.Connection, grant_id: uuid.UUID,
        req: UpdateLocationGrantRequest, admin_id: uuid.UUID,
    ) -> Optional[UserLocationAccessGrant]:
        """Update an existing location access grant."""
        current = await conn.fetchrow(
            "SELECT ula.*, l.name AS location_name, l.type AS location_type FROM user_location_access ula JOIN locations l ON l.id=ula.location_id WHERE ula.id=$1",
            grant_id,
        )
        if not current:
            return None

        new_level = (req.access_level or current["access_level"]).upper()
        new_status = req.status or current["status"]
        if new_level not in ACCESS_LEVELS_ORDER:
            raise ValueError(f"Invalid access_level: {new_level}")
        if new_status not in {"active", "revoked", "expired"}:
            raise ValueError(f"Invalid grant status: {new_status}")
        # JSON null explicitly clears the expiry; an omitted property preserves
        # the existing expiry.
        new_valid_until = req.valid_until if "valid_until" in req.model_fields_set else current["valid_until"]

        row = await conn.fetchrow("""
            UPDATE user_location_access
            SET access_level=$1, valid_until=$2, status=$3, reason=COALESCE($4, reason), updated_at=now()
            WHERE id=$5 RETURNING *
        """, new_level, new_valid_until, new_status, req.reason, grant_id)

        from app.services.audit_service import audit_service
        await audit_service.log(
            conn, str(admin_id), "LOCATION_ACCESS_UPDATED", "user", str(current["user_id"]),
            before_state={"access_level": current["access_level"], "status": current["status"]},
            after_state={"access_level": new_level, "status": new_status, "reason": req.reason},
        )

        grant = UserLocationAccessGrant(
            id=row["id"], location_id=row["location_id"],
            location_name=current["location_name"], location_type=current["location_type"],
            access_level=row["access_level"],
            valid_from=row["valid_from"], valid_until=row["valid_until"],
            status=row["status"], granted_by=row["granted_by"],
            reason=row["reason"],
            created_at=row["created_at"], updated_at=row["updated_at"],
        )
        await redis_client.invalidate_user_cache(current["user_id"])
        return grant

    async def revoke_location_grant(
        self, conn: asyncpg.Connection, grant_id: uuid.UUID, admin_id: uuid.UUID,
    ) -> bool:
        """Revoke a location access grant."""
        current = await conn.fetchrow(
            "SELECT user_id, location_id, access_level FROM user_location_access WHERE id=$1", grant_id,
        )
        if not current:
            return False

        await conn.execute("""
            UPDATE user_location_access
            SET status='revoked', revoked_at=now(), revoked_by=$1, updated_at=now()
            WHERE id=$2
        """, admin_id, grant_id)

        from app.services.audit_service import audit_service
        loc_name = await conn.fetchval("SELECT name FROM locations WHERE id=$1", current["location_id"])
        await audit_service.log(
            conn, str(admin_id), "LOCATION_ACCESS_REVOKED", "user", str(current["user_id"]),
            before_state={
                "location_id": str(current["location_id"]), "location_name": loc_name,
                "access_level": current["access_level"],
            },
        )
        await redis_client.invalidate_user_cache(current["user_id"])
        return True

    async def expire_stale_grants(self, conn: asyncpg.Connection) -> int:
        """Expire location grants past their valid_until. Returns count of expired."""
        result = await conn.execute("""
            UPDATE user_location_access
            SET status='expired', updated_at=now()
            WHERE status='active' AND valid_until IS NOT NULL AND valid_until < now()
        """)
        count1 = int(result.split()[-1]) if result else 0

        result2 = await conn.execute("""
            UPDATE temporary_access_grants
            SET status='expired'
            WHERE (status='active' OR status IS NULL) AND valid_to < now()
        """)
        count2 = int(result2.split()[-1]) if result2 else 0
        total = count1 + count2
        if total > 0:
            logger.info("Expired %d stale access grants (%d location, %d temporary)", total, count1, count2)
        return total

    async def get_access_audit_logs(
        self, conn: asyncpg.Connection, *,
        user_id: Optional[uuid.UUID] = None,
        page: int = 1,
        page_size: int = 25,
    ) -> AccessAuditLogResult:
        """Retrieve access-management-specific audit logs."""
        page = max(1, page)
        page_size = min(max(1, page_size), 100)
        offset = (page - 1) * page_size

        access_ops = [
            "LOCATION_ACCESS_GRANTED", "LOCATION_ACCESS_REVOKED",
            "LOCATION_ACCESS_UPDATED", "LOCATION_ACCESS_EXPIRED",
            "ACCESS_CONFIGURATION_UPDATED", "ROLE_ASSIGNED", "ROLE_REMOVED",
            "HOSTEL_ACCESS_GRANTED", "HOSTEL_ACCESS_REVOKED",
        ]

        clauses = [f"al.operation = ANY($1::text[])"]
        args: list[Any] = [access_ops]
        idx = 2

        if user_id:
            clauses.append(f"al.entity_id = ${idx}")
            args.append(str(user_id))
            idx += 1

        where_sql = f"WHERE {' AND '.join(clauses)}"

        total = await conn.fetchval(
            f"SELECT COUNT(*) FROM audit_logs al {where_sql}", *args,
        )

        rows = await conn.fetch(f"""
            SELECT al.id, al.actor_id, al.operation, al.entity_type, al.entity_id,
                   al.before_state, al.after_state, al.created_at,
                   COALESCE(sp.full_name,fp.full_name,wp.full_name,vp.full_name,u.email) AS actor_email
            FROM audit_logs al
            LEFT JOIN users u ON u.id=al.actor_id
            LEFT JOIN student_profiles sp ON sp.user_id=u.id
            LEFT JOIN faculty_profiles fp ON fp.user_id=u.id
            LEFT JOIN worker_profiles wp ON wp.user_id=u.id
            LEFT JOIN visitor_profiles vp ON vp.user_id=u.id
            {where_sql}
            ORDER BY al.created_at DESC
            LIMIT ${idx} OFFSET ${idx + 1}
        """, *args, page_size, offset)

        logs = [
            AccessAuditLogEntry(
                id=r["id"], actor_id=str(r["actor_id"]) if r["actor_id"] else None,
                actor_email=r["actor_email"],
                operation=r["operation"], entity_type=r["entity_type"],
                entity_id=r["entity_id"],
                before_state=json.loads(r["before_state"]) if r["before_state"] else None,
                after_state=json.loads(r["after_state"]) if r["after_state"] else None,
                created_at=r["created_at"],
            )
            for r in rows
        ]
        total_pages = (total + page_size - 1) // page_size if total > 0 else 1
        return AccessAuditLogResult(
            logs=logs, total=total, page=page,
            page_size=page_size, total_pages=total_pages,
        )

    async def get_user_location_grants(
        self, conn: asyncpg.Connection, user_id: uuid.UUID
    ) -> List[UserLocationAccessGrant]:
        """Fetch all location grants for a given user."""
        rows = await conn.fetch("""
            SELECT ula.*, l.name AS location_name, l.type AS location_type,
                   COALESCE(sp2.full_name,fp2.full_name,wp2.full_name,vp2.full_name) AS granted_by_name
            FROM user_location_access ula
            JOIN locations l ON l.id=ula.location_id
            LEFT JOIN users u2 ON u2.id=ula.granted_by
            LEFT JOIN student_profiles sp2 ON sp2.user_id=u2.id
            LEFT JOIN faculty_profiles fp2 ON fp2.user_id=u2.id
            LEFT JOIN worker_profiles wp2 ON wp2.user_id=u2.id
            LEFT JOIN visitor_profiles vp2 ON vp2.user_id=u2.id
            WHERE ula.user_id=$1
            ORDER BY CASE WHEN ula.status='active' THEN 0 ELSE 1 END, l.name
        """, user_id)
        return [
            UserLocationAccessGrant(
                id=g["id"], location_id=g["location_id"],
                location_name=g["location_name"], location_type=g["location_type"],
                access_level=g["access_level"],
                valid_from=g["valid_from"], valid_until=g["valid_until"],
                status=g["status"], granted_by=g["granted_by"],
                granted_by_name=g["granted_by_name"],
                revoked_at=g["revoked_at"], revoked_by=g["revoked_by"],
                reason=g["reason"],
                created_at=g["created_at"], updated_at=g["updated_at"],
            )
            for g in rows
        ]

    async def sync_user_location_grants(
        self,
        conn: asyncpg.Connection,
        user_id: uuid.UUID,
        location_ids: List[uuid.UUID],
        access_level: str = "ENTRY",
        admin_id: Optional[uuid.UUID] = None,
        reason: Optional[str] = "Assigned via Access Management",
    ) -> List[UserLocationAccessGrant]:
        """Atomically synchronize active location grants for a user."""
        level = (access_level or "ENTRY").upper()
        if level not in ACCESS_LEVELS_ORDER:
            level = "ENTRY"

        user_exists = await conn.fetchval("SELECT EXISTS(SELECT 1 FROM users WHERE id=$1)", user_id)
        if not user_exists:
            raise ValueError("User not found")

        # Verify all location_ids exist
        target_ids = set(location_ids)
        if target_ids:
            found_count = await conn.fetchval(
                "SELECT COUNT(*) FROM locations WHERE id = ANY($1::uuid[])", list(target_ids)
            )
            if found_count != len(target_ids):
                raise ValueError("One or more selected locations do not exist")

        existing = await conn.fetch(
            "SELECT id, location_id FROM user_location_access WHERE user_id = $1 AND status = 'active'",
            user_id,
        )
        existing_map: Dict[uuid.UUID, List[uuid.UUID]] = {}
        for row in existing:
            existing_map.setdefault(row["location_id"], []).append(row["id"])

        to_revoke = set(existing_map.keys()) - target_ids
        to_grant = target_ids - set(existing_map.keys())

        from app.services.audit_service import audit_service

        async with conn.transaction():
            # Revoke unselected locations
            for loc_id in to_revoke:
                loc_name = await conn.fetchval("SELECT name FROM locations WHERE id = $1", loc_id)
                for grant_id in existing_map[loc_id]:
                    await conn.execute(
                        """
                        UPDATE user_location_access
                        SET status = 'revoked', revoked_at = now(), revoked_by = $1, updated_at = now()
                        WHERE id = $2
                        """,
                        admin_id, grant_id,
                    )
                    await audit_service.log(
                        conn, str(admin_id) if admin_id else None, "LOCATION_ACCESS_REVOKED", "user", str(user_id),
                        before_state={"location_id": str(loc_id), "location_name": loc_name, "reason": "Revoked via Access Management sync"},
                    )

            # Insert / reactivate selected locations
            for loc_id in to_grant:
                await conn.execute("""
                    INSERT INTO user_location_access
                        (user_id, location_id, access_level, valid_from, valid_until, status, granted_by, reason)
                    VALUES ($1, $2, $3, now(), NULL, 'active', $4, $5)
                    ON CONFLICT (user_id, location_id, access_level) DO UPDATE SET
                        valid_from=EXCLUDED.valid_from, valid_until=EXCLUDED.valid_until,
                        status='active', granted_by=EXCLUDED.granted_by, reason=EXCLUDED.reason,
                        revoked_at=NULL, revoked_by=NULL, updated_at=now()
                """, user_id, loc_id, level, admin_id, reason)
                loc_name = await conn.fetchval("SELECT name FROM locations WHERE id = $1", loc_id)
                await audit_service.log(
                    conn, str(admin_id) if admin_id else None, "LOCATION_ACCESS_GRANTED", "user", str(user_id),
                    after_state={"location_id": str(loc_id), "location_name": loc_name, "access_level": level, "reason": reason},
                )

        await redis_client.invalidate_user_cache(user_id)
        return await self.get_user_location_grants(conn, user_id)


access_service = AccessService()
