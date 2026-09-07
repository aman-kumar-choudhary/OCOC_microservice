-- ============================================================
-- Migration 007: Schema Refactoring and Cleanup
-- ============================================================

-- 1. Drop the monolithic view
DROP VIEW IF EXISTS user_profiles;

-- 2. Add 'school' to departments
ALTER TABLE departments ADD COLUMN IF NOT EXISTS school TEXT;

-- Migrate 'school' data if any exists (naively grabbing the first non-null school for a department)
-- In a real scenario, this would be more complex, but here we just take one existing value
UPDATE departments d
SET school = (
    SELECT school FROM (
        SELECT department_id, school FROM student_profiles WHERE school IS NOT NULL
        UNION
        SELECT department_id, school FROM faculty_profiles WHERE school IS NOT NULL
    ) AS s
    WHERE s.department_id = d.id
    LIMIT 1
)
WHERE d.school IS NULL;

-- 3. Remove denormalized columns from profile tables
ALTER TABLE student_profiles
    DROP COLUMN IF EXISTS department,
    DROP COLUMN IF EXISTS school,
    DROP COLUMN IF EXISTS hostel_flag;

ALTER TABLE faculty_profiles
    DROP COLUMN IF EXISTS department,
    DROP COLUMN IF EXISTS school;

ALTER TABLE worker_profiles
    DROP COLUMN IF EXISTS department;

-- 4. Add missing Foreign Keys
-- (A) freco_people.external_id -> users(id)
-- Note: 'external_id' is already a UUID.
ALTER TABLE freco_people
    DROP CONSTRAINT IF EXISTS fk_freco_users;
ALTER TABLE freco_people
    ADD CONSTRAINT fk_freco_users
    FOREIGN KEY (external_id) REFERENCES users(id) ON DELETE CASCADE;

-- (B) audit_logs.actor_id -> users(id)
ALTER TABLE audit_logs
    DROP CONSTRAINT IF EXISTS fk_audit_actor;
ALTER TABLE audit_logs
    ADD CONSTRAINT fk_audit_actor
    FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE SET NULL;
