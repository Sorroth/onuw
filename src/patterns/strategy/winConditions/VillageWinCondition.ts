/**
 * @fileoverview Village team win condition implementation.
 * @module patterns/strategy/winConditions/VillageWinCondition
 *
 * @summary Handles the Village team's victory condition.
 *
 * @description
 * The Village team wins if at least one Werewolf is killed.
 *
 * Special cases:
 * - If NO Werewolves exist among players (all in center):
 *   - Village wins if Minion is killed, OR
 *   - Village wins if no one dies
 * - If NO Werewolves AND NO Minion exist:
 *   - Village wins if no one dies
 *
 * @pattern Strategy Pattern - Concrete Strategy for Village win condition
 *
 * @remarks
 * Village team members include:
 * - Villager
 * - Seer
 * - Robber
 * - Troublemaker
 * - Drunk
 * - Insomniac
 * - Mason
 * - Hunter
 *
 * Note: A player's team is determined by their CURRENT card, not starting card.
 * If a Villager was given a Werewolf card by Troublemaker, they're now Werewolf team!
 *
 * @example
 * ```typescript
 * const condition = new VillageWinCondition();
 * const result = condition.evaluate(context);
 *
 * // Normal case - Werewolf killed:
 * // result.won = true, result.reason = "At least one Werewolf was eliminated"
 *
 * // No werewolves, Minion killed:
 * // result.won = true, result.reason = "No Werewolves exist; Minion was eliminated"
 * ```
 */

import { Team, RoleName } from '../../../enums';
import {
  AbstractWinCondition,
  WinConditionContext,
  WinConditionResult
} from './WinCondition';

/**
 * @summary Village team win condition strategy.
 *
 * @description
 * Evaluates whether the Village team won based on:
 * 1. Normal case: At least one Werewolf was killed
 * 2. No werewolves: Minion was killed OR no one died
 *
 * @pattern Strategy Pattern - Concrete Strategy
 *
 * @example
 * ```typescript
 * const villageCondition = new VillageWinCondition();
 *
 * // Check village victory
 * const result = villageCondition.evaluate({
 *   allPlayers: [...],
 *   eliminatedPlayers: [{ currentRole: RoleName.WEREWOLF, ... }],
 *   werewolvesExistAmongPlayers: true,
 *   ...
 * });
 *
 * // result.won = true (werewolf was killed)
 * ```
 */
export class VillageWinCondition extends AbstractWinCondition {
  /**
   * @summary Creates a new VillageWinCondition instance.
   */
  constructor() {
    super();
  }

  /**
   * @summary Returns the team this condition is for.
   *
   * @returns {Team} Team.VILLAGE
   */
  getTeam(): Team {
    return Team.VILLAGE;
  }

  /**
   * @summary Returns a description of the win condition.
   *
   * @returns {string} Description of Village win condition
   */
  getDescription(): string {
    return 'At least one Werewolf must die. If no Werewolves exist, Minion must die OR no one dies.';
  }

  /**
   * @summary Evaluates whether the Village team won.
   *
   * @description
   * Logic:
   * 1. If Tanner was killed, Village does NOT win (Tanner wins instead)
   *    unless a Werewolf was ALSO killed
   * 2. If Werewolves exist among players:
   *    - Village wins if at least one Werewolf was killed
   * 3. If NO Werewolves exist among players:
   *    - Village wins if Minion was killed, OR
   *    - Village wins if no one was killed
   *
   * @param {WinConditionContext} context - Game end state
   *
   * @returns {WinConditionResult} Whether Village won
   *
   * @example
   * ```typescript
   * const result = condition.evaluate(context);
   * if (result.won) {
   *   console.log('Village wins:', result.winners);
   * }
   * ```
   */
  evaluate(context: WinConditionContext): WinConditionResult {
    const villageMembers = this.getTeamMembers(context);

    // Check if any werewolves were killed
    const werewolfKilled = context.eliminatedPlayers.some(
      p => p.currentRole === RoleName.WEREWOLF
    );

    // Check if Minion was killed
    const minionKilled = context.eliminatedPlayers.some(
      p => p.currentRole === RoleName.MINION
    );

    // No one was killed
    const noOneKilled = context.eliminatedPlayers.length === 0;

    // CASE 1: Werewolves exist among players
    if (context.werewolvesExistAmongPlayers) {
      if (werewolfKilled) {
        return this.createWinResult(
          villageMembers,
          'At least one Werewolf was eliminated'
        );
      } else {
        return this.createLossResult(
          'No Werewolves were eliminated'
        );
      }
    }

    // CASE 2: No Werewolves exist among players
    // (All Werewolf cards are in the center)

    // Check if Minion exists among players
    if (context.minionExistsAmongPlayers) {
      // Village wins if Minion is killed
      if (minionKilled) {
        return this.createWinResult(
          villageMembers,
          'No Werewolves exist among players; Minion was eliminated'
        );
      }
      // Village also wins if no one dies
      if (noOneKilled) {
        return this.createWinResult(
          villageMembers,
          'No Werewolves exist among players; no one was eliminated'
        );
      }
      // Village loses if someone other than Minion dies
      return this.createLossResult(
        'No Werewolves exist, but Minion survived and someone else died'
      );
    }

    // CASE 3: No Werewolves AND no Minion among players
    // Village wins if no one dies
    if (noOneKilled) {
      return this.createWinResult(
        villageMembers,
        'No Werewolves or Minion exist among players; no one was eliminated'
      );
    }

    // Someone was killed but there were no valid evil targets
    // This is technically a Village loss (they killed an innocent)
    return this.createLossResult(
      'No Werewolves or Minion exist, but an innocent was eliminated'
    );
  }
}
