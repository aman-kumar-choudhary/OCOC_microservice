from __future__ import annotations

import asyncio
import datetime
import logging
from typing import List, Optional
import uuid

import asyncpg

from app.routers.ws import manager
from app.schemas.access import AccessEvent, AccessGroup, AccessRule, AddAccessGroupMemberRequest, CreateAccessGroupRequest, CreateAccessRuleRequest, CreateTemporaryAccessRequest, Location, TemporaryAccessGrant, UpdateAccessRuleRequest

logger = logging.getLogger(__name__)


class AccessService:
    """The single access-decision path for RFID and manual evaluations."""

    async def get_locations(self, conn: asyncpg.Connection) -> List[Location]:
        rows = await conn.fetch("SELECT * FROM locations ORDER BY type, name")
        return [Location(**dict(row)) for row in rows]

    async def get_devices(self, conn: asyncpg.Connection) -> list[dict]:
        rows = await conn.fetch("""SELECT d.id,d.mac_address,d.type,d.status,d.location_id,l.name AS location_name
            FROM devices d LEFT JOIN locations l ON l.id=d.location_id
            WHERE d.type IN ('RFID_READER','TURNSTILE','FACE_CAMERA') ORDER BY d.type,d.mac_address""")
        return [dict(row) for row in rows]

    async def get_groups(self, conn: asyncpg.Connection) -> List[AccessGroup]:
        rows = await conn.fetch("SELECT id,name,description FROM access_groups ORDER BY name")
        return [AccessGroup(**dict(row)) for row in rows]

    async def create_group(self, conn: asyncpg.Connection, req: CreateAccessGroupRequest) -> AccessGroup:
        row = await conn.fetchrow("INSERT INTO access_groups(name,description) VALUES($1,$2) RETURNING id,name,description", req.name, req.description)
        return AccessGroup(**dict(row))

    async def add_group_member(self, conn: asyncpg.Connection, group_id: uuid.UUID, user_id: uuid.UUID) -> None:
        await conn.execute("INSERT INTO access_group_members(group_id,user_id) VALUES($1,$2) ON CONFLICT DO NOTHING", group_id, user_id)

    async def create_rule(self, conn: asyncpg.Connection, req: CreateAccessRuleRequest) -> AccessRule:
        row = await conn.fetchrow("""INSERT INTO access_rules (name,description,subject_type,subject_id,location_id,device_id,schedule_days,schedule_start_time,schedule_end_time,valid_from,valid_to,effect,priority)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *""",
            req.name, req.description, req.subject_type.lower(), req.subject_id, req.location_id, req.device_id,
            req.schedule_days, req.schedule_start_time, req.schedule_end_time, req.valid_from, req.valid_to, req.effect.upper(), req.priority)
        return AccessRule(**dict(row))

    async def get_rules(self, conn: asyncpg.Connection) -> List[AccessRule]:
        rows = await conn.fetch("SELECT * FROM access_rules ORDER BY priority DESC,created_at DESC")
        return [AccessRule(**dict(row)) for row in rows]

    async def get_rule_stats(self, conn: asyncpg.Connection) -> dict:
        row = await conn.fetchrow("""SELECT COUNT(*) AS total,COUNT(*) FILTER(WHERE is_active) AS enabled,
            COUNT(*) FILTER(WHERE is_active AND effect='ALLOW') AS allow_count,
            COUNT(*) FILTER(WHERE is_active AND effect='DENY') AS deny_count FROM access_rules""")
        return dict(row)

    async def update_rule(self, conn: asyncpg.Connection, rule_id: uuid.UUID, req: UpdateAccessRuleRequest) -> Optional[AccessRule]:
        row = await conn.fetchrow("UPDATE access_rules SET is_active=$1,updated_at=NOW() WHERE id=$2 RETURNING *", req.is_active, rule_id)
        return AccessRule(**dict(row)) if row else None

    async def create_temporary_grant(self, conn: asyncpg.Connection, req: CreateTemporaryAccessRequest, admin_id: uuid.UUID) -> TemporaryAccessGrant:
        if req.valid_to <= req.valid_from:
            raise ValueError("valid_to must be after valid_from")
        row = await conn.fetchrow("""INSERT INTO temporary_access_grants(user_id,location_id,valid_from,valid_to,granted_by,reason)
            VALUES($1,$2,$3,$4,$5,$6) RETURNING *""", req.user_id,req.location_id,req.valid_from,req.valid_to,admin_id,req.reason)
        return TemporaryAccessGrant(**dict(row))

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
            has_leave = await conn.fetchval("""SELECT EXISTS(SELECT 1 FROM student_leaves WHERE user_id=$1 AND status='APPROVED'
                AND valid_from <= $2 AND valid_to >= $2)""", user_id, now)
            if not has_leave:
                await self._notify_alert(conn, "LEAVE_EXPIRY_WARNING", f"{user['full_name']} has no active leave/pass at exit.", user_id, location_id)
        if action == "ENTRY" and user["user_type"] == "student" and location and location["type"].lower() == "hostel":
            current_time = now.timetz().replace(tzinfo=None)
            if current_time >= datetime.time(20, 0) or current_time < datetime.time(5, 0):
                await self._notify_alert(conn, "CURFEW_VIOLATION", f"Late hostel return: {user['full_name']} checked in at {now.strftime('%H:%M UTC')}.", user_id, location_id)
        if action=="ENTRY":
            last=await conn.fetchval("""SELECT action FROM access_events WHERE rfid_uid=$1 AND location_id=$2 AND status='GRANTED' ORDER BY event_time DESC LIMIT 1""",rfid_uid,location_id) if rfid_uid else await conn.fetchval("SELECT last_action FROM user_last_locations WHERE user_id=$1 AND location_id=$2",user_id,location_id)
            if last=="ENTRY": return await self._log_event(conn,user_id,location_id,action,"DENIED","Anti-passback: card is already inside this zone",rfid_uid,reader_id,device_id,face_confidence)
        temporary=await conn.fetchval("SELECT EXISTS(SELECT 1 FROM temporary_access_grants WHERE user_id=$1 AND location_id=$2 AND valid_from<=$3 AND valid_to>=$3)",user_id,location_id,now)
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
        if temporary: return await self._log_event(conn,user_id,location_id,action,"GRANTED","Temporary access grant",rfid_uid,reader_id,device_id,face_confidence)
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


access_service=AccessService()
