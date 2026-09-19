-- Migration 012: Default System Access Rules

-- 1. Insert Hostel Rule (Dynamically evaluated by subject_type = 'student_own_hostel')
INSERT INTO access_rules (name, description, subject_type, subject_id, effect, priority, is_active)
SELECT 'System: Own Hostel Access', 'Automatically grants students access to their assigned hostel.', 'student_own_hostel', 'student', 'ALLOW', 100, true
WHERE NOT EXISTS (
    SELECT 1 FROM access_rules WHERE subject_type = 'student_own_hostel'
);

-- 2. Insert Campus Exit Rule (If a main gate exists)
INSERT INTO access_rules (name, description, subject_type, subject_id, location_id, effect, priority, is_active)
SELECT 'System: Campus Exit Restriction', 'Denies students exit through the main gate unless they have a Temporary Grant.', 'role', 'student', id, 'DENY', 99, true
FROM locations 
WHERE (name ILIKE '%main gate%' OR name ILIKE '%out of campus%')
  AND NOT EXISTS (
    SELECT 1 FROM access_rules WHERE name = 'System: Campus Exit Restriction'
  )
LIMIT 1;
