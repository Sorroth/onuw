/**
 * @fileoverview Network protocol message type definitions.
 * @module network/protocol
 *
 * @summary Defines all client-server message types for multiplayer communication.
 *
 * @description
 * This module provides type-safe message definitions for the WebSocket protocol:
 * - Client → Server messages (commands, actions, lobby)
 * - Server → Client messages (state updates, events, requests)
 * - Shared types used by both directions
 *
 * All messages are JSON-serializable for network transmission.
 *
 * @example
 * ```typescript
 * import { ClientMessage, ServerMessage, isClientMessage } from './protocol';
 *
 * // Validate incoming message
 * if (isClientMessage(data)) {
 *   handleClientMessage(data);
 * }
 * ```
 */

import { GamePhase, RoleName, Team } from '../enums';
import { PlayerStatement, NightActionResult, GameResult } from '../types';

// ============================================================================
// SHARED TYPES
// ============================================================================

/**
 * @summary Unique identifier for tracking request-response pairs.
 */
export type RequestId = string;

/**
 * @summary Room code format (4 uppercase alphanumeric characters).
 */
export type RoomCode = string;

/**
 * @summary Player identifier.
 */
export type PlayerId = string;

/**
 * @summary Base timestamp for all messages.
 */
export interface TimestampedMessage {
  /** Unix timestamp in milliseconds */
  readonly timestamp: number;
}

// ============================================================================
// ROOM CONFIGURATION
// ============================================================================

/**
 * @summary Timeout strategy options for game pacing.
 */
export type TimeoutStrategyType = 'casual' | 'competitive' | 'tournament';

/**
 * @summary Configuration for creating a game room.
 *
 * @description
 * Defines the game parameters including player count, roles, and timing.
 */
export interface RoomConfig {
  /** Minimum number of players to start */
  readonly minPlayers: number;

  /** Maximum number of players (3-10) */
  readonly maxPlayers: number;

  /** Roles to use in the game (must be maxPlayers + 3) */
  readonly roles: readonly RoleName[];

  /** Timeout behavior for player actions */
  readonly timeoutStrategy: TimeoutStrategyType;

  /** Whether room requires invite code */
  readonly isPrivate: boolean;

  /** Allow non-players to watch */
  readonly allowSpectators: boolean;

  /** Room display name */
  readonly roomName?: string;
}

/**
 * @summary Player information within a room.
 */
export interface RoomPlayer {
  /** Unique player identifier */
  readonly id: PlayerId;

  /** Display name */
  readonly name: string;

  /** Ready to start game */
  readonly isReady: boolean;

  /** Is room creator */
  readonly isHost: boolean;

  /** Currently connected */
  readonly isConnected: boolean;

  /** Is AI-controlled */
  readonly isAI: boolean;
}

/**
 * @summary Current state of a game room.
 */
export interface RoomState {
  /** Unique room code for joining */
  readonly roomCode: RoomCode;

  /** Player who created the room */
  readonly hostId: PlayerId;

  /** Room configuration */
  readonly config: RoomConfig;

  /** Players in the room */
  readonly players: readonly RoomPlayer[];

  /** Current room status */
  readonly status: 'waiting' | 'starting' | 'inProgress' | 'playing' | 'ended';

  /** Game ID if game has started */
  readonly gameId?: string;

  /** When room was created */
  readonly createdAt: number;
}

/**
 * @summary Brief room info for listing.
 */
export interface RoomSummary {
  readonly roomCode: RoomCode;
  readonly roomName?: string;
  readonly hostName: string;
  readonly playerCount: number;
  readonly maxPlayers: number;
  readonly roles: readonly RoleName[];
  readonly status?: RoomState['status'];
}

// ============================================================================
// PLAYER VIEW (Information Hiding)
// ============================================================================

/**
 * @summary Public player info visible to all players.
 *
 * @description
 * Contains only non-sensitive information about other players.
 * Role information is intentionally excluded to prevent cheating.
 */
export interface PublicPlayerInfo {
  /** Player identifier */
  readonly id: PlayerId;

  /** Display name */
  readonly name: string;

  /** Currently connected to server */
  readonly isConnected: boolean;

  /** Is AI-controlled player */
  readonly isAI: boolean;

  /** Has made a statement this day phase */
  readonly hasSpoken: boolean;

  /** Has cast vote (not who they voted for) */
  readonly hasVoted: boolean;
}

/**
 * @summary Player's view of the game state (internal representation).
 *
 * @description
 * Contains only information the player is allowed to know.
 * This is the ONLY game state sent to clients - never raw Game state.
 *
 * @pattern Information Hiding - Prevents cheating by limiting visibility
 *
 * @example
 * ```typescript
 * // Server creates view for specific player
 * const view = PlayerView.forPlayer(game, playerId);
 * socket.send({ type: 'gameState', data: view });
 * ```
 */
export interface PlayerGameView {
  /** This player's ID */
  readonly myPlayerId: PlayerId;

  /** Game identifier */
  readonly gameId: string;

  /** Current game phase */
  readonly phase: GamePhase;

  /** My starting role (what I was dealt) */
  readonly myStartingRole: RoleName;

  /** Information learned during night phase */
  readonly myNightInfo: readonly NightActionResult[];

  /** All players (public info only) */
  readonly players: readonly PublicPlayerInfo[];

  /** All public statements made during day */
  readonly statements: readonly PlayerStatement[];

  /** Votes (only visible after voting ends) */
  readonly votes: ReadonlyMap<PlayerId, PlayerId> | null;

  /** Eliminated players (only after resolution) */
  readonly eliminatedPlayers: readonly PlayerId[] | null;

  /** Final roles (only after game ends) */
  readonly finalRoles: ReadonlyMap<PlayerId, RoleName> | null;

  /** Winning teams (only after game ends) */
  readonly winningTeams: readonly Team[] | null;

  /** Winning players (only after game ends) */
  readonly winningPlayers: readonly PlayerId[] | null;

  /** Current phase time remaining in ms */
  readonly timeRemaining: number | null;
}

/**
 * @summary JSON-serializable version of PlayerGameView.
 *
 * @description
 * Uses Records instead of Maps for JSON serialization over WebSocket.
 * This is what actually gets sent to clients.
 *
 * @pattern Adapter - Converts internal Map-based types to serializable Records
 */
export interface SerializablePlayerGameView {
  /** This player's ID */
  readonly myPlayerId: PlayerId;

  /** Game identifier */
  readonly gameId: string;

  /** Current game phase */
  readonly phase: GamePhase;

  /** My starting role (what I was dealt) */
  readonly myStartingRole: RoleName;

  /** Information learned during night phase */
  readonly myNightInfo: readonly NightActionResult[];

  /** All players (public info only) */
  readonly players: readonly PublicPlayerInfo[];

  /** All public statements made during day */
  readonly statements: readonly PlayerStatement[];

  /** Votes (only visible after voting ends) - Record for JSON */
  readonly votes: Record<PlayerId, PlayerId> | null;

  /** Eliminated players (only after resolution) */
  readonly eliminatedPlayers: readonly PlayerId[] | null;

  /** Final roles (only after game ends) - Record for JSON */
  readonly finalRoles: Record<PlayerId, RoleName> | null;

  /** Winning teams (only after game ends) */
  readonly winningTeams: readonly Team[] | null;

  /** Winning players (only after game ends) */
  readonly winningPlayers: readonly PlayerId[] | null;

  /** Current phase time remaining in ms */
  readonly timeRemaining: number | null;

  /** Whether this player was eliminated */
  readonly isEliminated?: boolean;
}

// ============================================================================
// ACTION REQUESTS (Server asking client to act)
// ============================================================================

/**
 * @summary Base interface for action requests.
 */
export interface ActionRequestBase {
  /** Unique request ID for response matching */
  readonly requestId: RequestId;

  /** Time limit in milliseconds */
  readonly timeoutMs: number;

  /** When request was sent */
  readonly timestamp: number;
}

/**
 * @summary Request to select a player target.
 */
export interface SelectPlayerRequest extends ActionRequestBase {
  readonly actionType: 'selectPlayer';

  /** Valid player IDs to choose from */
  readonly options: readonly PlayerId[];

  /** Why selection is needed */
  readonly reason: string;
}

/**
 * @summary Request to select center card(s).
 */
export interface SelectCenterRequest extends ActionRequestBase {
  readonly actionType: 'selectCenter';

  /** Number of cards to select (1 or 2) */
  readonly count: 1 | 2;

  /** Why selection is needed */
  readonly reason: string;
}

/**
 * @summary Request for Seer to choose viewing option.
 */
export interface SeerChoiceRequest extends ActionRequestBase {
  readonly actionType: 'seerChoice';

  /** Available options */
  readonly options: readonly ('player' | 'center')[];
}

/**
 * @summary Request to select two players (Troublemaker).
 */
export interface SelectTwoPlayersRequest extends ActionRequestBase {
  readonly actionType: 'selectTwoPlayers';

  /** Valid player IDs to choose from */
  readonly options: readonly PlayerId[];

  /** Why selection is needed */
  readonly reason: string;
}

/**
 * @summary Request to make a day phase statement.
 */
export interface StatementRequest extends ActionRequestBase {
  readonly actionType: 'statement';

  /** Previous statements for context */
  readonly previousStatements: readonly PlayerStatement[];
}

/**
 * @summary Request to cast a vote.
 */
export interface VoteRequest extends ActionRequestBase {
  readonly actionType: 'vote';

  /** Eligible vote targets */
  readonly eligibleTargets: readonly PlayerId[];

  /** All statements for context */
  readonly allStatements: readonly PlayerStatement[];
}

/**
 * @summary Union of all action request types.
 */
export type ActionRequest =
  | SelectPlayerRequest
  | SelectCenterRequest
  | SeerChoiceRequest
  | SelectTwoPlayersRequest
  | StatementRequest
  | VoteRequest;

// ============================================================================
// CLIENT → SERVER MESSAGES
// ============================================================================

/**
 * @summary Authentication request.
 */
export interface AuthenticateMessage extends TimestampedMessage {
  readonly type: 'authenticate';
  readonly playerId: PlayerId;
  readonly playerName: string;
  readonly token?: string;
  readonly clientVersion?: string;
}

/**
 * @summary Disconnect notification.
 */
export interface DisconnectMessage extends TimestampedMessage {
  readonly type: 'disconnect';
  readonly reason?: string;
}

/**
 * @summary Debug options for testing.
 */
export interface DebugOptions {
  /** Force a specific starting role for the host player */
  readonly forceRole?: RoleName;
}

/**
 * @summary Create a new game room.
 */
export interface CreateRoomMessage extends TimestampedMessage {
  readonly type: 'createRoom';
  readonly config: RoomConfig;
  /** Optional debug options for testing */
  readonly debug?: DebugOptions;
}

/**
 * @summary Join an existing room.
 */
export interface JoinRoomMessage extends TimestampedMessage {
  readonly type: 'joinRoom';
  readonly roomCode: RoomCode;
  readonly playerName: string;
}

/**
 * @summary Leave current room.
 */
export interface LeaveRoomMessage extends TimestampedMessage {
  readonly type: 'leaveRoom';
}

/**
 * @summary Set ready status.
 */
export interface SetReadyMessage extends TimestampedMessage {
  readonly type: 'setReady';
  readonly ready: boolean;
}

/**
 * @summary Add AI player to room (host only).
 */
export interface AddAIMessage extends TimestampedMessage {
  readonly type: 'addAI';
  readonly aiName?: string;
}

/**
 * @summary Remove player from room (host only).
 */
export interface RemovePlayerMessage extends TimestampedMessage {
  readonly type: 'removePlayer';
  readonly playerId: PlayerId;
}

/**
 * @summary Start the game (host only).
 */
export interface StartGameMessage extends TimestampedMessage {
  readonly type: 'startGame';
}

/**
 * @summary Response to an action request.
 */
export interface ActionResponseMessage extends TimestampedMessage {
  readonly type: 'actionResponse';
  readonly requestId: RequestId;
  readonly response: unknown;
}

/**
 * @summary Request current game state.
 */
export interface GetStateMessage extends TimestampedMessage {
  readonly type: 'getState';
}

/**
 * @summary Ping for connection keepalive.
 */
export interface PingMessage extends TimestampedMessage {
  readonly type: 'ping';
}

/**
 * @summary Submit a statement during day phase (real-time).
 *
 * @description
 * Players can submit statements at any time during the DAY phase.
 * Statements are broadcast to all players immediately.
 * Multiple statements from the same player are allowed.
 *
 * @pattern Observer - Statement is broadcast to all players
 */
export interface SubmitStatementMessage extends TimestampedMessage {
  readonly type: 'submitStatement';
  readonly statement: string;
}

/**
 * @summary Signal ready to move to voting phase.
 *
 * @description
 * During the DAY phase, players can signal they're ready to vote.
 * When all players are ready (or timeout occurs), the game moves to VOTING.
 */
export interface ReadyToVoteMessage extends TimestampedMessage {
  readonly type: 'readyToVote';
}

/**
 * @summary Union of all client message types.
 */
export type ClientMessage =
  | AuthenticateMessage
  | DisconnectMessage
  | CreateRoomMessage
  | JoinRoomMessage
  | LeaveRoomMessage
  | SetReadyMessage
  | AddAIMessage
  | RemovePlayerMessage
  | StartGameMessage
  | ActionResponseMessage
  | GetStateMessage
  | PingMessage
  | SubmitStatementMessage
  | ReadyToVoteMessage;

// ============================================================================
// SERVER → CLIENT MESSAGES
// ============================================================================

/**
 * @summary Authentication result.
 */
export interface AuthenticatedMessage extends TimestampedMessage {
  readonly type: 'authenticated';
  readonly playerId: PlayerId;
  readonly playerName: string;
  readonly serverVersion: string;
}

/**
 * @summary Error response.
 */
export interface ErrorMessage extends TimestampedMessage {
  readonly type: 'error';
  readonly code: string;
  readonly message: string;
  readonly details?: unknown;
}

/**
 * @summary Room created successfully.
 */
export interface RoomCreatedMessage extends TimestampedMessage {
  readonly type: 'roomCreated';
  readonly roomCode: RoomCode;
  readonly state: RoomState;
}

/**
 * @summary Successfully joined room.
 */
export interface RoomJoinedMessage extends TimestampedMessage {
  readonly type: 'roomJoined';
  readonly state: RoomState;
}

/**
 * @summary Room state update.
 */
export interface RoomUpdateMessage extends TimestampedMessage {
  readonly type: 'roomUpdate';
  readonly state: RoomState;
}

/**
 * @summary Room was closed.
 */
export interface RoomClosedMessage extends TimestampedMessage {
  readonly type: 'roomClosed';
  readonly reason: string;
}

/**
 * @summary Game has started.
 */
export interface GameStartedMessage extends TimestampedMessage {
  readonly type: 'gameStarted';
  readonly view: SerializablePlayerGameView;
  /** Maps game internal IDs (player-1) to room IDs (player-abc123) for client-side name resolution */
  readonly playerIdMapping?: Record<string, PlayerId>;
}

/**
 * @summary Game phase changed.
 */
export interface PhaseChangeMessage extends TimestampedMessage {
  readonly type: 'phaseChange';
  readonly phase: GamePhase;
  readonly timeRemaining: number | null;
}

/**
 * @summary Current game state.
 */
export interface GameStateMessage extends TimestampedMessage {
  readonly type: 'gameState';
  readonly view: SerializablePlayerGameView;
}

/**
 * @summary Server requesting player action.
 */
export interface ActionRequiredMessage extends TimestampedMessage {
  readonly type: 'actionRequired';
  readonly request: ActionRequest;
}

/**
 * @summary Action was received and acknowledged.
 */
export interface ActionAcknowledgedMessage extends TimestampedMessage {
  readonly type: 'actionAcknowledged';
  readonly requestId: RequestId;
}

/**
 * @summary Action timed out.
 */
export interface ActionTimeoutMessage extends TimestampedMessage {
  readonly type: 'actionTimeout';
  readonly requestId: RequestId;
  readonly defaultAction: string;
}

/**
 * @summary Night action result (private to player).
 */
export interface NightResultMessage extends TimestampedMessage {
  readonly type: 'nightResult';
  readonly result: NightActionResult;
}

/**
 * @summary Player made a statement.
 */
export interface StatementMadeMessage extends TimestampedMessage {
  readonly type: 'statementMade';
  readonly playerId: PlayerId;
  readonly playerName: string;
  readonly statement: string;
}

/**
 * @summary All votes revealed.
 */
export interface VotesRevealedMessage extends TimestampedMessage {
  readonly type: 'votesRevealed';
  readonly votes: Record<PlayerId, PlayerId>;
}

/**
 * @summary Players eliminated.
 */
export interface EliminationMessage extends TimestampedMessage {
  readonly type: 'elimination';
  readonly playerIds: readonly PlayerId[];
}

/**
 * @summary JSON-serializable version of GameResult.
 *
 * @description
 * The core GameResult uses Maps which cannot be serialized to JSON.
 * This interface uses Records for network transmission.
 *
 * @pattern Adapter - Converts internal Map-based types to serializable Records
 */
export interface SerializableGameResult {
  /** Teams that won the game */
  readonly winningTeams: readonly Team[];

  /** Player IDs who won */
  readonly winningPlayers: readonly PlayerId[];

  /** Player IDs who were eliminated */
  readonly eliminatedPlayers: readonly PlayerId[];

  /** Final role for each player (after swaps) */
  readonly finalRoles: Record<PlayerId, RoleName>;

  /** Vote cast by each player */
  readonly votes: Record<PlayerId, PlayerId>;
}

/**
 * @summary A single action taken during the night phase.
 *
 * @description
 * Records what a player did during their night action turn.
 * Used in the post-game summary to show the full night phase history.
 */
export interface NightActionSummary {
  /** Player who performed the action */
  readonly playerId: PlayerId;

  /** Player's name for display */
  readonly playerName: string;

  /** The role that performed the action */
  readonly roleName: RoleName;

  /** Human-readable description of what happened */
  readonly description: string;
}

/**
 * @summary A statement with player name for the game summary.
 *
 * @description
 * Extended version of PlayerStatement that includes the player's
 * display name for the post-game summary.
 */
export interface SummaryStatement {
  /** Player's room ID */
  readonly playerId: PlayerId;

  /** Player's display name */
  readonly playerName: string;

  /** The content of the statement */
  readonly statement: string;

  /** When the statement was made */
  readonly timestamp: number;
}

/**
 * @summary Complete game summary for post-game review.
 *
 * @description
 * Contains all significant events from the game:
 * - Night actions (what each role did)
 * - Day statements (what players claimed)
 * - Final votes (who voted for whom)
 */
export interface GameSummary {
  /** All night actions in wake order */
  readonly nightActions: readonly NightActionSummary[];

  /** All statements made during day phase (with player names) */
  readonly statements: readonly SummaryStatement[];

  /** Vote summary: voter name -> target name */
  readonly votes: Record<string, string>;

  /** Starting roles (before swaps) */
  readonly startingRoles: Record<PlayerId, RoleName>;
}

/**
 * @summary Game has ended.
 */
export interface GameEndMessage extends TimestampedMessage {
  readonly type: 'gameEnd';
  readonly result: SerializableGameResult;
  readonly finalRoles: Record<PlayerId, RoleName>;
  readonly centerCards: readonly RoleName[];
  readonly summary: GameSummary;
}

/**
 * @summary Player disconnected.
 */
export interface PlayerDisconnectedMessage extends TimestampedMessage {
  readonly type: 'playerDisconnected';
  readonly playerId: PlayerId;
  readonly playerName: string;
  readonly aiTakeover: boolean;
}

/**
 * @summary Player reconnected.
 */
export interface PlayerReconnectedMessage extends TimestampedMessage {
  readonly type: 'playerReconnected';
  readonly playerId: PlayerId;
  readonly playerName: string;
}

/**
 * @summary Pong response to ping.
 */
export interface PongMessage extends TimestampedMessage {
  readonly type: 'pong';
}

/**
 * @summary Player marked ready to vote during day phase.
 *
 * @description
 * Broadcast when a player signals they're ready to move to voting.
 * Includes count of ready players so clients can show progress.
 */
export interface PlayerReadyToVoteMessage extends TimestampedMessage {
  readonly type: 'playerReadyToVote';
  readonly playerId: PlayerId;
  readonly playerName: string;
  readonly readyCount: number;
  readonly totalPlayers: number;
}

/**
 * @summary Union of all server message types.
 */
export type ServerMessage =
  | AuthenticatedMessage
  | ErrorMessage
  | RoomCreatedMessage
  | RoomJoinedMessage
  | RoomUpdateMessage
  | RoomClosedMessage
  | GameStartedMessage
  | PhaseChangeMessage
  | GameStateMessage
  | ActionRequiredMessage
  | ActionAcknowledgedMessage
  | ActionTimeoutMessage
  | NightResultMessage
  | StatementMadeMessage
  | VotesRevealedMessage
  | EliminationMessage
  | GameEndMessage
  | PlayerDisconnectedMessage
  | PlayerReconnectedMessage
  | PongMessage
  | PlayerReadyToVoteMessage;

// ============================================================================
// TYPE GUARDS
// ============================================================================

/**
 * @summary Checks if a message is a valid ClientMessage.
 */
export function isClientMessage(data: unknown): data is ClientMessage {
  if (typeof data !== 'object' || data === null) {
    return false;
  }

  const msg = data as Record<string, unknown>;
  const validTypes: ClientMessage['type'][] = [
    'authenticate', 'disconnect', 'createRoom', 'joinRoom', 'leaveRoom',
    'setReady', 'addAI', 'removePlayer', 'startGame', 'actionResponse',
    'getState', 'ping', 'submitStatement', 'readyToVote'
  ];

  return typeof msg.type === 'string' && validTypes.includes(msg.type as ClientMessage['type']);
}

/**
 * @summary Checks if a message is a valid ServerMessage.
 */
export function isServerMessage(data: unknown): data is ServerMessage {
  if (typeof data !== 'object' || data === null) {
    return false;
  }

  const msg = data as Record<string, unknown>;
  const validTypes: ServerMessage['type'][] = [
    'authenticated', 'error', 'roomCreated', 'roomJoined', 'roomUpdate',
    'roomClosed', 'gameStarted', 'phaseChange', 'gameState', 'actionRequired',
    'actionAcknowledged', 'actionTimeout', 'nightResult', 'statementMade',
    'votesRevealed', 'elimination', 'gameEnd', 'playerDisconnected',
    'playerReconnected', 'pong', 'playerReadyToVote'
  ];

  return typeof msg.type === 'string' && validTypes.includes(msg.type as ServerMessage['type']);
}

// ============================================================================
// MESSAGE FACTORIES
// ============================================================================

/**
 * @summary Creates a timestamped message.
 */
export function createMessage<T extends TimestampedMessage>(
  partial: Omit<T, 'timestamp'>
): T {
  return {
    ...partial,
    timestamp: Date.now()
  } as T;
}

/**
 * @summary Creates an error message.
 */
export function createErrorMessage(code: string, message: string, details?: unknown): ErrorMessage {
  return createMessage<ErrorMessage>({
    type: 'error',
    code,
    message,
    details
  });
}

// ============================================================================
// ERROR CODES
// ============================================================================

/**
 * @summary Standard error codes for error messages.
 */
export const ErrorCodes = {
  // Authentication
  AUTH_REQUIRED: 'AUTH_REQUIRED',
  AUTH_INVALID: 'AUTH_INVALID',
  AUTH_EXPIRED: 'AUTH_EXPIRED',
  NOT_AUTHENTICATED: 'NOT_AUTHENTICATED',

  // Room errors
  ROOM_NOT_FOUND: 'ROOM_NOT_FOUND',
  ROOM_FULL: 'ROOM_FULL',
  ROOM_STARTED: 'ROOM_STARTED',
  ROOM_CLOSED: 'ROOM_CLOSED',
  ALREADY_IN_ROOM: 'ALREADY_IN_ROOM',

  // Permission errors
  NOT_HOST: 'NOT_HOST',
  NOT_IN_ROOM: 'NOT_IN_ROOM',
  NOT_IN_GAME: 'NOT_IN_GAME',

  // Game errors
  INVALID_ACTION: 'INVALID_ACTION',
  INVALID_PHASE: 'INVALID_PHASE',
  INVALID_TARGET: 'INVALID_TARGET',
  INVALID_STATE: 'INVALID_STATE',
  NOT_YOUR_TURN: 'NOT_YOUR_TURN',
  ACTION_TIMEOUT: 'ACTION_TIMEOUT',

  // Special
  AI_TAKEOVER: 'AI_TAKEOVER',

  // General
  INVALID_MESSAGE: 'INVALID_MESSAGE',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  RATE_LIMITED: 'RATE_LIMITED'
} as const;

export type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes];
