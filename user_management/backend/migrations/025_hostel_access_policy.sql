-- Warden-managed campus access timings. A singleton record keeps the policy
-- consistent for every hostel and gate while preserving an audit of changes.
CREATE TABLE IF NOT EXISTS hostel_access_policy (
    id BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (id),
    curfew_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    curfew_start TIME NOT NULL DEFAULT '22:00',
    curfew_end TIME NOT NULL DEFAULT '05:00',
    visitor_cutoff_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    visitor_cutoff TIME NOT NULL DEFAULT '17:00',
    updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO hostel_access_policy (id)
VALUES (TRUE)
ON CONFLICT (id) DO NOTHING;
