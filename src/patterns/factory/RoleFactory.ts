/**
 * @fileoverview Factory Method Pattern with Registry for role creation.
 * @module patterns/factory/RoleFactory
 *
 * @summary Creates Role instances with proper configuration and night actions.
 *
 * @description
 * The RoleFactory encapsulates the complex logic of role creation:
 * - Looks up team assignment
 * - Looks up night wake order
 * - Creates appropriate night action strategy via registry
 * - Assembles the complete Role object
 *
 * @pattern Factory Method Pattern
 * - Defines interface for creating roles
 * - Subclasses (or methods) decide which concrete class to instantiate
 * - Decouples role creation from role usage
 *
 * @pattern Registry Pattern
 * - Night actions are registered in a Map rather than hardcoded in switch
 * - New roles can be added without modifying the factory
 * - Follows Open/Closed Principle
 *
 * @remarks
 * Using a factory with registry provides several benefits:
 * - Single source of truth for role configuration
 * - Easy to add new roles without modifying factory code
 * - Ensures consistency (correct team, order, action for each role)
 * - Simplifies testing (can mock factory or register test actions)
 * - Extensible for custom roles or game variants
 *
 * @example
 * ```typescript
 * // Create a single role
 * const seer = RoleFactory.createRole(RoleName.SEER);
 *
 * // Create multiple roles for a game
 * const roles = RoleFactory.createRoles([
 *   RoleName.WEREWOLF,
 *   RoleName.WEREWOLF,
 *   RoleName.SEER,
 *   RoleName.ROBBER,
 *   RoleName.TROUBLEMAKER,
 *   RoleName.VILLAGER,
 *   RoleName.VILLAGER,
 *   RoleName.DRUNK
 * ]);
 *
 * // Register a custom role action
 * RoleFactory.registerAction(RoleName.CUSTOM, () => new CustomAction());
 * ```
 */

import { RoleName, Team } from '../../enums';
import { Role, ROLE_TEAMS, NIGHT_ORDERS, ROLE_DESCRIPTIONS } from '../../core/Role';
import {
  INightAction,
  DoppelgangerAction,
  WerewolfAction,
  MinionAction,
  MasonAction,
  SeerAction,
  RobberAction,
  TroublemakerAction,
  DrunkAction,
  InsomniacAction,
  NoAction
} from '../strategy';

/**
 * @summary Type for night action factory functions.
 *
 * @description
 * Factory functions create new instances of night actions.
 * Using functions instead of storing instances ensures each role
 * gets a fresh action instance.
 */
export type NightActionFactory = () => INightAction;

/**
 * @summary Factory for creating Role instances.
 *
 * @description
 * RoleFactory provides static methods to create properly configured Role objects.
 * It handles:
 * - Looking up role configuration (team, night order, description)
 * - Creating the appropriate night action strategy
 * - Assembling the complete Role
 *
 * @pattern Factory Method Pattern
 *
 * @remarks
 * This is implemented as a static factory rather than instance factory
 * because role creation doesn't require any state.
 *
 * @example
 * ```typescript
 * // Create roles for a 5-player game
 * const roles = RoleFactory.createRoles([
 *   RoleName.WEREWOLF,
 *   RoleName.WEREWOLF,
 *   RoleName.SEER,
 *   RoleName.ROBBER,
 *   RoleName.TROUBLEMAKER,
 *   RoleName.VILLAGER,
 *   RoleName.VILLAGER,
 *   RoleName.DRUNK
 * ]);
 *
 * // Shuffle and deal
 * shuffleArray(roles);
 * const playerRoles = roles.slice(0, 5);
 * const centerRoles = roles.slice(5, 8);
 * ```
 */
export class RoleFactory {
  // =========================================================================
  // REGISTRY PATTERN IMPLEMENTATION
  // =========================================================================

  /**
   * @summary Registry mapping role names to their action factory functions.
   *
   * @description
   * The registry stores factory functions (not instances) to ensure
   * each role gets a fresh action instance when created.
   *
   * @pattern Registry Pattern
   *
   * @private
   * @static
   */
  private static readonly actionRegistry = new Map<RoleName, NightActionFactory>();

  /**
   * @summary Whether the default actions have been registered.
   *
   * @description
   * Tracks initialization state to avoid re-registering defaults.
   *
   * @private
   * @static
   */
  private static initialized = false;

  /**
   * @summary Registers a night action factory for a role.
   *
   * @description
   * Allows registering custom night actions for roles. This enables:
   * - Adding new roles without modifying factory code
   * - Overriding default actions for testing
   * - Creating game variants with modified role behaviors
   *
   * @pattern Registry Pattern - Register entries dynamically
   *
   * @param {RoleName} roleName - The role to register an action for
   * @param {NightActionFactory} factory - Factory function that creates the action
   *
   * @example
   * ```typescript
   * // Register a custom action
   * RoleFactory.registerAction(RoleName.SEER, () => new CustomSeerAction());
   *
   * // Register action for a new role (if RoleName enum is extended)
   * RoleFactory.registerAction(RoleName.ALPHA_WOLF, () => new AlphaWolfAction());
   * ```
   */
  static registerAction(roleName: RoleName, factory: NightActionFactory): void {
    RoleFactory.actionRegistry.set(roleName, factory);
  }

  /**
   * @summary Checks if a role has a registered action.
   *
   * @param {RoleName} roleName - The role to check
   *
   * @returns {boolean} True if the role has a registered action
   *
   * @example
   * ```typescript
   * if (RoleFactory.hasRegisteredAction(RoleName.SEER)) {
   *   console.log('Seer action is registered');
   * }
   * ```
   */
  static hasRegisteredAction(roleName: RoleName): boolean {
    RoleFactory.ensureInitialized();
    return RoleFactory.actionRegistry.has(roleName);
  }

  /**
   * @summary Gets all registered role names.
   *
   * @returns {RoleName[]} Array of role names with registered actions
   *
   * @example
   * ```typescript
   * const registeredRoles = RoleFactory.getRegisteredRoles();
   * console.log(`${registeredRoles.length} roles registered`);
   * ```
   */
  static getRegisteredRoles(): RoleName[] {
    RoleFactory.ensureInitialized();
    return Array.from(RoleFactory.actionRegistry.keys());
  }

  /**
   * @summary Clears all registered actions (useful for testing).
   *
   * @description
   * Removes all registered actions and resets initialization state.
   * Primarily useful for testing scenarios where you want to start fresh.
   *
   * @example
   * ```typescript
   * // In test setup
   * RoleFactory.clearRegistry();
   * RoleFactory.registerAction(RoleName.SEER, () => mockSeerAction);
   * ```
   */
  static clearRegistry(): void {
    RoleFactory.actionRegistry.clear();
    RoleFactory.initialized = false;
  }

  /**
   * @summary Ensures default actions are registered.
   *
   * @description
   * Lazily initializes the registry with default actions on first use.
   * This pattern ensures the registry is ready before any role creation.
   *
   * @private
   * @static
   */
  private static ensureInitialized(): void {
    if (RoleFactory.initialized) {
      return;
    }

    // Register all default night actions
    RoleFactory.registerAction(RoleName.DOPPELGANGER, () => new DoppelgangerAction());
    RoleFactory.registerAction(RoleName.WEREWOLF, () => new WerewolfAction());
    RoleFactory.registerAction(RoleName.MINION, () => new MinionAction());
    RoleFactory.registerAction(RoleName.MASON, () => new MasonAction());
    RoleFactory.registerAction(RoleName.SEER, () => new SeerAction());
    RoleFactory.registerAction(RoleName.ROBBER, () => new RobberAction());
    RoleFactory.registerAction(RoleName.TROUBLEMAKER, () => new TroublemakerAction());
    RoleFactory.registerAction(RoleName.DRUNK, () => new DrunkAction());
    RoleFactory.registerAction(RoleName.INSOMNIAC, () => new InsomniacAction());

    // Roles without night actions use Null Object Pattern
    // These are registered with NoAction factory
    RoleFactory.registerAction(RoleName.VILLAGER, () => new NoAction(RoleName.VILLAGER));
    RoleFactory.registerAction(RoleName.HUNTER, () => new NoAction(RoleName.HUNTER));
    RoleFactory.registerAction(RoleName.TANNER, () => new NoAction(RoleName.TANNER));

    RoleFactory.initialized = true;
  }

  // =========================================================================
  // ROLE CREATION METHODS
  // =========================================================================

  /**
   * @summary Creates a single Role instance.
   *
   * @description
   * Creates a fully configured Role with:
   * - Correct team assignment
   * - Correct night wake order
   * - Appropriate night action strategy
   * - Human-readable description
   *
   * @pattern Factory Method Pattern
   *
   * @param {RoleName} roleName - The role to create
   *
   * @returns {Role} A configured Role instance
   *
   * @throws {Error} If roleName is not a valid RoleName
   *
   * @example
   * ```typescript
   * const werewolf = RoleFactory.createRole(RoleName.WEREWOLF);
   * console.log(werewolf.team); // Team.WEREWOLF
   * console.log(werewolf.nightOrder); // 2
   * ```
   */
  static createRole(roleName: RoleName): Role {
    const team = ROLE_TEAMS[roleName];
    const nightOrder = NIGHT_ORDERS[roleName];
    const description = ROLE_DESCRIPTIONS[roleName];
    const nightAction = RoleFactory.createNightAction(roleName);

    if (team === undefined || nightOrder === undefined) {
      throw new Error(`Unknown role: ${roleName}`);
    }

    return new Role(roleName, team, nightOrder, description, nightAction);
  }

  /**
   * @summary Creates multiple Role instances.
   *
   * @description
   * Convenience method for creating multiple roles at once.
   * Useful for setting up a game.
   *
   * @param {RoleName[]} roleNames - Array of roles to create
   *
   * @returns {Role[]} Array of configured Role instances
   *
   * @example
   * ```typescript
   * const gameRoles = RoleFactory.createRoles([
   *   RoleName.WEREWOLF,
   *   RoleName.WEREWOLF,
   *   RoleName.SEER,
   *   RoleName.ROBBER,
   *   RoleName.TROUBLEMAKER,
   *   RoleName.VILLAGER,
   *   RoleName.VILLAGER,
   *   RoleName.DRUNK
   * ]);
   * // Returns array of 8 Role objects
   * ```
   */
  static createRoles(roleNames: RoleName[]): Role[] {
    return roleNames.map(name => RoleFactory.createRole(name));
  }

  /**
   * @summary Creates the appropriate night action for a role.
   *
   * @description
   * Looks up the role in the registry and invokes the factory function.
   * Uses Null Object Pattern for roles without registered actions.
   *
   * @pattern Registry Pattern - Looks up factory in registry
   * @pattern Factory Method Pattern - Creates strategy objects
   * @pattern Null Object Pattern - Returns NoAction for unregistered roles
   *
   * @param {RoleName} roleName - The role to create an action for
   *
   * @returns {INightAction} The appropriate night action strategy
   *
   * @private
   *
   * @example
   * ```typescript
   * const action = RoleFactory.createNightAction(RoleName.SEER);
   * // Returns SeerAction instance from registry
   *
   * const noAction = RoleFactory.createNightAction(RoleName.VILLAGER);
   * // Returns NoAction instance (Null Object)
   * ```
   */
  private static createNightAction(roleName: RoleName): INightAction {
    // Ensure registry is initialized with default actions
    RoleFactory.ensureInitialized();

    // Look up the factory in the registry
    const factory = RoleFactory.actionRegistry.get(roleName);

    if (factory) {
      return factory();
    }

    // Fallback to NoAction for any unregistered roles (Null Object Pattern)
    return new NoAction(roleName);
  }

  /**
   * @summary Gets all available role names.
   *
   * @returns {RoleName[]} Array of all role names
   *
   * @example
   * ```typescript
   * const allRoles = RoleFactory.getAllRoleNames();
   * // [DOPPELGANGER, WEREWOLF, MINION, ...]
   * ```
   */
  static getAllRoleNames(): RoleName[] {
    return Object.values(RoleName);
  }

  /**
   * @summary Gets role names for a specific team.
   *
   * @param {Team} team - The team to filter by
   *
   * @returns {RoleName[]} Role names belonging to that team
   *
   * @example
   * ```typescript
   * const werewolfTeamRoles = RoleFactory.getRolesByTeam(Team.WEREWOLF);
   * // [WEREWOLF, MINION]
   * ```
   */
  static getRolesByTeam(team: Team): RoleName[] {
    return Object.entries(ROLE_TEAMS)
      .filter(([_, t]) => t === team)
      .map(([name, _]) => name as RoleName);
  }

  /**
   * @summary Gets role names that have night actions.
   *
   * @returns {RoleName[]} Role names with night actions, in wake order
   *
   * @example
   * ```typescript
   * const nightRoles = RoleFactory.getNightActionRoles();
   * // [DOPPELGANGER, WEREWOLF, MINION, MASON, SEER, ROBBER, TROUBLEMAKER, DRUNK, INSOMNIAC]
   * ```
   */
  static getNightActionRoles(): RoleName[] {
    return Object.entries(NIGHT_ORDERS)
      .filter(([_, order]) => order > 0)
      .sort(([_, a], [__, b]) => a - b)
      .map(([name, _]) => name as RoleName);
  }

  /**
   * @summary Validates a game setup's role configuration.
   *
   * @description
   * Checks that:
   * - Number of roles equals players + 3 (for center)
   * - If Masons are used, both are included
   *
   * @param {RoleName[]} roles - Roles to validate
   * @param {number} playerCount - Number of players
   *
   * @returns {{ valid: boolean; errors: string[] }} Validation result
   *
   * @example
   * ```typescript
   * const result = RoleFactory.validateSetup(
   *   [RoleName.WEREWOLF, RoleName.SEER, ...],
   *   5
   * );
   *
   * if (!result.valid) {
   *   console.error(result.errors);
   * }
   * ```
   */
  static validateSetup(roles: RoleName[], playerCount: number): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    // Check role count
    const expectedRoles = playerCount + 3;
    if (roles.length !== expectedRoles) {
      errors.push(
        `Expected ${expectedRoles} roles for ${playerCount} players, got ${roles.length}`
      );
    }

    // Check Mason rule (use 0 or 2)
    const masonCount = roles.filter(r => r === RoleName.MASON).length;
    if (masonCount === 1) {
      errors.push('Masons must be used in pairs (0 or 2)');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}
