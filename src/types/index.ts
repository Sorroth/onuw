/**
 * @fileoverview Type definitions for One Night Ultimate Werewolf game.
 * @module types
 *
 * @summary Contains all TypeScript interfaces and types used throughout the ONUW game engine.
 *
 * @remarks
 * This module defines the contracts for:
 * - Game state structures
 * - Player information
 * - Role definitions
 * - Night action results
 * - Agent interfaces
 * - Audit system structures
 *
 * @example
 * ```typescript
 * import { IPlayer, IRole, GameState, NightActionResult } from './types';
 * ```
 */

import { GamePhase, Team, RoleName } from '../enums';

// ============================================================================
// ROLE INTERFACES
// ============================================================================

/**
 * @summary Interface for a role card in the game.
 *
 * @description
 * Represents a single role with its properties and capabilities.
 * Roles can be assigned to players or placed in the center.
 *
 * @pattern Prototype Pattern - Roles can be cloned (for Doppelganger)
 *
 * @remarks
 * The `nightOrder` field determines when this role wakes during night.
 * A value of -1 indicates no night action.
 *
 * @example
 * ```typescript
 * const seerRole: IRole = {
 *   name: RoleName.SEER,
 *   team: Team.VILLAGE,
 *   nightOrder: 5,
 *   description: 'Look at one player card or two center cards'
 * };
 * ```
 */
export interface IRole {
  /** The unique name identifier for this role */
  readonly name: RoleName;

  /** Which team this role belongs to */
  readonly team: Team;

  /** Night wake order (1-9), or -1 if no night action */
  readonly nightOrder: number;

  /** Human-readable description of the role's ability */
  readonly description: string;

  /**
   * Creates a deep copy of this role.
   * @pattern Prototype Pattern
   * @returns A new IRole instance with identical properties
   */
  clone(): IRole;
}

// ============================================================================
// PLAYER INTERFACES
// ============================================================================

/**
 * @summary Interface for a player in the game.
 *
 * @description
 * Represents a game participant with their assigned roles and state.
 * Note that startingRole and currentRole may differ after night actions.
 *
 * @remarks
 * - `startingRole`: The role dealt to this player at game start
 * - `currentRole`: The role card currently in front of this player
 * These can differ if Robber, Troublemaker, or Drunk affected this player.
 * The player's WIN CONDITION is based on currentRole at game end.
 *
 * @example
 * ```typescript
 * const player: IPlayer = {
 *   id: 'player-1',
 *   name: 'Alice',
 *   startingRole: seerRole,
 *   currentRole: seerRole,
 *   isAlive: true
 * };
 * ```
 */
export interface IPlayer {
  /** Unique identifier for this player */
  readonly id: string;

  /** Display name for this player */
  readonly name: string;

  /** The role this player was dealt at the start */
  startingRole: IRole;

  /** The role card currently in this player's position (may have been swapped) */
  currentRole: IRole;

  /** Whether this player survived the vote */
  isAlive: boolean;
}

// ============================================================================
// GAME STATE INTERFACES
// ============================================================================

/**
 * @summary Represents the complete state of the game at any point.
 *
 * @description
 * An immutable snapshot of the game that can be used for:
 * - Audit logging
 * - Circular state detection
 * - Game replay
 * - State comparison
 *
 * @pattern Memento Pattern - Captures game state for potential restoration
 *
 * @remarks
 * The state includes both public information (phase, votes) and
 * private information (card assignments). Access should be controlled
 * based on what each player is allowed to know.
 *
 * @example
 * ```typescript
 * const snapshot: GameState = {
 *   phase: GamePhase.NIGHT,
 *   players: [...],
 *   centerCards: [role1, role2, role3],
 *   votes: new Map(),
 *   nightActionLog: [],
 *   timestamp: Date.now()
 * };
 * ```
 */
export interface GameState {
  /** Current phase of the game */
  readonly phase: GamePhase;

  /** Array of all players in the game */
  readonly players: ReadonlyArray<IPlayer>;

  /** The three center cards (indices 0, 1, 2) */
  readonly centerCards: ReadonlyArray<IRole>;

  /** Map of player ID to their vote target's player ID */
  readonly votes: ReadonlyMap<string, string>;

  /** Log of all night actions that have occurred */
  readonly nightActionLog: ReadonlyArray<NightActionResult>;

  /** Timestamp when this state was captured */
  readonly timestamp: number;
}

/**
 * @summary Configuration for setting up a new game.
 *
 * @description
 * Defines the parameters needed to initialize a game:
 * - Which players are participating
 * - Which roles are in the game (must be players + 3 for center)
 *
 * @throws {Error} If roles.length !== players.length + 3
 *
 * @example
 * ```typescript
 * const config: GameConfig = {
 *   players: ['Alice', 'Bob', 'Charlie', 'Diana', 'Eve'],
 *   roles: [
 *     RoleName.WEREWOLF, RoleName.WEREWOLF,
 *     RoleName.SEER, RoleName.ROBBER, RoleName.TROUBLEMAKER,
 *     RoleName.VILLAGER, RoleName.VILLAGER, RoleName.DRUNK
 *   ]
 * };
 * ```
 */
/**
 * @summary Audit logging level for card state snapshots.
 *
 * @description
 * Controls how frequently the game captures card state snapshots:
 * - `minimal`: No snapshots during gameplay (only final state)
 * - `standard`: Snapshots at phase boundaries (before/after night phase)
 * - `verbose`: Snapshots after every night action (most detailed)
 *
 * @example
 * ```typescript
 * const config: GameConfig = {
 *   players: ['Alice', 'Bob', 'Charlie'],
 *   roles: [...],
 *   auditLevel: 'standard'  // Balanced logging
 * };
 * ```
 */
export type AuditLevel = 'minimal' | 'standard' | 'verbose';

export interface GameConfig {
  /** Names of players participating in the game */
  readonly players: ReadonlyArray<string>;

  /** Roles to use in this game (must be players.length + 3) */
  readonly roles: ReadonlyArray<RoleName>;

  /**
   * Debug option: Force specific players to receive specific roles.
   * Map of player index (0-based) to role name.
   * Only used in debug/testing mode.
   */
  readonly forcedRoles?: ReadonlyMap<number, RoleName>;

  /**
   * Audit logging level for card state snapshots.
   * - `minimal`: No snapshots (memory efficient, less audit detail)
   * - `standard`: Snapshots at phase boundaries (default, balanced)
   * - `verbose`: Snapshots after every action (detailed audit trail)
   *
   * @default 'standard'
   */
  readonly auditLevel?: AuditLevel;

  /**
   * Debug option: Force all werewolves to be placed in center cards.
   * Useful for testing Minion when no werewolves are among players.
   * Only used in debug/testing mode.
   */
  readonly forceWerewolvesToCenter?: boolean;
}

// ============================================================================
// NIGHT ACTION INTERFACES
// ============================================================================

/**
 * @summary The result of a night action execution.
 *
 * @description
 * Captures what happened when a role performed their night action.
 * Used for:
 * - Informing the acting player what they learned
 * - Audit logging
 * - Game state reconstruction
 *
 * @pattern Command Pattern - Represents an executed command with results
 *
 * @example
 * ```typescript
 * const seerResult: NightActionResult = {
 *   actorId: 'player-1',
 *   roleName: RoleName.SEER,
 *   actionType: 'VIEW',
 *   success: true,
 *   info: {
 *     viewed: [{ playerId: 'player-3', role: RoleName.WEREWOLF }]
 *   }
 * };
 * ```
 */
export interface NightActionResult {
  /** The player ID who performed the action */
  readonly actorId: string;

  /** The role that performed the action */
  readonly roleName: RoleName;

  /** Type of action: VIEW, SWAP, or NONE */
  readonly actionType: 'VIEW' | 'SWAP' | 'NONE';

  /** Whether the action was successfully executed */
  readonly success: boolean;

  /** Information gained or changes made by the action */
  readonly info: NightActionInfo;

  /** Error message if action failed */
  readonly error?: string;
}

/**
 * @summary Information structure for night action results.
 *
 * @description
 * Contains the specific details of what a night action accomplished.
 * Different roles populate different fields based on their abilities.
 *
 * @remarks
 * - `viewed`: For Seer, Werewolf (lone wolf), Insomniac, Mason, Minion
 * - `swapped`: For Robber, Troublemaker, Drunk
 * - `copied`: For Doppelganger
 *
 * @example
 * ```typescript
 * // Robber action info
 * const robberInfo: NightActionInfo = {
 *   swapped: {
 *     from: { playerId: 'player-1' },
 *     to: { playerId: 'player-2' }
 *   },
 *   viewed: [{ playerId: 'player-1', role: RoleName.WEREWOLF }] // New role
 * };
 * ```
 */
export interface NightActionInfo {
  /** Cards that were viewed (player cards or center cards) */
  viewed?: ReadonlyArray<ViewedCard>;

  /** Swap that was performed */
  swapped?: SwapInfo;

  /** Role that was copied (Doppelganger only) */
  copied?: {
    readonly fromPlayerId: string;
    readonly role: RoleName;
  };

  /** Other werewolves seen (Werewolf/Minion only) */
  werewolves?: ReadonlyArray<string>;

  /** Other masons seen (Mason only) */
  masons?: ReadonlyArray<string>;
}

/**
 * @summary Information about a card that was viewed.
 *
 * @description
 * Represents a single card view, either a player's card or a center card.
 * Exactly one of `playerId` or `centerIndex` will be set.
 *
 * @example
 * ```typescript
 * // Viewed a player's card
 * const playerView: ViewedCard = {
 *   playerId: 'player-2',
 *   role: RoleName.SEER
 * };
 *
 * // Viewed a center card
 * const centerView: ViewedCard = {
 *   centerIndex: 0,
 *   role: RoleName.VILLAGER
 * };
 * ```
 */
export interface ViewedCard {
  /** Player ID if viewing a player's card */
  readonly playerId?: string;

  /** Center card index (0-2) if viewing center */
  readonly centerIndex?: number;

  /** The role that was seen */
  readonly role: RoleName;
}

/**
 * @summary Information about a card swap.
 *
 * @description
 * Represents a swap between two card positions. Each position can be
 * a player's position or a center card position.
 *
 * @example
 * ```typescript
 * // Robber swaps with another player
 * const robberSwap: SwapInfo = {
 *   from: { playerId: 'player-1' },
 *   to: { playerId: 'player-3' }
 * };
 *
 * // Drunk swaps with center
 * const drunkSwap: SwapInfo = {
 *   from: { playerId: 'player-2' },
 *   to: { centerIndex: 1 }
 * };
 * ```
 */
export interface SwapInfo {
  /** First position in the swap */
  readonly from: CardPosition;

  /** Second position in the swap */
  readonly to: CardPosition;
}

/**
 * @summary A position where a card can be located.
 *
 * @description
 * Either a player's position (by ID) or a center position (by index).
 *
 * @example
 * ```typescript
 * const playerPos: CardPosition = { playerId: 'player-1' };
 * const centerPos: CardPosition = { centerIndex: 2 };
 * ```
 */
export interface CardPosition {
  /** Player ID if this is a player's card position */
  readonly playerId?: string;

  /** Center index (0-2) if this is a center card position */
  readonly centerIndex?: number;
}

// ============================================================================
// AGENT INTERFACES
// ============================================================================

/**
 * @summary Base context shared by all agent decision points.
 *
 * @description
 * Contains the common information available to an agent across all phases:
 * - Player identity (myPlayerId, myStartingRole)
 * - Game composition (rolesInGame)
 *
 * This base interface is extended by phase-specific contexts.
 *
 * @pattern Strategy Pattern - Different agent types process context differently
 * @pattern Template Method Pattern - Base context defines common structure
 *
 * @example
 * ```typescript
 * function processContext(ctx: BaseAgentContext): void {
 *   console.log(`Acting as ${ctx.myStartingRole} (${ctx.myPlayerId})`);
 * }
 * ```
 */
export interface BaseAgentContext {
  /** The acting player's ID */
  readonly myPlayerId: string;

  /** The acting player's starting role name */
  readonly myStartingRole: RoleName;

  /** All roles that are in this game */
  readonly rolesInGame: ReadonlyArray<RoleName>;
}

/**
 * @summary Context provided to an agent when making a night action decision.
 *
 * @description
 * Contains all information an agent needs to decide their night action.
 * Only includes information the player is allowed to know.
 *
 * @extends BaseAgentContext
 * @pattern Strategy Pattern - Different agent types process context differently
 *
 * @example
 * ```typescript
 * const context: NightActionContext = {
 *   myPlayerId: 'player-1',
 *   myStartingRole: RoleName.SEER,
 *   allPlayerIds: ['player-1', 'player-2', 'player-3', 'player-4', 'player-5'],
 *   rolesInGame: [RoleName.SEER, RoleName.WEREWOLF, ...],
 *   previousResults: []
 * };
 * ```
 */
export interface NightActionContext extends BaseAgentContext {
  /** IDs of all players in the game (excluding self for targeting) */
  readonly allPlayerIds: ReadonlyArray<string>;

  /** Previous night results this player has received (Doppelganger may have multiple) */
  readonly previousResults: ReadonlyArray<NightActionResult>;
}

/**
 * @summary Context provided to an agent during the day discussion phase.
 *
 * @description
 * Contains information about what has been said and what the agent knows.
 *
 * @extends BaseAgentContext
 *
 * @example
 * ```typescript
 * const context: DayContext = {
 *   myPlayerId: 'player-1',
 *   myStartingRole: RoleName.SEER,
 *   myNightInfo: seerResult,
 *   statements: [
 *     { playerId: 'player-2', statement: 'I am the Seer...' }
 *   ],
 *   rolesInGame: [...],
 *   allPlayerIds: [...]
 * };
 * ```
 */
export interface DayContext extends BaseAgentContext {
  /** What this player learned during night (if anything) */
  readonly myNightInfo: NightActionResult | null;

  /** All statements made so far in the discussion */
  readonly statements: ReadonlyArray<PlayerStatement>;

  /** IDs of all players in the game */
  readonly allPlayerIds: ReadonlyArray<string>;

  /** Map of player IDs to display names */
  readonly playerNames: ReadonlyMap<string, string>;
}

/**
 * @summary A statement made by a player during day discussion.
 *
 * @description
 * Records who said what during the day phase. Used for:
 * - Tracking claims and information sharing
 * - Detecting contradictions
 * - AI reasoning about player behavior
 *
 * @example
 * ```typescript
 * const statement: PlayerStatement = {
 *   playerId: 'player-2',
 *   statement: 'I am the Seer. I looked at player-4 and they are a Werewolf!',
 *   timestamp: Date.now()
 * };
 * ```
 */
export interface PlayerStatement {
  /** Who made the statement */
  readonly playerId: string;

  /** The content of the statement */
  readonly statement: string;

  /** When the statement was made */
  readonly timestamp: number;
}

/**
 * @summary Context provided to an agent when voting.
 *
 * @description
 * Contains all information available when deciding who to vote for.
 *
 * @extends BaseAgentContext
 *
 * @example
 * ```typescript
 * const context: VotingContext = {
 *   myPlayerId: 'player-1',
 *   myStartingRole: RoleName.SEER,
 *   myNightInfo: seerResult,
 *   allStatements: [...],
 *   eligibleTargets: ['player-2', 'player-3', 'player-4', 'player-5'],
 *   rolesInGame: [...]
 * };
 * ```
 */
export interface VotingContext extends BaseAgentContext {
  /** What this player learned during night */
  readonly myNightInfo: NightActionResult | null;

  /** All statements from the day phase */
  readonly allStatements: ReadonlyArray<PlayerStatement>;

  /** Player IDs that can be voted for */
  readonly eligibleTargets: ReadonlyArray<string>;
}

/**
 * @summary Decision made by a Seer during night.
 *
 * @description
 * The Seer must choose to view either one player's card OR two center cards.
 *
 * @example
 * ```typescript
 * // View a player
 * const viewPlayer: SeerChoice = { type: 'player', playerId: 'player-3' };
 *
 * // View center cards
 * const viewCenter: SeerChoice = { type: 'center', indices: [0, 1] };
 * ```
 */
export interface SeerChoice {
  /** Whether viewing a player or center cards */
  readonly type: 'player' | 'center';

  /** Player ID if type is 'player' */
  readonly playerId?: string;

  /** Center indices [0-2, 0-2] if type is 'center' (must be exactly 2) */
  readonly indices?: [number, number];
}

/**
 * @summary Decision made by a Troublemaker during night.
 *
 * @description
 * The Troublemaker swaps two other players' cards (not their own).
 *
 * @example
 * ```typescript
 * const choice: TroublemakerChoice = {
 *   player1Id: 'player-2',
 *   player2Id: 'player-4'
 * };
 * ```
 */
export interface TroublemakerChoice {
  /** First player whose card will be swapped */
  readonly player1Id: string;

  /** Second player whose card will be swapped */
  readonly player2Id: string;
}

// ============================================================================
// AUDIT INTERFACES
// ============================================================================

/**
 * @summary A single entry in the audit log.
 *
 * @description
 * Records a specific event that occurred during the game.
 * Used for debugging, replay, and circular state detection.
 *
 * @pattern Command Pattern - Records executed commands
 *
 * @example
 * ```typescript
 * const entry: AuditEntry = {
 *   id: 'audit-001',
 *   timestamp: Date.now(),
 *   phase: GamePhase.NIGHT,
 *   action: 'SEER_VIEW',
 *   actorId: 'player-1',
 *   details: { targetId: 'player-3', sawRole: RoleName.WEREWOLF },
 *   stateHash: 'abc123...'
 * };
 * ```
 */
export interface AuditEntry {
  /** Unique identifier for this entry */
  readonly id: string;

  /** When this entry was created */
  readonly timestamp: number;

  /** Game phase when this occurred */
  readonly phase: GamePhase;

  /** Type of action that occurred */
  readonly action: string;

  /** Who performed the action (player ID or 'SYSTEM') */
  readonly actorId: string;

  /** Action-specific details */
  readonly details: Record<string, unknown>;

  /** Hash of game state after this action */
  readonly stateHash: string;
}

/**
 * @summary Result of checking for circular/repeated states.
 *
 * @description
 * The CircularDetector returns this when checking if a state has been seen before.
 *
 * @example
 * ```typescript
 * const result: CircularCheckResult = {
 *   isCircular: true,
 *   matchingEntryId: 'audit-015',
 *   message: 'State hash abc123 was previously seen at entry audit-015'
 * };
 * ```
 */
export interface CircularCheckResult {
  /** Whether this state has been seen before */
  readonly isCircular: boolean;

  /** ID of the matching audit entry if circular */
  readonly matchingEntryId?: string;

  /** Human-readable explanation */
  readonly message: string;
}

// ============================================================================
// GAME RESULT INTERFACES
// ============================================================================

/**
 * @summary The final result of a completed game.
 *
 * @description
 * Contains all information about how the game ended:
 * - Which team(s) won
 * - Who was killed
 * - Final role positions
 *
 * @example
 * ```typescript
 * const result: GameResult = {
 *   winningTeams: [Team.VILLAGE],
 *   winningPlayers: ['player-1', 'player-3', 'player-4'],
 *   eliminatedPlayers: ['player-2'],
 *   finalRoles: new Map([...]),
 *   votes: new Map([...])
 * };
 * ```
 */
export interface GameResult {
  /** Teams that won (can be multiple in special cases) */
  readonly winningTeams: ReadonlyArray<Team>;

  /** Player IDs of winners */
  readonly winningPlayers: ReadonlyArray<string>;

  /** Player IDs who were eliminated */
  readonly eliminatedPlayers: ReadonlyArray<string>;

  /** Final role card for each player (after all swaps) */
  readonly finalRoles: ReadonlyMap<string, RoleName>;

  /** How each player voted */
  readonly votes: ReadonlyMap<string, string>;
}

/**
 * @summary Options for a player selection prompt.
 *
 * @description
 * Used when an agent needs to select a player target.
 *
 * @example
 * ```typescript
 * const options: SelectionOptions = {
 *   excludeSelf: true,
 *   availableTargets: ['player-2', 'player-3', 'player-4'],
 *   prompt: 'Choose a player to view their card'
 * };
 * ```
 */
export interface SelectionOptions {
  /** Whether the acting player can select themselves */
  readonly excludeSelf: boolean;

  /** IDs of players that can be selected */
  readonly availableTargets: ReadonlyArray<string>;

  /** Human-readable prompt describing the selection */
  readonly prompt: string;
}

// ============================================================================
// OBSERVER INTERFACES
// ============================================================================

/**
 * @summary Types of events that can be observed.
 *
 * @description
 * Used by the Observer pattern to categorize game events.
 */
export type GameEventType =
  | 'GAME_STARTED'
  | 'PHASE_CHANGED'
  | 'NIGHT_ACTION_EXECUTED'
  | 'STATEMENT_MADE'
  | 'VOTE_CAST'
  | 'GAME_ENDED'
  | 'ERROR';

/**
 * @summary A game event for the Observer pattern.
 *
 * @description
 * Represents something that happened in the game that observers may care about.
 *
 * @pattern Observer Pattern - Events are broadcast to registered observers
 *
 * @example
 * ```typescript
 * const event: GameEvent = {
 *   type: 'PHASE_CHANGED',
 *   timestamp: Date.now(),
 *   data: { from: GamePhase.NIGHT, to: GamePhase.DAY }
 * };
 * ```
 */
export interface GameEvent {
  /** Type of event */
  readonly type: GameEventType;

  /** When the event occurred */
  readonly timestamp: number;

  /** Event-specific data */
  readonly data: Record<string, unknown>;
}

/**
 * @summary Interface for game event observers.
 *
 * @description
 * Implement this interface to receive notifications about game events.
 *
 * @pattern Observer Pattern - Observers subscribe to game events
 *
 * @example
 * ```typescript
 * class ConsoleLogger implements IGameObserver {
 *   onEvent(event: GameEvent): void {
 *     console.log(`[${event.type}]`, event.data);
 *   }
 * }
 * ```
 */
export interface IGameObserver {
  /**
   * Called when a game event occurs.
   * @param event The event that occurred
   */
  onEvent(event: GameEvent): void;
}

// ============================================================================
// TYPE GUARDS
// ============================================================================

/**
 * @summary Type guard to check if a position is a player position.
 *
 * @param pos The position to check
 * @returns True if this is a player position
 *
 * @example
 * ```typescript
 * if (isPlayerPosition(pos)) {
 *   console.log('Player ID:', pos.playerId);
 * }
 * ```
 */
export function isPlayerPosition(pos: CardPosition): pos is CardPosition & { playerId: string } {
  return pos.playerId !== undefined;
}

/**
 * @summary Type guard to check if a position is a center position.
 *
 * @param pos The position to check
 * @returns True if this is a center position
 *
 * @example
 * ```typescript
 * if (isCenterPosition(pos)) {
 *   console.log('Center index:', pos.centerIndex);
 * }
 * ```
 */
export function isCenterPosition(pos: CardPosition): pos is CardPosition & { centerIndex: number } {
  return pos.centerIndex !== undefined;
}
