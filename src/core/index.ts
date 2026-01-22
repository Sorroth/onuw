/**
 * @fileoverview Core module exports.
 * @module core
 *
 * @summary Exports core game classes.
 *
 * @description
 * This module provides the main game components:
 * - Role: Represents a role card
 * - Player: Represents a game participant
 * - Game: Main game engine
 *
 * @example
 * ```typescript
 * import { Game, Player, Role, IGameAgent } from './core';
 *
 * const game = new Game(config);
 * game.registerAgents(agents);
 * const result = await game.run();
 * ```
 */

export { Role, ROLE_TEAMS, NIGHT_ORDERS, ROLE_DESCRIPTIONS } from './Role';
export { Player } from './Player';
export { Game, IGameAgent } from './Game';
