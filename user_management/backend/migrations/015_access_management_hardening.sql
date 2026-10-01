-- Migration 015: extend the existing access-management module in place.
-- All statements are additive and safe to apply to populated databases.

CREATE TABLE IF NOT EXISTS access_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS access_group_members (
    group_id UUID NOT NULL REFERENCES access_groups(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (group_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_access_group_members_user
    ON access_group_members(user_id);

-- Reuse `locations` as the access-zone catalogue.  Giving hostel zones the
-- same UUID as `hostels.id` preserves the existing student hostel relation
-- and makes hostel/block/zone rules evaluable by the standard engine.
INSERT INTO locations (id, name, type)
SELECT h.id, h.name, 'hostel' FROM hostels h
ON CONFLICT (id) DO NOTHING;

-- A device is the reader selected by the rule builder.  `reader_id` keeps the
-- optional hostel-reader identity when a scan came from that subsystem.
ALTER TABLE access_rules
    ADD COLUMN IF NOT EXISTS device_id UUID REFERENCES devices(id) ON DELETE SET NULL;

ALTER TABLE access_events
    ADD COLUMN IF NOT EXISTS rfid_uid TEXT,
    ADD COLUMN IF NOT EXISTS reader_id UUID REFERENCES rfid_readers(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS device_id UUID REFERENCES devices(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS face_confidence DOUBLE PRECISION;

CREATE INDEX IF NOT EXISTS idx_access_events_location_granted_time
    ON access_events(location_id, event_time DESC) WHERE status = 'GRANTED';
CREATE INDEX IF NOT EXISTS idx_access_events_rfid_uid_time
    ON access_events(rfid_uid, event_time DESC);
