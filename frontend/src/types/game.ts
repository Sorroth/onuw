/**
 * @fileoverview Game types for ONUW frontend.
 * @description Shared types mirroring the server protocol for type-safe communication.
 */

// ============================================================================
// ENUMS
// ============================================================================

export enum GamePhase {
  SETUP = 'SETUP',
  NIGHT = 'NIGHT',
  DAY = 'DAY',
  VOTING = 'VOTING',
  RESOLUTION = 'RESOLUTION'
}

export enum Team {
  VILLAGE = 'VILLAGE',
  WEREWOLF = 'WEREWOLF',
  TANNER = 'TANNER'
}

export enum RoleName {
  DOPPELGANGER = 'DOPPELGANGER',
  WEREWOLF = 'WEREWOLF',
  MINION = 'MINION',
  MASON = 'MASON',
  SEER = 'SEER',
  ROBBER = 'ROBBER',
  TROUBLEMAKER = 'TROUBLEMAKER',
  DRUNK = 'DRUNK',
  INSOMNIAC = 'INSOMNIAC',
  VILLAGER = 'VILLAGER',
  HUNTER = 'HUNTER',
  TANNER = 'TANNER'
}

// ============================================================================
// ROOM TYPES
// ============================================================================

export type TimeoutStrategyType = 'casual' | 'competitive' | 'tournament';

export interface RoomConfig {
  readonly minPlayers: number;
  readonly maxPlayers: number;
  readonly roles: readonly RoleName[];
  readonly timeoutStrategy: TimeoutStrategyType;
  readonly isPrivate: boolean;
  readonly allowSpectators: boolean;
  readonly roomName?: string;
}

export interface RoomPlayer {
  readonly id: string;
  readonly name: string;
  readonly isReady: boolean;
  readonly isHost: boolean;
  readonly isConnected: boolean;
  readonly isAI: boolean;
}

export interface RoomState {
  readonly roomCode: string;
  readonly hostId: string;
  readonly config: RoomConfig;
  readonly players: readonly RoomPlayer[];
  readonly status: 'waiting' | 'starting' | 'inProgress' | 'playing' | 'ended';
  readonly gameId?: string;
  readonly createdAt: number;
}

/**
 * Public room info for room browser.
 * Contains only non-sensitive room information for display.
 */
export interface PublicRoomInfo {
  readonly roomCode: string;
  readonly hostName: string;
  readonly playerCount: number;
  readonly maxPlayers: number;
  readonly roles: readonly RoleName[];
}

// ============================================================================
// PLAYER VIEW TYPES
// ============================================================================

export interface PublicPlayerInfo {
  readonly id: string;
  readonly name: string;
  readonly isConnected: boolean;
  readonly isAI: boolean;
  readonly hasSpoken: boolean;
  readonly hasVoted: boolean;
}

export interface PlayerStatement {
  readonly playerId: string;
  readonly statement: string;
  readonly timestamp: number;
}

export interface ViewedCard {
  readonly playerId?: string;
  readonly centerIndex?: number;
  readonly role: RoleName;
}

export interface SwapInfo {
  readonly from: { playerId?: string; centerIndex?: number };
  readonly to: { playerId?: string; centerIndex?: number };
}

export interface NightActionInfo {
  viewed?: readonly ViewedCard[];
  swapped?: SwapInfo;
  copied?: { readonly fromPlayerId: string; readonly role: RoleName };
  werewolves?: readonly string[];
  masons?: readonly string[];
}

export interface NightActionResult {
  readonly actorId: string;
  readonly roleName: RoleName;
  readonly actionType: 'VIEW' | 'SWAP' | 'NONE';
  readonly success: boolean;
  readonly info: NightActionInfo;
  readonly error?: string;
}

/**
 * Debug information for admin testing.
 */
export interface DebugInfo {
  /** All players' starting roles (before any swaps) */
  readonly allPlayerRoles?: Record<string, RoleName>;
  /** Center cards (positions 0, 1, 2) */
  readonly centerCards?: readonly RoleName[];
}

export interface SerializablePlayerGameView {
  readonly myPlayerId: string;
  readonly gameId: string;
  readonly phase: GamePhase;
  readonly myStartingRole: RoleName;
  readonly myNightInfo: readonly NightActionResult[];
  readonly players: readonly PublicPlayerInfo[];
  readonly statements: readonly PlayerStatement[];
  readonly votes: Record<string, string> | null;
  readonly eliminatedPlayers: readonly string[] | null;
  readonly finalRoles: Record<string, RoleName> | null;
  readonly winningTeams: readonly Team[] | null;
  readonly winningPlayers: readonly string[] | null;
  readonly timeRemaining: number | null;
  readonly isEliminated?: boolean;
  /** Debug information (only for admin players with debug mode enabled) */
  readonly debugInfo?: DebugInfo;
}

// ============================================================================
// GAME RESULT TYPES
// ============================================================================

export interface SerializableGameResult {
  readonly winningTeams: readonly Team[];
  readonly winningPlayers: readonly string[];
  readonly eliminatedPlayers: readonly string[];
  readonly finalRoles: Record<string, RoleName>;
  readonly votes: Record<string, string>;
}

export interface NightActionSummary {
  readonly playerId: string;
  readonly playerName: string;
  readonly roleName: RoleName;
  readonly description: string;
}

export interface SummaryStatement {
  readonly playerId: string;
  readonly playerName: string;
  readonly statement: string;
  readonly timestamp: number;
}

export interface GameSummary {
  readonly nightActions: readonly NightActionSummary[];
  readonly statements: readonly SummaryStatement[];
  readonly votes: Record<string, string>;
  readonly startingRoles: Record<string, RoleName>;
}

// ============================================================================
// ROLE METADATA
// ============================================================================

export interface RoleMetadata {
  readonly name: RoleName;
  readonly displayName: string;
  readonly team: Team;
  readonly description: string;
  readonly nightActionDescription?: string;
}

export const ROLE_METADATA: Record<RoleName, RoleMetadata> = {
  [RoleName.DOPPELGANGER]: {
    name: RoleName.DOPPELGANGER,
    displayName: 'Doppelganger',
    team: Team.VILLAGE,
    description: 'Copies another player\'s role and becomes that role.',
    nightActionDescription: 'Look at another player\'s card. You become that role.'
  },
  [RoleName.WEREWOLF]: {
    name: RoleName.WEREWOLF,
    displayName: 'Werewolf',
    team: Team.WEREWOLF,
    description: 'Sees other werewolves. If alone, may view one center card.',
    nightActionDescription: 'See other werewolves. If alone, view one center card.'
  },
  [RoleName.MINION]: {
    name: RoleName.MINION,
    displayName: 'Minion',
    team: Team.WEREWOLF,
    description: 'Sees werewolves, but they don\'t see the minion.',
    nightActionDescription: 'See the werewolves. They don\'t know who you are.'
  },
  [RoleName.MASON]: {
    name: RoleName.MASON,
    displayName: 'Mason',
    team: Team.VILLAGE,
    description: 'Sees other masons.',
    nightActionDescription: 'See the other mason(s).'
  },
  [RoleName.SEER]: {
    name: RoleName.SEER,
    displayName: 'Seer',
    team: Team.VILLAGE,
    description: 'Views one player\'s card OR two center cards.',
    nightActionDescription: 'Look at one player\'s card, or two center cards.'
  },
  [RoleName.ROBBER]: {
    name: RoleName.ROBBER,
    displayName: 'Robber',
    team: Team.VILLAGE,
    description: 'Swaps card with another player and sees new card.',
    nightActionDescription: 'Swap your card with another player and view your new role.'
  },
  [RoleName.TROUBLEMAKER]: {
    name: RoleName.TROUBLEMAKER,
    displayName: 'Troublemaker',
    team: Team.VILLAGE,
    description: 'Swaps two other players\' cards without looking.',
    nightActionDescription: 'Swap two other players\' cards. You don\'t see what they are.'
  },
  [RoleName.DRUNK]: {
    name: RoleName.DRUNK,
    displayName: 'Drunk',
    team: Team.VILLAGE,
    description: 'Swaps card with center card without looking.',
    nightActionDescription: 'Swap your card with a center card. You don\'t know what you got.'
  },
  [RoleName.INSOMNIAC]: {
    name: RoleName.INSOMNIAC,
    displayName: 'Insomniac',
    team: Team.VILLAGE,
    description: 'Looks at own card at end of night.',
    nightActionDescription: 'Look at your card at the end of the night to see if it changed.'
  },
  [RoleName.VILLAGER]: {
    name: RoleName.VILLAGER,
    displayName: 'Villager',
    team: Team.VILLAGE,
    description: 'No special ability.'
  },
  [RoleName.HUNTER]: {
    name: RoleName.HUNTER,
    displayName: 'Hunter',
    team: Team.VILLAGE,
    description: 'If killed, their vote target also dies.'
  },
  [RoleName.TANNER]: {
    name: RoleName.TANNER,
    displayName: 'Tanner',
    team: Team.TANNER,
    description: 'Wins only if they die. Werewolves cannot win if Tanner dies.'
  }
};

export const TEAM_COLORS: Record<Team, string> = {
  [Team.VILLAGE]: 'text-blue-500',
  [Team.WEREWOLF]: 'text-red-500',
  [Team.TANNER]: 'text-amber-700'
};

export const TEAM_BG_COLORS: Record<Team, string> = {
  [Team.VILLAGE]: 'bg-blue-500',
  [Team.WEREWOLF]: 'bg-red-500',
  [Team.TANNER]: 'bg-amber-700'
};

// ============================================================================
// ACTION REQUEST TYPES
// ============================================================================

export interface ActionRequestBase {
  readonly requestId: string;
  readonly timeoutMs: number;
  readonly timestamp: number;
}

export interface SelectPlayerRequest extends ActionRequestBase {
  readonly actionType: 'selectPlayer';
  readonly options: readonly string[];
  readonly reason: string;
}

export interface SelectCenterRequest extends ActionRequestBase {
  readonly actionType: 'selectCenter';
  readonly count: 1 | 2;
  readonly reason: string;
}

export interface SeerChoiceRequest extends ActionRequestBase {
  readonly actionType: 'seerChoice';
  readonly options: readonly ('player' | 'center')[];
}

export interface SelectTwoPlayersRequest extends ActionRequestBase {
  readonly actionType: 'selectTwoPlayers';
  readonly options: readonly string[];
  readonly reason: string;
}

export interface VoteRequest extends ActionRequestBase {
  readonly actionType: 'vote';
  readonly eligibleTargets: readonly string[];
  readonly allStatements: readonly PlayerStatement[];
}

export type ActionRequest =
  | SelectPlayerRequest
  | SelectCenterRequest
  | SeerChoiceRequest
  | SelectTwoPlayersRequest
  | VoteRequest;
