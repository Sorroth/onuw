/**
 * @fileoverview Unified player interface for AI and human players.
 * @module players/IPlayer
 *
 * @summary Defines the interface that all player types must implement.
 *
 * @description
 * This module provides a unified interface for players, enabling:
 * - AI players (instant responses)
 * - Remote human players (async network responses)
 * - Mixed games with both AI and human players
 *
 * The interface is async to support network latency for human players.
 *
 * @pattern Proxy Pattern - RemoteHumanPlayer proxies network communication
 * @pattern Strategy Pattern - Different player types implement same interface
 *
 * @example
 * ```typescript
 * // Both AI and human implement IPlayer
 * const aiPlayer: IPlayer = new AIPlayer('ai-1', RoleName.SEER);
 * const humanPlayer: IPlayer = new RemoteHumanPlayer('human-1', socket);
 *
 * // Game uses them identically
 * const target = await player.selectPlayer(options, context);
 * ```
 */

import {
  NightActionContext,
  DayContext,
  VotingContext,
  NightActionResult
} from '../types';

/**
 * @summary Player type identifier.
 */
export type PlayerType = 'ai' | 'human' | 'spectator';

/**
 * @summary Player connection status.
 */
export type PlayerStatus = 'connected' | 'disconnected' | 'timeout';

/**
 * @summary Result of a player action with metadata.
 *
 * @description
 * Wraps the action result with timing and status information
 * for audit logging and timeout handling.
 */
export interface PlayerActionResult<T> {
  /** The actual result value */
  readonly value: T;

  /** Time taken in milliseconds */
  readonly durationMs: number;

  /** Whether this was a timeout default */
  readonly wasTimeout: boolean;

  /** Whether this was an AI takeover */
  readonly wasAITakeover: boolean;
}

/**
 * @summary Unified interface for all player types.
 *
 * @description
 * Defines the contract that all player implementations must follow.
 * All methods are async to support network latency for human players.
 *
 * Players receive context about the game state and must return
 * valid selections from the provided options.
 *
 * @pattern Strategy Pattern - Concrete player types implement this interface
 *
 * @remarks
 * - All selection methods are async to support network latency
 * - Context objects contain only information the player is allowed to know
 * - Implementations must validate responses before returning
 *
 * @example
 * ```typescript
 * class AIPlayer implements IPlayer {
 *   async selectPlayer(options: string[], context: NightActionContext): Promise<string> {
 *     // AI logic to choose target
 *     return this.chooseTarget(options, context);
 *   }
 * }
 *
 * class RemoteHumanPlayer implements IPlayer {
 *   async selectPlayer(options: string[], context: NightActionContext): Promise<string> {
 *     // Send request to client, wait for response
 *     return this.sendRequestAndWait('selectPlayer', { options, context });
 *   }
 * }
 * ```
 */
export interface IPlayer {
  /**
   * @summary Unique player identifier.
   */
  readonly id: string;

  /**
   * @summary Player type (ai, human, spectator).
   */
  readonly type: PlayerType;

  /**
   * @summary Current connection status.
   */
  readonly status: PlayerStatus;

  /**
   * @summary Display name for the player.
   */
  readonly name: string;

  /**
   * @summary Selects a single player from options.
   *
   * @description
   * Used by roles like Seer, Robber, Doppelganger to select a target player.
   *
   * @param {string[]} options - Valid player IDs to choose from
   * @param {NightActionContext} context - Current game context
   *
   * @returns {Promise<string>} Selected player ID
   *
   * @throws {TimeoutError} If player doesn't respond in time
   *
   * @example
   * ```typescript
   * // Seer selecting who to view
   * const target = await seer.selectPlayer(
   *   ['player-2', 'player-3', 'player-4'],
   *   { myPlayerId: 'player-1', myRole: RoleName.SEER, ... }
   * );
   * ```
   */
  selectPlayer(options: string[], context: NightActionContext): Promise<string>;

  /**
   * @summary Selects a single center card.
   *
   * @description
   * Used by roles like Drunk to select a center card to swap with.
   *
   * @param {NightActionContext} context - Current game context
   *
   * @returns {Promise<number>} Center card index (0-2)
   *
   * @throws {TimeoutError} If player doesn't respond in time
   */
  selectCenterCard(context: NightActionContext): Promise<number>;

  /**
   * @summary Selects two center cards.
   *
   * @description
   * Used by Seer when choosing to view center cards.
   *
   * @param {NightActionContext} context - Current game context
   *
   * @returns {Promise<[number, number]>} Two different center card indices
   *
   * @throws {TimeoutError} If player doesn't respond in time
   */
  selectTwoCenterCards(context: NightActionContext): Promise<[number, number]>;

  /**
   * @summary Chooses between viewing a player or center cards.
   *
   * @description
   * Seer-specific choice at the start of their night action.
   *
   * @param {NightActionContext} context - Current game context
   *
   * @returns {Promise<'player' | 'center'>} The chosen option
   *
   * @throws {TimeoutError} If player doesn't respond in time
   */
  chooseSeerOption(context: NightActionContext): Promise<'player' | 'center'>;

  /**
   * @summary Selects two different players.
   *
   * @description
   * Used by Troublemaker to select two players to swap.
   *
   * @param {string[]} options - Valid player IDs to choose from
   * @param {NightActionContext} context - Current game context
   *
   * @returns {Promise<[string, string]>} Two different player IDs
   *
   * @throws {TimeoutError} If player doesn't respond in time
   */
  selectTwoPlayers(options: string[], context: NightActionContext): Promise<[string, string]>;

  /**
   * @summary Makes a statement during day phase.
   *
   * @description
   * Player's opportunity to share information, make claims, or bluff.
   *
   * @param {DayContext} context - Day phase context with statements so far
   *
   * @returns {Promise<string>} The player's statement
   *
   * @throws {TimeoutError} If player doesn't respond in time
   */
  makeStatement(context: DayContext): Promise<string>;

  /**
   * @summary Casts a vote during voting phase.
   *
   * @description
   * Player must vote for one of the eligible targets.
   *
   * @param {VotingContext} context - Voting context with eligible targets
   *
   * @returns {Promise<string>} ID of the player being voted for
   *
   * @throws {TimeoutError} If player doesn't respond in time
   */
  vote(context: VotingContext): Promise<string>;

  /**
   * @summary Receives night action information.
   *
   * @description
   * Called after player's night action completes to inform them of results.
   * This is private information only this player receives.
   *
   * @param {NightActionResult} info - Result of the night action
   *
   * @example
   * ```typescript
   * // Seer receives info about what they saw
   * seer.receiveNightInfo({
   *   success: true,
   *   roleName: RoleName.SEER,
   *   info: { viewed: [{ playerId: 'player-2', role: RoleName.WEREWOLF }] }
   * });
   * ```
   */
  receiveNightInfo(info: NightActionResult): void;

  /**
   * @summary Called when the player is being replaced by AI.
   *
   * @description
   * Notifies the player implementation that they're being replaced
   * (e.g., due to disconnection). Used for cleanup.
   *
   * @param {string} reason - Why the player is being replaced
   */
  onReplacedByAI?(reason: string): void;

  /**
   * @summary Called when player reconnects after being replaced.
   *
   * @description
   * Allows the player to resume control from AI takeover.
   *
   * @param {NightActionResult[]} nightInfo - Night info they should have
   */
  onReconnected?(nightInfo: NightActionResult[]): void;
}

/**
 * @summary Error thrown when a player action times out.
 *
 * @description
 * Thrown when a human player doesn't respond within the allowed time.
 * The game will typically use an AI or random action as fallback.
 */
export class TimeoutError extends Error {
  /**
   * @summary The player who timed out.
   */
  public readonly playerId: string;

  /**
   * @summary The action that timed out.
   */
  public readonly action: string;

  /**
   * @summary How long we waited in milliseconds.
   */
  public readonly timeoutMs: number;

  constructor(playerId: string, action: string, timeoutMs: number) {
    super(`Player ${playerId} timed out on ${action} after ${timeoutMs}ms`);
    this.name = 'TimeoutError';
    this.playerId = playerId;
    this.action = action;
    this.timeoutMs = timeoutMs;
  }
}

/**
 * @summary Abstract base class providing common player functionality.
 *
 * @description
 * Provides shared implementation for:
 * - Night info storage
 * - Status management
 * - Common validation
 *
 * @pattern Template Method - Subclasses implement specific behavior
 */
export abstract class AbstractPlayer implements IPlayer {
  /** @inheritdoc */
  abstract readonly type: PlayerType;

  /** Current status */
  protected _status: PlayerStatus = 'connected';

  /** Stored night information */
  protected nightInfo: NightActionResult[] = [];

  /**
   * @summary Creates a new player.
   *
   * @param {string} id - Unique player identifier
   * @param {string} name - Display name
   */
  constructor(
    readonly id: string,
    readonly name: string
  ) {}

  /** @inheritdoc */
  get status(): PlayerStatus {
    return this._status;
  }

  /** @inheritdoc */
  abstract selectPlayer(options: string[], context: NightActionContext): Promise<string>;

  /** @inheritdoc */
  abstract selectCenterCard(context: NightActionContext): Promise<number>;

  /** @inheritdoc */
  abstract selectTwoCenterCards(context: NightActionContext): Promise<[number, number]>;

  /** @inheritdoc */
  abstract chooseSeerOption(context: NightActionContext): Promise<'player' | 'center'>;

  /** @inheritdoc */
  abstract selectTwoPlayers(options: string[], context: NightActionContext): Promise<[string, string]>;

  /** @inheritdoc */
  abstract makeStatement(context: DayContext): Promise<string>;

  /** @inheritdoc */
  abstract vote(context: VotingContext): Promise<string>;

  /** @inheritdoc */
  receiveNightInfo(info: NightActionResult): void {
    this.nightInfo.push(info);
  }

  /**
   * @summary Gets all night information received.
   *
   * @returns {NightActionResult[]} Array of night results
   */
  getNightInfo(): NightActionResult[] {
    return [...this.nightInfo];
  }

  /**
   * @summary Clears stored night information.
   *
   * @description
   * Called when starting a new game.
   */
  clearNightInfo(): void {
    this.nightInfo = [];
  }

  /**
   * @summary Sets the player's connection status.
   *
   * @param {PlayerStatus} status - New status
   */
  setStatus(status: PlayerStatus): void {
    this._status = status;
  }
}
