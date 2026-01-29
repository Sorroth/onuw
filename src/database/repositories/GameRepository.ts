/**
 * @fileoverview Game repository for database operations.
 * @module database/repositories/GameRepository
 *
 * @description
 * Provides data access methods for game-related operations including
 * game creation, player management, and game state persistence.
 *
 * @pattern Repository Pattern - Abstracts data access logic
 */

import { DatabaseService, getDatabase } from '../DatabaseService';
import {
  DbGame,
  DbGameConfiguration,
  DbGamePlayer,
  DbCenterCard,
  GameSummaryDto
} from '../types';
import { IGameRepository, CreateGameParams, AddPlayerParams } from './interfaces';

/**
 * @summary Repository for game data access.
 *
 * @description
 * Handles all database operations related to games, including:
 * - Game creation and configuration
 * - Player management
 * - Center card management
 * - Game state updates
 */
export class GameRepository implements IGameRepository {
  private db: DatabaseService;

  constructor(db?: DatabaseService) {
    this.db = db || getDatabase();
  }

  /**
   * @summary Creates a new game with configuration.
   *
   * @param {CreateGameParams} params - Game parameters
   * @returns {Promise<string>} Game ID
   */
  async createGame(params: CreateGameParams): Promise<string> {
    return this.db.transaction(async (client) => {
      // Create game
      const gameResult = await client.query<{ game_id: string }>(
        `INSERT INTO games (room_code, host_user_id, status)
         VALUES ($1, $2, 'lobby')
         RETURNING game_id`,
        [params.roomCode, params.hostUserId]
      );
      const gameId = gameResult.rows[0].game_id;

      // Create configuration
      await client.query(
        `INSERT INTO game_configurations
           (game_id, player_count, day_duration_seconds, vote_duration_seconds,
            is_private, allow_spectators, selected_roles)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          gameId,
          params.playerCount,
          params.dayDurationSeconds || 300,
          params.voteDurationSeconds || 30,
          params.isPrivate ?? true,
          params.allowSpectators ?? false,
          JSON.stringify(params.selectedRoles)
        ]
      );

      return gameId;
    });
  }

  /**
   * @summary Finds a game by ID.
   *
   * @param {string} gameId - Game ID
   * @returns {Promise<DbGame | null>} Game or null
   */
  async findById(gameId: string): Promise<DbGame | null> {
    return this.db.queryOne<DbGame>(
      `SELECT * FROM games WHERE game_id = $1`,
      [gameId]
    );
  }

  /**
   * @summary Finds a game by room code.
   *
   * @param {string} roomCode - Room code
   * @returns {Promise<DbGame | null>} Game or null
   */
  async findByRoomCode(roomCode: string): Promise<DbGame | null> {
    return this.db.queryOne<DbGame>(
      `SELECT * FROM games
       WHERE room_code = $1
         AND status NOT IN ('completed', 'abandoned')`,
      [roomCode]
    );
  }

  /**
   * @summary Gets game configuration.
   *
   * @param {string} gameId - Game ID
   * @returns {Promise<DbGameConfiguration | null>} Configuration or null
   */
  async getConfiguration(gameId: string): Promise<DbGameConfiguration | null> {
    return this.db.queryOne<DbGameConfiguration>(
      `SELECT * FROM game_configurations WHERE game_id = $1`,
      [gameId]
    );
  }

  /**
   * @summary Updates game status.
   *
   * @param {string} gameId - Game ID
   * @param {string} status - New status
   */
  async updateStatus(gameId: string, status: string): Promise<void> {
    const updates: string[] = ['status = $2'];
    const values: unknown[] = [gameId, status];

    if (status === 'night' || status === 'setup') {
      updates.push('started_at = NOW()');
    } else if (status === 'completed' || status === 'abandoned') {
      updates.push('ended_at = NOW()');
    }

    await this.db.query(
      `UPDATE games SET ${updates.join(', ')} WHERE game_id = $1`,
      values
    );
  }

  /**
   * @summary Adds a player to a game.
   *
   * @param {AddPlayerParams} params - Player parameters
   * @returns {Promise<string>} Player ID
   */
  async addPlayer(params: AddPlayerParams): Promise<string> {
    const result = await this.db.queryOne<{ player_id: string }>(
      `INSERT INTO game_players (game_id, user_id, is_ai, seat_position, starting_role, final_role)
       VALUES ($1, $2, $3, $4, $5, $5)
       RETURNING player_id`,
      [
        params.gameId,
        params.isAI ? null : params.userId,  // AI players have NULL user_id
        params.isAI,
        params.seatPosition,
        params.startingRole
      ]
    );
    return result!.player_id;
  }

  /**
   * @summary Gets all players in a game.
   *
   * @param {string} gameId - Game ID
   * @returns {Promise<DbGamePlayer[]>} Players
   */
  async getPlayers(gameId: string): Promise<DbGamePlayer[]> {
    return this.db.queryAll<DbGamePlayer>(
      `SELECT * FROM game_players WHERE game_id = $1 ORDER BY seat_position`,
      [gameId]
    );
  }

  /**
   * @summary Updates a player's ready status.
   *
   * @param {string} playerId - Player ID
   * @param {boolean} isReady - Ready status
   */
  async setPlayerReady(playerId: string, isReady: boolean): Promise<void> {
    await this.db.query(
      `UPDATE game_players SET is_ready = $1 WHERE player_id = $2`,
      [isReady, playerId]
    );
  }

  /**
   * @summary Updates a player's final role.
   *
   * @param {string} playerId - Player ID
   * @param {string} finalRole - Final role after swaps
   */
  async updateFinalRole(playerId: string, finalRole: string): Promise<void> {
    await this.db.query(
      `UPDATE game_players SET final_role = $1 WHERE player_id = $2`,
      [finalRole, playerId]
    );
  }

  /**
   * @summary Adds center cards to a game.
   *
   * @param {string} gameId - Game ID
   * @param {string[]} roles - Roles for positions 0, 1, 2
   */
  async setCenterCards(gameId: string, roles: string[]): Promise<void> {
    await this.db.transaction(async (client) => {
      for (let i = 0; i < 3; i++) {
        await client.query(
          `INSERT INTO center_cards (game_id, position, starting_role, final_role)
           VALUES ($1, $2, $3, $3)`,
          [gameId, i, roles[i]]
        );
      }
    });
  }

  /**
   * @summary Gets center cards for a game.
   *
   * @param {string} gameId - Game ID
   * @returns {Promise<DbCenterCard[]>} Center cards
   */
  async getCenterCards(gameId: string): Promise<DbCenterCard[]> {
    return this.db.queryAll<DbCenterCard>(
      `SELECT * FROM center_cards WHERE game_id = $1 ORDER BY position`,
      [gameId]
    );
  }

  /**
   * @summary Updates a center card's final role.
   *
   * @param {string} gameId - Game ID
   * @param {number} position - Position (0-2)
   * @param {string} finalRole - Final role after swaps
   */
  async updateCenterCardRole(gameId: string, position: number, finalRole: string): Promise<void> {
    await this.db.query(
      `UPDATE center_cards SET final_role = $1 WHERE game_id = $2 AND position = $3`,
      [finalRole, gameId, position]
    );
  }

  /**
   * @summary Gets recent games for a user.
   *
   * @param {string} userId - User ID
   * @param {number} limit - Maximum number of games
   * @returns {Promise<GameSummaryDto[]>} Recent games
   */
  async getRecentGames(userId: string, limit: number = 10): Promise<GameSummaryDto[]> {
    const results = await this.db.queryAll<DbGame & { winning_team: string | null; player_count: number }>(
      `SELECT g.*, gr.winning_team,
              (SELECT COUNT(*) FROM game_players gp WHERE gp.game_id = g.game_id)::INTEGER AS player_count
       FROM games g
       JOIN game_players gp ON g.game_id = gp.game_id
       LEFT JOIN game_results gr ON g.game_id = gr.game_id
       WHERE gp.user_id = $1 AND g.status = 'completed'
       ORDER BY g.ended_at DESC
       LIMIT $2`,
      [userId, limit]
    );

    return results.map((g) => ({
      gameId: g.game_id,
      roomCode: g.room_code,
      status: g.status,
      playerCount: g.player_count,
      winningTeam: g.winning_team,
      createdAt: g.created_at,
      endedAt: g.ended_at
    }));
  }

  /**
   * @summary Gets active public games for lobby listing.
   *
   * @param {number} limit - Maximum number of games
   * @returns {Promise<GameSummaryDto[]>} Active public games
   */
  async getActivePublicGames(limit: number = 20): Promise<GameSummaryDto[]> {
    const results = await this.db.queryAll<DbGame & { player_count: number; max_players: number }>(
      `SELECT g.*,
              (SELECT COUNT(*) FROM game_players gp WHERE gp.game_id = g.game_id)::INTEGER AS player_count,
              gc.player_count AS max_players
       FROM games g
       JOIN game_configurations gc ON g.game_id = gc.game_id
       WHERE g.status = 'lobby' AND gc.is_private = FALSE
       ORDER BY g.created_at DESC
       LIMIT $1`,
      [limit]
    );

    return results.map((g) => ({
      gameId: g.game_id,
      roomCode: g.room_code,
      status: g.status,
      playerCount: g.player_count,
      winningTeam: null,
      createdAt: g.created_at,
      endedAt: null
    }));
  }

  /**
   * @summary Checks if a room code is available.
   *
   * @param {string} roomCode - Room code to check
   * @returns {Promise<boolean>} True if available
   */
  async isRoomCodeAvailable(roomCode: string): Promise<boolean> {
    const result = await this.db.queryOne<{ exists: boolean }>(
      `SELECT EXISTS(
         SELECT 1 FROM games
         WHERE room_code = $1 AND status NOT IN ('completed', 'abandoned')
       ) AS exists`,
      [roomCode]
    );
    return !result?.exists;
  }
}
