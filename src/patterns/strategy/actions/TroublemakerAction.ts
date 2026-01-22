/**
 * @fileoverview Troublemaker night action implementation.
 * @module patterns/strategy/actions/TroublemakerAction
 *
 * @summary Handles the Troublemaker's night action - swapping two other players' cards.
 *
 * @description
 * The Troublemaker swaps the cards of TWO OTHER players (not their own).
 * Importantly, the Troublemaker does NOT look at the cards.
 *
 * This creates chaos:
 * - Two players may now have different roles than they started with
 * - Neither of them knows their card was swapped
 * - Only the Troublemaker knows which players were affected
 *
 * @pattern Strategy Pattern - Concrete Strategy for Troublemaker
 *
 * @remarks
 * Wake order: 7 (after Robber, before Drunk)
 *
 * Strategic implications:
 * - Can "save" a player by swapping their Werewolf card away
 * - Can "condemn" a player by swapping a Werewolf card to them
 * - Information about who was swapped is valuable during day
 *
 * @example
 * ```typescript
 * const troublemakerAction = new TroublemakerAction();
 * const result = await troublemakerAction.execute(context, agent, gameState);
 *
 * // result.info.swapped shows which two players were swapped
 * // result.info.viewed is undefined (Troublemaker doesn't look)
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
 * @summary Troublemaker night action - swap two other players' cards.
 *
 * @description
 * The Troublemaker:
 * 1. Chooses two OTHER players (not themselves)
 * 2. Swaps their cards
 * 3. Does NOT look at the cards
 *
 * @pattern Strategy Pattern - Concrete Strategy
 *
 * @remarks
 * Unlike the Robber, the Troublemaker:
 * - Cannot swap their own card
 * - Does not see what cards were swapped
 * - Only knows THAT a swap occurred and between whom
 *
 * @example
 * ```typescript
 * const troublemaker = new TroublemakerAction();
 * const result = await troublemaker.execute(context, agent, gameState);
 * // result.info.swapped = { from: player1, to: player2 }
 * ```
 */
export class TroublemakerAction extends AbstractNightAction {
  /**
   * @summary Creates a new TroublemakerAction instance.
   */
  constructor() {
    super();
  }

  /**
   * @summary Returns the role name.
   *
   * @returns {RoleName} RoleName.TROUBLEMAKER
   */
  getRoleName(): RoleName {
    return RoleName.TROUBLEMAKER;
  }

  /**
   * @summary Returns the night wake order.
   *
   * @description
   * Troublemaker wakes at order 7, after Robber but before Drunk.
   *
   * @returns {number} 7
   */
  getNightOrder(): number {
    return 7;
  }

  /**
   * @summary Returns a description of the action.
   *
   * @returns {string} Description of Troublemaker night ability
   */
  getDescription(): string {
    return 'Swap two other players\' cards without looking at them';
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
   * @summary Executes the Troublemaker night action.
   *
   * @description
   * 1. Ask agent to select two different players (not self)
   * 2. Swap their cards
   * 3. Return swap info (without revealing card contents)
   *
   * @param {NightActionContext} context - What the player knows
   * @param {INightActionAgent} agent - Decision-maker for choices
   * @param {INightActionGameState} gameState - Game state access
   *
   * @returns {Promise<NightActionResult>} Result with swap info only
   *
   * @example
   * ```typescript
   * const result = await troublemakerAction.doExecute(context, agent, gameState);
   * // result.info.swapped shows the swap, no viewing info
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

    if (validTargets.length < 2) {
      return this.createFailureResult(
        context.myPlayerId,
        'Not enough players to swap (need at least 2 other players)'
      );
    }

    // Ask agent to select two players to swap
    const [player1Id, player2Id] = await agent.selectTwoPlayers(validTargets, context);

    // Validate selections
    if (!validTargets.includes(player1Id) || !validTargets.includes(player2Id)) {
      return this.createFailureResult(
        context.myPlayerId,
        `Invalid targets: ${player1Id}, ${player2Id}`
      );
    }

    if (player1Id === player2Id) {
      return this.createFailureResult(
        context.myPlayerId,
        'Must select two different players'
      );
    }

    if (player1Id === context.myPlayerId || player2Id === context.myPlayerId) {
      return this.createFailureResult(
        context.myPlayerId,
        'Cannot swap your own card'
      );
    }

    // Perform the swap
    gameState.swapCards(
      { playerId: player1Id },
      { playerId: player2Id }
    );

    // Return swap info WITHOUT viewing the cards
    return this.createSuccessResult(context.myPlayerId, {
      swapped: {
        from: { playerId: player1Id },
        to: { playerId: player2Id }
      }
      // Note: no 'viewed' property - Troublemaker doesn't look
    });
  }
}
