/**
 * @fileoverview Night action exports.
 * @module patterns/strategy/actions
 *
 * @summary Exports all night action strategy implementations.
 *
 * @description
 * This module provides all concrete night action implementations
 * following the Strategy Pattern. Each role's night action is
 * encapsulated in its own class.
 *
 * @pattern Strategy Pattern - Concrete strategies for night actions
 * @pattern Null Object Pattern - NoAction for roles without night abilities
 *
 * @example
 * ```typescript
 * import {
 *   WerewolfAction,
 *   SeerAction,
 *   RobberAction,
 *   NoAction
 * } from './patterns/strategy/actions';
 *
 * // Create action for a role
 * const seerAction = new SeerAction();
 * const result = await seerAction.execute(context, agent, gameState);
 * ```
 */

// Roles with night actions
export { DoppelgangerAction } from './DoppelgangerAction';
export { WerewolfAction } from './WerewolfAction';
export { MinionAction } from './MinionAction';
export { MasonAction } from './MasonAction';
export { SeerAction } from './SeerAction';
export { RobberAction } from './RobberAction';
export { TroublemakerAction } from './TroublemakerAction';
export { DrunkAction } from './DrunkAction';
export { InsomniacAction } from './InsomniacAction';

// Null Object Pattern for roles without night actions
export { NoAction } from './NoAction';
