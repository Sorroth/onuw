/**
 * @fileoverview Room manager for multiplayer lobby.
 * @module server/RoomManager
 *
 * @summary Manages all game rooms in the server.
 *
 * @description
 * RoomManager is responsible for:
 * - Creating and destroying rooms
 * - Looking up rooms by code
 * - Tracking room lifecycles
 * - Cleaning up inactive rooms
 *
 * @pattern Repository Pattern - Central store for room instances
 * @pattern Factory Pattern - Creates room instances
 *
 * @example
 * ```typescript
 * const manager = new RoomManager();
 *
 * // Create room
 * const room = manager.createRoom('host-1', config);
 *
 * // Find room by code
 * const found = manager.getRoom(room.getCode());
 *
 * // Clean up old rooms
 * manager.cleanupInactiveRooms();
 * ```
 */

import { Room, RoomStatus, generateRoomCode, RoomEvent } from './Room';
import { RoomCode, RoomConfig, PlayerId, RoomSummary, DebugOptions } from '../network/protocol';

/**
 * @summary Room manager configuration.
 */
export interface RoomManagerConfig {
  /** Maximum rooms allowed */
  maxRooms: number;

  /** Room timeout in milliseconds (for inactive waiting rooms) */
  roomTimeoutMs: number;

  /** How often to check for inactive rooms (milliseconds) */
  cleanupIntervalMs: number;

  /** Maximum room code generation attempts */
  maxCodeAttempts: number;
}

/**
 * @summary Default room manager configuration.
 */
export const DEFAULT_ROOM_MANAGER_CONFIG: RoomManagerConfig = {
  maxRooms: 100,
  roomTimeoutMs: 3600000, // 1 hour
  cleanupIntervalMs: 60000, // 1 minute
  maxCodeAttempts: 10
};

/**
 * @summary Handler for room manager events.
 */
export type RoomManagerEventHandler = (event: RoomManagerEvent) => void;

/**
 * @summary Room manager event types.
 */
export type RoomManagerEventType =
  | 'roomCreated'
  | 'roomClosed'
  | 'roomCleanedUp';

/**
 * @summary Room manager event.
 */
export interface RoomManagerEvent {
  type: RoomManagerEventType;
  roomCode: RoomCode;
  timestamp: number;
}

/**
 * @summary Manages all game rooms.
 *
 * @description
 * Central repository for room instances. Handles room creation,
 * lookup, and lifecycle management.
 *
 * @pattern Repository Pattern - Stores and retrieves rooms
 * @pattern Factory Pattern - Creates room instances
 *
 * @example
 * ```typescript
 * const manager = new RoomManager({
 *   maxRooms: 50,
 *   roomTimeoutMs: 1800000 // 30 minutes
 * });
 *
 * manager.onEvent((event) => {
 *   console.log(`Room ${event.type}: ${event.roomCode}`);
 * });
 *
 * const room = manager.createRoom('host-1', config);
 * console.log(`Room created: ${room.getCode()}`);
 * ```
 */
export class RoomManager {
  /** Configuration */
  private readonly config: RoomManagerConfig;

  /** Active rooms by code */
  private readonly rooms: Map<RoomCode, Room> = new Map();

  /** Event handlers */
  private readonly eventHandlers: Set<RoomManagerEventHandler> = new Set();

  /** Cleanup interval handle */
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  /**
   * @summary Creates a new room manager.
   *
   * @param {Partial<RoomManagerConfig>} [config] - Configuration options
   *
   * @example
   * ```typescript
   * const manager = new RoomManager({
   *   maxRooms: 50,
   *   roomTimeoutMs: 1800000
   * });
   * ```
   */
  constructor(config: Partial<RoomManagerConfig> = {}) {
    this.config = { ...DEFAULT_ROOM_MANAGER_CONFIG, ...config };
  }

  /**
   * @summary Starts the cleanup timer.
   *
   * @description
   * Periodically checks for and removes inactive rooms.
   */
  startCleanupTimer(): void {
    if (this.cleanupInterval) {
      return;
    }

    this.cleanupInterval = setInterval(() => {
      this.cleanupInactiveRooms();
    }, this.config.cleanupIntervalMs);
  }

  /**
   * @summary Stops the cleanup timer.
   */
  stopCleanupTimer(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * @summary Creates a new room.
   *
   * @param {PlayerId} hostId - ID of the host player
   * @param {RoomConfig} config - Room configuration
   *
   * @returns {Room} The created room
   *
   * @throws {Error} If maximum rooms reached or code generation fails
   *
   * @example
   * ```typescript
   * const room = manager.createRoom('host-1', {
   *   roles: [RoleName.WEREWOLF, RoleName.SEER, ...],
   *   minPlayers: 3,
   *   maxPlayers: 6
   * });
   *
   * console.log(`Join code: ${room.getCode()}`);
   * ```
   */
  createRoom(hostId: PlayerId, config: RoomConfig, debugOptions?: DebugOptions): Room {
    if (this.rooms.size >= this.config.maxRooms) {
      throw new Error('Maximum number of rooms reached');
    }

    // Generate unique room code
    let code: RoomCode;
    let attempts = 0;

    do {
      code = generateRoomCode();
      attempts++;

      if (attempts > this.config.maxCodeAttempts) {
        throw new Error('Failed to generate unique room code');
      }
    } while (this.rooms.has(code));

    // Create room (with debug options if provided)
    const room = new Room(hostId, config, code, debugOptions);

    // Track room events
    room.onEvent((event) => {
      if (event.type === 'roomClosed') {
        this.handleRoomClosed(code);
      }
    });

    // Store room
    this.rooms.set(code, room);

    // Emit event
    this.emitEvent('roomCreated', code);

    return room;
  }

  /**
   * @summary Gets a room by code.
   *
   * @param {RoomCode} code - Room code
   *
   * @returns {Room | undefined} Room if found
   *
   * @example
   * ```typescript
   * const room = manager.getRoom('ABC123');
   * if (room) {
   *   room.addPlayer('player-1', connection);
   * }
   * ```
   */
  getRoom(code: RoomCode): Room | undefined {
    return this.rooms.get(code);
  }

  /**
   * @summary Checks if a room exists.
   *
   * @param {RoomCode} code - Room code
   *
   * @returns {boolean} True if room exists
   */
  hasRoom(code: RoomCode): boolean {
    return this.rooms.has(code);
  }

  /**
   * @summary Gets all active rooms.
   *
   * @returns {Room[]} Array of rooms
   */
  getAllRooms(): Room[] {
    return Array.from(this.rooms.values());
  }

  /**
   * @summary Gets the number of active rooms.
   *
   * @returns {number} Room count
   */
  getRoomCount(): number {
    return this.rooms.size;
  }

  /**
   * @summary Gets rooms in waiting state.
   *
   * @returns {Room[]} Waiting rooms
   */
  getWaitingRooms(): Room[] {
    return Array.from(this.rooms.values()).filter(
      room => room.getStatus() === RoomStatus.WAITING
    );
  }

  /**
   * @summary Gets public rooms that are waiting for players.
   *
   * @description
   * Returns rooms where isPrivate=false and status=WAITING.
   * Used for the public room browser feature.
   *
   * @returns {Room[]} Public waiting rooms
   *
   * @pattern Information Hiding - Only exposes joinable public rooms
   */
  getPublicRooms(): Room[] {
    return Array.from(this.rooms.values()).filter(
      room => room.getStatus() === RoomStatus.WAITING && !room.getConfig().isPrivate
    );
  }

  /**
   * @summary Gets rooms that are currently playing.
   *
   * @returns {Room[]} Playing rooms
   */
  getPlayingRooms(): Room[] {
    return Array.from(this.rooms.values()).filter(
      room => room.getStatus() === RoomStatus.PLAYING
    );
  }

  /**
   * @summary Gets room summaries for lobby display.
   *
   * @returns {RoomSummary[]} Array of room summaries
   *
   * @example
   * ```typescript
   * const summaries = manager.getRoomSummaries();
   * // Display in lobby UI
   * ```
   */
  getRoomSummaries(): RoomSummary[] {
    return Array.from(this.rooms.values())
      .filter(room => room.getStatus() === RoomStatus.WAITING)
      .map(room => ({
        roomCode: room.getCode(),
        hostName: room.getPlayer(room.getHostId())?.name ?? 'Unknown',
        playerCount: room.getPlayerCount(),
        maxPlayers: room.getConfig().maxPlayers,
        roles: room.getConfig().roles
      }));
  }

  /**
   * @summary Closes a room.
   *
   * @param {RoomCode} code - Room code
   * @param {string} [reason] - Reason for closing
   *
   * @returns {boolean} True if room was found and closed
   */
  closeRoom(code: RoomCode, reason?: string): boolean {
    const room = this.rooms.get(code);
    if (!room) {
      return false;
    }

    room.close(reason);
    return true;
  }

  /**
   * @summary Handles room closed event.
   *
   * @param {RoomCode} code - Room code
   *
   * @private
   */
  private handleRoomClosed(code: RoomCode): void {
    this.rooms.delete(code);
    this.emitEvent('roomClosed', code);
  }

  /**
   * @summary Cleans up inactive rooms.
   *
   * @description
   * Removes rooms that have been in waiting state too long
   * or ended rooms.
   *
   * @returns {number} Number of rooms cleaned up
   */
  cleanupInactiveRooms(): number {
    const now = Date.now();
    let cleaned = 0;

    for (const [code, room] of this.rooms.entries()) {
      const status = room.getStatus();

      // Remove ended or closed rooms
      if (status === RoomStatus.ENDED || status === RoomStatus.CLOSED) {
        this.rooms.delete(code);
        this.emitEvent('roomCleanedUp', code);
        cleaned++;
        continue;
      }

      // Check for timeout on waiting rooms
      if (status === RoomStatus.WAITING) {
        const state = room.getState();
        // This is approximate since we don't track room creation time
        // In a real implementation, Room would expose createdAt
        if (room.getPlayerCount() === 0) {
          room.close('Room inactive');
          cleaned++;
        }
      }
    }

    return cleaned;
  }

  /**
   * @summary Finds a room that a player is in.
   *
   * @param {PlayerId} playerId - Player ID
   *
   * @returns {Room | undefined} Room if player found
   */
  findPlayerRoom(playerId: PlayerId): Room | undefined {
    for (const room of this.rooms.values()) {
      if (room.hasPlayer(playerId)) {
        return room;
      }
    }
    return undefined;
  }

  /**
   * @summary Registers an event handler.
   *
   * @param {RoomManagerEventHandler} handler - Handler function
   *
   * @returns {() => void} Unsubscribe function
   */
  onEvent(handler: RoomManagerEventHandler): () => void {
    this.eventHandlers.add(handler);
    return () => this.eventHandlers.delete(handler);
  }

  /**
   * @summary Emits a room manager event.
   *
   * @param {RoomManagerEventType} type - Event type
   * @param {RoomCode} roomCode - Room code
   *
   * @private
   */
  private emitEvent(type: RoomManagerEventType, roomCode: RoomCode): void {
    const event: RoomManagerEvent = {
      type,
      roomCode,
      timestamp: Date.now()
    };

    for (const handler of this.eventHandlers) {
      try {
        handler(event);
      } catch (error) {
        console.error('Error in room manager event handler:', error);
      }
    }
  }

  /**
   * @summary Shuts down the room manager.
   *
   * @description
   * Closes all rooms and stops cleanup timer.
   */
  shutdown(): void {
    this.stopCleanupTimer();

    for (const room of this.rooms.values()) {
      room.close('Server shutting down');
    }

    this.rooms.clear();
  }
}
