/**
 * @fileoverview PlayerView factory for creating player-specific game views.
 * @module views/PlayerView
 *
 * @summary Creates sanitized game views that only contain information a player is allowed to see.
 *
 * @description
 * This module implements the Information Hiding pattern for game security.
 * The server MUST always use PlayerView to create game state for clients,
 * never sending raw Game state which would expose hidden information.
 *
 * @pattern Factory Method - Creates player-specific views
 * @pattern Information Hiding - Prevents cheating by limiting visibility
 *
 * @example
 * ```typescript
 * import { PlayerView } from './views/PlayerView';
 *
 * // Create view for a specific player
 * const view = PlayerView.forPlayer(game, playerId, roomPlayerMap);
 * socket.send({ type: 'gameState', data: view });
 * ```
 */

import { Game } from '../core/Game';
import { GamePhase, RoleName, Team } from '../enums';
import {
  SerializablePlayerGameView,
  PublicPlayerInfo,
  PlayerId
} from '../network/protocol';
import { PlayerStatement, NightActionResult } from '../types';

/**
 * @summary Factory class for creating player-specific game views.
 *
 * @description
 * PlayerView ensures that each player only sees information they are allowed to know:
 * - Their own starting role
 * - Information they learned during their night action
 * - Public statements made by all players
 * - Votes (only after voting phase ends)
 * - Final roles (only after game ends)
 *
 * NEVER included:
 * - Other players' roles (unless learned via night action)
 * - Other players' night info
 * - Center cards (unless Seer viewed them)
 * - Internal game state
 *
 * @pattern Factory Method - Static forPlayer() creates appropriate view
 * @pattern Information Hiding - Sanitizes data before sending to client
 */
export class PlayerView {
  /**
   * @summary Creates a player-specific view of the game state.
   *
   * @description
   * Factory method that creates a SerializablePlayerGameView containing
   * only information the specified player is allowed to see.
   *
   * @param {Game} game - The game instance
   * @param {string} gamePlayerId - The player's ID in the game (e.g., "player-1")
   * @param {string} roomPlayerId - The player's ID in the room (e.g., "player-abc123")
   * @param {Map<string, string>} gameToRoomMap - Maps game player IDs to room player IDs
   * @param {Map<string, { name: string; isAI: boolean; isConnected: boolean }>} playerInfo - Additional player info
   *
   * @returns {SerializablePlayerGameView} Sanitized view for the player
   *
   * @throws {Error} If player is not found in the game
   *
   * @example
   * ```typescript
   * const view = PlayerView.forPlayer(
   *   game,
   *   'player-1',
   *   'player-abc123',
   *   gameToRoomMap,
   *   playerInfoMap
   * );
   * ```
   */
  static forPlayer(
    game: Game,
    gamePlayerId: string,
    roomPlayerId: string,
    gameToRoomMap: Map<string, string>,
    playerInfo: Map<string, { name: string; isAI: boolean; isConnected: boolean }>
  ): SerializablePlayerGameView {
    // Get player's starting role
    const startingRole = game.getPlayerStartingRole(gamePlayerId);
    const phase = game.getPhase();

    // Get player's night info (what they learned during their night action)
    const myNightInfo = PlayerView.getPlayerNightInfo(game, gamePlayerId);

    // Build public player list (no role info!)
    const players = PlayerView.buildPublicPlayerList(
      game,
      gameToRoomMap,
      playerInfo
    );

    // Get public statements
    const statements = PlayerView.getPublicStatements(game);

    // Votes are only visible after voting ends
    const votes = PlayerView.getVisibleVotes(game, gameToRoomMap);

    // End-game info only visible after resolution
    const endGameInfo = PlayerView.getEndGameInfo(game, gamePlayerId, gameToRoomMap);

    return {
      myPlayerId: roomPlayerId,
      gameId: game.getId?.() || 'game',
      phase,
      myStartingRole: startingRole,
      myNightInfo,
      players,
      statements,
      votes: votes,
      eliminatedPlayers: endGameInfo.eliminatedPlayers,
      finalRoles: endGameInfo.finalRoles,
      winningTeams: endGameInfo.winningTeams,
      winningPlayers: endGameInfo.winningPlayers,
      timeRemaining: null, // TODO: Implement timer
      isEliminated: endGameInfo.eliminatedPlayers?.includes(roomPlayerId) ?? false
    };
  }

  /**
   * @summary Gets the player's night action results.
   *
   * @param {Game} game - The game instance
   * @param {string} gamePlayerId - The player's game ID
   *
   * @returns {readonly NightActionResult[]} Array of night action results for this player
   *
   * @private
   */
  private static getPlayerNightInfo(game: Game, gamePlayerId: string): readonly NightActionResult[] {
    // Get night info from the game's audit log or player state
    // This should only return what this specific player learned
    try {
      // Game.getPlayerNightInfo returns the night action result if available
      const nightInfo = (game as unknown as { getPlayerNightInfo?: (id: string) => NightActionResult | null }).getPlayerNightInfo?.(gamePlayerId);
      return nightInfo ? [nightInfo] : [];
    } catch {
      return [];
    }
  }

  /**
   * @summary Builds the public player list without role information.
   *
   * @param {Game} game - The game instance
   * @param {Map<string, string>} gameToRoomMap - Maps game IDs to room IDs
   * @param {Map<string, { name: string; isAI: boolean; isConnected: boolean }>} playerInfo - Player metadata
   *
   * @returns {PublicPlayerInfo[]} Array of public player info
   *
   * @private
   */
  private static buildPublicPlayerList(
    game: Game,
    gameToRoomMap: Map<string, string>,
    playerInfo: Map<string, { name: string; isAI: boolean; isConnected: boolean }>
  ): PublicPlayerInfo[] {
    const players: PublicPlayerInfo[] = [];

    for (const [gameId, roomId] of gameToRoomMap) {
      const info = playerInfo.get(roomId);
      if (info) {
        players.push({
          id: roomId,
          name: info.name,
          isConnected: info.isConnected,
          isAI: info.isAI,
          hasSpoken: false, // TODO: Track from game state
          hasVoted: false   // TODO: Track from game state
        });
      }
    }

    return players;
  }

  /**
   * @summary Gets all public statements made during the day phase.
   *
   * @param {Game} game - The game instance
   *
   * @returns {PlayerStatement[]} Array of public statements
   *
   * @private
   */
  private static getPublicStatements(game: Game): PlayerStatement[] {
    try {
      return game.getStatements?.() || [];
    } catch {
      return [];
    }
  }

  /**
   * @summary Gets votes if they should be visible.
   *
   * @description
   * Votes are only visible after the voting phase ends (during resolution).
   *
   * @param {Game} game - The game instance
   * @param {Map<string, string>} gameToRoomMap - Maps game IDs to room IDs
   *
   * @returns {Record<string, string> | null} Votes record or null if not visible
   *
   * @private
   */
  private static getVisibleVotes(
    game: Game,
    gameToRoomMap: Map<string, string>
  ): Record<string, string> | null {
    const phase = game.getPhase();

    // Only show votes during resolution phase
    if (phase !== GamePhase.RESOLUTION) {
      return null;
    }

    try {
      const votes = game.getVotes?.();
      if (!votes) return null;

      // Convert to room IDs
      const result: Record<string, string> = {};
      for (const [voterId, targetId] of votes) {
        const roomVoterId = gameToRoomMap.get(voterId) || voterId;
        const roomTargetId = gameToRoomMap.get(targetId) || targetId;
        result[roomVoterId] = roomTargetId;
      }
      return result;
    } catch {
      return null;
    }
  }

  /**
   * @summary Gets end-game information if the game has ended.
   *
   * @param {Game} game - The game instance
   * @param {string} gamePlayerId - The player's game ID
   * @param {Map<string, string>} gameToRoomMap - Maps game IDs to room IDs
   *
   * @returns {object} End game info or nulls if game not ended
   *
   * @private
   */
  private static getEndGameInfo(
    game: Game,
    gamePlayerId: string,
    gameToRoomMap: Map<string, string>
  ): {
    eliminatedPlayers: string[] | null;
    finalRoles: Record<string, RoleName> | null;
    winningTeams: Team[] | null;
    winningPlayers: string[] | null;
  } {
    const phase = game.getPhase();

    // Only reveal during resolution phase
    if (phase !== GamePhase.RESOLUTION) {
      return {
        eliminatedPlayers: null,
        finalRoles: null,
        winningTeams: null,
        winningPlayers: null
      };
    }

    try {
      const result = game.getResult?.();
      if (!result) {
        return {
          eliminatedPlayers: null,
          finalRoles: null,
          winningTeams: null,
          winningPlayers: null
        };
      }

      // Convert to room IDs
      const eliminatedPlayers = result.eliminatedPlayers.map(
        id => gameToRoomMap.get(id) || id
      );

      const finalRoles: Record<string, RoleName> = {};
      for (const [gameId, role] of result.finalRoles) {
        const roomId = gameToRoomMap.get(gameId) || gameId;
        finalRoles[roomId] = role;
      }

      const winningPlayers = result.winningPlayers.map(
        id => gameToRoomMap.get(id) || id
      );

      return {
        eliminatedPlayers,
        finalRoles,
        winningTeams: [...result.winningTeams],
        winningPlayers
      };
    } catch {
      return {
        eliminatedPlayers: null,
        finalRoles: null,
        winningTeams: null,
        winningPlayers: null
      };
    }
  }

  /**
   * @summary Creates a minimal view for game start.
   *
   * @description
   * Creates a view with only essential information for game start:
   * - Player's starting role
   * - List of other players (no roles)
   * - Game phase (NIGHT)
   *
   * @param {string} roomPlayerId - The player's room ID
   * @param {string} gameId - The game/room code
   * @param {RoleName} startingRole - The player's dealt role
   * @param {PublicPlayerInfo[]} players - Public player list
   *
   * @returns {SerializablePlayerGameView} Minimal game start view
   */
  static forGameStart(
    roomPlayerId: string,
    gameId: string,
    startingRole: RoleName,
    players: PublicPlayerInfo[]
  ): SerializablePlayerGameView {
    return {
      myPlayerId: roomPlayerId,
      gameId,
      phase: GamePhase.NIGHT,
      myStartingRole: startingRole,
      myNightInfo: [],
      players,
      statements: [],
      votes: null,
      eliminatedPlayers: null,
      finalRoles: null,
      winningTeams: null,
      winningPlayers: null,
      timeRemaining: null,
      isEliminated: false
    };
  }
}
