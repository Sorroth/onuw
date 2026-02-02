'use client';

/**
 * @fileoverview WebSocket hook for game server communication.
 * @module hooks/useWebSocket
 *
 * @description
 * Provides a React hook interface for WebSocket communication with the
 * game server. Handles connection lifecycle, authentication, and game actions.
 *
 * @pattern Facade Pattern - Simplifies complex WebSocket and store interactions
 * @pattern Observer Pattern - Reacts to connection state changes via Zustand
 * @pattern Adapter Pattern - Adapts store methods to hook-friendly interface
 */

import { useEffect, useCallback } from 'react';
import { useGameStore } from '@/stores/gameStore';

/**
 * WebSocket connection defaults.
 * @internal
 */
const WS_DEFAULTS = {
  /** Default WebSocket URL for local development */
  LOCAL_URL: 'ws://localhost:8080',
} as const;

/** WebSocket server URL from environment or local development default */
const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? WS_DEFAULTS.LOCAL_URL;

/**
 * @summary Hook for WebSocket game server communication.
 *
 * @description
 * Manages WebSocket connection lifecycle and provides methods for
 * authentication and game actions. Automatically connects on mount
 * and rehydrates stored credentials.
 *
 * @returns WebSocket state and action methods
 *
 * @example
 * ```tsx
 * function GameLobby() {
 *   const { isConnected, isAuthenticated, createRoom } = useWebSocket();
 *
 *   if (!isConnected) return <div>Connecting...</div>;
 *   return <button onClick={() => createRoom({})}>Create Room</button>;
 * }
 * ```
 */
export function useWebSocket() {
  const {
    connectionState,
    connect,
    disconnect,
    playerId,
    playerName,
    isAuthenticated,
    roomState,
    gameView,
    gameResult,
    gameSummary,
    publicRooms,
    error,
    isLoading,
    setPlayerInfo,
    createRoom,
    joinRoom,
    listPublicRooms,
    leaveRoom,
    setReady,
    addAI,
    startGame,
    submitStatement,
    submitVote,
    sendActionResponse,
    login,
    register,
    rehydrate,
    setError
  } = useGameStore();

  // Rehydrate from localStorage and connect on mount
  // NOTE: We do NOT disconnect on unmount because the WebSocket connection
  // is stored globally in Zustand and should persist across page navigations.
  // The connection is only closed on explicit logout or browser close.
  useEffect(() => {
    // Rehydrate state from localStorage first
    rehydrate();
    // Read current state directly from store to avoid stale closure
    const currentState = useGameStore.getState().connectionState;
    // Only connect if not already connected
    if (currentState === 'disconnected') {
      connect(WS_URL);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Authenticate as guest when connected but not authenticated
  const authenticateAsGuest = useCallback((name: string) => {
    const { ws } = useGameStore.getState();
    const guestId = `guest-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    setPlayerInfo(guestId, name);
    // Store credentials for auto-reconnect
    ws?.updateCredentials(guestId, name);
    ws?.send({
      type: 'authenticate',
      playerId: guestId,
      playerName: name
    });
  }, [setPlayerInfo]);

  return {
    // Connection state
    connectionState,
    isConnected: connectionState === 'connected',
    isConnecting: connectionState === 'connecting' || connectionState === 'reconnecting',

    // Player state
    playerId,
    playerName,
    isAuthenticated,

    // Game state
    roomState,
    gameView,
    gameResult,
    gameSummary,
    publicRooms,

    // UI state
    error,
    isLoading,

    // Actions
    connect: () => connect(WS_URL),
    disconnect,
    authenticateAsGuest,
    createRoom,
    joinRoom,
    listPublicRooms,
    leaveRoom,
    setReady,
    addAI,
    startGame,
    submitStatement,
    submitVote,
    sendActionResponse,
    login,
    register,
    clearError: () => setError(null)
  };
}
