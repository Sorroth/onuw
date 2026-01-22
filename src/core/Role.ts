/**
 * @fileoverview Role class implementation.
 * @module core/Role
 *
 * @summary Represents a role card in One Night Ultimate Werewolf.
 *
 * @description
 * The Role class encapsulates all information about a game role:
 * - Identity (name, team, night order)
 * - Capabilities (night action strategy)
 * - Clonable (for Doppelganger's copy ability)
 *
 * @pattern Prototype Pattern - Roles can be cloned for Doppelganger
 * @pattern Strategy Pattern - Role holds reference to its night action
 *
 * @remarks
 * Roles are immutable data objects. The night action strategy is
 * injected during creation by the RoleFactory.
 *
 * @example
 * ```typescript
 * const seerRole = RoleFactory.createRole(RoleName.SEER);
 * console.log(seerRole.name); // RoleName.SEER
 * console.log(seerRole.team); // Team.VILLAGE
 * console.log(seerRole.nightOrder); // 5
 *
 * // Clone for Doppelganger
 * const clonedRole = seerRole.clone();
 * ```
 */

import { RoleName, Team } from '../enums';
import { IRole } from '../types';
import { INightAction } from '../patterns/strategy';

/**
 * @summary Mapping of roles to their teams.
 *
 * @description
 * Defines which team each role belongs to for win condition evaluation.
 *
 * @remarks
 * Note that a player's team is determined by their CURRENT role,
 * not their starting role. Swaps can change team allegiance!
 */
export const ROLE_TEAMS: Record<RoleName, Team> = {
  [RoleName.WEREWOLF]: Team.WEREWOLF,
  [RoleName.MINION]: Team.WEREWOLF,
  [RoleName.TANNER]: Team.TANNER,
  [RoleName.VILLAGER]: Team.VILLAGE,
  [RoleName.SEER]: Team.VILLAGE,
  [RoleName.ROBBER]: Team.VILLAGE,
  [RoleName.TROUBLEMAKER]: Team.VILLAGE,
  [RoleName.DRUNK]: Team.VILLAGE,
  [RoleName.INSOMNIAC]: Team.VILLAGE,
  [RoleName.MASON]: Team.VILLAGE,
  [RoleName.HUNTER]: Team.VILLAGE,
  [RoleName.DOPPELGANGER]: Team.VILLAGE // Doppelganger starts as Village
};

/**
 * @summary Mapping of roles to their night wake order.
 *
 * @description
 * Defines when each role wakes during the night phase.
 * -1 indicates no night action.
 *
 * @remarks
 * Order is critical for correct game state:
 * 1. Doppelganger (copies before others act)
 * 2. Werewolf (sees partners)
 * 3. Minion (sees werewolves)
 * 4. Mason (sees masons)
 * 5. Seer (views cards)
 * 6. Robber (swaps and views)
 * 7. Troublemaker (swaps others)
 * 8. Drunk (swaps with center)
 * 9. Insomniac (views own card last)
 */
export const NIGHT_ORDERS: Record<RoleName, number> = {
  [RoleName.DOPPELGANGER]: 1,
  [RoleName.WEREWOLF]: 2,
  [RoleName.MINION]: 3,
  [RoleName.MASON]: 4,
  [RoleName.SEER]: 5,
  [RoleName.ROBBER]: 6,
  [RoleName.TROUBLEMAKER]: 7,
  [RoleName.DRUNK]: 8,
  [RoleName.INSOMNIAC]: 9,
  [RoleName.VILLAGER]: -1,
  [RoleName.HUNTER]: -1,
  [RoleName.TANNER]: -1
};

/**
 * @summary Human-readable descriptions for each role.
 */
export const ROLE_DESCRIPTIONS: Record<RoleName, string> = {
  [RoleName.DOPPELGANGER]: 'Look at another player\'s card and become that role',
  [RoleName.WEREWOLF]: 'See other Werewolves. If alone, may look at one center card',
  [RoleName.MINION]: 'See who the Werewolves are (they don\'t see you)',
  [RoleName.MASON]: 'See other Masons (if alone, other Mason is in center)',
  [RoleName.SEER]: 'Look at one player\'s card OR two center cards',
  [RoleName.ROBBER]: 'Swap your card with another player\'s, then look at your new card',
  [RoleName.TROUBLEMAKER]: 'Swap two other players\' cards without looking',
  [RoleName.DRUNK]: 'Swap your card with one center card without looking',
  [RoleName.INSOMNIAC]: 'Look at your own card at the end of the night',
  [RoleName.VILLAGER]: 'No special ability',
  [RoleName.HUNTER]: 'If you are killed, whoever you voted for also dies',
  [RoleName.TANNER]: 'You win if you are killed by vote'
};

/**
 * @summary Represents a role card in the game.
 *
 * @description
 * A Role contains all static information about a game role:
 * - Name identifier
 * - Team allegiance
 * - Night wake order
 * - Human-readable description
 * - Night action strategy
 *
 * @pattern Prototype Pattern - clone() creates copies for Doppelganger
 * @pattern Strategy Pattern - nightAction encapsulates behavior
 *
 * @implements {IRole}
 *
 * @example
 * ```typescript
 * const role = new Role(
 *   RoleName.SEER,
 *   Team.VILLAGE,
 *   5,
 *   'Look at one player\'s card OR two center cards',
 *   new SeerAction()
 * );
 *
 * // Execute night action
 * const result = await role.nightAction.execute(context, agent, gameState);
 *
 * // Clone the role
 * const cloned = role.clone();
 * ```
 */
export class Role implements IRole {
  /**
   * @summary The unique name identifier for this role.
   * @readonly
   */
  public readonly name: RoleName;

  /**
   * @summary Which team this role belongs to.
   * @readonly
   */
  public readonly team: Team;

  /**
   * @summary Night wake order (1-9), or -1 if no night action.
   * @readonly
   */
  public readonly nightOrder: number;

  /**
   * @summary Human-readable description of the role's ability.
   * @readonly
   */
  public readonly description: string;

  /**
   * @summary The strategy for this role's night action.
   * @remarks Uses Null Object Pattern for roles without night actions.
   */
  public readonly nightAction: INightAction;

  /**
   * @summary Creates a new Role instance.
   *
   * @param {RoleName} name - The role's unique identifier
   * @param {Team} team - The team this role belongs to
   * @param {number} nightOrder - When this role wakes (1-9 or -1)
   * @param {string} description - Human-readable description
   * @param {INightAction} nightAction - The night action strategy
   *
   * @example
   * ```typescript
   * const villager = new Role(
   *   RoleName.VILLAGER,
   *   Team.VILLAGE,
   *   -1,
   *   'No special ability',
   *   new NoAction(RoleName.VILLAGER)
   * );
   * ```
   */
  constructor(
    name: RoleName,
    team: Team,
    nightOrder: number,
    description: string,
    nightAction: INightAction
  ) {
    this.name = name;
    this.team = team;
    this.nightOrder = nightOrder;
    this.description = description;
    this.nightAction = nightAction;
  }

  /**
   * @summary Creates a deep copy of this role.
   *
   * @description
   * Used by the Doppelganger to copy another player's role.
   * The cloned role has identical properties but is a separate instance.
   *
   * @pattern Prototype Pattern
   *
   * @returns {Role} A new Role instance with identical properties
   *
   * @example
   * ```typescript
   * const original = RoleFactory.createRole(RoleName.WEREWOLF);
   * const copy = original.clone();
   *
   * console.log(original === copy); // false
   * console.log(original.name === copy.name); // true
   * ```
   */
  clone(): Role {
    return new Role(
      this.name,
      this.team,
      this.nightOrder,
      this.description,
      this.nightAction // Night action is stateless, can share reference
    );
  }

  /**
   * @summary Returns a string representation of the role.
   *
   * @returns {string} Role name as string
   *
   * @example
   * ```typescript
   * console.log(seerRole.toString()); // "SEER"
   * ```
   */
  toString(): string {
    return this.name;
  }
}
