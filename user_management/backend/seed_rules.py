import asyncio
import asyncpg

async def main():
    conn = await asyncpg.connect("postgresql://ococ_user:ococ_password@localhost/ococ_db")
    
    # Check for Main Gate
    main_gate = await conn.fetchrow("SELECT id FROM locations WHERE name ILIKE '%main gate%' OR name ILIKE '%out of campus%' LIMIT 1")
    main_gate_id = main_gate['id'] if main_gate else None
    
    # 1. Insert Hostel Rule
    await conn.execute("""
        INSERT INTO access_rules (name, description, subject_type, subject_id, effect, priority, is_active)
        VALUES ('System: Own Hostel Access', 'Automatically grants students access to their assigned hostel. Do not delete.', 'student_own_hostel', 'student', 'ALLOW', 100, true)
    """)
    
    # 2. Insert Campus Exit Rule if we have a main gate
    if main_gate_id:
        await conn.execute("""
            INSERT INTO access_rules (name, description, subject_type, subject_id, location_id, effect, priority, is_active)
            VALUES ('System: Campus Exit Restriction', 'Denies students exit through the main gate unless they have a Temporary Grant.', 'role', 'student', $1, 'DENY', 99, true)
        """, main_gate_id)
        print("Inserted Campus Exit Rule")
    else:
        print("No Main Gate found, skipping Campus Exit Rule")

    print("Seeded database successfully")
    await conn.close()

asyncio.run(main())
