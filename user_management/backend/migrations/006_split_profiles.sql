-- ============================================================
-- Migration 006: Split monolithic user_profiles into role-specific tables
-- ============================================================

-- 1. Create role-specific tables

CREATE TABLE IF NOT EXISTS student_profiles (
    user_id              UUID        PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    full_name            TEXT        NOT NULL,
    roll_number          TEXT        UNIQUE,
    department_id        UUID        REFERENCES departments(id),
    department           TEXT,
    school               TEXT,
    course               TEXT,
    semester             TEXT,
    hostel_flag          BOOLEAN     NOT NULL DEFAULT FALSE,
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
    department           TEXT,
    school               TEXT,
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
    department           TEXT,
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
    user_id, full_name, roll_number, department_id, department, school, 
    course, semester, hostel_flag, hostel_id, emergency_contact, 
    guardian_contact, photo_reference, updated_at
)
SELECT 
    p.user_id, p.full_name, p.roll_number, p.department_id, p.department, p.school, 
    p.course, p.semester, p.hostel_flag, p.hostel_id, p.emergency_contact, 
    p.guardian_contact, p.photo_reference, p.updated_at
FROM user_profiles p
JOIN users u ON u.id = p.user_id
WHERE u.user_type = 'student';

-- Migrate Faculty
INSERT INTO faculty_profiles (
    user_id, full_name, employee_id, department_id, department, school, 
    designation, emergency_contact, photo_reference, updated_at
)
SELECT 
    p.user_id, p.full_name, p.employee_id, p.department_id, p.department, p.school, 
    p.designation, p.emergency_contact, p.photo_reference, p.updated_at
FROM user_profiles p
JOIN users u ON u.id = p.user_id
WHERE u.user_type = 'faculty';

-- Migrate Workers
INSERT INTO worker_profiles (
    user_id, full_name, employee_id, department_id, department, 
    designation, emergency_contact, photo_reference, updated_at
)
SELECT 
    p.user_id, p.full_name, p.employee_id, p.department_id, p.department, 
    p.designation, p.emergency_contact, p.photo_reference, p.updated_at
FROM user_profiles p
JOIN users u ON u.id = p.user_id
WHERE u.user_type = 'worker';

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
WHERE u.user_type = 'visitor';

-- 4. Drop the old table and its indexes (indexes are dropped implicitly with table)
DROP TABLE IF EXISTS user_profiles CASCADE;

-- 5. Create a view to preserve SELECT query compatibility for the backend
CREATE VIEW user_profiles AS
SELECT 
    u.id as user_id,
    COALESCE(sp.full_name, fp.full_name, wp.full_name, vp.full_name) as full_name,
    sp.roll_number,
    COALESCE(fp.employee_id, wp.employee_id) as employee_id,
    COALESCE(sp.department_id, fp.department_id, wp.department_id) as department_id,
    COALESCE(sp.department, fp.department, wp.department) as department,
    COALESCE(sp.school, fp.school) as school,
    sp.course, 
    sp.semester,
    COALESCE(fp.designation, wp.designation) as designation,
    COALESCE(sp.hostel_flag, FALSE) as hostel_flag,
    sp.hostel_id,
    COALESCE(sp.emergency_contact, fp.emergency_contact, wp.emergency_contact) as emergency_contact,
    sp.guardian_contact,
    COALESCE(sp.photo_reference, fp.photo_reference, wp.photo_reference, vp.photo_reference) as photo_reference,
    vp.gov_id_type, 
    vp.gov_id_number, 
    vp.visit_purpose, 
    vp.host_contact, 
    vp.visit_start, 
    vp.visit_duration_days,
    COALESCE(sp.updated_at, fp.updated_at, wp.updated_at, vp.updated_at) as updated_at
FROM users u
LEFT JOIN student_profiles sp ON sp.user_id = u.id AND u.user_type = 'student'
LEFT JOIN faculty_profiles fp ON fp.user_id = u.id AND u.user_type = 'faculty'
LEFT JOIN worker_profiles wp ON wp.user_id = u.id AND u.user_type = 'worker'
LEFT JOIN visitor_profiles vp ON vp.user_id = u.id AND u.user_type = 'visitor';
