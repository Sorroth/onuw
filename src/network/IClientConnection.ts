/**
 * @fileoverview Client connection interface for network abstraction.
 * @module network/IClientConnection
 *
 * @summary Defines the interface for client connections, enabling multiple transport types.
 *
 * @description
 * This module provides a transport-agnostic interface for client connections:
 * - WebSocket connections for real-time human players
 * - Local connections for AI players (no network overhead)
 * - HTTP long-polling fallback (if needed)
 *
 * @pattern Adapter Pattern - Different connection types implement same interface
 *
 * @example
 * ```typescript
 * // WebSocket for human player
 * const humanConn = new WebSocketConnection('player-1', socket);
 *
 * // Local for AI player
 * const aiConn = new LocalAIConnection('ai-1', aiPlayer);
 *
 * // Both used identically
 * connection.send({ type: 'gameState', ... });
 * ```
 */

import { ServerMessage, ClientMessage } from './protocol';

/**
 * @summary Connection type identifier.
 */
export type ConnectionType = 'websocket' | 'local' | 'http';

/**
 * @summary Connection state.
 */
export type ConnectionState = 'connecting' | 'connected' | 'disconnected' | 'error';

/**
 * @summary Handler for incoming messages.
 */
export type MessageHandler = (message: ClientMessage) => void;

/**
 * @summary Handler for disconnection events.
 */
export type DisconnectHandler = (reason: string) => void;

/**
 * @summary Handler for connection errors.
 */
export type ErrorHandler = (error: Error) => void;

/**
 * @summary Interface for client connections.
 *
 * @description
 * Provides a unified interface for communicating with clients regardless
 * of the underlying transport mechanism. This enables:
 * - WebSocket for real-time browser/mobile connections
 * - Local connections for AI players (no network latency)
 * - Easy testing with mock connections
 *
 * @pattern Adapter Pattern - Adapts different transports to common interface
 * @pattern Strategy Pattern - Connection type is a strategy for communication
 *
 * @example
 * ```typescript
 * class GameServer {
 *   private connections: Map<string, IClientConnection> = new Map();
 *
 *   addPlayer(conn: IClientConnection): void {
 *     this.connections.set(conn.id, conn);
 *     conn.onMessage((msg) => this.handleMessage(conn.id, msg));
 *     conn.onDisconnect((reason) => this.handleDisconnect(conn.id, reason));
 *   }
 *
 *   broadcast(message: ServerMessage): void {
 *     for (const conn of this.connections.values()) {
 *       if (conn.isConnected()) {
 *         conn.send(message);
 *       }
 *     }
 *   }
 * }
 * ```
 */
export interface IClientConnection {
  /**
   * @summary Unique identifier for this connection.
   */
  readonly id: string;

  /**
   * @summary Type of connection transport.
   */
  readonly type: ConnectionType;

  /**
   * @summary Current connection state.
   */
  readonly state: ConnectionState;

  /**
   * @summary Sends a message to the client.
   *
   * @param {ServerMessage} message - Message to send
   *
   * @throws {Error} If connection is not in 'connected' state
   *
   * @example
   * ```typescript
   * connection.send({
   *   type: 'gameState',
   *   view: playerView,
   *   timestamp: Date.now()
   * });
   * ```
   */
  send(message: ServerMessage): void;

  /**
   * @summary Registers a handler for incoming messages.
   *
   * @param {MessageHandler} handler - Function to handle messages
   *
   * @returns {() => void} Unsubscribe function
   *
   * @example
   * ```typescript
   * const unsubscribe = connection.onMessage((msg) => {
   *   console.log('Received:', msg.type);
   * });
   *
   * // Later: stop listening
   * unsubscribe();
   * ```
   */
  onMessage(handler: MessageHandler): () => void;

  /**
   * @summary Registers a handler for disconnection events.
   *
   * @param {DisconnectHandler} handler - Function to handle disconnect
   *
   * @returns {() => void} Unsubscribe function
   */
  onDisconnect(handler: DisconnectHandler): () => void;

  /**
   * @summary Registers a handler for connection errors.
   *
   * @param {ErrorHandler} handler - Function to handle errors
   *
   * @returns {() => void} Unsubscribe function
   */
  onError(handler: ErrorHandler): () => void;

  /**
   * @summary Closes the connection.
   *
   * @param {string} [reason] - Optional reason for closing
   */
  close(reason?: string): void;

  /**
   * @summary Checks if connection is currently connected.
   *
   * @returns {boolean} True if connected
   */
  isConnected(): boolean;

  /**
   * @summary Gets connection latency in milliseconds.
   *
   * @returns {number} Latency in ms, or 0 for local connections
   */
  getLatency(): number;

  /**
   * @summary Gets when connection was established.
   *
   * @returns {number} Unix timestamp in milliseconds
   */
  getConnectedAt(): number;
}

/**
 * @summary Abstract base class for client connections.
 *
 * @description
 * Provides common functionality for all connection types:
 * - Event handler management
 * - State tracking
 * - Latency measurement
 *
 * @pattern Template Method - Subclasses implement transport-specific methods
 */
export abstract class AbstractClientConnection implements IClientConnection {
  /** @inheritdoc */
  abstract readonly type: ConnectionType;

  /** Connection state */
  protected _state: ConnectionState = 'connecting';

  /** Message handlers */
  protected messageHandlers: Set<MessageHandler> = new Set();

  /** Disconnect handlers */
  protected disconnectHandlers: Set<DisconnectHandler> = new Set();

  /** Error handlers */
  protected errorHandlers: Set<ErrorHandler> = new Set();

  /** When connection was established */
  protected connectedAt: number = 0;

  /** Last measured latency */
  protected latency: number = 0;

  /**
   * @summary Creates a new connection.
   *
   * @param {string} id - Unique connection identifier
   */
  constructor(readonly id: string) {}

  /** @inheritdoc */
  get state(): ConnectionState {
    return this._state;
  }

  /** @inheritdoc */
  abstract send(message: ServerMessage): void;

  /** @inheritdoc */
  onMessage(handler: MessageHandler): () => void {
    this.messageHandlers.add(handler);
    return () => this.messageHandlers.delete(handler);
  }

  /** @inheritdoc */
  onDisconnect(handler: DisconnectHandler): () => void {
    this.disconnectHandlers.add(handler);
    return () => this.disconnectHandlers.delete(handler);
  }

  /** @inheritdoc */
  onError(handler: ErrorHandler): () => void {
    this.errorHandlers.add(handler);
    return () => this.errorHandlers.delete(handler);
  }

  /** @inheritdoc */
  abstract close(reason?: string): void;

  /** @inheritdoc */
  isConnected(): boolean {
    return this._state === 'connected';
  }

  /** @inheritdoc */
  getLatency(): number {
    return this.latency;
  }

  /** @inheritdoc */
  getConnectedAt(): number {
    return this.connectedAt;
  }

  /**
   * @summary Emits a message to all handlers.
   *
   * @param {ClientMessage} message - Message to emit
   *
   * @protected
   */
  protected emitMessage(message: ClientMessage): void {
    for (const handler of this.messageHandlers) {
      try {
        handler(message);
      } catch (error) {
        console.error(`Error in message handler for ${this.id}:`, error);
      }
    }
  }

  /**
   * @summary Emits a disconnect event to all handlers.
   *
   * @param {string} reason - Disconnect reason
   *
   * @protected
   */
  protected emitDisconnect(reason: string): void {
    this._state = 'disconnected';
    for (const handler of this.disconnectHandlers) {
      try {
        handler(reason);
      } catch (error) {
        console.error(`Error in disconnect handler for ${this.id}:`, error);
      }
    }
  }

  /**
   * @summary Emits an error to all handlers.
   *
   * @param {Error} error - Error to emit
   *
   * @protected
   */
  protected emitError(error: Error): void {
    for (const handler of this.errorHandlers) {
      try {
        handler(error);
      } catch (err) {
        console.error(`Error in error handler for ${this.id}:`, err);
      }
    }
  }

  /**
   * @summary Marks connection as connected.
   *
   * @protected
   */
  protected setConnected(): void {
    this._state = 'connected';
    this.connectedAt = Date.now();
  }
}

/**
 * @summary Null Object implementation of IClientConnection for AI players.
 *
 * @description
 * NullConnection provides a no-op implementation of IClientConnection
 * for AI players that don't need network communication. This avoids
 * null checks throughout the codebase and follows the Null Object Pattern.
 *
 * All methods are no-ops or return sensible defaults:
 * - send() does nothing (AI doesn't need messages)
 * - isConnected() always returns true
 * - getLatency() returns 0 (no network delay)
 *
 * @pattern Null Object Pattern - Provides neutral behavior instead of null
 * @pattern Factory Pattern - Static create method for easy instantiation
 *
 * @example
 * ```typescript
 * // Create a null connection for an AI player
 * const aiConnection = NullConnection.create('ai-player-1');
 *
 * // Use like any other connection (no special handling needed)
 * room.addPlayer('ai-1', 'Bot Alice', aiConnection, true);
 * ```
 */
export class NullConnection implements IClientConnection {
  /** @inheritdoc */
  readonly id: string;

  /** @inheritdoc */
  readonly type: ConnectionType = 'local';

  /** @inheritdoc */
  readonly state: ConnectionState = 'connected';

  /** Timestamp when created */
  private readonly createdAt: number;

  /**
   * @summary Creates a new NullConnection.
   *
   * @param {string} id - Unique identifier for this connection
   *
   * @private Use NullConnection.create() instead
   */
  private constructor(id: string) {
    this.id = id;
    this.createdAt = Date.now();
  }

  /**
   * @summary Factory method to create a NullConnection.
   *
   * @param {string} id - Unique identifier for the AI player
   *
   * @returns {NullConnection} A new null connection instance
   *
   * @example
   * ```typescript
   * const aiConn = NullConnection.create('ai-1');
   * ```
   */
  static create(id: string): NullConnection {
    return new NullConnection(id);
  }

  /**
   * @summary No-op send - AI players don't receive network messages.
   *
   * @param {ServerMessage} _message - Message (ignored)
   */
  send(_message: ServerMessage): void {
    // No-op: AI players don't need network messages
  }

  /**
   * @summary No-op message handler registration.
   *
   * @param {MessageHandler} _handler - Handler (ignored)
   *
   * @returns {() => void} No-op unsubscribe function
   */
  onMessage(_handler: MessageHandler): () => void {
    return () => {};
  }

  /**
   * @summary No-op disconnect handler registration.
   *
   * @param {DisconnectHandler} _handler - Handler (ignored)
   *
   * @returns {() => void} No-op unsubscribe function
   */
  onDisconnect(_handler: DisconnectHandler): () => void {
    return () => {};
  }

  /**
   * @summary No-op error handler registration.
   *
   * @param {ErrorHandler} _handler - Handler (ignored)
   *
   * @returns {() => void} No-op unsubscribe function
   */
  onError(_handler: ErrorHandler): () => void {
    return () => {};
  }

  /**
   * @summary No-op close - AI connections don't need cleanup.
   *
   * @param {string} [_reason] - Reason (ignored)
   */
  close(_reason?: string): void {
    // No-op: nothing to close
  }

  /**
   * @summary Always returns true - AI is always "connected".
   *
   * @returns {boolean} Always true
   */
  isConnected(): boolean {
    return true;
  }

  /**
   * @summary Returns 0 - no network latency for AI.
   *
   * @returns {number} Always 0
   */
  getLatency(): number {
    return 0;
  }

  /**
   * @summary Returns creation timestamp.
   *
   * @returns {number} Unix timestamp when created
   */
  getConnectedAt(): number {
    return this.createdAt;
  }
}
