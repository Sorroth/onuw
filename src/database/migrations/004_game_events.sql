-- =============================================================================
-- Migration 004: Game Events Tables
-- =============================================================================
-- Creates tables for night actions, statements, and votes.
-- These tables store the complete event history for game replay.
--
-- Normal Form Compliance:
-- - 1NF: All columns atomic (no JSONB)
-- - 2NF: No partial dependencies
-- - 3NF: No transitive dependencies
-- - BCNF: All determinants are candidate keys
-- - 6NF: Action details decomposed to separate tables (see migration 006)
-- =============================================================================

-- =============================================================================
-- Night Actions
-- =============================================================================
-- NOTE: Action details are stored in 6NF tables (migration 006):
--   - night_action_targets: Target player/center
--   - night_action_views: Roles seen
--   - night_action_swaps: Swap operations
--   - night_action_copies: Doppelganger copies
--   - night_action_teammates: Teammates seen
-- =============================================================================
CREATE TABLE IF NOT EXISTS night_actions (
    action_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    game_id UUID NOT NULL REFERENCES games(game_id) ON DELETE CASCADE,
    actor_player_id UUID NOT NULL REFERENCES game_players(player_id) ON DELETE CASCADE,
    performed_as_role VARCHAR(50) NOT NULL,
    action_type VARCHAR(50) NOT NULL,
    sequence_order INTEGER NOT NULL,
    is_doppelganger_action BOOLEAN NOT NULL DEFAULT FALSE,
    performed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Unique sequence per game
    UNIQUE(game_id, sequence_order)
);

COMMENT ON TABLE night_actions IS 'Night phase actions for game replay (details in 6NF tables)';
COMMENT ON COLUMN night_actions.performed_as_role IS 'Role the action was performed as (relevant for Doppelganger)';
COMMENT ON COLUMN night_actions.action_type IS 'Type of action (view_player, swap_players, etc.)';
COMMENT ON COLUMN night_actions.sequence_order IS 'Order in which actions occurred';

-- Indexes
CREATE INDEX IF NOT EXISTS idx_night_actions_game ON night_actions(game_id);
CREATE INDEX IF NOT EXISTS idx_night_actions_actor ON night_actions(actor_player_id);
CREATE INDEX IF NOT EXISTS idx_night_actions_sequence ON night_actions(game_id, sequence_order);

-- =============================================================================
-- Statements
-- =============================================================================
CREATE TABLE IF NOT EXISTS statements (
    statement_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    game_id UUID NOT NULL REFERENCES games(game_id) ON DELETE CASCADE,
    speaker_player_id UUID NOT NULL REFERENCES game_players(player_id) ON DELETE CASCADE,
    statement_text TEXT NOT NULL,
    statement_type VARCHAR(50) NOT NULL DEFAULT 'claim',
    sequence_order INTEGER NOT NULL,
    spoken_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT valid_statement_type CHECK (
        statement_type IN ('claim', 'accusation', 'defense', 'question', 'response', 'other')
    )
);

COMMENT ON TABLE statements IS 'Day phase statements for game replay';
COMMENT ON COLUMN statements.statement_type IS 'Type of statement (claim, accusation, defense, etc.)';
COMMENT ON COLUMN statements.sequence_order IS 'Order in which statements were made';

-- Indexes
CREATE INDEX IF NOT EXISTS idx_statements_game ON statements(game_id);
CREATE INDEX IF NOT EXISTS idx_statements_speaker ON statements(speaker_player_id);
CREATE INDEX IF NOT EXISTS idx_statements_sequence ON statements(game_id, sequence_order);

-- =============================================================================
-- Votes
-- =============================================================================
CREATE TABLE IF NOT EXISTS votes (
    vote_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    game_id UUID NOT NULL REFERENCES games(game_id) ON DELETE CASCADE,
    voter_player_id UUID NOT NULL REFERENCES game_players(player_id) ON DELETE CASCADE,
    target_player_id UUID REFERENCES game_players(player_id) ON DELETE CASCADE,
    is_final BOOLEAN NOT NULL DEFAULT FALSE,
    voted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE votes IS 'Voting records for game replay';
COMMENT ON COLUMN votes.target_player_id IS 'NULL if voting for no elimination';
COMMENT ON COLUMN votes.is_final IS 'Whether this is the final vote (vs. preliminary)';

-- Indexes
CREATE INDEX IF NOT EXISTS idx_votes_game ON votes(game_id);
CREATE INDEX IF NOT EXISTS idx_votes_voter ON votes(voter_player_id);
CREATE INDEX IF NOT EXISTS idx_votes_target ON votes(target_player_id);
CREATE INDEX IF NOT EXISTS idx_votes_final ON votes(game_id, is_final) WHERE is_final = TRUE;

-- Unique constraint: one final vote per player per game
CREATE UNIQUE INDEX IF NOT EXISTS idx_votes_final_unique
    ON votes(game_id, voter_player_id)
    WHERE is_final = TRUE;

-- =============================================================================
-- View: Game Timeline
-- =============================================================================
-- NOTE: For full action details, use v_night_action_details from migration 006
-- =============================================================================
CREATE OR REPLACE VIEW v_game_timeline AS
SELECT
    game_id,
    'night_action' AS event_type,
    action_id AS event_id,
    actor_player_id AS player_id,
    sequence_order,
    performed_at AS event_time,
    jsonb_build_object(
        'role', performed_as_role,
        'action', action_type
    ) AS event_data
FROM night_actions

UNION ALL

SELECT
    game_id,
    'statement' AS event_type,
    statement_id AS event_id,
    speaker_player_id AS player_id,
    sequence_order,
    spoken_at AS event_time,
    jsonb_build_object(
        'type', statement_type,
        'text', statement_text
    ) AS event_data
FROM statements

UNION ALL

SELECT
    game_id,
    'vote' AS event_type,
    vote_id AS event_id,
    voter_player_id AS player_id,
    NULL AS sequence_order,
    voted_at AS event_time,
    jsonb_build_object(
        'target', target_player_id,
        'is_final', is_final
    ) AS event_data
FROM votes

ORDER BY game_id, event_time;

COMMENT ON VIEW v_game_timeline IS 'Chronological view of all game events (use v_night_action_details for full action info)';
