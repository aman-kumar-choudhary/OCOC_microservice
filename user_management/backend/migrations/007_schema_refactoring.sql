-- ============================================================
-- Migration 007: Schema Refactoring and Cleanup
-- ============================================================

-- `user_profiles` is a legacy table on older deployments. Some older
-- deployments also exposed it (or another directory object) as a view over
-- the role-specific tables. Those objects can depend on the denormalized
-- columns removed below, so the column drops must be CASCADE-safe. The
-- normalized `department_id` columns are retained and are used by runtime
-- queries.

-- 2. Add 'school' to departments
ALTER TABLE departments ADD COLUMN IF NOT EXISTS school TEXT;

-- The role-specific profile tables created by migration 006 do not contain
-- school columns, so there is no profile data to migrate here. Keep the
-- department-level column available for directory display and future data.

-- 3. Remove denormalized columns from profile tables
ALTER TABLE student_profiles
    DROP COLUMN IF EXISTS department CASCADE,
    DROP COLUMN IF EXISTS school CASCADE,
    DROP COLUMN IF EXISTS hostel_flag CASCADE;

ALTER TABLE faculty_profiles
    DROP COLUMN IF EXISTS department CASCADE,
    DROP COLUMN IF EXISTS school CASCADE;

ALTER TABLE worker_profiles
    DROP COLUMN IF EXISTS department CASCADE;

-- 4. Add missing Foreign Keys
-- (A) freco_people.external_id -> users(id)
-- Note: 'external_id' is already a UUID.
ALTER TABLE freco_people
    DROP CONSTRAINT IF EXISTS fk_freco_users;
ALTER TABLE freco_people
    ADD CONSTRAINT fk_freco_users
    FOREIGN KEY (external_id) REFERENCES users(id) ON DELETE CASCADE
    NOT VALID;

-- (B) audit_logs.actor_id -> users(id)
-- Older audit rows may refer to users removed before this FK existed. Keep
-- those audit records, but clear the now-unknown actor reference so the new
-- constraint can be validated normally.
UPDATE audit_logs a
SET actor_id = NULL
WHERE actor_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM users u WHERE u.id = a.actor_id);

ALTER TABLE audit_logs
    DROP CONSTRAINT IF EXISTS fk_audit_actor;
ALTER TABLE audit_logs
    ADD CONSTRAINT fk_audit_actor
    FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE SET NULL;
