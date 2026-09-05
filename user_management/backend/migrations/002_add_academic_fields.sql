-- OCOC User Management — Migration 002
-- Adds academic/professional fields to user_profiles
-- Run: psql $DATABASE_URL -f migrations/002_add_academic_fields.sql

BEGIN;

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS school       TEXT,
  ADD COLUMN IF NOT EXISTS course       TEXT,
  ADD COLUMN IF NOT EXISTS semester     TEXT,
  ADD COLUMN IF NOT EXISTS designation  TEXT,
  ADD COLUMN IF NOT EXISTS department   TEXT,
  ADD COLUMN IF NOT EXISTS hostel_flag  BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_profiles_school  ON user_profiles(school);
CREATE INDEX IF NOT EXISTS idx_profiles_course  ON user_profiles(course);

-- Face auth logs table (append-only, like audit_logs)
CREATE TABLE IF NOT EXISTS face_auth_logs (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    person_external_id  TEXT NOT NULL,          -- links to user.id in ococ_users
    person_name         TEXT,
    result              TEXT NOT NULL CHECK (result IN ('success','failed','liveness_failed','unknown')),
    similarity_score    FLOAT,
    liveness_score      FLOAT,
    reason              TEXT,
    auth_type           TEXT NOT NULL DEFAULT 'single' CHECK (auth_type IN ('single','mass')),
    ip_address          TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_face_auth_logs_person    ON face_auth_logs(person_external_id);
CREATE INDEX IF NOT EXISTS idx_face_auth_logs_result    ON face_auth_logs(result);
CREATE INDEX IF NOT EXISTS idx_face_auth_logs_created   ON face_auth_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_face_auth_logs_type      ON face_auth_logs(auth_type);

COMMIT;
