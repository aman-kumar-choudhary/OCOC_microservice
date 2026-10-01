from fastapi import APIRouter, Depends, Query, Response
import asyncpg
import csv
import io
from app.core.database import get_db
from app.core.security import Claims, require_role
router = APIRouter(prefix="/api/v1/reports", tags=["reports"])

@router.get("/export/csv")
async def export_events_csv(
    limit: int = Query(1000, description="Max rows"),
    only_denied: bool = False,
    conn: asyncpg.Connection = Depends(get_db),
    claims: Claims = Depends(require_role("SUPER_ADMIN", "ADMIN"))
):
    query = """
        SELECT e.event_time, e.action, e.status, e.reason, 
               l.name as location_name, 
               u.email as user_identifier,
               COALESCE(p_stu.full_name, p_fac.full_name, p_wor.full_name, p_vis.full_name, 'Unknown') as full_name
        FROM access_events e
        LEFT JOIN locations l ON e.location_id = l.id
        LEFT JOIN users u ON e.user_id = u.id
        LEFT JOIN student_profiles p_stu ON u.id = p_stu.user_id
        LEFT JOIN faculty_profiles p_fac ON u.id = p_fac.user_id
        LEFT JOIN worker_profiles p_wor ON u.id = p_wor.user_id
        LEFT JOIN visitor_profiles p_vis ON u.id = p_vis.user_id
    """
    if only_denied:
        query += " WHERE e.status = 'DENIED'"
        
    query += f" ORDER BY e.event_time DESC LIMIT {limit}"
    
    rows = await conn.fetch(query)
    
    # Generate CSV in memory
    output = io.StringIO()
    writer = csv.writer(output)
    
    # Write Headers
    writer.writerow(["Timestamp", "User", "Email", "Location", "Action", "Status", "Reason"])
    
    # Write Data
    for row in rows:
        writer.writerow([
            row["event_time"].isoformat() if row["event_time"] else "",
            row["full_name"],
            row["user_identifier"],
            row["location_name"],
            row["action"],
            row["status"],
            row["reason"]
        ])
        
    response = Response(content=output.getvalue(), media_type="text/csv")
    response.headers["Content-Disposition"] = "attachment; filename=access_events_export.csv"
    return response
