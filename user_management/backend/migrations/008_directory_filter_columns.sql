-- ============================================================
-- Migration 008: Ensure directory filter columns exist
-- ============================================================

-- Migration 007 can be skipped or rolled back on databases created
-- before the department school field was introduced. Keep this migration
-- focused and idempotent so directory queries remain compatible.
ALTER TABLE departments ADD COLUMN IF NOT EXISTS school TEXT;
-- Backfill schools for the standard onboarding department catalogue when
-- the department rows already exist but have no school assigned.
UPDATE departments
SET school = CASE name
    WHEN 'Department of Computer Sciences' THEN 'School of Technology, Communication and Management'
    WHEN 'Department of Tourism Management' THEN 'School of Technology, Communication and Management'
    WHEN 'Department of Journalism & Mass Communication' THEN 'School of Technology, Communication and Management'
    WHEN 'Department of Animation and Visual Effects' THEN 'School of Technology, Communication and Management'
    WHEN 'Department of Rural Management' THEN 'School of Biological Sciences and Sustainability'
    WHEN 'Department of Environmental Science' THEN 'School of Biological Sciences and Sustainability'
    WHEN 'Department of Education' THEN 'School of Education, Humanities and Social Sciences'
    WHEN 'Department of Psychology' THEN 'School of Education, Humanities and Social Sciences'
    WHEN 'Department of English' THEN 'School of Education, Humanities and Social Sciences'
    WHEN 'Department of Sanskrit and Vedic Studies' THEN 'School of Indology'
    WHEN 'Department of Hindi' THEN 'School of Indology'
    WHEN 'Department of History and Indian Culture' THEN 'School of Indology'
    WHEN 'Department of Indian Classical Music' THEN 'School of Indology'
    WHEN 'Department of Oriental Studies, Religious Studies & Philosophy' THEN 'School of Indology'
    WHEN 'Department of Yogic Sciences and Human Consciousness' THEN 'School of Indology'
    ELSE school
END
WHERE school IS NULL;
