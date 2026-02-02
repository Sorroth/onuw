/**
 * @fileoverview WebSocket client with auto-reconnect and message handling.
 * @module lib/websocket
 *
 * @description
 * Low-level WebSocket client class that handles connection lifecycle,
 * automatic reconnection with exponential backoff, and heartbeat/ping-pong.
 *
 * @pattern Strategy Pattern - Reconnection strategy with configurable attempts/delay
 * @pattern Observer Pattern - Callbacks for state changes, messages, and errors
 * @pattern Template Method Pattern - setupEventHandlers defines the connection flow
 */

import { safeJsonParse } from './utils';

/**
 * WebSocket configuration defaults.
 * @internal
 */
const WS_DEFAULTS = {
  /** Maximum number of reconnection attempts before giving up */
  RECONNECT_ATTEMPTS: 5,
  /** Base delay between reconnection attempts in milliseconds */
  RECONNECT_DELAY_MS: 1000,
  /** Interval between ping messages in milliseconds */
  PING_INTERVAL_MS: 30000,
} as const;

export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';

export interface WebSocketClientOptions {
  url: string;
  token?: string;
  playerId?: string;
  playerName?: string;
  onMessage: (message: unknown) => void;
  onStateChange: (state: ConnectionState) => void;
  onError?: (error: Event) => void;
  reconnectAttempts?: number;
  reconnectDelay?: number;
}

export class GameWebSocket {
  private ws: WebSocket | null = null;
  private options: WebSocketClientOptions;
  private reconnectCount = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private pingInterval: NodeJS.Timeout | null = null;
  private state: ConnectionState = 'disconnected';

  constructor(options: WebSocketClientOptions) {
    this.options = {
      reconnectAttempts: WS_DEFAULTS.RECONNECT_ATTEMPTS,
      reconnectDelay: WS_DEFAULTS.RECONNECT_DELAY_MS,
      ...options
    };
  }

  connect(): void {
    if (this.state === 'connected' || this.state === 'connecting') {
      return;
    }

    this.setState(this.reconnectCount > 0 ? 'reconnecting' : 'connecting');

    try {
      this.ws = new WebSocket(this.options.url);
      this.setupEventHandlers();
    } catch (error) {
      console.error('WebSocket connection error:', error);
      this.handleReconnect();
    }
  }

  disconnect(): void {
    this.clearTimers();
    this.reconnectCount = 0;

    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }

    this.setState('disconnected');
  }

  send(message: object): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      const payload = JSON.stringify({
        ...message,
        timestamp: Date.now()
      });
      console.log('[WebSocket] Sending:', message);
      this.ws.send(payload);
    } else {
      console.warn('[WebSocket] Not connected (readyState:', this.ws?.readyState, '), cannot send:', message);
    }
  }

  getState(): ConnectionState {
    return this.state;
  }

  /**
   * Update authentication credentials for reconnection.
   * Call this when guest authenticates so reconnect will re-auth properly.
   */
  updateCredentials(playerId: string, playerName: string, token?: string): void {
    this.options.playerId = playerId;
    this.options.playerName = playerName;
    if (token) {
      this.options.token = token;
    }
  }

  private setupEventHandlers(): void {
    if (!this.ws) return;

    this.ws.onopen = () => {
      this.reconnectCount = 0;
      this.setState('connected');
      this.startPingInterval();

      // Re-authenticate on connect/reconnect if we have credentials
      // This handles both token-based auth and guest auth (playerId + playerName)
      if (this.options.token || this.options.playerId) {
        this.send({
          type: 'authenticate',
          token: this.options.token,
          playerId: this.options.playerId,
          playerName: this.options.playerName
        });
      }
    };

    this.ws.onclose = (event) => {
      this.clearTimers();

      if (event.code !== 1000) {
        // Abnormal close, attempt reconnect
        this.handleReconnect();
      } else {
        this.setState('disconnected');
      }
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      this.options.onError?.(error);
    };

    this.ws.onmessage = (event) => {
      const message = safeJsonParse(event.data);
      if (message) {
        // Log all received messages for debugging
        const msgType = (message as { type?: string }).type;
        if (msgType && msgType !== 'pong') {
          console.log('[WebSocket] Received:', msgType, message);
        }
        this.options.onMessage(message);
      }
    };
  }

  private handleReconnect(): void {
    if (this.reconnectCount >= (this.options.reconnectAttempts ?? WS_DEFAULTS.RECONNECT_ATTEMPTS)) {
      console.error('Max reconnect attempts reached');
      this.setState('disconnected');
      return;
    }

    this.reconnectCount++;
    const delay = (this.options.reconnectDelay ?? WS_DEFAULTS.RECONNECT_DELAY_MS) * Math.pow(2, this.reconnectCount - 1);

    console.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectCount})`);

    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, delay);
  }

  private startPingInterval(): void {
    this.pingInterval = setInterval(() => {
      this.send({ type: 'ping' });
    }, WS_DEFAULTS.PING_INTERVAL_MS);
  }

  private clearTimers(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  private setState(state: ConnectionState): void {
    this.state = state;
    this.options.onStateChange(state);
  }
}
