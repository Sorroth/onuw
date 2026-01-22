/**
 * @fileoverview WebSocket implementation of IClientConnection.
 * @module network/WebSocketConnection
 *
 * @summary Implements client connection over WebSocket transport.
 *
 * @description
 * WebSocketConnection adapts WebSocket to the IClientConnection interface:
 * - Wraps native WebSocket for browser/Node.js compatibility
 * - Handles message serialization/deserialization
 * - Manages connection lifecycle and heartbeats
 * - Supports latency measurement via ping/pong
 *
 * @pattern Adapter Pattern - Adapts WebSocket to IClientConnection
 *
 * @example
 * ```typescript
 * // Server-side with ws library
 * import WebSocket from 'ws';
 *
 * wss.on('connection', (socket) => {
 *   const connection = new WebSocketConnection('player-1', socket);
 *   connection.onMessage((msg) => handleMessage(msg));
 * });
 * ```
 */

import { AbstractClientConnection, ConnectionType } from './IClientConnection';
import { ServerMessage, ClientMessage, isClientMessage, createMessage } from './protocol';

/**
 * @summary Configuration for WebSocket connection.
 */
export interface WebSocketConfig {
  /** Interval for ping messages in milliseconds */
  pingIntervalMs: number;

  /** Timeout for pong response in milliseconds */
  pongTimeoutMs: number;

  /** Maximum message size in bytes */
  maxMessageSize: number;

  /** Whether to enable compression */
  enableCompression: boolean;
}

/**
 * @summary Default WebSocket configuration.
 */
export const DEFAULT_WEBSOCKET_CONFIG: WebSocketConfig = {
  pingIntervalMs: 30000,
  pongTimeoutMs: 10000,
  maxMessageSize: 65536,
  enableCompression: false
};

/**
 * @summary Minimal WebSocket interface for cross-platform compatibility.
 *
 * @description
 * This interface defines the minimum WebSocket functionality needed,
 * allowing compatibility with both browser WebSocket and Node.js ws library.
 */
export interface IWebSocket {
  /** Ready state constants */
  readonly CONNECTING: number;
  readonly OPEN: number;
  readonly CLOSING: number;
  readonly CLOSED: number;

  /** Current ready state */
  readonly readyState: number;

  /** Send data through the socket */
  send(data: string): void;

  /** Close the connection */
  close(code?: number, reason?: string): void;

  /** Add event listener */
  addEventListener(type: string, listener: (event: unknown) => void): void;

  /** Remove event listener */
  removeEventListener(type: string, listener: (event: unknown) => void): void;
}

/**
 * @summary WebSocket implementation of IClientConnection.
 *
 * @description
 * Provides real-time bidirectional communication with clients via WebSocket.
 * Handles message serialization, heartbeats, and connection management.
 *
 * @extends AbstractClientConnection
 *
 * @pattern Adapter Pattern - Adapts WebSocket to IClientConnection
 *
 * @remarks
 * - Messages are JSON serialized/deserialized automatically
 * - Heartbeat pings maintain connection and measure latency
 * - Graceful handling of disconnection and errors
 *
 * @example
 * ```typescript
 * const connection = new WebSocketConnection('player-1', socket);
 *
 * connection.onMessage((msg) => {
 *   if (msg.type === 'actionResponse') {
 *     // Handle player response
 *   }
 * });
 *
 * connection.send({
 *   type: 'gameState',
 *   view: playerView,
 *   timestamp: Date.now()
 * });
 * ```
 */
export class WebSocketConnection extends AbstractClientConnection {
  /** @inheritdoc */
  readonly type: ConnectionType = 'websocket';

  /** The underlying WebSocket */
  private readonly socket: IWebSocket;

  /** Configuration */
  private readonly config: WebSocketConfig;

  /** Ping interval handle */
  private pingInterval: ReturnType<typeof setInterval> | null = null;

  /** Pong timeout handle */
  private pongTimeout: ReturnType<typeof setTimeout> | null = null;

  /** Time when last ping was sent */
  private lastPingTime: number = 0;

  /** Bound event handlers for cleanup */
  private boundHandlers: {
    message: (event: unknown) => void;
    close: (event: unknown) => void;
    error: (event: unknown) => void;
  };

  /**
   * @summary Creates a new WebSocket connection.
   *
   * @description
   * Wraps an existing WebSocket and sets up event handlers.
   * The socket should already be connected.
   *
   * @param {string} id - Unique connection identifier
   * @param {IWebSocket} socket - WebSocket instance to wrap
   * @param {Partial<WebSocketConfig>} [config] - Optional configuration
   *
   * @example
   * ```typescript
   * // Server-side
   * wss.on('connection', (socket) => {
   *   const conn = new WebSocketConnection('conn-1', socket);
   * });
   *
   * // Client-side
   * const socket = new WebSocket('ws://localhost:8080');
   * socket.onopen = () => {
   *   const conn = new WebSocketConnection('conn-1', socket);
   * };
   * ```
   */
  constructor(
    id: string,
    socket: IWebSocket,
    config: Partial<WebSocketConfig> = {}
  ) {
    super(id);
    this.socket = socket;
    this.config = { ...DEFAULT_WEBSOCKET_CONFIG, ...config };

    // Create bound handlers for proper cleanup
    this.boundHandlers = {
      message: (event: unknown) => this.handleMessage(event),
      close: (event: unknown) => this.handleClose(event),
      error: (event: unknown) => this.handleError(event)
    };

    this.setupSocket();
  }

  /**
   * @summary Sets up WebSocket event handlers.
   *
   * @private
   */
  private setupSocket(): void {
    // Check if already connected
    if (this.socket.readyState === this.socket.OPEN) {
      this.setConnected();
      this.startHeartbeat();
    } else if (this.socket.readyState === this.socket.CONNECTING) {
      this._state = 'connecting';
    } else {
      this._state = 'disconnected';
      return;
    }

    // Add event listeners
    this.socket.addEventListener('message', this.boundHandlers.message);
    this.socket.addEventListener('close', this.boundHandlers.close);
    this.socket.addEventListener('error', this.boundHandlers.error);
  }

  /**
   * @summary Handles incoming WebSocket messages.
   *
   * @param {unknown} event - WebSocket message event
   *
   * @private
   */
  private handleMessage(event: unknown): void {
    try {
      // Extract data from event (browser vs Node.js compatibility)
      const eventData = (event as { data?: unknown }).data;
      const data = typeof eventData === 'string' ? eventData : String(eventData);

      const parsed = JSON.parse(data);

      // Handle pong response
      if (parsed.type === 'pong') {
        this.handlePong();
        return;
      }

      // Validate and emit client message
      if (isClientMessage(parsed)) {
        this.emitMessage(parsed);
      } else {
        console.warn(`Invalid message from ${this.id}:`, parsed);
      }
    } catch (error) {
      console.error(`Error parsing message from ${this.id}:`, error);
      this.emitError(new Error(`Failed to parse message: ${error}`));
    }
  }

  /**
   * @summary Handles WebSocket close event.
   *
   * @param {unknown} event - Close event
   *
   * @private
   */
  private handleClose(event: unknown): void {
    this.stopHeartbeat();

    const closeEvent = event as { code?: number; reason?: string };
    const reason = closeEvent.reason || `Code: ${closeEvent.code || 'unknown'}`;

    this.emitDisconnect(reason);
  }

  /**
   * @summary Handles WebSocket error event.
   *
   * @param {unknown} event - Error event
   *
   * @private
   */
  private handleError(event: unknown): void {
    const errorEvent = event as { error?: Error; message?: string };
    const error = errorEvent.error || new Error(errorEvent.message || 'WebSocket error');

    this._state = 'error';
    this.emitError(error);
  }

  /**
   * @summary Starts the heartbeat ping/pong cycle.
   *
   * @private
   */
  private startHeartbeat(): void {
    this.stopHeartbeat();

    this.pingInterval = setInterval(() => {
      this.sendPing();
    }, this.config.pingIntervalMs);
  }

  /**
   * @summary Stops the heartbeat cycle.
   *
   * @private
   */
  private stopHeartbeat(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }

    if (this.pongTimeout) {
      clearTimeout(this.pongTimeout);
      this.pongTimeout = null;
    }
  }

  /**
   * @summary Sends a ping message.
   *
   * @private
   */
  private sendPing(): void {
    if (this._state !== 'connected') {
      return;
    }

    this.lastPingTime = Date.now();

    try {
      this.socket.send(JSON.stringify({
        type: 'ping',
        timestamp: this.lastPingTime
      }));

      // Set timeout for pong response
      this.pongTimeout = setTimeout(() => {
        console.warn(`Connection ${this.id} pong timeout`);
        this.close('Pong timeout');
      }, this.config.pongTimeoutMs);
    } catch (error) {
      console.error(`Error sending ping to ${this.id}:`, error);
    }
  }

  /**
   * @summary Handles pong response.
   *
   * @private
   */
  private handlePong(): void {
    if (this.pongTimeout) {
      clearTimeout(this.pongTimeout);
      this.pongTimeout = null;
    }

    this.latency = Date.now() - this.lastPingTime;
  }

  /** @inheritdoc */
  send(message: ServerMessage): void {
    if (this._state !== 'connected') {
      throw new Error(`Cannot send message: connection ${this.id} is ${this._state}`);
    }

    try {
      const serialized = JSON.stringify(message);

      if (serialized.length > this.config.maxMessageSize) {
        throw new Error(`Message exceeds maximum size of ${this.config.maxMessageSize} bytes`);
      }

      this.socket.send(serialized);
    } catch (error) {
      console.error(`Error sending message to ${this.id}:`, error);
      this.emitError(error instanceof Error ? error : new Error(String(error)));
    }
  }

  /** @inheritdoc */
  close(reason?: string): void {
    this.stopHeartbeat();

    // Remove event listeners
    this.socket.removeEventListener('message', this.boundHandlers.message);
    this.socket.removeEventListener('close', this.boundHandlers.close);
    this.socket.removeEventListener('error', this.boundHandlers.error);

    if (this.socket.readyState === this.socket.OPEN ||
        this.socket.readyState === this.socket.CONNECTING) {
      this.socket.close(1000, reason || 'Normal closure');
    }

    if (this._state !== 'disconnected') {
      this.emitDisconnect(reason || 'Connection closed');
    }
  }
}

/**
 * @summary Factory for creating WebSocket connections.
 *
 * @description
 * Provides convenient methods for creating WebSocket connections
 * with various configurations.
 *
 * @pattern Factory Pattern - Creates WebSocketConnection instances
 */
export class WebSocketConnectionFactory {
  /**
   * @summary Creates a connection with default configuration.
   *
   * @param {string} id - Connection ID
   * @param {IWebSocket} socket - WebSocket instance
   *
   * @returns {WebSocketConnection} New connection
   */
  static create(id: string, socket: IWebSocket): WebSocketConnection {
    return new WebSocketConnection(id, socket);
  }

  /**
   * @summary Creates a connection with custom ping interval.
   *
   * @param {string} id - Connection ID
   * @param {IWebSocket} socket - WebSocket instance
   * @param {number} pingIntervalMs - Ping interval in milliseconds
   *
   * @returns {WebSocketConnection} New connection
   */
  static createWithPingInterval(
    id: string,
    socket: IWebSocket,
    pingIntervalMs: number
  ): WebSocketConnection {
    return new WebSocketConnection(id, socket, { pingIntervalMs });
  }
}
