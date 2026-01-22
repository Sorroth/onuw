/**
 * @fileoverview Insomniac night action implementation.
 * @module patterns/strategy/actions/InsomniacAction
 *
 * @summary Handles the Insomniac's night action - viewing own card at end of night.
 *
 * @description
 * The Insomniac wakes LAST and looks at their OWN card. This reveals
 * whether any swaps affected them during the night:
 * - If they see Insomniac, they weren't swapped
 * - If they see something else, they were swapped (by Robber or Troublemaker)
 *
 * @pattern Strategy Pattern - Concrete Strategy for Insomniac
 *
 * @remarks
 * Wake order: 9 (LAST, after all swaps have occurred)
 *
 * Strategic implications:
 * - Insomniac knows their final role with certainty
 * - If swapped to Werewolf, Insomniac knows they're now evil
 * - This information is very valuable for the Village
 *
 * @example
 * ```typescript
 * const insomniacAction = new InsomniacAction();
 * const result = await insomniacAction.execute(context, agent, gameState);
 *
 * // If not swapped:
 * // result.info.viewed = [{ playerId: 'player-1', role: RoleName.INSOMNIAC }]
 *
 * // If swapped:
 * // result.info.viewed = [{ playerId: 'player-1', role: RoleName.WEREWOLF }]
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
 * @summary Insomniac night action - view own card at end of night.
 *
 * @description
 * The Insomniac:
 * 1. Wakes up last (after all other night actions)
 * 2. Looks at their own card
 * 3. Knows with certainty what role they will win/lose with
 *
 * @pattern Strategy Pattern - Concrete Strategy
 *
 * @remarks
 * The Insomniac is a powerful village role because:
 * - They have perfect information about their final role
 * - They can confirm or deny claims about swaps
 * - If swapped, they know who they should support
 *
 * @example
 * ```typescript
 * const insomniac = new InsomniacAction();
 * const result = await insomniac.execute(context, agent, gameState);
 * // result tells Insomniac their final role
 * ```
 */
export class InsomniacAction extends AbstractNightAction {
  /**
   * @summary Creates a new InsomniacAction instance.
   */
  constructor() {
    super();
  }

  /**
   * @summary Returns the role name.
   *
   * @returns {RoleName} RoleName.INSOMNIAC
   */
  getRoleName(): RoleName {
    return RoleName.INSOMNIAC;
  }

  /**
   * @summary Returns the night wake order.
   *
   * @description
   * Insomniac wakes LAST at order 9. This is crucial because
   * all swaps (Robber, Troublemaker, Drunk) happen before this,
   * so the Insomniac sees their FINAL card.
   *
   * @returns {number} 9
   */
  getNightOrder(): number {
    return 9;
  }

  /**
   * @summary Returns a description of the action.
   *
   * @returns {string} Description of Insomniac night ability
   */
  getDescription(): string {
    return 'Look at your own card at the end of the night';
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
   * @summary Executes the Insomniac night action.
   *
   * @description
   * Simply looks at the card in the Insomniac's position.
   * No agent decision needed - always views own card.
   *
   * @param {NightActionContext} context - What the player knows
   * @param {INightActionAgent} _agent - Decision-maker (unused - no choice)
   * @param {INightActionGameState} gameState - Game state access
   *
   * @returns {Promise<NightActionResult>} Result showing current card
   *
   * @example
   * ```typescript
   * const result = await insomniacAction.doExecute(context, agent, gameState);
   * // result.info.viewed shows what card is at Insomniac's position
   * ```
   */
  protected async doExecute(
    context: NightActionContext,
    _agent: INightActionAgent,
    gameState: INightActionGameState
  ): Promise<NightActionResult> {
    // Look at own card (no choice to make)
    const currentRole = gameState.getPlayerRole(context.myPlayerId);

    return this.createSuccessResult(context.myPlayerId, {
      viewed: [{
        playerId: context.myPlayerId,
        role: currentRole
      }]
    });
  }
}
