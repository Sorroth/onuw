/**
 * @fileoverview Tanner win condition implementation.
 * @module patterns/strategy/winConditions/TannerWinCondition
 *
 * @summary Handles the Tanner's victory condition.
 *
 * @description
 * The Tanner is an independent role with a unique win condition:
 * - Tanner wins if and only if the Tanner is killed by vote
 *
 * Important interactions:
 * - If Tanner dies, Werewolves CANNOT win
 * - Tanner can win alongside Village (if Tanner AND Werewolf both die)
 * - Tanner wins alone if only Tanner dies
 *
 * @pattern Strategy Pattern - Concrete Strategy for Tanner win condition
 *
 * @remarks
 * The Tanner is the ultimate wildcard:
 * - Wants to appear suspicious (but not TOO suspicious)
 * - May claim to be Werewolf
 * - May make weak defenses
 * - Successful Tanners walk a fine line
 *
 * @example
 * ```typescript
 * const condition = new TannerWinCondition();
 * const result = condition.evaluate(context);
 *
 * // Tanner died:
 * // result.won = true, result.reason = "Tanner was eliminated"
 *
 * // Tanner survived:
 * // result.won = false, result.reason = "Tanner was not eliminated"
 * ```
 */

import { Team, RoleName } from '../../../enums';
import {
  AbstractWinCondition,
  WinConditionContext,
  WinConditionResult
} from './WinCondition';

/**
 * @summary Tanner win condition strategy.
 *
 * @description
 * Evaluates whether the Tanner won based on:
 * - Tanner was killed by vote
 *
 * This is a binary condition - either Tanner died or didn't.
 *
 * @pattern Strategy Pattern - Concrete Strategy
 *
 * @remarks
 * The Tanner's win is independent of other teams:
 * - If Tanner dies alone: Only Tanner wins
 * - If Tanner + Werewolf die: Tanner wins AND Village wins
 * - Tanner death ALWAYS blocks Werewolf win
 *
 * Strategy tips for Tanner:
 * - Act slightly suspicious
 * - Make claims that are plausible but have holes
 * - Don't be so obvious that players avoid voting for you
 * - Claim a role that someone else will likely also claim
 *
 * @example
 * ```typescript
 * const tannerCondition = new TannerWinCondition();
 *
 * // Check tanner victory
 * const result = tannerCondition.evaluate({
 *   eliminatedPlayers: [{ currentRole: RoleName.TANNER, ... }],
 *   tannerWasEliminated: true,
 *   ...
 * });
 *
 * // result.won = true
 * ```
 */
export class TannerWinCondition extends AbstractWinCondition {
  /**
   * @summary Creates a new TannerWinCondition instance.
   */
  constructor() {
    super();
  }

  /**
   * @summary Returns the team this condition is for.
   *
   * @returns {Team} Team.TANNER
   */
  getTeam(): Team {
    return Team.TANNER;
  }

  /**
   * @summary Returns a description of the win condition.
   *
   * @returns {string} Description of Tanner win condition
   */
  getDescription(): string {
    return 'Tanner must be eliminated to win. Tanner death blocks Werewolf victory.';
  }

  /**
   * @summary Evaluates whether the Tanner won.
   *
   * @description
   * Simple logic:
   * - If Tanner was killed, Tanner wins
   * - If Tanner wasn't killed, Tanner loses
   *
   * @param {WinConditionContext} context - Game end state
   *
   * @returns {WinConditionResult} Whether Tanner won
   *
   * @example
   * ```typescript
   * const result = condition.evaluate(context);
   * if (result.won) {
   *   console.log('Tanner wins!');
   * }
   * ```
   */
  evaluate(context: WinConditionContext): WinConditionResult {
    // Helper to check if player is effectively a Tanner (actual or Doppelganger-Tanner)
    // Doppelganger only counts if they still have their Doppelganger card (wasn't swapped)
    const isTanner = (p: { currentRole: RoleName; copiedRole?: RoleName }) =>
      p.currentRole === RoleName.TANNER ||
      (p.currentRole === RoleName.DOPPELGANGER && p.copiedRole === RoleName.TANNER);

    // Find the Tanner player(s) - includes Doppelganger who copied Tanner
    const tannerPlayers = context.allPlayers.filter(isTanner);

    // If no Tanner in the game, this condition doesn't apply
    if (tannerPlayers.length === 0) {
      return this.createLossResult(
        'No Tanner exists in the game'
      );
    }

    // Check if Tanner was eliminated
    if (context.tannerWasEliminated) {
      const tannerIds = tannerPlayers
        .filter(p => p.isEliminated)
        .map(p => p.playerId);

      return this.createWinResult(
        tannerIds,
        'Tanner was eliminated - Tanner wins!'
      );
    }

    return this.createLossResult(
      'Tanner was not eliminated'
    );
  }
}
