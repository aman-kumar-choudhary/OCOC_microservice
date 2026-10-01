-- ============================================================
-- Migration 004: pgvector extension + FRECO tables
--
-- Enables the pgvector extension (installed as postgresql-18-pgvector
-- v0.8.6) and creates all FRECO SQLAlchemy-managed tables.
-- Design notes:
--   • freco_people.external_id = users.id (logical link, no FK, to
--     keep FRECO decoupled from user_management lifecycle).
--   • Embedding dimension: 512 (ArcFace antelopev2 confirmed).
--   • Index: HNSW with cosine distance (vector_cosine_ops) because
--     all matching uses cosine similarity on L2-normalised vectors.
--     With pgvector 0.8.0+ HNSW is preferred over IVFFlat for
--     online inserts and doesn't require a training phase.
-- ============================================================

-- ── pgvector extension ───────────────────────────────────────
-- IMPORTANT: CREATE EXTENSION requires a superuser.
-- The ococ application user cannot run this — it must be run once by the
-- postgres superuser before starting any microservice.
--
-- On the local dev server (PostgreSQL 18):
--   psql "postgres://postgres:postgres@localhost:5432/ococ_users" \
--        -c "CREATE EXTENSION IF NOT EXISTS vector;"
--
-- In Docker (user_management docker-compose.yml):
--   The healthcheck runs as the postgres superuser — add an init-script
--   to the postgres container, or run this manually after first launch.
--
-- The extension is already enabled on the live dev database.
CREATE EXTENSION IF NOT EXISTS vector;

-- ── freco_people ─────────────────────────────────────────────
-- Mirrors freco/backend/app/models.py :: Person
-- external_id is the users.id UUID from user_management (logical ref only).

CREATE TABLE IF NOT EXISTS freco_people (
    id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    external_id    UUID        NOT NULL UNIQUE,   -- = users.id in user_management
    name           TEXT        NOT NULL,
    person_type    TEXT        NOT NULL,           -- 'student' | 'visitor' | ...
    email          TEXT,
    rfid_uid       TEXT        UNIQUE,             -- matches rfid_cards.uid
    metadata_json  TEXT,                           -- arbitrary JSON blob
    active         BOOLEAN     NOT NULL DEFAULT TRUE,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_freco_people_external_id ON freco_people (external_id);
CREATE INDEX IF NOT EXISTS idx_freco_people_rfid_uid    ON freco_people (rfid_uid);
CREATE INDEX IF NOT EXISTS idx_freco_people_person_type ON freco_people (person_type);
CREATE INDEX IF NOT EXISTS idx_freco_people_active      ON freco_people (active);

-- ── freco_face_embeddings ────────────────────────────────────
-- Mirrors freco/backend/app/models.py :: FaceEmbedding
-- Stores 512-dimensional L2-normalised ArcFace vectors.

CREATE TABLE IF NOT EXISTS freco_face_embeddings (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    person_id   UUID        NOT NULL
                    REFERENCES freco_people(id) ON DELETE CASCADE,
    variant     TEXT        NOT NULL,   -- 'color' | 'grayscale'
    pose        TEXT        NOT NULL,   -- 'center' | 'left' | 'right' | ...
    model_name  TEXT        NOT NULL,   -- e.g. 'antelopev2'
    embedding   VECTOR(512) NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_freco_embeddings_person
    ON freco_face_embeddings (person_id);

CREATE INDEX IF NOT EXISTS idx_freco_embeddings_variant
    ON freco_face_embeddings (person_id, variant);

-- HNSW index for approximate nearest-neighbour cosine search.
-- m=16, ef_construction=64 are safe defaults for <100k rows;
-- tune upward (m=32, ef_construction=128) for >1M embeddings.
CREATE INDEX IF NOT EXISTS idx_freco_embeddings_hnsw_cosine
    ON freco_face_embeddings
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);

-- ── freco_attendance_sessions ────────────────────────────────
-- Mirrors freco/backend/app/models.py :: AttendanceSession
-- Field is 'mode' (not session_type — see migration note and model fix).

CREATE TABLE IF NOT EXISTS freco_attendance_sessions (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT        NOT NULL,
    mode        TEXT        NOT NULL,   -- 'face' | 'rfid' | 'mass'
    device_id   TEXT,
    starts_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    ends_at     TIMESTAMPTZ,
    active      BOOLEAN     NOT NULL DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS idx_freco_sessions_active
    ON freco_attendance_sessions (active, starts_at DESC);

-- ── freco_attendance_records ─────────────────────────────────
-- Mirrors freco/backend/app/models.py :: AttendanceRecord

CREATE TABLE IF NOT EXISTS freco_attendance_records (
    id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id        UUID        NOT NULL
                          REFERENCES freco_attendance_sessions(id) ON DELETE CASCADE,
    person_id         UUID        NOT NULL
                          REFERENCES freco_people(id)              ON DELETE CASCADE,
    timestamp         TIMESTAMPTZ NOT NULL DEFAULT now(),
    source            TEXT        NOT NULL,  -- 'rfid' | 'face' | 'mass'
    similarity_score  DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    UNIQUE (session_id, person_id)           -- one record per person per session
);

CREATE INDEX IF NOT EXISTS idx_freco_attendance_session
    ON freco_attendance_records (session_id);

CREATE INDEX IF NOT EXISTS idx_freco_attendance_person
    ON freco_attendance_records (person_id);
