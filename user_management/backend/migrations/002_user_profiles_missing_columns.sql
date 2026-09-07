-- ============================================================
-- Migration 002: Add missing columns to user_profiles
--
-- The live user_profiles table was created without these 6 columns
-- that the Go repository reads and writes. This migration adds them
-- safely using IF NOT EXISTS, preserving all existing rows.
-- ============================================================

ALTER TABLE user_profiles
    ADD COLUMN IF NOT EXISTS department  TEXT,
    ADD COLUMN IF NOT EXISTS school      TEXT,
    ADD COLUMN IF NOT EXISTS course      TEXT,
    ADD COLUMN IF NOT EXISTS semester    TEXT,
    ADD COLUMN IF NOT EXISTS designation TEXT,
    ADD COLUMN IF NOT EXISTS hostel_flag BOOLEAN NOT NULL DEFAULT FALSE;

-- Add an index on semester for the AdvanceSemesters admin operation
-- which filters on user_type='student' and needs to iterate.
CREATE INDEX IF NOT EXISTS idx_profiles_semester ON user_profiles (semester)
    WHERE semester IS NOT NULL;
