-- Migration: 003_freco_tables.sql
-- Description: Creates the tables required for the Freco face recognition service

BEGIN;

CREATE EXTENSION IF NOT EXISTS vector;

-- ─────────────────────────────────────────────
-- FRECO PEOPLE (Shadow of users table)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS freco_people (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    external_id   UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    name          TEXT NOT NULL,
    person_type   TEXT NOT NULL,
    email         TEXT,
    rfid_uid      TEXT UNIQUE,
    metadata_json TEXT,
    active        BOOLEAN NOT NULL DEFAULT true,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────
-- FRECO FACE EMBEDDINGS
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS freco_face_embeddings (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    person_id   UUID NOT NULL REFERENCES freco_people(id) ON DELETE CASCADE,
    variant     TEXT NOT NULL,
    pose        TEXT NOT NULL,
    model_name  TEXT NOT NULL,
    embedding   vector(512) NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_freco_embeddings_person_id ON freco_face_embeddings(person_id);
CREATE INDEX IF NOT EXISTS idx_freco_embeddings_variant ON freco_face_embeddings(variant);

-- ─────────────────────────────────────────────
-- FRECO ATTENDANCE SESSIONS
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS freco_attendance_sessions (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT NOT NULL,
    session_type TEXT NOT NULL,
    device_id   TEXT,
    starts_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    ends_at     TIMESTAMPTZ,
    active      BOOLEAN NOT NULL DEFAULT true
);

-- ─────────────────────────────────────────────
-- FRECO ATTENDANCE RECORDS
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS freco_attendance_records (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id       UUID NOT NULL REFERENCES freco_attendance_sessions(id) ON DELETE CASCADE,
    person_id        UUID NOT NULL REFERENCES freco_people(id) ON DELETE CASCADE,
    timestamp        TIMESTAMPTZ NOT NULL DEFAULT now(),
    source           TEXT NOT NULL,
    similarity_score FLOAT NOT NULL,
    UNIQUE(session_id, person_id)
);

COMMIT;
