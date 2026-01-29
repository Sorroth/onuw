/**
 * @fileoverview Repository interfaces for database access abstraction.
 * @module database/repositories/interfaces
 *
 * @summary Defines contracts for all repository implementations.
 *
 * @description
 * Following the project's established patterns (IClientConnection, INightAction),
 * these interfaces enable:
 * - Programming to interfaces, not implementations
 * - Easy mocking for unit tests
 * - Potential for multiple implementations (e.g., in-memory for testing)
 * - Dependency Inversion Principle compliance
 *
 * @pattern Adapter Pattern - Different storage backends implement same interface
 * @pattern Repository Pattern - Abstract data access behind domain-focused interface
 */

import {
  UserDto,
  SessionDto,
  GameDto,
  GamePlayerDto,
  NightActionDto,
  StatementDto,
  VoteDto,
  PlayerStatsDto,
  LeaderboardEntryDto,
  DbGamePlayer,
  DbGame,
  GameSummaryDto
} from '../types';

/**
 * Parameters for creating a new user.
 */
export interface CreateUserParams {
  email: string;
  passwordHash?: string;
  displayName: string;
}

/**
 * Parameters for linking OAuth provider.
 */
export interface OAuthLinkParams {
  userId: string;
  providerCode: string;
  externalId: string;
  accessToken?: string;
  refreshToken?: string;
  tokenExpiresAt?: Date;
}

/**
 * Parameters for creating a session.
 */
export interface CreateSessionParams {
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Session data for active sessions.
 * Note: This is the session data only, not joined with user.
 */
export interface SessionWithUser {
  sessionId: string;
  userId: string;
  expiresAt: Date;
  createdAt: Date;
  isRevoked: boolean;
}

/**
 * Parameters for creating a new game.
 */
export interface CreateGameParams {
  hostUserId: string;
  roomCode: string;
  playerCount: number;
  selectedRoles: string[];
  dayDurationSeconds?: number;
  voteDurationSeconds?: number;
  isPrivate?: boolean;
  allowSpectators?: boolean;
}

/**
 * Parameters for adding a player to a game.
 */
/**
 * Parameters for adding a player to a game.
 *
 * @description
 * Supports both human players (with userId) and AI players (without userId).
 * Normal form compliance: is_ai determines whether user_id is required.
 */
export interface AddPlayerParams {
  gameId: string;
  /** Database user ID - required for human players, null for AI */
  userId?: string;
  /** Whether this is an AI player */
  isAI: boolean;
  seatPosition: number;
  startingRole: string;
}

/**
 * Parameters for saving a night action (6NF compliant).
 *
 * @description
 * Night action details are decomposed into separate arrays for 6NF compliance.
 * Each array element will be stored as a separate row in the corresponding table.
 */
export interface SaveNightActionParams {
  gameId: string;
  actorPlayerId: string;
  performedAsRole: string;
  actionType: string;
  sequenceOrder: number;
  isDoppelgangerAction?: boolean;
  /** Targets of the action (6NF: stored in night_action_targets) */
  targets?: NightActionTarget[];
  /** Roles viewed during action (6NF: stored in night_action_views) */
  views?: NightActionView[];
  /** Swap operation details (6NF: stored in night_action_swaps) */
  swap?: NightActionSwap;
  /** Doppelganger copy details (6NF: stored in night_action_copies) */
  copy?: NightActionCopy;
  /** Teammate player IDs seen (6NF: stored in night_action_teammates) */
  teammates?: string[];
}

/**
 * Night action target (6NF).
 *
 * @description
 * Represents a single target of a night action.
 */
export interface NightActionTarget {
  targetType: 'player' | 'center' | 'self';
  targetPlayerId?: string;
  targetCenterPosition?: number;
  targetOrder: number;
}

/**
 * Night action view (6NF).
 *
 * @description
 * Represents a role viewed during a night action.
 */
export interface NightActionView {
  viewSourceType: 'player' | 'center' | 'self';
  sourcePlayerId?: string;
  sourceCenterPosition?: number;
  viewedRole: string;
  viewOrder: number;
}

/**
 * Night action swap (6NF).
 *
 * @description
 * Represents a swap operation during a night action.
 */
export interface NightActionSwap {
  fromType: 'player' | 'center';
  fromPlayerId?: string;
  fromCenterPosition?: number;
  toType: 'player' | 'center';
  toPlayerId?: string;
  toCenterPosition?: number;
}

/**
 * Night action copy (6NF).
 *
 * @description
 * Represents a Doppelganger copy operation.
 */
export interface NightActionCopy {
  copiedFromPlayerId: string;
  copiedRole: string;
}

/**
 * Parameters for saving a statement.
 */
export interface SaveStatementParams {
  gameId: string;
  speakerPlayerId: string;
  text: string;
  type?: string;
  sequenceOrder: number;
}

/**
 * Parameters for saving a vote.
 */
export interface SaveVoteParams {
  gameId: string;
  voterPlayerId: string;
  targetPlayerId: string | null;
  isFinal?: boolean;
}

/**
 * Parameters for saving game results.
 */
export interface SaveGameResultParams {
  gameId: string;
  winningTeam: string | null;
  playerResults: Array<{
    playerId: string;
    /** Database user ID - undefined for AI players */
    userId?: string;
    /** Whether this is an AI player */
    isAI: boolean;
    finalTeam: string;
    isWinner: boolean;
    isEliminated: boolean;
    votesReceived: number;
    voteCastFor: string | null;
  }>;
  winConditions: Array<{
    team: string;
    won: boolean;
    reason: string;
  }>;
}

/**
 * @summary Interface for user data access.
 *
 * @description
 * Provides user management operations including CRUD,
 * OAuth linking, and profile management.
 *
 * @pattern Repository Pattern - Domain-focused data access
 * @pattern Adapter Pattern - Can be implemented by different storage backends
 *
 * @example
 * ```typescript
 * // Use interface for dependency injection
 * class AuthService {
 *   constructor(private userRepo: IUserRepository) {}
 *
 *   async login(email: string, password: string) {
 *     const user = await this.userRepo.findByEmail(email);
 *     // ...
 *   }
 * }
 * ```
 */
export interface IUserRepository {
  /**
   * Creates a new user.
   * @param params - User creation parameters
   * @returns The created user (without password hash)
   */
  createUser(params: CreateUserParams): Promise<UserDto>;

  /**
   * Finds a user by ID.
   * @param userId - User's unique identifier
   * @returns User or null if not found
   */
  findById(userId: string): Promise<UserDto | null>;

  /**
   * Finds a user by email address.
   * @param email - User's email (case-insensitive)
   * @returns User with password hash or null if not found
   */
  findByEmail(email: string): Promise<(UserDto & { passwordHash: string | null }) | null>;

  /**
   * Finds a user by OAuth provider link.
   * @param providerCode - OAuth provider code (google, discord, etc.)
   * @param externalId - User's ID from the provider
   * @returns User or null if not found
   */
  findByOAuth(providerCode: string, externalId: string): Promise<UserDto | null>;

  /**
   * Checks if an email is already registered.
   * @param email - Email to check
   * @returns True if email exists
   */
  emailExists(email: string): Promise<boolean>;

  /**
   * Links an OAuth provider to a user account.
   * @param params - OAuth link parameters
   */
  linkOAuth(params: OAuthLinkParams): Promise<void>;

  /**
   * Updates a user's profile.
   * @param userId - User's ID
   * @param updates - Fields to update
   */
  updateProfile(userId: string, updates: { displayName?: string; avatarUrl?: string }): Promise<void>;

  /**
   * Updates a user's password hash.
   * @param userId - User's ID
   * @param passwordHash - New bcrypt hash
   */
  updatePassword(userId: string, passwordHash: string): Promise<void>;

  /**
   * Marks a user's email as verified.
   * @param userId - User's ID
   */
  verifyEmail(userId: string): Promise<void>;
}

/**
 * @summary Interface for session data access.
 *
 * @description
 * Provides session management operations for authentication.
 *
 * @pattern Repository Pattern - Domain-focused data access
 */
export interface ISessionRepository {
  /**
   * Creates a new session.
   * @param params - Session creation parameters
   * @returns The session ID
   */
  createSession(params: CreateSessionParams): Promise<string>;

  /**
   * Finds a session by token hash.
   * @param tokenHash - SHA-256 hash of the session token
   * @returns Session with user data or null
   */
  findByToken(tokenHash: string): Promise<SessionWithUser | null>;

  /**
   * Validates a session is still active and returns user ID.
   * @param tokenHash - SHA-256 hash of the session token
   * @returns User ID if session is valid, null otherwise
   */
  validateSession(tokenHash: string): Promise<string | null>;

  /**
   * Validates a session by session ID and returns user ID.
   * @param sessionId - Session's unique identifier
   * @returns User ID if session is valid, null otherwise
   */
  validateSessionById(sessionId: string): Promise<string | null>;

  /**
   * Revokes (invalidates) a session.
   * @param sessionId - Session's unique identifier
   */
  revokeSession(sessionId: string): Promise<void>;

  /**
   * Revokes all sessions for a user.
   * @param userId - User's ID
   * @param exceptSessionId - Optional session to keep active
   */
  revokeAllUserSessions(userId: string, exceptSessionId?: string): Promise<void>;

  /**
   * Gets all active sessions for a user.
   * @param userId - User's ID
   * @returns List of active sessions
   */
  getActiveSessions(userId: string): Promise<SessionWithUser[]>;

  /**
   * Cleans up expired sessions.
   * @returns Number of sessions deleted
   */
  cleanupExpired(): Promise<number>;
}

/**
 * @summary Interface for game data access.
 *
 * @description
 * Provides game management operations including creation,
 * player management, and state updates.
 *
 * @pattern Repository Pattern - Domain-focused data access
 */
export interface IGameRepository {
  /**
   * Creates a new game.
   * @param params - Game creation parameters
   * @returns The game ID
   */
  createGame(params: CreateGameParams): Promise<string>;

  /**
   * Finds a game by ID.
   * @param gameId - Game's unique identifier
   * @returns Database game record or null if not found
   */
  findById(gameId: string): Promise<DbGame | null>;

  /**
   * Finds a game by room code.
   * @param roomCode - Game's room code
   * @returns Database game record or null if not found
   */
  findByRoomCode(roomCode: string): Promise<DbGame | null>;

  /**
   * Adds a player to a game.
   * @param params - Player addition parameters
   * @returns The player ID
   */
  addPlayer(params: AddPlayerParams): Promise<string>;

  /**
   * Sets center cards for a game.
   * @param gameId - Game's ID
   * @param roles - Array of role codes for positions 0, 1, 2
   */
  setCenterCards(gameId: string, roles: string[]): Promise<void>;

  /**
   * Updates a player's final role.
   * @param playerId - Game player's ID
   * @param finalRole - Role code after night phase
   */
  updateFinalRole(playerId: string, finalRole: string): Promise<void>;

  /**
   * Updates a center card's final role.
   * @param gameId - Game's ID
   * @param position - Center position (0-2)
   * @param finalRole - Role code after night phase
   */
  updateCenterCardRole(gameId: string, position: number, finalRole: string): Promise<void>;

  /**
   * Updates game status.
   * @param gameId - Game's ID
   * @param status - New status code
   */
  updateStatus(gameId: string, status: string): Promise<void>;

  /**
   * Gets all players in a game.
   * @param gameId - Game's ID
   * @returns List of game players (database records)
   */
  getPlayers(gameId: string): Promise<DbGamePlayer[]>;

  /**
   * Gets recent games for a user.
   * @param userId - User's ID
   * @param limit - Maximum number of games
   * @returns List of recent games
   */
  getRecentGames(userId: string, limit?: number): Promise<GameSummaryDto[]>;
}

/**
 * @summary Interface for replay data access.
 *
 * @description
 * Provides operations for saving and retrieving complete
 * game history for replay functionality.
 *
 * @pattern Repository Pattern - Domain-focused data access
 */
export interface IReplayRepository {
  /**
   * Saves a night action.
   * @param params - Night action parameters
   * @returns Action ID
   */
  saveNightAction(params: SaveNightActionParams): Promise<string>;

  /**
   * Saves a day phase statement.
   * @param params - Statement parameters
   * @returns Statement ID
   */
  saveStatement(params: SaveStatementParams): Promise<string>;

  /**
   * Saves a vote.
   * @param params - Vote parameters
   * @returns Vote ID
   */
  saveVote(params: SaveVoteParams): Promise<string>;

  /**
   * Gets all night actions for a game.
   * @param gameId - Game's ID
   * @returns List of night actions in order
   */
  getNightActions(gameId: string): Promise<NightActionDto[]>;

  /**
   * Gets all statements for a game.
   * @param gameId - Game's ID
   * @returns List of statements in order
   */
  getStatements(gameId: string): Promise<StatementDto[]>;

  /**
   * Gets all votes for a game.
   * @param gameId - Game's ID
   * @param finalOnly - Only return final votes (default true)
   * @returns List of votes
   */
  getVotes(gameId: string, finalOnly?: boolean): Promise<VoteDto[]>;

  /**
   * Gets complete game replay data.
   * @param gameId - Game's ID
   * @returns Full replay with all events
   */
  getFullReplay(gameId: string): Promise<{
    nightActions: NightActionDto[];
    statements: StatementDto[];
    votes: VoteDto[];
  }>;
}

/**
 * @summary Interface for statistics data access.
 *
 * @description
 * Provides operations for saving and retrieving player
 * statistics and leaderboard data.
 *
 * @pattern Repository Pattern - Domain-focused data access
 */
export interface IStatisticsRepository {
  /**
   * Saves game results and updates player statistics.
   * @param params - Game result parameters
   */
  saveGameResult(params: SaveGameResultParams): Promise<void>;

  /**
   * Gets statistics for a player.
   * @param userId - User's ID
   * @returns Player statistics or null if not found
   */
  getPlayerStats(userId: string): Promise<PlayerStatsDto | null>;

  /**
   * Gets the leaderboard.
   * @param limit - Maximum entries to return (default 100)
   * @param offset - Number of entries to skip (default 0)
   * @returns Leaderboard entries sorted by wins
   */
  getLeaderboard(limit?: number, offset?: number): Promise<LeaderboardEntryDto[]>;

  /**
   * Gets global statistics.
   * @returns Global game statistics
   */
  getGlobalStats(): Promise<{
    totalGames: number;
    totalPlayers: number;
    averageGameDuration: number | null;
    mostPlayedRole: string | null;
    teamWinRates: Record<string, number>;
  }>;
}
