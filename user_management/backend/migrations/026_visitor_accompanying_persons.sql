-- Migration 026: Add accompanying persons count and details to visitor_profiles
ALTER TABLE visitor_profiles
    ADD COLUMN IF NOT EXISTS accompanying_count INT DEFAULT 0,
    ADD COLUMN IF NOT EXISTS accompanying_details TEXT DEFAULT '';

COMMENT ON COLUMN visitor_profiles.accompanying_count IS 'Number of additional persons accompanying the primary visitor';
COMMENT ON COLUMN visitor_profiles.accompanying_details IS 'Names, relations, or remarks about accompanying persons';
