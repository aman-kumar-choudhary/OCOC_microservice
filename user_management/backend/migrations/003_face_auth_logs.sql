-- ============================================================
-- Migration 003: face_auth_logs table
--
-- This table is written by user_management's faceauth package
-- (internal/faceauth/faceauth.go) every time a face authentication
-- event is logged by the frontend after a FRECO match.
-- It is NOT the embedding store — it is an event/audit log.
-- ============================================================

CREATE TABLE IF NOT EXISTS face_auth_logs (
    id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    -- Soft reference to users.id (stored as text to remain decoupled from
    -- user lifecycle; a deleted user's log entries are preserved for audit).
    person_external_id TEXT,
    person_name        TEXT,
    result             TEXT        NOT NULL
                         CHECK (result IN ('success','failed','liveness_failed','unknown')),
    similarity_score   DOUBLE PRECISION,
    liveness_score     DOUBLE PRECISION,
    reason             TEXT,
    -- 'single' = one-to-one match, 'mass' = group photo recognition
    auth_type          TEXT        NOT NULL DEFAULT 'single'
                         CHECK (auth_type IN ('single','mass')),
    ip_address         TEXT,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index to support lookups by person and time range (used in List query).
CREATE INDEX IF NOT EXISTS idx_face_auth_person
    ON face_auth_logs (person_external_id);

CREATE INDEX IF NOT EXISTS idx_face_auth_result
    ON face_auth_logs (result);

CREATE INDEX IF NOT EXISTS idx_face_auth_created_at
    ON face_auth_logs (created_at DESC);
