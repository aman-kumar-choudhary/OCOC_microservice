-- Migration 023: Fix missing profile tables, columns, roles and user linkages

-- 1. Create warden_profiles table if not exists
CREATE TABLE IF NOT EXISTS warden_profiles (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    hostel_id UUID REFERENCES hostels(id) ON DELETE SET NULL,
    hostel_block TEXT,
    responsibilities TEXT,
    emergency_contact TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_warden_profiles_hostel_id ON warden_profiles(hostel_id);

-- 2. Add missing columns to student_profiles
ALTER TABLE student_profiles
    ADD COLUMN IF NOT EXISTS batch TEXT,
    ADD COLUMN IF NOT EXISTS room_number TEXT,
    ADD COLUMN IF NOT EXISTS nationality TEXT,
    ADD COLUMN IF NOT EXISTS gov_id_type TEXT,
    ADD COLUMN IF NOT EXISTS gov_id_number TEXT;

-- 3. Add missing columns to faculty_profiles
ALTER TABLE faculty_profiles
    ADD COLUMN IF NOT EXISTS courses TEXT,
    ADD COLUMN IF NOT EXISTS assigned_students TEXT;

-- 4. Add missing columns to worker_profiles
ALTER TABLE worker_profiles
    ADD COLUMN IF NOT EXISTS job_type TEXT,
    ADD COLUMN IF NOT EXISTS work_area TEXT,
    ADD COLUMN IF NOT EXISTS shift TEXT,
    ADD COLUMN IF NOT EXISTS assigned_location_id UUID REFERENCES locations(id) ON DELETE SET NULL;

-- 5. Add missing columns to visitor_profiles
ALTER TABLE visitor_profiles
    ADD COLUMN IF NOT EXISTS host_person TEXT,
    ADD COLUMN IF NOT EXISTS valid_until TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS allowed_location_ids UUID[];

-- Backfill existing visitor records if valid_until or host_person are null
UPDATE visitor_profiles
SET host_person = COALESCE(host_person, host_contact, 'Campus Host'),
    valid_until = COALESCE(valid_until, visit_start + (COALESCE(visit_duration_days, 1) || ' days')::interval, now() + interval '1 day')
WHERE host_person IS NULL OR valid_until IS NULL;

-- 6. Ensure default roles exist in roles table
INSERT INTO roles (name, description, user_type)
VALUES
    ('SUPER_ADMIN', 'Super Administrator Role', 'faculty'),
    ('ADMIN', 'System Administrator Role', 'faculty'),
    ('SECURITY_ADMIN', 'Security Administrator Role', 'worker'),
    ('GUARD', 'Campus Security Guard Role', 'worker'),
    ('SECURITY_GUARD', 'Campus Security Guard Role', 'worker'),
    ('WARDEN', 'Hostel Warden Role', 'faculty'),
    ('STUDENT', 'Student Role', 'student'),
    ('FACULTY', 'Faculty Role', 'faculty'),
    ('WORKER', 'Campus Worker Role', 'worker'),
    ('VIEWER', 'Auditor & Viewer Role', 'faculty')
ON CONFLICT (name) DO NOTHING;

-- 7. Ensure fallback tables exist for FRECO face auth subquery
CREATE TABLE IF NOT EXISTS freco_people (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    external_id UUID NOT NULL UNIQUE,
    name TEXT NOT NULL,
    person_type TEXT NOT NULL DEFAULT 'student',
    email TEXT,
    rfid_uid TEXT UNIQUE,
    metadata_json TEXT,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$
BEGIN
    IF to_regclass('freco_face_embeddings') IS NULL THEN
        CREATE TABLE freco_face_embeddings (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            person_id UUID NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );
    END IF;
END $$;

-- 8. Link / seed Keycloak admin test user if exists
DO $$
DECLARE
    super_role_id UUID;
    target_user_id UUID;
BEGIN
    SELECT id INTO super_role_id FROM roles WHERE name = 'SUPER_ADMIN' LIMIT 1;

    SELECT id INTO target_user_id FROM users
    WHERE LOWER(email) IN ('admin_test@gmail.com', 'admin_test@ococ.campus.edu')
       OR keycloak_user_id = '5cf1ce89-59d9-4d92-aecf-db398ccba07d'
    LIMIT 1;

    IF target_user_id IS NULL THEN
        target_user_id := '5cf1ce89-59d9-4d92-aecf-db398ccba07d'::uuid;
        INSERT INTO users (id, keycloak_user_id, email, phone, user_type, status, created_at, updated_at)
        VALUES (target_user_id, '5cf1ce89-59d9-4d92-aecf-db398ccba07d', 'admin_test@gmail.com', '+919999999999', 'faculty', 'active', now(), now())
        ON CONFLICT DO NOTHING;

        INSERT INTO faculty_profiles (user_id, full_name, employee_id, designation, updated_at)
        VALUES (target_user_id, 'Aman Kumar', 'EMP-SUPERADMIN-001', 'Chief University Administrator', now())
        ON CONFLICT DO NOTHING;
    ELSE
        UPDATE users
        SET keycloak_user_id = '5cf1ce89-59d9-4d92-aecf-db398ccba07d', status = 'active', updated_at = now()
        WHERE id = target_user_id;

        INSERT INTO faculty_profiles (user_id, full_name, employee_id, designation, updated_at)
        VALUES (target_user_id, 'Aman Kumar', 'EMP-SUPERADMIN-001', 'Chief University Administrator', now())
        ON CONFLICT (user_id) DO UPDATE SET full_name = 'Aman Kumar';
    END IF;

    IF super_role_id IS NOT NULL AND target_user_id IS NOT NULL THEN
        INSERT INTO user_roles (user_id, role_id, assigned_at)
        VALUES (target_user_id, super_role_id, now())
        ON CONFLICT (user_id, role_id) DO NOTHING;
    END IF;
END $$;
