-- Upgrade databases that received the older generic residence seed values.
INSERT INTO hostels (name, code)
SELECT v.name, v.code
FROM (VALUES
 ('Arvind', 'ARVIND'),
 ('Paninni', 'PANINNI'),
 ('Shanghmitra', 'SHANGHMITRA'),
 ('Nivedita', 'NIVEDITA'),
 ('International', 'INTERNATIONAL')
) AS v(name, code)
WHERE NOT EXISTS (SELECT 1 FROM hostels h WHERE lower(h.name) = lower(v.name));

-- Only remove obsolete defaults when no profile refers to them.
DELETE FROM hostels h
WHERE h.code IN ('BOYS', 'GIRLS')
  AND NOT EXISTS (SELECT 1 FROM student_profiles sp WHERE sp.hostel_id = h.id);
