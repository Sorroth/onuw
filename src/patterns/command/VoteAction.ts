/**
 * @fileoverview Vote action command implementation.
 * @module patterns/command/VoteAction
 *
 * @summary Represents a voting action in the game.
 *
 * @description
 * A VoteAction records when a player votes to eliminate someone.
 * Voting occurs during the Voting phase and is simultaneous.
 *
 * @pattern Command Pattern - Concrete Command for votes
 *
 * @example
 * ```typescript
 * const vote = new VoteAction(
 *   'player-1',
 *   GamePhase.VOTING,
 *   'player-3'
 * );
 *
 * console.log(vote.getDescription());
 * // "player-1 voted for player-3"
 * ```
 */

import { GamePhase } from '../../enums';
import { AbstractGameAction } from './GameAction';

/**
 * @summary Command representing a vote.
 *
 * @description
 * Encapsulates all information about a vote:
 * - Who voted
 * - Who they voted for
 *
 * @pattern Command Pattern - Concrete Command
 *
 * @remarks
 * Votes are cast simultaneously in ONUW. The VoteAction records
 * each individual vote for audit purposes, but the actual vote
 * reveal happens all at once during resolution.
 *
 * @example
 * ```typescript
 * const vote = new VoteAction(
 *   'player-1',
 *   GamePhase.VOTING,
 *   'player-3'
 * );
 *
 * // Record for audit
 * auditLog.record(vote.getAuditEntry(stateHash));
 * ```
 */
export class VoteAction extends AbstractGameAction {
  /** The player being voted for */
  public readonly targetId: string;

  /**
   * @summary Creates a new VoteAction.
   *
   * @param {string} actorId - Player who is voting
   * @param {GamePhase} phase - Current game phase (should be VOTING)
   * @param {string} targetId - Player being voted for
   *
   * @example
   * ```typescript
   * const vote = new VoteAction(
   *   'player-1',
   *   GamePhase.VOTING,
   *   'player-3'
   * );
   * ```
   */
  constructor(actorId: string, phase: GamePhase, targetId: string) {
    super(actorId, phase);
    this.targetId = targetId;
  }

  /**
   * @summary Returns the action type.
   *
   * @returns {'VOTE'} Always returns 'VOTE'
   */
  getType(): string {
    return 'VOTE';
  }

  /**
   * @summary Gets the vote details.
   *
   * @returns {Record<string, unknown>} Target information
   */
  getDetails(): Record<string, unknown> {
    return {
      targetId: this.targetId
    };
  }

  /**
   * @summary Gets a human-readable description of the vote.
   *
   * @returns {string} Description of who voted for whom
   *
   * @example
   * ```typescript
   * vote.getDescription();
   * // "player-1 voted for player-3"
   * ```
   */
  getDescription(): string {
    return `${this.actorId} voted for ${this.targetId}`;
  }
}
