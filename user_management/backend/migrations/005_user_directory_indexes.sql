-- ============================================================
-- Migration 005: User directory indexes
-- ============================================================

-- Indexes on the users table.
CREATE INDEX IF NOT EXISTS idx_users_type
    ON users(user_type);
CREATE INDEX IF NOT EXISTS idx_users_status
    ON users(status);
-- Profile indexes are intentionally NOT created here.
-- user_profiles is a VIEW in the current schema.
-- The normalized role-specific profile tables are created
-- in migration 006, which creates their indexes.
