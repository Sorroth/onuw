/**
 * @fileoverview Seer night action implementation.
 * @module patterns/strategy/actions/SeerAction
 *
 * @summary Handles the Seer's night action - viewing cards.
 *
 * @description
 * The Seer is one of the most powerful village roles. At night, the Seer
 * chooses to either:
 * - Look at ONE player's card, OR
 * - Look at TWO center cards
 *
 * This information is crucial for the Village team to identify Werewolves.
 *
 * @pattern Strategy Pattern - Concrete Strategy for Seer
 *
 * @remarks
 * Wake order: 5 (middle of night)
 *
 * Strategic considerations:
 * - Looking at a player gives direct information about one person
 * - Looking at center cards reveals what's NOT in play
 * - If you see a Werewolf in center, there may only be one Werewolf among players
 *
 * @example
 * ```typescript
 * const seerAction = new SeerAction();
 * const result = await seerAction.execute(context, agent, gameState);
 *
 * // If viewed a player:
 * // result.info.viewed = [{ playerId: 'player-3', role: RoleName.WEREWOLF }]
 *
 * // If viewed center:
 * // result.info.viewed = [
 * //   { centerIndex: 0, role: RoleName.VILLAGER },
 * //   { centerIndex: 2, role: RoleName.DRUNK }
 * // ]
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
 * @summary Seer night action - view one player OR two center cards.
 *
 * @description
 * The Seer's choice is strategic:
 * - View player: Direct accusation evidence
 * - View center: Know which roles are not in play
 *
 * @pattern Strategy Pattern - Concrete Strategy
 *
 * @remarks
 * The Seer is commonly claimed falsely by Werewolves. True Seers should:
 * - Share their information during day
 * - Be prepared for counter-claims
 * - Consider who else might claim Seer
 *
 * @example
 * ```typescript
 * const seer = new SeerAction();
 * const result = await seer.execute(context, agent, gameState);
 * ```
 */
export class SeerAction extends AbstractNightAction {
  /**
   * @summary Creates a new SeerAction instance.
   */
  constructor() {
    super();
  }

  /**
   * @summary Returns the role name.
   *
   * @returns {RoleName} RoleName.SEER
   */
  getRoleName(): RoleName {
    return RoleName.SEER;
  }

  /**
   * @summary Returns the night wake order.
   *
   * @description
   * Seer wakes at order 5, in the middle of night actions.
   * This is after Werewolves/Minion/Mason but before Robber/Troublemaker.
   *
   * @returns {number} 5
   */
  getNightOrder(): number {
    return 5;
  }

  /**
   * @summary Returns a description of the action.
   *
   * @returns {string} Description of Seer night ability
   */
  getDescription(): string {
    return 'Look at one player\'s card OR two center cards';
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
   * @summary Executes the Seer night action.
   *
   * @description
   * 1. Ask agent whether to view a player or center cards
   * 2. If player: ask which player to view, reveal their card
   * 3. If center: ask which two center cards, reveal them
   *
   * @param {NightActionContext} context - What the player knows
   * @param {INightActionAgent} agent - Decision-maker for choices
   * @param {INightActionGameState} gameState - Game state access
   *
   * @returns {Promise<NightActionResult>} The result containing viewed cards
   *
   * @example
   * ```typescript
   * const result = await seerAction.doExecute(context, agent, gameState);
   * // result.info.viewed contains either 1 player card or 2 center cards
   * ```
   */
  protected async doExecute(
    context: NightActionContext,
    agent: INightActionAgent,
    gameState: INightActionGameState
  ): Promise<NightActionResult> {
    // Ask agent to choose between player or center
    const choice = await agent.chooseSeerOption(context);

    if (choice === 'player') {
      return this.viewPlayerCard(context, agent, gameState);
    } else {
      return this.viewCenterCards(context, agent, gameState);
    }
  }

  /**
   * @summary Views one player's card.
   *
   * @param {NightActionContext} context - What the player knows
   * @param {INightActionAgent} agent - Decision-maker for choices
   * @param {INightActionGameState} gameState - Game state access
   *
   * @returns {Promise<NightActionResult>} Result with viewed player card
   *
   * @private
   */
  private async viewPlayerCard(
    context: NightActionContext,
    agent: INightActionAgent,
    gameState: INightActionGameState
  ): Promise<NightActionResult> {
    // Get available targets (all players except self)
    const validTargets = context.allPlayerIds.filter(
      id => id !== context.myPlayerId
    );

    if (validTargets.length === 0) {
      return this.createFailureResult(
        context.myPlayerId,
        'No valid player targets available'
      );
    }

    // Ask agent to select a player
    const targetId = await agent.selectPlayer(validTargets, context);

    // Validate selection
    if (!validTargets.includes(targetId)) {
      return this.createFailureResult(
        context.myPlayerId,
        `Invalid target: ${targetId}. Must be one of: ${validTargets.join(', ')}`
      );
    }

    // Get the player's current role
    const role = gameState.getPlayerRole(targetId);

    return this.createSuccessResult(context.myPlayerId, {
      viewed: [{
        playerId: targetId,
        role
      }]
    });
  }

  /**
   * @summary Views two center cards.
   *
   * @param {NightActionContext} context - What the player knows
   * @param {INightActionAgent} agent - Decision-maker for choices
   * @param {INightActionGameState} gameState - Game state access
   *
   * @returns {Promise<NightActionResult>} Result with viewed center cards
   *
   * @private
   */
  private async viewCenterCards(
    context: NightActionContext,
    agent: INightActionAgent,
    gameState: INightActionGameState
  ): Promise<NightActionResult> {
    // Ask agent to select two center cards
    const [index1, index2] = await agent.selectTwoCenterCards(context);

    // Validate indices
    if (index1 < 0 || index1 > 2 || index2 < 0 || index2 > 2) {
      return this.createFailureResult(
        context.myPlayerId,
        `Invalid center indices: ${index1}, ${index2}. Must be 0, 1, or 2.`
      );
    }

    if (index1 === index2) {
      return this.createFailureResult(
        context.myPlayerId,
        'Must select two different center cards'
      );
    }

    // Get the center card roles
    const role1 = gameState.getCenterCard(index1);
    const role2 = gameState.getCenterCard(index2);

    return this.createSuccessResult(context.myPlayerId, {
      viewed: [
        { centerIndex: index1, role: role1 },
        { centerIndex: index2, role: role2 }
      ]
    });
  }
}
