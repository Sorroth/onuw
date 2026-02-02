-- =============================================================================
-- Migration 008: Add Admin Flag to Users
-- =============================================================================
-- Adds is_admin boolean to users table for administrative privileges.
-- Admin users can access debug features like forcing their role in games.
--
-- Normal Form Compliance:
-- - Follows same pattern as email_verified (core user identity attribute)
-- - Single boolean attribute maintains 6NF compliance
-- - System-controlled, not user-controllable (unlike user_preferences)
-- =============================================================================

ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN users.is_admin IS 'Whether user has administrative privileges (debug mode, etc.)';

-- Create partial index for admin queries (rare but should be fast)
CREATE INDEX IF NOT EXISTS idx_users_is_admin ON users(is_admin) WHERE is_admin = TRUE;
