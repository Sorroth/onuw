/**
 * @fileoverview Connection status display utilities.
 * @module lib/connectionStatus
 *
 * @description
 * Encapsulates the mapping of WebSocket connection states to user-friendly
 * display properties following the Information Hiding principle.
 *
 * @pattern Information Hiding - Internal state-to-display mapping hidden from consumers
 * @pattern Strategy Pattern - Different display strategies for each connection state
 */

import { ConnectionState } from './websocket';

/**
 * Display properties for connection status.
 */
export interface ConnectionStatusDisplay {
  /** User-friendly status text */
  text: string;
  /** Tailwind CSS color class */
  color: string;
}

/**
 * Connection state to display mapping.
 * @internal
 */
const CONNECTION_STATUS_MAP: Record<ConnectionState, ConnectionStatusDisplay> = {
  disconnected: { text: 'Disconnected', color: 'text-red-500' },
  connecting: { text: 'Connecting...', color: 'text-yellow-500' },
  connected: { text: 'Connected', color: 'text-green-500' },
  reconnecting: { text: 'Reconnecting...', color: 'text-yellow-500' },
};

/**
 * Get display properties for a connection state.
 *
 * @param state - The current connection state
 * @returns Display properties including text and color
 *
 * @example
 * ```tsx
 * const { text, color } = getConnectionStatusDisplay(connectionState);
 * return <div className={color}>{text}</div>;
 * ```
 */
export function getConnectionStatusDisplay(state: ConnectionState): ConnectionStatusDisplay {
  return CONNECTION_STATUS_MAP[state];
}
