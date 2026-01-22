/**
 * @fileoverview Drunk night action implementation.
 * @module patterns/strategy/actions/DrunkAction
 *
 * @summary Handles the Drunk's night action - swapping with center without looking.
 *
 * @description
 * The Drunk swaps their card with ONE center card but does NOT look at
 * their new card. This means:
 * - The Drunk's final role is unknown to them
 * - They might be a Werewolf now and not know it
 * - This creates uncertainty for both teams
 *
 * @pattern Strategy Pattern - Concrete Strategy for Drunk
 *
 * @remarks
 * Wake order: 8 (after Troublemaker, before Insomniac)
 *
 * Strategic implications:
 * - Drunk can claim to be Drunk (usually safe, as they don't know more)
 * - If Drunk becomes Werewolf, Village might kill an innocent
 * - The Drunk's original card goes to center (no longer in play among players)
 *
 * @example
 * ```typescript
 * const drunkAction = new DrunkAction();
 * const result = await drunkAction.execute(context, agent, gameState);
 *
 * // result.info.swapped shows the swap
 * // result.info.viewed is undefined (Drunk doesn't look)
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
 * @summary Drunk night action - swap with center card without looking.
 *
 * @description
 * The Drunk:
 * 1. Chooses one of the three center cards
 * 2. Swaps their card with it
 * 3. Does NOT look at their new card
 *
 * @pattern Strategy Pattern - Concrete Strategy
 *
 * @remarks
 * The Drunk is on the Village team at the start, but after the swap,
 * they might be anything. They win based on their FINAL role, which
 * they don't know.
 *
 * This creates interesting dynamics:
 * - Drunk truthfully doesn't know their role
 * - Others might view Drunk (Seer) or swap Drunk (Robber)
 * - Drunk could accidentally be voting against their own team
 *
 * @example
 * ```typescript
 * const drunk = new DrunkAction();
 * const result = await drunk.execute(context, agent, gameState);
 * // Drunk now has mystery role from center
 * ```
 */
export class DrunkAction extends AbstractNightAction {
  /**
   * @summary Creates a new DrunkAction instance.
   */
  constructor() {
    super();
  }

  /**
   * @summary Returns the role name.
   *
   * @returns {RoleName} RoleName.DRUNK
   */
  getRoleName(): RoleName {
    return RoleName.DRUNK;
  }

  /**
   * @summary Returns the night wake order.
   *
   * @description
   * Drunk wakes at order 8, after Troublemaker but before Insomniac.
   *
   * @returns {number} 8
   */
  getNightOrder(): number {
    return 8;
  }

  /**
   * @summary Returns a description of the action.
   *
   * @returns {string} Description of Drunk night ability
   */
  getDescription(): string {
    return 'Swap your card with one center card without looking at it';
  }

  /**
   * @summary Returns 'SWAP' as the action type.
   *
   * @returns {'SWAP'} Always returns 'SWAP'
   *
   * @protected
   */
  protected getActionType(): 'VIEW' | 'SWAP' | 'NONE' {
    return 'SWAP';
  }

  /**
   * @summary Executes the Drunk night action.
   *
   * @description
   * 1. Ask agent to select a center card (0, 1, or 2)
   * 2. Swap their card with that center card
   * 3. Return swap info WITHOUT revealing what was swapped
   *
   * @param {NightActionContext} context - What the player knows
   * @param {INightActionAgent} agent - Decision-maker for choices
   * @param {INightActionGameState} gameState - Game state access
   *
   * @returns {Promise<NightActionResult>} Result with swap info only
   *
   * @example
   * ```typescript
   * const result = await drunkAction.doExecute(context, agent, gameState);
   * // result.info.swapped shows Drunk <-> Center[x]
   * ```
   */
  protected async doExecute(
    context: NightActionContext,
    agent: INightActionAgent,
    gameState: INightActionGameState
  ): Promise<NightActionResult> {
    // Ask agent to select a center card
    const centerIndex = await agent.selectCenterCard(context);

    // Validate center index
    if (centerIndex < 0 || centerIndex > 2) {
      return this.createFailureResult(
        context.myPlayerId,
        `Invalid center card index: ${centerIndex}. Must be 0, 1, or 2.`
      );
    }

    // Perform the swap
    gameState.swapCards(
      { playerId: context.myPlayerId },
      { centerIndex }
    );

    // Return swap info WITHOUT viewing the card
    return this.createSuccessResult(context.myPlayerId, {
      swapped: {
        from: { playerId: context.myPlayerId },
        to: { centerIndex }
      }
      // Note: no 'viewed' property - Drunk doesn't look
    });
  }
}
