/**
 * @fileoverview Players module exports.
 * @module players
 *
 * @summary Exports all player-related types and classes.
 *
 * @description
 * This module provides the player abstraction layer:
 * - IPlayer interface for unified player handling
 * - AIPlayer adapter for AI agents
 * - RemoteHumanPlayer for network players
 * - PlayerView factory for information hiding
 *
 * @example
 * ```typescript
 * import {
 *   IPlayer,
 *   AIPlayer,
 *   RemoteHumanPlayer,
 *   PlayerViewFactory
 * } from './players';
 * ```
 */

// Player interface and base classes
export {
  PlayerType,
  PlayerStatus,
  PlayerActionResult,
  IPlayer,
  TimeoutError,
  AbstractPlayer
} from './IPlayer';

// Player view factory for information hiding
export {
  PlayerViewFactory,
  validatePlayerView
} from './PlayerView';

// Concrete player implementations
export { AIPlayer, AIPlayerFactory } from './AIPlayer';
export {
  RemoteHumanPlayer,
  TimeoutConfig,
  TimeoutConfigs
} from './RemoteHumanPlayer';
