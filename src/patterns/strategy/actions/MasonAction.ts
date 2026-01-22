/**
 * @fileoverview Mason night action implementation.
 * @module patterns/strategy/actions/MasonAction
 *
 * @summary Handles the Mason's night action - seeing other Masons.
 *
 * @description
 * Masons wake up and see each other. This creates confirmed village allies:
 * - If two players are Masons, they know each other is village
 * - If a Mason sees no other Mason, the other Mason card is in the center
 *
 * @pattern Strategy Pattern - Concrete Strategy for Mason
 *
 * @remarks
 * Wake order: 4 (after Minion, before Seer)
 *
 * Important rules:
 * - Always use BOTH Mason cards in a game (or neither)
 * - Two confirmed village members is powerful information
 * - Masons can vouch for each other during day
 *
 * @example
 * ```typescript
 * const masonAction = new MasonAction();
 * const result = await masonAction.execute(context, agent, gameState);
 *
 * // If other Mason exists:
 * // result.info.masons = ['player-3']
 *
 * // If other Mason is in center:
 * // result.info.masons = []
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
 * @summary Mason night action - see other Masons.
 *
 * @description
 * The Mason:
 * 1. Wakes up with other Masons
 * 2. They see each other
 * 3. If alone, knows the other Mason card is in center
 *
 * @pattern Strategy Pattern - Concrete Strategy
 *
 * @remarks
 * Masons are valuable because:
 * - Two confirmed villagers can trust each other completely
 * - They can coordinate during day discussion
 * - A solo Mason knows their partner card is out of play
 *
 * Common verification strategy:
 * - One Mason claims first
 * - Other Mason confirms
 * - If no second Mason speaks up, the claim is suspicious
 *
 * @example
 * ```typescript
 * const mason = new MasonAction();
 * const result = await mason.execute(context, agent, gameState);
 * // result.info.masons lists other mason player IDs
 * ```
 */
export class MasonAction extends AbstractNightAction {
  /**
   * @summary Creates a new MasonAction instance.
   */
  constructor() {
    super();
  }

  /**
   * @summary Returns the role name.
   *
   * @returns {RoleName} RoleName.MASON
   */
  getRoleName(): RoleName {
    return RoleName.MASON;
  }

  /**
   * @summary Returns the night wake order.
   *
   * @description
   * Masons wake at order 4, after Minion (3) but before Seer (5).
   *
   * @returns {number} 4
   */
  getNightOrder(): number {
    return 4;
  }

  /**
   * @summary Returns a description of the action.
   *
   * @returns {string} Description of Mason night ability
   */
  getDescription(): string {
    return 'See other Masons (if you see none, the other Mason is in the center)';
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
   * @summary Executes the Mason night action.
   *
   * @description
   * Finds all other players with the Mason role and returns their IDs.
   * No agent decision needed - Masons simply see each other.
   *
   * @param {NightActionContext} context - What the player knows
   * @param {INightActionAgent} _agent - Decision-maker (unused - no choice)
   * @param {INightActionGameState} gameState - Game state access
   *
   * @returns {Promise<NightActionResult>} Result containing other mason IDs
   *
   * @example
   * ```typescript
   * const result = await masonAction.doExecute(context, agent, gameState);
   * // result.info.masons = ['player-2'] or [] if other mason in center
   * ```
   */
  protected async doExecute(
    context: NightActionContext,
    _agent: INightActionAgent,
    gameState: INightActionGameState
  ): Promise<NightActionResult> {
    // Find all Masons
    const allMasons = gameState.getPlayersWithRole(RoleName.MASON);

    // Filter out self to get other Masons
    const otherMasons = allMasons.filter(id => id !== context.myPlayerId);

    return this.createSuccessResult(context.myPlayerId, {
      masons: otherMasons
    });
  }
}
