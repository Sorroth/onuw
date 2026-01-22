/**
 * @fileoverview Manages player disconnection and reconnection.
 * @module server/ReconnectionManager
 *
 * @summary Handles graceful disconnection and reconnection scenarios.
 *
 * @description
 * ReconnectionManager provides:
 * - Grace period for disconnected players
 * - AI takeover when grace period expires
 * - State preservation for reconnecting players
 * - Seamless resumption of play
 *
 * @pattern Memento Pattern - Preserves player state for restoration
 * @pattern Strategy Pattern - Different reconnection policies
 *
 * @example
 * ```typescript
 * const manager = new ReconnectionManager({
 *   gracePeriodMs: 30000,
 *   maxDisconnectedPlayers: 2
 * });
 *
 * manager.handleDisconnection(playerId, room);
 * // ... later ...
 * manager.handleReconnection(playerId, newConnection);
 * ```
 */

import { PlayerId, RoomCode } from '../network/protocol';
import { IClientConnection } from '../network/IClientConnection';
import { Room, RoomStatus } from './Room';
import { NightActionResult } from '../types';

/**
 * @summary Reconnection manager configuration.
 */
export interface ReconnectionConfig {
  /** Grace period before AI takeover in milliseconds */
  gracePeriodMs: number;

  /** Maximum disconnected players per room */
  maxDisconnectedPlayers: number;

  /** Whether to allow reconnection after AI takeover */
  allowPostTakeoverReconnection: boolean;

  /** How long to keep player state after game ends (milliseconds) */
  stateRetentionMs: number;
}

/**
 * @summary Default reconnection configuration.
 */
export const DEFAULT_RECONNECTION_CONFIG: ReconnectionConfig = {
  gracePeriodMs: 30000, // 30 seconds
  maxDisconnectedPlayers: 2,
  allowPostTakeoverReconnection: true,
  stateRetentionMs: 300000 // 5 minutes
};

/**
 * @summary Disconnection status.
 */
export enum DisconnectionStatus {
  /** Within grace period, awaiting reconnection */
  GRACE_PERIOD = 'gracePeriod',

  /** AI has taken over */
  AI_TAKEOVER = 'aiTakeover',

  /** Player reconnected */
  RECONNECTED = 'reconnected',

  /** Grace period expired, player removed */
  EXPIRED = 'expired'
}

/**
 * @summary Preserved state for a disconnected player.
 *
 * @pattern Memento Pattern - Captures player state for restoration
 */
export interface DisconnectedPlayerState {
  /** Player ID */
  playerId: PlayerId;

  /** Room code */
  roomCode: RoomCode;

  /** When disconnection occurred */
  disconnectedAt: number;

  /** Night action information received */
  nightInfo: NightActionResult[];

  /** Current status */
  status: DisconnectionStatus;

  /** Grace period timeout handle */
  graceTimeout: ReturnType<typeof setTimeout> | null;

  /** Player name for display */
  playerName: string;
}

/**
 * @summary Handler for reconnection events.
 */
export type ReconnectionEventHandler = (event: ReconnectionEvent) => void;

/**
 * @summary Reconnection event types.
 */
export type ReconnectionEventType =
  | 'playerDisconnected'
  | 'gracePeriodStarted'
  | 'gracePeriodExpired'
  | 'aiTakeover'
  | 'playerReconnected';

/**
 * @summary Reconnection event data.
 */
export interface ReconnectionEvent {
  type: ReconnectionEventType;
  playerId: PlayerId;
  roomCode: RoomCode;
  timestamp: number;
  data?: Record<string, unknown>;
}

/**
 * @summary Manages player disconnection and reconnection.
 *
 * @description
 * Handles the complex scenarios around player disconnection in
 * multiplayer games:
 * - Starts grace period when player disconnects
 * - Triggers AI takeover when grace period expires
 * - Restores player state when they reconnect
 * - Cleans up state for players who don't return
 *
 * @pattern Memento Pattern - Preserves and restores player state
 * @pattern Observer Pattern - Notifies of reconnection events
 *
 * @example
 * ```typescript
 * const manager = new ReconnectionManager({
 *   gracePeriodMs: 30000
 * });
 *
 * // When player disconnects
 * manager.handleDisconnection('player-1', room, nightInfo);
 *
 * // Check if can reconnect
 * if (manager.canReconnect('player-1')) {
 *   const state = manager.handleReconnection('player-1', newConnection);
 *   // Restore player state
 * }
 * ```
 */
export class ReconnectionManager {
  /** Configuration */
  private readonly config: ReconnectionConfig;

  /** Disconnected player states by player ID */
  private readonly disconnectedPlayers: Map<PlayerId, DisconnectedPlayerState> = new Map();

  /** Event handlers */
  private readonly eventHandlers: Set<ReconnectionEventHandler> = new Set();

  /** Cleanup interval handle */
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  /**
   * @summary Creates a new reconnection manager.
   *
   * @param {Partial<ReconnectionConfig>} [config] - Configuration options
   *
   * @example
   * ```typescript
   * const manager = new ReconnectionManager({
   *   gracePeriodMs: 60000, // 1 minute
   *   allowPostTakeoverReconnection: false
   * });
   * ```
   */
  constructor(config: Partial<ReconnectionConfig> = {}) {
    this.config = { ...DEFAULT_RECONNECTION_CONFIG, ...config };
  }

  /**
   * @summary Starts the periodic cleanup.
   */
  startCleanup(): void {
    if (this.cleanupInterval) {
      return;
    }

    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredStates();
    }, 60000); // Check every minute
  }

  /**
   * @summary Stops the periodic cleanup.
   */
  stopCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * @summary Handles a player disconnection.
   *
   * @description
   * Called when a player disconnects from a game in progress.
   * Starts grace period and preserves player state.
   *
   * @param {PlayerId} playerId - Disconnected player
   * @param {Room} room - Room the player was in
   * @param {NightActionResult[]} nightInfo - Player's night info to preserve
   * @param {string} playerName - Player's display name
   *
   * @example
   * ```typescript
   * connection.onDisconnect(() => {
   *   manager.handleDisconnection(
   *     playerId,
   *     room,
   *     player.getNightInfo(),
   *     player.name
   *   );
   * });
   * ```
   */
  handleDisconnection(
    playerId: PlayerId,
    room: Room,
    nightInfo: NightActionResult[],
    playerName: string
  ): void {
    // Only handle disconnections during active games
    if (room.getStatus() !== RoomStatus.PLAYING) {
      return;
    }

    // Check if already tracking this player
    if (this.disconnectedPlayers.has(playerId)) {
      return;
    }

    // Check max disconnected players limit
    const roomDisconnected = this.getDisconnectedPlayersInRoom(room.getCode());
    if (roomDisconnected.length >= this.config.maxDisconnectedPlayers) {
      // Too many disconnected, trigger immediate AI takeover
      this.triggerAITakeover(playerId, room.getCode());
      return;
    }

    // Create state snapshot
    const state: DisconnectedPlayerState = {
      playerId,
      roomCode: room.getCode(),
      disconnectedAt: Date.now(),
      nightInfo: [...nightInfo],
      status: DisconnectionStatus.GRACE_PERIOD,
      graceTimeout: null,
      playerName
    };

    // Start grace period
    state.graceTimeout = setTimeout(() => {
      this.handleGracePeriodExpired(playerId);
    }, this.config.gracePeriodMs);

    this.disconnectedPlayers.set(playerId, state);

    // Emit events
    this.emitEvent('playerDisconnected', playerId, room.getCode());
    this.emitEvent('gracePeriodStarted', playerId, room.getCode(), {
      gracePeriodMs: this.config.gracePeriodMs,
      expiresAt: Date.now() + this.config.gracePeriodMs
    });
  }

  /**
   * @summary Handles grace period expiration.
   *
   * @param {PlayerId} playerId - Player whose grace period expired
   *
   * @private
   */
  private handleGracePeriodExpired(playerId: PlayerId): void {
    const state = this.disconnectedPlayers.get(playerId);
    if (!state || state.status !== DisconnectionStatus.GRACE_PERIOD) {
      return;
    }

    this.emitEvent('gracePeriodExpired', playerId, state.roomCode);
    this.triggerAITakeover(playerId, state.roomCode);
  }

  /**
   * @summary Triggers AI takeover for a player.
   *
   * @param {PlayerId} playerId - Player to replace with AI
   * @param {RoomCode} roomCode - Room code
   *
   * @private
   */
  private triggerAITakeover(playerId: PlayerId, roomCode: RoomCode): void {
    const state = this.disconnectedPlayers.get(playerId);
    if (!state) {
      return;
    }

    // Clear grace timeout if any
    if (state.graceTimeout) {
      clearTimeout(state.graceTimeout);
      state.graceTimeout = null;
    }

    state.status = DisconnectionStatus.AI_TAKEOVER;

    this.emitEvent('aiTakeover', playerId, roomCode);

    // If not allowing post-takeover reconnection, clean up
    if (!this.config.allowPostTakeoverReconnection) {
      this.disconnectedPlayers.delete(playerId);
    }
  }

  /**
   * @summary Checks if a player can reconnect.
   *
   * @param {PlayerId} playerId - Player ID
   *
   * @returns {boolean} True if reconnection is possible
   *
   * @example
   * ```typescript
   * if (manager.canReconnect(playerId)) {
   *   // Allow reconnection
   * } else {
   *   // Send error message
   * }
   * ```
   */
  canReconnect(playerId: PlayerId): boolean {
    const state = this.disconnectedPlayers.get(playerId);
    if (!state) {
      return false;
    }

    if (state.status === DisconnectionStatus.GRACE_PERIOD) {
      return true;
    }

    if (state.status === DisconnectionStatus.AI_TAKEOVER) {
      return this.config.allowPostTakeoverReconnection;
    }

    return false;
  }

  /**
   * @summary Gets the reconnection status for a player.
   *
   * @param {PlayerId} playerId - Player ID
   *
   * @returns {DisconnectionStatus | null} Status or null if not tracked
   */
  getStatus(playerId: PlayerId): DisconnectionStatus | null {
    const state = this.disconnectedPlayers.get(playerId);
    return state?.status ?? null;
  }

  /**
   * @summary Gets preserved state for a player.
   *
   * @param {PlayerId} playerId - Player ID
   *
   * @returns {DisconnectedPlayerState | null} State or null
   */
  getPlayerState(playerId: PlayerId): DisconnectedPlayerState | null {
    return this.disconnectedPlayers.get(playerId) ?? null;
  }

  /**
   * @summary Handles a player reconnection.
   *
   * @description
   * Called when a disconnected player returns. Restores their state
   * and cancels AI takeover if still in grace period.
   *
   * @param {PlayerId} playerId - Reconnecting player
   * @param {IClientConnection} newConnection - New connection
   *
   * @returns {DisconnectedPlayerState | null} Preserved state or null
   *
   * @example
   * ```typescript
   * const state = manager.handleReconnection(playerId, connection);
   * if (state) {
   *   // Send catch-up info
   *   player.onReconnected(state.nightInfo);
   * }
   * ```
   */
  handleReconnection(
    playerId: PlayerId,
    newConnection: IClientConnection
  ): DisconnectedPlayerState | null {
    const state = this.disconnectedPlayers.get(playerId);
    if (!state) {
      return null;
    }

    if (!this.canReconnect(playerId)) {
      return null;
    }

    // Clear grace timeout if any
    if (state.graceTimeout) {
      clearTimeout(state.graceTimeout);
      state.graceTimeout = null;
    }

    // Check if AI takeover happened before marking as reconnected
    const wasAITakeover = state.status === DisconnectionStatus.AI_TAKEOVER;

    // Mark as reconnected
    state.status = DisconnectionStatus.RECONNECTED;

    this.emitEvent('playerReconnected', playerId, state.roomCode, {
      wasAITakeover
    });

    // Return state for restoration (don't delete yet, may need it)
    return state;
  }

  /**
   * @summary Completes a reconnection.
   *
   * @description
   * Called after player state has been fully restored.
   * Cleans up tracking data.
   *
   * @param {PlayerId} playerId - Reconnected player
   */
  completeReconnection(playerId: PlayerId): void {
    this.disconnectedPlayers.delete(playerId);
  }

  /**
   * @summary Gets all disconnected players in a room.
   *
   * @param {RoomCode} roomCode - Room code
   *
   * @returns {DisconnectedPlayerState[]} Disconnected players
   */
  getDisconnectedPlayersInRoom(roomCode: RoomCode): DisconnectedPlayerState[] {
    const result: DisconnectedPlayerState[] = [];

    for (const state of this.disconnectedPlayers.values()) {
      if (state.roomCode === roomCode) {
        result.push(state);
      }
    }

    return result;
  }

  /**
   * @summary Gets remaining grace time for a player.
   *
   * @param {PlayerId} playerId - Player ID
   *
   * @returns {number} Remaining time in ms, or 0 if not in grace period
   */
  getRemainingGraceTime(playerId: PlayerId): number {
    const state = this.disconnectedPlayers.get(playerId);
    if (!state || state.status !== DisconnectionStatus.GRACE_PERIOD) {
      return 0;
    }

    const elapsed = Date.now() - state.disconnectedAt;
    return Math.max(0, this.config.gracePeriodMs - elapsed);
  }

  /**
   * @summary Cleans up state for a room that ended.
   *
   * @param {RoomCode} roomCode - Room code
   */
  cleanupRoom(roomCode: RoomCode): void {
    for (const [playerId, state] of this.disconnectedPlayers.entries()) {
      if (state.roomCode === roomCode) {
        if (state.graceTimeout) {
          clearTimeout(state.graceTimeout);
        }
        this.disconnectedPlayers.delete(playerId);
      }
    }
  }

  /**
   * @summary Cleans up expired player states.
   *
   * @private
   */
  private cleanupExpiredStates(): void {
    const now = Date.now();

    for (const [playerId, state] of this.disconnectedPlayers.entries()) {
      // Remove reconnected players after retention period
      if (state.status === DisconnectionStatus.RECONNECTED) {
        this.disconnectedPlayers.delete(playerId);
        continue;
      }

      // Remove AI takeover states after retention period
      if (state.status === DisconnectionStatus.AI_TAKEOVER) {
        const elapsed = now - state.disconnectedAt;
        if (elapsed > this.config.stateRetentionMs) {
          this.disconnectedPlayers.delete(playerId);
        }
      }
    }
  }

  /**
   * @summary Registers an event handler.
   *
   * @param {ReconnectionEventHandler} handler - Handler function
   *
   * @returns {() => void} Unsubscribe function
   */
  onEvent(handler: ReconnectionEventHandler): () => void {
    this.eventHandlers.add(handler);
    return () => this.eventHandlers.delete(handler);
  }

  /**
   * @summary Emits a reconnection event.
   *
   * @param {ReconnectionEventType} type - Event type
   * @param {PlayerId} playerId - Player ID
   * @param {RoomCode} roomCode - Room code
   * @param {Record<string, unknown>} [data] - Additional data
   *
   * @private
   */
  private emitEvent(
    type: ReconnectionEventType,
    playerId: PlayerId,
    roomCode: RoomCode,
    data?: Record<string, unknown>
  ): void {
    const event: ReconnectionEvent = {
      type,
      playerId,
      roomCode,
      timestamp: Date.now(),
      data
    };

    for (const handler of this.eventHandlers) {
      try {
        handler(event);
      } catch (error) {
        console.error('Error in reconnection event handler:', error);
      }
    }
  }

  /**
   * @summary Shuts down the manager.
   */
  shutdown(): void {
    this.stopCleanup();

    // Clear all timeouts
    for (const state of this.disconnectedPlayers.values()) {
      if (state.graceTimeout) {
        clearTimeout(state.graceTimeout);
      }
    }

    this.disconnectedPlayers.clear();
  }
}
