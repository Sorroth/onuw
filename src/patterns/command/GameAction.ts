/**
 * @fileoverview Command Pattern interface for game actions.
 * @module patterns/command/GameAction
 *
 * @summary Defines the contract for all game action commands.
 *
 * @description
 * The Command Pattern is used to encapsulate game actions as objects.
 * This enables:
 * - Logging all actions for audit
 * - Potential undo functionality (not used in ONUW but available)
 * - Decoupling action requests from execution
 * - Serialization of game history
 *
 * @pattern Command Pattern
 * - Command: IGameAction interface
 * - ConcreteCommands: SwapAction, ViewAction, VoteAction
 * - Invoker: Game class
 * - Receiver: Game state
 *
 * @remarks
 * In ONUW, actions are not undoable (game state is hidden),
 * but the command pattern still provides valuable logging and
 * encapsulation benefits.
 *
 * @example
 * ```typescript
 * const viewAction = new ViewAction(actorId, targetId, roleViewed);
 * viewAction.execute(gameState);
 *
 * // Log for audit
 * auditLog.record(viewAction.getAuditEntry());
 * ```
 */

import { GamePhase, RoleName } from '../../enums';
import { AuditEntry } from '../../types';

/**
 * @summary Interface for game action commands.
 *
 * @description
 * All game actions implement this interface. Each action:
 * - Has a unique ID
 * - Records who performed it
 * - Knows what phase it occurred in
 * - Can execute against game state
 * - Can generate an audit entry
 *
 * @pattern Command Pattern - This is the Command interface
 *
 * @example
 * ```typescript
 * class SwapAction implements IGameAction {
 *   execute(gameState: IGameState): void {
 *     gameState.swapCards(this.position1, this.position2);
 *   }
 *
 *   getAuditEntry(): AuditEntry {
 *     return {
 *       id: this.id,
 *       action: 'SWAP',
 *       actorId: this.actorId,
 *       ...
 *     };
 *   }
 * }
 * ```
 */
export interface IGameAction {
  /**
   * @summary Unique identifier for this action.
   * @readonly
   */
  readonly id: string;

  /**
   * @summary The player who performed this action.
   * @readonly
   */
  readonly actorId: string;

  /**
   * @summary The game phase when this action occurred.
   * @readonly
   */
  readonly phase: GamePhase;

  /**
   * @summary When this action was created.
   * @readonly
   */
  readonly timestamp: number;

  /**
   * @summary Gets the type of this action.
   *
   * @returns {string} Action type identifier
   *
   * @example
   * ```typescript
   * swapAction.getType(); // 'SWAP'
   * viewAction.getType(); // 'VIEW'
   * ```
   */
  getType(): string;

  /**
   * @summary Gets a human-readable description of this action.
   *
   * @returns {string} Description of what this action does
   *
   * @example
   * ```typescript
   * swapAction.getDescription();
   * // "Player1 swapped Player2's card with Player3's card"
   * ```
   */
  getDescription(): string;

  /**
   * @summary Converts this action to an audit log entry.
   *
   * @param {string} stateHash - Hash of game state after execution
   *
   * @returns {AuditEntry} Audit entry for this action
   *
   * @example
   * ```typescript
   * const entry = action.getAuditEntry('abc123');
   * auditLog.add(entry);
   * ```
   */
  getAuditEntry(stateHash: string): AuditEntry;

  /**
   * @summary Gets the action details for serialization.
   *
   * @returns {Record<string, unknown>} Action-specific details
   *
   * @example
   * ```typescript
   * swapAction.getDetails();
   * // { position1: {...}, position2: {...} }
   * ```
   */
  getDetails(): Record<string, unknown>;
}

/**
 * @summary Abstract base class for game actions.
 *
 * @description
 * Provides common functionality for all game action commands.
 *
 * @pattern Command Pattern - Abstract Command
 *
 * @example
 * ```typescript
 * class ViewAction extends AbstractGameAction {
 *   getType(): string { return 'VIEW'; }
 *
 *   getDetails(): Record<string, unknown> {
 *     return { targetId: this.targetId, roleViewed: this.roleViewed };
 *   }
 * }
 * ```
 */
export abstract class AbstractGameAction implements IGameAction {
  /** Unique action identifier */
  public readonly id: string;

  /** Player who performed the action */
  public readonly actorId: string;

  /** Phase when action occurred */
  public readonly phase: GamePhase;

  /** Creation timestamp */
  public readonly timestamp: number;

  /** Counter for generating unique IDs */
  private static actionCounter = 0;

  /**
   * @summary Creates a new game action.
   *
   * @param {string} actorId - Player who performs the action
   * @param {GamePhase} phase - Current game phase
   *
   * @protected
   */
  protected constructor(actorId: string, phase: GamePhase) {
    this.id = `action-${++AbstractGameAction.actionCounter}-${Date.now()}`;
    this.actorId = actorId;
    this.phase = phase;
    this.timestamp = Date.now();
  }

  /**
   * @summary Gets the action type.
   * @abstract Must be implemented by concrete classes.
   */
  abstract getType(): string;

  /**
   * @summary Gets the action details.
   * @abstract Must be implemented by concrete classes.
   */
  abstract getDetails(): Record<string, unknown>;

  /**
   * @summary Gets a human-readable description.
   *
   * @description
   * Default implementation returns type and actor.
   * Override in subclasses for more specific descriptions.
   *
   * @returns {string} Action description
   */
  getDescription(): string {
    return `${this.actorId} performed ${this.getType()}`;
  }

  /**
   * @summary Converts to audit entry.
   *
   * @param {string} stateHash - Hash of state after execution
   *
   * @returns {AuditEntry} Audit entry for logging
   */
  getAuditEntry(stateHash: string): AuditEntry {
    return {
      id: this.id,
      timestamp: this.timestamp,
      phase: this.phase,
      action: this.getType(),
      actorId: this.actorId,
      details: this.getDetails(),
      stateHash
    };
  }

  /**
   * @summary Resets the action counter.
   *
   * @description
   * Used for testing to ensure consistent IDs.
   *
   * @static
   */
  static resetCounter(): void {
    AbstractGameAction.actionCounter = 0;
  }
}
