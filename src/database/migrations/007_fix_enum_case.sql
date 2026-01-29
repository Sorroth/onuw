-- =============================================================================
-- Migration 007: Fix Enum Case Mismatch
-- =============================================================================
-- Updates role_code and team_code values to UPPERCASE to match TypeScript enums.
-- The app uses RoleName.INSOMNIAC = 'INSOMNIAC' and Team.VILLAGE = 'VILLAGE'
-- but the original migration used lowercase values.
--
-- This migration:
-- 1. Drops FK constraints temporarily
-- 2. Updates all tables (parent and child)
-- 3. Re-creates FK constraints
--
-- Normal Form Compliance:
-- - No schema changes - only data value updates
-- - Maintains all 1NF through 6NF compliance
-- - FK relationships preserved (same structure, different case)
-- =============================================================================

BEGIN;

-- =============================================================================
-- Step 1: Drop FK constraints that reference roles(role_code) and teams(team_code)
-- =============================================================================

-- Drop FK from roles -> teams
ALTER TABLE roles DROP CONSTRAINT IF EXISTS roles_team_code_fkey;

-- Drop FKs from 6NF tables -> roles (if they exist)
DO $$ BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'game_role_selections') THEN
        ALTER TABLE game_role_selections DROP CONSTRAINT IF EXISTS game_role_selections_role_code_fkey;
    END IF;
END $$;

DO $$ BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'night_action_views') THEN
        ALTER TABLE night_action_views DROP CONSTRAINT IF EXISTS night_action_views_viewed_role_fkey;
    END IF;
END $$;

DO $$ BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'night_action_copies') THEN
        ALTER TABLE night_action_copies DROP CONSTRAINT IF EXISTS night_action_copies_copied_role_fkey;
    END IF;
END $$;

DO $$ BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'player_role_stats') THEN
        ALTER TABLE player_role_stats DROP CONSTRAINT IF EXISTS player_role_stats_role_code_fkey;
    END IF;
END $$;

DO $$ BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'player_team_stats') THEN
        ALTER TABLE player_team_stats DROP CONSTRAINT IF EXISTS player_team_stats_team_code_fkey;
    END IF;
END $$;

-- =============================================================================
-- Step 2: Update teams table (root parent)
-- =============================================================================
UPDATE teams SET team_code = 'WEREWOLF' WHERE team_code = 'werewolf';
UPDATE teams SET team_code = 'VILLAGE' WHERE team_code = 'village';
UPDATE teams SET team_code = 'TANNER' WHERE team_code = 'tanner';

-- =============================================================================
-- Step 3: Update roles table
-- =============================================================================
-- Update team_code references first
UPDATE roles SET team_code = 'WEREWOLF' WHERE team_code = 'werewolf';
UPDATE roles SET team_code = 'VILLAGE' WHERE team_code = 'village';
UPDATE roles SET team_code = 'TANNER' WHERE team_code = 'tanner';

-- Update role_code values
UPDATE roles SET role_code = 'DOPPELGANGER' WHERE role_code = 'doppelganger';
UPDATE roles SET role_code = 'WEREWOLF' WHERE role_code = 'werewolf';
UPDATE roles SET role_code = 'MINION' WHERE role_code = 'minion';
UPDATE roles SET role_code = 'MASON' WHERE role_code = 'mason';
UPDATE roles SET role_code = 'SEER' WHERE role_code = 'seer';
UPDATE roles SET role_code = 'ROBBER' WHERE role_code = 'robber';
UPDATE roles SET role_code = 'TROUBLEMAKER' WHERE role_code = 'troublemaker';
UPDATE roles SET role_code = 'DRUNK' WHERE role_code = 'drunk';
UPDATE roles SET role_code = 'INSOMNIAC' WHERE role_code = 'insomniac';
UPDATE roles SET role_code = 'VILLAGER' WHERE role_code = 'villager';
UPDATE roles SET role_code = 'HUNTER' WHERE role_code = 'hunter';
UPDATE roles SET role_code = 'TANNER' WHERE role_code = 'tanner';

-- =============================================================================
-- Step 4: Update 6NF child tables (from migration 006)
-- =============================================================================

-- Update game_role_selections (6NF: one role per slot per game)
DO $$ BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'game_role_selections') THEN
        UPDATE game_role_selections SET role_code = UPPER(role_code) WHERE role_code != UPPER(role_code);
    END IF;
END $$;

-- Update night_action_views (6NF: one view per action)
DO $$ BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'night_action_views') THEN
        UPDATE night_action_views SET viewed_role = UPPER(viewed_role) WHERE viewed_role != UPPER(viewed_role);
    END IF;
END $$;

-- Update night_action_copies (6NF: one copy per action)
DO $$ BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'night_action_copies') THEN
        UPDATE night_action_copies SET copied_role = UPPER(copied_role) WHERE copied_role != UPPER(copied_role);
    END IF;
END $$;

-- Update player_role_stats (6NF: one row per user per role)
DO $$ BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'player_role_stats') THEN
        UPDATE player_role_stats SET role_code = UPPER(role_code) WHERE role_code != UPPER(role_code);
    END IF;
END $$;

-- Update player_team_stats (6NF: one row per user per team)
DO $$ BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'player_team_stats') THEN
        UPDATE player_team_stats SET team_code = UPPER(team_code) WHERE team_code != UPPER(team_code);
    END IF;
END $$;

-- =============================================================================
-- Step 5: Re-create FK constraints
-- =============================================================================

-- Re-create FK from roles -> teams
ALTER TABLE roles ADD CONSTRAINT roles_team_code_fkey
    FOREIGN KEY (team_code) REFERENCES teams(team_code);

-- Re-create FKs from 6NF tables -> roles (if tables exist)
DO $$ BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'game_role_selections') THEN
        ALTER TABLE game_role_selections ADD CONSTRAINT game_role_selections_role_code_fkey
            FOREIGN KEY (role_code) REFERENCES roles(role_code);
    END IF;
END $$;

DO $$ BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'night_action_views') THEN
        ALTER TABLE night_action_views ADD CONSTRAINT night_action_views_viewed_role_fkey
            FOREIGN KEY (viewed_role) REFERENCES roles(role_code);
    END IF;
END $$;

DO $$ BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'night_action_copies') THEN
        ALTER TABLE night_action_copies ADD CONSTRAINT night_action_copies_copied_role_fkey
            FOREIGN KEY (copied_role) REFERENCES roles(role_code);
    END IF;
END $$;

DO $$ BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'player_role_stats') THEN
        ALTER TABLE player_role_stats ADD CONSTRAINT player_role_stats_role_code_fkey
            FOREIGN KEY (role_code) REFERENCES roles(role_code);
    END IF;
END $$;

DO $$ BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'player_team_stats') THEN
        ALTER TABLE player_team_stats ADD CONSTRAINT player_team_stats_team_code_fkey
            FOREIGN KEY (team_code) REFERENCES teams(team_code);
    END IF;
END $$;

COMMIT;

-- =============================================================================
-- VERIFICATION QUERIES
-- =============================================================================
-- Run these queries to verify the fix:
--
-- SELECT role_code, team_code FROM roles ORDER BY night_action_order NULLS LAST;
-- SELECT team_code FROM teams;
-- SELECT DISTINCT role_code FROM game_role_selections;
-- SELECT DISTINCT role_code FROM player_role_stats;
-- SELECT DISTINCT team_code FROM player_team_stats;

-- =============================================================================
-- 6NF COMPLIANCE VERIFICATION
-- =============================================================================
-- This migration does NOT change any table structure, only data values.
-- All 6NF tables maintain their structure:
--
-- Table                  | Non-Key Attrs | 6NF Status
-- -----------------------|---------------|------------
-- game_role_selections   | role_code     | ✓ Unchanged
-- night_action_views     | viewed_role   | ✓ Unchanged
-- night_action_copies    | copied_role   | ✓ Unchanged
-- player_role_stats      | stats fields  | ✓ Unchanged
-- player_team_stats      | stats fields  | ✓ Unchanged
-- roles (reference)      | 5 attributes  | N/A (lookup)
-- teams (reference)      | 3 attributes  | N/A (lookup)
--
-- Reference tables (roles, teams) are intentionally NOT in 6NF as they are
-- static lookup tables where full decomposition would add complexity without
-- practical benefit - following the "6NF only where practical" guideline.
-- =============================================================================

-- =============================================================================
-- Verification
-- =============================================================================
-- Run these queries to verify the fix:
-- SELECT role_code, team_code FROM roles;
-- SELECT team_code FROM teams;
