/**
 * @fileoverview Strategy Pattern exports for night actions and win conditions.
 * @module patterns/strategy
 *
 * @summary Exports all strategy pattern implementations.
 *
 * @description
 * This module provides the Strategy Pattern implementations for:
 * - Night actions: Each role's night ability as a separate strategy
 * - Win conditions: Team-specific victory evaluation
 *
 * @pattern Strategy Pattern
 * - Encapsulates algorithms (night actions, win checks) in separate classes
 * - Allows runtime selection of behavior
 * - Makes adding new roles/conditions easy
 *
 * @example
 * ```typescript
 * import {
 *   INightAction,
 *   SeerAction,
 *   IWinCondition,
 *   VillageWinCondition
 * } from './patterns/strategy';
 *
 * // Use night action
 * const action: INightAction = new SeerAction();
 * await action.execute(context, agent, gameState);
 *
 * // Check win condition
 * const condition: IWinCondition = new VillageWinCondition();
 * const won = condition.checkWin(gameResult);
 * ```
 */

// Night action interface and base
export {
  INightAction,
  INightActionAgent,
  INightActionGameState,
  AbstractNightAction,
  CardPosition
} from './NightAction';

// All night action implementations
export {
  DoppelgangerAction,
  WerewolfAction,
  MinionAction,
  MasonAction,
  SeerAction,
  RobberAction,
  TroublemakerAction,
  DrunkAction,
  InsomniacAction,
  NoAction
} from './actions';

// Win conditions (to be implemented)
export * from './winConditions';
