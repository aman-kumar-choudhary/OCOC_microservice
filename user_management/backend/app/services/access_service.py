from typing import List, Optional
import uuid
import datetime
import asyncio
import logging
import asyncpg

from app.routers.ws import manager
from app.schemas.access import (
    AccessRule, CreateAccessRuleRequest, UpdateAccessRuleRequest,
    TemporaryAccessGrant, CreateTemporaryAccessRequest, AccessEvent, Location
)

logger = logging.getLogger(__name__)


class AccessService:
    # ── Locations ────────────────────────────────────────────────────────────

    async def get_locations(self, conn: asyncpg.Connection) -> List[Location]:
        rows = await conn.fetch("SELECT * FROM locations ORDER BY name")
        return [Location(**dict(row)) for row in rows]

    # ── Access Rules ──────────────────────────────────────────────────────────

    async def create_rule(self, conn: asyncpg.Connection, req: CreateAccessRuleRequest) -> AccessRule:
        row = await conn.fetchrow(
                """
                INSERT INTO access_rules (
                    name, description, subject_type, subject_id, location_id,
                    schedule_days, schedule_start_time, schedule_end_time,
                    valid_from, valid_to, effect, priority
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
                RETURNING *
                """,
                req.name, req.description, req.subject_type, req.subject_id, req.location_id,
                req.schedule_days, req.schedule_start_time, req.schedule_end_time,
                req.valid_from, req.valid_to, req.effect, req.priority
            )
        return AccessRule(**dict(row))

    async def get_rules(self, conn: asyncpg.Connection) -> List[AccessRule]:
        rows = await conn.fetch("SELECT * FROM access_rules ORDER BY priority DESC, created_at DESC")
        return [AccessRule(**dict(row)) for row in rows]

    async def update_rule(self, conn: asyncpg.Connection, rule_id: uuid.UUID, req: UpdateAccessRuleRequest) -> Optional[AccessRule]:
        row = await conn.fetchrow(
            "UPDATE access_rules SET is_active = $1, updated_at = NOW() WHERE id = $2 RETURNING *",
            req.is_active, rule_id
        )
        if row:
            return AccessRule(**dict(row))
        return None

    # ── Temporary Grants ──────────────────────────────────────────────────────

    async def create_temporary_grant(self, conn: asyncpg.Connection, req: CreateTemporaryAccessRequest, admin_id: uuid.UUID) -> TemporaryAccessGrant:
        row = await conn.fetchrow(
                """
                INSERT INTO temporary_access_grants (user_id, location_id, valid_from, valid_to, granted_by, reason)
                VALUES ($1, $2, $3, $4, $5, $6)
                RETURNING *
                """,
                req.user_id, req.location_id, req.valid_from, req.valid_to, admin_id, req.reason
            )
        return TemporaryAccessGrant(**dict(row))
            
    async def get_temporary_grants(self, conn: asyncpg.Connection) -> List[dict]:
        # Join with users to get name
        rows = await conn.fetch("""
            SELECT t.*, 
                   u.email,
                   COALESCE(p_stu.full_name, p_fac.full_name, p_wor.full_name, p_vis.full_name, 'Unknown') as user_name
            FROM temporary_access_grants t
            JOIN users u ON t.user_id = u.id
            LEFT JOIN student_profiles p_stu ON u.id = p_stu.user_id
            LEFT JOIN faculty_profiles p_fac ON u.id = p_fac.user_id
            LEFT JOIN worker_profiles p_wor ON u.id = p_wor.user_id
            LEFT JOIN visitor_profiles p_vis ON u.id = p_vis.user_id
            ORDER BY t.created_at DESC
        """)
        result = []
        for row in rows:
            d = dict(row)
            # Serialize non-JSON-safe types
            for key, val in d.items():
                if hasattr(val, 'isoformat'):
                    d[key] = val.isoformat()
                elif hasattr(val, 'hex'):  # UUID
                    d[key] = str(val)
            result.append(d)
        return result


    # ── Evaluation Engine (Anti-passback included) ────────────────────────────

    async def evaluate_access(self, conn: asyncpg.Connection, user_id: uuid.UUID, location_id: uuid.UUID, action: str = "ENTRY") -> AccessEvent:
        now = datetime.datetime.now(datetime.timezone.utc)
        today = now.date()
        current_time = now.time()
        current_day = now.isoweekday() # 1=Mon, 7=Sun

        # 1. Gather User Context
        user_row = await conn.fetchrow("""
                SELECT u.id, u.user_type, u.status, 
                       (p_stu.hostel_id IS NOT NULL) as hostel_flag, p_stu.hostel_id,
                       p_stu.department_id as stu_dept,
                       p_fac.department_id as fac_dept,
                       COALESCE(p_stu.full_name, p_fac.full_name, p_wor.full_name, p_vis.full_name, 'Unknown') as full_name
                FROM users u
                LEFT JOIN student_profiles p_stu ON u.id = p_stu.user_id
                LEFT JOIN faculty_profiles p_fac ON u.id = p_fac.user_id
                LEFT JOIN worker_profiles p_wor ON u.id = p_wor.user_id
                LEFT JOIN visitor_profiles p_vis ON u.id = p_vis.user_id
                WHERE u.id = $1
            """, user_id)
            
        if not user_row:
            return await self._log_event(conn, user_id, location_id, action, "DENIED", "User not found")
                
        if user_row["status"] != "active":
            return await self._log_event(conn, user_id, location_id, action, "DENIED", f"User status is {user_row['status']}")

            # Roles mapping
        user_type = user_row["user_type"]
            
        # Anti-passback Check (for ENTRY only)
        if action == "ENTRY":
            last_loc = await conn.fetchrow("SELECT location_id, last_action FROM user_last_locations WHERE user_id = $1", user_id)
            if last_loc and last_loc["last_action"] == "ENTRY" and last_loc["location_id"] == location_id:
                return await self._log_event(conn, user_id, location_id, action, "DENIED", "Anti-passback: Already inside this zone")
        elif action == "EXIT":
            last_loc = await conn.fetchrow("SELECT location_id, last_action FROM user_last_locations WHERE user_id = $1", user_id)
            if not last_loc or last_loc["last_action"] == "EXIT":
                pass

        # 1.5 Fetch Location info for alerts
        loc_row = await conn.fetchrow("SELECT name, type FROM locations WHERE id = $1", location_id)
        loc_name = loc_row["name"].lower() if loc_row else ""
        loc_type = loc_row["type"].lower() if loc_row else ""

        # Curfew Check (T05.02)
        if action == "ENTRY" and loc_type == "hostel" and user_type == "student":
            curfew_limit = datetime.time(20, 0) # 8:00 PM default for girls' hostels
            if "paninni" in loc_name or "arvind" in loc_name:
                curfew_limit = datetime.time(19, 55) # 7:55 PM
            
            if current_time > curfew_limit or current_time < datetime.time(5, 0):
                await self._create_alert(conn, "CURFEW_VIOLATION", f"Student {user_row['full_name']} entered hostel after curfew ({curfew_limit.strftime('%I:%M %p')}).", user_id, location_id)
        
        # Leave Expiry Check (T04.03)
        if action == "EXIT" and ("main gate" in loc_name or "out of campus" in loc_name) and user_type == "student":
            leave = await conn.fetchrow("""
                SELECT * FROM student_leaves 
                WHERE user_id = $1 AND status = 'APPROVED'
                  AND valid_from <= $2 AND valid_to >= $2
            """, user_id, now)
            if not leave:
                await self._create_alert(conn, "LEAVE_VIOLATION", f"Student {user_row['full_name']} exited campus without an active leave pass.", user_id, location_id)

        # 2. Check Temporary Grants
        grant = await conn.fetchrow("""
            SELECT * FROM temporary_access_grants 
            WHERE user_id = $1 AND location_id = $2 
              AND valid_from <= $3 AND valid_to >= $3
            LIMIT 1
        """, user_id, location_id, now)
        
        if grant:
            return await self._log_event(conn, user_id, location_id, action, "GRANTED", "Temporary access grant")

        # 3. Check Active Access Rules
        rules = await conn.fetch("""
            SELECT * FROM access_rules 
            WHERE is_active = true 
              AND (location_id = $1 OR location_id IS NULL)
            ORDER BY priority DESC
        """, location_id)
        
        granted = False
        reason = "No matching rules found"
        
        for rule in rules:
            # Time/Date schedule check
            if rule["valid_from"] and today < rule["valid_from"]: continue
            if rule["valid_to"] and today > rule["valid_to"]: continue
            if rule["schedule_days"] and current_day not in rule["schedule_days"]: continue
            if rule["schedule_start_time"] and current_time < rule["schedule_start_time"]: continue
            if rule["schedule_end_time"] and current_time > rule["schedule_end_time"]: continue
            
            # Subject check
            match = False
            if rule["subject_type"] == "user" and rule["subject_id"] == str(user_id): match = True
            elif rule["subject_type"] == "role" and rule["subject_id"] == user_type: match = True
            elif rule["subject_type"] == "all": match = True
            elif rule["subject_type"] == "student_own_hostel" and user_type == "student" and user_row["hostel_flag"] and str(user_row["hostel_id"]) == str(location_id): match = True
            elif rule["subject_type"] == "hostel" and user_row["hostel_flag"] and str(user_row["hostel_id"]) == rule["subject_id"]: match = True
            
            if match:
                granted = (rule["effect"] == "ALLOW")
                reason = f"Matched rule: {rule['name']}"
                break # Priority determines the first match wins
        
        if not granted:
            # Default Deny if no rule matched
            reason = reason if reason != "No matching rules found" else "Default Deny: No rules allow access"
            return await self._log_event(conn, user_id, location_id, action, "DENIED", reason)
        
        return await self._log_event(conn, user_id, location_id, action, "GRANTED", reason)
    async def _log_event(self, conn, user_id, location_id, action, status, reason):
        row = await conn.fetchrow("""
            INSERT INTO access_events (user_id, location_id, action, status, reason)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING id, event_time
        """, user_id, location_id, action, status, reason)
        
        # Update passback state if GRANTED
        if status == "GRANTED":
            await conn.execute("""
                INSERT INTO user_last_locations (user_id, location_id, last_event_time, last_action)
                VALUES ($1, $2, $3, $4)
                ON CONFLICT (user_id) DO UPDATE 
                SET location_id = EXCLUDED.location_id, 
                    last_event_time = EXCLUDED.last_event_time, 
                    last_action = EXCLUDED.last_action
            """, user_id, location_id if action == "ENTRY" else None, row["event_time"], action)
            
        # Get UI details
        details = await conn.fetchrow("""
            SELECT u.email, COALESCE(p_stu.full_name, p_fac.full_name, p_wor.full_name, p_vis.full_name, 'Unknown') as full_name,
                   l.name as location_name
            FROM users u
            LEFT JOIN student_profiles p_stu ON u.id = p_stu.user_id
            LEFT JOIN faculty_profiles p_fac ON u.id = p_fac.user_id
            LEFT JOIN worker_profiles p_wor ON u.id = p_wor.user_id
            LEFT JOIN visitor_profiles p_vis ON u.id = p_vis.user_id
            LEFT JOIN locations l ON l.id = $2
            WHERE u.id = $1
        """, user_id, location_id)
        
        event_response = AccessEvent(
            id=row["id"], user_id=user_id, location_id=location_id,
            action=action, status=status, reason=reason, event_time=row["event_time"],
            user_name=details["full_name"] if details else None,
            user_identifier=details["email"] if details else None,
            location_name=details["location_name"] if details else None
        )

        # Broadcast via WebSockets
        try:
            event_data = {
                "type": "ACCESS_EVENT",
                "data": event_response.model_dump()
            }
            # Convert UUIDs/datetimes for JSON
            event_data["data"]["id"] = str(event_data["data"]["id"])
            event_data["data"]["user_id"] = str(event_data["data"]["user_id"])
            event_data["data"]["location_id"] = str(event_data["data"]["location_id"])
            event_data["data"]["event_time"] = event_data["data"]["event_time"].isoformat()
            asyncio.create_task(manager.broadcast(event_data))
        except Exception as e:
            logger.error(f"WebSocket broadcast error: {e}")

        return event_response

    async def _create_alert(self, conn: asyncpg.Connection, type: str, message: str, user_id: uuid.UUID, location_id: uuid.UUID):
        row = await conn.fetchrow("""
            INSERT INTO alerts (type, message, user_id, location_id)
            VALUES ($1, $2, $3, $4)
            RETURNING id, created_at
        """, type, message, user_id, location_id)
        
        try:
            alert_data = {
                "type": "SYSTEM_ALERT",
                "data": {
                    "id": str(row["id"]),
                    "alert_type": type,
                    "message": message,
                    "user_id": str(user_id) if user_id else None,
                    "location_id": str(location_id) if location_id else None,
                    "created_at": row["created_at"].isoformat()
                }
            }
            asyncio.create_task(manager.broadcast(alert_data))
        except Exception as e:
            logger.error(f"WebSocket alert broadcast error: {e}")

    # ── Logs ──────────────────────────────────────────────────────────────────

    async def get_events(self, conn: asyncpg.Connection, limit: int = 50, only_denied: bool = False, user_id: Optional[uuid.UUID] = None) -> List[AccessEvent]:
        query = """
            SELECT e.*, 
                   COALESCE(p_stu.full_name, p_fac.full_name, p_wor.full_name, p_vis.full_name, 'Unknown') as user_name,
                   COALESCE(p_stu.roll_number, p_fac.employee_id, p_wor.employee_id, p_vis.gov_id_number, u.email) as user_identifier,
                   l.name as location_name
            FROM access_events e
            JOIN users u ON e.user_id = u.id
            LEFT JOIN student_profiles p_stu ON u.id = p_stu.user_id
            LEFT JOIN faculty_profiles p_fac ON u.id = p_fac.user_id
            LEFT JOIN worker_profiles p_wor ON u.id = p_wor.user_id
            LEFT JOIN visitor_profiles p_vis ON u.id = p_vis.user_id
            LEFT JOIN locations l ON e.location_id = l.id
            WHERE 1=1
        """
        args = []
        if only_denied:
            query += " AND e.status = 'DENIED'"
        if user_id:
            args.append(user_id)
            query += f" AND e.user_id = ${len(args)}"
            
        args.append(limit)
        query += f" ORDER BY e.event_time DESC LIMIT ${len(args)}"
        
        rows = await conn.fetch(query, *args)
        return [AccessEvent(**dict(row)) for row in rows]

access_service = AccessService()
