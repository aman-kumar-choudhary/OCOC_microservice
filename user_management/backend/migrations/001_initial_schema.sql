-- OCOC User Management — Initial Schema
-- Migration: 001_initial_schema.sql
-- Run: psql $DATABASE_URL -f migrations/001_initial_schema.sql

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─────────────────────────────────────────────
-- DEPARTMENTS
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS departments (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT NOT NULL,
    code        TEXT NOT NULL UNIQUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────
-- HOSTELS
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS hostels (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT NOT NULL,
    code        TEXT NOT NULL UNIQUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────
-- USERS
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    keycloak_user_id    TEXT UNIQUE,                      -- nullable until KC sync
    user_type           TEXT NOT NULL CHECK (user_type IN ('student','faculty','worker','visitor')),
    status              TEXT NOT NULL DEFAULT 'active'
                            CHECK (status IN ('active','suspended','deactivated')),
    email               TEXT NOT NULL UNIQUE,
    phone               TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_users_status       ON users(status);
CREATE INDEX IF NOT EXISTS idx_users_user_type    ON users(user_type);
CREATE INDEX IF NOT EXISTS idx_users_email        ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_phone        ON users(phone);

-- ─────────────────────────────────────────────
-- USER PROFILES
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_profiles (
    user_id             UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    full_name           TEXT NOT NULL,
    roll_number         TEXT UNIQUE,
    employee_id         TEXT UNIQUE,
    department_id       UUID REFERENCES departments(id),
    hostel_id           UUID REFERENCES hostels(id),
    emergency_contact   TEXT,
    guardian_contact    TEXT,
    photo_reference     TEXT,
    -- Visitor-specific fields
    gov_id_type         TEXT,
    gov_id_number       TEXT,
    visit_purpose       TEXT,
    host_contact        TEXT,
    visit_start         TIMESTAMPTZ,
    visit_duration_days INT,
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_profiles_roll_number ON user_profiles(roll_number);
CREATE INDEX IF NOT EXISTS idx_profiles_employee_id ON user_profiles(employee_id);
CREATE INDEX IF NOT EXISTS idx_profiles_department  ON user_profiles(department_id);

-- ─────────────────────────────────────────────
-- ROLES
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS roles (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT NOT NULL UNIQUE,
    description TEXT,
    user_type   TEXT CHECK (user_type IN ('student','faculty','worker','visitor',NULL)),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────
-- PERMISSIONS
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS permissions (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT NOT NULL UNIQUE,
    description TEXT,
    resource    TEXT NOT NULL,
    action      TEXT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────
-- ROLE PERMISSIONS
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS role_permissions (
    role_id         UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission_id   UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);

-- ─────────────────────────────────────────────
-- USER ROLES
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_roles (
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id     UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    assigned_by UUID REFERENCES users(id),
    PRIMARY KEY (user_id, role_id)
);

CREATE INDEX IF NOT EXISTS idx_user_roles_user ON user_roles(user_id);

-- ─────────────────────────────────────────────
-- RFID CARDS
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rfid_cards (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    uid             TEXT NOT NULL UNIQUE,           -- hardware UID — must be globally unique
    status          TEXT NOT NULL DEFAULT 'inactive'
                        CHECK (status IN ('active','inactive','lost','stolen','replaced','revoked')),
    issued_at       TIMESTAMPTZ,
    revoked_at      TIMESTAMPTZ,
    revoked_reason  TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_rfid_cards_uid ON rfid_cards(uid);
CREATE INDEX IF NOT EXISTS idx_rfid_cards_status     ON rfid_cards(status);

-- ─────────────────────────────────────────────
-- USER RFID CARDS (assignment table)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_rfid_cards (
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    rfid_card_id    UUID NOT NULL REFERENCES rfid_cards(id) ON DELETE CASCADE,
    assigned_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    unassigned_at   TIMESTAMPTZ,
    is_primary      BOOLEAN NOT NULL DEFAULT true,
    PRIMARY KEY (user_id, rfid_card_id)
);

-- Only one active (primary, non-unassigned) card per user
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_rfid_one_primary
    ON user_rfid_cards(user_id)
    WHERE is_primary AND unassigned_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_user_rfid_cards_card ON user_rfid_cards(rfid_card_id);
CREATE INDEX IF NOT EXISTS idx_user_rfid_cards_user ON user_rfid_cards(user_id);

-- ─────────────────────────────────────────────
-- AUDIT LOGS (append-only)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_logs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id        UUID,                           -- nullable: system actions
    operation       TEXT NOT NULL,
    entity_type     TEXT NOT NULL,
    entity_id       TEXT NOT NULL,
    before_state    JSONB,
    after_state     JSONB,
    ip_address      TEXT,
    user_agent      TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- No UPDATE/DELETE on audit_logs — enforced by application layer + DB role if desired
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor       ON audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity      ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_operation   ON audit_logs(operation);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at  ON audit_logs(created_at DESC);

-- ─────────────────────────────────────────────
-- SEED: Default Roles
-- ─────────────────────────────────────────────
INSERT INTO roles (name, description, user_type) VALUES
    ('SUPER_ADMIN',    'Full system access',                NULL),
    ('ADMIN',          'Administrative access',             NULL),
    ('USER_MANAGER',   'Can manage users and onboarding',   NULL),
    ('SECURITY_ADMIN', 'Manages RFID and access control',   NULL),
    ('VIEWER',         'Read-only access',                  NULL),
    ('STUDENT',        'Default student role',              'student'),
    ('FACULTY',        'Default faculty role',              'faculty'),
    ('WORKER',         'Default worker role',               'worker'),
    ('VISITOR',        'Default visitor role',              'visitor')
ON CONFLICT (name) DO NOTHING;

-- ─────────────────────────────────────────────
-- SEED: Permissions
-- ─────────────────────────────────────────────
INSERT INTO permissions (name, description, resource, action) VALUES
    ('user:create',      'Create users',               'user',  'create'),
    ('user:read',        'View users',                 'user',  'read'),
    ('user:update',      'Update user profiles',       'user',  'update'),
    ('user:suspend',     'Suspend users',              'user',  'suspend'),
    ('user:deactivate',  'Deactivate users',           'user',  'deactivate'),
    ('user:import',      'Bulk import users',          'user',  'import'),
    ('user:export',      'Export user data',           'user',  'export'),
    ('rfid:assign',      'Assign RFID cards',          'rfid',  'assign'),
    ('rfid:replace',     'Replace RFID cards',         'rfid',  'replace'),
    ('rfid:revoke',      'Revoke RFID cards',          'rfid',  'revoke'),
    ('rfid:read',        'View RFID cards',            'rfid',  'read'),
    ('role:assign',      'Assign roles to users',      'role',  'assign'),
    ('role:manage',      'Create/update roles',        'role',  'manage'),
    ('audit:read',       'View audit logs',            'audit', 'read')
ON CONFLICT (name) DO NOTHING;

COMMIT;
