#!/usr/bin/env python3
"""
Seed administrator accounts for OCOC User Management:
1. Super Admin: superadmin@dsvv.ac.in (Role: SUPER_ADMIN) - Handles ALL modules
2. Admin: admin@dsvv.ac.in (Role: ADMIN) - Handles Access Management
3. Security Admin: securityadmin@dsvv.ac.in (Role: SECURITY_ADMIN) - Handles Security Command
"""

import asyncio
import os
import sys
import uuid
from pathlib import Path

# Setup paths
script_dir = Path(__file__).resolve().parent
project_root = script_dir.parent
sys.path.insert(0, str(project_root / "backend"))

import asyncpg
from app.config import settings
from app.core.keycloak_client import keycloak_client, KeycloakError

ADMIN_USERS = [
    {
        "username": "superadmin@dsvv.ac.in",
        "email": "superadmin@dsvv.ac.in",
        "first_name": "Chief",
        "last_name": "Super Admin",
        "password": "Admin12345!",
        "role": "SUPER_ADMIN",
        "user_type": "faculty",
        "designation": "Chief University Administrator",
        "employee_id": "EMP-ADMIN-001",
    },
    {
        "username": "admin@dsvv.ac.in",
        "email": "admin@dsvv.ac.in",
        "first_name": "Access",
        "last_name": "Administrator",
        "password": "Admin12345!",
        "role": "ADMIN",
        "user_type": "faculty",
        "designation": "Access & Identity Controller",
        "employee_id": "EMP-ADMIN-002",
    },
    {
        "username": "securityadmin@dsvv.ac.in",
        "email": "securityadmin@dsvv.ac.in",
        "first_name": "Rajesh",
        "last_name": "Varma",
        "password": "Admin12345!",
        "role": "SECURITY_ADMIN",
        "user_type": "worker",
        "designation": "Chief Campus Security Officer",
        "employee_id": "EMP-SEC-ADMIN-01",
    },
]


async def seed_users():
    print("=" * 60)
    print("OCOC Administrator Accounts Seeder")
    print("=" * 60)

    # 1. Connect to PostgreSQL
    clean_dsn = settings.DATABASE_URL.split("?")[0]
    print(f"Connecting to database: {clean_dsn}...")
    conn = await asyncpg.connect(clean_dsn)

    try:
        # Get Keycloak admin token to verify connection
        print("Authenticating with Keycloak admin...")
        admin_token = await keycloak_client.get_admin_token()
        print("Keycloak admin authentication successful.")

        for user_info in ADMIN_USERS:
            email = user_info["email"]
            role_name = user_info["role"]
            password = user_info["password"]
            first_name = user_info["first_name"]
            last_name = user_info["last_name"]
            user_type = user_info["user_type"]
            username = user_info["username"]

            print(f"\nProcessing {role_name}: {email}...")

            # 2. Keycloak: Find or create user
            kc_user = await keycloak_client.get_user_by_email(email)
            kc_id = None
            if kc_user:
                kc_id = kc_user["id"]
                print(f"  Keycloak user exists (ID: {kc_id}). Updating password & settings...")
                await keycloak_client.reset_password(kc_id, password, temporary=False)
                await keycloak_client.clear_required_actions(kc_id)
            else:
                print(f"  Creating Keycloak user...")
                kc_id = await keycloak_client.create_user(
                    username=username,
                    email=email,
                    first_name=first_name,
                    last_name=last_name,
                    password=password,
                    enabled=True,
                    temporary_password=False,
                )
                print(f"  Created Keycloak user (ID: {kc_id})")

            # 3. Assign Keycloak Realm Role
            try:
                await keycloak_client.assign_role(kc_id, role_name)
                print(f"  Assigned Keycloak realm role: {role_name}")
            except KeycloakError as e:
                print(f"  Warning assigning role in Keycloak: {e}")

            # 4. PostgreSQL: Find or create user
            db_role_id = await conn.fetchval("SELECT id FROM roles WHERE name = $1", role_name)
            if not db_role_id:
                db_role_id = uuid.uuid4()
                await conn.execute(
                    "INSERT INTO roles (id, name, description, user_type) VALUES ($1, $2, $3, $4)",
                    db_role_id, role_name, f"System {role_name} Role", user_type
                )
                print(f"  Inserted role {role_name} in database.")

            db_user = await conn.fetchrow("SELECT id FROM users WHERE LOWER(email) = LOWER($1)", email)
            if db_user:
                user_id = db_user["id"]
                await conn.execute(
                    "UPDATE users SET keycloak_user_id = $1, status = 'active', user_type = $2, updated_at = now() WHERE id = $3",
                    kc_id, user_type, user_id
                )
                print(f"  Updated database user (ID: {user_id})")
            else:
                user_id = uuid.uuid4()
                await conn.execute(
                    "INSERT INTO users (id, email, user_type, status, keycloak_user_id, created_at, updated_at) "
                    "VALUES ($1, $2, $3, 'active', $4, now(), now())",
                    user_id, email, user_type, kc_id
                )
                print(f"  Created database user (ID: {user_id})")

            # 5. Link user_roles in database
            await conn.execute(
                "INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
                user_id, db_role_id
            )
            print(f"  Linked role {role_name} in user_roles table.")

            # 6. Insert profile
            full_name = f"{first_name} {last_name}".strip()
            if user_type == "faculty":
                await conn.execute("""
                    INSERT INTO faculty_profiles (user_id, full_name, employee_id, designation)
                    VALUES ($1, $2, $3, $4)
                    ON CONFLICT (user_id) DO UPDATE SET full_name = EXCLUDED.full_name, designation = EXCLUDED.designation
                """, user_id, full_name, user_info["employee_id"], user_info["designation"])
            else:
                await conn.execute("""
                    INSERT INTO worker_profiles (user_id, full_name, employee_id, designation)
                    VALUES ($1, $2, $3, $4)
                    ON CONFLICT (user_id) DO UPDATE SET full_name = EXCLUDED.full_name, designation = EXCLUDED.designation
                """, user_id, full_name, user_info["employee_id"], user_info["designation"])
            print(f"  Saved profile for {full_name}.")

        print("\n" + "=" * 60)
        print("Summary of Administrator Accounts:")
        print("=" * 60)
        for user_info in ADMIN_USERS:
            print(f"Role: {user_info['role']}")
            print(f"  Email/Username: {user_info['email']}")
            print(f"  Password:       {user_info['password']}")
            print(f"  Responsibilities: {'All Modules' if user_info['role'] == 'SUPER_ADMIN' else 'Access Management' if user_info['role'] == 'ADMIN' else 'Security Command Center'}")
            print("-" * 60)

    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(seed_users())
