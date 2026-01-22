/**
 * @fileoverview Circular state detector for preventing infinite loops.
 * @module audit/CircularDetector
 *
 * @summary Detects when game state repeats, indicating a potential loop.
 *
 * @description
 * The CircularDetector tracks state hashes and identifies when the same
 * state has been seen before. This is crucial for:
 * - Preventing infinite loops in AI reasoning
 * - Detecting game logic bugs
 * - Ensuring game progression
 *
 * @remarks
 * In a well-functioning ONUW game, state should never repeat because:
 * - Night actions happen once
 * - Statements are cumulative
 * - Votes are final
 *
 * However, bugs or infinite AI reasoning could cause repeated states.
 *
 * @example
 * ```typescript
 * const detector = new CircularDetector();
 *
 * const result1 = detector.check('hash1', 'entry-1');
 * // result1.isCircular = false
 *
 * const result2 = detector.check('hash1', 'entry-2');
 * // result2.isCircular = true (same hash seen before!)
 * ```
 */

import { CircularCheckResult } from '../types';

/**
 * @summary Detects circular/repeated game states.
 *
 * @description
 * Maintains a registry of seen state hashes and reports when
 * a hash has been seen before.
 *
 * @example
 * ```typescript
 * const detector = new CircularDetector();
 *
 * // Check each state
 * for (const entry of auditLog.getEntries()) {
 *   const result = detector.check(entry.stateHash, entry.id);
 *   if (result.isCircular) {
 *     console.warn('Circular state:', result.message);
 *   }
 * }
 * ```
 */
export class CircularDetector {
  /** Map of state hash to first entry ID that had this hash */
  private readonly seenStates: Map<string, string> = new Map();

  /** Count of circular detections */
  private circularCount = 0;

  /**
   * @summary Creates a new CircularDetector.
   *
   * @example
   * ```typescript
   * const detector = new CircularDetector();
   * ```
   */
  constructor() {
    this.seenStates = new Map();
  }

  /**
   * @summary Checks if a state hash has been seen before.
   *
   * @description
   * If the hash is new, registers it. If seen before, returns circular result.
   *
   * @param {string} stateHash - Hash of the current state
   * @param {string} entryId - ID of the audit entry for this state
   *
   * @returns {CircularCheckResult} Whether this is a repeated state
   *
   * @example
   * ```typescript
   * const result = detector.check('abc123', 'audit-5');
   * if (result.isCircular) {
   *   console.warn(`Repeated state from ${result.matchingEntryId}`);
   * }
   * ```
   */
  check(stateHash: string, entryId: string): CircularCheckResult {
    // Skip empty hashes
    if (!stateHash) {
      return {
        isCircular: false,
        message: 'No state hash provided'
      };
    }

    // Check if we've seen this hash before
    const previousEntryId = this.seenStates.get(stateHash);

    if (previousEntryId) {
      this.circularCount++;
      return {
        isCircular: true,
        matchingEntryId: previousEntryId,
        message: `State hash "${stateHash.substring(0, 20)}..." was previously seen at entry ${previousEntryId}`
      };
    }

    // Register this hash
    this.seenStates.set(stateHash, entryId);

    return {
      isCircular: false,
      message: 'State is unique'
    };
  }

  /**
   * @summary Checks if a hash exists without registering.
   *
   * @description
   * Read-only check that doesn't modify the registry.
   *
   * @param {string} stateHash - Hash to check
   *
   * @returns {boolean} True if hash has been seen
   *
   * @example
   * ```typescript
   * if (detector.hasSeenState(hash)) {
   *   // State was seen before
   * }
   * ```
   */
  hasSeenState(stateHash: string): boolean {
    return this.seenStates.has(stateHash);
  }

  /**
   * @summary Gets the entry ID where a hash was first seen.
   *
   * @param {string} stateHash - Hash to look up
   *
   * @returns {string | undefined} Entry ID or undefined
   *
   * @example
   * ```typescript
   * const firstEntry = detector.getFirstOccurrence(hash);
   * ```
   */
  getFirstOccurrence(stateHash: string): string | undefined {
    return this.seenStates.get(stateHash);
  }

  /**
   * @summary Gets the count of unique states seen.
   *
   * @returns {number} Number of unique state hashes
   */
  getUniqueStateCount(): number {
    return this.seenStates.size;
  }

  /**
   * @summary Gets the count of circular detections.
   *
   * @returns {number} Number of times circular state was detected
   */
  getCircularCount(): number {
    return this.circularCount;
  }

  /**
   * @summary Clears all tracked states.
   *
   * @description
   * Resets the detector. Use when starting a new game.
   *
   * @example
   * ```typescript
   * detector.clear();
   * // Ready for a new game
   * ```
   */
  clear(): void {
    this.seenStates.clear();
    this.circularCount = 0;
  }

  /**
   * @summary Gets statistics about detected states.
   *
   * @returns {object} Statistics object
   *
   * @example
   * ```typescript
   * const stats = detector.getStats();
   * console.log(`Unique states: ${stats.uniqueStates}`);
   * console.log(`Circular detections: ${stats.circularDetections}`);
   * ```
   */
  getStats(): {
    uniqueStates: number;
    circularDetections: number;
  } {
    return {
      uniqueStates: this.seenStates.size,
      circularDetections: this.circularCount
    };
  }
}
