/**
 * @fileoverview Network module exports.
 * @module network
 *
 * @summary Exports all network-related types and classes.
 *
 * @description
 * This module provides the network layer for multiplayer functionality:
 * - Protocol definitions (message types)
 * - Connection interfaces and implementations
 * - WebSocket server (when implemented)
 *
 * @example
 * ```typescript
 * import {
 *   ClientMessage,
 *   ServerMessage,
 *   IClientConnection,
 *   WebSocketConnection
 * } from './network';
 * ```
 */

// Protocol definitions
export {
  // Types
  RequestId,
  RoomCode,
  PlayerId,
  TimestampedMessage,
  TimeoutStrategyType,
  RoomConfig,
  RoomPlayer,
  RoomState,
  RoomSummary,
  PublicPlayerInfo,
  PlayerGameView,

  // Action requests
  ActionRequestBase,
  SelectPlayerRequest,
  SelectCenterRequest,
  SeerChoiceRequest,
  SelectTwoPlayersRequest,
  StatementRequest,
  VoteRequest,
  ActionRequest,

  // Client messages
  AuthenticateMessage,
  DisconnectMessage,
  CreateRoomMessage,
  JoinRoomMessage,
  LeaveRoomMessage,
  SetReadyMessage,
  AddAIMessage,
  RemovePlayerMessage,
  StartGameMessage,
  ActionResponseMessage,
  GetStateMessage,
  PingMessage,
  ClientMessage,

  // Server messages
  AuthenticatedMessage,
  ErrorMessage,
  RoomCreatedMessage,
  RoomJoinedMessage,
  RoomUpdateMessage,
  RoomClosedMessage,
  GameStartedMessage,
  PhaseChangeMessage,
  GameStateMessage,
  ActionRequiredMessage,
  ActionAcknowledgedMessage,
  ActionTimeoutMessage,
  NightResultMessage,
  StatementMadeMessage,
  VotesRevealedMessage,
  EliminationMessage,
  GameEndMessage,
  PlayerDisconnectedMessage,
  PlayerReconnectedMessage,
  PongMessage,
  ServerMessage,

  // Type guards and factories
  isClientMessage,
  isServerMessage,
  createMessage,
  createErrorMessage,

  // Error codes
  ErrorCodes,
  ErrorCode
} from './protocol';

// Connection interface
export {
  ConnectionType,
  ConnectionState,
  MessageHandler,
  DisconnectHandler,
  ErrorHandler,
  IClientConnection,
  AbstractClientConnection
} from './IClientConnection';

// WebSocket implementation
export {
  WebSocketConnection,
  WebSocketConnectionFactory,
  WebSocketConfig,
  DEFAULT_WEBSOCKET_CONFIG,
  IWebSocket
} from './WebSocketConnection';

// WebSocket server
export {
  WebSocketServer,
  WebSocketServerConfig,
  ConnectionHandler,
  ServerErrorHandler,
  ServerLifecycleHandler,
  IWebSocketServerBackend
} from './WebSocketServer';
