from __future__ import annotations
import glob
import logging
import os
import re
from typing import AsyncGenerator, Optional
import asyncpg
from app.config import settings

logger = logging.getLogger(__name__)

pool: Optional[asyncpg.Pool] = None

# These migrations introduce a group of related tables.  A previous version of
# the runner trusted only `schema_migrations`; consequently a restored or
# partially-created database could say migration 011 was complete even though
# its tables were absent.  Later migrations then failed with "relation does not
# exist" and left the API running with a broken schema.
_ACCESS_SCHEMA_TABLES = {
    "locations",
    "access_rules",
    "temporary_access_grants",
    "access_events",
    "user_last_locations",
}


def normalize_dsn(dsn: str) -> str:
    """Normalize postgres DSN for asyncpg compatibility."""
    if not dsn:
        return dsn
    # asyncpg doesn't support sslmode=disable in DSN query params directly in older forms
    # clean out sslmode query param if present
    return re.sub(r"[?&]sslmode=[^&]+", "", dsn)


async def init_db() -> asyncpg.Pool:
    global pool
    dsn = normalize_dsn(settings.DATABASE_URL)
    ssl_param = None
    if "sslmode=disable" in settings.DATABASE_URL.lower():
        ssl_param = False

    logger.info("Connecting to PostgreSQL...")
    pool = await asyncpg.create_pool(
        dsn=dsn,
        min_size=settings.DATABASE_MAX_IDLE_CONNS,
        max_size=settings.DATABASE_MAX_OPEN_CONNS,
        max_inactive_connection_lifetime=float(settings.DATABASE_CONN_MAX_LIFETIME_SECONDS),
        ssl=ssl_param,
    )
    logger.info("PostgreSQL connection pool initialized")
    return pool


async def close_db() -> None:
    global pool
    if pool is not None:
        await pool.close()
        logger.info("PostgreSQL connection pool closed")


async def get_db() -> AsyncGenerator[asyncpg.Connection, None]:
    """FastAPI dependency to get a database connection from the pool."""
    global pool
    if pool is None:
        raise RuntimeError("Database pool not initialized")
    async with pool.acquire() as conn:
        yield conn


def get_db_pool() -> Optional[asyncpg.Pool]:
    """Return the global asyncpg connection pool."""
    global pool
    return pool


async def run_migrations(migrations_dir: str) -> None:
    """Apply numbered SQL migrations idempotently, matching Go backend migration runner."""
    global pool
    if pool is None:
        raise RuntimeError("Database pool not initialized")

    async with pool.acquire() as conn:
        # 1. Create schema_migrations table if not exists
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS schema_migrations (
                version TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
            )
        """)

        # 2. Discover migration files
        pattern = os.path.join(migrations_dir, "[0-9][0-9][0-9]_*.sql")
        paths = sorted(glob.glob(pattern))
        if not paths:
            logger.info("No migration files found in %s", migrations_dir)
            return

        # Repair the known migration-history drift safely.  Only migration
        # bookkeeping is removed; the SQL migrations themselves are
        # idempotent, so any surviving tables/data are retained.
        existing_access_tables = {
            row["tablename"]
            for row in await conn.fetch(
                "SELECT tablename FROM pg_tables "
                "WHERE schemaname = current_schema() AND tablename = ANY($1::text[])",
                list(_ACCESS_SCHEMA_TABLES),
            )
        }
        missing_tables = sorted(_ACCESS_SCHEMA_TABLES - existing_access_tables)
        if missing_tables:
            logger.warning(
                "Access schema tables are missing: %s. Reapplying migrations 011 and later.",
                ", ".join(missing_tables),
            )
            await conn.execute("DELETE FROM schema_migrations WHERE version >= '011'")

        for path in paths:
            filename = os.path.basename(path)
            version = filename.split("_", 1)[0]

            # Check if already applied
            applied = await conn.fetchval(
                "SELECT EXISTS(SELECT 1 FROM schema_migrations WHERE version=$1)",
                version,
            )
            if applied:
                continue

            logger.info("Applying migration %s...", filename)
            with open(path, "r", encoding="utf-8") as f:
                sql_content = f.read()

            async with conn.transaction():
                await conn.execute(sql_content)
                await conn.execute(
                    "INSERT INTO schema_migrations (version, name) VALUES ($1, $2)",
                    version,
                    filename,
                )
            logger.info("Migration %s applied successfully", filename)

    logger.info("Database schema is current")
