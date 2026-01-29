/**
 * @fileoverview Statistics repository for player stats and leaderboards.
 * @module database/repositories/StatisticsRepository
 *
 * @description
 * Provides data access methods for player statistics, game results,
 * and leaderboard queries.
 *
 * @pattern Repository Pattern - Abstracts data access logic
 */

import { DatabaseService, getDatabase } from '../DatabaseService';
import {
  DbGameResult,
  DbPlayerResult,
  DbPlayerStatistics,
  DbWinConditionEvaluation,
  DbPlayerRoleStats,
  DbPlayerTeamStats,
  PlayerStatsDto,
  LeaderboardEntryDto,
  GameResultDto,
  PlayerResultDto,
  WinConditionEvaluationDto
} from '../types';
import { IStatisticsRepository, SaveGameResultParams } from './interfaces';

/**
 * @summary Repository for statistics data access.
 *
 * @description
 * Handles all database operations related to statistics:
 * - Game results storage
 * - Player statistics updates (automatic via trigger)
 * - Leaderboard queries
 * - Role/team statistics
 */
export class StatisticsRepository implements IStatisticsRepository {
  private db: DatabaseService;

  constructor(db?: DatabaseService) {
    this.db = db || getDatabase();
  }

  /**
   * @summary Saves complete game results.
   *
   * @description
   * Saves game result, player results, and win condition evaluations.
   * Player statistics are updated automatically via database trigger.
   *
   * @param {SaveGameResultParams} params - Result parameters
   */
  async saveGameResult(params: SaveGameResultParams): Promise<void> {
    await this.db.transaction(async (client) => {
      // Save game result
      await client.query(
        `INSERT INTO game_results (game_id, winning_team)
         VALUES ($1, $2)`,
        [params.gameId, params.winningTeam]
      );

      // Save player results (triggers statistics update for human players only)
      for (const pr of params.playerResults) {
        await client.query(
          `INSERT INTO player_results
             (game_id, player_id, user_id, is_ai, final_team, is_winner, is_eliminated, votes_received, vote_cast_for)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [
            params.gameId,
            pr.playerId,
            pr.isAI ? null : pr.userId,  // AI players have NULL user_id
            pr.isAI,
            pr.finalTeam,
            pr.isWinner,
            pr.isEliminated,
            pr.votesReceived,
            pr.voteCastFor
          ]
        );
      }

      // Save win condition evaluations
      for (const wc of params.winConditions) {
        await client.query(
          `INSERT INTO win_condition_evaluations (game_id, team, team_won, reason)
           VALUES ($1, $2, $3, $4)`,
          [params.gameId, wc.team, wc.won, wc.reason]
        );
      }
    });
  }

  /**
   * @summary Gets game result.
   *
   * @param {string} gameId - Game ID
   * @returns {Promise<GameResultDto | null>} Game result or null
   */
  async getGameResult(gameId: string): Promise<GameResultDto | null> {
    const result = await this.db.queryOne<DbGameResult>(
      `SELECT * FROM game_results WHERE game_id = $1`,
      [gameId]
    );

    if (!result) return null;

    const [playerResults, winConditions] = await Promise.all([
      this.getPlayerResults(gameId),
      this.getWinConditionEvaluations(gameId)
    ]);

    return {
      winningTeam: result.winning_team,
      playerResults,
      winConditionEvaluations: winConditions
    };
  }

  /**
   * @summary Gets player results for a game.
   *
   * @param {string} gameId - Game ID
   * @returns {Promise<PlayerResultDto[]>} Player results
   */
  async getPlayerResults(gameId: string): Promise<PlayerResultDto[]> {
    const results = await this.db.queryAll<DbPlayerResult>(
      `SELECT * FROM player_results WHERE game_id = $1`,
      [gameId]
    );

    return results.map((pr) => ({
      playerId: pr.player_id,
      team: pr.final_team,
      isWinner: pr.is_winner,
      isEliminated: pr.is_eliminated,
      votesReceived: pr.votes_received
    }));
  }

  /**
   * @summary Gets win condition evaluations for a game.
   *
   * @param {string} gameId - Game ID
   * @returns {Promise<WinConditionEvaluationDto[]>} Win conditions
   */
  async getWinConditionEvaluations(gameId: string): Promise<WinConditionEvaluationDto[]> {
    const results = await this.db.queryAll<DbWinConditionEvaluation>(
      `SELECT * FROM win_condition_evaluations WHERE game_id = $1`,
      [gameId]
    );

    return results.map((wc) => ({
      team: wc.team,
      won: wc.team_won,
      reason: wc.reason
    }));
  }

  /**
   * @summary Gets player statistics.
   *
   * @description
   * Retrieves player statistics from the main table and the 6NF
   * decomposed role and team statistics tables.
   *
   * @param {string} userId - User ID
   * @returns {Promise<PlayerStatsDto | null>} Player stats or null
   */
  async getPlayerStats(userId: string): Promise<PlayerStatsDto | null> {
    const result = await this.db.queryOne<DbPlayerStatistics & { display_name: string }>(
      `SELECT ps.*, up.display_name
       FROM player_statistics ps
       JOIN user_profiles up ON ps.user_id = up.user_id
       WHERE ps.user_id = $1`,
      [userId]
    );

    if (!result) return null;

    // Query 6NF tables in parallel for role and team stats
    const [roleStatsDb, teamStatsDb, roles, teams] = await Promise.all([
      this.db.queryAll<DbPlayerRoleStats>(
        `SELECT * FROM player_role_stats WHERE user_id = $1`,
        [userId]
      ),
      this.db.queryAll<DbPlayerTeamStats>(
        `SELECT * FROM player_team_stats WHERE user_id = $1`,
        [userId]
      ),
      this.db.queryAll<{ role_code: string; role_name: string }>(
        `SELECT role_code, role_name FROM roles`
      ),
      this.db.queryAll<{ team_code: string; team_name: string }>(
        `SELECT team_code, team_name FROM teams`
      )
    ]);

    // Build lookup maps for names
    const roleNames = new Map(roles.map((r) => [r.role_code, r.role_name]));
    const teamNames = new Map(teams.map((t) => [t.team_code, t.team_name]));

    // Build role stats array from 6NF table
    const roleStats = roleStatsDb.map((rs) => ({
      roleCode: rs.role_code,
      roleName: roleNames.get(rs.role_code) || rs.role_code,
      gamesPlayed: rs.games_played,
      wins: rs.wins,
      losses: rs.losses,
      winRate: rs.games_played > 0 ? rs.wins / rs.games_played : 0
    }));

    // Build team stats array from 6NF table
    const teamStats = teamStatsDb.map((ts) => ({
      teamCode: ts.team_code,
      teamName: teamNames.get(ts.team_code) || ts.team_code,
      gamesPlayed: ts.games_played,
      wins: ts.wins,
      losses: ts.losses,
      winRate: ts.games_played > 0 ? ts.wins / ts.games_played : 0
    }));

    return {
      userId: result.user_id,
      displayName: result.display_name,
      gamesPlayed: result.games_played,
      wins: result.total_wins,
      losses: result.total_losses,
      winRate: result.win_rate,
      currentStreak: result.current_streak,
      bestStreak: result.best_streak,
      lastPlayedAt: result.last_played_at,
      roleStats,
      teamStats
    };
  }

  /**
   * @summary Gets the leaderboard.
   *
   * @param {number} limit - Maximum entries
   * @param {number} offset - Offset for pagination
   * @returns {Promise<LeaderboardEntryDto[]>} Leaderboard entries
   */
  async getLeaderboard(limit: number = 100, offset: number = 0): Promise<LeaderboardEntryDto[]> {
    const results = await this.db.queryAll<{
      rank: string;
      user_id: string;
      display_name: string;
      avatar_url: string | null;
      games_played: number;
      total_wins: number;
      win_rate: string;
    }>(
      `SELECT * FROM v_leaderboard LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    return results.map((r) => ({
      rank: parseInt(r.rank, 10),
      userId: r.user_id,
      displayName: r.display_name,
      avatarUrl: r.avatar_url,
      gamesPlayed: r.games_played,
      wins: r.total_wins,
      winRate: parseFloat(r.win_rate)
    }));
  }

  /**
   * @summary Gets player's rank on leaderboard.
   *
   * @param {string} userId - User ID
   * @returns {Promise<number | null>} Rank or null if not on leaderboard
   */
  async getPlayerRank(userId: string): Promise<number | null> {
    const result = await this.db.queryOne<{ rank: string }>(
      `SELECT rank FROM v_leaderboard WHERE user_id = $1`,
      [userId]
    );
    return result ? parseInt(result.rank, 10) : null;
  }

  /**
   * @summary Gets top players by role.
   *
   * @description
   * Queries the 6NF player_role_stats table for leaderboard by role.
   *
   * @param {string} roleCode - Role code
   * @param {number} limit - Maximum entries
   * @returns {Promise<Array>} Top players for role
   */
  async getTopPlayersByRole(
    roleCode: string,
    limit: number = 10
  ): Promise<Array<{
    userId: string;
    displayName: string;
    gamesPlayed: number;
    wins: number;
    losses: number;
    winRate: number;
  }>> {
    const results = await this.db.queryAll<{
      user_id: string;
      display_name: string;
      games_played: number;
      wins: number;
      losses: number;
    }>(
      `SELECT
         prs.user_id,
         up.display_name,
         prs.games_played,
         prs.wins,
         prs.losses
       FROM player_role_stats prs
       JOIN user_profiles up ON prs.user_id = up.user_id
       WHERE prs.role_code = $1
         AND prs.games_played >= 5
       ORDER BY
         prs.wins::FLOAT / NULLIF(prs.games_played, 0) DESC,
         prs.wins DESC
       LIMIT $2`,
      [roleCode, limit]
    );

    return results.map((r) => ({
      userId: r.user_id,
      displayName: r.display_name,
      gamesPlayed: r.games_played,
      wins: r.wins,
      losses: r.losses,
      winRate: r.games_played > 0 ? r.wins / r.games_played : 0
    }));
  }

  /**
   * @summary Gets global statistics.
   *
   * @returns {Promise<object>} Global stats
   */
  async getGlobalStats(): Promise<{
    totalGames: number;
    totalPlayers: number;
    averageGameDuration: number | null;
    mostPlayedRole: string | null;
    teamWinRates: Record<string, number>;
  }> {
    const [totalGames, totalPlayers, avgDuration, teamWins] = await Promise.all([
      this.db.queryOne<{ count: string }>(
        `SELECT COUNT(*) FROM games WHERE status = 'completed'`
      ),
      this.db.queryOne<{ count: string }>(
        `SELECT COUNT(*) FROM users`
      ),
      this.db.queryOne<{ avg: number | null }>(
        `SELECT AVG(EXTRACT(EPOCH FROM (ended_at - started_at))) AS avg
         FROM games
         WHERE status = 'completed' AND started_at IS NOT NULL AND ended_at IS NOT NULL`
      ),
      this.db.queryAll<{ winning_team: string; count: string }>(
        `SELECT winning_team, COUNT(*) AS count
         FROM game_results
         WHERE winning_team IS NOT NULL
         GROUP BY winning_team`
      )
    ]);

    const totalGamesNum = parseInt(totalGames?.count || '0', 10);
    const teamWinRates: Record<string, number> = {};

    for (const tw of teamWins) {
      const count = parseInt(tw.count, 10);
      teamWinRates[tw.winning_team] = totalGamesNum > 0 ? count / totalGamesNum : 0;
    }

    return {
      totalGames: totalGamesNum,
      totalPlayers: parseInt(totalPlayers?.count || '0', 10),
      averageGameDuration: avgDuration?.avg || null,
      mostPlayedRole: null, // Would need aggregation query
      teamWinRates
    };
  }
}
