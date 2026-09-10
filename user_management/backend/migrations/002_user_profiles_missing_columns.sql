-- ============================================================
-- Migration 002: Ensure profile columns exist
--
-- user_profiles is a VIEW, not a physical table.
-- Therefore columns must exist on the underlying profile tables.
-- ============================================================

-- Student profile fields
ALTER TABLE student_profiles
    ADD COLUMN IF NOT EXISTS department TEXT,
    ADD COLUMN IF NOT EXISTS school TEXT,
    ADD COLUMN IF NOT EXISTS course TEXT,
    ADD COLUMN IF NOT EXISTS semester TEXT,
    ADD COLUMN IF NOT EXISTS hostel_flag BOOLEAN NOT NULL DEFAULT FALSE;

-- Faculty profile fields
ALTER TABLE faculty_profiles
    ADD COLUMN IF NOT EXISTS designation TEXT;

-- Worker profile fields
ALTER TABLE worker_profiles
    ADD COLUMN IF NOT EXISTS designation TEXT;

-- Semester queries should use the physical student_profiles table,
-- not the user_profiles view.
CREATE INDEX IF NOT EXISTS idx_profiles_semester
    ON student_profiles (semester)
    WHERE semester IS NOT NULL;
