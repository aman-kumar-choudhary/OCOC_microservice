-- ============================================================
-- Migration 020: Enhanced Access Management
-- Adds user_location_access, expands operational roles, seeds
-- campus location hierarchy, and extends temporary grants.
-- All statements are additive and safe for populated databases.
-- ============================================================

-- ── 1. user_location_access ─────────────────────────────────
-- The core grant table: who can access which location, at what level.
CREATE TABLE IF NOT EXISTS user_location_access (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    location_id  UUID        NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
    access_level VARCHAR(20) NOT NULL DEFAULT 'ENTRY'
                  CHECK (access_level IN ('VIEW','ENTRY','MANAGE','ADMIN')),
    valid_from   TIMESTAMPTZ,
    valid_until  TIMESTAMPTZ,
    status       VARCHAR(20) NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active','inactive','revoked','expired')),
    granted_by   UUID        REFERENCES users(id) ON DELETE SET NULL,
    revoked_at   TIMESTAMPTZ,
    revoked_by   UUID        REFERENCES users(id) ON DELETE SET NULL,
    reason       TEXT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, location_id, access_level)
);

CREATE INDEX IF NOT EXISTS idx_ula_user_id
    ON user_location_access(user_id);
CREATE INDEX IF NOT EXISTS idx_ula_location_id
    ON user_location_access(location_id);
CREATE INDEX IF NOT EXISTS idx_ula_status_active
    ON user_location_access(status) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_ula_valid_until
    ON user_location_access(valid_until)
    WHERE valid_until IS NOT NULL AND status = 'active';

-- ── 2. Extend temporary_access_grants ───────────────────────

ALTER TABLE temporary_access_grants
    ADD COLUMN IF NOT EXISTS access_level VARCHAR(20) DEFAULT 'ENTRY',
    ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active',
    ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS revoked_by UUID REFERENCES users(id) ON DELETE SET NULL;

-- ── 3. Extend locations with optional metadata ──────────────

ALTER TABLE locations
    ADD COLUMN IF NOT EXISTS description TEXT,
    ADD COLUMN IF NOT EXISTS capacity INT,
    ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active';

-- ── 4. Seed expanded operational roles ──────────────────────

INSERT INTO roles (name, description, user_type)
SELECT value, 'OCOC operational role', NULL
FROM unnest(ARRAY['STUDENT','SECURITY_GUARD','STAFF','WORKER','VISITOR']) AS value
ON CONFLICT (name) DO NOTHING;

-- ── 5. Seed campus / location hierarchy ─────────────────────
-- Uses a deterministic UUID so re-runs are idempotent.

INSERT INTO locations (id, name, type, parent_id, description) VALUES
    ('a0000000-0000-0000-0000-000000000001', 'DSVV Main Campus', 'campus', NULL,
     'Dev Sanskriti Vishwavidyalaya — Main Campus')
ON CONFLICT (id) DO NOTHING;

-- Sub-locations under the main campus
INSERT INTO locations (id, name, type, parent_id, description) VALUES
    ('a0000000-0000-0000-0000-000000000010', 'Academic Block', 'building',
     'a0000000-0000-0000-0000-000000000001', 'Main academic building'),
    ('a0000000-0000-0000-0000-000000000011', 'Administration Block', 'building',
     'a0000000-0000-0000-0000-000000000001', 'Administrative offices'),
    ('a0000000-0000-0000-0000-000000000012', 'Central Library', 'facility',
     'a0000000-0000-0000-0000-000000000001', 'University central library'),
    ('a0000000-0000-0000-0000-000000000013', 'Computer Lab', 'facility',
     'a0000000-0000-0000-0000-000000000001', 'Computer science laboratory'),
    ('a0000000-0000-0000-0000-000000000014', 'Sports Complex', 'facility',
     'a0000000-0000-0000-0000-000000000001', 'Sports and recreation complex'),
    ('a0000000-0000-0000-0000-000000000015', 'Main Gate', 'gate',
     'a0000000-0000-0000-0000-000000000001', 'Main campus entry/exit point'),
    ('a0000000-0000-0000-0000-000000000016', 'Hostel Area', 'zone',
     'a0000000-0000-0000-0000-000000000001', 'Residential hostel zone')
ON CONFLICT (id) DO NOTHING;

-- Re-parent existing hostel locations under the Hostel Area zone
-- (Only updates rows whose parent_id is currently NULL — safe for re-runs)
UPDATE locations
SET    parent_id = 'a0000000-0000-0000-0000-000000000016'
WHERE  type = 'hostel'
  AND  parent_id IS NULL
  AND  id != 'a0000000-0000-0000-0000-000000000016';

-- ── 6. Performance indexes for access audit queries ─────────

CREATE INDEX IF NOT EXISTS idx_audit_access_ops
    ON audit_logs(operation, created_at DESC)
    WHERE operation IN (
        'LOCATION_ACCESS_GRANTED','LOCATION_ACCESS_REVOKED',
        'LOCATION_ACCESS_UPDATED','LOCATION_ACCESS_EXPIRED',
        'ACCESS_CONFIGURATION_UPDATED'
    );

-- ── 7. Composite index on users for access search ───────────

CREATE INDEX IF NOT EXISTS idx_users_type_status
    ON users(user_type, status);
