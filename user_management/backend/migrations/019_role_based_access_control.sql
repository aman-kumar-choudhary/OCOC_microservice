-- Access Management provisions only these operational roles. Existing
-- administrative roles and permissions are deliberately untouched.
INSERT INTO roles (name, description, user_type)
SELECT value, 'OCOC operational role', NULL
FROM unnest(ARRAY['GUARD', 'WARDEN', 'FACULTY']) AS value
ON CONFLICT (name) DO NOTHING;

CREATE TABLE IF NOT EXISTS warden_hostels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    hostel_id UUID NOT NULL REFERENCES hostels(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, hostel_id)
);

CREATE INDEX IF NOT EXISTS idx_warden_hostels_user_id ON warden_hostels(user_id);
CREATE INDEX IF NOT EXISTS idx_warden_hostels_hostel_id ON warden_hostels(hostel_id);
