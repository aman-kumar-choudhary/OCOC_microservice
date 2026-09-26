#!/usr/bin/env python3
"""
Seed sample users for OCOC User Management.
Creates realistic sample students, faculty, guards, and wardens for testing access control.
"""

import asyncio
import os
import sys
from pathlib import Path
import asyncpg

# Load environment
script_dir = Path(__file__).resolve().parent
project_root = script_dir.parent
env_file = project_root / "backend" / ".env"

db_url = "postgres://ococ:root@localhost:5435/ococ_users?sslmode=disable"
if env_file.exists():
    with open(env_file, "r", encoding="utf-8") as f:
        for line in f:
            if line.startswith("DATABASE_URL="):
                db_url = line.split("=", 1)[1].strip().strip("\"'")

async def seed():
    print(f"Connecting to database: {db_url}...")
    # Normalize DSN for asyncpg
    clean_dsn = db_url.split("?")[0]
    conn = await asyncpg.connect(clean_dsn)

    try:
        # Check departments
        dept_cs = await conn.fetchval("SELECT id FROM departments WHERE name ILIKE '%computer%' LIMIT 1")
        if not dept_cs:
            dept_cs = await conn.fetchval(
                "INSERT INTO departments (name, code) VALUES ('Computer Science', 'CS') RETURNING id"
            )

        dept_mgmt = await conn.fetchval("SELECT id FROM departments WHERE name ILIKE '%management%' LIMIT 1")
        if not dept_mgmt:
            dept_mgmt = await conn.fetchval(
                "INSERT INTO departments (name, code) VALUES ('Management Studies', 'MGMT') RETURNING id"
            )

        # Check hostels
        hostel_shivalik = await conn.fetchval("SELECT id FROM hostels WHERE name ILIKE '%shivalik%' LIMIT 1")
        if not hostel_shivalik:
            hostel_shivalik = await conn.fetchval(
                "INSERT INTO hostels (name, code, capacity) VALUES ('Shivalik Hostel', 'SHIV', 200) RETURNING id"
            )

        # 1. Sample Student
        s_user = await conn.fetchrow("""
            INSERT INTO users (email, phone, user_type, status)
            VALUES ('arjun.sharma@dsvv.ac.in', '+919876543210', 'student', 'active')
            ON CONFLICT (email) DO UPDATE SET status = 'active'
            RETURNING id
        """)
        await conn.execute("""
            INSERT INTO student_profiles (user_id, full_name, roll_number, department_id, course, semester, hostel_id)
            VALUES ($1, 'Arjun Sharma', 'DSVV2026-CS-042', $2, 'B.Tech Computer Science', 'Semester 4', $3)
            ON CONFLICT (user_id) DO UPDATE SET full_name = EXCLUDED.full_name
        """, s_user["id"], dept_cs, hostel_shivalik)

        role_student = await conn.fetchval("SELECT id FROM roles WHERE name = 'STUDENT'")
        if role_student:
            await conn.execute("""
                INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING
            """, s_user["id"], role_student)

        # 2. Sample Faculty
        f_user = await conn.fetchrow("""
            INSERT INTO users (email, phone, user_type, status)
            VALUES ('dr.priya.patel@dsvv.ac.in', '+919876543211', 'faculty', 'active')
            ON CONFLICT (email) DO UPDATE SET status = 'active'
            RETURNING id
        """)
        await conn.execute("""
            INSERT INTO faculty_profiles (user_id, full_name, employee_id, department_id, designation)
            VALUES ($1, 'Dr. Priya Patel', 'EMP-FAC-108', $2, 'Associate Professor')
            ON CONFLICT (user_id) DO UPDATE SET full_name = EXCLUDED.full_name
        """, f_user["id"], dept_cs)

        role_faculty = await conn.fetchval("SELECT id FROM roles WHERE name = 'FACULTY'")
        if role_faculty:
            await conn.execute("""
                INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING
            """, f_user["id"], role_faculty)

        # 3. Sample Security Guard
        g_user = await conn.fetchrow("""
            INSERT INTO users (email, phone, user_type, status)
            VALUES ('ramesh.guard@dsvv.ac.in', '+919876543212', 'worker', 'active')
            ON CONFLICT (email) DO UPDATE SET status = 'active'
            RETURNING id
        """)
        await conn.execute("""
            INSERT INTO worker_profiles (user_id, full_name, employee_id, designation)
            VALUES ($1, 'Ramesh Singh', 'EMP-SEC-015', 'Main Gate Security Officer')
            ON CONFLICT (user_id) DO UPDATE SET full_name = EXCLUDED.full_name
        """, g_user["id"])

        role_guard = await conn.fetchval("SELECT id FROM roles WHERE name = 'SECURITY_GUARD'") or \
                     await conn.fetchval("SELECT id FROM roles WHERE name = 'GUARD'")
        if role_guard:
            await conn.execute("""
                INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING
            """, g_user["id"], role_guard)

        # 4. Sample Hostel Warden
        w_user = await conn.fetchrow("""
            INSERT INTO users (email, phone, user_type, status)
            VALUES ('vikram.warden@dsvv.ac.in', '+919876543213', 'faculty', 'active')
            ON CONFLICT (email) DO UPDATE SET status = 'active'
            RETURNING id
        """)
        await conn.execute("""
            INSERT INTO faculty_profiles (user_id, full_name, employee_id, department_id, designation)
            VALUES ($1, 'Dr. Vikram Verma', 'EMP-WAR-003', $2, 'Chief Warden & Assistant Professor')
            ON CONFLICT (user_id) DO UPDATE SET full_name = EXCLUDED.full_name
        """, w_user["id"], dept_mgmt)

        role_warden = await conn.fetchval("SELECT id FROM roles WHERE name = 'WARDEN'")
        if role_warden:
            await conn.execute("""
                INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING
            """, w_user["id"], role_warden)

        # Assign warden to hostel
        if hostel_shivalik:
            await conn.execute("""
                INSERT INTO warden_hostels (user_id, hostel_id) VALUES ($1, $2) ON CONFLICT DO NOTHING
            """, w_user["id"], hostel_shivalik)

        print("Successfully seeded 4 demo users:")
        print("  1. Arjun Sharma (Student) - arjun.sharma@dsvv.ac.in")
        print("  2. Dr. Priya Patel (Faculty) - dr.priya.patel@dsvv.ac.in")
        print("  3. Ramesh Singh (Security Guard) - ramesh.guard@dsvv.ac.in")
        print("  4. Dr. Vikram Verma (Hostel Warden) - vikram.warden@dsvv.ac.in")

    finally:
        await conn.close()

if __name__ == "__main__":
    asyncio.run(seed())
