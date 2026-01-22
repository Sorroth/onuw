/**
 * @fileoverview Win condition exports.
 * @module patterns/strategy/winConditions
 *
 * @summary Exports all win condition strategy implementations.
 *
 * @description
 * This module provides win condition implementations following the Strategy Pattern.
 * Each team's victory condition is encapsulated in its own class.
 *
 * Win conditions in ONUW:
 * - **Village**: At least one Werewolf dies
 * - **Werewolf**: No Werewolves die (Minion can die, blocked by Tanner death)
 * - **Tanner**: Tanner dies (independent win, blocks Werewolf)
 *
 * @pattern Strategy Pattern - Each team's win logic is a separate strategy
 *
 * @example
 * ```typescript
 * import {
 *   IWinCondition,
 *   VillageWinCondition,
 *   WerewolfWinCondition,
 *   TannerWinCondition
 * } from './patterns/strategy/winConditions';
 *
 * // Evaluate all win conditions
 * const conditions: IWinCondition[] = [
 *   new VillageWinCondition(),
 *   new WerewolfWinCondition(),
 *   new TannerWinCondition()
 * ];
 *
 * const winners = conditions
 *   .map(c => c.evaluate(context))
 *   .filter(r => r.won);
 * ```
 */

// Interface and base class
export {
  IWinCondition,
  AbstractWinCondition,
  WinConditionContext,
  WinConditionResult,
  PlayerWinInfo
} from './WinCondition';

// Concrete win condition strategies
export { VillageWinCondition } from './VillageWinCondition';
export { WerewolfWinCondition } from './WerewolfWinCondition';
export { TannerWinCondition } from './TannerWinCondition';
