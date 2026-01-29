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
import { IClientConnection, NullConnection } from '../network/IClientConnection';
import {
  ClientMessage,
  ServerMessage,
  RoomConfig,
  PlayerId,
  RoomCode,
  createMessage,
  createErrorMessage,
  ErrorCodes,
  LoginResponseMessage,
  RegisterResponseMessage,
  StatsResponseMessage,
  LeaderboardResponseMessage,
  ReplayResponseMessage,
  PlayerStatsData,
  LeaderboardEntry,
  GameReplayData
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
import { AuthService, getAuthService } from '../services';
import {
  IStatisticsRepository,
  IReplayRepository,
  StatisticsRepository,
  ReplayRepository
} from '../database/repositories';

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
  /** Database user ID (UUID) for authenticated users */
  userId?: string;
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

  /** Authenticated database user IDs by connection ID */
  private readonly authenticatedUsers: Map<string, string> = new Map();

  /** Authentication service for login/register */
  private readonly authService: AuthService;

  /** Statistics repository for player stats */
  private readonly statsRepo: IStatisticsRepository;

  /** Replay repository for game replay data */
  private readonly replayRepo: IReplayRepository;

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

    // Initialize database services (Dependency Inversion - depend on abstractions)
    this.authService = getAuthService();
    this.statsRepo = new StatisticsRepository();
    this.replayRepo = new ReplayRepository();

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
          this.handleAuthenticate(connection, message).catch((err) => {
            console.error('Error during WebSocket authentication:', err);
          });
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

        case 'submitStatement':
          this.handleSubmitStatement(connection, message);
          break;

        case 'readyToVote':
          this.handleReadyToVote(connection);
          break;

        case 'login':
          this.handleLogin(connection, message);
          break;

        case 'register':
          this.handleRegister(connection, message);
          break;

        case 'getStats':
          this.handleGetStats(connection, message);
          break;

        case 'getLeaderboard':
          this.handleGetLeaderboard(connection, message);
          break;

        case 'getReplay':
          this.handleGetReplay(connection, message);
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
  private async handleAuthenticate(
    connection: IClientConnection,
    message: Extract<ClientMessage, { type: 'authenticate' }>
  ): Promise<void> {
    const { playerId, playerName, token } = message;

    // Check if player is reconnecting
    if (this.reconnectionManager.canReconnect(playerId)) {
      this.handleReconnection(connection, playerId, playerName);
      return;
    }

    // If a JWT token is provided, validate it and link to database user
    let userId: string | undefined;
    if (token) {
      console.log(`WebSocket auth: Token received for ${playerName}`);
      try {
        const user = await this.authService.validateToken(token);
        if (user) {
          userId = user.userId;
          this.authenticatedUsers.set(connection.id, userId);
          console.log(`WebSocket auth: Linked ${playerName} to database user ${userId}`);
        } else {
          console.log(`WebSocket auth: Token valid but no user returned`);
        }
      } catch (error) {
        // Token validation failed - continue without database user link
        console.log('Token validation failed during WebSocket auth:', error);
      }
    } else {
      console.log(`WebSocket auth: No token provided for ${playerName}`);
    }

    // Create new session
    const session: PlayerSession = {
      playerId,
      playerName,
      connection,
      roomCode: null,
      authenticatedAt: Date.now(),
      userId
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
      // Pass debug options if provided
      const room = this.roomManager.createRoom(session.playerId, message.config, message.debug);

      // Get authenticated database user ID if available
      const userId = this.authenticatedUsers.get(connection.id);

      // Add host to room
      room.addPlayer(session.playerId, session.playerName, connection, false, userId);
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
      // Get authenticated database user ID if available
      const userId = this.authenticatedUsers.get(connection.id);

      room.addPlayer(session.playerId, session.playerName, connection, false, userId);
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
  /** Counter for AI player IDs */
  private aiPlayerCounter: number = 0;

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

    try {
      // Create a null connection for AI players (Null Object Pattern)
      const aiId = `ai-${++this.aiPlayerCounter}`;
      const aiNames = ['Bot Alice', 'Bot Bob', 'Bot Charlie', 'Bot Diana', 'Bot Eve', 'Bot Frank'];
      const aiName = message.aiName || aiNames[this.aiPlayerCounter % aiNames.length];

      const nullConnection = NullConnection.create(aiId);

      room.addPlayer(aiId, aiName, nullConnection, true);
    } catch (error) {
      this.sendError(
        connection,
        ErrorCodes.ROOM_FULL,
        error instanceof Error ? error.message : 'Failed to add AI'
      );
    }
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
   * @summary Handles real-time statement submission during day phase.
   *
   * @description
   * Players can submit statements at any time during the DAY phase.
   * The statement is broadcast to all players immediately via Observer pattern.
   *
   * @param {IClientConnection} connection - Connection
   * @param {ClientMessage} message - Submit statement message
   *
   * @private
   */
  private handleSubmitStatement(
    connection: IClientConnection,
    message: Extract<ClientMessage, { type: 'submitStatement' }>
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
      room.submitStatement(session.playerId, message.statement);
    } catch (error) {
      this.sendError(
        connection,
        ErrorCodes.INVALID_ACTION,
        error instanceof Error ? error.message : 'Failed to submit statement'
      );
    }
  }

  /**
   * @summary Handles player signaling ready to move to voting phase.
   *
   * @description
   * During the DAY phase, players can signal they're ready to vote.
   * When all players are ready (or a timeout occurs), the game moves to VOTING.
   *
   * @param {IClientConnection} connection - Connection
   *
   * @private
   */
  private handleReadyToVote(connection: IClientConnection): void {
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
      room.setPlayerReadyToVote(session.playerId);
    } catch (error) {
      this.sendError(
        connection,
        ErrorCodes.INVALID_ACTION,
        error instanceof Error ? error.message : 'Failed to set ready to vote'
      );
    }
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

  // ============================================================================
  // DATABASE AUTHENTICATION HANDLERS
  // ============================================================================

  /**
   * @summary Handles login request via WebSocket.
   *
   * @description
   * Authenticates user with email/password and returns JWT token.
   * Associates the database user ID with the WebSocket connection.
   *
   * @pattern Repository Pattern - Uses AuthService for authentication
   * @pattern Graceful Degradation - Returns error message on failure
   *
   * @param {IClientConnection} connection - Connection
   * @param {ClientMessage} message - Login message
   *
   * @private
   */
  private async handleLogin(
    connection: IClientConnection,
    message: Extract<ClientMessage, { type: 'login' }>
  ): Promise<void> {
    try {
      const result = await this.authService.login({
        email: message.email,
        password: message.password
      });

      // Associate database user ID with this connection
      this.authenticatedUsers.set(connection.id, result.user.userId);

      const response: LoginResponseMessage = {
        type: 'loginResponse',
        success: true,
        token: result.token,
        userId: result.user.userId,
        displayName: result.user.displayName ?? result.user.email,
        timestamp: Date.now()
      };
      connection.send(response);
    } catch (error) {
      const response: LoginResponseMessage = {
        type: 'loginResponse',
        success: false,
        error: error instanceof Error ? error.message : 'Login failed',
        timestamp: Date.now()
      };
      connection.send(response);
    }
  }

  /**
   * @summary Handles registration request via WebSocket.
   *
   * @description
   * Creates new user account and returns JWT token for immediate login.
   * Associates the database user ID with the WebSocket connection.
   *
   * @pattern Repository Pattern - Uses AuthService for registration
   * @pattern Graceful Degradation - Returns error message on failure
   *
   * @param {IClientConnection} connection - Connection
   * @param {ClientMessage} message - Register message
   *
   * @private
   */
  private async handleRegister(
    connection: IClientConnection,
    message: Extract<ClientMessage, { type: 'register' }>
  ): Promise<void> {
    try {
      const result = await this.authService.register({
        email: message.email,
        password: message.password,
        displayName: message.displayName
      });

      // Associate database user ID with this connection
      this.authenticatedUsers.set(connection.id, result.user.userId);

      const response: RegisterResponseMessage = {
        type: 'registerResponse',
        success: true,
        token: result.token,
        userId: result.user.userId,
        timestamp: Date.now()
      };
      connection.send(response);
    } catch (error) {
      const response: RegisterResponseMessage = {
        type: 'registerResponse',
        success: false,
        error: error instanceof Error ? error.message : 'Registration failed',
        timestamp: Date.now()
      };
      connection.send(response);
    }
  }

  // ============================================================================
  // DATABASE STATISTICS HANDLERS
  // ============================================================================

  /**
   * @summary Handles player statistics request via WebSocket.
   *
   * @description
   * Returns comprehensive player statistics from the database.
   * If no userId provided, returns stats for the authenticated user.
   *
   * @pattern Repository Pattern - Uses StatisticsRepository for data access
   * @pattern 6NF Compliance - Role and team stats stored in separate tables
   *
   * @param {IClientConnection} connection - Connection
   * @param {ClientMessage} message - Get stats message
   *
   * @private
   */
  private async handleGetStats(
    connection: IClientConnection,
    message: Extract<ClientMessage, { type: 'getStats' }>
  ): Promise<void> {
    try {
      // Determine which user's stats to fetch
      let userId = message.userId;
      if (!userId) {
        userId = this.authenticatedUsers.get(connection.id);
        if (!userId) {
          const response: StatsResponseMessage = {
            type: 'statsResponse',
            stats: null,
            error: 'Not authenticated. Login or provide userId.',
            timestamp: Date.now()
          };
          connection.send(response);
          return;
        }
      }

      const stats = await this.statsRepo.getPlayerStats(userId);

      if (!stats) {
        const response: StatsResponseMessage = {
          type: 'statsResponse',
          stats: null,
          error: 'User not found',
          timestamp: Date.now()
        };
        connection.send(response);
        return;
      }

      // PlayerStatsDto already includes roleStats and teamStats from 6NF tables
      const statsData: PlayerStatsData = {
        userId: stats.userId,
        displayName: stats.displayName ?? 'Unknown',
        gamesPlayed: stats.gamesPlayed,
        wins: stats.wins,
        losses: stats.losses,
        winRate: stats.winRate,
        currentStreak: stats.currentStreak,
        bestStreak: stats.bestStreak,
        roleStats: stats.roleStats.map(r => ({
          roleCode: r.roleCode,
          roleName: r.roleName,
          gamesPlayed: r.gamesPlayed,
          wins: r.wins,
          winRate: r.winRate
        })),
        teamStats: stats.teamStats.map(t => ({
          teamCode: t.teamCode,
          teamName: t.teamName,
          gamesPlayed: t.gamesPlayed,
          wins: t.wins,
          winRate: t.winRate
        }))
      };

      const response: StatsResponseMessage = {
        type: 'statsResponse',
        stats: statsData,
        timestamp: Date.now()
      };
      connection.send(response);
    } catch (error) {
      const response: StatsResponseMessage = {
        type: 'statsResponse',
        stats: null,
        error: error instanceof Error ? error.message : 'Failed to get stats',
        timestamp: Date.now()
      };
      connection.send(response);
    }
  }

  /**
   * @summary Handles leaderboard request via WebSocket.
   *
   * @description
   * Returns paginated leaderboard entries sorted by win rate.
   *
   * @pattern Repository Pattern - Uses StatisticsRepository for leaderboard query
   *
   * @param {IClientConnection} connection - Connection
   * @param {ClientMessage} message - Get leaderboard message
   *
   * @private
   */
  private async handleGetLeaderboard(
    connection: IClientConnection,
    message: Extract<ClientMessage, { type: 'getLeaderboard' }>
  ): Promise<void> {
    try {
      const limit = message.limit ?? 100;
      const offset = message.offset ?? 0;

      const entries = await this.statsRepo.getLeaderboard(limit, offset);

      const leaderboardEntries: LeaderboardEntry[] = entries.map((entry, index) => ({
        rank: offset + index + 1,
        userId: entry.userId,
        displayName: entry.displayName ?? 'Unknown',
        gamesPlayed: entry.gamesPlayed,
        wins: entry.wins,
        winRate: entry.gamesPlayed > 0 ? entry.wins / entry.gamesPlayed : 0
      }));

      const response: LeaderboardResponseMessage = {
        type: 'leaderboardResponse',
        entries: leaderboardEntries,
        timestamp: Date.now()
      };
      connection.send(response);
    } catch (error) {
      const response: LeaderboardResponseMessage = {
        type: 'leaderboardResponse',
        entries: [],
        error: error instanceof Error ? error.message : 'Failed to get leaderboard',
        timestamp: Date.now()
      };
      connection.send(response);
    }
  }

  // ============================================================================
  // DATABASE REPLAY HANDLERS
  // ============================================================================

  /**
   * @summary Handles game replay request via WebSocket.
   *
   * @description
   * Returns full game replay data including night actions, statements, and votes.
   * Follows 6NF decomposition for multi-valued attributes.
   *
   * @pattern Repository Pattern - Uses ReplayRepository for 6NF data retrieval
   * @pattern 6NF Compliance - Targets, views, swaps stored in separate tables
   *
   * @param {IClientConnection} connection - Connection
   * @param {ClientMessage} message - Get replay message
   *
   * @private
   */
  private async handleGetReplay(
    connection: IClientConnection,
    message: Extract<ClientMessage, { type: 'getReplay' }>
  ): Promise<void> {
    try {
      const gameId = message.gameId;

      // Get all replay data using 6NF repository
      const nightActions = await this.replayRepo.getNightActions(gameId);
      const statements = await this.replayRepo.getStatements(gameId);
      const votes = await this.replayRepo.getVotes(gameId);

      if (nightActions.length === 0 && statements.length === 0 && votes.length === 0) {
        const response: ReplayResponseMessage = {
          type: 'replayResponse',
          gameId,
          replay: null,
          error: 'Game not found or no replay data available',
          timestamp: Date.now()
        };
        connection.send(response);
        return;
      }

      const replayData: GameReplayData = {
        nightActions: nightActions.map(action => ({
          actorPlayerId: action.actorPlayerId,
          performedAsRole: action.performedAsRole,
          actionType: action.actionType,
          sequenceOrder: action.sequenceOrder,
          // Convert null to undefined for protocol compatibility
          targets: (action.targets ?? []).map(t => ({
            targetType: t.targetType,
            targetPlayerId: t.targetPlayerId ?? undefined,
            targetCenterPosition: t.targetCenterPosition ?? undefined
          })),
          views: (action.views ?? []).map(v => ({
            viewSourceType: v.viewSourceType,
            viewedRole: v.viewedRole
          })),
          swap: action.swap ? {
            fromType: action.swap.fromType,
            toType: action.swap.toType
          } : undefined,
          copy: action.copy ? {
            copiedFromPlayerId: action.copy.copiedFromPlayerId,
            copiedRole: action.copy.copiedRole
          } : undefined
        })),
        statements: statements.map(stmt => ({
          speakerPlayerId: stmt.speakerPlayerId,
          text: stmt.text,
          sequenceOrder: stmt.sequenceOrder
        })),
        // Filter out null targetPlayerId votes (abstentions) or convert if needed
        votes: votes
          .filter(vote => vote.targetPlayerId !== null)
          .map(vote => ({
            voterPlayerId: vote.voterPlayerId,
            targetPlayerId: vote.targetPlayerId!
          }))
      };

      const response: ReplayResponseMessage = {
        type: 'replayResponse',
        gameId,
        replay: replayData,
        timestamp: Date.now()
      };
      connection.send(response);
    } catch (error) {
      const response: ReplayResponseMessage = {
        type: 'replayResponse',
        gameId: message.gameId,
        replay: null,
        error: error instanceof Error ? error.message : 'Failed to get replay',
        timestamp: Date.now()
      };
      connection.send(response);
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
