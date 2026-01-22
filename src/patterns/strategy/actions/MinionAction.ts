/**
 * @fileoverview Minion night action implementation.
 * @module patterns/strategy/actions/MinionAction
 *
 * @summary Handles the Minion's night action - seeing who the Werewolves are.
 *
 * @description
 * The Minion wakes and sees the Werewolves (they stick out their thumbs).
 * Key asymmetry:
 * - Minion sees who the Werewolves are
 * - Werewolves do NOT see who the Minion is
 *
 * This allows the Minion to protect Werewolves without them knowing who
 * is helping them.
 *
 * @pattern Strategy Pattern - Concrete Strategy for Minion
 *
 * @remarks
 * Wake order: 3 (after Werewolves, before Masons)
 *
 * Strategic implications:
 * - Minion can throw suspicion away from Werewolves
 * - Minion might claim to be a Werewolf to take the kill
 * - If no Werewolves in game, Minion must get someone killed to win
 *
 * @example
 * ```typescript
 * const minionAction = new MinionAction();
 * const result = await minionAction.execute(context, agent, gameState);
 *
 * // result.info.werewolves = ['player-2', 'player-4']
 * // Minion now knows who to protect
 * ```
 */

import { RoleName } from '../../../enums';
import { NightActionResult, NightActionContext } from '../../../types';
import {
  AbstractNightAction,
  INightActionAgent,
  INightActionGameState
} from '../NightAction';

/**
 * @summary Minion night action - see who the Werewolves are.
 *
 * @description
 * The Minion:
 * 1. Wakes up after Werewolves
 * 2. Sees which players are Werewolves
 * 3. Werewolves do NOT learn the Minion's identity
 *
 * @pattern Strategy Pattern - Concrete Strategy
 *
 * @remarks
 * The Minion is on the Werewolf team but:
 * - Can die without causing Werewolves to lose
 * - Might claim Werewolf to draw fire
 * - If there are no Werewolves, Minion wins if ANY player dies
 *
 * @example
 * ```typescript
 * const minion = new MinionAction();
 * const result = await minion.execute(context, agent, gameState);
 * // result.info.werewolves lists the werewolf players
 * ```
 */
export class MinionAction extends AbstractNightAction {
  /**
   * @summary Creates a new MinionAction instance.
   */
  constructor() {
    super();
  }

  /**
   * @summary Returns the role name.
   *
   * @returns {RoleName} RoleName.MINION
   */
  getRoleName(): RoleName {
    return RoleName.MINION;
  }

  /**
   * @summary Returns the night wake order.
   *
   * @description
   * Minion wakes at order 3, after Werewolves (2) but before Masons (4).
   * Werewolves keep their thumbs out so Minion can see them.
   *
   * @returns {number} 3
   */
  getNightOrder(): number {
    return 3;
  }

  /**
   * @summary Returns a description of the action.
   *
   * @returns {string} Description of Minion night ability
   */
  getDescription(): string {
    return 'See who the Werewolves are (they don\'t see you)';
  }

  /**
   * @summary Returns 'VIEW' as the action type.
   *
   * @returns {'VIEW'} Always returns 'VIEW'
   *
   * @protected
   */
  protected getActionType(): 'VIEW' | 'SWAP' | 'NONE' {
    return 'VIEW';
  }

  /**
   * @summary Executes the Minion night action.
   *
   * @description
   * Finds all players with the Werewolf role and returns their IDs.
   * No agent decision needed - Minion simply observes.
   *
   * @param {NightActionContext} context - What the player knows
   * @param {INightActionAgent} _agent - Decision-maker (unused - no choice)
   * @param {INightActionGameState} gameState - Game state access
   *
   * @returns {Promise<NightActionResult>} Result containing werewolf IDs
   *
   * @remarks
   * If no Werewolves exist (all in center), the result will have an
   * empty werewolves array. This is important information for the Minion
   * because their win condition changes!
   *
   * @example
   * ```typescript
   * const result = await minionAction.doExecute(context, agent, gameState);
   * // result.info.werewolves = ['player-3'] or [] if none
   * ```
   */
  protected async doExecute(
    context: NightActionContext,
    _agent: INightActionAgent,
    gameState: INightActionGameState
  ): Promise<NightActionResult> {
    // Find all Werewolves
    const werewolves = gameState.getPlayersWithRole(RoleName.WEREWOLF);

    return this.createSuccessResult(context.myPlayerId, {
      werewolves
    });
  }
}
