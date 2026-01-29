-- =============================================================================
-- Migration 005: Results and Statistics Tables
-- =============================================================================
-- Creates tables for game results, player results, win condition evaluations,
-- and player statistics. These tables support post-game analysis and
-- leaderboards.
--
-- Normal Form Compliance:
-- - 1NF: All columns atomic (statistics as JSONB for flexibility)
-- - 2NF: No partial dependencies
-- - 3NF: No transitive dependencies
-- - BCNF: All determinants are candidate keys
-- =============================================================================

-- =============================================================================
-- Game Results
-- =============================================================================
CREATE TABLE IF NOT EXISTS game_results (
    result_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    game_id UUID UNIQUE NOT NULL REFERENCES games(game_id) ON DELETE CASCADE,
    winning_team VARCHAR(50),
    total_votes INTEGER NOT NULL DEFAULT 0,
    eliminated_count INTEGER NOT NULL DEFAULT 0,
    determined_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE game_results IS 'Final game results';
COMMENT ON COLUMN game_results.winning_team IS 'NULL if no clear winner (rare edge case)';

-- Index
CREATE INDEX IF NOT EXISTS idx_game_results_game ON game_results(game_id);
CREATE INDEX IF NOT EXISTS idx_game_results_winner ON game_results(winning_team);

-- =============================================================================
-- Player Results
-- =============================================================================
-- Normal Form Compliance for AI players:
-- - is_ai is an independent boolean fact (1NF atomic)
-- - user_id is nullable for AI players (no partial dependency - 2NF)
-- - CHECK constraint enforces business rule without transitive dependency (3NF/BCNF)
CREATE TABLE IF NOT EXISTS player_results (
    player_result_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    game_id UUID NOT NULL REFERENCES games(game_id) ON DELETE CASCADE,
    player_id UUID NOT NULL REFERENCES game_players(player_id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(user_id),
    is_ai BOOLEAN NOT NULL DEFAULT FALSE,
    final_team VARCHAR(50) NOT NULL,
    is_winner BOOLEAN NOT NULL,
    is_eliminated BOOLEAN NOT NULL DEFAULT FALSE,
    votes_received INTEGER NOT NULL DEFAULT 0,
    vote_cast_for UUID REFERENCES game_players(player_id),

    -- Business rule: AI players have NULL user_id, human players require user_id
    CONSTRAINT player_results_ai_user_check CHECK (
        (is_ai = TRUE AND user_id IS NULL) OR
        (is_ai = FALSE AND user_id IS NOT NULL)
    ),
    UNIQUE(game_id, player_id)
);

COMMENT ON TABLE player_results IS 'Individual player results for each game';
COMMENT ON COLUMN player_results.final_team IS 'Team based on final card (after swaps)';
COMMENT ON COLUMN player_results.votes_received IS 'Number of votes this player received';
COMMENT ON COLUMN player_results.vote_cast_for IS 'Who this player voted for';

-- Indexes
CREATE INDEX IF NOT EXISTS idx_player_results_game ON player_results(game_id);
CREATE INDEX IF NOT EXISTS idx_player_results_player ON player_results(player_id);
CREATE INDEX IF NOT EXISTS idx_player_results_user ON player_results(user_id);
CREATE INDEX IF NOT EXISTS idx_player_results_winner ON player_results(is_winner) WHERE is_winner = TRUE;

-- =============================================================================
-- Win Condition Evaluations
-- =============================================================================
CREATE TABLE IF NOT EXISTS win_condition_evaluations (
    evaluation_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    game_id UUID NOT NULL REFERENCES games(game_id) ON DELETE CASCADE,
    team VARCHAR(50) NOT NULL,
    team_won BOOLEAN NOT NULL,
    reason TEXT NOT NULL,
    evaluated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(game_id, team)
);

COMMENT ON TABLE win_condition_evaluations IS 'Win condition evaluation for each team';
COMMENT ON COLUMN win_condition_evaluations.reason IS 'Human-readable explanation of why team won/lost';

-- Index
CREATE INDEX IF NOT EXISTS idx_win_evaluations_game ON win_condition_evaluations(game_id);

-- =============================================================================
-- Player Statistics (Aggregate - updated after each game)
-- =============================================================================
-- Normal Form Compliance:
-- - 1NF: All columns atomic (JSONB for role/team stats is atomic container)
-- - 2NF: No partial dependencies
-- - 3NF: No transitive dependencies
-- - 6NF Pattern: role_statistics and team_statistics use JSONB for flexibility
--   (allows adding new roles/teams without schema changes)
CREATE TABLE IF NOT EXISTS player_statistics (
    stat_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID UNIQUE NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    games_played INTEGER NOT NULL DEFAULT 0,
    total_wins INTEGER NOT NULL DEFAULT 0,
    total_losses INTEGER NOT NULL DEFAULT 0,
    win_rate DECIMAL(5,4) GENERATED ALWAYS AS (
        CASE WHEN games_played > 0
             THEN total_wins::DECIMAL / games_played
             ELSE 0
        END
    ) STORED,
    current_streak INTEGER NOT NULL DEFAULT 0,
    best_streak INTEGER NOT NULL DEFAULT 0,
    -- JSONB for per-role statistics: {"WEREWOLF": {"played": 5, "wins": 3, "losses": 2}, ...}
    role_statistics JSONB NOT NULL DEFAULT '{}',
    -- JSONB for per-team statistics: {"village": {"played": 10, "wins": 6, "losses": 4}, ...}
    team_statistics JSONB NOT NULL DEFAULT '{}',
    last_played_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE player_statistics IS 'Aggregate player statistics across all games';
COMMENT ON COLUMN player_statistics.win_rate IS 'Calculated win rate (0.0000 to 1.0000)';
COMMENT ON COLUMN player_statistics.current_streak IS 'Current win streak (negative for loss streak)';

-- Indexes
CREATE INDEX IF NOT EXISTS idx_player_stats_user ON player_statistics(user_id);
CREATE INDEX IF NOT EXISTS idx_player_stats_games ON player_statistics(games_played DESC);
CREATE INDEX IF NOT EXISTS idx_player_stats_wins ON player_statistics(total_wins DESC);
CREATE INDEX IF NOT EXISTS idx_player_stats_rate ON player_statistics(win_rate DESC)
    WHERE games_played >= 10;

-- Auto-update updated_at
CREATE TRIGGER update_player_stats_updated_at
    BEFORE UPDATE ON player_statistics
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- View: Leaderboard
-- =============================================================================
CREATE OR REPLACE VIEW v_leaderboard AS
SELECT
    ROW_NUMBER() OVER (ORDER BY ps.win_rate DESC, ps.total_wins DESC) AS rank,
    ps.user_id,
    up.display_name,
    up.avatar_url,
    ps.games_played,
    ps.total_wins,
    ps.total_losses,
    ps.win_rate,
    ps.best_streak,
    ps.last_played_at
FROM player_statistics ps
JOIN user_profiles up ON ps.user_id = up.user_id
WHERE ps.games_played >= 10  -- Minimum games to appear on leaderboard
ORDER BY ps.win_rate DESC, ps.total_wins DESC;

COMMENT ON VIEW v_leaderboard IS 'Player leaderboard ranked by win rate (min 10 games)';

-- =============================================================================
-- View: Recent Games for User
-- =============================================================================
CREATE OR REPLACE VIEW v_user_recent_games AS
SELECT
    pr.user_id,
    g.game_id,
    g.room_code,
    g.started_at,
    g.ended_at,
    gp.starting_role,
    gp.final_role,
    pr.final_team,
    pr.is_winner,
    pr.is_eliminated,
    gr.winning_team
FROM player_results pr
JOIN games g ON pr.game_id = g.game_id
JOIN game_players gp ON pr.player_id = gp.player_id
JOIN game_results gr ON g.game_id = gr.game_id
ORDER BY g.ended_at DESC;

COMMENT ON VIEW v_user_recent_games IS 'Recent game history for a user';

-- =============================================================================
-- Function: Update Player Statistics After Game
-- =============================================================================
-- Uses JSONB columns for role/team statistics (6NF pattern for flexibility)
-- Skips AI players (they have NULL user_id per business rule)
CREATE OR REPLACE FUNCTION update_player_statistics()
RETURNS TRIGGER AS $$
DECLARE
    v_is_win BOOLEAN;
    v_starting_role VARCHAR(50);
    v_final_team VARCHAR(50);
BEGIN
    -- Skip AI players (they have NULL user_id per business rule)
    IF NEW.user_id IS NULL THEN
        RETURN NEW;
    END IF;

    -- Get the win status and role info
    v_is_win := NEW.is_winner;

    SELECT gp.starting_role INTO v_starting_role
    FROM game_players gp
    WHERE gp.player_id = NEW.player_id;

    v_final_team := NEW.final_team;

    -- Insert or update player statistics with JSONB role/team stats
    INSERT INTO player_statistics (
        user_id, games_played, total_wins, total_losses, last_played_at,
        role_statistics, team_statistics
    )
    VALUES (
        NEW.user_id, 1,
        CASE WHEN v_is_win THEN 1 ELSE 0 END,
        CASE WHEN v_is_win THEN 0 ELSE 1 END,
        NOW(),
        jsonb_build_object(v_starting_role, jsonb_build_object(
            'played', 1,
            'wins', CASE WHEN v_is_win THEN 1 ELSE 0 END,
            'losses', CASE WHEN v_is_win THEN 0 ELSE 1 END
        )),
        jsonb_build_object(v_final_team, jsonb_build_object(
            'played', 1,
            'wins', CASE WHEN v_is_win THEN 1 ELSE 0 END,
            'losses', CASE WHEN v_is_win THEN 0 ELSE 1 END
        ))
    )
    ON CONFLICT (user_id) DO UPDATE SET
        games_played = player_statistics.games_played + 1,
        total_wins = player_statistics.total_wins + CASE WHEN v_is_win THEN 1 ELSE 0 END,
        total_losses = player_statistics.total_losses + CASE WHEN v_is_win THEN 0 ELSE 1 END,
        current_streak = CASE
            WHEN v_is_win AND player_statistics.current_streak >= 0
                THEN player_statistics.current_streak + 1
            WHEN v_is_win
                THEN 1
            WHEN NOT v_is_win AND player_statistics.current_streak <= 0
                THEN player_statistics.current_streak - 1
            ELSE -1
        END,
        best_streak = GREATEST(
            player_statistics.best_streak,
            CASE WHEN v_is_win
                THEN CASE WHEN player_statistics.current_streak >= 0
                    THEN player_statistics.current_streak + 1
                    ELSE 1
                END
                ELSE player_statistics.best_streak
            END
        ),
        last_played_at = NOW(),
        role_statistics = jsonb_set(
            COALESCE(player_statistics.role_statistics, '{}'),
            ARRAY[v_starting_role],
            jsonb_build_object(
                'played', COALESCE((player_statistics.role_statistics->v_starting_role->>'played')::INTEGER, 0) + 1,
                'wins', COALESCE((player_statistics.role_statistics->v_starting_role->>'wins')::INTEGER, 0) + CASE WHEN v_is_win THEN 1 ELSE 0 END,
                'losses', COALESCE((player_statistics.role_statistics->v_starting_role->>'losses')::INTEGER, 0) + CASE WHEN v_is_win THEN 0 ELSE 1 END
            )
        ),
        team_statistics = jsonb_set(
            COALESCE(player_statistics.team_statistics, '{}'),
            ARRAY[v_final_team],
            jsonb_build_object(
                'played', COALESCE((player_statistics.team_statistics->v_final_team->>'played')::INTEGER, 0) + 1,
                'wins', COALESCE((player_statistics.team_statistics->v_final_team->>'wins')::INTEGER, 0) + CASE WHEN v_is_win THEN 1 ELSE 0 END,
                'losses', COALESCE((player_statistics.team_statistics->v_final_team->>'losses')::INTEGER, 0) + CASE WHEN v_is_win THEN 0 ELSE 1 END
            )
        );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update statistics when player result is inserted
CREATE TRIGGER trigger_update_player_statistics
    AFTER INSERT ON player_results
    FOR EACH ROW
    EXECUTE FUNCTION update_player_statistics();

-- =============================================================================
-- Summary View: Full Game Result
-- =============================================================================
CREATE OR REPLACE VIEW v_game_full_result AS
SELECT
    g.game_id,
    g.room_code,
    g.started_at,
    g.ended_at,
    gr.winning_team,
    jsonb_agg(DISTINCT jsonb_build_object(
        'player_id', gp.player_id,
        'user_id', gp.user_id,
        'display_name', up.display_name,
        'starting_role', gp.starting_role,
        'final_role', gp.final_role,
        'final_team', pr.final_team,
        'is_winner', pr.is_winner,
        'is_eliminated', pr.is_eliminated,
        'votes_received', pr.votes_received
    )) AS players,
    jsonb_agg(DISTINCT jsonb_build_object(
        'position', cc.position,
        'starting_role', cc.starting_role,
        'final_role', cc.final_role
    )) AS center_cards,
    (SELECT jsonb_agg(jsonb_build_object(
        'team', wce.team,
        'won', wce.team_won,
        'reason', wce.reason
    )) FROM win_condition_evaluations wce WHERE wce.game_id = g.game_id) AS win_conditions
FROM games g
JOIN game_results gr ON g.game_id = gr.game_id
JOIN game_players gp ON g.game_id = gp.game_id
JOIN player_results pr ON gp.player_id = pr.player_id
JOIN user_profiles up ON gp.user_id = up.user_id
JOIN center_cards cc ON g.game_id = cc.game_id
WHERE g.status = 'completed'
GROUP BY g.game_id, g.room_code, g.started_at, g.ended_at, gr.winning_team;

COMMENT ON VIEW v_game_full_result IS 'Complete game result with all player and card information';
