/**
 * @fileoverview Server module exports.
 * @module server
 *
 * @summary Exports all server-side components for multiplayer.
 *
 * @description
 * This module provides the server infrastructure for multiplayer games:
 * - Room management (create, join, leave)
 * - Game session handling
 * - Connection management
 * - Reconnection support
 *
 * @example
 * ```typescript
 * import {
 *   Room,
 *   RoomManager,
 *   ReconnectionManager,
 *   GameServerFacade
 * } from './server';
 *
 * const roomManager = new RoomManager();
 * const server = new GameServerFacade(wsServer, roomManager);
 * ```
 */

// Room management
export {
  Room,
  RoomStatus,
  RoomPlayerInfo,
  RoomEventType,
  RoomEvent,
  RoomEventHandler,
  generateRoomCode
} from './Room';

export {
  RoomManager,
  RoomManagerConfig,
  DEFAULT_ROOM_MANAGER_CONFIG,
  RoomManagerEventHandler,
  RoomManagerEventType,
  RoomManagerEvent
} from './RoomManager';

// Reconnection manager
export {
  ReconnectionManager,
  ReconnectionConfig,
  DEFAULT_RECONNECTION_CONFIG,
  DisconnectionStatus,
  DisconnectedPlayerState,
  ReconnectionEventHandler,
  ReconnectionEventType,
  ReconnectionEvent
} from './ReconnectionManager';

// Timeout strategies
export {
  TimeoutStrategyType,
  TimeoutActionType,
  TimeoutStrategyConfig,
  ITimeoutStrategy,
  TimeoutStrategy,
  TimeoutStrategyFactory,
  GameTimeoutManager,
  CASUAL_STRATEGY,
  COMPETITIVE_STRATEGY,
  TOURNAMENT_STRATEGY,
  PREDEFINED_STRATEGIES
} from './TimeoutStrategies';

// Game server facade
export {
  GameServerFacade,
  GameServerConfig
} from './GameServerFacade';
