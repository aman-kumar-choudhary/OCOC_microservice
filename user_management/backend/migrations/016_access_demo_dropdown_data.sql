-- Migration 016: development/demo values for the existing Access Management dropdowns.
-- Idempotent: real records are never replaced and no fake user/Keycloak accounts are created.
-- These roles also appear as selectable Subject Targets.  The evaluator already
-- recognises the four person types even when no custom role has been assigned.
INSERT INTO roles (name, description, user_type)
SELECT v.name, v.description, v.user_type
FROM (VALUES
    ('STUDENT_ACCESS', 'Demo access role for enrolled students', 'student'),
    ('FACULTY_ACCESS', 'Demo access role for faculty members', 'faculty'),
    ('WORKER_ACCESS', 'Demo access role for campus workers', 'worker'),
    ('VISITOR_ACCESS', 'Demo access role for registered visitors', 'visitor')
) AS v(name, description, user_type)
WHERE NOT EXISTS (SELECT 1 FROM roles r WHERE lower(r.name) = lower(v.name));


INSERT INTO access_groups (name, description)
SELECT v.name, v.description
FROM (VALUES
    ('Student Residents', 'Students assigned to a hostel'),
    ('Faculty Lab Team', 'Faculty allowed to use laboratory facilities'),
    ('Campus Workers', 'Maintenance, security, and service workers'),
    ('Approved Visitors', 'Visitors granted a supervised campus pass')
) AS v(name, description)
WHERE NOT EXISTS (SELECT 1 FROM access_groups g WHERE lower(g.name) = lower(v.name));

-- Campus -> Facility -> Area.  Hostels are added into locations by migration 015.
INSERT INTO locations (name, type, parent_id)
SELECT 'OCOC Main Campus', 'campus', NULL
WHERE NOT EXISTS (SELECT 1 FROM locations WHERE name = 'OCOC Main Campus' AND type = 'campus');

INSERT INTO locations (name, type, parent_id)
SELECT v.name, 'facility', campus.id
FROM (VALUES ('Academic Block'), ('Central Library'), ('Sports Complex'), ('Hostel Zone')) AS v(name)
CROSS JOIN LATERAL (SELECT id FROM locations WHERE name = 'OCOC Main Campus' AND type = 'campus' ORDER BY created_at LIMIT 1) campus
WHERE NOT EXISTS (SELECT 1 FROM locations l WHERE l.name = v.name AND l.type = 'facility');

INSERT INTO locations (name, type, parent_id)
SELECT v.name, 'area', facility.id
FROM (VALUES
    ('Main Gate'),
    ('Computer Lab'),
    ('Faculty Corridor'),
    ('Library Reading Hall'),
    ('Sports Arena')
) AS v(name)
CROSS JOIN LATERAL (
    SELECT id FROM locations
    WHERE name = CASE v.name
        WHEN 'Computer Lab' THEN 'Academic Block'
        WHEN 'Faculty Corridor' THEN 'Academic Block'
        WHEN 'Library Reading Hall' THEN 'Central Library'
        WHEN 'Sports Arena' THEN 'Sports Complex'
        ELSE 'OCOC Main Campus'
    END
    ORDER BY created_at LIMIT 1
) facility
WHERE NOT EXISTS (SELECT 1 FROM locations l WHERE l.name = v.name AND l.type = 'area');

-- Simulated hardware registrations for Reader dropdown testing.
INSERT INTO devices (mac_address, location_id, type, status, firmware_version)
SELECT v.mac_address, l.id, 'RFID_READER', 'ONLINE', 'demo-1.0'
FROM (VALUES
    ('02:0C:0C:00:00:01', 'Main Gate Reader', 'Main Gate'),
    ('02:0C:0C:00:00:02', 'Lab Reader', 'Computer Lab'),
    ('02:0C:0C:00:00:03', 'Library Reader', 'Library Reading Hall'),
    ('02:0C:0C:00:00:04', 'Faculty Reader', 'Faculty Corridor')
) AS v(mac_address, label, location_name)
JOIN locations l ON l.name = v.location_name
WHERE NOT EXISTS (SELECT 1 FROM devices d WHERE d.mac_address = v.mac_address);
