-- Migration: 009_investigation_views.sql
-- Description: Creates views for easy game investigation and debugging
-- These views flatten the 6NF normalized tables for human-readable queries

-- ============================================================================
-- VIEW: v_game_summary
-- Purpose: Quick overview of all players in a game with their roles and results
-- Usage: SELECT * FROM v_game_summary WHERE room_code = 'XXXXXX';
-- ============================================================================
CREATE OR REPLACE VIEW v_game_summary AS
SELECT
  g.room_code,
  g.game_id,
  g.status,
  gr.winning_team,
  gp.seat_position,
  COALESCE(up.display_name, 'Bot ' || gp.seat_position) as player_name,
  gp.starting_role,
  gp.final_role,
  pr.is_winner,
  pr.is_eliminated,
  pr.votes_received
FROM games g
JOIN game_players gp ON g.game_id = gp.game_id
LEFT JOIN user_profiles up ON gp.user_id = up.user_id
LEFT JOIN game_results gr ON g.game_id = gr.game_id
LEFT JOIN player_results pr ON gp.game_id = pr.game_id AND gp.user_id = pr.user_id
ORDER BY g.created_at DESC, gp.seat_position;

-- ============================================================================
-- VIEW: v_game_votes
-- Purpose: See all final votes in a game
-- Usage: SELECT * FROM v_game_votes WHERE room_code = 'XXXXXX';
-- ============================================================================
CREATE OR REPLACE VIEW v_game_votes AS
SELECT
  g.room_code,
  voter_gp.seat_position as voter_seat,
  COALESCE(voter_up.display_name, 'Bot ' || voter_gp.seat_position) as voter_name,
  target_gp.seat_position as target_seat,
  COALESCE(target_up.display_name, 'Bot ' || target_gp.seat_position) as target_name,
  v.is_final
FROM votes v
JOIN games g ON v.game_id = g.game_id
JOIN game_players voter_gp ON v.voter_player_id = voter_gp.player_id
JOIN game_players target_gp ON v.target_player_id = target_gp.player_id
LEFT JOIN user_profiles voter_up ON voter_gp.user_id = voter_up.user_id
LEFT JOIN user_profiles target_up ON target_gp.user_id = target_up.user_id
WHERE v.is_final = true
ORDER BY voter_gp.seat_position;

-- ============================================================================
-- VIEW: v_game_night_actions
-- Purpose: See all night actions with their effects (copies, swaps, views)
-- Usage: SELECT * FROM v_game_night_actions WHERE room_code = 'XXXXXX';
-- ============================================================================
CREATE OR REPLACE VIEW v_game_night_actions AS
SELECT
  g.room_code,
  na.sequence_order,
  gp.seat_position as actor_seat,
  COALESCE(up.display_name, 'Bot ' || gp.seat_position) as actor_name,
  na.performed_as_role,
  na.action_type,
  na.is_doppelganger_action,
  -- Copy info (Doppelganger)
  nac.copied_role,
  copy_from_gp.seat_position as copied_from_seat,
  -- Swap info (Robber, Troublemaker, Drunk)
  nas.from_type as swap_from_type,
  swap_from_gp.seat_position as swap_from_seat,
  nas.from_center_position as swap_from_center,
  nas.to_type as swap_to_type,
  swap_to_gp.seat_position as swap_to_seat,
  nas.to_center_position as swap_to_center,
  -- View info (Seer, Robber, Insomniac, lone Werewolf)
  (SELECT string_agg(
    CASE
      WHEN nav.source_player_id IS NOT NULL THEN 'Seat ' || vp.seat_position || '=' || nav.viewed_role
      ELSE 'Center ' || nav.source_center_position || '=' || nav.viewed_role
    END, ', '
    ORDER BY nav.view_order
  ) FROM night_action_views nav
    LEFT JOIN game_players vp ON nav.source_player_id = vp.player_id
    WHERE nav.action_id = na.action_id
  ) as viewed_cards,
  -- Teammates seen (Werewolf, Mason, Minion)
  (SELECT string_agg('Seat ' || tp.seat_position, ', ')
   FROM night_action_teammates nat
   JOIN game_players tp ON nat.teammate_player_id = tp.player_id
   WHERE nat.action_id = na.action_id
  ) as teammates_seen
FROM night_actions na
JOIN games g ON na.game_id = g.game_id
JOIN game_players gp ON na.actor_player_id = gp.player_id
LEFT JOIN user_profiles up ON gp.user_id = up.user_id
LEFT JOIN night_action_copies nac ON na.action_id = nac.action_id
LEFT JOIN game_players copy_from_gp ON nac.copied_from_player_id = copy_from_gp.player_id
LEFT JOIN night_action_swaps nas ON na.action_id = nas.action_id
LEFT JOIN game_players swap_from_gp ON nas.from_player_id = swap_from_gp.player_id
LEFT JOIN game_players swap_to_gp ON nas.to_player_id = swap_to_gp.player_id
ORDER BY na.sequence_order;

-- ============================================================================
-- VIEW: v_game_center_cards
-- Purpose: See center cards and any changes
-- Usage: SELECT * FROM v_game_center_cards WHERE room_code = 'XXXXXX';
-- ============================================================================
CREATE OR REPLACE VIEW v_game_center_cards AS
SELECT
  g.room_code,
  cc.position,
  cc.starting_role,
  cc.final_role,
  CASE WHEN cc.starting_role != cc.final_role THEN 'CHANGED' ELSE 'UNCHANGED' END as status
FROM center_cards cc
JOIN games g ON cc.game_id = g.game_id
ORDER BY cc.position;

-- ============================================================================
-- VIEW: v_game_win_conditions
-- Purpose: See why each team won or lost
-- Usage: SELECT * FROM v_game_win_conditions WHERE room_code = 'XXXXXX';
-- ============================================================================
CREATE OR REPLACE VIEW v_game_win_conditions AS
SELECT
  g.room_code,
  wce.team,
  wce.team_won,
  wce.reason,
  wce.evaluated_at
FROM win_condition_evaluations wce
JOIN games g ON wce.game_id = g.game_id
ORDER BY wce.team_won DESC, wce.team;
