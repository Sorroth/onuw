/**
 * @fileoverview WebSocket server for multiplayer game hosting.
 * @module network/WebSocketServer
 *
 * @summary Manages WebSocket connections and routes messages.
 *
 * @description
 * WebSocketServer is the entry point for network communication:
 * - Accepts incoming WebSocket connections
 * - Creates WebSocketConnection instances for each client
 * - Routes messages to appropriate handlers
 * - Manages connection lifecycle
 *
 * @pattern Observer Pattern - Notifies handlers of connection events
 * @pattern Facade Pattern - Simple interface for server operations
 *
 * @example
 * ```typescript
 * const server = new WebSocketServer({ port: 8080 });
 *
 * server.onConnection((connection) => {
 *   console.log(`Player connected: ${connection.id}`);
 *   connection.onMessage((msg) => handleMessage(connection, msg));
 * });
 *
 * await server.start();
 * ```
 */

import { IClientConnection } from './IClientConnection';
import { WebSocketConnection, IWebSocket, WebSocketConfig } from './WebSocketConnection';
import { ServerMessage, createMessage } from './protocol';

/**
 * @summary Server configuration options.
 */
export interface WebSocketServerConfig {
  /** Port to listen on */
  port: number;

  /** Host to bind to (default: '0.0.0.0') */
  host?: string;

  /** Path for WebSocket connections (default: '/') */
  path?: string;

  /** Maximum number of connections (default: 100) */
  maxConnections?: number;

  /** Connection timeout in milliseconds (default: 30000) */
  connectionTimeoutMs?: number;

  /** WebSocket configuration */
  webSocketConfig?: Partial<WebSocketConfig>;
}

/**
 * @summary Handler for new connections.
 */
export type ConnectionHandler = (connection: IClientConnection) => void;

/**
 * @summary Handler for server errors.
 */
export type ServerErrorHandler = (error: Error) => void;

/**
 * @summary Handler for server lifecycle events.
 */
export type ServerLifecycleHandler = () => void;

/**
 * @summary Minimal WebSocket server interface.
 *
 * @description
 * Abstracts the underlying WebSocket server implementation,
 * allowing use with different libraries (ws, uWebSockets, etc.).
 */
export interface IWebSocketServerBackend {
  /** Start listening for connections */
  listen(port: number, host: string, callback: () => void): void;

  /** Stop the server */
  close(callback: () => void): void;

  /** Handle new connections */
  onConnection(handler: (socket: IWebSocket) => void): void;

  /** Handle server errors */
  onError(handler: (error: Error) => void): void;
}

/**
 * @summary WebSocket server for game hosting.
 *
 * @description
 * Manages WebSocket connections for multiplayer game sessions.
 * Provides a high-level interface for:
 * - Starting/stopping the server
 * - Tracking active connections
 * - Broadcasting messages to groups
 * - Handling connection lifecycle
 *
 * @pattern Observer Pattern - Connection events
 * @pattern Facade Pattern - Simple server interface
 *
 * @remarks
 * This class is designed to work with a backend adapter.
 * In production, use WebSocketServerWithWS for the 'ws' library.
 *
 * @example
 * ```typescript
 * const server = new WebSocketServer(backend, { port: 8080 });
 *
 * server.onConnection((conn) => {
 *   lobby.addConnection(conn);
 * });
 *
 * await server.start();
 * console.log('Server running on port 8080');
 * ```
 */
export class WebSocketServer {
  /** Server configuration */
  private readonly config: Required<WebSocketServerConfig>;

  /** Backend server implementation */
  private readonly backend: IWebSocketServerBackend;

  /** Active connections by ID */
  private readonly connections: Map<string, IClientConnection> = new Map();

  /** Connection handlers */
  private readonly connectionHandlers: Set<ConnectionHandler> = new Set();

  /** Error handlers */
  private readonly errorHandlers: Set<ServerErrorHandler> = new Set();

  /** Server start handlers */
  private readonly startHandlers: Set<ServerLifecycleHandler> = new Set();

  /** Server stop handlers */
  private readonly stopHandlers: Set<ServerLifecycleHandler> = new Set();

  /** Whether server is running */
  private _isRunning: boolean = false;

  /** Counter for connection IDs */
  private connectionIdCounter: number = 0;

  /**
   * @summary Creates a new WebSocket server.
   *
   * @param {IWebSocketServerBackend} backend - Server backend implementation
   * @param {WebSocketServerConfig} config - Server configuration
   *
   * @example
   * ```typescript
   * const backend = new WsBackend();
   * const server = new WebSocketServer(backend, {
   *   port: 8080,
   *   maxConnections: 50
   * });
   * ```
   */
  constructor(backend: IWebSocketServerBackend, config: WebSocketServerConfig) {
    this.backend = backend;
    this.config = {
      port: config.port,
      host: config.host ?? '0.0.0.0',
      path: config.path ?? '/',
      maxConnections: config.maxConnections ?? 100,
      connectionTimeoutMs: config.connectionTimeoutMs ?? 30000,
      webSocketConfig: config.webSocketConfig ?? {}
    };

    this.setupBackendHandlers();
  }

  /**
   * @summary Whether the server is currently running.
   */
  get isRunning(): boolean {
    return this._isRunning;
  }

  /**
   * @summary Gets the number of active connections.
   */
  get connectionCount(): number {
    return this.connections.size;
  }

  /**
   * @summary Sets up handlers for backend events.
   *
   * @private
   */
  private setupBackendHandlers(): void {
    this.backend.onConnection((socket) => {
      this.handleNewConnection(socket);
    });

    this.backend.onError((error) => {
      this.emitError(error);
    });
  }

  /**
   * @summary Handles a new WebSocket connection.
   *
   * @param {IWebSocket} socket - New WebSocket
   *
   * @private
   */
  private handleNewConnection(socket: IWebSocket): void {
    // Check connection limit
    if (this.connections.size >= this.config.maxConnections) {
      console.warn('Maximum connections reached, rejecting new connection');
      socket.close(1013, 'Maximum connections reached');
      return;
    }

    // Generate connection ID
    const connectionId = this.generateConnectionId();

    // Create connection wrapper
    const connection = new WebSocketConnection(
      connectionId,
      socket,
      this.config.webSocketConfig
    );

    // Track connection
    this.connections.set(connectionId, connection);

    // Handle disconnection
    connection.onDisconnect(() => {
      this.connections.delete(connectionId);
    });

    // Notify handlers
    this.emitConnection(connection);
  }

  /**
   * @summary Generates a unique connection ID.
   *
   * @returns {string} Unique ID
   *
   * @private
   */
  private generateConnectionId(): string {
    return `conn-${++this.connectionIdCounter}-${Date.now()}`;
  }

  /**
   * @summary Emits connection event to handlers.
   *
   * @param {IClientConnection} connection - New connection
   *
   * @private
   */
  private emitConnection(connection: IClientConnection): void {
    for (const handler of this.connectionHandlers) {
      try {
        handler(connection);
      } catch (error) {
        console.error('Error in connection handler:', error);
      }
    }
  }

  /**
   * @summary Emits error event to handlers.
   *
   * @param {Error} error - Error
   *
   * @private
   */
  private emitError(error: Error): void {
    for (const handler of this.errorHandlers) {
      try {
        handler(error);
      } catch (err) {
        console.error('Error in error handler:', err);
      }
    }
  }

  /**
   * @summary Registers a handler for new connections.
   *
   * @param {ConnectionHandler} handler - Handler function
   *
   * @returns {() => void} Unsubscribe function
   *
   * @example
   * ```typescript
   * const unsub = server.onConnection((conn) => {
   *   console.log(`New connection: ${conn.id}`);
   * });
   *
   * // Later: stop handling
   * unsub();
   * ```
   */
  onConnection(handler: ConnectionHandler): () => void {
    this.connectionHandlers.add(handler);
    return () => this.connectionHandlers.delete(handler);
  }

  /**
   * @summary Registers a handler for server errors.
   *
   * @param {ServerErrorHandler} handler - Handler function
   *
   * @returns {() => void} Unsubscribe function
   */
  onError(handler: ServerErrorHandler): () => void {
    this.errorHandlers.add(handler);
    return () => this.errorHandlers.delete(handler);
  }

  /**
   * @summary Registers a handler for server start event.
   *
   * @param {ServerLifecycleHandler} handler - Handler function
   *
   * @returns {() => void} Unsubscribe function
   */
  onStart(handler: ServerLifecycleHandler): () => void {
    this.startHandlers.add(handler);
    return () => this.startHandlers.delete(handler);
  }

  /**
   * @summary Registers a handler for server stop event.
   *
   * @param {ServerLifecycleHandler} handler - Handler function
   *
   * @returns {() => void} Unsubscribe function
   */
  onStop(handler: ServerLifecycleHandler): () => void {
    this.stopHandlers.add(handler);
    return () => this.stopHandlers.delete(handler);
  }

  /**
   * @summary Starts the WebSocket server.
   *
   * @returns {Promise<void>} Resolves when server is listening
   *
   * @throws {Error} If server is already running
   *
   * @example
   * ```typescript
   * await server.start();
   * console.log(`Server running on port ${server.config.port}`);
   * ```
   */
  start(): Promise<void> {
    if (this._isRunning) {
      return Promise.reject(new Error('Server is already running'));
    }

    return new Promise((resolve, reject) => {
      try {
        this.backend.listen(
          this.config.port,
          this.config.host,
          () => {
            this._isRunning = true;

            // Notify start handlers
            for (const handler of this.startHandlers) {
              try {
                handler();
              } catch (error) {
                console.error('Error in start handler:', error);
              }
            }

            resolve();
          }
        );
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * @summary Stops the WebSocket server.
   *
   * @returns {Promise<void>} Resolves when server is stopped
   *
   * @example
   * ```typescript
   * await server.stop();
   * console.log('Server stopped');
   * ```
   */
  stop(): Promise<void> {
    if (!this._isRunning) {
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      // Close all connections
      for (const connection of this.connections.values()) {
        connection.close('Server shutting down');
      }
      this.connections.clear();

      // Close server
      this.backend.close(() => {
        this._isRunning = false;

        // Notify stop handlers
        for (const handler of this.stopHandlers) {
          try {
            handler();
          } catch (error) {
            console.error('Error in stop handler:', error);
          }
        }

        resolve();
      });
    });
  }

  /**
   * @summary Gets a connection by ID.
   *
   * @param {string} id - Connection ID
   *
   * @returns {IClientConnection | undefined} Connection if found
   */
  getConnection(id: string): IClientConnection | undefined {
    return this.connections.get(id);
  }

  /**
   * @summary Gets all active connections.
   *
   * @returns {IClientConnection[]} Array of connections
   */
  getAllConnections(): IClientConnection[] {
    return Array.from(this.connections.values());
  }

  /**
   * @summary Broadcasts a message to all connections.
   *
   * @param {ServerMessage} message - Message to broadcast
   *
   * @example
   * ```typescript
   * server.broadcast({
   *   type: 'serverMessage',
   *   message: 'Server will restart in 5 minutes',
   *   timestamp: Date.now()
   * });
   * ```
   */
  broadcast(message: ServerMessage): void {
    for (const connection of this.connections.values()) {
      if (connection.isConnected()) {
        try {
          connection.send(message);
        } catch (error) {
          console.error(`Failed to broadcast to ${connection.id}:`, error);
        }
      }
    }
  }

  /**
   * @summary Broadcasts to connections matching a filter.
   *
   * @param {ServerMessage} message - Message to send
   * @param {(conn: IClientConnection) => boolean} filter - Filter function
   *
   * @example
   * ```typescript
   * // Broadcast to connections with low latency
   * server.broadcastFiltered(message, (conn) => conn.getLatency() < 100);
   * ```
   */
  broadcastFiltered(
    message: ServerMessage,
    filter: (conn: IClientConnection) => boolean
  ): void {
    for (const connection of this.connections.values()) {
      if (connection.isConnected() && filter(connection)) {
        try {
          connection.send(message);
        } catch (error) {
          console.error(`Failed to broadcast to ${connection.id}:`, error);
        }
      }
    }
  }

  /**
   * @summary Disconnects a specific connection.
   *
   * @param {string} id - Connection ID
   * @param {string} [reason] - Disconnect reason
   *
   * @returns {boolean} True if connection was found and closed
   */
  disconnect(id: string, reason?: string): boolean {
    const connection = this.connections.get(id);
    if (connection) {
      connection.close(reason);
      return true;
    }
    return false;
  }
}
