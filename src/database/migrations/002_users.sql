-- =============================================================================
-- Migration 002: User Domain Tables
-- =============================================================================
-- Creates tables for user accounts, profiles, OAuth links, sessions,
-- and preferences. Supports both email/password and OAuth authentication.
--
-- Normal Form Compliance:
-- - 1NF: All columns are atomic
-- - 2NF: No partial dependencies
-- - 3NF: No transitive dependencies (profile separated from user)
-- - BCNF: All determinants are candidate keys
-- - 4NF: No multi-valued dependencies (preferences in separate table)
-- =============================================================================

-- =============================================================================
-- Users (Core Identity)
-- =============================================================================
CREATE TABLE IF NOT EXISTS users (
    user_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255),
    email_verified BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE users IS 'Core user accounts';
COMMENT ON COLUMN users.password_hash IS 'Bcrypt hash of password (NULL for OAuth-only users)';
COMMENT ON COLUMN users.email_verified IS 'Whether email has been verified';

-- Index for email lookups (login)
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);

-- =============================================================================
-- User Profiles
-- =============================================================================
CREATE TABLE IF NOT EXISTS user_profiles (
    profile_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID UNIQUE NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    display_name VARCHAR(100) NOT NULL,
    avatar_url VARCHAR(500),
    bio TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE user_profiles IS 'User profile information (display name, avatar, etc.)';

-- Index for user lookup
CREATE INDEX IF NOT EXISTS idx_user_profiles_user ON user_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_display_name ON user_profiles(display_name);

-- =============================================================================
-- User OAuth Links
-- =============================================================================
CREATE TABLE IF NOT EXISTS user_oauth_links (
    oauth_link_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    provider_code VARCHAR(50) NOT NULL,
    external_id VARCHAR(255) NOT NULL,
    access_token TEXT,
    refresh_token TEXT,
    token_expires_at TIMESTAMPTZ,
    linked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Each user can only have one link per provider
    UNIQUE(user_id, provider_code),
    -- Each external ID per provider must be unique
    UNIQUE(provider_code, external_id)
);

COMMENT ON TABLE user_oauth_links IS 'OAuth provider links for users';
COMMENT ON COLUMN user_oauth_links.external_id IS 'User ID from the OAuth provider';

-- Indexes for OAuth lookups
CREATE INDEX IF NOT EXISTS idx_oauth_links_user ON user_oauth_links(user_id);
CREATE INDEX IF NOT EXISTS idx_oauth_links_provider_external ON user_oauth_links(provider_code, external_id);

-- =============================================================================
-- Sessions
-- =============================================================================
CREATE TABLE IF NOT EXISTS sessions (
    session_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    token_hash VARCHAR(255) UNIQUE NOT NULL,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    last_activity_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    is_revoked BOOLEAN NOT NULL DEFAULT FALSE
);

COMMENT ON TABLE sessions IS 'User authentication sessions';
COMMENT ON COLUMN sessions.token_hash IS 'SHA-256 hash of the session token';

-- Indexes for session management
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at) WHERE is_revoked = FALSE;

-- =============================================================================
-- User Preferences (Key-Value for flexibility - 6NF pattern)
-- =============================================================================
CREATE TABLE IF NOT EXISTS user_preferences (
    preference_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    preference_key VARCHAR(100) NOT NULL,
    preference_value TEXT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(user_id, preference_key)
);

COMMENT ON TABLE user_preferences IS 'User preferences stored as key-value pairs (6NF pattern for flexibility)';
COMMENT ON COLUMN user_preferences.preference_key IS 'Preference name (sound_enabled, theme, language, etc.)';
COMMENT ON COLUMN user_preferences.preference_value IS 'Preference value as text (parsed by application)';

-- Index for preference lookups
CREATE INDEX IF NOT EXISTS idx_preferences_user ON user_preferences(user_id);

-- =============================================================================
-- Email Verification Tokens
-- =============================================================================
CREATE TABLE IF NOT EXISTS email_verification_tokens (
    token_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    token_hash VARCHAR(255) UNIQUE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ
);

COMMENT ON TABLE email_verification_tokens IS 'Tokens for email verification';

CREATE INDEX IF NOT EXISTS idx_email_tokens_user ON email_verification_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_email_tokens_hash ON email_verification_tokens(token_hash);

-- =============================================================================
-- Password Reset Tokens
-- =============================================================================
CREATE TABLE IF NOT EXISTS password_reset_tokens (
    token_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    token_hash VARCHAR(255) UNIQUE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ
);

COMMENT ON TABLE password_reset_tokens IS 'Tokens for password reset requests';

CREATE INDEX IF NOT EXISTS idx_password_reset_user ON password_reset_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_password_reset_hash ON password_reset_tokens(token_hash);

-- =============================================================================
-- Trigger: Auto-update updated_at timestamp
-- =============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON user_profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_oauth_links_updated_at
    BEFORE UPDATE ON user_oauth_links
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_preferences_updated_at
    BEFORE UPDATE ON user_preferences
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
