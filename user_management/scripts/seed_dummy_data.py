#!/usr/bin/env python3
"""
Seed script for OCOC User Management and FRECO Face Recognition.
Populates 244 dummy users across all roles with complete schemas, relationships,
active RFID cards, and 512-dimensional L2-normalized face embeddings.

Categories:
  - 100 Students
  - 20 Staff/Faculty (16 Faculty, 4 Faculty-Wardens)
  - 68 Visitors
  - 56 Workers (20 Guards, 15 Maintenance, 12 Housekeeping, 9 Support)
Total: 244 users, 244 RFID cards, 244 FRECO face embeddings.

Usage:
  python3 seed_dummy_data.py [--dry-run] [--db-url postgres://user:pass@host:port/dbname]
"""

import argparse
import os
import subprocess
import sys
from pathlib import Path
from urllib.parse import urlparse

# Resolve paths
SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parent
ENV_FILE = PROJECT_ROOT / "backend" / ".env"
SQL_FILE = SCRIPT_DIR / "seed_dummy_data.sql"

def get_database_url() -> str:
    # 1. Environment variable
    db_url = os.environ.get("DATABASE_URL")
    if db_url:
        return db_url
    
    # 2. backend/.env file
    if ENV_FILE.exists():
        with open(ENV_FILE, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line.startswith("DATABASE_URL="):
                    return line.split("=", 1)[1].strip().strip("\"'")
                    
    # 3. Default dev URL
    return "postgres://ococ:root@localhost:5432/ococ_users?sslmode=disable"

def run_psql(db_url: str, sql_file: Path):
    clean_url = db_url.split("?")[0]
    parsed = urlparse(clean_url)
    
    env = os.environ.copy()
    if parsed.password:
        env["PGPASSWORD"] = parsed.password
        
    cmd = [
        "psql",
        "-h", parsed.hostname or "localhost",
        "-p", str(parsed.port or 5432),
        "-U", parsed.username or "ococ",
        "-d", parsed.path.lstrip("/") or "ococ_users",
        "-f", str(sql_file)
    ]
    
    print(f"Executing SQL via psql ({parsed.username}@{parsed.hostname}:{parsed.port}/{parsed.path.lstrip('/')})...")
    result = subprocess.run(cmd, env=env, capture_output=True, text=True)
    if result.returncode != 0:
        print("psql execution error:")
        print(result.stderr)
        return False
    print("psql output:")
    print(result.stdout)
    return True

async def run_asyncpg(db_url: str, sql_file: Path):
    import asyncpg
    clean_url = db_url.split("?")[0]
    print(f"Connecting to database via asyncpg: {clean_url}...")
    conn = await asyncpg.connect(clean_url)
    try:
        with open(sql_file, "r", encoding="utf-8") as f:
            sql = f.read()
        print(f"Executing SQL transaction ({len(sql.splitlines())} lines)...")
        await conn.execute(sql)
        print("SQL executed successfully!")
        
        # Verify
        rows = await conn.fetch("""
            SELECT
              user_type,
              COUNT(*) AS user_count,
              COUNT(DISTINCT urc.rfid_card_id) AS rfid_assigned,
              COUNT(DISTINCT fp_reco.id) AS freco_registered,
              COUNT(DISTINCT fe.id) AS embeddings_created
            FROM users u
            LEFT JOIN user_rfid_cards urc ON urc.user_id = u.id
            LEFT JOIN freco_people fp_reco ON fp_reco.external_id = u.id
            LEFT JOIN freco_face_embeddings fe ON fe.person_id = fp_reco.id
            WHERE u.email LIKE '%@dsvv.ac.in' OR u.email LIKE '%@guest.ococ.org' OR u.email LIKE '%@staff.dsvv.ac.in'
            GROUP BY user_type
            ORDER BY user_type;
        """)
        print("\n--- Seed Verification Summary ---")
        print(f"{'User Type':<12} | {'Users':<8} | {'RFID Cards':<12} | {'FRECO People':<14} | {'Embeddings':<12}")
        print("-" * 68)
        for r in rows:
            print(f"{r['user_type']:<12} | {r['user_count']:<8} | {r['rfid_assigned']:<12} | {r['freco_registered']:<14} | {r['embeddings_created']:<12}")
    finally:
        await conn.close()

def main():
    parser = argparse.ArgumentParser(description="Seed dummy users into OCOC database")
    parser.add_argument("--db-url", type=str, default=None, help="PostgreSQL connection URL")
    parser.add_argument("--dry-run", action="store_true", help="Print summary without modifying DB")
    parser.add_argument("--use-psql", action="store_true", help="Force using psql command-line client")
    args = parser.parse_args()

    db_url = args.db_url or get_database_url()

    print("=" * 65)
    print("OCOC Database Seeder")
    print("=" * 65)
    print(f"Target Database URL: {db_url}")
    print(f"SQL Seed File:       {SQL_FILE} ({SQL_FILE.stat().st_size:,} bytes)")
    print("\nPlanned dummy records:")
    print("  • 100 Students (Academic Block/Lab access, 70 hostellers, 400 leave balances)")
    print("  • 20 Staff/Faculty (16 Academic faculty, 4 Wardens assigned to hostels)")
    print("  • 68 Visitors (Main Gate pass, Aadhaar/Passport proof, 1-5 days duration)")
    print("  • 56 Workers (20 Guards, 15 Maintenance, 12 Housekeeping, 9 Lab/Admin support)")
    print("  • 244 Active RFID cards (uid: STU00001..100, FAC00001..020, VIS00001..068, WRK00001..056)")
    print("  • 244 FRECO identities linked via users.id")
    print("  • 244 512-D L2-normalized face embeddings (antelopev2 ArcFace format)")
    print("=" * 65)

    if args.dry_run:
        print("\n[DRY RUN] No changes were made to the database.")
        sys.exit(0)

    # Check if asyncpg is available
    has_asyncpg = False
    try:
        import asyncpg
        import asyncio
        has_asyncpg = True
    except ImportError:
        pass

    if has_asyncpg and not args.use_psql:
        try:
            import asyncio
            asyncio.run(run_asyncpg(db_url, SQL_FILE))
            print("\nDatabase seeded successfully via asyncpg!")
            return
        except Exception as e:
            print(f"asyncpg connection attempt failed: {e}")
            print("Falling back to psql...")

    # Fallback to psql
    success = run_psql(db_url, SQL_FILE)
    if success:
        print("\nDatabase seeded successfully via psql!")
    else:
        print("\nCould not execute seed script automatically. Please run manually:")
        print(f"  psql \"{db_url}\" -f \"{SQL_FILE}\"")
        sys.exit(1)

if __name__ == "__main__":
    main()
