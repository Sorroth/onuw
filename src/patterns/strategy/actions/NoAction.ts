/**
 * @fileoverview Null Object Pattern implementation for roles without night actions.
 * @module patterns/strategy/actions/NoAction
 *
 * @summary Provides a do-nothing action for roles that don't wake at night.
 *
 * @description
 * The Null Object Pattern is used here to handle roles without night actions
 * (Villager, Hunter, Tanner). Instead of checking for null/undefined actions,
 * we use this NoAction class that safely does nothing.
 *
 * @pattern Null Object Pattern
 * - Provides a default "do nothing" behavior
 * - Eliminates null checks throughout the codebase
 * - Maintains consistent interface for all roles
 *
 * @remarks
 * Roles that use NoAction:
 * - **Villager**: No special ability
 * - **Hunter**: Ability triggers on death, not at night
 * - **Tanner**: Wants to die; no night ability
 *
 * @example
 * ```typescript
 * const villagerAction = new NoAction(RoleName.VILLAGER);
 * const result = await villagerAction.execute(context, agent, gameState);
 * // result.actionType === 'NONE'
 * // result.success === true
 * // Nothing happened, but action "succeeded"
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
 * @summary Null Object implementation for roles without night actions.
 *
 * @description
 * This class implements the INightAction interface but does nothing.
 * It returns a successful result with no changes or information.
 *
 * @pattern Null Object Pattern
 * - Replaces null/undefined with a real object
 * - execute() does nothing but returns valid result
 * - getNightOrder() returns -1 (no night action)
 *
 * @remarks
 * Benefits of using NoAction instead of null checks:
 * - No need for `if (action !== null)` everywhere
 * - Consistent logging (action executed, did nothing)
 * - Easier to test (no special null handling)
 *
 * @example
 * ```typescript
 * // Without Null Object (bad):
 * if (player.nightAction !== null) {
 *   await player.nightAction.execute(...);
 * }
 *
 * // With Null Object (good):
 * await player.nightAction.execute(...);
 * // NoAction safely does nothing
 * ```
 */
export class NoAction extends AbstractNightAction {
  /** The role this no-action belongs to */
  private readonly roleName: RoleName;

  /**
   * @summary Creates a NoAction for a specific role.
   *
   * @param {RoleName} roleName - The role this action represents
   *
   * @example
   * ```typescript
   * const villagerNoAction = new NoAction(RoleName.VILLAGER);
   * const hunterNoAction = new NoAction(RoleName.HUNTER);
   * const tannerNoAction = new NoAction(RoleName.TANNER);
   * ```
   */
  constructor(roleName: RoleName) {
    super();
    this.roleName = roleName;
  }

  /**
   * @summary Returns the role name.
   *
   * @returns {RoleName} The role this no-action belongs to
   *
   * @example
   * ```typescript
   * noAction.getRoleName(); // RoleName.VILLAGER
   * ```
   */
  getRoleName(): RoleName {
    return this.roleName;
  }

  /**
   * @summary Returns -1 indicating no night action.
   *
   * @description
   * A night order of -1 means this role does not wake at night.
   * The game should skip calling execute() for order -1.
   *
   * @returns {number} -1 (no night action)
   *
   * @example
   * ```typescript
   * noAction.getNightOrder(); // -1
   * // Game skips this role during night phase
   * ```
   */
  getNightOrder(): number {
    return -1;
  }

  /**
   * @summary Returns a description of the non-action.
   *
   * @returns {string} Description indicating no night ability
   *
   * @example
   * ```typescript
   * noAction.getDescription(); // "No night action"
   * ```
   */
  getDescription(): string {
    return 'No night action';
  }

  /**
   * @summary Returns 'NONE' as the action type.
   *
   * @returns {'NONE'} Always returns 'NONE'
   *
   * @protected
   */
  protected getActionType(): 'VIEW' | 'SWAP' | 'NONE' {
    return 'NONE';
  }

  /**
   * @summary Does nothing and returns a successful result.
   *
   * @description
   * This is the core of the Null Object Pattern. The execute method
   * is called like any other action, but it does nothing and returns
   * a valid result indicating no action was taken.
   *
   * @param {NightActionContext} context - What the player knows (unused)
   * @param {INightActionAgent} _agent - Decision-maker (unused)
   * @param {INightActionGameState} _gameState - Game state (unused)
   *
   * @returns {Promise<NightActionResult>} A success result with no info
   *
   * @remarks
   * The underscored parameters indicate they are intentionally unused.
   * This is the expected behavior for the Null Object Pattern.
   *
   * @example
   * ```typescript
   * const result = await noAction.execute(context, agent, gameState);
   * console.log(result);
   * // {
   * //   actorId: 'player-1',
   * //   roleName: RoleName.VILLAGER,
   * //   actionType: 'NONE',
   * //   success: true,
   * //   info: {}
   * // }
   * ```
   */
  protected async doExecute(
    context: NightActionContext,
    _agent: INightActionAgent,
    _gameState: INightActionGameState
  ): Promise<NightActionResult> {
    // Do nothing - this is intentional (Null Object Pattern)
    return this.createSuccessResult(context.myPlayerId, {});
  }
}
