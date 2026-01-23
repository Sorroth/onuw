/**
 * @fileoverview Werewolf night action implementation.
 * @module patterns/strategy/actions/WerewolfAction
 *
 * @summary Handles the Werewolf's night action - seeing other Werewolves.
 *
 * @description
 * The Werewolf wakes at night to see other Werewolves in the game.
 * This allows Werewolves to coordinate during the day phase.
 *
 * **Lone Wolf Rule**: If a Werewolf wakes and sees no other Werewolves,
 * they may look at ONE center card. This helps balance the game when
 * only one Werewolf is dealt to a player.
 *
 * @pattern Strategy Pattern - Concrete Strategy for Werewolf
 *
 * @remarks
 * Wake order: 2 (after Doppelganger, before Minion)
 *
 * Important notes:
 * - Werewolves see each other simultaneously
 * - Werewolves do NOT see the Minion
 * - A Doppelganger who copied Werewolf will also participate
 * - The Lone Wolf choice is optional (player decides if they want to look)
 *
 * @example
 * ```typescript
 * const werewolfAction = new WerewolfAction();
 * const result = await werewolfAction.execute(context, agent, gameState);
 *
 * // If other Werewolves exist:
 * // result.info.werewolves = ['player-2', 'player-4']
 *
 * // If Lone Wolf and chose to look at center:
 * // result.info.viewed = [{ centerIndex: 1, role: RoleName.SEER }]
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
 * @summary Werewolf night action - see other Werewolves or peek at center.
 *
 * @description
 * During the night phase:
 * 1. All Werewolves wake up
 * 2. They see who else is a Werewolf
 * 3. If alone (Lone Wolf), may view one center card
 *
 * @pattern Strategy Pattern - Concrete Strategy
 *
 * @remarks
 * The Werewolf team wins if no Werewolves die. Knowing who your
 * teammates are is crucial for coordinating stories during the day.
 *
 * For Lone Wolf, viewing a center card can help because:
 * - If you see a village role, you can safely claim it
 * - If you see another Werewolf in center, you know all Werewolves are accounted for
 *
 * @example
 * ```typescript
 * const action = new WerewolfAction();
 *
 * // Multiple werewolves scenario
 * const result1 = await action.execute(context, agent, gameState);
 * // result1.info.werewolves contains other werewolf player IDs
 *
 * // Lone wolf scenario
 * const result2 = await action.execute(loneWolfContext, agent, gameState);
 * // If agent chose to peek: result2.info.viewed contains center card info
 * ```
 */
export class WerewolfAction extends AbstractNightAction {
  /**
   * @summary Creates a new WerewolfAction instance.
   *
   * @example
   * ```typescript
   * const action = new WerewolfAction();
   * ```
   */
  constructor() {
    super();
  }

  /**
   * @summary Returns the role name.
   *
   * @returns {RoleName} RoleName.WEREWOLF
   */
  getRoleName(): RoleName {
    return RoleName.WEREWOLF;
  }

  /**
   * @summary Returns the night wake order.
   *
   * @description
   * Werewolves wake at order 2, after Doppelganger (1) but before
   * Minion (3). This ensures Doppelganger has already copied their
   * role before Werewolf identification happens.
   *
   * @returns {number} 2
   */
  getNightOrder(): number {
    return 2;
  }

  /**
   * @summary Returns a description of the action.
   *
   * @returns {string} Description of Werewolf night ability
   */
  getDescription(): string {
    return 'See other Werewolves. If alone, may look at one center card.';
  }

  /**
   * @summary Returns 'VIEW' as the action type.
   *
   * @description
   * Werewolf action is VIEW type because they gain information
   * (seeing other werewolves or peeking at center).
   *
   * @returns {'VIEW'} Always returns 'VIEW'
   *
   * @protected
   */
  protected getActionType(): 'VIEW' | 'SWAP' | 'NONE' {
    return 'VIEW';
  }

  /**
   * @summary Executes the Werewolf night action.
   *
   * @description
   * 1. Find all other players with Werewolf role
   * 2. If other Werewolves exist, return their IDs
   * 3. If alone (Lone Wolf), ask agent if they want to peek at center
   * 4. If yes, let agent choose a center card and reveal it
   *
   * @param {NightActionContext} context - What the player knows
   * @param {INightActionAgent} agent - Decision-maker for choices
   * @param {INightActionGameState} gameState - Game state access
   *
   * @returns {Promise<NightActionResult>} The result containing werewolf info
   *
   * @example
   * ```typescript
   * const result = await action.doExecute(context, agent, gameState);
   *
   * // With partners:
   * // result.info.werewolves = ['player-3']
   *
   * // Lone wolf who peeked:
   * // result.info.viewed = [{ centerIndex: 0, role: RoleName.VILLAGER }]
   * ```
   */
  protected async doExecute(
    context: NightActionContext,
    agent: INightActionAgent,
    gameState: INightActionGameState
  ): Promise<NightActionResult> {
    // Find all other Werewolves
    const allWerewolves = gameState.getPlayersWithRole(RoleName.WEREWOLF);
    const otherWerewolves = allWerewolves.filter(id => id !== context.myPlayerId);

    if (otherWerewolves.length > 0) {
      // Not alone - see other Werewolves
      return this.createSuccessResult(context.myPlayerId, {
        werewolves: otherWerewolves
      });
    }

    // Lone Wolf - first inform the player they are alone
    // This info must be sent BEFORE asking for center card selection
    // so the player understands WHY they're selecting a center card
    const loneWolfInfo = this.createSuccessResult(context.myPlayerId, {
      werewolves: [] // Empty array indicates lone wolf
    });
    agent.receiveNightInfo(loneWolfInfo);

    // Now ask for center card selection
    const centerIndex = await agent.selectCenterCard(context);

    // Validate center index
    if (centerIndex < 0 || centerIndex > 2) {
      return this.createFailureResult(
        context.myPlayerId,
        `Invalid center card index: ${centerIndex}. Must be 0, 1, or 2.`
      );
    }

    const centerRole = gameState.getCenterCard(centerIndex);

    return this.createSuccessResult(context.myPlayerId, {
      werewolves: [], // No other werewolves
      viewed: [{
        centerIndex,
        role: centerRole
      }]
    });
  }
}
