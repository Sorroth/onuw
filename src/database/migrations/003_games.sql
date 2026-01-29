-- =============================================================================
-- Migration 003: Game Domain Tables
-- =============================================================================
-- Creates tables for games, configurations, players, and center cards.
-- These tables store the structural data for each game session.
--
-- Normal Form Compliance:
-- - 1NF: All columns atomic (selected_roles as JSONB array is atomic container)
-- - 2NF: No partial dependencies
-- - 3NF: Configuration separated from game, no transitive dependencies
-- - BCNF: All determinants are candidate keys
-- - 4NF: No multi-valued dependencies
-- =============================================================================

-- =============================================================================
-- Games
-- =============================================================================
CREATE TABLE IF NOT EXISTS games (
    game_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    room_code VARCHAR(10) NOT NULL,
    host_user_id UUID NOT NULL REFERENCES users(user_id),
    status VARCHAR(50) NOT NULL DEFAULT 'lobby',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,

    -- Room code should be unique while game is active
    CONSTRAINT games_status_check CHECK (status IN ('lobby', 'setup', 'night', 'day', 'voting', 'completed', 'abandoned'))
);

COMMENT ON TABLE games IS 'Game sessions';
COMMENT ON COLUMN games.room_code IS 'Room code for joining (e.g., ABC123)';
COMMENT ON COLUMN games.status IS 'Current game status';

-- Indexes
CREATE INDEX IF NOT EXISTS idx_games_room_code ON games(room_code);
CREATE INDEX IF NOT EXISTS idx_games_host ON games(host_user_id);
CREATE INDEX IF NOT EXISTS idx_games_status ON games(status);
CREATE INDEX IF NOT EXISTS idx_games_created ON games(created_at);

-- Partial unique index: room codes must be unique for active games
CREATE UNIQUE INDEX IF NOT EXISTS idx_games_active_room_code
    ON games(room_code)
    WHERE status NOT IN ('completed', 'abandoned');

-- =============================================================================
-- Game Configurations
-- =============================================================================
CREATE TABLE IF NOT EXISTS game_configurations (
    config_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    game_id UUID UNIQUE NOT NULL REFERENCES games(game_id) ON DELETE CASCADE,
    player_count INTEGER NOT NULL CHECK (player_count >= 3 AND player_count <= 10),
    day_duration_seconds INTEGER NOT NULL DEFAULT 300 CHECK (day_duration_seconds >= 30),
    vote_duration_seconds INTEGER NOT NULL DEFAULT 30 CHECK (vote_duration_seconds >= 10),
    allow_spectators BOOLEAN NOT NULL DEFAULT FALSE,
    is_private BOOLEAN NOT NULL DEFAULT TRUE,
    selected_roles JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Ensure role count = player_count + 3 (for center cards)
    CONSTRAINT valid_role_count CHECK (
        jsonb_array_length(selected_roles) = player_count + 3
    )
);

COMMENT ON TABLE game_configurations IS 'Game configuration settings';
COMMENT ON COLUMN game_configurations.selected_roles IS 'Array of role codes selected for the game';
COMMENT ON COLUMN game_configurations.day_duration_seconds IS 'Duration of day discussion phase in seconds';
COMMENT ON COLUMN game_configurations.vote_duration_seconds IS 'Duration of voting phase in seconds';

-- Index
CREATE INDEX IF NOT EXISTS idx_game_configs_game ON game_configurations(game_id);

-- =============================================================================
-- Game Players
-- =============================================================================
-- Normal Form Compliance for AI players:
-- - is_ai is an independent boolean fact (1NF atomic)
-- - user_id is nullable for AI players (no partial dependency - 2NF)
-- - CHECK constraint enforces business rule without transitive dependency (3NF/BCNF)
-- - No multi-valued dependencies (4NF)
CREATE TABLE IF NOT EXISTS game_players (
    player_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    game_id UUID NOT NULL REFERENCES games(game_id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(user_id),
    is_ai BOOLEAN NOT NULL DEFAULT FALSE,
    seat_position INTEGER NOT NULL CHECK (seat_position >= 0 AND seat_position <= 9),
    starting_role VARCHAR(50) NOT NULL,
    final_role VARCHAR(50) NOT NULL,
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    is_ready BOOLEAN NOT NULL DEFAULT FALSE,
    is_connected BOOLEAN NOT NULL DEFAULT TRUE,
    disconnected_at TIMESTAMPTZ,

    -- Business rule: AI players have NULL user_id, human players require user_id
    CONSTRAINT game_players_ai_user_check CHECK (
        (is_ai = TRUE AND user_id IS NULL) OR
        (is_ai = FALSE AND user_id IS NOT NULL)
    ),
    -- Each human user can only be in a game once (AI players excluded)
    UNIQUE(game_id, user_id),
    -- Each seat position in a game must be unique
    UNIQUE(game_id, seat_position)
);

COMMENT ON TABLE game_players IS 'Players participating in a game';
COMMENT ON COLUMN game_players.starting_role IS 'Role dealt at game start';
COMMENT ON COLUMN game_players.final_role IS 'Role at game end (may differ due to swaps)';

-- Indexes
CREATE INDEX IF NOT EXISTS idx_game_players_game ON game_players(game_id);
CREATE INDEX IF NOT EXISTS idx_game_players_user ON game_players(user_id);
CREATE INDEX IF NOT EXISTS idx_game_players_role ON game_players(starting_role);

-- =============================================================================
-- Center Cards
-- =============================================================================
CREATE TABLE IF NOT EXISTS center_cards (
    center_card_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    game_id UUID NOT NULL REFERENCES games(game_id) ON DELETE CASCADE,
    position INTEGER NOT NULL CHECK (position >= 0 AND position <= 2),
    starting_role VARCHAR(50) NOT NULL,
    final_role VARCHAR(50) NOT NULL,

    -- Each position in a game must be unique
    UNIQUE(game_id, position)
);

COMMENT ON TABLE center_cards IS 'Center cards (3 per game)';
COMMENT ON COLUMN center_cards.position IS 'Position 0, 1, or 2';

-- Index
CREATE INDEX IF NOT EXISTS idx_center_cards_game ON center_cards(game_id);

-- =============================================================================
-- Game Spectators (Optional feature)
-- =============================================================================
CREATE TABLE IF NOT EXISTS game_spectators (
    spectator_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    game_id UUID NOT NULL REFERENCES games(game_id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(user_id),
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(game_id, user_id)
);

COMMENT ON TABLE game_spectators IS 'Users watching a game as spectators';

CREATE INDEX IF NOT EXISTS idx_game_spectators_game ON game_spectators(game_id);

-- =============================================================================
-- View: Active Games
-- =============================================================================
CREATE OR REPLACE VIEW v_active_games AS
SELECT
    g.game_id,
    g.room_code,
    g.host_user_id,
    up.display_name AS host_name,
    g.status,
    gc.player_count AS max_players,
    COUNT(gp.player_id) AS current_players,
    gc.is_private,
    g.created_at
FROM games g
JOIN game_configurations gc ON g.game_id = gc.game_id
JOIN user_profiles up ON g.host_user_id = up.user_id
LEFT JOIN game_players gp ON g.game_id = gp.game_id
WHERE g.status IN ('lobby', 'setup', 'night', 'day', 'voting')
GROUP BY g.game_id, g.room_code, g.host_user_id, up.display_name,
         g.status, gc.player_count, gc.is_private, g.created_at;

COMMENT ON VIEW v_active_games IS 'View of currently active games for lobby listing';
