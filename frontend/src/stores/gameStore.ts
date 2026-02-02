/**
 * @fileoverview Zustand store for game state management.
 * @module stores/gameStore
 *
 * @description
 * Central state management for the ONUW game client using Zustand.
 * Manages connection state, player identity, room state, game state,
 * and all game actions.
 *
 * @pattern Mediator Pattern - Centralizes game state and coordinates components
 * @pattern Observer Pattern - Zustand subscribers react to state changes
 * @pattern Command Pattern - Game actions encapsulated as store methods
 * @pattern State Pattern - Different behaviors based on connectionState/gamePhase
 */

import { create } from 'zustand';
import {
  GamePhase,
  RoleName,
  Team,
  RoomState,
  SerializablePlayerGameView,
  SerializableGameResult,
  GameSummary,
  NightActionResult,
  PlayerStatement,
  PublicPlayerInfo,
  ActionRequest,
  PublicRoomInfo
} from '@/types/game';
import { GameWebSocket, ConnectionState } from '@/lib/websocket';
import { STORAGE_KEYS } from '@/lib/storageKeys';
import { useDebugStore } from './debugStore';

interface GameStore {
  // Connection state
  connectionState: ConnectionState;
  ws: GameWebSocket | null;

  // Player identity
  playerId: string | null;
  playerName: string;
  isAuthenticated: boolean;
  authToken: string | null;
  isAdmin: boolean;

  // Room state
  roomState: RoomState | null;

  // Game state
  gameView: SerializablePlayerGameView | null;
  gameResult: SerializableGameResult | null;
  gameSummary: GameSummary | null;

  // Player ID mapping (game internal -> room IDs)
  playerIdMapping: Record<string, string>;

  // Action request (pending server request for player action)
  pendingActionRequest: ActionRequest | null;

  // UI state
  error: string | null;
  isLoading: boolean;

  // Public rooms (for room browser)
  publicRooms: PublicRoomInfo[];

  // Actions
  setConnectionState: (state: ConnectionState) => void;
  setPlayerInfo: (id: string, name: string) => void;
  setAuthToken: (token: string | null) => void;
  setIsAdmin: (isAdmin: boolean) => void;
  setRoomState: (room: RoomState | null) => void;
  setGameView: (view: SerializablePlayerGameView | null) => void;
  setGameResult: (result: SerializableGameResult | null, summary: GameSummary | null) => void;
  setPlayerIdMapping: (mapping: Record<string, string>) => void;
  setError: (error: string | null) => void;
  setLoading: (loading: boolean) => void;
  addStatement: (statement: PlayerStatement) => void;
  setPendingActionRequest: (request: ActionRequest | null) => void;
  rehydrate: () => void;

  // WebSocket connection
  connect: (url: string) => void;
  disconnect: () => void;

  // Game actions
  createRoom: (config: Partial<RoomState['config']>) => void;
  joinRoom: (roomCode: string, playerName: string) => void;
  listPublicRooms: () => void;
  leaveRoom: () => void;
  setReady: (ready: boolean) => void;
  addAI: () => void;
  kickPlayer: (playerId: string) => void;
  startGame: () => void;
  submitStatement: (statement: string) => void;
  submitVote: (targetId: string) => void;
  readyToVote: () => void;
  sendActionResponse: (requestId: string, response: unknown) => void;
  updateRoomConfig: (config: Partial<RoomState['config']>) => void;

  // Auth actions
  login: (email: string, password: string) => void;
  register: (email: string, password: string, displayName: string) => void;

  // Reset
  reset: () => void;
}

// Helper to safely access localStorage (SSR-safe)
const getStoredAuth = () => {
  if (typeof window === 'undefined') return { token: null, playerId: null, playerName: '' };
  try {
    const token = localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
    const playerId = localStorage.getItem(STORAGE_KEYS.PLAYER_ID);
    const playerName = localStorage.getItem(STORAGE_KEYS.PLAYER_NAME) ?? '';
    return { token, playerId, playerName };
  } catch {
    return { token: null, playerId: null, playerName: '' };
  }
};

const saveAuthToStorage = (token: string | null, playerId: string | null, playerName: string) => {
  if (typeof window === 'undefined') return;
  try {
    if (token) {
      localStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, token);
      localStorage.setItem(STORAGE_KEYS.PLAYER_ID, playerId ?? '');
      localStorage.setItem(STORAGE_KEYS.PLAYER_NAME, playerName);
    } else {
      localStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN);
      localStorage.removeItem(STORAGE_KEYS.PLAYER_ID);
      localStorage.removeItem(STORAGE_KEYS.PLAYER_NAME);
    }
  } catch {
    // localStorage not available
  }
};

const storedAuth = getStoredAuth();

const initialState = {
  connectionState: 'disconnected' as ConnectionState,
  ws: null as GameWebSocket | null,
  playerId: storedAuth.playerId,
  playerName: storedAuth.playerName,
  isAuthenticated: !!storedAuth.token,
  authToken: storedAuth.token,
  isAdmin: false,
  roomState: null,
  gameView: null,
  gameResult: null,
  gameSummary: null,
  playerIdMapping: {},
  pendingActionRequest: null as ActionRequest | null,
  error: null,
  isLoading: false,
  publicRooms: [] as PublicRoomInfo[],
};

export const useGameStore = create<GameStore>((set, get) => ({
  ...initialState,

  setConnectionState: (state) => set({ connectionState: state }),

  setPlayerInfo: (id, name) => set({
    playerId: id,
    playerName: name
  }),

  setAuthToken: (token) => set({
    authToken: token,
    isAuthenticated: !!token
  }),

  setIsAdmin: (isAdmin) => set({ isAdmin }),

  // Rehydrate state from localStorage (call after client mount)
  rehydrate: () => {
    if (typeof window === 'undefined') return;
    const stored = getStoredAuth();
    if (stored.token) {
      console.log('[Store] Rehydrating from localStorage, playerName:', stored.playerName);
      set({
        authToken: stored.token,
        playerId: stored.playerId,
        playerName: stored.playerName,
        isAuthenticated: true
      });
    }
  },

  setRoomState: (room) => set({ roomState: room }),

  setGameView: (view) => set({ gameView: view }),

  setGameResult: (result, summary) => set({
    gameResult: result,
    gameSummary: summary
  }),

  setPlayerIdMapping: (mapping) => set({ playerIdMapping: mapping }),

  setError: (error) => set({ error }),

  setLoading: (loading) => set({ isLoading: loading }),

  setPendingActionRequest: (request) => set({ pendingActionRequest: request }),

  addStatement: (statement) => set((state) => {
    if (!state.gameView) return state;
    return {
      gameView: {
        ...state.gameView,
        statements: [...state.gameView.statements, statement]
      }
    };
  }),

  connect: (url) => {
    const { ws: existingWs } = get();
    if (existingWs) {
      existingWs.disconnect();
    }

    const { authToken, playerId, playerName } = get();
    const ws = new GameWebSocket({
      url,
      token: authToken ?? undefined,
      playerId: playerId ?? undefined,
      playerName: playerName || undefined,
      onStateChange: (state) => {
        set({ connectionState: state });
      },
      onMessage: (message) => {
        handleServerMessage(message as ServerMessage, get, set);
      },
      onError: () => {
        set({ error: 'Connection error' });
      }
    });

    set({ ws });
    ws.connect();
  },

  disconnect: () => {
    const { ws } = get();
    if (ws) {
      ws.disconnect();
    }
    set({ ws: null, connectionState: 'disconnected' });
  },

  createRoom: (config) => {
    const { ws } = get();
    const message = {
      type: 'createRoom',
      config: {
        minPlayers: 3,
        maxPlayers: 5,
        roles: [
          RoleName.WEREWOLF,
          RoleName.WEREWOLF,
          RoleName.SEER,
          RoleName.ROBBER,
          RoleName.TROUBLEMAKER,
          RoleName.VILLAGER,
          RoleName.VILLAGER,
          RoleName.DRUNK
        ],
        timeoutStrategy: 'casual',
        isPrivate: false,
        allowSpectators: false,
        ...config
      }
    };

    ws?.send(message);
  },

  joinRoom: (roomCode, playerName) => {
    const { ws } = get();
    set({ playerName });
    ws?.send({
      type: 'joinRoom',
      roomCode,
      playerName
    });
  },

  listPublicRooms: () => {
    const { ws } = get();
    ws?.send({ type: 'listPublicRooms' });
  },

  leaveRoom: () => {
    const { ws } = get();
    ws?.send({ type: 'leaveRoom' });
    set({
      roomState: null,
      gameView: null,
      gameResult: null,
      gameSummary: null
    });
  },

  setReady: (ready) => {
    const { ws } = get();
    ws?.send({ type: 'setReady', ready });
  },

  addAI: () => {
    const { ws } = get();
    console.log('[gameStore] addAI called, ws:', ws ? 'connected' : 'null');
    if (ws) {
      ws.send({ type: 'addAI' });
      console.log('[gameStore] addAI message sent');
    } else {
      console.error('[gameStore] Cannot add AI - WebSocket not connected');
    }
  },

  kickPlayer: (playerId) => {
    const { ws } = get();
    ws?.send({ type: 'removePlayer', playerId });
  },

  startGame: () => {
    const { ws } = get();
    const debugOptions = useDebugStore.getState().getDebugOptions();

    const message: Record<string, unknown> = { type: 'startGame' };

    // Add debug options if debug mode is enabled
    if (debugOptions) {
      message.debug = debugOptions;
    }

    ws?.send(message);
  },

  submitStatement: (statement) => {
    const { ws } = get();
    ws?.send({ type: 'submitStatement', statement });
  },

  submitVote: (targetId) => {
    const { ws } = get();
    ws?.send({
      type: 'actionResponse',
      requestId: 'vote',
      response: targetId
    });
  },

  readyToVote: () => {
    const { ws } = get();
    ws?.send({ type: 'readyToVote' });
  },

  sendActionResponse: (requestId, response) => {
    const { ws } = get();
    ws?.send({
      type: 'actionResponse',
      requestId,
      response
    });
    // Clear pending request immediately (will be confirmed by actionAcknowledged)
    set({ pendingActionRequest: null });
  },

  updateRoomConfig: (config) => {
    const { ws, roomState } = get();
    if (!roomState) return;
    ws?.send({
      type: 'updateRoomConfig',
      config: {
        ...roomState.config,
        ...config
      }
    });
  },

  login: (email, password) => {
    const { ws } = get();
    set({ isLoading: true, error: null });
    ws?.send({ type: 'login', email, password });
  },

  register: (email, password, displayName) => {
    const { ws } = get();
    set({ isLoading: true, error: null, playerName: displayName });
    ws?.send({ type: 'register', email, password, displayName });
  },

  reset: () => {
    const { ws } = get();
    if (ws) {
      ws.disconnect();
    }
    saveAuthToStorage(null, null, '');
    // Reset debug store
    useDebugStore.getState().resetDebugState();
    set({
      ...initialState,
      authToken: null,
      playerId: null,
      playerName: '',
      isAuthenticated: false,
      isAdmin: false
    });
  }
}));

// Server message type (simplified for handling)
interface ServerMessage {
  type: string;
  [key: string]: unknown;
}

// Handle incoming server messages
function handleServerMessage(
  message: ServerMessage,
  get: () => GameStore,
  set: (partial: Partial<GameStore>) => void
) {
  const { type } = message;

  switch (type) {
    case 'authenticated':
      set({
        playerId: message.playerId as string,
        playerName: message.playerName as string,
        isAuthenticated: true,
        isAdmin: (message.isAdmin as boolean) ?? false
      });
      break;

    case 'error':
      set({
        error: message.message as string,
        isLoading: false
      });
      break;

    case 'roomCreated':
    case 'roomJoined':
    case 'roomUpdate':
      set({ roomState: message.state as RoomState, error: null });
      break;

    case 'roomClosed':
      set({
        roomState: null,
        error: message.reason as string
      });
      break;

    case 'publicRoomsResponse':
      set({ publicRooms: (message.rooms as PublicRoomInfo[]) ?? [] });
      break;

    case 'gameStarted':
      set({
        gameView: message.view as SerializablePlayerGameView,
        playerIdMapping: (message.playerIdMapping as Record<string, string>) ?? {},
        gameResult: null,
        gameSummary: null
      });
      break;

    case 'phaseChange': {
      const currentView = get().gameView;
      console.log('[Store] phaseChange received:', message.phase, 'timeRemaining:', message.timeRemaining);
      if (currentView) {
        set({
          gameView: {
            ...currentView,
            phase: message.phase as GamePhase,
            timeRemaining: message.timeRemaining as number | null
          }
        });
      }
      break;
    }

    case 'gameState': {
      const view = message.view as SerializablePlayerGameView;
      console.log('[Store] gameState received, phase:', view.phase, 'timeRemaining:', view.timeRemaining);
      set({ gameView: view });
      break;
    }

    case 'nightResult': {
      const result = message.result as NightActionResult;
      const currentView = get().gameView;
      if (currentView) {
        set({
          gameView: {
            ...currentView,
            myNightInfo: [...currentView.myNightInfo, result]
          }
        });
      }
      break;
    }

    case 'statementMade': {
      const statement: PlayerStatement = {
        playerId: message.playerId as string,
        statement: message.statement as string,
        timestamp: message.timestamp as number
      };
      get().addStatement(statement);
      break;
    }

    case 'votesRevealed': {
      const currentView = get().gameView;
      if (currentView) {
        set({
          gameView: {
            ...currentView,
            votes: message.votes as Record<string, string>
          }
        });
      }
      break;
    }

    case 'elimination': {
      const currentView = get().gameView;
      if (currentView) {
        set({
          gameView: {
            ...currentView,
            eliminatedPlayers: message.playerIds as string[]
          }
        });
      }
      break;
    }

    case 'gameEnd':
      set({
        gameResult: message.result as SerializableGameResult,
        gameSummary: message.summary as GameSummary
      });
      break;

    case 'loginResponse':
      if (message.success) {
        const token = message.token as string;
        const odplayerId = message.userId as string;
        const displayName = (message.displayName as string) || 'Player';
        console.log('[Auth] Login response received, displayName:', message.displayName, '->', displayName);
        saveAuthToStorage(token, odplayerId, displayName);
        set({
          authToken: token,
          playerId: odplayerId,
          playerName: displayName,
          isAuthenticated: true,
          isLoading: false
        });
        // Send authenticate message to create server session
        const { ws } = get();
        ws?.send({
          type: 'authenticate',
          playerId: odplayerId,
          playerName: displayName,
          token
        });
      } else {
        set({
          error: message.error as string,
          isLoading: false
        });
      }
      break;

    case 'registerResponse':
      if (message.success) {
        const token = message.token as string;
        const userId = message.userId as string;
        // Use stored playerName from registration form
        const name = get().playerName;
        saveAuthToStorage(token, userId, name);
        set({
          authToken: token,
          playerId: userId,
          isAuthenticated: true,
          isLoading: false
        });
        // Send authenticate message to create server session
        const { ws } = get();
        ws?.send({
          type: 'authenticate',
          playerId: userId,
          playerName: name,
          token
        });
      } else {
        set({
          error: message.error as string,
          isLoading: false
        });
      }
      break;

    case 'ping':
      // Server ping - respond with pong to keep connection alive
      console.log('[Store] Received ping from server, sending pong');
      get().ws?.send({ type: 'pong' });
      break;

    case 'pong':
      // Heartbeat response, no action needed
      break;

    case 'actionRequired':
      set({ pendingActionRequest: message.request as ActionRequest });
      break;

    case 'actionAcknowledged':
      // Clear pending request after server acknowledges response
      set({ pendingActionRequest: null });
      break;

    case 'actionTimeout':
      // Clear pending request on timeout
      set({ pendingActionRequest: null });
      break;

    default:
      console.log('Unhandled message type:', type, message);
  }
}
