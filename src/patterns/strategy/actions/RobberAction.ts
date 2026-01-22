/**
 * @fileoverview Robber night action implementation.
 * @module patterns/strategy/actions/RobberAction
 *
 * @summary Handles the Robber's night action - stealing another player's role.
 *
 * @description
 * The Robber swaps their card with another player's card, then looks at
 * their new card. This means:
 * - The Robber becomes whatever role they stole
 * - The target now has the Robber card (but doesn't know it)
 * - The Robber knows their new role and team
 *
 * @pattern Strategy Pattern - Concrete Strategy for Robber
 *
 * @remarks
 * Wake order: 6 (after Seer, before Troublemaker)
 *
 * Strategic implications:
 * - If Robber steals a Werewolf, the Robber is now on the Werewolf team!
 * - The original Werewolf now has Robber card (Village team)
 * - This creates interesting information asymmetry
 *
 * @example
 * ```typescript
 * const robberAction = new RobberAction();
 * const result = await robberAction.execute(context, agent, gameState);
 *
 * // result.info.swapped shows the swap
 * // result.info.viewed shows the new role the Robber now has
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
 * @summary Robber night action - swap with another player and see new card.
 *
 * @description
 * The Robber:
 * 1. Chooses another player
 * 2. Swaps cards with them (physical swap)
 * 3. Looks at the card they stole (their new role)
 *
 * @pattern Strategy Pattern - Concrete Strategy
 *
 * @remarks
 * The Robber does NOT wake again even if the new role would normally
 * have a night action. For example, stealing Seer doesn't give the
 * Robber a Seer peek (Seer already acted at order 5, Robber acts at 6).
 *
 * @example
 * ```typescript
 * const robber = new RobberAction();
 * const result = await robber.execute(context, agent, gameState);
 *
 * // If stole Werewolf:
 * // result.info.viewed = [{ playerId: 'player-1', role: RoleName.WEREWOLF }]
 * // Note: playerId is Robber's ID because that's where the card now is
 * ```
 */
export class RobberAction extends AbstractNightAction {
  /**
   * @summary Creates a new RobberAction instance.
   */
  constructor() {
    super();
  }

  /**
   * @summary Returns the role name.
   *
   * @returns {RoleName} RoleName.ROBBER
   */
  getRoleName(): RoleName {
    return RoleName.ROBBER;
  }

  /**
   * @summary Returns the night wake order.
   *
   * @description
   * Robber wakes at order 6, after Seer but before Troublemaker.
   * This is important because the Robber might steal a Troublemaker
   * card, but the Troublemaker already acted.
   *
   * @returns {number} 6
   */
  getNightOrder(): number {
    return 6;
  }

  /**
   * @summary Returns a description of the action.
   *
   * @returns {string} Description of Robber night ability
   */
  getDescription(): string {
    return 'Swap your card with another player\'s card, then look at your new card';
  }

  /**
   * @summary Returns 'SWAP' as the action type.
   *
   * @description
   * Robber's primary action is swapping, though they also view.
   * The SWAP type indicates the game state is modified.
   *
   * @returns {'SWAP'} Always returns 'SWAP'
   *
   * @protected
   */
  protected getActionType(): 'VIEW' | 'SWAP' | 'NONE' {
    return 'SWAP';
  }

  /**
   * @summary Executes the Robber night action.
   *
   * @description
   * 1. Ask agent to select a player to rob
   * 2. Swap cards with that player
   * 3. Look at the stolen card (now the Robber's card)
   * 4. Return the swap info and what was seen
   *
   * @param {NightActionContext} context - What the player knows
   * @param {INightActionAgent} agent - Decision-maker for choices
   * @param {INightActionGameState} gameState - Game state access
   *
   * @returns {Promise<NightActionResult>} Result with swap and view info
   *
   * @example
   * ```typescript
   * const result = await robberAction.doExecute(context, agent, gameState);
   * // result.info.swapped = { from: robber position, to: target position }
   * // result.info.viewed = [{ role the robber now has }]
   * ```
   */
  protected async doExecute(
    context: NightActionContext,
    agent: INightActionAgent,
    gameState: INightActionGameState
  ): Promise<NightActionResult> {
    // Get valid targets (all players except self)
    const validTargets = context.allPlayerIds.filter(
      id => id !== context.myPlayerId
    );

    if (validTargets.length === 0) {
      return this.createFailureResult(
        context.myPlayerId,
        'No valid targets to rob'
      );
    }

    // Ask agent to select a player to rob
    const targetId = await agent.selectPlayer(validTargets, context);

    // Validate selection
    if (!validTargets.includes(targetId)) {
      return this.createFailureResult(
        context.myPlayerId,
        `Invalid target: ${targetId}`
      );
    }

    // Perform the swap
    gameState.swapCards(
      { playerId: context.myPlayerId },
      { playerId: targetId }
    );

    // Look at the new card (what the Robber now has)
    // After the swap, the card at myPlayerId position is what was stolen
    const newRole = gameState.getPlayerRole(context.myPlayerId);

    return this.createSuccessResult(context.myPlayerId, {
      swapped: {
        from: { playerId: context.myPlayerId },
        to: { playerId: targetId }
      },
      viewed: [{
        playerId: context.myPlayerId, // The card is now here
        role: newRole
      }]
    });
  }
}
