/**
 * @fileoverview Unified game server interface.
 * @module server/GameServerFacade
 *
 * @summary Provides a simple interface to the game server components.
 *
 * @description
 * GameServerFacade simplifies server operations by coordinating:
 * - WebSocket server for connections
 * - Room manager for game sessions
 * - Reconnection handling
 * - Message routing
 * - Player authentication
 *
 * @pattern Facade Pattern - Simple interface to complex subsystems
 * @pattern Mediator Pattern - Coordinates server components
 *
 * @example
 * ```typescript
 * const server = new GameServerFacade({
 *   port: 8080,
 *   maxRooms: 50
 * });
 *
 * await server.start();
 * console.log('Game server running on port 8080');
 * ```
 */

import { WebSocketServer, IWebSocketServerBackend, WebSocketServerConfig } from '../network/WebSocketServer';
import { IClientConnection } from '../network/IClientConnection';
import {
  ClientMessage,
  ServerMessage,
  RoomConfig,
  PlayerId,
  RoomCode,
  createMessage,
  createErrorMessage,
  ErrorCodes
} from '../network/protocol';
import { Room, RoomStatus } from './Room';
import { RoomManager, RoomManagerConfig } from './RoomManager';
import {
  ReconnectionManager,
  ReconnectionConfig,
  DisconnectionStatus
} from './ReconnectionManager';
import {
  TimeoutStrategyFactory,
  TimeoutStrategyType
} from './TimeoutStrategies';
import { PlayerViewFactory } from '../players/PlayerView';
import { Game } from '../core/Game';

/**
 * @summary Game server configuration.
 */
export interface GameServerConfig {
  /** WebSocket server port */
  port: number;

  /** Host to bind to */
  host?: string;

  /** Maximum rooms */
  maxRooms?: number;

  /** Room timeout in milliseconds */
  roomTimeoutMs?: number;

  /** Reconnection grace period in milliseconds */
  reconnectionGracePeriodMs?: number;

  /** Default timeout strategy */
  defaultTimeoutStrategy?: TimeoutStrategyType;
}

/**
 * @summary Authenticated player session.
 */
interface PlayerSession {
  playerId: PlayerId;
  playerName: string;
  connection: IClientConnection;
  roomCode: RoomCode | null;
  authenticatedAt: number;
}

/**
 * @summary Game server facade.
 *
 * @description
 * Provides a unified, simple interface for running a multiplayer game server.
 * Coordinates all server components and handles message routing.
 *
 * @pattern Facade Pattern - Simplifies complex server architecture
 * @pattern Mediator Pattern - Coordinates component interactions
 *
 * @example
 * ```typescript
 * const backend = new WsServerBackend();
 * const server = new GameServerFacade(backend, { port: 8080 });
 *
 * server.onError((error) => {
 *   console.error('Server error:', error);
 * });
 *
 * await server.start();
 * ```
 */
export class GameServerFacade {
  /** Configuration */
  private readonly config: GameServerConfig;

  /** WebSocket server */
  private readonly wsServer: WebSocketServer;

  /** Room manager */
  private readonly roomManager: RoomManager;

  /** Reconnection manager */
  private readonly reconnectionManager: ReconnectionManager;

  /** Player sessions by connection ID */
  private readonly sessions: Map<string, PlayerSession> = new Map();

  /** Connection to session mapping */
  private readonly connectionToSession: Map<string, string> = new Map();

  /** Whether server is running */
  private _isRunning: boolean = false;

  /**
   * @summary Creates a new game server facade.
   *
   * @param {IWebSocketServerBackend} backend - WebSocket server backend
   * @param {GameServerConfig} config - Server configuration
   *
   * @example
   * ```typescript
   * const server = new GameServerFacade(wsBackend, {
   *   port: 8080,
   *   maxRooms: 100
   * });
   * ```
   */
  constructor(backend: IWebSocketServerBackend, config: GameServerConfig) {
    this.config = config;

    // Initialize WebSocket server
    this.wsServer = new WebSocketServer(backend, {
      port: config.port,
      host: config.host ?? '0.0.0.0',
      maxConnections: (config.maxRooms ?? 100) * 10 // Estimate ~10 connections per room
    });

    // Initialize room manager
    this.roomManager = new RoomManager({
      maxRooms: config.maxRooms ?? 100,
      roomTimeoutMs: config.roomTimeoutMs ?? 3600000
    });

    // Initialize reconnection manager
    this.reconnectionManager = new ReconnectionManager({
      gracePeriodMs: config.reconnectionGracePeriodMs ?? 30000
    });

    this.setupEventHandlers();
  }

  /**
   * @summary Whether the server is running.
   */
  get isRunning(): boolean {
    return this._isRunning;
  }

  /**
   * @summary Gets server statistics.
   *
   * @returns {object} Server stats
   */
  getStats(): {
    isRunning: boolean;
    connectionCount: number;
    roomCount: number;
    sessionCount: number;
  } {
    return {
      isRunning: this._isRunning,
      connectionCount: this.wsServer.connectionCount,
      roomCount: this.roomManager.getRoomCount(),
      sessionCount: this.sessions.size
    };
  }

  /**
   * @summary Sets up event handlers for server components.
   *
   * @private
   */
  private setupEventHandlers(): void {
    // Handle new connections
    this.wsServer.onConnection((connection) => {
      this.handleNewConnection(connection);
    });

    // Handle room events
    this.roomManager.onEvent((event) => {
      console.log(`Room event: ${event.type} for ${event.roomCode}`);
    });

    // Handle reconnection events
    this.reconnectionManager.onEvent((event) => {
      console.log(`Reconnection event: ${event.type} for ${event.playerId}`);
    });
  }

  /**
   * @summary Handles a new WebSocket connection.
   *
   * @param {IClientConnection} connection - New connection
   *
   * @private
   */
  private handleNewConnection(connection: IClientConnection): void {
    // Set up message handler
    connection.onMessage((message) => {
      this.handleMessage(connection, message);
    });

    // Set up disconnect handler
    connection.onDisconnect((reason) => {
      this.handleDisconnection(connection, reason);
    });
  }

  /**
   * @summary Handles an incoming message from a client.
   *
   * @param {IClientConnection} connection - Source connection
   * @param {ClientMessage} message - Received message
   *
   * @private
   */
  private handleMessage(connection: IClientConnection, message: ClientMessage): void {
    try {
      switch (message.type) {
        case 'authenticate':
          this.handleAuthenticate(connection, message);
          break;

        case 'disconnect':
          this.handleDisconnectRequest(connection, message);
          break;

        case 'createRoom':
          this.handleCreateRoom(connection, message);
          break;

        case 'joinRoom':
          this.handleJoinRoom(connection, message);
          break;

        case 'leaveRoom':
          this.handleLeaveRoom(connection);
          break;

        case 'setReady':
          this.handleSetReady(connection, message);
          break;

        case 'addAI':
          this.handleAddAI(connection, message);
          break;

        case 'removePlayer':
          this.handleRemovePlayer(connection, message);
          break;

        case 'startGame':
          this.handleStartGame(connection);
          break;

        case 'actionResponse':
          this.handleActionResponse(connection, message);
          break;

        case 'getState':
          this.handleGetState(connection);
          break;

        case 'ping':
          // Handled by WebSocket connection
          break;

        default:
          this.sendError(connection, ErrorCodes.INVALID_MESSAGE, `Unknown message type`);
      }
    } catch (error) {
      console.error('Error handling message:', error);
      this.sendError(
        connection,
        ErrorCodes.INTERNAL_ERROR,
        error instanceof Error ? error.message : 'Internal error'
      );
    }
  }

  /**
   * @summary Handles authentication request.
   *
   * @param {IClientConnection} connection - Connection
   * @param {ClientMessage} message - Auth message
   *
   * @private
   */
  private handleAuthenticate(
    connection: IClientConnection,
    message: Extract<ClientMessage, { type: 'authenticate' }>
  ): void {
    const { playerId, playerName } = message;

    // Check if player is reconnecting
    if (this.reconnectionManager.canReconnect(playerId)) {
      this.handleReconnection(connection, playerId, playerName);
      return;
    }

    // Create new session
    const session: PlayerSession = {
      playerId,
      playerName,
      connection,
      roomCode: null,
      authenticatedAt: Date.now()
    };

    this.sessions.set(playerId, session);
    this.connectionToSession.set(connection.id, playerId);

    const authMessage: ServerMessage = {
      type: 'authenticated',
      playerId,
      playerName: session.playerName,
      serverVersion: '2.0.0',
      timestamp: Date.now()
    };
    connection.send(authMessage);
  }

  /**
   * @summary Handles player reconnection.
   *
   * @param {IClientConnection} connection - New connection
   * @param {PlayerId} playerId - Player ID
   * @param {string} playerName - Player name
   *
   * @private
   */
  private handleReconnection(
    connection: IClientConnection,
    playerId: PlayerId,
    playerName: string
  ): void {
    const state = this.reconnectionManager.handleReconnection(playerId, connection);
    if (!state) {
      this.sendError(connection, ErrorCodes.INVALID_ACTION, 'Cannot reconnect');
      return;
    }

    // Update session
    const session: PlayerSession = {
      playerId,
      playerName,
      connection,
      roomCode: state.roomCode,
      authenticatedAt: Date.now()
    };

    this.sessions.set(playerId, session);
    this.connectionToSession.set(connection.id, playerId);

    // Get room and game state
    const room = this.roomManager.getRoom(state.roomCode);
    if (room && room.getGame()) {
      const game = room.getGame()!;
      const view = PlayerViewFactory.createReconnectionView(game, playerId, state.nightInfo);

      const authMessage: ServerMessage = {
        type: 'authenticated',
        playerId,
        playerName,
        serverVersion: '2.0.0',
        timestamp: Date.now()
      };
      connection.send(authMessage);

      const stateMessage: ServerMessage = {
        type: 'gameState',
        view,
        timestamp: Date.now()
      };
      connection.send(stateMessage);
    }

    this.reconnectionManager.completeReconnection(playerId);
  }

  /**
   * @summary Handles disconnect request.
   *
   * @param {IClientConnection} connection - Connection
   * @param {ClientMessage} message - Disconnect message
   *
   * @private
   */
  private handleDisconnectRequest(
    connection: IClientConnection,
    message: Extract<ClientMessage, { type: 'disconnect' }>
  ): void {
    connection.close(message.reason ?? 'Client requested disconnect');
  }

  /**
   * @summary Handles room creation.
   *
   * @param {IClientConnection} connection - Connection
   * @param {ClientMessage} message - Create room message
   *
   * @private
   */
  private handleCreateRoom(
    connection: IClientConnection,
    message: Extract<ClientMessage, { type: 'createRoom' }>
  ): void {
    const session = this.getSession(connection);
    if (!session) {
      this.sendError(connection, ErrorCodes.AUTH_REQUIRED, 'Not authenticated');
      return;
    }

    if (session.roomCode) {
      this.sendError(connection, ErrorCodes.ROOM_STARTED, 'Already in a room');
      return;
    }

    try {
      const room = this.roomManager.createRoom(session.playerId, message.config);

      // Add host to room
      room.addPlayer(session.playerId, session.playerName, connection);
      session.roomCode = room.getCode();

      const createdMessage: ServerMessage = {
        type: 'roomCreated',
        roomCode: room.getCode(),
        state: room.getState(),
        timestamp: Date.now()
      };
      connection.send(createdMessage);

      const updateMessage: ServerMessage = {
        type: 'roomUpdate',
        state: room.getState(),
        timestamp: Date.now()
      };
      connection.send(updateMessage);
    } catch (error) {
      this.sendError(
        connection,
        ErrorCodes.ROOM_FULL,
        error instanceof Error ? error.message : 'Failed to create room'
      );
    }
  }

  /**
   * @summary Handles room join request.
   *
   * @param {IClientConnection} connection - Connection
   * @param {ClientMessage} message - Join room message
   *
   * @private
   */
  private handleJoinRoom(
    connection: IClientConnection,
    message: Extract<ClientMessage, { type: 'joinRoom' }>
  ): void {
    const session = this.getSession(connection);
    if (!session) {
      this.sendError(connection, ErrorCodes.AUTH_REQUIRED, 'Not authenticated');
      return;
    }

    if (session.roomCode) {
      this.sendError(connection, ErrorCodes.ROOM_STARTED, 'Already in a room');
      return;
    }

    const room = this.roomManager.getRoom(message.roomCode);
    if (!room) {
      this.sendError(connection, ErrorCodes.ROOM_NOT_FOUND, 'Room not found');
      return;
    }

    try {
      room.addPlayer(session.playerId, session.playerName, connection);
      session.roomCode = room.getCode();

      const joinedMessage: ServerMessage = {
        type: 'roomJoined',
        state: room.getState(),
        timestamp: Date.now()
      };
      connection.send(joinedMessage);

      // Room broadcasts update to all players
    } catch (error) {
      this.sendError(
        connection,
        ErrorCodes.ROOM_FULL,
        error instanceof Error ? error.message : 'Failed to join room'
      );
    }
  }

  /**
   * @summary Handles leave room request.
   *
   * @param {IClientConnection} connection - Connection
   *
   * @private
   */
  private handleLeaveRoom(connection: IClientConnection): void {
    const session = this.getSession(connection);
    if (!session || !session.roomCode) {
      return;
    }

    const room = this.roomManager.getRoom(session.roomCode);
    if (room) {
      room.removePlayer(session.playerId);
    }

    session.roomCode = null;
  }

  /**
   * @summary Handles set ready request.
   *
   * @param {IClientConnection} connection - Connection
   * @param {ClientMessage} message - Set ready message
   *
   * @private
   */
  private handleSetReady(
    connection: IClientConnection,
    message: Extract<ClientMessage, { type: 'setReady' }>
  ): void {
    const session = this.getSession(connection);
    if (!session || !session.roomCode) {
      this.sendError(connection, ErrorCodes.NOT_IN_ROOM, 'Not in a room');
      return;
    }

    const room = this.roomManager.getRoom(session.roomCode);
    if (!room) {
      return;
    }

    try {
      room.setPlayerReady(session.playerId, message.ready);
    } catch (error) {
      this.sendError(
        connection,
        ErrorCodes.INVALID_ACTION,
        error instanceof Error ? error.message : 'Failed to set ready'
      );
    }
  }

  /**
   * @summary Handles add AI request.
   *
   * @param {IClientConnection} connection - Connection
   * @param {ClientMessage} message - Add AI message
   *
   * @private
   */
  private handleAddAI(
    connection: IClientConnection,
    message: Extract<ClientMessage, { type: 'addAI' }>
  ): void {
    const session = this.getSession(connection);
    if (!session || !session.roomCode) {
      this.sendError(connection, ErrorCodes.NOT_IN_ROOM, 'Not in a room');
      return;
    }

    const room = this.roomManager.getRoom(session.roomCode);
    if (!room) {
      return;
    }

    if (room.getHostId() !== session.playerId) {
      this.sendError(connection, ErrorCodes.NOT_HOST, 'Only host can add AI');
      return;
    }

    // Note: AI players need a dummy connection - this would need to be implemented
    // For now, this is a placeholder
    this.sendError(connection, ErrorCodes.INTERNAL_ERROR, 'AI players not yet implemented in facade');
  }

  /**
   * @summary Handles remove player request.
   *
   * @param {IClientConnection} connection - Connection
   * @param {ClientMessage} message - Remove player message
   *
   * @private
   */
  private handleRemovePlayer(
    connection: IClientConnection,
    message: Extract<ClientMessage, { type: 'removePlayer' }>
  ): void {
    const session = this.getSession(connection);
    if (!session || !session.roomCode) {
      this.sendError(connection, ErrorCodes.NOT_IN_ROOM, 'Not in a room');
      return;
    }

    const room = this.roomManager.getRoom(session.roomCode);
    if (!room) {
      return;
    }

    if (room.getHostId() !== session.playerId) {
      this.sendError(connection, ErrorCodes.NOT_HOST, 'Only host can remove players');
      return;
    }

    try {
      room.removePlayer(message.playerId);
    } catch (error) {
      this.sendError(
        connection,
        ErrorCodes.INVALID_ACTION,
        error instanceof Error ? error.message : 'Failed to remove player'
      );
    }
  }

  /**
   * @summary Handles start game request.
   *
   * @param {IClientConnection} connection - Connection
   *
   * @private
   */
  private handleStartGame(connection: IClientConnection): void {
    const session = this.getSession(connection);
    if (!session || !session.roomCode) {
      this.sendError(connection, ErrorCodes.NOT_IN_ROOM, 'Not in a room');
      return;
    }

    const room = this.roomManager.getRoom(session.roomCode);
    if (!room) {
      return;
    }

    try {
      const game = room.startGame(session.playerId);
      // Game started - room handles broadcasting
    } catch (error) {
      this.sendError(
        connection,
        ErrorCodes.INVALID_ACTION,
        error instanceof Error ? error.message : 'Failed to start game'
      );
    }
  }

  /**
   * @summary Handles action response from client.
   *
   * @param {IClientConnection} connection - Connection
   * @param {ClientMessage} message - Action response message
   *
   * @private
   */
  private handleActionResponse(
    connection: IClientConnection,
    message: Extract<ClientMessage, { type: 'actionResponse' }>
  ): void {
    // This is handled by RemoteHumanPlayer through its message handlers
    // The connection's onMessage handlers process action responses
  }

  /**
   * @summary Handles get state request.
   *
   * @param {IClientConnection} connection - Connection
   *
   * @private
   */
  private handleGetState(connection: IClientConnection): void {
    const session = this.getSession(connection);
    if (!session) {
      this.sendError(connection, ErrorCodes.AUTH_REQUIRED, 'Not authenticated');
      return;
    }

    if (!session.roomCode) {
      // Send room list
      const rooms = this.roomManager.getRoomSummaries();
      // Note: Would need a roomList message type
      return;
    }

    const room = this.roomManager.getRoom(session.roomCode);
    if (!room) {
      return;
    }

    if (room.getStatus() === RoomStatus.WAITING) {
      const updateMessage: ServerMessage = {
        type: 'roomUpdate',
        state: room.getState(),
        timestamp: Date.now()
      };
      connection.send(updateMessage);
    } else if (room.getGame()) {
      const game = room.getGame()!;
      const view = PlayerViewFactory.createView(game, session.playerId);
      const stateMessage: ServerMessage = {
        type: 'gameState',
        view,
        timestamp: Date.now()
      };
      connection.send(stateMessage);
    }
  }

  /**
   * @summary Handles connection disconnection.
   *
   * @param {IClientConnection} connection - Disconnected connection
   * @param {string} reason - Disconnect reason
   *
   * @private
   */
  private handleDisconnection(connection: IClientConnection, reason: string): void {
    const playerId = this.connectionToSession.get(connection.id);
    if (!playerId) {
      return;
    }

    const session = this.sessions.get(playerId);
    if (!session) {
      return;
    }

    // Clean up mappings
    this.connectionToSession.delete(connection.id);
    this.sessions.delete(playerId);

    // Handle room disconnection
    if (session.roomCode) {
      const room = this.roomManager.getRoom(session.roomCode);
      if (room) {
        if (room.getStatus() === RoomStatus.PLAYING) {
          // Game in progress - start reconnection grace period
          const playerInfo = room.getPlayer(playerId);
          this.reconnectionManager.handleDisconnection(
            playerId,
            room,
            [], // Night info would come from the player
            playerInfo?.name ?? 'Unknown'
          );
        } else {
          // Not playing - just remove from room
          room.removePlayer(playerId);
        }
      }
    }
  }

  /**
   * @summary Gets session for a connection.
   *
   * @param {IClientConnection} connection - Connection
   *
   * @returns {PlayerSession | null} Session or null
   *
   * @private
   */
  private getSession(connection: IClientConnection): PlayerSession | null {
    const playerId = this.connectionToSession.get(connection.id);
    if (!playerId) {
      return null;
    }
    return this.sessions.get(playerId) ?? null;
  }

  /**
   * @summary Sends an error message to a connection.
   *
   * @param {IClientConnection} connection - Connection
   * @param {string} code - Error code
   * @param {string} message - Error message
   *
   * @private
   */
  private sendError(connection: IClientConnection, code: string, message: string): void {
    if (connection.isConnected()) {
      connection.send(createErrorMessage(code, message));
    }
  }

  /**
   * @summary Starts the game server.
   *
   * @returns {Promise<void>} Resolves when server is running
   *
   * @example
   * ```typescript
   * await server.start();
   * console.log('Server running');
   * ```
   */
  async start(): Promise<void> {
    if (this._isRunning) {
      throw new Error('Server is already running');
    }

    // Start room manager cleanup
    this.roomManager.startCleanupTimer();

    // Start reconnection manager cleanup
    this.reconnectionManager.startCleanup();

    // Start WebSocket server
    await this.wsServer.start();

    this._isRunning = true;

    console.log(`Game server started on port ${this.config.port}`);
  }

  /**
   * @summary Stops the game server.
   *
   * @returns {Promise<void>} Resolves when server is stopped
   *
   * @example
   * ```typescript
   * await server.stop();
   * console.log('Server stopped');
   * ```
   */
  async stop(): Promise<void> {
    if (!this._isRunning) {
      return;
    }

    // Stop WebSocket server
    await this.wsServer.stop();

    // Stop managers
    this.roomManager.shutdown();
    this.reconnectionManager.shutdown();

    // Clear sessions
    this.sessions.clear();
    this.connectionToSession.clear();

    this._isRunning = false;

    console.log('Game server stopped');
  }

  /**
   * @summary Gets the room manager.
   *
   * @returns {RoomManager} Room manager instance
   */
  getRoomManager(): RoomManager {
    return this.roomManager;
  }

  /**
   * @summary Gets the reconnection manager.
   *
   * @returns {ReconnectionManager} Reconnection manager instance
   */
  getReconnectionManager(): ReconnectionManager {
    return this.reconnectionManager;
  }
}
