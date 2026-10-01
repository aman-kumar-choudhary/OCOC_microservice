-- Migration 017: gate workflow extensions for the existing access module.
ALTER TABLE locations
    ADD COLUMN IF NOT EXISTS requires_two_factor BOOLEAN NOT NULL DEFAULT FALSE;
-- RFID is held briefly for high-security zones until the camera/FRECO result
-- confirms the same person.  No second access system is introduced.
CREATE TABLE IF NOT EXISTS pending_access_verifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
    rfid_uid TEXT NOT NULL,
    reader_id UUID REFERENCES rfid_readers(id) ON DELETE SET NULL,
    device_id UUID REFERENCES devices(id) ON DELETE SET NULL,
    action VARCHAR(20) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    verified_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_pending_access_verifications_lookup
    ON pending_access_verifications(user_id, location_id, expires_at DESC)
    WHERE verified_at IS NULL;

-- Demonstrate 2-SV only on this test high-security area.  Administrators can
-- enable the same flag on any existing location through SQL/admin tooling.
UPDATE locations SET requires_two_factor = TRUE
WHERE name = 'Computer Lab' AND type = 'area';
