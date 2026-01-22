/**
 * @fileoverview Observer Pattern implementation for game events.
 * @module patterns/observer/GameObserver
 *
 * @summary Defines the observer interface and subject for game events.
 *
 * @description
 * The Observer Pattern is used to broadcast game events to interested
 * parties. This enables:
 * - Audit logging without coupling to game logic
 * - UI updates (console output, etc.)
 * - Event-driven architecture
 * - Easy testing (mock observers)
 *
 * @pattern Observer Pattern
 * - Subject: GameEventEmitter
 * - Observer: IGameObserver interface
 * - Event: GameEvent (defined in types)
 *
 * @remarks
 * Events include:
 * - GAME_STARTED
 * - PHASE_CHANGED
 * - NIGHT_ACTION_EXECUTED
 * - STATEMENT_MADE
 * - VOTE_CAST
 * - GAME_ENDED
 * - ERROR
 *
 * @example
 * ```typescript
 * // Create event emitter
 * const emitter = new GameEventEmitter();
 *
 * // Add observers
 * emitter.addObserver(new ConsoleLogger());
 * emitter.addObserver(new AuditLogObserver(auditLog));
 *
 * // Emit events
 * emitter.emit({
 *   type: 'PHASE_CHANGED',
 *   timestamp: Date.now(),
 *   data: { from: GamePhase.NIGHT, to: GamePhase.DAY }
 * });
 * ```
 */

import { GameEvent, IGameObserver, GameEventType } from '../../types';
import { GamePhase } from '../../enums';

/**
 * @summary Re-export types for convenience.
 */
export { GameEvent, IGameObserver, GameEventType };

/**
 * @summary Subject/Publisher in the Observer Pattern.
 *
 * @description
 * GameEventEmitter maintains a list of observers and notifies them
 * when game events occur. This decouples event generation from
 * event handling.
 *
 * @pattern Observer Pattern - This is the Subject
 *
 * @remarks
 * The emitter is typically owned by the Game class and passed to
 * components that need to emit events. Observers subscribe once
 * and receive all events.
 *
 * @example
 * ```typescript
 * const emitter = new GameEventEmitter();
 *
 * // Subscribe
 * const logger = new ConsoleLogger();
 * emitter.addObserver(logger);
 *
 * // Later: emit event
 * emitter.emit({ type: 'GAME_STARTED', ... });
 *
 * // Cleanup
 * emitter.removeObserver(logger);
 * ```
 */
export class GameEventEmitter {
  /** List of registered observers */
  private observers: IGameObserver[] = [];

  /**
   * @summary Creates a new GameEventEmitter.
   *
   * @example
   * ```typescript
   * const emitter = new GameEventEmitter();
   * ```
   */
  constructor() {
    this.observers = [];
  }

  /**
   * @summary Adds an observer to receive events.
   *
   * @description
   * Registered observers will receive all events emitted after registration.
   * Duplicate observers are prevented.
   *
   * @param {IGameObserver} observer - Observer to add
   *
   * @example
   * ```typescript
   * emitter.addObserver(new ConsoleLogger());
   * ```
   */
  addObserver(observer: IGameObserver): void {
    if (!this.observers.includes(observer)) {
      this.observers.push(observer);
    }
  }

  /**
   * @summary Removes an observer.
   *
   * @description
   * The observer will no longer receive events.
   *
   * @param {IGameObserver} observer - Observer to remove
   *
   * @returns {boolean} True if observer was found and removed
   *
   * @example
   * ```typescript
   * emitter.removeObserver(logger);
   * ```
   */
  removeObserver(observer: IGameObserver): boolean {
    const index = this.observers.indexOf(observer);
    if (index !== -1) {
      this.observers.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * @summary Removes all observers.
   *
   * @description
   * Clears the observer list. Useful for cleanup or resetting.
   *
   * @example
   * ```typescript
   * emitter.clearObservers();
   * ```
   */
  clearObservers(): void {
    this.observers = [];
  }

  /**
   * @summary Gets the count of registered observers.
   *
   * @returns {number} Number of observers
   *
   * @example
   * ```typescript
   * console.log(`${emitter.getObserverCount()} observers registered`);
   * ```
   */
  getObserverCount(): number {
    return this.observers.length;
  }

  /**
   * @summary Emits an event to all observers.
   *
   * @description
   * Calls onEvent() on each registered observer with the provided event.
   * Errors in observers are caught and logged but don't stop other observers.
   *
   * @param {GameEvent} event - Event to emit
   *
   * @example
   * ```typescript
   * emitter.emit({
   *   type: 'PHASE_CHANGED',
   *   timestamp: Date.now(),
   *   data: { from: GamePhase.NIGHT, to: GamePhase.DAY }
   * });
   * ```
   */
  emit(event: GameEvent): void {
    for (const observer of this.observers) {
      try {
        observer.onEvent(event);
      } catch (error) {
        // Log error but continue notifying other observers
        console.error(`Observer error:`, error);
      }
    }
  }

  /**
   * @summary Creates and emits a game started event.
   *
   * @param {string[]} playerIds - IDs of players in the game
   * @param {string[]} roleNames - Names of roles in the game
   *
   * @example
   * ```typescript
   * emitter.emitGameStarted(['player1', 'player2'], ['WEREWOLF', 'SEER']);
   * ```
   */
  emitGameStarted(playerIds: string[], roleNames: string[]): void {
    this.emit({
      type: 'GAME_STARTED',
      timestamp: Date.now(),
      data: { playerIds, roleNames }
    });
  }

  /**
   * @summary Creates and emits a phase change event.
   *
   * @param {GamePhase} from - Previous phase
   * @param {GamePhase} to - New phase
   *
   * @example
   * ```typescript
   * emitter.emitPhaseChanged(GamePhase.NIGHT, GamePhase.DAY);
   * ```
   */
  emitPhaseChanged(from: GamePhase, to: GamePhase): void {
    this.emit({
      type: 'PHASE_CHANGED',
      timestamp: Date.now(),
      data: { from, to }
    });
  }

  /**
   * @summary Creates and emits a night action event.
   *
   * @param {string} actorId - Player who performed the action
   * @param {string} roleName - Role that performed the action
   * @param {string} actionType - Type of action (VIEW, SWAP, NONE)
   * @param {Record<string, unknown>} details - Action-specific details
   *
   * @example
   * ```typescript
   * emitter.emitNightAction('player1', 'SEER', 'VIEW', { target: 'player2' });
   * ```
   */
  emitNightAction(
    actorId: string,
    roleName: string,
    actionType: string,
    details: Record<string, unknown>
  ): void {
    this.emit({
      type: 'NIGHT_ACTION_EXECUTED',
      timestamp: Date.now(),
      data: { actorId, roleName, actionType, details }
    });
  }

  /**
   * @summary Creates and emits a statement event.
   *
   * @param {string} playerId - Player who made the statement
   * @param {string} statement - What they said
   *
   * @example
   * ```typescript
   * emitter.emitStatement('player1', 'I am the Seer!');
   * ```
   */
  emitStatement(playerId: string, statement: string): void {
    this.emit({
      type: 'STATEMENT_MADE',
      timestamp: Date.now(),
      data: { playerId, statement }
    });
  }

  /**
   * @summary Creates and emits a vote event.
   *
   * @param {string} voterId - Player who voted
   * @param {string} targetId - Player they voted for
   *
   * @example
   * ```typescript
   * emitter.emitVote('player1', 'player3');
   * ```
   */
  emitVote(voterId: string, targetId: string): void {
    this.emit({
      type: 'VOTE_CAST',
      timestamp: Date.now(),
      data: { voterId, targetId }
    });
  }

  /**
   * @summary Creates and emits a game ended event.
   *
   * @param {string[]} winningTeams - Teams that won
   * @param {string[]} winningPlayers - Players who won
   * @param {string[]} eliminatedPlayers - Players who were eliminated
   *
   * @example
   * ```typescript
   * emitter.emitGameEnded(['VILLAGE'], ['player1', 'player2'], ['player3']);
   * ```
   */
  emitGameEnded(
    winningTeams: string[],
    winningPlayers: string[],
    eliminatedPlayers: string[]
  ): void {
    this.emit({
      type: 'GAME_ENDED',
      timestamp: Date.now(),
      data: { winningTeams, winningPlayers, eliminatedPlayers }
    });
  }

  /**
   * @summary Creates and emits an error event.
   *
   * @param {string} message - Error message
   * @param {Error} [error] - Optional error object
   *
   * @example
   * ```typescript
   * emitter.emitError('Invalid action', new Error('Target not found'));
   * ```
   */
  emitError(message: string, error?: Error): void {
    this.emit({
      type: 'ERROR',
      timestamp: Date.now(),
      data: {
        message,
        error: error?.message,
        stack: error?.stack
      }
    });
  }
}
