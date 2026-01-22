/**
 * @fileoverview Game state snapshot for auditing.
 * @module audit/GameStateSnapshot
 *
 * @summary Creates immutable snapshots of game state for comparison.
 *
 * @description
 * GameStateSnapshot captures the complete game state at a point in time:
 * - Current phase
 * - Player card assignments
 * - Center cards
 * - Votes cast
 *
 * These snapshots can be:
 * - Hashed for circular detection
 * - Compared for state changes
 * - Stored for game replay
 *
 * @pattern Memento Pattern - Captures game state for potential restoration
 *
 * @example
 * ```typescript
 * const snapshot = new GameStateSnapshot(game.getState());
 * const hash = snapshot.hash();
 *
 * // Later
 * const newSnapshot = new GameStateSnapshot(game.getState());
 * if (snapshot.hash() === newSnapshot.hash()) {
 *   console.log('State is the same!');
 * }
 * ```
 */

import { GameState } from '../types';
import { GamePhase } from '../enums';

/**
 * @summary Immutable snapshot of game state.
 *
 * @description
 * Captures the essential game state that can be used for:
 * - State comparison
 * - Circular detection
 * - Audit logging
 *
 * @pattern Memento Pattern
 *
 * @example
 * ```typescript
 * const snapshot = new GameStateSnapshot(state);
 * console.log(snapshot.hash()); // 'abc123...'
 * ```
 */
export class GameStateSnapshot {
  /** Current game phase */
  public readonly phase: GamePhase;

  /** Player ID to role name mapping */
  public readonly playerCards: ReadonlyMap<string, string>;

  /** Center card role names */
  public readonly centerCards: ReadonlyArray<string>;

  /** Votes: voter ID to target ID */
  public readonly votes: ReadonlyMap<string, string>;

  /** When this snapshot was taken */
  public readonly timestamp: number;

  /**
   * @summary Creates a new GameStateSnapshot.
   *
   * @param {GameState} state - The state to snapshot
   *
   * @example
   * ```typescript
   * const snapshot = new GameStateSnapshot(game.getState());
   * ```
   */
  constructor(state: GameState) {
    this.phase = state.phase;
    this.timestamp = state.timestamp || Date.now();

    // Capture player cards
    const playerCards = new Map<string, string>();
    for (const player of state.players) {
      playerCards.set(player.id, player.currentRole.name.toString());
    }
    this.playerCards = playerCards;

    // Capture center cards
    this.centerCards = state.centerCards.map(r => r.name.toString());

    // Capture votes
    this.votes = new Map(state.votes);
  }

  /**
   * @summary Generates a hash of this state.
   *
   * @description
   * Creates a deterministic hash based on:
   * - Phase
   * - Player card assignments
   * - Center cards
   * - Votes
   *
   * @returns {string} Hash string
   *
   * @remarks
   * Uses a simple string-based hash. For production, consider
   * using a proper hash function like SHA-256.
   *
   * @example
   * ```typescript
   * const hash = snapshot.hash();
   * // 'NIGHT|p1:SEER,p2:WEREWOLF|c0:VILLAGER,c1:DRUNK,c2:ROBBER|'
   * ```
   */
  hash(): string {
    const parts: string[] = [];

    // Phase
    parts.push(this.phase);

    // Player cards (sorted by player ID for consistency)
    const playerParts = Array.from(this.playerCards.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([id, role]) => `${id}:${role}`)
      .join(',');
    parts.push(playerParts);

    // Center cards
    const centerParts = this.centerCards
      .map((role, i) => `c${i}:${role}`)
      .join(',');
    parts.push(centerParts);

    // Votes (sorted for consistency)
    const voteParts = Array.from(this.votes.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([voter, target]) => `${voter}>${target}`)
      .join(',');
    parts.push(voteParts);

    return parts.join('|');
  }

  /**
   * @summary Compares this snapshot to another.
   *
   * @param {GameStateSnapshot} other - Snapshot to compare with
   *
   * @returns {boolean} True if states are equivalent
   *
   * @example
   * ```typescript
   * if (snapshot1.equals(snapshot2)) {
   *   console.log('States are the same');
   * }
   * ```
   */
  equals(other: GameStateSnapshot): boolean {
    return this.hash() === other.hash();
  }

  /**
   * @summary Gets differences between this snapshot and another.
   *
   * @param {GameStateSnapshot} other - Snapshot to compare with
   *
   * @returns {object} Object describing differences
   *
   * @example
   * ```typescript
   * const diff = snapshot1.diff(snapshot2);
   * console.log(diff.changedPlayers); // ['player-2']
   * ```
   */
  diff(other: GameStateSnapshot): {
    phaseChanged: boolean;
    changedPlayers: string[];
    changedCenterCards: number[];
    newVotes: string[];
  } {
    const changedPlayers: string[] = [];
    const changedCenterCards: number[] = [];
    const newVotes: string[] = [];

    // Check phase
    const phaseChanged = this.phase !== other.phase;

    // Check player cards
    for (const [playerId, role] of this.playerCards) {
      if (other.playerCards.get(playerId) !== role) {
        changedPlayers.push(playerId);
      }
    }

    // Check center cards
    for (let i = 0; i < this.centerCards.length; i++) {
      if (other.centerCards[i] !== this.centerCards[i]) {
        changedCenterCards.push(i);
      }
    }

    // Check votes
    for (const [voter, target] of other.votes) {
      if (!this.votes.has(voter)) {
        newVotes.push(voter);
      }
    }

    return {
      phaseChanged,
      changedPlayers,
      changedCenterCards,
      newVotes
    };
  }

  /**
   * @summary Converts snapshot to JSON-serializable object.
   *
   * @returns {object} Plain object representation
   *
   * @example
   * ```typescript
   * const json = JSON.stringify(snapshot.toObject());
   * ```
   */
  toObject(): {
    phase: string;
    playerCards: Record<string, string>;
    centerCards: string[];
    votes: Record<string, string>;
    timestamp: number;
    hash: string;
  } {
    return {
      phase: this.phase,
      playerCards: Object.fromEntries(this.playerCards),
      centerCards: [...this.centerCards],
      votes: Object.fromEntries(this.votes),
      timestamp: this.timestamp,
      hash: this.hash()
    };
  }
}
