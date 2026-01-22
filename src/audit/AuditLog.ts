/**
 * @fileoverview Audit log implementation for tracking game events.
 * @module audit/AuditLog
 *
 * @summary Maintains a complete log of all game events for auditing.
 *
 * @description
 * The AuditLog tracks every action that occurs in the game:
 * - Phase transitions
 * - Night actions
 * - Statements made
 * - Votes cast
 * - State changes
 *
 * This enables:
 * - Debugging game issues
 * - Replaying game history
 * - Detecting circular/repeated states
 * - Verifying rule adherence
 *
 * @pattern Observer Pattern - AuditLog can be an observer of game events
 *
 * @example
 * ```typescript
 * const auditLog = new AuditLog();
 *
 * // Connect to game
 * game.setAuditCallback((action, details) => {
 *   auditLog.record(action, details, game.getState());
 * });
 *
 * // After game
 * const entries = auditLog.getEntries();
 * auditLog.exportToJson('game-log.json');
 * ```
 */

import { AuditEntry, GameState, IGameObserver, GameEvent } from '../types';
import { GamePhase } from '../enums';
import { GameStateSnapshot } from './GameStateSnapshot';
import { CircularDetector } from './CircularDetector';

/**
 * @summary Complete audit log for a game.
 *
 * @description
 * Maintains an ordered list of all game events with:
 * - Timestamps
 * - Actor information
 * - Action details
 * - State hashes for circular detection
 *
 * @implements {IGameObserver} - Can observe game events directly
 *
 * @example
 * ```typescript
 * const log = new AuditLog();
 *
 * // Add as observer
 * game.addObserver(log);
 *
 * // Or use callback
 * game.setAuditCallback(log.record.bind(log));
 *
 * // Query log
 * const nightActions = log.getEntriesByPhase(GamePhase.NIGHT);
 * ```
 */
export class AuditLog implements IGameObserver {
  /** All audit entries in order */
  private readonly entries: AuditEntry[] = [];

  /** Circular state detector */
  private readonly circularDetector: CircularDetector;

  /** Entry counter for unique IDs */
  private entryCounter = 0;

  /**
   * @summary Creates a new AuditLog.
   *
   * @example
   * ```typescript
   * const log = new AuditLog();
   * ```
   */
  constructor() {
    this.circularDetector = new CircularDetector();
  }

  /**
   * @summary Records an audit entry.
   *
   * @description
   * Creates and stores an audit entry for a game action.
   * Also checks for circular states.
   *
   * @param {string} action - Action type
   * @param {Record<string, unknown>} details - Action details
   * @param {GameState} [state] - Current game state (for hashing)
   *
   * @returns {AuditEntry} The created entry
   *
   * @example
   * ```typescript
   * const entry = log.record('NIGHT_ACTION', {
   *   playerId: 'player-1',
   *   role: 'SEER'
   * }, gameState);
   * ```
   */
  record(
    action: string,
    details: Record<string, unknown>,
    state?: GameState
  ): AuditEntry {
    const snapshot = state ? new GameStateSnapshot(state) : null;
    const stateHash = snapshot?.hash() || '';

    const entry: AuditEntry = {
      id: `audit-${++this.entryCounter}`,
      timestamp: Date.now(),
      phase: (details.phase as GamePhase) || GamePhase.SETUP,
      action,
      actorId: (details.actorId as string) || 'SYSTEM',
      details,
      stateHash
    };

    this.entries.push(entry);

    // Check for circular state
    if (stateHash) {
      const circularCheck = this.circularDetector.check(stateHash, entry.id);
      if (circularCheck.isCircular) {
        console.warn(`Circular state detected: ${circularCheck.message}`);
      }
    }

    return entry;
  }

  /**
   * @summary Handles a game event (Observer Pattern).
   *
   * @param {GameEvent} event - The game event
   *
   * @example
   * ```typescript
   * // AuditLog can be added as an observer
   * game.addObserver(auditLog);
   * ```
   */
  onEvent(event: GameEvent): void {
    this.record(event.type, {
      ...event.data,
      timestamp: event.timestamp
    });
  }

  /**
   * @summary Gets all audit entries.
   *
   * @returns {ReadonlyArray<AuditEntry>} All entries
   *
   * @example
   * ```typescript
   * const allEntries = log.getEntries();
   * console.log(`Total entries: ${allEntries.length}`);
   * ```
   */
  getEntries(): ReadonlyArray<AuditEntry> {
    return [...this.entries];
  }

  /**
   * @summary Gets entries for a specific phase.
   *
   * @param {GamePhase} phase - Phase to filter by
   *
   * @returns {AuditEntry[]} Entries from that phase
   *
   * @example
   * ```typescript
   * const nightEntries = log.getEntriesByPhase(GamePhase.NIGHT);
   * ```
   */
  getEntriesByPhase(phase: GamePhase): AuditEntry[] {
    return this.entries.filter(e => e.phase === phase);
  }

  /**
   * @summary Gets entries for a specific actor.
   *
   * @param {string} actorId - Actor ID to filter by
   *
   * @returns {AuditEntry[]} Entries by that actor
   *
   * @example
   * ```typescript
   * const player1Actions = log.getEntriesByActor('player-1');
   * ```
   */
  getEntriesByActor(actorId: string): AuditEntry[] {
    return this.entries.filter(e => e.actorId === actorId);
  }

  /**
   * @summary Gets entries for a specific action type.
   *
   * @param {string} action - Action type to filter by
   *
   * @returns {AuditEntry[]} Entries of that action type
   *
   * @example
   * ```typescript
   * const votes = log.getEntriesByAction('VOTE_CAST');
   * ```
   */
  getEntriesByAction(action: string): AuditEntry[] {
    return this.entries.filter(e => e.action === action);
  }

  /**
   * @summary Gets the last N entries.
   *
   * @param {number} count - Number of entries to get
   *
   * @returns {AuditEntry[]} Last N entries
   *
   * @example
   * ```typescript
   * const recent = log.getLastEntries(10);
   * ```
   */
  getLastEntries(count: number): AuditEntry[] {
    return this.entries.slice(-count);
  }

  /**
   * @summary Gets entry count.
   *
   * @returns {number} Total number of entries
   */
  getEntryCount(): number {
    return this.entries.length;
  }

  /**
   * @summary Clears the log.
   *
   * @description
   * Removes all entries. Use for starting a new game.
   *
   * @example
   * ```typescript
   * log.clear();
   * ```
   */
  clear(): void {
    this.entries.length = 0;
    this.circularDetector.clear();
    this.entryCounter = 0;
  }

  /**
   * @summary Exports log to JSON string.
   *
   * @returns {string} JSON representation of the log
   *
   * @example
   * ```typescript
   * const json = log.toJson();
   * fs.writeFileSync('game-log.json', json);
   * ```
   */
  toJson(): string {
    return JSON.stringify({
      entryCount: this.entries.length,
      entries: this.entries
    }, null, 2);
  }

  /**
   * @summary Creates a summary of the log.
   *
   * @returns {object} Summary statistics
   *
   * @example
   * ```typescript
   * console.log(log.getSummary());
   * // { totalEntries: 45, byPhase: {...}, byAction: {...} }
   * ```
   */
  getSummary(): {
    totalEntries: number;
    byPhase: Record<string, number>;
    byAction: Record<string, number>;
    timeRange: { start: number; end: number } | null;
  } {
    const byPhase: Record<string, number> = {};
    const byAction: Record<string, number> = {};

    for (const entry of this.entries) {
      byPhase[entry.phase] = (byPhase[entry.phase] || 0) + 1;
      byAction[entry.action] = (byAction[entry.action] || 0) + 1;
    }

    return {
      totalEntries: this.entries.length,
      byPhase,
      byAction,
      timeRange: this.entries.length > 0
        ? {
          start: this.entries[0].timestamp,
          end: this.entries[this.entries.length - 1].timestamp
        }
        : null
    };
  }
}
