-- ============================================================
-- Migration 002: Ensure profile columns exist

-- user_profiles is a VIEW, not a physical table.
-- Therefore columns must exist on the underlying profile tables.
-- ============================================================
-- Student profile fields
DO $$
BEGIN
    -- On a fresh database role-specific profiles are created by migration 006.
    -- Keep this compatibility migration harmless for both old and fresh schemas.
    IF to_regclass('student_profiles') IS NOT NULL THEN
        ALTER TABLE student_profiles
            ADD COLUMN IF NOT EXISTS department TEXT,
            ADD COLUMN IF NOT EXISTS school TEXT,
            ADD COLUMN IF NOT EXISTS course TEXT,
            ADD COLUMN IF NOT EXISTS semester TEXT,
            ADD COLUMN IF NOT EXISTS hostel_flag BOOLEAN NOT NULL DEFAULT FALSE;
        CREATE INDEX IF NOT EXISTS idx_profiles_semester
            ON student_profiles (semester) WHERE semester IS NOT NULL;
    END IF;
END $$;

-- Faculty profile fields
DO $$ BEGIN
    IF to_regclass('faculty_profiles') IS NOT NULL THEN
        ALTER TABLE faculty_profiles ADD COLUMN IF NOT EXISTS designation TEXT;
    END IF;
END $$;

-- Worker profile fields
DO $$ BEGIN
    IF to_regclass('worker_profiles') IS NOT NULL THEN
        ALTER TABLE worker_profiles ADD COLUMN IF NOT EXISTS designation TEXT;
    END IF;
END $$;
