/**
 * @fileoverview Game room management for multiplayer lobby.
 * @module server/Room
 *
 * @summary Manages game rooms where players gather before games.
 *
 * @description
 * Room represents a game session from creation through completion:
 * - Players join with room codes
 * - Host configures game settings
 * - Game starts when all players are ready
 * - Room tracks game state and results
 *
 * @pattern Observer Pattern - Room state changes notify listeners
 * @pattern State Pattern - Room has distinct states (waiting, playing, ended)
 *
 * @example
 * ```typescript
 * const room = new Room('host-1', config);
 * room.addPlayer('player-2', connection2);
 * room.setPlayerReady('player-2', true);
 *
 * if (room.canStart()) {
 *   await room.startGame();
 * }
 * ```
 */

import { IClientConnection } from '../network/IClientConnection';
import {
  RoomCode,
  RoomConfig,
  RoomState,
  RoomPlayer,
  PlayerId,
  ServerMessage,
  createMessage
} from '../network/protocol';
import { RoleName } from '../enums';
import { Game } from '../core/Game';
import { GameConfig } from '../types';

/**
 * @summary Room state enumeration.
 */
export enum RoomStatus {
  /** Waiting for players to join */
  WAITING = 'waiting',

  /** Game is in progress */
  PLAYING = 'playing',

  /** Game has ended */
  ENDED = 'ended',

  /** Room is closed */
  CLOSED = 'closed'
}

/**
 * @summary Player info within a room.
 */
export interface RoomPlayerInfo {
  /** Player ID */
  id: PlayerId;

  /** Display name */
  name: string;

  /** Network connection */
  connection: IClientConnection;

  /** Whether player is ready to start */
  isReady: boolean;

  /** Whether this is an AI player */
  isAI: boolean;

  /** When player joined */
  joinedAt: number;
}

/**
 * @summary Room event types.
 */
export type RoomEventType =
  | 'playerJoined'
  | 'playerLeft'
  | 'playerReady'
  | 'configChanged'
  | 'gameStarted'
  | 'gameEnded'
  | 'roomClosed';

/**
 * @summary Room event data.
 */
export interface RoomEvent {
  type: RoomEventType;
  roomCode: RoomCode;
  data: Record<string, unknown>;
  timestamp: number;
}

/**
 * @summary Handler for room events.
 */
export type RoomEventHandler = (event: RoomEvent) => void;

/**
 * @summary Generates a random room code.
 *
 * @param {number} [length=6] - Code length
 *
 * @returns {RoomCode} Random room code
 */
export function generateRoomCode(length: number = 6): RoomCode {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Excluded confusing chars
  let code = '';
  for (let i = 0; i < length; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

/**
 * @summary Game room for multiplayer sessions.
 *
 * @description
 * Manages a single game session from lobby through completion.
 * Handles player management, game configuration, and state transitions.
 *
 * @pattern Observer Pattern - Notifies listeners of state changes
 * @pattern State Pattern - Distinct behavior for each room status
 *
 * @example
 * ```typescript
 * const room = new Room('host-1', {
 *   roles: [RoleName.WEREWOLF, RoleName.SEER, ...],
 *   minPlayers: 3,
 *   maxPlayers: 6
 * });
 *
 * room.onEvent((event) => {
 *   if (event.type === 'playerJoined') {
 *     broadcastRoomState(room);
 *   }
 * });
 *
 * const code = room.getCode();
 * // Share code with other players
 * ```
 */
export class Room {
  /** Unique room code for joining */
  private readonly code: RoomCode;

  /** Host player ID */
  private readonly hostId: PlayerId;

  /** Room configuration */
  private config: RoomConfig;

  /** Current room status */
  private status: RoomStatus = RoomStatus.WAITING;

  /** Players in the room */
  private readonly players: Map<PlayerId, RoomPlayerInfo> = new Map();

  /** Current game (if playing) */
  private game: Game | null = null;

  /** Event handlers */
  private readonly eventHandlers: Set<RoomEventHandler> = new Set();

  /** When room was created */
  private readonly createdAt: number;

  /** When game started (if applicable) */
  private gameStartedAt: number | null = null;

  /**
   * @summary Creates a new game room.
   *
   * @param {PlayerId} hostId - ID of the host player
   * @param {RoomConfig} config - Room configuration
   * @param {RoomCode} [code] - Optional specific room code
   *
   * @example
   * ```typescript
   * const room = new Room('host-1', {
   *   roles: [RoleName.WEREWOLF, RoleName.WEREWOLF, RoleName.SEER],
   *   minPlayers: 3,
   *   maxPlayers: 6,
   *   timeoutStrategy: 'competitive'
   * });
   * ```
   */
  constructor(hostId: PlayerId, config: RoomConfig, code?: RoomCode) {
    this.hostId = hostId;
    this.config = { ...config };
    this.code = code ?? generateRoomCode();
    this.createdAt = Date.now();
  }

  /**
   * @summary Gets the room code.
   *
   * @returns {RoomCode} Room code for joining
   */
  getCode(): RoomCode {
    return this.code;
  }

  /**
   * @summary Gets the host player ID.
   *
   * @returns {PlayerId} Host ID
   */
  getHostId(): PlayerId {
    return this.hostId;
  }

  /**
   * @summary Gets the room status.
   *
   * @returns {RoomStatus} Current status
   */
  getStatus(): RoomStatus {
    return this.status;
  }

  /**
   * @summary Gets the room configuration.
   *
   * @returns {RoomConfig} Room config
   */
  getConfig(): RoomConfig {
    return { ...this.config };
  }

  /**
   * @summary Gets the current game (if playing).
   *
   * @returns {Game | null} Game instance or null
   */
  getGame(): Game | null {
    return this.game;
  }

  /**
   * @summary Gets the number of players in the room.
   *
   * @returns {number} Player count
   */
  getPlayerCount(): number {
    return this.players.size;
  }

  /**
   * @summary Checks if a player is in the room.
   *
   * @param {PlayerId} playerId - Player to check
   *
   * @returns {boolean} True if player is in room
   */
  hasPlayer(playerId: PlayerId): boolean {
    return this.players.has(playerId);
  }

  /**
   * @summary Gets all players in the room.
   *
   * @returns {RoomPlayerInfo[]} Array of player info
   */
  getPlayers(): RoomPlayerInfo[] {
    return Array.from(this.players.values());
  }

  /**
   * @summary Gets a specific player's info.
   *
   * @param {PlayerId} playerId - Player ID
   *
   * @returns {RoomPlayerInfo | undefined} Player info if found
   */
  getPlayer(playerId: PlayerId): RoomPlayerInfo | undefined {
    return this.players.get(playerId);
  }

  /**
   * @summary Updates the room configuration.
   *
   * @description
   * Only the host can update configuration, and only while waiting.
   *
   * @param {PlayerId} requesterId - ID of player making request
   * @param {Partial<RoomConfig>} updates - Configuration updates
   *
   * @throws {Error} If not host or room is not waiting
   */
  updateConfig(requesterId: PlayerId, updates: Partial<RoomConfig>): void {
    if (requesterId !== this.hostId) {
      throw new Error('Only the host can update room configuration');
    }

    if (this.status !== RoomStatus.WAITING) {
      throw new Error('Cannot update configuration after game has started');
    }

    this.config = { ...this.config, ...updates };

    this.emitEvent('configChanged', {
      config: this.config
    });
  }

  /**
   * @summary Adds a player to the room.
   *
   * @param {PlayerId} playerId - Player ID
   * @param {string} name - Player name
   * @param {IClientConnection} connection - Player connection
   * @param {boolean} [isAI=false] - Whether this is an AI player
   *
   * @throws {Error} If room is full or not accepting players
   */
  addPlayer(
    playerId: PlayerId,
    name: string,
    connection: IClientConnection,
    isAI: boolean = false
  ): void {
    if (this.status !== RoomStatus.WAITING) {
      throw new Error('Room is not accepting new players');
    }

    if (this.players.size >= this.config.maxPlayers) {
      throw new Error('Room is full');
    }

    if (this.players.has(playerId)) {
      throw new Error('Player is already in the room');
    }

    const playerInfo: RoomPlayerInfo = {
      id: playerId,
      name,
      connection,
      isReady: isAI, // AI players are always ready
      isAI,
      joinedAt: Date.now()
    };

    this.players.set(playerId, playerInfo);

    this.emitEvent('playerJoined', {
      playerId,
      name,
      isAI
    });

    // Broadcast room state to all players
    this.broadcastRoomState();
  }

  /**
   * @summary Removes a player from the room.
   *
   * @param {PlayerId} playerId - Player to remove
   *
   * @throws {Error} If player is not in room
   */
  removePlayer(playerId: PlayerId): void {
    if (!this.players.has(playerId)) {
      throw new Error('Player is not in the room');
    }

    this.players.delete(playerId);

    this.emitEvent('playerLeft', {
      playerId
    });

    // If host left, close the room
    if (playerId === this.hostId && this.status === RoomStatus.WAITING) {
      this.close('Host left the room');
      return;
    }

    // Broadcast updated state
    this.broadcastRoomState();
  }

  /**
   * @summary Sets a player's ready status.
   *
   * @param {PlayerId} playerId - Player ID
   * @param {boolean} isReady - Ready status
   *
   * @throws {Error} If player not in room or room not waiting
   */
  setPlayerReady(playerId: PlayerId, isReady: boolean): void {
    const player = this.players.get(playerId);
    if (!player) {
      throw new Error('Player is not in the room');
    }

    if (this.status !== RoomStatus.WAITING) {
      throw new Error('Cannot change ready status after game has started');
    }

    player.isReady = isReady;

    this.emitEvent('playerReady', {
      playerId,
      isReady
    });

    this.broadcastRoomState();
  }

  /**
   * @summary Checks if the game can be started.
   *
   * @returns {boolean} True if game can start
   */
  canStart(): boolean {
    if (this.status !== RoomStatus.WAITING) {
      return false;
    }

    // Check minimum players
    if (this.players.size < this.config.minPlayers) {
      return false;
    }

    // Check all players are ready
    for (const player of this.players.values()) {
      if (!player.isReady) {
        return false;
      }
    }

    // Check we have enough roles for players + center cards
    const requiredRoles = this.players.size + 3;
    if (this.config.roles.length < requiredRoles) {
      return false;
    }

    return true;
  }

  /**
   * @summary Gets the reason why the game cannot start.
   *
   * @returns {string | null} Reason or null if can start
   */
  getCannotStartReason(): string | null {
    if (this.status !== RoomStatus.WAITING) {
      return 'Game already started or room closed';
    }

    if (this.players.size < this.config.minPlayers) {
      return `Need at least ${this.config.minPlayers} players (have ${this.players.size})`;
    }

    const notReady = Array.from(this.players.values())
      .filter(p => !p.isReady)
      .map(p => p.name);

    if (notReady.length > 0) {
      return `Waiting for players: ${notReady.join(', ')}`;
    }

    const requiredRoles = this.players.size + 3;
    if (this.config.roles.length < requiredRoles) {
      return `Need ${requiredRoles} roles but only ${this.config.roles.length} configured`;
    }

    return null;
  }

  /**
   * @summary Starts the game.
   *
   * @param {PlayerId} requesterId - Player requesting game start
   *
   * @returns {Game} The started game instance
   *
   * @throws {Error} If game cannot start or requester is not host
   */
  startGame(requesterId: PlayerId): Game {
    if (requesterId !== this.hostId) {
      throw new Error('Only the host can start the game');
    }

    if (!this.canStart()) {
      const reason = this.getCannotStartReason();
      throw new Error(reason || 'Cannot start game');
    }

    // Create player list
    const playerList = Array.from(this.players.values()).map(p => ({
      id: p.id,
      name: p.name
    }));

    // Create game configuration
    const gameConfig: GameConfig = {
      players: playerList.map(p => p.name),
      roles: [...this.config.roles]
    };

    // Create and setup game
    this.game = new Game(gameConfig);

    this.status = RoomStatus.PLAYING;
    this.gameStartedAt = Date.now();

    this.emitEvent('gameStarted', {
      playerIds: playerList.map(p => p.id)
    });

    // Notify all players - broadcast happens via room events

    return this.game;
  }

  /**
   * @summary Ends the current game.
   *
   * @param {Record<string, unknown>} [result] - Game result data
   */
  endGame(result?: Record<string, unknown>): void {
    if (this.status !== RoomStatus.PLAYING) {
      return;
    }

    this.status = RoomStatus.ENDED;

    this.emitEvent('gameEnded', {
      result: result ?? {}
    });

    // Notify all players - broadcast happens via room events
  }

  /**
   * @summary Closes the room.
   *
   * @param {string} [reason] - Reason for closing
   */
  close(reason?: string): void {
    this.status = RoomStatus.CLOSED;

    this.emitEvent('roomClosed', {
      reason: reason ?? 'Room closed'
    });

    // Notify all players
    const closeMessage: ServerMessage = {
      type: 'roomClosed',
      reason: reason ?? 'Room closed',
      timestamp: Date.now()
    };
    this.broadcast(closeMessage);

    // Disconnect all players
    for (const player of this.players.values()) {
      player.connection.close(reason);
    }

    this.players.clear();
  }

  /**
   * @summary Registers an event handler.
   *
   * @param {RoomEventHandler} handler - Handler function
   *
   * @returns {() => void} Unsubscribe function
   */
  onEvent(handler: RoomEventHandler): () => void {
    this.eventHandlers.add(handler);
    return () => this.eventHandlers.delete(handler);
  }

  /**
   * @summary Emits a room event.
   *
   * @param {RoomEventType} type - Event type
   * @param {Record<string, unknown>} data - Event data
   *
   * @private
   */
  private emitEvent(type: RoomEventType, data: Record<string, unknown>): void {
    const event: RoomEvent = {
      type,
      roomCode: this.code,
      data,
      timestamp: Date.now()
    };

    for (const handler of this.eventHandlers) {
      try {
        handler(event);
      } catch (error) {
        console.error('Error in room event handler:', error);
      }
    }
  }

  /**
   * @summary Broadcasts a message to all players.
   *
   * @param {ServerMessage} message - Message to send
   */
  broadcast(message: ServerMessage): void {
    for (const player of this.players.values()) {
      if (player.connection.isConnected()) {
        try {
          player.connection.send(message);
        } catch (error) {
          console.error(`Failed to send to ${player.id}:`, error);
        }
      }
    }
  }

  /**
   * @summary Broadcasts room state to all players.
   *
   * @private
   */
  private broadcastRoomState(): void {
    const state = this.getState();
    const message: ServerMessage = {
      type: 'roomUpdate',
      state,
      timestamp: Date.now()
    };
    this.broadcast(message);
  }

  /**
   * @summary Converts internal status to protocol status.
   *
   * @private
   */
  private getProtocolStatus(): RoomState['status'] {
    switch (this.status) {
      case RoomStatus.WAITING:
        return 'waiting';
      case RoomStatus.PLAYING:
        return 'playing';
      case RoomStatus.ENDED:
        return 'ended';
      case RoomStatus.CLOSED:
        return 'ended';
      default:
        return 'waiting';
    }
  }

  /**
   * @summary Gets the current room state for clients.
   *
   * @returns {RoomState} Room state
   */
  getState(): RoomState {
    const players: RoomPlayer[] = Array.from(this.players.values()).map(p => ({
      id: p.id,
      name: p.name,
      isReady: p.isReady,
      isHost: p.id === this.hostId,
      isConnected: p.connection.isConnected(),
      isAI: p.isAI
    }));

    return {
      roomCode: this.code,
      hostId: this.hostId,
      players,
      config: this.config,
      status: this.getProtocolStatus(),
      createdAt: this.createdAt
    };
  }
}
