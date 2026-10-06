-- Migration 022: Schema Integrity, Composite Indexes and Status Constraint Hardening

-- 1. Performance Indexes for Query Hotspots
CREATE INDEX IF NOT EXISTS idx_access_logs_user_timestamp 
    ON access_logs (user_id, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_student_hostel_status_status 
    ON student_hostel_status (current_status);

CREATE INDEX IF NOT EXISTS idx_leave_rfid_student_time 
    ON leave_rfid_permissions (student_id, ends_at);

CREATE INDEX IF NOT EXISTS idx_hostel_permissions_student_time 
    ON hostel_permissions (student_id, end_time);

CREATE INDEX IF NOT EXISTS idx_devices_mac_type 
    ON devices (mac_address, type);

CREATE INDEX IF NOT EXISTS idx_leave_requests_student_status 
    ON leave_requests (student_id, status);

-- 2. Align hostel_permissions status check constraint to accept APPROVED
DO $$
BEGIN
    ALTER TABLE hostel_permissions DROP CONSTRAINT IF EXISTS hostel_permissions_status_check;
    ALTER TABLE hostel_permissions ADD CONSTRAINT hostel_permissions_status_check 
        CHECK (status IN ('ACTIVE', 'APPROVED', 'USED', 'EXPIRED', 'CANCELLED', 'REVOKED'));
END $$;

-- 3. Card Integrity: Prevent duplicate active assignment of the same physical RFID card
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_rfid_active_card 
    ON user_rfid_cards (rfid_card_id) 
    WHERE unassigned_at IS NULL;

-- 4. Hardware Connectivity: Provision default hostel gates and RFID readers for registered hostels
INSERT INTO hostel_gates (id, hostel_id, name, gate_type)
SELECT gen_random_uuid(), h.id, h.name || ' Main Gate', 'MAIN'
FROM hostels h
WHERE NOT EXISTS (
    SELECT 1 FROM hostel_gates g WHERE g.hostel_id = h.id
);

INSERT INTO rfid_readers (reader_id, gate_id, direction, status)
SELECT DISTINCT ON (h.id)
       'READER-' || UPPER(REPLACE(h.code, ' ', '_')) || '-IN', g.id, 'IN', 'ONLINE'
FROM hostel_gates g
JOIN hostels h ON h.id = g.hostel_id
WHERE h.code IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM rfid_readers r WHERE r.reader_id = 'READER-' || UPPER(REPLACE(h.code, ' ', '_')) || '-IN'
)
ORDER BY h.id, g.id;

INSERT INTO rfid_readers (reader_id, gate_id, direction, status)
SELECT DISTINCT ON (h.id)
       'READER-' || UPPER(REPLACE(h.code, ' ', '_')) || '-OUT', g.id, 'OUT', 'ONLINE'
FROM hostel_gates g
JOIN hostels h ON h.id = g.hostel_id
WHERE h.code IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM rfid_readers r WHERE r.reader_id = 'READER-' || UPPER(REPLACE(h.code, ' ', '_')) || '-OUT'
)
ORDER BY h.id, g.id;
