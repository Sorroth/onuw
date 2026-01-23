/**
 * @fileoverview Player-specific game view for information hiding.
 * @module players/PlayerView
 *
 * @summary Creates filtered game state views for individual players.
 *
 * @description
 * This module provides the critical information hiding layer that prevents cheating:
 * - Players only see information they're allowed to know
 * - Roles, night actions, and votes are hidden until appropriate
 * - Server NEVER sends raw game state to clients
 *
 * @pattern Information Hiding - Core security for multiplayer games
 *
 * @example
 * ```typescript
 * // Server creates view for specific player
 * const view = PlayerViewFactory.createView(game, playerId);
 *
 * // Send to client (safe - no hidden info)
 * socket.send({ type: 'gameState', data: view });
 * ```
 */

import { Game } from '../core/Game';
import { GamePhase, RoleName, Team } from '../enums';
import { PlayerStatement, NightActionResult } from '../types';
import { SerializablePlayerGameView, PublicPlayerInfo, PlayerId } from '../network/protocol';

/**
 * @summary Factory for creating player-specific game views.
 *
 * @description
 * Creates sanitized views of the game state for individual players.
 * This is the ONLY way game state should be sent to clients.
 *
 * @pattern Factory Pattern - Creates appropriate view based on player/phase
 * @pattern Information Hiding - Filters out sensitive information
 *
 * @remarks
 * SECURITY CRITICAL: This class is the primary defense against cheating.
 * Never expose game internals directly to clients.
 *
 * @example
 * ```typescript
 * // During game
 * const view = PlayerViewFactory.createView(game, 'player-1');
 *
 * // View contains only what player-1 is allowed to see:
 * // - Their own role and night info
 * // - Public statements
 * // - Other players' names (but NOT roles)
 * // - Votes only after voting ends
 * ```
 */
export class PlayerViewFactory {
  /**
   * @summary Creates a game view for a specific player.
   *
   * @description
   * Filters the game state to only include information the player
   * is allowed to know based on their role and the current phase.
   *
   * @param {Game} game - The game instance
   * @param {string} playerId - ID of the player requesting the view
   * @param {number} [timeRemaining] - Optional time remaining in current phase
   *
   * @returns {SerializablePlayerGameView} Sanitized view for the player (JSON-safe)
   *
   * @throws {Error} If player is not in the game
   *
   * @example
   * ```typescript
   * const view = PlayerViewFactory.createView(game, 'player-1');
   * // view.myStartingRole = RoleName.SEER (player's own role)
   * // view.players[1].role = undefined (other player's role hidden)
   * ```
   */
  static createView(
    game: Game,
    playerId: string,
    timeRemaining: number | null = null
  ): SerializablePlayerGameView {
    const state = game.getState();
    const playerIndex = state.players.findIndex(p => p.id === playerId);

    if (playerIndex === -1) {
      throw new Error(`Player ${playerId} not found in game`);
    }

    const player = state.players[playerIndex];
    const phase = state.phase;

    // Build public player info (no roles exposed)
    const publicPlayers = this.buildPublicPlayerInfo(game, state.players);

    // Get player's private night info
    const myNightInfo = this.getPlayerNightInfo(game, playerId);

    // Determine what's visible based on phase
    const isResolution = phase === GamePhase.RESOLUTION;
    const isEnded = phase === GamePhase.RESOLUTION && game.isGameEnded();

    return {
      myPlayerId: playerId,
      gameId: game.getId(),
      phase: phase,
      myStartingRole: player.startingRole.name,
      myNightInfo: myNightInfo,
      players: publicPlayers,
      statements: this.getPublicStatements(game),
      votes: isResolution ? this.getVotesAsRecord(game) : null,
      eliminatedPlayers: isResolution ? this.getEliminatedPlayers(game) : null,
      finalRoles: isEnded ? this.getFinalRolesAsRecord(game) : null,
      winningTeams: isEnded ? this.getWinningTeams(game) : null,
      winningPlayers: isEnded ? this.getWinningPlayers(game) : null,
      timeRemaining: timeRemaining
    };
  }

  /**
   * @summary Creates a reconnection view with catch-up information.
   *
   * @description
   * Used when a player reconnects mid-game. Includes all information
   * they should have received up to this point.
   *
   * @param {Game} game - The game instance
   * @param {string} playerId - ID of the reconnecting player
   * @param {NightActionResult[]} missedNightInfo - Night info received while disconnected
   *
   * @returns {SerializablePlayerGameView} View with full catch-up information (JSON-safe)
   */
  static createReconnectionView(
    game: Game,
    playerId: string,
    missedNightInfo: NightActionResult[]
  ): SerializablePlayerGameView {
    const baseView = this.createView(game, playerId);

    // Include any night info that was received during AI takeover
    const combinedNightInfo = [
      ...baseView.myNightInfo,
      ...missedNightInfo.filter(info =>
        !baseView.myNightInfo.some(existing =>
          existing.roleName === info.roleName
        )
      )
    ];

    return {
      ...baseView,
      myNightInfo: combinedNightInfo
    };
  }

  /**
   * @summary Builds public player information.
   *
   * @description
   * Creates an array of player info that is safe to share with all players.
   * Roles are intentionally excluded.
   *
   * @param {Game} game - The game instance
   * @param {IPlayer[]} players - All players in the game
   *
   * @returns {PublicPlayerInfo[]} Array of public player info
   *
   * @private
   */
  private static buildPublicPlayerInfo(
    game: Game,
    players: readonly { id: string; name: string }[]
  ): PublicPlayerInfo[] {
    const statements = game.getStatements();
    const votes = game.getVotes();

    return players.map(player => ({
      id: player.id,
      name: player.name,
      isConnected: game.isPlayerConnected(player.id),
      isAI: game.isPlayerAI(player.id),
      hasSpoken: statements.some(s => s.playerId === player.id),
      hasVoted: votes.has(player.id)
    }));
  }

  /**
   * @summary Gets night action results for a specific player.
   *
   * @param {Game} game - The game instance
   * @param {string} playerId - Player to get info for
   *
   * @returns {NightActionResult[]} Night results for this player only
   *
   * @private
   */
  private static getPlayerNightInfo(
    game: Game,
    playerId: string
  ): NightActionResult[] {
    return game.getPlayerNightInfo(playerId);
  }

  /**
   * @summary Gets all public statements.
   *
   * @param {Game} game - The game instance
   *
   * @returns {PlayerStatement[]} All statements made during day phase
   *
   * @private
   */
  private static getPublicStatements(game: Game): PlayerStatement[] {
    return game.getStatements();
  }

  /**
   * @summary Gets votes as a plain object (for JSON serialization).
   *
   * @param {Game} game - The game instance
   *
   * @returns {Record<PlayerId, PlayerId>} Votes as Record (JSON-safe)
   *
   * @private
   */
  private static getVotesAsRecord(
    game: Game
  ): Record<PlayerId, PlayerId> {
    const votes = game.getVotes();
    const record: Record<PlayerId, PlayerId> = {};
    for (const [voterId, targetId] of votes) {
      record[voterId] = targetId;
    }
    return record;
  }

  /**
   * @summary Gets eliminated player IDs.
   *
   * @param {Game} game - The game instance
   *
   * @returns {string[]} IDs of eliminated players
   *
   * @private
   */
  private static getEliminatedPlayers(game: Game): string[] {
    return game.getEliminatedPlayers();
  }

  /**
   * @summary Gets final roles as a plain object (for JSON serialization).
   *
   * @param {Game} game - The game instance
   *
   * @returns {Record<PlayerId, RoleName>} Final roles as Record (JSON-safe)
   *
   * @private
   */
  private static getFinalRolesAsRecord(
    game: Game
  ): Record<PlayerId, RoleName> {
    const record: Record<PlayerId, RoleName> = {};
    const state = game.getState();

    for (const player of state.players) {
      record[player.id] = player.currentRole.name;
    }

    return record;
  }

  /**
   * @summary Gets winning teams.
   *
   * @param {Game} game - The game instance
   *
   * @returns {Team[]} Winning teams
   *
   * @private
   */
  private static getWinningTeams(game: Game): Team[] {
    const result = game.getResult();
    return result ? [...result.winningTeams] : [];
  }

  /**
   * @summary Gets winning player IDs.
   *
   * @param {Game} game - The game instance
   *
   * @returns {string[]} IDs of winning players
   *
   * @private
   */
  private static getWinningPlayers(game: Game): string[] {
    const result = game.getResult();
    return result ? [...result.winningPlayers] : [];
  }
}

/**
 * @summary Validates that a view doesn't contain forbidden information.
 *
 * @description
 * Debug utility to verify views don't leak sensitive data.
 * Should be used in development/testing.
 *
 * @param {SerializablePlayerGameView} view - View to validate
 * @param {GamePhase} currentPhase - Current game phase
 *
 * @returns {{ valid: boolean; violations: string[] }} Validation result
 */
export function validatePlayerView(
  view: SerializablePlayerGameView,
  currentPhase: GamePhase
): { valid: boolean; violations: string[] } {
  const violations: string[] = [];

  // Check that other players' roles aren't exposed before game end
  if (currentPhase !== GamePhase.RESOLUTION) {
    if (view.finalRoles !== null) {
      violations.push('Final roles exposed before resolution phase');
    }
    if (view.votes !== null && currentPhase !== GamePhase.VOTING) {
      violations.push('Votes exposed before voting phase ends');
    }
    if (view.eliminatedPlayers !== null) {
      violations.push('Eliminated players exposed before resolution');
    }
    if (view.winningTeams !== null) {
      violations.push('Winning teams exposed before game end');
    }
  }

  // Check that player info doesn't contain roles
  for (const player of view.players) {
    if ('role' in player || 'startingRole' in player || 'currentRole' in player) {
      violations.push(`Player ${player.id} has role information exposed`);
    }
  }

  return {
    valid: violations.length === 0,
    violations
  };
}
