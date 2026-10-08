-- Restrict the Access Management Rule Builder and Grants catalogue to the
-- operational hostels, gates, auditorium, and library requested by campus.
-- Existing location records are kept so historical rules, events, and grants
-- continue to reference valid rows; unavailable entries are simply inactive.

ALTER TABLE locations
    ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active';

UPDATE locations
SET status = 'inactive';

-- Keep hostel IDs aligned with the hostel records used elsewhere in the app.
UPDATE locations AS location
SET name = CASE lower(hostel.name)
        WHEN 'shanghmitra' THEN 'Sanmitra'
        WHEN 'paninni' THEN 'Pannini'
        ELSE hostel.name
    END,
    type = 'hostel',
    status = 'active'
FROM hostels AS hostel
WHERE location.id = hostel.id
  AND lower(hostel.name) IN ('nivedita', 'shanghmitra', 'sanmitra', 'international', 'arvind', 'pannini');

-- Add the named shared facilities when they do not already exist.
INSERT INTO locations (name, type, status)
SELECT requested.name, requested.type, 'active'
FROM (VALUES
    ('Main Gate 1', 'gate'),
    ('Gate No. 2', 'gate'),
    ('Gate No. 3', 'gate'),
    ('Auditorium', 'facility'),
    ('Library', 'facility')
) AS requested(name, type)
WHERE NOT EXISTS (
    SELECT 1 FROM locations existing
    WHERE lower(existing.name) = lower(requested.name)
);

UPDATE locations
SET type = CASE lower(name)
        WHEN 'main gate 1' THEN 'gate'
        WHEN 'gate no. 2' THEN 'gate'
        WHEN 'gate no. 3' THEN 'gate'
        ELSE type
    END,
    status = 'active'
WHERE lower(name) IN ('main gate 1', 'gate no. 2', 'gate no. 3', 'auditorium', 'library');
