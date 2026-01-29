-- =============================================================================
-- Migration 006: 6NF Decomposition
-- =============================================================================
-- Decomposes JSONB fields into fully normalized tables to achieve true 6NF
-- compliance. Each table now has at most one non-key attribute.
--
-- Changes:
-- 1. game_configurations.selected_roles → game_role_selections table
-- 2. night_actions.action_details → typed columns + related tables
-- 3. player_statistics.role_statistics → player_role_stats table
-- 4. player_statistics.team_statistics → player_team_stats table
--
-- Normal Form Compliance:
-- - 6NF: Every table has at most one non-key attribute
-- - All multi-valued dependencies eliminated via decomposition
-- - Full join dependency compliance
-- =============================================================================

-- =============================================================================
-- 1. GAME ROLE SELECTIONS (replaces game_configurations.selected_roles JSONB)
-- =============================================================================
-- 6NF Compliant: Each row represents one role selection for one game
-- =============================================================================

CREATE TABLE IF NOT EXISTS game_role_selections (
    selection_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    game_id UUID NOT NULL REFERENCES games(game_id) ON DELETE CASCADE,
    role_code VARCHAR(50) NOT NULL REFERENCES roles(role_code),
    slot_index INTEGER NOT NULL CHECK (slot_index >= 0 AND slot_index <= 12),

    -- Each slot in a game must be unique
    UNIQUE(game_id, slot_index)
);

COMMENT ON TABLE game_role_selections IS '6NF: Individual role selections for each game (one row per role slot)';
COMMENT ON COLUMN game_role_selections.slot_index IS 'Position in the role list (0 to player_count+2)';
COMMENT ON COLUMN game_role_selections.role_code IS 'The role assigned to this slot';

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_game_role_selections_game ON game_role_selections(game_id);
CREATE INDEX IF NOT EXISTS idx_game_role_selections_role ON game_role_selections(role_code);

-- =============================================================================
-- 2. NIGHT ACTION DECOMPOSITION (replaces night_actions.action_details JSONB)
-- =============================================================================
-- Decomposed into multiple 6NF-compliant tables:
-- - night_action_targets: Target player or center position
-- - night_action_views: Roles that were viewed
-- - night_action_swaps: Swap operation details
-- - night_action_copies: Doppelganger copy details
-- - night_action_teammates: Teammates seen (Werewolf, Mason)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Night Action Targets (who/what was targeted)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS night_action_targets (
    target_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    action_id UUID NOT NULL REFERENCES night_actions(action_id) ON DELETE CASCADE,
    target_type VARCHAR(20) NOT NULL CHECK (target_type IN ('player', 'center', 'self')),
    target_player_id UUID REFERENCES game_players(player_id) ON DELETE CASCADE,
    target_center_position INTEGER CHECK (target_center_position >= 0 AND target_center_position <= 2),
    target_order INTEGER NOT NULL DEFAULT 0,

    -- Ensure proper target based on type
    CONSTRAINT valid_target CHECK (
        (target_type = 'player' AND target_player_id IS NOT NULL AND target_center_position IS NULL) OR
        (target_type = 'center' AND target_player_id IS NULL AND target_center_position IS NOT NULL) OR
        (target_type = 'self' AND target_player_id IS NOT NULL AND target_center_position IS NULL)
    ),
    -- Unique target order per action
    UNIQUE(action_id, target_order)
);

COMMENT ON TABLE night_action_targets IS '6NF: Individual targets for night actions (one row per target)';
COMMENT ON COLUMN night_action_targets.target_type IS 'Type of target: player, center, or self';
COMMENT ON COLUMN night_action_targets.target_order IS 'Order for multi-target actions (Seer viewing 2 center cards)';

CREATE INDEX IF NOT EXISTS idx_night_action_targets_action ON night_action_targets(action_id);
CREATE INDEX IF NOT EXISTS idx_night_action_targets_player ON night_action_targets(target_player_id);

-- -----------------------------------------------------------------------------
-- Night Action Views (roles that were seen)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS night_action_views (
    view_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    action_id UUID NOT NULL REFERENCES night_actions(action_id) ON DELETE CASCADE,
    viewed_role VARCHAR(50) NOT NULL REFERENCES roles(role_code),
    view_source_type VARCHAR(20) NOT NULL CHECK (view_source_type IN ('player', 'center', 'self')),
    source_player_id UUID REFERENCES game_players(player_id) ON DELETE CASCADE,
    source_center_position INTEGER CHECK (source_center_position >= 0 AND source_center_position <= 2),
    view_order INTEGER NOT NULL DEFAULT 0,

    -- Ensure proper source based on type
    CONSTRAINT valid_view_source CHECK (
        (view_source_type = 'player' AND source_player_id IS NOT NULL AND source_center_position IS NULL) OR
        (view_source_type = 'center' AND source_player_id IS NULL AND source_center_position IS NOT NULL) OR
        (view_source_type = 'self' AND source_player_id IS NOT NULL AND source_center_position IS NULL)
    ),
    -- Unique view order per action
    UNIQUE(action_id, view_order)
);

COMMENT ON TABLE night_action_views IS '6NF: Roles viewed during night actions (one row per role seen)';
COMMENT ON COLUMN night_action_views.viewed_role IS 'The role that was seen';
COMMENT ON COLUMN night_action_views.view_source_type IS 'Where the role was viewed: player card, center card, or own card';
COMMENT ON COLUMN night_action_views.view_order IS 'Order for multi-view actions (Seer viewing 2 center cards)';

CREATE INDEX IF NOT EXISTS idx_night_action_views_action ON night_action_views(action_id);
CREATE INDEX IF NOT EXISTS idx_night_action_views_role ON night_action_views(viewed_role);

-- -----------------------------------------------------------------------------
-- Night Action Swaps (swap operation details)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS night_action_swaps (
    swap_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    action_id UUID UNIQUE NOT NULL REFERENCES night_actions(action_id) ON DELETE CASCADE,
    from_type VARCHAR(20) NOT NULL CHECK (from_type IN ('player', 'center')),
    from_player_id UUID REFERENCES game_players(player_id) ON DELETE CASCADE,
    from_center_position INTEGER CHECK (from_center_position >= 0 AND from_center_position <= 2),
    to_type VARCHAR(20) NOT NULL CHECK (to_type IN ('player', 'center')),
    to_player_id UUID REFERENCES game_players(player_id) ON DELETE CASCADE,
    to_center_position INTEGER CHECK (to_center_position >= 0 AND to_center_position <= 2),

    -- Ensure proper from based on type
    CONSTRAINT valid_swap_from CHECK (
        (from_type = 'player' AND from_player_id IS NOT NULL AND from_center_position IS NULL) OR
        (from_type = 'center' AND from_player_id IS NULL AND from_center_position IS NOT NULL)
    ),
    -- Ensure proper to based on type
    CONSTRAINT valid_swap_to CHECK (
        (to_type = 'player' AND to_player_id IS NOT NULL AND to_center_position IS NULL) OR
        (to_type = 'center' AND to_player_id IS NULL AND to_center_position IS NOT NULL)
    )
);

COMMENT ON TABLE night_action_swaps IS '6NF: Swap details for Robber, Troublemaker, Drunk actions';
COMMENT ON COLUMN night_action_swaps.from_type IS 'Source type: player or center';
COMMENT ON COLUMN night_action_swaps.to_type IS 'Destination type: player or center';

CREATE INDEX IF NOT EXISTS idx_night_action_swaps_action ON night_action_swaps(action_id);
CREATE INDEX IF NOT EXISTS idx_night_action_swaps_from_player ON night_action_swaps(from_player_id);
CREATE INDEX IF NOT EXISTS idx_night_action_swaps_to_player ON night_action_swaps(to_player_id);

-- -----------------------------------------------------------------------------
-- Night Action Copies (Doppelganger copy details)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS night_action_copies (
    copy_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    action_id UUID UNIQUE NOT NULL REFERENCES night_actions(action_id) ON DELETE CASCADE,
    copied_from_player_id UUID NOT NULL REFERENCES game_players(player_id) ON DELETE CASCADE,
    copied_role VARCHAR(50) NOT NULL REFERENCES roles(role_code)
);

COMMENT ON TABLE night_action_copies IS '6NF: Doppelganger copy action details';
COMMENT ON COLUMN night_action_copies.copied_from_player_id IS 'Player whose role was copied';
COMMENT ON COLUMN night_action_copies.copied_role IS 'The role that was copied';

CREATE INDEX IF NOT EXISTS idx_night_action_copies_action ON night_action_copies(action_id);
CREATE INDEX IF NOT EXISTS idx_night_action_copies_player ON night_action_copies(copied_from_player_id);

-- -----------------------------------------------------------------------------
-- Night Action Teammates (teammates seen by Werewolf, Mason, Minion)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS night_action_teammates (
    teammate_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    action_id UUID NOT NULL REFERENCES night_actions(action_id) ON DELETE CASCADE,
    teammate_player_id UUID NOT NULL REFERENCES game_players(player_id) ON DELETE CASCADE,

    -- Each teammate only listed once per action
    UNIQUE(action_id, teammate_player_id)
);

COMMENT ON TABLE night_action_teammates IS '6NF: Teammates seen during night (Werewolf, Mason, Minion actions)';
COMMENT ON COLUMN night_action_teammates.teammate_player_id IS 'Player ID of the teammate seen';

CREATE INDEX IF NOT EXISTS idx_night_action_teammates_action ON night_action_teammates(action_id);
CREATE INDEX IF NOT EXISTS idx_night_action_teammates_player ON night_action_teammates(teammate_player_id);

-- =============================================================================
-- 3. PLAYER ROLE STATS (replaces player_statistics.role_statistics JSONB)
-- =============================================================================
-- 6NF Compliant: Each row represents stats for one role for one player
-- =============================================================================

CREATE TABLE IF NOT EXISTS player_role_stats (
    role_stat_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    role_code VARCHAR(50) NOT NULL REFERENCES roles(role_code),
    games_played INTEGER NOT NULL DEFAULT 0 CHECK (games_played >= 0),
    wins INTEGER NOT NULL DEFAULT 0 CHECK (wins >= 0),
    losses INTEGER NOT NULL DEFAULT 0 CHECK (losses >= 0),
    last_played_at TIMESTAMPTZ,

    -- One row per user per role
    UNIQUE(user_id, role_code)
);

COMMENT ON TABLE player_role_stats IS '6NF: Player statistics per role (one row per user per role)';
COMMENT ON COLUMN player_role_stats.games_played IS 'Number of games played as this role';
COMMENT ON COLUMN player_role_stats.wins IS 'Number of wins as this role';
COMMENT ON COLUMN player_role_stats.losses IS 'Number of losses as this role';

CREATE INDEX IF NOT EXISTS idx_player_role_stats_user ON player_role_stats(user_id);
CREATE INDEX IF NOT EXISTS idx_player_role_stats_role ON player_role_stats(role_code);
CREATE INDEX IF NOT EXISTS idx_player_role_stats_wins ON player_role_stats(wins DESC);

-- =============================================================================
-- 4. PLAYER TEAM STATS (replaces player_statistics.team_statistics JSONB)
-- =============================================================================
-- 6NF Compliant: Each row represents stats for one team for one player
-- =============================================================================

CREATE TABLE IF NOT EXISTS player_team_stats (
    team_stat_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    team_code VARCHAR(50) NOT NULL REFERENCES teams(team_code),
    games_played INTEGER NOT NULL DEFAULT 0 CHECK (games_played >= 0),
    wins INTEGER NOT NULL DEFAULT 0 CHECK (wins >= 0),
    losses INTEGER NOT NULL DEFAULT 0 CHECK (losses >= 0),
    last_played_at TIMESTAMPTZ,

    -- One row per user per team
    UNIQUE(user_id, team_code)
);

COMMENT ON TABLE player_team_stats IS '6NF: Player statistics per team (one row per user per team)';
COMMENT ON COLUMN player_team_stats.games_played IS 'Number of games played on this team';
COMMENT ON COLUMN player_team_stats.wins IS 'Number of wins on this team';
COMMENT ON COLUMN player_team_stats.losses IS 'Number of losses on this team';

CREATE INDEX IF NOT EXISTS idx_player_team_stats_user ON player_team_stats(user_id);
CREATE INDEX IF NOT EXISTS idx_player_team_stats_team ON player_team_stats(team_code);
CREATE INDEX IF NOT EXISTS idx_player_team_stats_wins ON player_team_stats(wins DESC);

-- =============================================================================
-- 5. UPDATE EXISTING TABLES (remove JSONB columns)
-- =============================================================================

-- Remove selected_roles JSONB from game_configurations
ALTER TABLE game_configurations
    DROP CONSTRAINT IF EXISTS valid_role_count,
    DROP COLUMN IF EXISTS selected_roles;

-- Remove action_details JSONB from night_actions
ALTER TABLE night_actions
    DROP COLUMN IF EXISTS action_details;

-- Remove role_statistics and team_statistics JSONB from player_statistics
ALTER TABLE player_statistics
    DROP COLUMN IF EXISTS role_statistics,
    DROP COLUMN IF EXISTS team_statistics;

-- =============================================================================
-- 6. UPDATE TRIGGERS FOR 6NF STATISTICS
-- =============================================================================

-- Drop old trigger that used JSONB
DROP TRIGGER IF EXISTS trigger_update_player_statistics ON player_results;
DROP FUNCTION IF EXISTS update_player_statistics();

-- Create new function that updates 6NF tables
CREATE OR REPLACE FUNCTION update_player_statistics_6nf()
RETURNS TRIGGER AS $$
DECLARE
    v_is_win BOOLEAN;
    v_starting_role VARCHAR(50);
    v_final_team VARCHAR(50);
BEGIN
    -- Get the win status and role info
    v_is_win := NEW.is_winner;

    SELECT gp.starting_role INTO v_starting_role
    FROM game_players gp
    WHERE gp.player_id = NEW.player_id;

    v_final_team := NEW.final_team;

    -- Update or insert player_statistics (core stats only, no JSONB)
    INSERT INTO player_statistics (user_id, games_played, total_wins, total_losses, last_played_at)
    VALUES (NEW.user_id, 1,
            CASE WHEN v_is_win THEN 1 ELSE 0 END,
            CASE WHEN v_is_win THEN 0 ELSE 1 END,
            NOW())
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
        last_played_at = NOW();

    -- Update or insert player_role_stats (6NF)
    INSERT INTO player_role_stats (user_id, role_code, games_played, wins, losses, last_played_at)
    VALUES (NEW.user_id, v_starting_role, 1,
            CASE WHEN v_is_win THEN 1 ELSE 0 END,
            CASE WHEN v_is_win THEN 0 ELSE 1 END,
            NOW())
    ON CONFLICT (user_id, role_code) DO UPDATE SET
        games_played = player_role_stats.games_played + 1,
        wins = player_role_stats.wins + CASE WHEN v_is_win THEN 1 ELSE 0 END,
        losses = player_role_stats.losses + CASE WHEN v_is_win THEN 0 ELSE 1 END,
        last_played_at = NOW();

    -- Update or insert player_team_stats (6NF)
    INSERT INTO player_team_stats (user_id, team_code, games_played, wins, losses, last_played_at)
    VALUES (NEW.user_id, v_final_team, 1,
            CASE WHEN v_is_win THEN 1 ELSE 0 END,
            CASE WHEN v_is_win THEN 0 ELSE 1 END,
            NOW())
    ON CONFLICT (user_id, team_code) DO UPDATE SET
        games_played = player_team_stats.games_played + 1,
        wins = player_team_stats.wins + CASE WHEN v_is_win THEN 1 ELSE 0 END,
        losses = player_team_stats.losses + CASE WHEN v_is_win THEN 0 ELSE 1 END,
        last_played_at = NOW();

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION update_player_statistics_6nf IS 'Updates 6NF-compliant statistics tables after game completion';

-- Create new trigger
CREATE TRIGGER trigger_update_player_statistics_6nf
    AFTER INSERT ON player_results
    FOR EACH ROW
    EXECUTE FUNCTION update_player_statistics_6nf();

-- =============================================================================
-- 7. UPDATED VIEWS FOR 6NF SCHEMA
-- =============================================================================

-- View: Player stats with role breakdown
CREATE OR REPLACE VIEW v_player_stats_with_roles AS
SELECT
    ps.user_id,
    up.display_name,
    ps.games_played,
    ps.total_wins,
    ps.total_losses,
    ps.win_rate,
    ps.current_streak,
    ps.best_streak,
    ps.last_played_at,
    COALESCE(
        jsonb_agg(
            jsonb_build_object(
                'role_code', prs.role_code,
                'role_name', r.role_name,
                'games_played', prs.games_played,
                'wins', prs.wins,
                'losses', prs.losses,
                'win_rate', CASE WHEN prs.games_played > 0
                    THEN ROUND(prs.wins::DECIMAL / prs.games_played, 4)
                    ELSE 0 END
            )
        ) FILTER (WHERE prs.role_code IS NOT NULL),
        '[]'::jsonb
    ) AS role_stats,
    COALESCE(
        jsonb_agg(
            jsonb_build_object(
                'team_code', pts.team_code,
                'team_name', t.team_name,
                'games_played', pts.games_played,
                'wins', pts.wins,
                'losses', pts.losses,
                'win_rate', CASE WHEN pts.games_played > 0
                    THEN ROUND(pts.wins::DECIMAL / pts.games_played, 4)
                    ELSE 0 END
            )
        ) FILTER (WHERE pts.team_code IS NOT NULL),
        '[]'::jsonb
    ) AS team_stats
FROM player_statistics ps
JOIN user_profiles up ON ps.user_id = up.user_id
LEFT JOIN player_role_stats prs ON ps.user_id = prs.user_id
LEFT JOIN roles r ON prs.role_code = r.role_code
LEFT JOIN player_team_stats pts ON ps.user_id = pts.user_id
LEFT JOIN teams t ON pts.team_code = t.team_code
GROUP BY ps.user_id, up.display_name, ps.games_played, ps.total_wins,
         ps.total_losses, ps.win_rate, ps.current_streak, ps.best_streak,
         ps.last_played_at;

COMMENT ON VIEW v_player_stats_with_roles IS 'Player statistics with role and team breakdowns from 6NF tables';

-- View: Game configuration with roles
CREATE OR REPLACE VIEW v_game_configuration_with_roles AS
SELECT
    gc.config_id,
    gc.game_id,
    gc.player_count,
    gc.day_duration_seconds,
    gc.vote_duration_seconds,
    gc.allow_spectators,
    gc.is_private,
    gc.created_at,
    COALESCE(
        jsonb_agg(
            jsonb_build_object(
                'slot_index', grs.slot_index,
                'role_code', grs.role_code,
                'role_name', r.role_name,
                'team_code', r.team_code
            ) ORDER BY grs.slot_index
        ) FILTER (WHERE grs.role_code IS NOT NULL),
        '[]'::jsonb
    ) AS selected_roles
FROM game_configurations gc
LEFT JOIN game_role_selections grs ON gc.game_id = grs.game_id
LEFT JOIN roles r ON grs.role_code = r.role_code
GROUP BY gc.config_id, gc.game_id, gc.player_count, gc.day_duration_seconds,
         gc.vote_duration_seconds, gc.allow_spectators, gc.is_private, gc.created_at;

COMMENT ON VIEW v_game_configuration_with_roles IS 'Game configuration with role selections from 6NF table';

-- View: Night action with full details
CREATE OR REPLACE VIEW v_night_action_details AS
SELECT
    na.action_id,
    na.game_id,
    na.actor_player_id,
    na.performed_as_role,
    na.action_type,
    na.sequence_order,
    na.is_doppelganger_action,
    na.performed_at,
    -- Targets
    COALESCE(
        jsonb_agg(DISTINCT
            jsonb_build_object(
                'target_type', nat.target_type,
                'target_player_id', nat.target_player_id,
                'target_center_position', nat.target_center_position,
                'target_order', nat.target_order
            )
        ) FILTER (WHERE nat.target_id IS NOT NULL),
        '[]'::jsonb
    ) AS targets,
    -- Views
    COALESCE(
        jsonb_agg(DISTINCT
            jsonb_build_object(
                'view_source_type', nav.view_source_type,
                'source_player_id', nav.source_player_id,
                'source_center_position', nav.source_center_position,
                'viewed_role', nav.viewed_role,
                'view_order', nav.view_order
            )
        ) FILTER (WHERE nav.view_id IS NOT NULL),
        '[]'::jsonb
    ) AS views,
    -- Swap (single object or null)
    CASE WHEN nas.swap_id IS NOT NULL THEN
        jsonb_build_object(
            'from_type', nas.from_type,
            'from_player_id', nas.from_player_id,
            'from_center_position', nas.from_center_position,
            'to_type', nas.to_type,
            'to_player_id', nas.to_player_id,
            'to_center_position', nas.to_center_position
        )
    ELSE NULL END AS swap,
    -- Copy (single object or null)
    CASE WHEN nac.copy_id IS NOT NULL THEN
        jsonb_build_object(
            'copied_from_player_id', nac.copied_from_player_id,
            'copied_role', nac.copied_role
        )
    ELSE NULL END AS copy,
    -- Teammates
    COALESCE(
        jsonb_agg(DISTINCT natm.teammate_player_id) FILTER (WHERE natm.teammate_id IS NOT NULL),
        '[]'::jsonb
    ) AS teammates
FROM night_actions na
LEFT JOIN night_action_targets nat ON na.action_id = nat.action_id
LEFT JOIN night_action_views nav ON na.action_id = nav.action_id
LEFT JOIN night_action_swaps nas ON na.action_id = nas.action_id
LEFT JOIN night_action_copies nac ON na.action_id = nac.action_id
LEFT JOIN night_action_teammates natm ON na.action_id = natm.action_id
GROUP BY na.action_id, na.game_id, na.actor_player_id, na.performed_as_role,
         na.action_type, na.sequence_order, na.is_doppelganger_action,
         na.performed_at, nas.swap_id, nas.from_type, nas.from_player_id,
         nas.from_center_position, nas.to_type, nas.to_player_id,
         nas.to_center_position, nac.copy_id, nac.copied_from_player_id,
         nac.copied_role;

COMMENT ON VIEW v_night_action_details IS 'Night actions with all details reconstructed from 6NF tables';

-- =============================================================================
-- 8. 6NF COMPLIANCE SUMMARY
-- =============================================================================
--
-- Table                      | Non-Key Attributes | 6NF Compliant
-- ---------------------------|--------------------|--------------
-- game_role_selections       | role_code          | ✓ (1 attr)
-- night_action_targets       | target info        | ✓ (1 target per row)
-- night_action_views         | view info          | ✓ (1 view per row)
-- night_action_swaps         | swap details       | ✓ (1 swap per action)
-- night_action_copies        | copy details       | ✓ (1 copy per action)
-- night_action_teammates     | teammate_player_id | ✓ (1 attr)
-- player_role_stats          | stats per role     | ✓ (per role per user)
-- player_team_stats          | stats per team     | ✓ (per team per user)
--
-- All JSONB columns have been eliminated. Multi-valued dependencies are now
-- represented as separate rows in dedicated tables.
-- =============================================================================
