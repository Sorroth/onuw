/**
 * @fileoverview Strategy Pattern interface for win conditions.
 * @module patterns/strategy/winConditions/WinCondition
 *
 * @summary Defines the contract for evaluating team victory conditions.
 *
 * @description
 * The Strategy Pattern is used to encapsulate each team's win condition.
 * This allows:
 * - Each team's victory logic to be defined independently
 * - Easy addition of new teams/conditions
 * - Clean separation from game resolution logic
 *
 * @pattern Strategy Pattern
 * - Strategy: IWinCondition interface
 * - ConcreteStrategies: VillageWinCondition, WerewolfWinCondition, TannerWinCondition
 * - Context: Game resolution phase uses these to determine winners
 *
 * @remarks
 * Win conditions in ONUW:
 * - **Village**: At least one Werewolf dies
 * - **Werewolf**: No Werewolves die (Minion can die)
 * - **Tanner**: Tanner dies (blocks Werewolf win)
 *
 * Special cases:
 * - No Werewolves in game: Village wins if Minion dies OR no one dies
 * - Tanner dies: Werewolves CANNOT win
 *
 * @example
 * ```typescript
 * const villageCondition: IWinCondition = new VillageWinCondition();
 * const result = villageCondition.evaluate(eliminatedPlayers, allPlayers);
 * if (result.won) {
 *   console.log('Village wins!', result.winners);
 * }
 * ```
 */

import { Team, RoleName } from '../../../enums';

/**
 * @summary Information about a player for win condition evaluation.
 *
 * @description
 * Contains the essential information needed to check win conditions:
 * - Player ID for identifying winners
 * - Current role (what they are NOW, not what they started as)
 * - Team based on current role
 */
export interface PlayerWinInfo {
  /** Player identifier */
  readonly playerId: string;

  /** The role the player currently has (after all swaps) */
  readonly currentRole: RoleName;

  /** The team the player is on based on current role */
  readonly team: Team;

  /** Whether this player was eliminated */
  readonly isEliminated: boolean;
}

/**
 * @summary Result of evaluating a win condition.
 *
 * @description
 * Contains whether this team won and who the winning players are.
 */
export interface WinConditionResult {
  /** The team this result is for */
  readonly team: Team;

  /** Whether this team won */
  readonly won: boolean;

  /** Player IDs who won (on this team) */
  readonly winners: ReadonlyArray<string>;

  /** Human-readable explanation of the result */
  readonly reason: string;
}

/**
 * @summary Context provided to win condition evaluation.
 *
 * @description
 * All information needed to determine if a team won.
 */
export interface WinConditionContext {
  /** All players in the game with their current state */
  readonly allPlayers: ReadonlyArray<PlayerWinInfo>;

  /** Players who were eliminated by voting */
  readonly eliminatedPlayers: ReadonlyArray<PlayerWinInfo>;

  /** Whether any werewolves exist among players (not in center) */
  readonly werewolvesExistAmongPlayers: boolean;

  /** Whether the minion exists among players */
  readonly minionExistsAmongPlayers: boolean;

  /** Whether the tanner was eliminated */
  readonly tannerWasEliminated: boolean;
}

/**
 * @summary Interface for win condition strategies.
 *
 * @description
 * Each team's win condition implements this interface. The evaluate method
 * is called during resolution to check if this team won.
 *
 * @pattern Strategy Pattern - This is the Strategy interface
 *
 * @example
 * ```typescript
 * class VillageWinCondition implements IWinCondition {
 *   getTeam(): Team { return Team.VILLAGE; }
 *
 *   evaluate(context: WinConditionContext): WinConditionResult {
 *     // Check if at least one werewolf was eliminated
 *     const werewolfKilled = context.eliminatedPlayers.some(
 *       p => p.currentRole === RoleName.WEREWOLF
 *     );
 *     // ... return result
 *   }
 * }
 * ```
 */
export interface IWinCondition {
  /**
   * @summary Gets the team this condition is for.
   *
   * @returns {Team} The team
   *
   * @example
   * ```typescript
   * villageCondition.getTeam(); // Team.VILLAGE
   * ```
   */
  getTeam(): Team;

  /**
   * @summary Evaluates whether this team won.
   *
   * @description
   * Checks the elimination results against this team's win condition.
   *
   * @param {WinConditionContext} context - Game end state information
   *
   * @returns {WinConditionResult} Whether this team won and who the winners are
   *
   * @example
   * ```typescript
   * const result = condition.evaluate(context);
   * if (result.won) {
   *   console.log(`${result.team} wins: ${result.reason}`);
   * }
   * ```
   */
  evaluate(context: WinConditionContext): WinConditionResult;

  /**
   * @summary Gets a description of this win condition.
   *
   * @returns {string} Human-readable win condition description
   *
   * @example
   * ```typescript
   * villageCondition.getDescription();
   * // "At least one Werewolf must die"
   * ```
   */
  getDescription(): string;
}

/**
 * @summary Abstract base class for win conditions.
 *
 * @description
 * Provides common functionality for win condition strategies.
 *
 * @pattern Strategy Pattern - Abstract Strategy
 */
export abstract class AbstractWinCondition implements IWinCondition {
  /**
   * @summary Gets the team this condition is for.
   * @abstract Must be implemented by concrete classes.
   */
  abstract getTeam(): Team;

  /**
   * @summary Evaluates the win condition.
   * @abstract Must be implemented by concrete classes.
   */
  abstract evaluate(context: WinConditionContext): WinConditionResult;

  /**
   * @summary Gets a description of this win condition.
   * @abstract Must be implemented by concrete classes.
   */
  abstract getDescription(): string;

  /**
   * @summary Creates a win result.
   *
   * @param {string[]} winners - Player IDs who won
   * @param {string} reason - Explanation of why they won
   *
   * @returns {WinConditionResult} A winning result
   *
   * @protected
   */
  protected createWinResult(winners: string[], reason: string): WinConditionResult {
    return {
      team: this.getTeam(),
      won: true,
      winners,
      reason
    };
  }

  /**
   * @summary Creates a loss result.
   *
   * @param {string} reason - Explanation of why they lost
   *
   * @returns {WinConditionResult} A losing result
   *
   * @protected
   */
  protected createLossResult(reason: string): WinConditionResult {
    return {
      team: this.getTeam(),
      won: false,
      winners: [],
      reason
    };
  }

  /**
   * @summary Gets all players on this team.
   *
   * @param {WinConditionContext} context - The game context
   *
   * @returns {string[]} Player IDs on this team
   *
   * @protected
   */
  protected getTeamMembers(context: WinConditionContext): string[] {
    return context.allPlayers
      .filter(p => p.team === this.getTeam())
      .map(p => p.playerId);
  }
}
