/**
 * @fileoverview Werewolf team win condition implementation.
 * @module patterns/strategy/winConditions/WerewolfWinCondition
 *
 * @summary Handles the Werewolf team's victory condition.
 *
 * @description
 * The Werewolf team wins if NO Werewolves are killed.
 *
 * Important rules:
 * - Minion is on Werewolf team but CAN die without losing
 * - If Tanner dies, Werewolves CANNOT win (even if no Werewolves died)
 * - If no Werewolves exist among players, special rules apply
 *
 * @pattern Strategy Pattern - Concrete Strategy for Werewolf win condition
 *
 * @remarks
 * Werewolf team members:
 * - Werewolf
 * - Minion
 *
 * The Minion has a unique position:
 * - They're on Werewolf team
 * - They CAN die and Werewolves still win
 * - They know who Werewolves are
 * - Werewolves don't know who Minion is
 *
 * @example
 * ```typescript
 * const condition = new WerewolfWinCondition();
 * const result = condition.evaluate(context);
 *
 * // Werewolves survive:
 * // result.won = true, result.reason = "No Werewolves were eliminated"
 *
 * // Tanner died:
 * // result.won = false, result.reason = "Tanner was eliminated, blocking Werewolf win"
 * ```
 */

import { Team, RoleName } from '../../../enums';
import {
  AbstractWinCondition,
  WinConditionContext,
  WinConditionResult
} from './WinCondition';

/**
 * @summary Werewolf team win condition strategy.
 *
 * @description
 * Evaluates whether the Werewolf team won based on:
 * 1. No Werewolves were killed
 * 2. Tanner was NOT killed (Tanner death blocks Werewolf win)
 *
 * @pattern Strategy Pattern - Concrete Strategy
 *
 * @remarks
 * Special case: If no Werewolves exist among players and Minion exists:
 * - Minion wins if SOMEONE (other than Minion) is killed
 * - This is handled by the Minion still being on Werewolf team
 *
 * @example
 * ```typescript
 * const werewolfCondition = new WerewolfWinCondition();
 *
 * // Check werewolf victory
 * const result = werewolfCondition.evaluate({
 *   eliminatedPlayers: [{ currentRole: RoleName.VILLAGER, ... }],
 *   werewolvesExistAmongPlayers: true,
 *   tannerWasEliminated: false,
 *   ...
 * });
 *
 * // result.won = true (only a villager died)
 * ```
 */
export class WerewolfWinCondition extends AbstractWinCondition {
  /**
   * @summary Creates a new WerewolfWinCondition instance.
   */
  constructor() {
    super();
  }

  /**
   * @summary Returns the team this condition is for.
   *
   * @returns {Team} Team.WEREWOLF
   */
  getTeam(): Team {
    return Team.WEREWOLF;
  }

  /**
   * @summary Returns a description of the win condition.
   *
   * @returns {string} Description of Werewolf win condition
   */
  getDescription(): string {
    return 'No Werewolves die. Minion can die. Tanner death blocks this win.';
  }

  /**
   * @summary Evaluates whether the Werewolf team won.
   *
   * @description
   * Logic:
   * 1. If Tanner was killed, Werewolves CANNOT win
   * 2. If any Werewolf was killed, Werewolves lose
   * 3. Otherwise, Werewolves win
   *
   * Note: Minion dying does NOT affect Werewolf win condition
   *
   * Special case - no Werewolves among players:
   * - If Minion exists and someone dies, Werewolf team (Minion) wins
   * - If Minion exists and no one dies, Werewolf team loses
   *
   * @param {WinConditionContext} context - Game end state
   *
   * @returns {WinConditionResult} Whether Werewolf team won
   *
   * @example
   * ```typescript
   * const result = condition.evaluate(context);
   * if (result.won) {
   *   console.log('Werewolf team wins:', result.winners);
   * }
   * ```
   */
  evaluate(context: WinConditionContext): WinConditionResult {
    // Get all Werewolf team members (Werewolves AND Minion)
    const werewolfTeamMembers = this.getTeamMembers(context);

    // BLOCKING CONDITION: Tanner death blocks Werewolf win
    if (context.tannerWasEliminated) {
      return this.createLossResult(
        'Tanner was eliminated - Tanner wins instead, blocking Werewolf victory'
      );
    }

    // Check if any Werewolves were killed
    const werewolfKilled = context.eliminatedPlayers.some(
      p => p.currentRole === RoleName.WEREWOLF
    );

    // CASE 1: Werewolves exist among players
    if (context.werewolvesExistAmongPlayers) {
      if (werewolfKilled) {
        return this.createLossResult(
          'At least one Werewolf was eliminated'
        );
      } else {
        return this.createWinResult(
          werewolfTeamMembers,
          'No Werewolves were eliminated'
        );
      }
    }

    // CASE 2: No Werewolves exist among players
    // Only Minion can be on Werewolf team

    if (context.minionExistsAmongPlayers) {
      // If no one dies, Minion loses (Village wins)
      if (context.eliminatedPlayers.length === 0) {
        return this.createLossResult(
          'No Werewolves exist; no one was eliminated'
        );
      }

      // Check if Minion was the only one killed
      const minionKilled = context.eliminatedPlayers.some(
        p => p.currentRole === RoleName.MINION
      );

      if (minionKilled && context.eliminatedPlayers.length === 1) {
        // Only Minion died - Village wins
        return this.createLossResult(
          'No Werewolves exist; only Minion was eliminated'
        );
      }

      // Someone other than (or in addition to) Minion died
      // Werewolf team (Minion) wins!
      return this.createWinResult(
        werewolfTeamMembers,
        'No Werewolves exist among players; someone was eliminated'
      );
    }

    // CASE 3: No Werewolves AND no Minion among players
    // Check if someone was killed - if so, Werewolves win (strict ONUW rules)
    // Village failed by killing an innocent when there was no threat
    if (context.eliminatedPlayers.length > 0) {
      // Werewolf cards in center "win" - but no players to receive the victory
      // Return empty winners array but still mark as won
      return {
        team: this.getTeam(),
        won: true,
        winners: [], // No werewolf players to claim victory
        reason: 'No Werewolves exist among players, but Village killed an innocent'
      };
    }

    // No one was killed - Village wins, Werewolves lose
    return this.createLossResult(
      'No Werewolf team members exist among players'
    );
  }
}
