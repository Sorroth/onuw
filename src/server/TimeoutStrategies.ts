/**
 * @fileoverview Timeout strategy configurations for multiplayer games.
 * @module server/TimeoutStrategies
 *
 * @summary Provides configurable timeout strategies for different game modes.
 *
 * @description
 * TimeoutStrategies enables different play styles:
 * - Casual: Generous timeouts for relaxed play
 * - Competitive: Balanced timeouts for standard play
 * - Tournament: Strict timeouts for competitive play
 * - Custom: User-defined timeout configurations
 *
 * @pattern Strategy Pattern - Interchangeable timeout behaviors
 *
 * @example
 * ```typescript
 * const strategy = TimeoutStrategyFactory.create('competitive');
 * const timeout = strategy.getTimeout('nightAction');
 *
 * player.setTimeoutConfig(strategy.toTimeoutConfig());
 * ```
 */

import { TimeoutConfig } from '../players/RemoteHumanPlayer';
import { GamePhase } from '../enums';

/**
 * @summary Timeout strategy type identifier.
 */
export type TimeoutStrategyType = 'casual' | 'competitive' | 'tournament' | 'custom';

/**
 * @summary Action types that have timeouts.
 */
export type TimeoutActionType =
  | 'nightAction'
  | 'statement'
  | 'vote'
  | 'reconnection'
  | 'lobbyReady';

/**
 * @summary Configuration for a timeout strategy.
 */
export interface TimeoutStrategyConfig {
  /** Strategy type identifier */
  type: TimeoutStrategyType;

  /** Display name */
  name: string;

  /** Description */
  description: string;

  /** Timeouts for each action type (in milliseconds) */
  timeouts: Record<TimeoutActionType, number>;

  /** Whether to use AI fallback on timeout */
  useAIFallback: boolean;

  /** Whether to show countdown timer to players */
  showTimer: boolean;

  /** Warning threshold (milliseconds before timeout) */
  warningThresholdMs: number;
}

/**
 * @summary Casual timeout strategy.
 *
 * @description
 * Generous timeouts for relaxed play with friends.
 * Good for learning the game or playing casually.
 */
export const CASUAL_STRATEGY: TimeoutStrategyConfig = {
  type: 'casual',
  name: 'Casual',
  description: 'Relaxed timeouts for casual play',
  timeouts: {
    nightAction: 90000,    // 90 seconds
    statement: 180000,     // 3 minutes
    vote: 90000,           // 90 seconds
    reconnection: 60000,   // 1 minute
    lobbyReady: 300000     // 5 minutes
  },
  useAIFallback: false,
  showTimer: true,
  warningThresholdMs: 15000
};

/**
 * @summary Competitive timeout strategy.
 *
 * @description
 * Balanced timeouts for standard play.
 * Keeps the game moving without being too strict.
 */
export const COMPETITIVE_STRATEGY: TimeoutStrategyConfig = {
  type: 'competitive',
  name: 'Competitive',
  description: 'Balanced timeouts for standard play',
  timeouts: {
    nightAction: 30000,    // 30 seconds
    statement: 60000,      // 1 minute
    vote: 30000,           // 30 seconds
    reconnection: 30000,   // 30 seconds
    lobbyReady: 120000     // 2 minutes
  },
  useAIFallback: true,
  showTimer: true,
  warningThresholdMs: 10000
};

/**
 * @summary Tournament timeout strategy.
 *
 * @description
 * Strict timeouts for competitive tournament play.
 * Keeps games on schedule and tests quick thinking.
 */
export const TOURNAMENT_STRATEGY: TimeoutStrategyConfig = {
  type: 'tournament',
  name: 'Tournament',
  description: 'Strict timeouts for competitive play',
  timeouts: {
    nightAction: 15000,    // 15 seconds
    statement: 30000,      // 30 seconds
    vote: 15000,           // 15 seconds
    reconnection: 15000,   // 15 seconds
    lobbyReady: 60000      // 1 minute
  },
  useAIFallback: true,
  showTimer: true,
  warningThresholdMs: 5000
};

/**
 * @summary All predefined strategies.
 */
export const PREDEFINED_STRATEGIES: Record<TimeoutStrategyType, TimeoutStrategyConfig> = {
  casual: CASUAL_STRATEGY,
  competitive: COMPETITIVE_STRATEGY,
  tournament: TOURNAMENT_STRATEGY,
  custom: COMPETITIVE_STRATEGY // Default for custom
};

/**
 * @summary Interface for timeout strategies.
 *
 * @pattern Strategy Pattern - Strategy interface
 */
export interface ITimeoutStrategy {
  /** Strategy configuration */
  readonly config: TimeoutStrategyConfig;

  /**
   * @summary Gets the timeout for an action type.
   *
   * @param {TimeoutActionType} action - Action type
   *
   * @returns {number} Timeout in milliseconds
   */
  getTimeout(action: TimeoutActionType): number;

  /**
   * @summary Gets the warning threshold.
   *
   * @returns {number} Warning threshold in milliseconds
   */
  getWarningThreshold(): number;

  /**
   * @summary Whether to use AI fallback on timeout.
   *
   * @returns {boolean} True if AI fallback enabled
   */
  shouldUseAIFallback(): boolean;

  /**
   * @summary Converts to TimeoutConfig for RemoteHumanPlayer.
   *
   * @returns {TimeoutConfig} Player timeout config
   */
  toTimeoutConfig(): TimeoutConfig;
}

/**
 * @summary Timeout strategy implementation.
 *
 * @description
 * Provides timeout values based on strategy configuration.
 *
 * @pattern Strategy Pattern - Concrete strategy
 *
 * @example
 * ```typescript
 * const strategy = new TimeoutStrategy(COMPETITIVE_STRATEGY);
 * const nightTimeout = strategy.getTimeout('nightAction');
 * ```
 */
export class TimeoutStrategy implements ITimeoutStrategy {
  /** @inheritdoc */
  readonly config: TimeoutStrategyConfig;

  /**
   * @summary Creates a new timeout strategy.
   *
   * @param {TimeoutStrategyConfig} config - Strategy configuration
   */
  constructor(config: TimeoutStrategyConfig) {
    this.config = { ...config };
  }

  /** @inheritdoc */
  getTimeout(action: TimeoutActionType): number {
    return this.config.timeouts[action];
  }

  /** @inheritdoc */
  getWarningThreshold(): number {
    return this.config.warningThresholdMs;
  }

  /** @inheritdoc */
  shouldUseAIFallback(): boolean {
    return this.config.useAIFallback;
  }

  /** @inheritdoc */
  toTimeoutConfig(): TimeoutConfig {
    return {
      nightActionMs: this.config.timeouts.nightAction,
      statementMs: this.config.timeouts.statement,
      voteMs: this.config.timeouts.vote,
      useAIFallback: this.config.useAIFallback
    };
  }

  /**
   * @summary Creates a modified copy with different timeout.
   *
   * @param {TimeoutActionType} action - Action to modify
   * @param {number} timeoutMs - New timeout value
   *
   * @returns {TimeoutStrategy} New strategy with modified timeout
   */
  withTimeout(action: TimeoutActionType, timeoutMs: number): TimeoutStrategy {
    return new TimeoutStrategy({
      ...this.config,
      type: 'custom',
      timeouts: {
        ...this.config.timeouts,
        [action]: timeoutMs
      }
    });
  }

  /**
   * @summary Creates a modified copy with AI fallback setting.
   *
   * @param {boolean} useAI - Whether to use AI fallback
   *
   * @returns {TimeoutStrategy} New strategy with modified setting
   */
  withAIFallback(useAI: boolean): TimeoutStrategy {
    return new TimeoutStrategy({
      ...this.config,
      type: 'custom',
      useAIFallback: useAI
    });
  }
}

/**
 * @summary Factory for creating timeout strategies.
 *
 * @pattern Factory Pattern - Creates strategy instances
 *
 * @example
 * ```typescript
 * const strategy = TimeoutStrategyFactory.create('tournament');
 *
 * const custom = TimeoutStrategyFactory.createCustom({
 *   ...COMPETITIVE_STRATEGY.timeouts,
 *   nightAction: 45000
 * });
 * ```
 */
export class TimeoutStrategyFactory {
  /**
   * @summary Creates a predefined strategy.
   *
   * @param {TimeoutStrategyType} type - Strategy type
   *
   * @returns {TimeoutStrategy} Strategy instance
   *
   * @example
   * ```typescript
   * const casual = TimeoutStrategyFactory.create('casual');
   * const competitive = TimeoutStrategyFactory.create('competitive');
   * ```
   */
  static create(type: TimeoutStrategyType): TimeoutStrategy {
    const config = PREDEFINED_STRATEGIES[type] ?? PREDEFINED_STRATEGIES.competitive;
    return new TimeoutStrategy(config);
  }

  /**
   * @summary Creates a custom strategy with specified timeouts.
   *
   * @param {Partial<Record<TimeoutActionType, number>>} timeouts - Custom timeouts
   * @param {boolean} [useAIFallback=true] - Whether to use AI fallback
   *
   * @returns {TimeoutStrategy} Custom strategy
   *
   * @example
   * ```typescript
   * const custom = TimeoutStrategyFactory.createCustom({
   *   nightAction: 45000,
   *   statement: 90000
   * });
   * ```
   */
  static createCustom(
    timeouts: Partial<Record<TimeoutActionType, number>>,
    useAIFallback: boolean = true
  ): TimeoutStrategy {
    const base = PREDEFINED_STRATEGIES.competitive;

    return new TimeoutStrategy({
      type: 'custom',
      name: 'Custom',
      description: 'Custom timeout configuration',
      timeouts: {
        ...base.timeouts,
        ...timeouts
      },
      useAIFallback,
      showTimer: true,
      warningThresholdMs: 10000
    });
  }

  /**
   * @summary Creates a strategy from a base with modifications.
   *
   * @param {TimeoutStrategyType} baseType - Base strategy type
   * @param {Partial<TimeoutStrategyConfig>} modifications - Modifications
   *
   * @returns {TimeoutStrategy} Modified strategy
   *
   * @example
   * ```typescript
   * const modified = TimeoutStrategyFactory.createModified('competitive', {
   *   warningThresholdMs: 15000,
   *   useAIFallback: false
   * });
   * ```
   */
  static createModified(
    baseType: TimeoutStrategyType,
    modifications: Partial<TimeoutStrategyConfig>
  ): TimeoutStrategy {
    const base = PREDEFINED_STRATEGIES[baseType];

    return new TimeoutStrategy({
      ...base,
      ...modifications,
      type: 'custom',
      timeouts: {
        ...base.timeouts,
        ...(modifications.timeouts ?? {})
      }
    });
  }

  /**
   * @summary Gets all available strategy types.
   *
   * @returns {TimeoutStrategyType[]} Strategy types
   */
  static getAvailableTypes(): TimeoutStrategyType[] {
    return ['casual', 'competitive', 'tournament'];
  }

  /**
   * @summary Gets strategy info for UI display.
   *
   * @returns {{ type: TimeoutStrategyType; name: string; description: string }[]} Strategy info
   */
  static getStrategyInfo(): Array<{
    type: TimeoutStrategyType;
    name: string;
    description: string;
  }> {
    return [
      { type: 'casual', name: 'Casual', description: CASUAL_STRATEGY.description },
      { type: 'competitive', name: 'Competitive', description: COMPETITIVE_STRATEGY.description },
      { type: 'tournament', name: 'Tournament', description: TOURNAMENT_STRATEGY.description }
    ];
  }
}

/**
 * @summary Timeout manager for a game session.
 *
 * @description
 * Manages timeout tracking for all players in a game.
 * Handles warnings, extensions, and timeout events.
 *
 * @example
 * ```typescript
 * const manager = new GameTimeoutManager(strategy);
 *
 * manager.startTimeout('player-1', 'nightAction', () => {
 *   // Handle timeout
 * });
 *
 * manager.onWarning((playerId, remaining) => {
 *   // Show warning to player
 * });
 * ```
 */
export class GameTimeoutManager {
  /** Timeout strategy */
  private readonly strategy: ITimeoutStrategy;

  /** Active timeouts by player ID */
  private readonly activeTimeouts: Map<string, {
    action: TimeoutActionType;
    startedAt: number;
    handle: ReturnType<typeof setTimeout>;
    warningHandle: ReturnType<typeof setTimeout> | null;
  }> = new Map();

  /** Warning handlers */
  private readonly warningHandlers: Set<(playerId: string, remainingMs: number) => void> = new Set();

  /**
   * @summary Creates a new timeout manager.
   *
   * @param {ITimeoutStrategy} strategy - Timeout strategy to use
   */
  constructor(strategy: ITimeoutStrategy) {
    this.strategy = strategy;
  }

  /**
   * @summary Starts a timeout for a player action.
   *
   * @param {string} playerId - Player ID
   * @param {TimeoutActionType} action - Action type
   * @param {() => void} onTimeout - Callback when timeout occurs
   *
   * @returns {() => void} Cancel function
   */
  startTimeout(
    playerId: string,
    action: TimeoutActionType,
    onTimeout: () => void
  ): () => void {
    // Cancel any existing timeout for this player
    this.cancelTimeout(playerId);

    const timeoutMs = this.strategy.getTimeout(action);
    const warningMs = this.strategy.getWarningThreshold();
    const startedAt = Date.now();

    // Set main timeout
    const handle = setTimeout(() => {
      this.activeTimeouts.delete(playerId);
      onTimeout();
    }, timeoutMs);

    // Set warning timeout if applicable
    let warningHandle: ReturnType<typeof setTimeout> | null = null;
    if (warningMs > 0 && timeoutMs > warningMs) {
      warningHandle = setTimeout(() => {
        this.emitWarning(playerId, warningMs);
      }, timeoutMs - warningMs);
    }

    this.activeTimeouts.set(playerId, {
      action,
      startedAt,
      handle,
      warningHandle
    });

    return () => this.cancelTimeout(playerId);
  }

  /**
   * @summary Cancels a player's timeout.
   *
   * @param {string} playerId - Player ID
   */
  cancelTimeout(playerId: string): void {
    const timeout = this.activeTimeouts.get(playerId);
    if (timeout) {
      clearTimeout(timeout.handle);
      if (timeout.warningHandle) {
        clearTimeout(timeout.warningHandle);
      }
      this.activeTimeouts.delete(playerId);
    }
  }

  /**
   * @summary Gets remaining time for a player's timeout.
   *
   * @param {string} playerId - Player ID
   *
   * @returns {number} Remaining time in ms, or 0 if no active timeout
   */
  getRemainingTime(playerId: string): number {
    const timeout = this.activeTimeouts.get(playerId);
    if (!timeout) {
      return 0;
    }

    const timeoutMs = this.strategy.getTimeout(timeout.action);
    const elapsed = Date.now() - timeout.startedAt;
    return Math.max(0, timeoutMs - elapsed);
  }

  /**
   * @summary Registers a warning handler.
   *
   * @param {(playerId: string, remainingMs: number) => void} handler - Warning handler
   *
   * @returns {() => void} Unsubscribe function
   */
  onWarning(handler: (playerId: string, remainingMs: number) => void): () => void {
    this.warningHandlers.add(handler);
    return () => this.warningHandlers.delete(handler);
  }

  /**
   * @summary Emits a warning event.
   *
   * @param {string} playerId - Player ID
   * @param {number} remainingMs - Remaining time
   *
   * @private
   */
  private emitWarning(playerId: string, remainingMs: number): void {
    for (const handler of this.warningHandlers) {
      try {
        handler(playerId, remainingMs);
      } catch (error) {
        console.error('Error in warning handler:', error);
      }
    }
  }

  /**
   * @summary Cancels all active timeouts.
   */
  cancelAll(): void {
    for (const playerId of this.activeTimeouts.keys()) {
      this.cancelTimeout(playerId);
    }
  }
}
