/**
 * @fileoverview Player class implementation.
 * @module core/Player
 *
 * @summary Represents a player in One Night Ultimate Werewolf.
 *
 * @description
 * The Player class encapsulates all information about a game participant:
 * - Identity (ID, name)
 * - Role assignment (starting role, current role)
 * - Game state (alive/eliminated)
 *
 * @remarks
 * Important distinction:
 * - **startingRole**: The role the player was dealt at game start
 * - **currentRole**: The role card currently in front of this player
 *
 * These can differ after Robber, Troublemaker, or Drunk actions.
 * The player's WIN CONDITION is based on their currentRole at game end.
 *
 * @example
 * ```typescript
 * const player = new Player('player-1', 'Alice', seerRole);
 *
 * console.log(player.startingRole.name); // RoleName.SEER
 * console.log(player.currentRole.name);  // RoleName.SEER (same, not swapped yet)
 *
 * // After Robber swaps
 * player.setCurrentRole(werewolfRole);
 * console.log(player.currentRole.name);  // RoleName.WEREWOLF
 * // Player is now on Werewolf team!
 * ```
 */

import { IPlayer, IRole } from '../types';
import { Role } from './Role';
import { Team } from '../enums';

/**
 * @summary Represents a game participant.
 *
 * @description
 * A Player has:
 * - Unique identifier and display name
 * - Starting role (dealt at game start)
 * - Current role (may change due to swaps)
 * - Alive status (eliminated by vote or not)
 *
 * @implements {IPlayer}
 *
 * @example
 * ```typescript
 * const role = RoleFactory.createRole(RoleName.SEER);
 * const player = new Player('p1', 'Alice', role);
 *
 * console.log(player.getTeam()); // Team.VILLAGE
 * console.log(player.isAlive);   // true
 * ```
 */
export class Player implements IPlayer {
  /**
   * @summary Unique identifier for this player.
   * @readonly
   */
  public readonly id: string;

  /**
   * @summary Display name for this player.
   * @readonly
   */
  public readonly name: string;

  /**
   * @summary The role this player was dealt at game start.
   * @remarks This never changes once set.
   */
  public readonly startingRole: Role;

  /**
   * @summary The role card currently in this player's position.
   * @remarks This may change due to Robber/Troublemaker/Drunk.
   */
  private _currentRole: Role;

  /**
   * @summary Whether this player was eliminated by vote.
   */
  private _isAlive: boolean;

  /**
   * @summary Creates a new Player instance.
   *
   * @param {string} id - Unique identifier
   * @param {string} name - Display name
   * @param {Role} role - Starting role (also becomes current role)
   *
   * @example
   * ```typescript
   * const seer = RoleFactory.createRole(RoleName.SEER);
   * const player = new Player('player-1', 'Alice', seer);
   * ```
   */
  constructor(id: string, name: string, role: Role) {
    this.id = id;
    this.name = name;
    this.startingRole = role;
    this._currentRole = role;
    this._isAlive = true;
  }

  /**
   * @summary Gets the current role.
   *
   * @description
   * The current role may differ from starting role if the player's
   * card was swapped during night.
   *
   * @returns {Role} The current role
   *
   * @example
   * ```typescript
   * console.log(player.currentRole.name); // Current role name
   * ```
   */
  get currentRole(): Role {
    return this._currentRole;
  }

  /**
   * @summary Sets the current role.
   *
   * @description
   * Called when this player's card is swapped by Robber, Troublemaker, or Drunk.
   *
   * @param {Role} role - The new current role
   *
   * @example
   * ```typescript
   * player.setCurrentRole(werewolfRole);
   * // Player's card is now Werewolf
   * ```
   */
  set currentRole(role: Role) {
    this._currentRole = role;
  }

  /**
   * @summary Gets the alive status.
   *
   * @returns {boolean} True if player has not been eliminated
   *
   * @example
   * ```typescript
   * if (player.isAlive) {
   *   // Player survived the vote
   * }
   * ```
   */
  get isAlive(): boolean {
    return this._isAlive;
  }

  /**
   * @summary Sets the alive status.
   *
   * @param {boolean} value - New alive status
   *
   * @example
   * ```typescript
   * player.isAlive = false; // Player was eliminated
   * ```
   */
  set isAlive(value: boolean) {
    this._isAlive = value;
  }

  /**
   * @summary Gets the team based on current role.
   *
   * @description
   * The player's team for win condition purposes is determined
   * by their CURRENT role, not starting role.
   *
   * @returns {Team} The team this player is on
   *
   * @example
   * ```typescript
   * const team = player.getTeam();
   * if (team === Team.WEREWOLF) {
   *   // Player is on Werewolf team
   * }
   * ```
   */
  getTeam(): Team {
    return this._currentRole.team;
  }

  /**
   * @summary Gets the starting team.
   *
   * @description
   * The team based on the starting role. Useful for understanding
   * what the player "thought" they were during night.
   *
   * @returns {Team} The starting team
   *
   * @example
   * ```typescript
   * console.log(`Started as ${player.getStartingTeam()}`);
   * console.log(`Now is ${player.getTeam()}`);
   * ```
   */
  getStartingTeam(): Team {
    return this.startingRole.team;
  }

  /**
   * @summary Checks if the player's role changed during night.
   *
   * @description
   * Compares starting role to current role to determine if
   * a swap affected this player.
   *
   * @returns {boolean} True if current role differs from starting
   *
   * @example
   * ```typescript
   * if (player.roleWasSwapped()) {
   *   console.log('Player was affected by a swap!');
   * }
   * ```
   */
  roleWasSwapped(): boolean {
    return this.startingRole !== this._currentRole;
  }

  /**
   * @summary Eliminates this player.
   *
   * @description
   * Marks the player as eliminated by vote. Called during resolution.
   *
   * @example
   * ```typescript
   * player.eliminate();
   * console.log(player.isAlive); // false
   * ```
   */
  eliminate(): void {
    this._isAlive = false;
  }

  /**
   * @summary Returns a string representation of the player.
   *
   * @returns {string} Player name and ID
   *
   * @example
   * ```typescript
   * console.log(player.toString()); // "Alice (player-1)"
   * ```
   */
  toString(): string {
    return `${this.name} (${this.id})`;
  }

  /**
   * @summary Creates a summary of the player's state.
   *
   * @description
   * Returns an object with key player information.
   * Useful for logging and debugging.
   *
   * @returns {object} Player summary
   *
   * @example
   * ```typescript
   * console.log(player.toSummary());
   * // { id: 'player-1', name: 'Alice', startingRole: 'SEER', currentRole: 'WEREWOLF', isAlive: true }
   * ```
   */
  toSummary(): {
    id: string;
    name: string;
    startingRole: string;
    currentRole: string;
    isAlive: boolean;
  } {
    return {
      id: this.id,
      name: this.name,
      startingRole: this.startingRole.name,
      currentRole: this._currentRole.name,
      isAlive: this._isAlive
    };
  }
}
