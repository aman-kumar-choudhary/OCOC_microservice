import datetime
from typing import Optional
import uuid
import asyncpg
import logging
import asyncio

from app.schemas.hostel import ScanResponse
from app.routers.ws import manager

logger = logging.getLogger(__name__)

class HostelRFIDService:

    async def handle_scan(self, conn: asyncpg.Connection, uid: str, reader_id: str) -> ScanResponse:
        now = datetime.datetime.now(datetime.timezone.utc)
        
        # 1. Update reader heartbeat
        reader = await conn.fetchrow("""
            UPDATE rfid_readers 
            SET last_heartbeat = $1, status = 'ONLINE' 
            WHERE reader_id = $2 
            RETURNING id, gate_id, direction
        """, now, reader_id)
        
        if not reader:
            return ScanResponse(
                success=False, status="DENIED", reason="UNKNOWN_READER",
                event_time=now, message="RFID reader not registered."
            )
            
        gate_id = reader['gate_id']
        direction = reader['direction'] # 'IN' or 'OUT'
        reader_db_id = reader['id']
        
        # 2. Identify Student from RFID
        card = await conn.fetchrow("""
            SELECT rc.id, urc.user_id, rc.status
            FROM rfid_cards rc
            LEFT JOIN user_rfid_cards urc ON urc.rfid_card_id = rc.id AND urc.unassigned_at IS NULL
            WHERE UPPER(rc.uid) = $1
        """, uid.strip().replace(":", "").replace("-", "").upper())
        
        if not card or card['status'] != 'active':
            return ScanResponse(
                success=False, status="DENIED", reason="INVALID_CARD",
                event_time=now, message="Card is invalid or inactive."
            )
            
        # Is user a student?
        user_id = card['user_id']
        student = await conn.fetchrow("""
            SELECT sp.full_name, sp.hostel_id, h.name as hostel_name
            FROM student_profiles sp
            LEFT JOIN hostels h ON sp.hostel_id = h.id
            WHERE sp.user_id = $1
        """, user_id)
        
        if not student:
            return ScanResponse(
                success=False, status="DENIED", reason="NOT_A_STUDENT",
                student_id=user_id, event_time=now, message="User is not registered as a hostel student."
            )
            
        student_name = student['full_name']
        
        # 3. Get Current Status & Active Permissions
        status_row = await conn.fetchrow("""
            SELECT current_status, active_permission_id
            FROM student_hostel_status
            WHERE student_id = $1
        """, user_id)
        
        current_status = status_row['current_status'] if status_row else "UNKNOWN"
        active_perm = None
        if status_row and status_row['active_permission_id']:
            active_perm = await conn.fetchrow("""
                SELECT id, permission_type, end_time
                FROM hostel_permissions
                WHERE id = $1 AND status = 'ACTIVE' AND end_time > $2
            """, status_row['active_permission_id'], now)
            
        # 4. Check Gate Rules (Curfew)
        # Assuming gate rule applies if it exists. Simplified rule check based on time.
        gate_rule = await conn.fetchrow("""
            SELECT opening_time, closing_time 
            FROM gate_rules 
            WHERE gate_id = $1 AND is_active = true
            LIMIT 1
        """, gate_id)
        
        # Determine if gate is currently "Closed" (meaning no normal exit allowed)
        gate_closed = False
        if gate_rule:
            current_time = now.time()
            if gate_rule['closing_time'] < gate_rule['opening_time']:
                # Crosses midnight (e.g. 20:00 to 06:00)
                if current_time >= gate_rule['closing_time'] or current_time < gate_rule['opening_time']:
                    gate_closed = True
            else:
                if current_time >= gate_rule['closing_time'] and current_time < gate_rule['opening_time']:
                    gate_closed = True

        # 5. Access Decision Logic
        access_granted = False
        reason = None
        new_status = current_status
        alert_type = None

        if direction == 'OUT':
            if gate_closed:
                if active_perm:
                    access_granted = True
                    new_status = "ON_LEAVE"
                    reason = "PERMISSION_GRANTED"
                else:
                    access_granted = False
                    reason = "GATE_CLOSED"
                    alert_type = "UNAUTHORIZED_EXIT_ATTEMPT"
            else:
                # Gate is open, normal exit
                access_granted = True
                new_status = "OUTSIDE"
                reason = "NORMAL_EXIT"
                if active_perm:
                    new_status = "ON_LEAVE"
        else:
            # IN direction
            access_granted = True
            reason = "NORMAL_ENTRY"
            new_status = "INSIDE"
            
            # Check if they were on leave and returning late
            if active_perm:
                if now > active_perm['end_time']:
                    alert_type = "LATE_RETURN"
                # Mark permission as used/expired? We can just leave it to expire naturally or mark USED.
                # For simplicity, we just update their status to INSIDE, and the dashboard knows they returned.
                
        # 6. Record Movement
        movement_id = await conn.fetchval("""
            INSERT INTO hostel_movement (
                student_id, rfid_card_id, gate_id, reader_id, event_type, status, reason, permission_id, event_time
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING id
        """, user_id, card['id'], gate_id, reader_db_id, direction, "ALLOWED" if access_granted else "DENIED", reason, active_perm['id'] if active_perm else None, now)

        # 7. Update Student Status if Allowed
        if access_granted:
            # If entering, we might clear the active permission or leave it. 
            # If leaving without permission (normal), active_perm is None.
            perm_id = active_perm['id'] if (active_perm and direction == 'OUT') else None
            
            await conn.execute("""
                INSERT INTO student_hostel_status (student_id, current_status, last_movement_id, last_event_time, active_permission_id, updated_at)
                VALUES ($1, $2, $3, $4, $5, $6)
                ON CONFLICT (student_id) DO UPDATE SET
                    current_status = EXCLUDED.current_status,
                    last_movement_id = EXCLUDED.last_movement_id,
                    last_event_time = EXCLUDED.last_event_time,
                    active_permission_id = EXCLUDED.active_permission_id,
                    updated_at = EXCLUDED.updated_at
            """, user_id, new_status, movement_id, now, perm_id, now)
            asyncio.create_task(manager.broadcast({
                "type": "HOSTEL_STATUS_UPDATED",
                "data": {
                    "student_id": str(user_id), "student_name": student_name,
                    "hostel_id": str(student['hostel_id']) if student['hostel_id'] else None,
                    "hostel_name": student['hostel_name'], "status": new_status,
                    "direction": direction, "event_time": now.isoformat()
                }
            }))

        # 8. Trigger Alerts
        if alert_type:
            desc = f"Student attempted to exit at {now.strftime('%H:%M')} without active permission." if alert_type == "UNAUTHORIZED_EXIT_ATTEMPT" else f"Student returned late."
            alert = await conn.fetchrow("""
                INSERT INTO hostel_alerts (student_id, alert_type, description, severity)
                VALUES ($1, $2, $3, $4)
                RETURNING id, created_at
            """, user_id, alert_type, desc, "HIGH" if alert_type == "UNAUTHORIZED_EXIT_ATTEMPT" else "WARNING")
            asyncio.create_task(manager.broadcast({
                "type": "HOSTEL_CURFEW_ALERT" if alert_type == "LATE_RETURN" else "HOSTEL_ALERT",
                "data": {"id": str(alert['id']), "alert_type": alert_type, "message": desc,
                         "student_id": str(user_id), "student_name": student_name,
                         "hostel_id": str(student['hostel_id']) if student['hostel_id'] else None,
                         "created_at": alert['created_at'].isoformat()}
            }))

        if access_granted:
            return ScanResponse(
                success=True, status="ALLOWED", reason=reason,
                student_name=student_name, student_id=user_id,
                event_time=now, message="Access Granted"
            )
        else:
            return ScanResponse(
                success=False, status="DENIED", reason=reason,
                student_name=student_name, student_id=user_id,
                event_time=now, message="Access Denied: Gate Closed & No Permission"
            )

hostel_rfid_service = HostelRFIDService()
