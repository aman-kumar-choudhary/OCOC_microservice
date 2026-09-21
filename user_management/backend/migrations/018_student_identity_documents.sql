-- Student nationality and government identity proof captured at onboarding.
ALTER TABLE student_profiles
    ADD COLUMN IF NOT EXISTS nationality TEXT,
    ADD COLUMN IF NOT EXISTS gov_id_type TEXT,
    ADD COLUMN IF NOT EXISTS gov_id_number TEXT;

CREATE INDEX IF NOT EXISTS idx_student_profiles_nationality
    ON student_profiles(nationality);
