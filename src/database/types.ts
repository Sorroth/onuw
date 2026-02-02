/**
 * @fileoverview Database entity types for ONUW.
 * @module database/types
 *
 * @description
 * TypeScript interfaces for all database tables. These types mirror
 * the PostgreSQL schema and are used by repositories for type safety.
 *
 * @pattern 6NF Compliance - All multi-valued attributes decomposed into separate tables
 */

// =============================================================================
// REFERENCE DATA TYPES
// =============================================================================

/**
 * @summary OAuth provider reference data.
 *
 * @description
 * Supported OAuth authentication providers (Google, Discord, GitHub, Twitch).
 */
export interface DbOAuthProvider {
  provider_id: string;
  provider_code: string;
  provider_name: string;
  is_active: boolean;
}

/**
 * @summary Role reference data.
 *
 * @description
 * ONUW role definitions with night wake order.
 */
export interface DbRole {
  role_id: string;
  role_code: string;
  role_name: string;
  team_code: string;
  night_action_order: number | null;
  description: string | null;
}

/**
 * @summary Team reference data.
 *
 * @description
 * Game teams (werewolf, village, tanner).
 */
export interface DbTeam {
  team_id: string;
  team_code: string;
  team_name: string;
}

/**
 * @summary Action type reference data.
 *
 * @description
 * Types of night actions that can be performed.
 */
export interface DbActionType {
  action_type_id: string;
  action_code: string;
  action_name: string;
  description: string | null;
}

/**
 * @summary Game status reference data.
 *
 * @description
 * Possible game states (lobby, night, day, voting, completed, etc.).
 */
export interface DbGameStatus {
  status_id: string;
  status_code: string;
  status_name: string;
}

// =============================================================================
// USER DOMAIN TYPES
// =============================================================================

/**
 * @summary Core user account.
 *
 * @description
 * User identity with email and optional password hash for email/password auth.
 */
export interface DbUser {
  user_id: string;
  email: string;
  password_hash: string | null;
  email_verified: boolean;
  is_admin: boolean;
  created_at: Date;
}

/**
 * @summary User profile information.
 *
 * @description
 * Display name, avatar, and other profile data separated from core identity.
 *
 * @pattern 3NF - Profile data separated from user to avoid transitive dependencies
 */
export interface DbUserProfile {
  profile_id: string;
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  created_at: Date;
  updated_at: Date;
}

/**
 * @summary OAuth provider link.
 *
 * @description
 * Links a user account to an OAuth provider.
 *
 * @pattern 4NF - Multi-valued dependency on providers decomposed to separate table
 */
export interface DbUserOAuthLink {
  oauth_link_id: string;
  user_id: string;
  provider_code: string;
  external_id: string;
  access_token: string | null;
  refresh_token: string | null;
  token_expires_at: Date | null;
  linked_at: Date;
}

/**
 * @summary User authentication session.
 *
 * @description
 * Active session with token hash for authentication validation.
 */
export interface DbSession {
  session_id: string;
  user_id: string;
  token_hash: string;
  ip_address: string | null;
  user_agent: string | null;
  created_at: Date;
  expires_at: Date;
  is_revoked: boolean;
}

/**
 * @summary User preference key-value pair.
 *
 * @description
 * User preferences stored as individual key-value rows.
 * Value is stored as TEXT and parsed by application.
 *
 * @pattern 6NF - One preference per row for maximum flexibility
 */
export interface DbUserPreference {
  preference_id: string;
  user_id: string;
  preference_key: string;
  preference_value: string;
  updated_at: Date;
}

// =============================================================================
// GAME DOMAIN TYPES
// =============================================================================

/**
 * @summary Game session.
 *
 * @description
 * Core game record with room code, host, and status.
 */
export interface DbGame {
  game_id: string;
  room_code: string;
  host_user_id: string;
  status: string;
  created_at: Date;
  started_at: Date | null;
  ended_at: Date | null;
}

/**
 * @summary Game configuration settings.
 *
 * @description
 * Game settings separated from game record.
 * Note: selected_roles moved to game_role_selections table for 6NF compliance.
 *
 * @pattern 6NF - Role selections decomposed to separate table
 */
export interface DbGameConfiguration {
  config_id: string;
  game_id: string;
  player_count: number;
  day_duration_seconds: number;
  vote_duration_seconds: number;
  allow_spectators: boolean;
  is_private: boolean;
}

/**
 * @summary Game role selection (6NF).
 *
 * @description
 * Individual role selection for a game. One row per role slot.
 *
 * @pattern 6NF - One non-key attribute (role_code) per row
 */
export interface DbGameRoleSelection {
  selection_id: string;
  game_id: string;
  role_code: string;
  slot_index: number;
}

/**
 * @summary Game player.
 *
 * @description
 * Player participating in a game with seat position and role information.
 */
export interface DbGamePlayer {
  player_id: string;
  game_id: string;
  user_id: string;
  seat_position: number;
  starting_role: string;
  final_role: string;
  joined_at: Date;
  is_ready: boolean;
  is_connected: boolean;
}

/**
 * @summary Center card.
 *
 * @description
 * One of three center cards in a game.
 */
export interface DbCenterCard {
  center_card_id: string;
  game_id: string;
  position: number;
  starting_role: string;
  final_role: string;
}

// =============================================================================
// GAME EVENT TYPES (6NF Compliant)
// =============================================================================

/**
 * @summary Night action record.
 *
 * @description
 * Core night action data. Details are stored in related 6NF tables:
 * - night_action_targets
 * - night_action_views
 * - night_action_swaps
 * - night_action_copies
 * - night_action_teammates
 *
 * @pattern 6NF - Action details decomposed to separate tables
 */
export interface DbNightAction {
  action_id: string;
  game_id: string;
  actor_player_id: string;
  performed_as_role: string;
  action_type: string;
  sequence_order: number;
  is_doppelganger_action: boolean;
  performed_at: Date;
}

/**
 * @summary Night action target (6NF).
 *
 * @description
 * Target of a night action (player or center card).
 *
 * @pattern 6NF - One target per row
 */
export interface DbNightActionTarget {
  target_id: string;
  action_id: string;
  target_type: 'player' | 'center' | 'self';
  target_player_id: string | null;
  target_center_position: number | null;
  target_order: number;
}

/**
 * @summary Night action view (6NF).
 *
 * @description
 * Role that was viewed during a night action.
 *
 * @pattern 6NF - One view per row
 */
export interface DbNightActionView {
  view_id: string;
  action_id: string;
  viewed_role: string;
  view_source_type: 'player' | 'center' | 'self';
  source_player_id: string | null;
  source_center_position: number | null;
  view_order: number;
}

/**
 * @summary Night action swap (6NF).
 *
 * @description
 * Swap operation details for Robber, Troublemaker, Drunk actions.
 *
 * @pattern 6NF - One swap per action
 */
export interface DbNightActionSwap {
  swap_id: string;
  action_id: string;
  from_type: 'player' | 'center';
  from_player_id: string | null;
  from_center_position: number | null;
  to_type: 'player' | 'center';
  to_player_id: string | null;
  to_center_position: number | null;
}

/**
 * @summary Night action copy (6NF).
 *
 * @description
 * Doppelganger copy action details.
 *
 * @pattern 6NF - One copy per action
 */
export interface DbNightActionCopy {
  copy_id: string;
  action_id: string;
  copied_from_player_id: string;
  copied_role: string;
}

/**
 * @summary Night action teammate (6NF).
 *
 * @description
 * Teammate seen during night (Werewolf, Mason, Minion actions).
 *
 * @pattern 6NF - One teammate per row
 */
export interface DbNightActionTeammate {
  teammate_id: string;
  action_id: string;
  teammate_player_id: string;
}

/**
 * @summary Day phase statement.
 *
 * @description
 * Statement made during day discussion phase.
 */
export interface DbStatement {
  statement_id: string;
  game_id: string;
  speaker_player_id: string;
  statement_text: string;
  statement_type: string;
  sequence_order: number;
  spoken_at: Date;
}

/**
 * @summary Vote record.
 *
 * @description
 * Vote cast during voting phase.
 */
export interface DbVote {
  vote_id: string;
  game_id: string;
  voter_player_id: string;
  target_player_id: string | null;
  is_final: boolean;
  voted_at: Date;
}

// =============================================================================
// RESULT TYPES
// =============================================================================

/**
 * @summary Game result.
 *
 * @description
 * Final game outcome with winning team.
 */
export interface DbGameResult {
  result_id: string;
  game_id: string;
  winning_team: string | null;
  determined_at: Date;
}

/**
 * @summary Player result.
 *
 * @description
 * Individual player outcome for a game.
 */
export interface DbPlayerResult {
  player_result_id: string;
  game_id: string;
  player_id: string;
  final_team: string;
  is_winner: boolean;
  is_eliminated: boolean;
  votes_received: number;
}

/**
 * @summary Win condition evaluation.
 *
 * @description
 * Evaluation of win condition for each team.
 */
export interface DbWinConditionEvaluation {
  evaluation_id: string;
  game_id: string;
  team: string;
  team_won: boolean;
  reason: string;
}

// =============================================================================
// STATISTICS TYPES (6NF Compliant)
// =============================================================================

/**
 * @summary Player statistics.
 *
 * @description
 * Aggregate player statistics across all games.
 * Note: Role and team breakdowns moved to separate tables for 6NF compliance.
 *
 * @pattern 6NF - Role/team stats decomposed to separate tables
 */
export interface DbPlayerStatistics {
  stat_id: string;
  user_id: string;
  games_played: number;
  total_wins: number;
  total_losses: number;
  win_rate: number;
  current_streak: number;
  best_streak: number;
  last_played_at: Date | null;
}

/**
 * @summary Player role statistics (6NF).
 *
 * @description
 * Statistics for a specific role for a specific player.
 *
 * @pattern 6NF - One row per user per role
 */
export interface DbPlayerRoleStats {
  role_stat_id: string;
  user_id: string;
  role_code: string;
  games_played: number;
  wins: number;
  losses: number;
  last_played_at: Date | null;
}

/**
 * @summary Player team statistics (6NF).
 *
 * @description
 * Statistics for a specific team for a specific player.
 *
 * @pattern 6NF - One row per user per team
 */
export interface DbPlayerTeamStats {
  team_stat_id: string;
  user_id: string;
  team_code: string;
  games_played: number;
  wins: number;
  losses: number;
  last_played_at: Date | null;
}

// =============================================================================
// VIEW/DTO TYPES (for API responses)
// =============================================================================

/**
 * @summary User data transfer object.
 *
 * @description
 * User data for API responses (excludes password hash).
 */
export interface UserDto {
  userId: string;
  email: string;
  emailVerified: boolean;
  isAdmin: boolean;
  displayName: string;
  avatarUrl: string | null;
  createdAt: Date;
}

/**
 * @summary Session data transfer object.
 *
 * @description
 * Session data for API responses.
 */
export interface SessionDto {
  sessionId: string;
  userId: string;
  expiresAt: Date;
  createdAt: Date;
  isRevoked: boolean;
}

/**
 * @summary Game data transfer object.
 *
 * @description
 * Game data for API responses.
 */
export interface GameDto {
  gameId: string;
  roomCode: string;
  hostUserId: string;
  status: string;
  createdAt: Date;
  startedAt: Date | null;
  endedAt: Date | null;
}

/**
 * @summary Game summary data transfer object.
 *
 * @description
 * Abbreviated game data for listings.
 */
export interface GameSummaryDto {
  gameId: string;
  roomCode: string;
  status: string;
  playerCount: number;
  winningTeam: string | null;
  createdAt: Date;
  endedAt: Date | null;
}

/**
 * @summary Game replay data transfer object.
 *
 * @description
 * Complete game data for replay functionality.
 */
export interface GameReplayDto {
  gameId: string;
  roomCode: string;
  players: GamePlayerDto[];
  centerCards: CenterCardDto[];
  nightActions: NightActionDto[];
  statements: StatementDto[];
  votes: VoteDto[];
  result: GameResultDto;
}

/**
 * @summary Game player data transfer object.
 *
 * @description
 * Player data for game display.
 */
export interface GamePlayerDto {
  playerId: string;
  userId: string;
  displayName: string;
  seatPosition: number;
  startingRole: string;
  finalRole: string;
}

/**
 * @summary Center card data transfer object.
 *
 * @description
 * Center card data for game display.
 */
export interface CenterCardDto {
  position: number;
  startingRole: string;
  finalRole: string;
}

/**
 * @summary Night action data transfer object.
 *
 * @description
 * Night action data with reconstructed details from 6NF tables.
 */
export interface NightActionDto {
  actorPlayerId: string;
  performedAsRole: string;
  actionType: string;
  sequenceOrder: number;
  isDoppelgangerAction: boolean;
  targets: NightActionTargetDto[];
  views: NightActionViewDto[];
  swap: NightActionSwapDto | null;
  copy: NightActionCopyDto | null;
  teammates: string[];
}

/**
 * @summary Night action target DTO.
 *
 * @description
 * Target information for a night action.
 */
export interface NightActionTargetDto {
  targetType: 'player' | 'center' | 'self';
  targetPlayerId: string | null;
  targetCenterPosition: number | null;
  targetOrder: number;
}

/**
 * @summary Night action view DTO.
 *
 * @description
 * View information for a night action.
 */
export interface NightActionViewDto {
  viewSourceType: 'player' | 'center' | 'self';
  sourcePlayerId: string | null;
  sourceCenterPosition: number | null;
  viewedRole: string;
  viewOrder: number;
}

/**
 * @summary Night action swap DTO.
 *
 * @description
 * Swap operation details.
 */
export interface NightActionSwapDto {
  fromType: 'player' | 'center';
  fromPlayerId: string | null;
  fromCenterPosition: number | null;
  toType: 'player' | 'center';
  toPlayerId: string | null;
  toCenterPosition: number | null;
}

/**
 * @summary Night action copy DTO.
 *
 * @description
 * Doppelganger copy details.
 */
export interface NightActionCopyDto {
  copiedFromPlayerId: string;
  copiedRole: string;
}

/**
 * @summary Statement data transfer object.
 *
 * @description
 * Statement data for game display.
 */
export interface StatementDto {
  speakerPlayerId: string;
  text: string;
  sequenceOrder: number;
  spokenAt: Date;
}

/**
 * @summary Vote data transfer object.
 *
 * @description
 * Vote data for game display.
 */
export interface VoteDto {
  voterPlayerId: string;
  targetPlayerId: string | null;
  votedAt: Date;
}

/**
 * @summary Game result data transfer object.
 *
 * @description
 * Game result data for display.
 */
export interface GameResultDto {
  winningTeam: string | null;
  playerResults: PlayerResultDto[];
  winConditionEvaluations: WinConditionEvaluationDto[];
}

/**
 * @summary Player result data transfer object.
 *
 * @description
 * Individual player result for display.
 */
export interface PlayerResultDto {
  playerId: string;
  team: string;
  isWinner: boolean;
  isEliminated: boolean;
  votesReceived: number;
}

/**
 * @summary Win condition evaluation DTO.
 *
 * @description
 * Win condition evaluation for display.
 */
export interface WinConditionEvaluationDto {
  team: string;
  won: boolean;
  reason: string;
}

/**
 * @summary Leaderboard entry DTO.
 *
 * @description
 * Leaderboard entry for display.
 */
export interface LeaderboardEntryDto {
  rank: number;
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  gamesPlayed: number;
  wins: number;
  winRate: number;
}

/**
 * @summary Player statistics DTO.
 *
 * @description
 * Complete player statistics with role and team breakdowns.
 */
export interface PlayerStatsDto {
  userId: string;
  displayName: string;
  gamesPlayed: number;
  wins: number;
  losses: number;
  winRate: number;
  currentStreak: number;
  bestStreak: number;
  lastPlayedAt: Date | null;
  roleStats: RoleStatsDto[];
  teamStats: TeamStatsDto[];
}

/**
 * @summary Role statistics DTO.
 *
 * @description
 * Statistics for a specific role.
 */
export interface RoleStatsDto {
  roleCode: string;
  roleName: string;
  gamesPlayed: number;
  wins: number;
  losses: number;
  winRate: number;
}

/**
 * @summary Team statistics DTO.
 *
 * @description
 * Statistics for a specific team.
 */
export interface TeamStatsDto {
  teamCode: string;
  teamName: string;
  gamesPlayed: number;
  wins: number;
  losses: number;
  winRate: number;
}
