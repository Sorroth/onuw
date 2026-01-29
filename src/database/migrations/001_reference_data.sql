-- =============================================================================
-- Migration 001: Reference Data Tables
-- =============================================================================
-- Creates lookup/reference tables for OAuth providers, roles, teams,
-- action types, and game statuses. These tables contain static data
-- that defines the game's vocabulary.
--
-- Normal Form Compliance:
-- - 1NF: All columns are atomic
-- - 2NF: No partial dependencies (single-column PKs)
-- - 3NF: No transitive dependencies
-- - BCNF: All determinants are candidate keys
-- =============================================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================================
-- OAuth Providers
-- =============================================================================
CREATE TABLE IF NOT EXISTS oauth_providers (
    provider_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    provider_code VARCHAR(50) UNIQUE NOT NULL,
    provider_name VARCHAR(100) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE oauth_providers IS 'Supported OAuth authentication providers';
COMMENT ON COLUMN oauth_providers.provider_code IS 'Unique code for the provider (google, discord, github, etc.)';

-- Insert default OAuth providers
INSERT INTO oauth_providers (provider_code, provider_name, is_active) VALUES
    ('google', 'Google', TRUE),
    ('discord', 'Discord', TRUE),
    ('github', 'GitHub', TRUE),
    ('twitch', 'Twitch', TRUE)
ON CONFLICT (provider_code) DO NOTHING;

-- =============================================================================
-- Teams
-- =============================================================================
CREATE TABLE IF NOT EXISTS teams (
    team_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    team_code VARCHAR(50) UNIQUE NOT NULL,
    team_name VARCHAR(100) NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE teams IS 'Game teams (werewolf, village, tanner)';

-- Insert default teams
-- NOTE: team_code values MUST match Team enum values exactly (UPPERCASE)
INSERT INTO teams (team_code, team_name, description) VALUES
    ('WEREWOLF', 'Werewolf Team', 'Win if no werewolves are eliminated'),
    ('VILLAGE', 'Village Team', 'Win if at least one werewolf is eliminated'),
    ('TANNER', 'Tanner', 'Win if you are eliminated')
ON CONFLICT (team_code) DO NOTHING;

-- =============================================================================
-- Roles
-- =============================================================================
CREATE TABLE IF NOT EXISTS roles (
    role_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    role_code VARCHAR(50) UNIQUE NOT NULL,
    role_name VARCHAR(100) NOT NULL,
    team_code VARCHAR(50) NOT NULL REFERENCES teams(team_code),
    night_action_order INTEGER,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE roles IS 'ONUW role definitions with night wake order';
COMMENT ON COLUMN roles.night_action_order IS 'Order in which role wakes during night (NULL = no action)';

-- Insert default roles (in night wake order)
-- NOTE: role_code and team_code values MUST match enum values exactly (UPPERCASE)
INSERT INTO roles (role_code, role_name, team_code, night_action_order, description) VALUES
    ('DOPPELGANGER', 'Doppelganger', 'VILLAGE', 1, 'Looks at another player''s card and becomes that role for the rest of the game'),
    ('WEREWOLF', 'Werewolf', 'WEREWOLF', 2, 'Wakes up and looks for other werewolves. If alone, may look at a center card'),
    ('MINION', 'Minion', 'WEREWOLF', 3, 'Sees who the werewolves are, but they do not see the minion'),
    ('MASON', 'Mason', 'VILLAGE', 4, 'Wakes up and looks for other masons'),
    ('SEER', 'Seer', 'VILLAGE', 5, 'May look at another player''s card OR two center cards'),
    ('ROBBER', 'Robber', 'VILLAGE', 6, 'May swap their card with another player''s card and look at their new card'),
    ('TROUBLEMAKER', 'Troublemaker', 'VILLAGE', 7, 'May swap two other players'' cards without looking at them'),
    ('DRUNK', 'Drunk', 'VILLAGE', 8, 'Must swap their card with a center card without looking at it'),
    ('INSOMNIAC', 'Insomniac', 'VILLAGE', 9, 'Looks at their own card at the end of the night phase'),
    ('VILLAGER', 'Villager', 'VILLAGE', NULL, 'No special ability'),
    ('HUNTER', 'Hunter', 'VILLAGE', NULL, 'If the Hunter is eliminated, the player they voted for is also eliminated'),
    ('TANNER', 'Tanner', 'TANNER', NULL, 'Wins if they are eliminated. If the Tanner is eliminated, the werewolves cannot win')
ON CONFLICT (role_code) DO NOTHING;

-- =============================================================================
-- Action Types
-- =============================================================================
CREATE TABLE IF NOT EXISTS action_types (
    action_type_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    action_code VARCHAR(50) UNIQUE NOT NULL,
    action_name VARCHAR(100) NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE action_types IS 'Types of night actions that can be performed';

-- Insert default action types
INSERT INTO action_types (action_code, action_name, description) VALUES
    ('view_player', 'View Player Card', 'Look at another player''s card'),
    ('view_center', 'View Center Cards', 'Look at one or two center cards'),
    ('view_own', 'View Own Card', 'Look at your own card'),
    ('view_teammates', 'View Teammates', 'See who your teammates are'),
    ('swap_self_player', 'Swap Self With Player', 'Exchange your card with another player''s card'),
    ('swap_players', 'Swap Two Players', 'Exchange two other players'' cards'),
    ('swap_self_center', 'Swap Self With Center', 'Exchange your card with a center card'),
    ('copy_role', 'Copy Role', 'Copy another player''s role'),
    ('no_action', 'No Action', 'No action performed or available')
ON CONFLICT (action_code) DO NOTHING;

-- =============================================================================
-- Game Statuses
-- =============================================================================
CREATE TABLE IF NOT EXISTS game_statuses (
    status_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    status_code VARCHAR(50) UNIQUE NOT NULL,
    status_name VARCHAR(100) NOT NULL,
    description TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE game_statuses IS 'Possible game states';

-- Insert default game statuses
INSERT INTO game_statuses (status_code, status_name, description, sort_order) VALUES
    ('lobby', 'In Lobby', 'Waiting for players to join and ready up', 1),
    ('setup', 'Setting Up', 'Game is being initialized, roles being dealt', 2),
    ('night', 'Night Phase', 'Night actions being performed', 3),
    ('day', 'Day Phase', 'Players discussing and making statements', 4),
    ('voting', 'Voting', 'Players voting for elimination', 5),
    ('completed', 'Completed', 'Game has ended with a result', 6),
    ('abandoned', 'Abandoned', 'Game was cancelled or abandoned', 7)
ON CONFLICT (status_code) DO NOTHING;

-- =============================================================================
-- Indexes
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_roles_team ON roles(team_code);
CREATE INDEX IF NOT EXISTS idx_roles_night_order ON roles(night_action_order) WHERE night_action_order IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_game_statuses_sort ON game_statuses(sort_order);
