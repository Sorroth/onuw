/**
 * @fileoverview Replay repository for game event storage.
 * @module database/repositories/ReplayRepository
 *
 * @description
 * Provides data access methods for storing and retrieving game events
 * including night actions, statements, and votes for full game replay.
 *
 * @pattern Repository Pattern - Abstracts data access logic
 * @pattern 6NF Compliance - Night action details stored in normalized tables
 */

import { DatabaseService, getDatabase } from '../DatabaseService';
import {
  DbNightAction,
  DbNightActionTarget,
  DbNightActionView,
  DbNightActionSwap,
  DbNightActionCopy,
  DbNightActionTeammate,
  DbStatement,
  DbVote,
  NightActionDto,
  NightActionTargetDto,
  NightActionViewDto,
  NightActionSwapDto,
  NightActionCopyDto,
  StatementDto,
  VoteDto
} from '../types';
import {
  IReplayRepository,
  SaveNightActionParams,
  SaveStatementParams,
  SaveVoteParams
} from './interfaces';

/**
 * @summary Repository for game replay data access.
 *
 * @description
 * Handles storage and retrieval of all game events for replay functionality:
 * - Night actions with 6NF-compliant detail tables
 * - Day phase statements
 * - Voting records
 *
 * @pattern 6NF - Night action details decomposed into separate tables
 */
export class ReplayRepository implements IReplayRepository {
  private db: DatabaseService;

  constructor(db?: DatabaseService) {
    this.db = db || getDatabase();
  }

  /**
   * @summary Saves a night action with 6NF-compliant details.
   *
   * @description
   * Inserts the night action and all related details in a transaction:
   * - night_actions (core record)
   * - night_action_targets (target players/centers)
   * - night_action_views (roles seen)
   * - night_action_swaps (swap operations)
   * - night_action_copies (Doppelganger copies)
   * - night_action_teammates (teammates seen)
   *
   * @param {SaveNightActionParams} params - Night action parameters
   * @returns {Promise<string>} Action ID
   */
  async saveNightAction(params: SaveNightActionParams): Promise<string> {
    return this.db.transaction(async (client) => {
      // Insert core night action record
      const actionResult = await client.query<{ action_id: string }>(
        `INSERT INTO night_actions
           (game_id, actor_player_id, performed_as_role, action_type,
            sequence_order, is_doppelganger_action)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING action_id`,
        [
          params.gameId,
          params.actorPlayerId,
          params.performedAsRole,
          params.actionType,
          params.sequenceOrder,
          params.isDoppelgangerAction ?? false
        ]
      );
      const actionId = actionResult.rows[0].action_id;

      // Insert targets (6NF)
      if (params.targets && params.targets.length > 0) {
        for (const target of params.targets) {
          await client.query(
            `INSERT INTO night_action_targets
               (action_id, target_type, target_player_id, target_center_position, target_order)
             VALUES ($1, $2, $3, $4, $5)`,
            [
              actionId,
              target.targetType,
              target.targetPlayerId ?? null,
              target.targetCenterPosition ?? null,
              target.targetOrder
            ]
          );
        }
      }

      // Insert views (6NF)
      if (params.views && params.views.length > 0) {
        for (const view of params.views) {
          await client.query(
            `INSERT INTO night_action_views
               (action_id, viewed_role, view_source_type, source_player_id,
                source_center_position, view_order)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [
              actionId,
              view.viewedRole,
              view.viewSourceType,
              view.sourcePlayerId ?? null,
              view.sourceCenterPosition ?? null,
              view.viewOrder
            ]
          );
        }
      }

      // Insert swap (6NF)
      if (params.swap) {
        await client.query(
          `INSERT INTO night_action_swaps
             (action_id, from_type, from_player_id, from_center_position,
              to_type, to_player_id, to_center_position)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            actionId,
            params.swap.fromType,
            params.swap.fromPlayerId ?? null,
            params.swap.fromCenterPosition ?? null,
            params.swap.toType,
            params.swap.toPlayerId ?? null,
            params.swap.toCenterPosition ?? null
          ]
        );
      }

      // Insert copy (6NF)
      if (params.copy) {
        await client.query(
          `INSERT INTO night_action_copies
             (action_id, copied_from_player_id, copied_role)
           VALUES ($1, $2, $3)`,
          [actionId, params.copy.copiedFromPlayerId, params.copy.copiedRole]
        );
      }

      // Insert teammates (6NF)
      if (params.teammates && params.teammates.length > 0) {
        for (const teammateId of params.teammates) {
          await client.query(
            `INSERT INTO night_action_teammates (action_id, teammate_player_id)
             VALUES ($1, $2)`,
            [actionId, teammateId]
          );
        }
      }

      return actionId;
    });
  }

  /**
   * @summary Gets all night actions for a game with 6NF details.
   *
   * @description
   * Retrieves night actions and reconstructs the full details from
   * the normalized 6NF tables.
   *
   * @param {string} gameId - Game ID
   * @returns {Promise<NightActionDto[]>} Night actions in order
   */
  async getNightActions(gameId: string): Promise<NightActionDto[]> {
    // Get core night actions
    const actions = await this.db.queryAll<DbNightAction>(
      `SELECT * FROM night_actions WHERE game_id = $1 ORDER BY sequence_order`,
      [gameId]
    );

    // Get all related details in parallel
    const actionIds = actions.map((a) => a.action_id);

    if (actionIds.length === 0) {
      return [];
    }

    const [targets, views, swaps, copies, teammates] = await Promise.all([
      this.db.queryAll<DbNightActionTarget>(
        `SELECT * FROM night_action_targets WHERE action_id = ANY($1) ORDER BY action_id, target_order`,
        [actionIds]
      ),
      this.db.queryAll<DbNightActionView>(
        `SELECT * FROM night_action_views WHERE action_id = ANY($1) ORDER BY action_id, view_order`,
        [actionIds]
      ),
      this.db.queryAll<DbNightActionSwap>(
        `SELECT * FROM night_action_swaps WHERE action_id = ANY($1)`,
        [actionIds]
      ),
      this.db.queryAll<DbNightActionCopy>(
        `SELECT * FROM night_action_copies WHERE action_id = ANY($1)`,
        [actionIds]
      ),
      this.db.queryAll<DbNightActionTeammate>(
        `SELECT * FROM night_action_teammates WHERE action_id = ANY($1)`,
        [actionIds]
      )
    ]);

    // Group details by action ID
    const targetsByAction = this.groupBy(targets, 'action_id');
    const viewsByAction = this.groupBy(views, 'action_id');
    const swapsByAction = new Map(swaps.map((s) => [s.action_id, s]));
    const copiesByAction = new Map(copies.map((c) => [c.action_id, c]));
    const teammatesByAction = this.groupBy(teammates, 'action_id');

    // Reconstruct full DTOs
    return actions.map((action): NightActionDto => {
      const actionTargets = targetsByAction.get(action.action_id) || [];
      const actionViews = viewsByAction.get(action.action_id) || [];
      const actionSwap = swapsByAction.get(action.action_id);
      const actionCopy = copiesByAction.get(action.action_id);
      const actionTeammates = teammatesByAction.get(action.action_id) || [];

      return {
        actorPlayerId: action.actor_player_id,
        performedAsRole: action.performed_as_role,
        actionType: action.action_type,
        sequenceOrder: action.sequence_order,
        isDoppelgangerAction: action.is_doppelganger_action,
        targets: actionTargets.map((t): NightActionTargetDto => ({
          targetType: t.target_type,
          targetPlayerId: t.target_player_id,
          targetCenterPosition: t.target_center_position,
          targetOrder: t.target_order
        })),
        views: actionViews.map((v): NightActionViewDto => ({
          viewSourceType: v.view_source_type,
          sourcePlayerId: v.source_player_id,
          sourceCenterPosition: v.source_center_position,
          viewedRole: v.viewed_role,
          viewOrder: v.view_order
        })),
        swap: actionSwap
          ? {
              fromType: actionSwap.from_type,
              fromPlayerId: actionSwap.from_player_id,
              fromCenterPosition: actionSwap.from_center_position,
              toType: actionSwap.to_type,
              toPlayerId: actionSwap.to_player_id,
              toCenterPosition: actionSwap.to_center_position
            } as NightActionSwapDto
          : null,
        copy: actionCopy
          ? {
              copiedFromPlayerId: actionCopy.copied_from_player_id,
              copiedRole: actionCopy.copied_role
            } as NightActionCopyDto
          : null,
        teammates: actionTeammates.map((t) => t.teammate_player_id)
      };
    });
  }

  /**
   * @summary Saves a statement.
   *
   * @param {SaveStatementParams} params - Statement parameters
   * @returns {Promise<string>} Statement ID
   */
  async saveStatement(params: SaveStatementParams): Promise<string> {
    const result = await this.db.queryOne<{ statement_id: string }>(
      `INSERT INTO statements
         (game_id, speaker_player_id, statement_text, statement_type, sequence_order)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING statement_id`,
      [
        params.gameId,
        params.speakerPlayerId,
        params.text,
        params.type || 'claim',
        params.sequenceOrder
      ]
    );
    return result!.statement_id;
  }

  /**
   * @summary Gets all statements for a game.
   *
   * @param {string} gameId - Game ID
   * @returns {Promise<StatementDto[]>} Statements in order
   */
  async getStatements(gameId: string): Promise<StatementDto[]> {
    const results = await this.db.queryAll<DbStatement>(
      `SELECT * FROM statements WHERE game_id = $1 ORDER BY sequence_order`,
      [gameId]
    );

    return results.map((s) => ({
      speakerPlayerId: s.speaker_player_id,
      text: s.statement_text,
      sequenceOrder: s.sequence_order,
      spokenAt: s.spoken_at
    }));
  }

  /**
   * @summary Saves a vote.
   *
   * @param {SaveVoteParams} params - Vote parameters
   * @returns {Promise<string>} Vote ID
   */
  async saveVote(params: SaveVoteParams): Promise<string> {
    const result = await this.db.queryOne<{ vote_id: string }>(
      `INSERT INTO votes (game_id, voter_player_id, target_player_id, is_final)
       VALUES ($1, $2, $3, $4)
       RETURNING vote_id`,
      [
        params.gameId,
        params.voterPlayerId,
        params.targetPlayerId,
        params.isFinal ?? true
      ]
    );
    return result!.vote_id;
  }

  /**
   * @summary Gets all votes for a game.
   *
   * @param {string} gameId - Game ID
   * @param {boolean} finalOnly - Only return final votes
   * @returns {Promise<VoteDto[]>} Votes
   */
  async getVotes(gameId: string, finalOnly: boolean = true): Promise<VoteDto[]> {
    const whereClause = finalOnly
      ? 'WHERE game_id = $1 AND is_final = TRUE'
      : 'WHERE game_id = $1';

    const results = await this.db.queryAll<DbVote>(
      `SELECT * FROM votes ${whereClause} ORDER BY voted_at`,
      [gameId]
    );

    return results.map((v) => ({
      voterPlayerId: v.voter_player_id,
      targetPlayerId: v.target_player_id,
      votedAt: v.voted_at
    }));
  }

  /**
   * @summary Gets complete game replay data.
   *
   * @param {string} gameId - Game ID
   * @returns {Promise<object>} Complete replay data
   */
  async getFullReplay(gameId: string): Promise<{
    nightActions: NightActionDto[];
    statements: StatementDto[];
    votes: VoteDto[];
  }> {
    const [nightActions, statements, votes] = await Promise.all([
      this.getNightActions(gameId),
      this.getStatements(gameId),
      this.getVotes(gameId)
    ]);

    return { nightActions, statements, votes };
  }

  /**
   * @summary Helper to group array items by a key.
   *
   * @private
   * @param {T[]} items - Items to group
   * @param {K} key - Key to group by
   * @returns {Map<T[K], T[]>} Grouped items
   */
  private groupBy<T, K extends keyof T>(items: T[], key: K): Map<T[K], T[]> {
    const map = new Map<T[K], T[]>();
    for (const item of items) {
      const keyValue = item[key];
      const existing = map.get(keyValue);
      if (existing) {
        existing.push(item);
      } else {
        map.set(keyValue, [item]);
      }
    }
    return map;
  }
}
