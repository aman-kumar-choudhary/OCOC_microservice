-- ============================================================
-- Migration 001: Initial schema for ococ_users
-- Idempotent: safe to re-run on an already-initialized database.
-- Applied by user_management at startup.
-- ============================================================

-- Required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── Lookup tables ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS departments (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT        NOT NULL,
    code        TEXT        UNIQUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS hostels (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT        NOT NULL,
    code        TEXT        UNIQUE,
    capacity    INT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Core users table ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS users (
    id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    keycloak_user_id  TEXT        UNIQUE,
    user_type         TEXT        NOT NULL
                        CHECK (user_type IN ('student','faculty','worker','visitor')),
    status            TEXT        NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active','suspended','deactivated')),
    email             TEXT        NOT NULL UNIQUE,
    phone             TEXT,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- A few early development databases contain a placeholder `users` table with
-- only `id`. CREATE TABLE IF NOT EXISTS deliberately does not evolve it, so
-- add the complete core contract before any dependent index or FK is created.
-- Defaults make this safe for legacy rows; the application still validates all
-- new registrations and writes explicit values.
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS keycloak_user_id TEXT,
    ADD COLUMN IF NOT EXISTS user_type TEXT NOT NULL DEFAULT 'student',
    ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active',
    ADD COLUMN IF NOT EXISTS email TEXT,
    ADD COLUMN IF NOT EXISTS phone TEXT,
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- Existing valid user records keep their values. A legacy placeholder table
-- may have no rows; only then it is safe to restore the new-schema invariant.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM users WHERE email IS NULL) THEN
        ALTER TABLE users ALTER COLUMN email SET NOT NULL;
    END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_keycloak_user_id_unique
    ON users (keycloak_user_id) WHERE keycloak_user_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_unique ON users (email);

CREATE INDEX IF NOT EXISTS idx_users_email     ON users (email);
CREATE INDEX IF NOT EXISTS idx_users_user_type ON users (user_type);
CREATE INDEX IF NOT EXISTS idx_users_status    ON users (status);
CREATE INDEX IF NOT EXISTS idx_users_phone     ON users (phone);

-- ── User profiles ────────────────────────────────────────────
-- One row per user; covers all personas in a single table.
-- Role-specific fields are NULLable — only populated for the relevant persona.

CREATE TABLE IF NOT EXISTS user_profiles (
    user_id              UUID        PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    full_name            TEXT        NOT NULL,
    -- Student fields
    roll_number          TEXT        UNIQUE,
    -- Faculty / Worker fields
    employee_id          TEXT        UNIQUE,
    -- Shared organisational fields
    department_id        UUID        REFERENCES departments(id),
    department           TEXT,           -- denormalised name for fast display
    school               TEXT,
    course               TEXT,
    semester             TEXT,
    designation          TEXT,
    -- Hostel (student)
    hostel_flag          BOOLEAN     NOT NULL DEFAULT FALSE,
    hostel_id            UUID        REFERENCES hostels(id),
    -- Contact
    emergency_contact    TEXT,
    guardian_contact     TEXT,
    photo_reference      TEXT,
    -- Visitor fields
    gov_id_type          TEXT,
    gov_id_number        TEXT,
    visit_purpose        TEXT,
    host_contact         TEXT,
    visit_start          TIMESTAMPTZ,
    visit_duration_days  INT,
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_profiles_department  ON user_profiles (department_id);
CREATE INDEX IF NOT EXISTS idx_profiles_roll_number ON user_profiles (roll_number);
CREATE INDEX IF NOT EXISTS idx_profiles_employee_id ON user_profiles (employee_id);

-- ── RFID cards ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS rfid_cards (
    id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    uid            TEXT        NOT NULL UNIQUE,
    status         TEXT        NOT NULL DEFAULT 'inactive'
                     CHECK (status IN ('active','inactive','lost','stolen','replaced','revoked')),
    issued_at      TIMESTAMPTZ,
    revoked_at     TIMESTAMPTZ,
    revoked_reason TEXT,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_rfid_cards_uid    ON rfid_cards (uid);
CREATE        INDEX IF NOT EXISTS idx_rfid_cards_status ON rfid_cards (status);

-- ── User ↔ RFID card assignment ──────────────────────────────

CREATE TABLE IF NOT EXISTS user_rfid_cards (
    user_id       UUID        NOT NULL REFERENCES users(id)      ON DELETE CASCADE,
    rfid_card_id  UUID        NOT NULL REFERENCES rfid_cards(id) ON DELETE CASCADE,
    assigned_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    unassigned_at TIMESTAMPTZ,
    is_primary    BOOLEAN     NOT NULL DEFAULT TRUE,
    PRIMARY KEY (user_id, rfid_card_id)
);

CREATE INDEX IF NOT EXISTS idx_user_rfid_cards_user ON user_rfid_cards (user_id);
CREATE INDEX IF NOT EXISTS idx_user_rfid_cards_card ON user_rfid_cards (rfid_card_id);

-- Enforce: each user has at most one active primary card at a time.
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_rfid_one_primary
    ON user_rfid_cards (user_id)
    WHERE is_primary AND unassigned_at IS NULL;

-- ── Roles & Permissions ──────────────────────────────────────

CREATE TABLE IF NOT EXISTS permissions (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT        NOT NULL UNIQUE,
    description TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS roles (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT        NOT NULL UNIQUE,
    description TEXT,
    user_type   TEXT        CHECK (user_type IN ('student','faculty','worker','visitor')),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS role_permissions (
    role_id       UUID NOT NULL REFERENCES roles(id)       ON DELETE CASCADE,
    permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE IF NOT EXISTS user_roles (
    user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id     UUID        NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    assigned_by UUID        REFERENCES users(id),
    PRIMARY KEY (user_id, role_id)
);

-- ── Audit log ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS audit_logs (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id     UUID,
    operation    TEXT        NOT NULL,
    entity_type  TEXT        NOT NULL,
    entity_id    TEXT        NOT NULL,
    before_state JSONB,
    after_state  JSONB,
    ip_address   TEXT,
    user_agent   TEXT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_actor      ON audit_logs (actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity     ON audit_logs (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_operation  ON audit_logs (operation);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs (created_at DESC);
