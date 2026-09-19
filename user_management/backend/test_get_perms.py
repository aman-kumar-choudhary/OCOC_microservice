import asyncio
import asyncpg
from app.schemas.hostel import HostelPermission
from app.services.hostel_service import hostel_service

async def run():
    conn = await asyncpg.connect("postgresql://postgres:postgres@localhost/ococ_users")
    try:
        perms = await hostel_service.get_permissions(conn)
        print("Success:", len(perms))
        for p in perms:
            print(p)
    except Exception as e:
        import traceback
        traceback.print_exc()
        print("Error:", e)
    await conn.close()

asyncio.run(run())
