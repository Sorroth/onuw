/**
 * @fileoverview Enum definitions for One Night Ultimate Werewolf game.
 * @module enums
 *
 * @summary Contains all enumeration types used throughout the ONUW game engine.
 *
 * @remarks
 * These enums define the core constants that drive game logic:
 * - GamePhase: The sequential phases of a game
 * - Team: Which team a role belongs to (determines win conditions)
 * - RoleName: All available roles in the game
 *
 * @example
 * ```typescript
 * import { GamePhase, Team, RoleName } from './enums';
 *
 * const currentPhase = GamePhase.NIGHT;
 * const werewolfTeam = Team.WEREWOLF;
 * const seerRole = RoleName.SEER;
 * ```
 */

/**
 * @summary Represents the sequential phases of a One Night Ultimate Werewolf game.
 *
 * @description
 * The game progresses through these phases in order:
 * 1. SETUP - Players receive roles, center cards are placed
 * 2. NIGHT - Roles wake in order and perform actions
 * 3. DAY - Players discuss and make claims
 * 4. VOTING - Players simultaneously vote to eliminate
 * 5. RESOLUTION - Votes are tallied, winner is determined
 *
 * @pattern State Pattern - Each phase has different valid actions and transitions
 *
 * @remarks
 * The game is "one night" - there is only one night phase, then day,
 * then voting. Unlike regular Werewolf, there are no multiple rounds.
 *
 * @example
 * ```typescript
 * if (currentPhase === GamePhase.NIGHT) {
 *   // Execute night actions in order
 *   executeNightActions();
 * }
 * ```
 */
export enum GamePhase {
  /** Initial setup - roles are dealt, center cards placed */
  SETUP = 'SETUP',

  /** Night phase - roles wake and perform actions in order */
  NIGHT = 'NIGHT',

  /** Day phase - players discuss and make claims */
  DAY = 'DAY',

  /** Voting phase - players simultaneously vote */
  VOTING = 'VOTING',

  /** Resolution phase - votes tallied, winner determined */
  RESOLUTION = 'RESOLUTION'
}

/**
 * @summary Represents the teams in One Night Ultimate Werewolf.
 *
 * @description
 * Each role belongs to one of these teams, which determines their win condition:
 * - VILLAGE: Wins if at least one Werewolf dies
 * - WEREWOLF: Wins if no Werewolves die
 * - TANNER: Wins only if the Tanner dies (Werewolves cannot win if Tanner dies)
 *
 * @pattern Strategy Pattern - Different win conditions are encapsulated per team
 *
 * @remarks
 * The Minion is on Team WEREWOLF but has a special rule: they can die
 * and the Werewolf team still wins. The Minion wins if Werewolves win.
 * If there are no Werewolves in the game, special rules apply:
 * - Village wins if Minion dies OR if no one dies
 * - If no Werewolves AND no Minion: Village wins if no one dies
 *
 * @example
 * ```typescript
 * function checkWin(team: Team, deadPlayers: Player[]): boolean {
 *   switch (team) {
 *     case Team.VILLAGE:
 *       return deadPlayers.some(p => p.currentRole.team === Team.WEREWOLF);
 *     case Team.WEREWOLF:
 *       return !deadPlayers.some(p => p.currentRole.name === RoleName.WEREWOLF);
 *     case Team.TANNER:
 *       return deadPlayers.some(p => p.currentRole.name === RoleName.TANNER);
 *   }
 * }
 * ```
 */
export enum Team {
  /** Village team - wins if at least one Werewolf dies */
  VILLAGE = 'VILLAGE',

  /** Werewolf team - wins if no Werewolves die */
  WEREWOLF = 'WEREWOLF',

  /** Tanner (independent) - wins only if Tanner dies */
  TANNER = 'TANNER'
}

/**
 * @summary All available role names in One Night Ultimate Werewolf.
 *
 * @description
 * Roles are listed in their night wake order (when applicable).
 * Each role has specific abilities and belongs to a team:
 *
 * **Night Wake Order:**
 * 1. DOPPELGANGER - Copies another player's role
 * 2. WEREWOLF - Sees other werewolves (or one center card if alone)
 * 3. MINION - Sees werewolves (werewolves don't see minion)
 * 4. MASON - Sees other masons
 * 5. SEER - Views one player card OR two center cards
 * 6. ROBBER - Swaps card with another player, sees new card
 * 7. TROUBLEMAKER - Swaps two other players' cards (doesn't look)
 * 8. DRUNK - Swaps card with center (doesn't look)
 * 9. INSOMNIAC - Looks at own card at end of night
 *
 * **No Night Action:**
 * - VILLAGER - No ability
 * - HUNTER - If killed, their vote target also dies
 * - TANNER - Wants to die; wins only if killed
 *
 * @pattern Factory Method Pattern - RoleFactory creates roles by name
 *
 * @remarks
 * The wake order is critical for game logic. Actions must execute
 * in this exact order to ensure game state is correct.
 * For example, if Robber steals a Seer card, the original Seer
 * still did their action because Seer wakes before Robber.
 *
 * @example
 * ```typescript
 * const nightOrder: RoleName[] = [
 *   RoleName.DOPPELGANGER,
 *   RoleName.WEREWOLF,
 *   RoleName.MINION,
 *   RoleName.MASON,
 *   RoleName.SEER,
 *   RoleName.ROBBER,
 *   RoleName.TROUBLEMAKER,
 *   RoleName.DRUNK,
 *   RoleName.INSOMNIAC
 * ];
 * ```
 */
export enum RoleName {
  // === ROLES WITH NIGHT ACTIONS (in wake order) ===

  /** Copies another player's role and becomes that role */
  DOPPELGANGER = 'DOPPELGANGER',

  /** Sees other werewolves; if alone, may view one center card */
  WEREWOLF = 'WEREWOLF',

  /** Sees werewolves but werewolves don't see minion */
  MINION = 'MINION',

  /** Sees other masons (always use 2 mason cards) */
  MASON = 'MASON',

  /** Views one player's card OR two center cards */
  SEER = 'SEER',

  /** Swaps own card with another player, sees new card */
  ROBBER = 'ROBBER',

  /** Swaps two other players' cards without looking */
  TROUBLEMAKER = 'TROUBLEMAKER',

  /** Swaps own card with center card without looking */
  DRUNK = 'DRUNK',

  /** Looks at own card at end of night to see if it changed */
  INSOMNIAC = 'INSOMNIAC',

  // === ROLES WITHOUT NIGHT ACTIONS ===

  /** No special ability - basic village team member */
  VILLAGER = 'VILLAGER',

  /** If voted out, their vote target also dies */
  HUNTER = 'HUNTER',

  /** Wants to die - wins only if killed by vote */
  TANNER = 'TANNER'
}

/**
 * @summary The canonical night wake order for all roles with night actions.
 *
 * @description
 * This array defines the exact order in which roles wake during the night phase.
 * Only roles with night actions are included. Roles without night actions
 * (Villager, Hunter, Tanner) are not in this list.
 *
 * @pattern Template Method Pattern - The night phase uses this order as its algorithm skeleton
 *
 * @remarks
 * This order is critical for correct game state. For example:
 * - Doppelganger must go first to copy a role before others act
 * - Robber goes after Seer, so stealing a Seer doesn't give the Robber a Seer action
 * - Insomniac goes last to see final state of their card after all swaps
 *
 * @example
 * ```typescript
 * for (const roleName of NIGHT_WAKE_ORDER) {
 *   const playersWithRole = getPlayersWithRole(roleName);
 *   for (const player of playersWithRole) {
 *     await executeNightAction(player);
 *   }
 * }
 * ```
 */
export const NIGHT_WAKE_ORDER: RoleName[] = [
  RoleName.DOPPELGANGER,
  RoleName.WEREWOLF,
  RoleName.MINION,
  RoleName.MASON,
  RoleName.SEER,
  RoleName.ROBBER,
  RoleName.TROUBLEMAKER,
  RoleName.DRUNK,
  RoleName.INSOMNIAC
];

/**
 * @summary Set of roles that have no night action.
 *
 * @description
 * These roles do not wake during the night phase and have no special
 * night ability. They may still have day/voting abilities (like Hunter).
 *
 * @pattern Null Object Pattern - These roles use NoAction strategy
 *
 * @example
 * ```typescript
 * if (NO_NIGHT_ACTION_ROLES.has(player.startingRole.name)) {
 *   // Skip night action for this player
 *   return;
 * }
 * ```
 */
export const NO_NIGHT_ACTION_ROLES: Set<RoleName> = new Set([
  RoleName.VILLAGER,
  RoleName.HUNTER,
  RoleName.TANNER
]);
