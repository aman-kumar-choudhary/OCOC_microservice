from typing import List, Optional
import uuid
import datetime
import asyncpg
import logging

from app.schemas.hostel import (
    HostelDashboardStats, StudentHostelStatus, MovementHistory, 
    HostelPermission, CreatePermissionRequest, HostelAlert, EmergencyHeadcount
)

logger = logging.getLogger(__name__)

class HostelService:

    async def get_dashboard_stats(self, conn: asyncpg.Connection, hostel_id: Optional[uuid.UUID] = None) -> HostelDashboardStats:
        # Base where clause if hostel_id is provided
        # For simplicity, if not provided, aggregate across all
        
        hostel_filter = ""
        args = []
        if hostel_id:
            hostel_filter = "WHERE sp.hostel_id = $1"
            args.append(hostel_id)
            
        query_base = f"""
            FROM student_profiles sp
            JOIN users u ON sp.user_id = u.id
            LEFT JOIN student_hostel_status shs ON u.id = shs.student_id
            {hostel_filter}
        """

        total_students = await conn.fetchval(f"SELECT COUNT(*) {query_base}", *args)
        
        # 'INSIDE'
        inside = await conn.fetchval(f"SELECT COUNT(*) {query_base} AND shs.current_status = 'INSIDE'", *args)
        
        # 'OUTSIDE'
        outside = await conn.fetchval(f"SELECT COUNT(*) {query_base} AND shs.current_status = 'OUTSIDE'", *args)
        
        # 'ON_LEAVE'
        on_leave = await conn.fetchval(f"SELECT COUNT(*) {query_base} AND shs.current_status = 'ON_LEAVE'", *args)
        
        # 'UNAUTHORIZED'
        unauthorized = await conn.fetchval(f"SELECT COUNT(*) {query_base} AND shs.current_status = 'UNAUTHORIZED'", *args)
        
        # 'LATE_RETURN'
        late_returns = await conn.fetchval(f"SELECT COUNT(*) {query_base} AND shs.current_status = 'LATE_RETURN'", *args)
        
        # Active permissions
        perm_filter = "WHERE p.status = 'ACTIVE' AND p.end_time > NOW()"
        if hostel_id:
            perm_filter += " AND p.student_id IN (SELECT user_id FROM student_profiles WHERE hostel_id = $1)"
        active_permissions = await conn.fetchval(f"SELECT COUNT(*) FROM hostel_permissions p {perm_filter}", *args)
        
        # Attendance (today)
        today = datetime.date.today()
        att_args = [today]
        att_filter = "WHERE date = $1"
        if hostel_id:
            att_filter += " AND hostel_id = $2"
            att_args.append(hostel_id)
            
        attendance_marked = await conn.fetchval(f"SELECT COUNT(*) FROM hostel_attendance {att_filter} AND status = 'PRESENT'", *att_args)
        attendance_missing = await conn.fetchval(f"SELECT COUNT(*) FROM hostel_attendance {att_filter} AND status = 'ABSENT'", *att_args)
        
        return HostelDashboardStats(
            total_students=total_students or 0,
            inside=inside or 0,
            outside=outside or 0,
            on_leave=on_leave or 0,
            attendance_marked=attendance_marked or 0,
            attendance_missing=attendance_missing or 0,
            unauthorized_outside=unauthorized or 0,
            late_returns=late_returns or 0,
            active_permissions=active_permissions or 0
        )

    async def get_live_status(self, conn: asyncpg.Connection, hostel_id: Optional[uuid.UUID] = None) -> List[StudentHostelStatus]:
        hostel_filter = ""
        args = []
        if hostel_id:
            hostel_filter = "WHERE sp.hostel_id = $1"
            args.append(hostel_id)
            
        rows = await conn.fetch(f"""
            SELECT 
                u.id as student_id,
                COALESCE(shs.current_status, 'INSIDE') as current_status,
                shs.last_event_time,
                shs.active_permission_id,
                sp.full_name as student_name,
                sp.roll_number as student_roll,
                h.name as hostel_name,
                hm.event_type as last_movement_type,
                hg.name as last_gate_name,
                hp.permission_type as active_permission_type
            FROM users u
            JOIN student_profiles sp ON u.id = sp.user_id
            LEFT JOIN hostels h ON sp.hostel_id = h.id
            LEFT JOIN student_hostel_status shs ON u.id = shs.student_id
            LEFT JOIN hostel_movement hm ON shs.last_movement_id = hm.id
            LEFT JOIN hostel_gates hg ON hm.gate_id = hg.id
            LEFT JOIN hostel_permissions hp ON shs.active_permission_id = hp.id
            {hostel_filter}
            ORDER BY shs.last_event_time DESC NULLS LAST
            LIMIT 1000
        """, *args)
        
        return [StudentHostelStatus(**dict(r)) for r in rows]

    async def grant_permission(self, conn: asyncpg.Connection, actor_id: Optional[uuid.UUID], req: CreatePermissionRequest) -> HostelPermission:
        row = await conn.fetchrow("""
            INSERT INTO hostel_permissions (
                student_id, granted_by, permission_type, start_time, end_time, reason, status
            ) VALUES (
                $1, $2, $3, $4, $5, $6, 'ACTIVE'
            ) RETURNING *
        """, req.student_id, actor_id, req.permission_type, req.start_time, req.end_time, req.reason)
        
        # We should also update the student's status if they are already inside, to reflect they have an active permission.
        # But this is primarily handled during exit scan. If we want it immediate on the dashboard:
        await conn.execute("""
            INSERT INTO student_hostel_status (student_id, current_status, active_permission_id)
            VALUES ($1, 'INSIDE', $2)
            ON CONFLICT (student_id) DO UPDATE SET active_permission_id = EXCLUDED.active_permission_id
        """, req.student_id, row['id'])
        
        return HostelPermission(**dict(row))

    async def revoke_permission(self, conn: asyncpg.Connection, permission_id: uuid.UUID) -> None:
        await conn.execute("""
            UPDATE hostel_permissions SET status = 'REVOKED', updated_at = NOW() WHERE id = $1
        """, permission_id)
        
        await conn.execute("""
            UPDATE student_hostel_status SET active_permission_id = NULL WHERE active_permission_id = $1
        """, permission_id)

    async def get_permissions(self, conn: asyncpg.Connection, student_id: Optional[uuid.UUID] = None, hostel_id: Optional[uuid.UUID] = None) -> List[HostelPermission]:
        filter_sql = ""
        args = []
        if student_id:
            filter_sql = "WHERE hp.student_id = $1"
            args.append(student_id)
        elif hostel_id:
            filter_sql = "WHERE sp.hostel_id = $1"
            args.append(hostel_id)
            
        rows = await conn.fetch(f"""
            SELECT hp.*, 
                   sp.full_name as student_name, 
                   sp.roll_number as student_roll,
                   COALESCE(wp.full_name, fp.full_name, gp.full_name, 'Warden') as granted_by_name
            FROM hostel_permissions hp
            JOIN student_profiles sp ON hp.student_id = sp.user_id
            LEFT JOIN users u ON hp.granted_by = u.id
            LEFT JOIN worker_profiles wp ON u.id = wp.user_id
            LEFT JOIN faculty_profiles fp ON u.id = fp.user_id
            LEFT JOIN student_profiles gp ON u.id = gp.user_id
            {filter_sql}
            ORDER BY hp.created_at DESC
            LIMIT 500
        """, *args)
        
        return [HostelPermission(**dict(r)) for r in rows]

    async def get_movement_history(self, conn: asyncpg.Connection, hostel_id: Optional[uuid.UUID] = None) -> List[MovementHistory]:
        filter_sql = ""
        args = []
        if hostel_id:
            filter_sql = "WHERE sp.hostel_id = $1"
            args.append(hostel_id)
            
        rows = await conn.fetch(f"""
            SELECT hm.*, 
                   hg.name as gate_name,
                   sp.full_name as student_name,
                   sp.roll_number as student_roll
            FROM hostel_movement hm
            JOIN users u ON hm.student_id = u.id
            JOIN student_profiles sp ON u.id = sp.user_id
            LEFT JOIN hostel_gates hg ON hm.gate_id = hg.id
            {filter_sql}
            ORDER BY hm.event_time DESC
            LIMIT 1000
        """, *args)
        
        return [MovementHistory(**dict(r)) for r in rows]

    async def get_alerts(self, conn: asyncpg.Connection, hostel_id: Optional[uuid.UUID] = None) -> List[HostelAlert]:
        filter_sql = ""
        args = []
        if hostel_id:
            filter_sql = "WHERE sp.hostel_id = $1"
            args.append(hostel_id)
            
        rows = await conn.fetch(f"""
            SELECT ha.*,
                   sp.full_name as student_name,
                   sp.roll_number as student_roll
            FROM hostel_alerts ha
            JOIN users u ON ha.student_id = u.id
            JOIN student_profiles sp ON u.id = sp.user_id
            {filter_sql}
            ORDER BY ha.created_at DESC
            LIMIT 100
        """, *args)
        return [HostelAlert(**dict(r)) for r in rows]
        
    async def get_emergency_headcount(self, conn: asyncpg.Connection, hostel_id: Optional[uuid.UUID] = None) -> EmergencyHeadcount:
        stats = await self.get_dashboard_stats(conn, hostel_id)
        
        hostel_filter = ""
        args = []
        if hostel_id:
            hostel_filter = "WHERE sp.hostel_id = $1 AND shs.current_status IN ('UNAUTHORIZED', 'LATE_RETURN', 'OUTSIDE')"
            args.append(hostel_id)
        else:
            hostel_filter = "WHERE shs.current_status IN ('UNAUTHORIZED', 'LATE_RETURN', 'OUTSIDE')"
            
        # Unaccounted means they are outside but without active leave, or late
        rows = await conn.fetch(f"""
            SELECT 
                u.id as student_id,
                COALESCE(shs.current_status, 'UNKNOWN') as current_status,
                shs.last_event_time,
                shs.active_permission_id,
                sp.full_name as student_name,
                sp.roll_number as student_roll,
                h.name as hostel_name,
                hm.event_type as last_movement_type,
                hg.name as last_gate_name,
                hp.permission_type as active_permission_type
            FROM users u
            JOIN student_profiles sp ON u.id = sp.user_id
            LEFT JOIN hostels h ON sp.hostel_id = h.id
            JOIN student_hostel_status shs ON u.id = shs.student_id
            LEFT JOIN hostel_movement hm ON shs.last_movement_id = hm.id
            LEFT JOIN hostel_gates hg ON hm.gate_id = hg.id
            LEFT JOIN hostel_permissions hp ON shs.active_permission_id = hp.id
            {hostel_filter}
            ORDER BY shs.last_event_time DESC NULLS LAST
        """, *args)
        
        unaccounted_students = [StudentHostelStatus(**dict(r)) for r in rows]
        
        return EmergencyHeadcount(
            total_students=stats.total_students,
            inside=stats.inside,
            outside=stats.outside,
            on_leave=stats.on_leave,
            unaccounted=len(unaccounted_students),
            unaccounted_students=unaccounted_students
        )

hostel_service = HostelService()
