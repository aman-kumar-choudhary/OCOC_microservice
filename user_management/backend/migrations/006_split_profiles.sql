-- ============================================================
-- Migration 006: Split monolithic user_profiles into role-specific tables
-- ============================================================

-- 1. Create role-specific tabless
CREATE TABLE IF NOT EXISTS student_profiles (
    user_id              UUID        PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    full_name            TEXT        NOT NULL,
    roll_number          TEXT        UNIQUE,
    department_id        UUID        REFERENCES departments(id),
    course               TEXT,
    semester             TEXT,
    hostel_id            UUID        REFERENCES hostels(id),
    emergency_contact    TEXT,
    guardian_contact     TEXT,
    photo_reference      TEXT,
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS faculty_profiles (
    user_id              UUID        PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    full_name            TEXT        NOT NULL,
    employee_id          TEXT        UNIQUE,
    department_id        UUID        REFERENCES departments(id),
    designation          TEXT,
    emergency_contact    TEXT,
    photo_reference      TEXT,
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS worker_profiles (
    user_id              UUID        PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    full_name            TEXT        NOT NULL,
    employee_id          TEXT        UNIQUE,
    department_id        UUID        REFERENCES departments(id),
    designation          TEXT,
    emergency_contact    TEXT,
    photo_reference      TEXT,
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS visitor_profiles (
    user_id              UUID        PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    full_name            TEXT        NOT NULL,
    gov_id_type          TEXT,
    gov_id_number        TEXT,
    visit_purpose        TEXT,
    host_contact         TEXT,
    visit_start          TIMESTAMPTZ,
    visit_duration_days  INT,
    photo_reference      TEXT,
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Create indexes for the new tables

CREATE INDEX IF NOT EXISTS idx_student_profiles_dept_hostel ON student_profiles(department_id, hostel_id);
CREATE INDEX IF NOT EXISTS idx_student_profiles_course_sem ON student_profiles(course, semester);
CREATE INDEX IF NOT EXISTS idx_student_profiles_roll ON student_profiles(roll_number);

CREATE INDEX IF NOT EXISTS idx_faculty_profiles_dept ON faculty_profiles(department_id);
CREATE INDEX IF NOT EXISTS idx_faculty_profiles_emp_id ON faculty_profiles(employee_id);

CREATE INDEX IF NOT EXISTS idx_worker_profiles_dept ON worker_profiles(department_id);
CREATE INDEX IF NOT EXISTS idx_worker_profiles_emp_id ON worker_profiles(employee_id);

-- 3. Migrate existing data from user_profiles to specific tables

-- Migrate Students
INSERT INTO student_profiles (
    user_id, full_name, roll_number, department_id, 
    course, semester, hostel_id, emergency_contact, 
    guardian_contact, photo_reference, updated_at
)
SELECT 
    p.user_id, p.full_name, p.roll_number, p.department_id, 
    p.course, p.semester, p.hostel_id, p.emergency_contact, 
    p.guardian_contact, p.photo_reference, p.updated_at
FROM user_profiles p
JOIN users u ON u.id = p.user_id
WHERE u.user_type = 'student'
ON CONFLICT DO NOTHING;

-- Migrate Faculty
INSERT INTO faculty_profiles (
    user_id, full_name, employee_id, department_id, 
    designation, emergency_contact, photo_reference, updated_at
)
SELECT 
    p.user_id, p.full_name, p.employee_id, p.department_id, 
    p.designation, p.emergency_contact, p.photo_reference, p.updated_at
FROM user_profiles p
JOIN users u ON u.id = p.user_id
WHERE u.user_type = 'faculty'
ON CONFLICT DO NOTHING;

-- Migrate Workers
INSERT INTO worker_profiles (
    user_id, full_name, employee_id, department_id, 
    designation, emergency_contact, photo_reference, updated_at
)
SELECT 
    p.user_id, p.full_name, p.employee_id, p.department_id, 
    p.designation, p.emergency_contact, p.photo_reference, p.updated_at
FROM user_profiles p
JOIN users u ON u.id = p.user_id
WHERE u.user_type = 'worker'
ON CONFLICT DO NOTHING;

-- Migrate Visitors
INSERT INTO visitor_profiles (
    user_id, full_name, gov_id_type, gov_id_number, visit_purpose, 
    host_contact, visit_start, visit_duration_days, photo_reference, updated_at
)
SELECT 
    p.user_id, p.full_name, p.gov_id_type, p.gov_id_number, p.visit_purpose, 
    p.host_contact, p.visit_start, p.visit_duration_days, p.photo_reference, p.updated_at
FROM user_profiles p
JOIN users u ON u.id = p.user_id
WHERE u.user_type = 'visitor'
ON CONFLICT DO NOTHING;

-- Keep the legacy table during the compatibility window.  It is the source for
-- safe backfills on databases created by older releases; application queries
-- use the normalized tables above.
