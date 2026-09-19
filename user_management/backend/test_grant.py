import asyncio
import asyncpg
from app.schemas.hostel import CreatePermissionRequest
from app.services.hostel_service import hostel_service
from app.core.database import get_db

async def run():
    # Setup DB connection
    conn = await asyncpg.connect("postgresql://postgres:postgres@localhost/ococ_users")
    
    # Get a random user
    user_id = await conn.fetchval("SELECT id FROM users LIMIT 1")
    
    req = CreatePermissionRequest(
        student_id=user_id,
        permission_type="HOSTEL_EXIT",
        start_time="2026-09-19T10:00:00Z",
        end_time="2026-09-19T12:00:00Z",
        reason="Test"
    )
    
    try:
        res = await hostel_service.grant_permission(conn, user_id, req)
        print("Success:", res)
    except Exception as e:
        import traceback
        traceback.print_exc()
        print("Error:", e)
        
    await conn.close()

asyncio.run(run())
