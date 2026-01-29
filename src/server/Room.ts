/**
 * @fileoverview Game room management for multiplayer lobby.
 * @module server/Room
 *
 * @summary Manages game rooms where players gather before games.
 *
 * @description
 * Room represents a game session from creation through completion:
 * - Players join with room codes
 * - Host configures game settings
 * - Game starts when all players are ready
 * - Room tracks game state and results
 *
 * @pattern Observer Pattern - Room state changes notify listeners
 * @pattern State Pattern - Room has distinct states (waiting, playing, ended)
 *
 * @example
 * ```typescript
 * const room = new Room('host-1', config);
 * room.addPlayer('player-2', connection2);
 * room.setPlayerReady('player-2', true);
 *
 * if (room.canStart()) {
 *   await room.startGame();
 * }
 * ```
 */

import { IClientConnection } from '../network/IClientConnection';
import {
  RoomCode,
  RoomConfig,
  RoomState,
  RoomPlayer,
  PlayerId,
  ServerMessage,
  SerializableGameResult,
  PublicPlayerInfo,
  GameSummary,
  NightActionSummary,
  DebugOptions,
  CardStateSnapshot,
  WinConditionResult,
  PlayerTeamAssignment
} from '../network/protocol';
import { RoleName, GamePhase, NIGHT_WAKE_ORDER, Team } from '../enums';
import { Game, IGameAgent } from '../core/Game';
import { GameConfig } from '../types';
import { RandomAgent } from '../agents/RandomAgent';
import { NetworkAgent } from './NetworkAgent';
import { ITimeoutStrategy, TimeoutStrategy, TimeoutStrategyFactory, CASUAL_STRATEGY } from './TimeoutStrategies';
import { PlayerView } from '../views/PlayerView';
import { getDatabase, getWriteQueue } from '../database';
import {
  IGameRepository,
  IReplayRepository,
  IStatisticsRepository,
  GameRepository,
  ReplayRepository,
  StatisticsRepository
} from '../database/repositories';

/**
 * @summary Room state enumeration.
 */
export enum RoomStatus {
  /** Waiting for players to join */
  WAITING = 'waiting',

  /** Game is in progress */
  PLAYING = 'playing',

  /** Game has ended */
  ENDED = 'ended',

  /** Room is closed */
  CLOSED = 'closed'
}

/**
 * @summary Player info within a room.
 */
export interface RoomPlayerInfo {
  /** Player ID */
  id: PlayerId;

  /** Display name */
  name: string;

  /** Network connection */
  connection: IClientConnection;

  /** Whether player is ready to start */
  isReady: boolean;

  /** Whether this is an AI player */
  isAI: boolean;

  /** When player joined */
  joinedAt: number;

  /**
   * Database user ID (UUID) for authenticated users.
   * Used to link game records to user accounts for statistics.
   * Optional for backwards compatibility with unauthenticated play.
   */
  userId?: string;
}

/**
 * @summary Room event types.
 */
export type RoomEventType =
  | 'playerJoined'
  | 'playerLeft'
  | 'playerReady'
  | 'configChanged'
  | 'gameStarted'
  | 'gameEnded'
  | 'roomClosed';

/**
 * @summary Room event data.
 */
export interface RoomEvent {
  type: RoomEventType;
  roomCode: RoomCode;
  data: Record<string, unknown>;
  timestamp: number;
}

/**
 * @summary Handler for room events.
 */
export type RoomEventHandler = (event: RoomEvent) => void;

/**
 * @summary Generates a random room code.
 *
 * @param {number} [length=6] - Code length
 *
 * @returns {RoomCode} Random room code
 */
export function generateRoomCode(length: number = 6): RoomCode {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Excluded confusing chars
  let code = '';
  for (let i = 0; i < length; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

/**
 * @summary Game room for multiplayer sessions.
 *
 * @description
 * Manages a single game session from lobby through completion.
 * Handles player management, game configuration, and state transitions.
 *
 * @pattern Observer Pattern - Notifies listeners of state changes
 * @pattern State Pattern - Distinct behavior for each room status
 *
 * @example
 * ```typescript
 * const room = new Room('host-1', {
 *   roles: [RoleName.WEREWOLF, RoleName.SEER, ...],
 *   minPlayers: 3,
 *   maxPlayers: 6
 * });
 *
 * room.onEvent((event) => {
 *   if (event.type === 'playerJoined') {
 *     broadcastRoomState(room);
 *   }
 * });
 *
 * const code = room.getCode();
 * // Share code with other players
 * ```
 */
export class Room {
  /** Unique room code for joining */
  private readonly code: RoomCode;

  /** Host player ID */
  private readonly hostId: PlayerId;

  /** Room configuration */
  private config: RoomConfig;

  /** Current room status */
  private status: RoomStatus = RoomStatus.WAITING;

  /** Players in the room */
  private readonly players: Map<PlayerId, RoomPlayerInfo> = new Map();

  /** Current game (if playing) */
  private game: Game | null = null;

  /** Event handlers */
  private readonly eventHandlers: Set<RoomEventHandler> = new Set();

  /** When room was created */
  private readonly createdAt: number;

  /** When game started (if applicable) */
  private gameStartedAt: number | null = null;

  /** Debug options for testing */
  private debugOptions: DebugOptions | null = null;

  /** Players who have signaled ready to vote */
  private playersReadyToVote: Set<PlayerId> = new Set();

  /** Database game ID (set when game starts if database is available) */
  private dbGameId: string | null = null;

  /** Database player IDs (maps room player ID to database player ID) */
  private dbPlayerIds: Map<PlayerId, string> = new Map();

  /** Sequence counter for night actions */
  private nightActionSequence: number = 0;

  /** Sequence counter for statements */
  private statementSequence: number = 0;

  /** When the current phase started (timestamp) */
  private phaseStartedAt: number | null = null;

  /** Duration of the current phase in milliseconds */
  private phaseDurationMs: number | null = null;

  /** Timeout strategy for phase durations */
  private readonly timeoutStrategy: ITimeoutStrategy;

  /** Day phase duration in milliseconds (from strategy) */
  private get dayDurationMs(): number {
    return this.timeoutStrategy.getTimeout('dayPhase');
  }

  /** Voting phase duration in milliseconds (from strategy) */
  private get votingDurationMs(): number {
    return this.timeoutStrategy.getTimeout('votingPhase');
  }

  /**
   * Repository instances.
   *
   * @pattern Dependency Inversion - Depend on interfaces, not implementations
   * @pattern Repository Pattern - Abstract data access behind domain-focused interface
   */
  private readonly gameRepository: IGameRepository;
  private readonly replayRepository: IReplayRepository;
  private readonly statisticsRepository: IStatisticsRepository;

  /**
   * @summary Creates a new game room.
   *
   * @description
   * Initializes a new room with the given configuration. Repositories can be
   * injected for testing, otherwise default implementations are used.
   *
   * @pattern Dependency Injection - Repositories can be injected for testability
   * @pattern Repository Pattern - Data access abstracted behind interfaces
   *
   * @param {PlayerId} hostId - ID of the host player
   * @param {RoomConfig} config - Room configuration
   * @param {RoomCode} [code] - Optional specific room code
   * @param {DebugOptions} [debugOptions] - Optional debug options for testing
   * @param {object} [repositories] - Optional repository implementations for testing
   * @param {IGameRepository} [repositories.gameRepository] - Game repository
   * @param {IReplayRepository} [repositories.replayRepository] - Replay repository
   * @param {IStatisticsRepository} [repositories.statisticsRepository] - Statistics repository
   *
   * @example
   * ```typescript
   * // Production usage
   * const room = new Room('host-1', config);
   *
   * // Testing with mock repositories
   * const room = new Room('host-1', config, undefined, undefined, {
   *   gameRepository: mockGameRepo,
   *   replayRepository: mockReplayRepo,
   *   statisticsRepository: mockStatsRepo
   * });
   * ```
   */
  constructor(
    hostId: PlayerId,
    config: RoomConfig,
    code?: RoomCode,
    debugOptions?: DebugOptions,
    repositories?: {
      gameRepository?: IGameRepository;
      replayRepository?: IReplayRepository;
      statisticsRepository?: IStatisticsRepository;
    }
  ) {
    this.hostId = hostId;
    this.config = { ...config };
    this.code = code ?? generateRoomCode();
    this.createdAt = Date.now();
    this.debugOptions = debugOptions || null;

    // Initialize timeout strategy (default: casual)
    // TODO: Allow strategy selection via config
    this.timeoutStrategy = TimeoutStrategyFactory.create('casual');

    // Initialize repositories (with dependency injection support for testing)
    this.gameRepository = repositories?.gameRepository ?? new GameRepository();
    this.replayRepository = repositories?.replayRepository ?? new ReplayRepository();
    this.statisticsRepository = repositories?.statisticsRepository ?? new StatisticsRepository();
  }

  /**
   * @summary Gets the room code.
   *
   * @returns {RoomCode} Room code for joining
   */
  getCode(): RoomCode {
    return this.code;
  }

  /**
   * @summary Gets the host player ID.
   *
   * @returns {PlayerId} Host ID
   */
  getHostId(): PlayerId {
    return this.hostId;
  }

  /**
   * @summary Gets the room status.
   *
   * @returns {RoomStatus} Current status
   */
  getStatus(): RoomStatus {
    return this.status;
  }

  /**
   * @summary Gets the room configuration.
   *
   * @returns {RoomConfig} Room config
   */
  getConfig(): RoomConfig {
    return { ...this.config };
  }

  /**
   * @summary Gets the current game (if playing).
   *
   * @returns {Game | null} Game instance or null
   */
  getGame(): Game | null {
    return this.game;
  }

  /**
   * @summary Gets the number of players in the room.
   *
   * @returns {number} Player count
   */
  getPlayerCount(): number {
    return this.players.size;
  }

  /**
   * @summary Checks if a player is in the room.
   *
   * @param {PlayerId} playerId - Player to check
   *
   * @returns {boolean} True if player is in room
   */
  hasPlayer(playerId: PlayerId): boolean {
    return this.players.has(playerId);
  }

  /**
   * @summary Gets all players in the room.
   *
   * @returns {RoomPlayerInfo[]} Array of player info
   */
  getPlayers(): RoomPlayerInfo[] {
    return Array.from(this.players.values());
  }

  /**
   * @summary Gets a specific player's info.
   *
   * @param {PlayerId} playerId - Player ID
   *
   * @returns {RoomPlayerInfo | undefined} Player info if found
   */
  getPlayer(playerId: PlayerId): RoomPlayerInfo | undefined {
    return this.players.get(playerId);
  }

  /**
   * @summary Updates the room configuration.
   *
   * @description
   * Only the host can update configuration, and only while waiting.
   *
   * @param {PlayerId} requesterId - ID of player making request
   * @param {Partial<RoomConfig>} updates - Configuration updates
   *
   * @throws {Error} If not host or room is not waiting
   */
  updateConfig(requesterId: PlayerId, updates: Partial<RoomConfig>): void {
    if (requesterId !== this.hostId) {
      throw new Error('Only the host can update room configuration');
    }

    if (this.status !== RoomStatus.WAITING) {
      throw new Error('Cannot update configuration after game has started');
    }

    this.config = { ...this.config, ...updates };

    this.emitEvent('configChanged', {
      config: this.config
    });
  }

  /**
   * @summary Adds a player to the room.
   *
   * @param {PlayerId} playerId - Player ID
   * @param {string} name - Player name
   * @param {IClientConnection} connection - Player connection
   * @param {boolean} [isAI=false] - Whether this is an AI player
   * @param {string} [userId] - Database user ID for authenticated players
   *
   * @throws {Error} If room is full or not accepting players
   */
  addPlayer(
    playerId: PlayerId,
    name: string,
    connection: IClientConnection,
    isAI: boolean = false,
    userId?: string
  ): void {
    if (this.status !== RoomStatus.WAITING) {
      throw new Error('Room is not accepting new players');
    }

    if (this.players.size >= this.config.maxPlayers) {
      throw new Error('Room is full');
    }

    if (this.players.has(playerId)) {
      throw new Error('Player is already in the room');
    }

    const playerInfo: RoomPlayerInfo = {
      id: playerId,
      name,
      connection,
      isReady: isAI, // AI players are always ready
      isAI,
      joinedAt: Date.now(),
      userId
    };

    this.players.set(playerId, playerInfo);

    this.emitEvent('playerJoined', {
      playerId,
      name,
      isAI
    });

    // Broadcast room state to all players
    this.broadcastRoomState();
  }

  /**
   * @summary Removes a player from the room.
   *
   * @param {PlayerId} playerId - Player to remove
   *
   * @throws {Error} If player is not in room
   */
  removePlayer(playerId: PlayerId): void {
    if (!this.players.has(playerId)) {
      throw new Error('Player is not in the room');
    }

    this.players.delete(playerId);

    this.emitEvent('playerLeft', {
      playerId
    });

    // If host left, close the room
    if (playerId === this.hostId && this.status === RoomStatus.WAITING) {
      this.close('Host left the room');
      return;
    }

    // Broadcast updated state
    this.broadcastRoomState();
  }

  /**
   * @summary Sets a player's ready status.
   *
   * @param {PlayerId} playerId - Player ID
   * @param {boolean} isReady - Ready status
   *
   * @throws {Error} If player not in room or room not waiting
   */
  setPlayerReady(playerId: PlayerId, isReady: boolean): void {
    const player = this.players.get(playerId);
    if (!player) {
      throw new Error('Player is not in the room');
    }

    if (this.status !== RoomStatus.WAITING) {
      throw new Error('Cannot change ready status after game has started');
    }

    player.isReady = isReady;

    this.emitEvent('playerReady', {
      playerId,
      isReady
    });

    this.broadcastRoomState();
  }

  /**
   * @summary Submits a statement during the day phase (real-time).
   *
   * @description
   * Players can submit statements at any time during the DAY phase.
   * The statement is added to the game and broadcast to all players.
   * Multiple statements from the same player are allowed.
   *
   * @param {PlayerId} playerId - Player submitting the statement
   * @param {string} statement - The statement text
   *
   * @throws {Error} If not in DAY phase or player not in game
   *
   * @pattern Observer - Statement is broadcast to all players
   */
  submitStatement(playerId: PlayerId, statement: string): void {
    if (this.status !== RoomStatus.PLAYING || !this.game) {
      throw new Error('Game is not in progress');
    }

    const currentPhase = this.game.getPhase();
    if (currentPhase !== GamePhase.DAY) {
      throw new Error('Can only submit statements during the DAY phase');
    }

    const player = this.players.get(playerId);
    if (!player) {
      throw new Error('Player is not in the room');
    }

    // Get the game player ID from the room player ID
    const gamePlayerId = this.roomToGamePlayerMap.get(playerId);
    if (!gamePlayerId) {
      throw new Error('Player not found in game');
    }

    // Add statement to the game
    this.game.addStatement(gamePlayerId, statement);

    // Broadcast to all players (Observer pattern)
    // Note: The game observer will handle broadcasting via the STATEMENT_MADE event
  }

  /**
   * @summary Marks a player as ready to move to voting phase.
   *
   * @description
   * During the DAY phase, players can signal they're ready to vote.
   * When all human players are ready, the game transitions to VOTING.
   * AI players are automatically considered ready.
   *
   * @param {PlayerId} playerId - Player signaling ready
   *
   * @throws {Error} If not in DAY phase or player not in game
   */
  setPlayerReadyToVote(playerId: PlayerId): void {
    if (this.status !== RoomStatus.PLAYING || !this.game) {
      throw new Error('Game is not in progress');
    }

    const currentPhase = this.game.getPhase();
    if (currentPhase !== GamePhase.DAY) {
      throw new Error('Can only signal ready to vote during the DAY phase');
    }

    const player = this.players.get(playerId);
    if (!player) {
      throw new Error('Player is not in the room');
    }

    // Mark player as ready to vote
    this.playersReadyToVote.add(playerId);

    // Count human players and ready players
    const humanPlayers = Array.from(this.players.values()).filter(p => !p.isAI);
    const readyCount = this.playersReadyToVote.size;
    const totalHumans = humanPlayers.length;

    // Broadcast ready status to all players
    const readyMessage: ServerMessage = {
      type: 'playerReadyToVote',
      playerId,
      playerName: player.name,
      readyCount,
      totalPlayers: totalHumans,
      timestamp: Date.now()
    };
    this.broadcast(readyMessage);

    // Check if all human players are ready
    const allHumansReady = humanPlayers.every(p => this.playersReadyToVote.has(p.id));

    if (allHumansReady) {
      // Signal the game to end the day phase and move to voting
      this.game.endDayPhase();
      // Reset ready-to-vote tracking for next game
      this.playersReadyToVote.clear();
    }
  }

  /**
   * @summary Checks if the game can be started.
   *
   * @returns {boolean} True if game can start
   */
  canStart(): boolean {
    if (this.status !== RoomStatus.WAITING) {
      return false;
    }

    // Check minimum players
    if (this.players.size < this.config.minPlayers) {
      return false;
    }

    // Check all players are ready
    for (const player of this.players.values()) {
      if (!player.isReady) {
        return false;
      }
    }

    // Check we have enough roles for players + center cards
    const requiredRoles = this.players.size + 3;
    if (this.config.roles.length < requiredRoles) {
      return false;
    }

    return true;
  }

  /**
   * @summary Gets the reason why the game cannot start.
   *
   * @returns {string | null} Reason or null if can start
   */
  getCannotStartReason(): string | null {
    if (this.status !== RoomStatus.WAITING) {
      return 'Game already started or room closed';
    }

    if (this.players.size < this.config.minPlayers) {
      return `Need at least ${this.config.minPlayers} players (have ${this.players.size})`;
    }

    const notReady = Array.from(this.players.values())
      .filter(p => !p.isReady)
      .map(p => p.name);

    if (notReady.length > 0) {
      return `Waiting for players: ${notReady.join(', ')}`;
    }

    const requiredRoles = this.players.size + 3;
    if (this.config.roles.length < requiredRoles) {
      return `Need ${requiredRoles} roles but only ${this.config.roles.length} configured`;
    }

    return null;
  }

  /**
   * @summary Starts the game.
   *
   * @param {PlayerId} requesterId - Player requesting game start
   *
   * @returns {Game} The started game instance
   *
   * @throws {Error} If game cannot start or requester is not host
   */
  /** Maps room player IDs to game player IDs */
  private roomToGamePlayerMap: Map<PlayerId, string> = new Map();

  /** Maps game player IDs to room player IDs */
  private gameToRoomPlayerMap: Map<string, PlayerId> = new Map();

  startGame(requesterId: PlayerId): Game {
    if (requesterId !== this.hostId) {
      throw new Error('Only the host can start the game');
    }

    if (!this.canStart()) {
      const reason = this.getCannotStartReason();
      throw new Error(reason || 'Cannot start game');
    }

    // Create player list and mapping
    const playerList = Array.from(this.players.values());
    this.roomToGamePlayerMap.clear();
    this.gameToRoomPlayerMap.clear();

    for (let i = 0; i < playerList.length; i++) {
      const roomId = playerList[i].id;
      const gameId = `player-${i + 1}`;
      this.roomToGamePlayerMap.set(roomId, gameId);
      this.gameToRoomPlayerMap.set(gameId, roomId);
    }

    // Build forced roles map if debug mode is enabled
    let forcedRoles: Map<number, RoleName> | undefined;
    if (this.debugOptions?.forceRole) {
      // Find the host player's index in the player list
      const hostIndex = playerList.findIndex(p => p.id === this.hostId);
      if (hostIndex !== -1) {
        forcedRoles = new Map();
        forcedRoles.set(hostIndex, this.debugOptions.forceRole);
        console.log(`Debug: Will force host (index ${hostIndex}) to have role ${this.debugOptions.forceRole}`);
      }
    }

    // Create game configuration
    const gameConfig: GameConfig = {
      players: playerList.map(p => p.name),
      roles: [...this.config.roles],
      forcedRoles
    };

    // Create and setup game
    this.game = new Game(gameConfig);

    this.status = RoomStatus.PLAYING;
    this.gameStartedAt = Date.now();

    // Save game to database (queued with retry)
    this.enqueueGameSave(playerList);

    this.emitEvent('gameStarted', {
      playerIds: playerList.map(p => p.id)
    });

    // Build public player list for all players
    const publicPlayers: PublicPlayerInfo[] = playerList.map(p => ({
      id: p.id,
      name: p.name,
      isConnected: p.connection.isConnected(),
      isAI: p.isAI,
      hasSpoken: false,
      hasVoted: false
    }));

    // Send each player their role info using PlayerView
    for (const roomPlayer of playerList) {
      const gamePlayerId = this.roomToGamePlayerMap.get(roomPlayer.id);
      if (gamePlayerId && this.game) {
        const startingRole = this.game.getPlayerStartingRole(gamePlayerId);

        // Use PlayerView factory to create sanitized game view
        const view = PlayerView.forGameStart(
          roomPlayer.id,
          this.code,
          startingRole,
          publicPlayers
        );

        // Build game-to-room ID mapping for client
        const playerIdMapping: Record<string, string> = {};
        for (const [gameId, roomId] of this.gameToRoomPlayerMap) {
          playerIdMapping[gameId] = roomId;
        }

        const message: ServerMessage = {
          type: 'gameStarted',
          view,
          playerIdMapping,
          timestamp: Date.now()
        };

        if (roomPlayer.connection.isConnected()) {
          roomPlayer.connection.send(message);
        }
      }
    }

    // Create agents for all players
    const agents: Map<string, IGameAgent> = new Map();

    // Determine forced vote target for bots if debug option is enabled
    let forcedVoteTarget: string | undefined;
    if (this.debugOptions?.forceBotsVoteForHost) {
      // Get the host's game player ID
      forcedVoteTarget = this.roomToGamePlayerMap.get(this.hostId);
      if (forcedVoteTarget) {
        console.log(`Debug: Bots will vote for host (game ID: ${forcedVoteTarget})`);
      }
    }

    for (const roomPlayer of playerList) {
      const gamePlayerId = this.roomToGamePlayerMap.get(roomPlayer.id);
      if (gamePlayerId) {
        if (roomPlayer.isAI) {
          // AI player - use RandomAgent (with optional forced vote target)
          console.log(`Creating RandomAgent for AI player ${gamePlayerId}${forcedVoteTarget ? ' (forced vote: ' + forcedVoteTarget + ')' : ''}`);
          agents.set(gamePlayerId, new RandomAgent(gamePlayerId, forcedVoteTarget));
        } else {
          // Human player - use NetworkAgent
          console.log(`Creating NetworkAgent for human player ${gamePlayerId} (room: ${roomPlayer.id})`);
          agents.set(gamePlayerId, new NetworkAgent(gamePlayerId, roomPlayer.connection));
        }
      }
    }

    // Register agents and run game asynchronously
    console.log(`Registering ${agents.size} agents and starting game...`);
    this.game.registerAgents(agents);

    // Subscribe to game events to broadcast to all players and save to database
    this.game.addObserver({
      onEvent: (event: { type: string; data?: Record<string, unknown> }) => {
        if (event.type === 'STATEMENT_MADE' && event.data) {
          const gamePlayerId = event.data.playerId as string;
          const statement = event.data.statement as string;
          if (gamePlayerId && statement) {
            // Map game ID to room ID and get player name
            const roomPlayerId = this.gameToRoomPlayerMap.get(gamePlayerId) || gamePlayerId;
            const player = this.players.get(roomPlayerId);
            const playerName = player?.name || roomPlayerId;

            // Save statement to database (queued with retry)
            this.enqueueStatementSave(gamePlayerId, statement);

            // Broadcast statement to all players
            this.broadcast({
              type: 'statementMade',
              playerId: roomPlayerId,
              playerName,
              statement,
              timestamp: Date.now()
            });
          }
        } else if (event.type === 'PHASE_CHANGED' && event.data) {
          // Broadcast phase change to all players
          const toPhase = event.data.to as GamePhase;
          console.log(`DEBUG PHASE_CHANGED: toPhase="${toPhase}", GamePhase.DAY="${GamePhase.DAY}", match=${toPhase === GamePhase.DAY}, dayDurationMs=${this.dayDurationMs}`);

          // Set phase timing based on phase type
          this.phaseStartedAt = Date.now();
          if (toPhase === GamePhase.DAY) {
            this.phaseDurationMs = this.dayDurationMs;
          } else if (toPhase === GamePhase.VOTING) {
            this.phaseDurationMs = this.votingDurationMs;
          } else {
            // Night and Resolution phases have no time limit
            this.phaseDurationMs = null;
          }

          // Update game status in database (queued with retry)
          if (this.dbGameId) {
            const statusMap: Record<string, string> = {
              [GamePhase.NIGHT]: 'night',
              [GamePhase.DAY]: 'day',
              [GamePhase.VOTING]: 'voting'
            };
            const dbStatus = statusMap[toPhase];
            if (dbStatus) {
              this.enqueueStatusUpdate(dbStatus);
            }
          }

          const timeRemaining = this.getTimeRemaining();
          console.log(`Phase change to ${toPhase}: timeRemaining=${timeRemaining}, phaseStartedAt=${this.phaseStartedAt}, phaseDurationMs=${this.phaseDurationMs}`);

          this.broadcast({
            type: 'phaseChange',
            phase: toPhase,
            timeRemaining,
            timestamp: Date.now()
          });
        } else if (event.type === 'NIGHT_ACTION_EXECUTED' && event.data) {
          // Save night action to database (non-blocking)
          const actorId = event.data.actorId as string;
          const roleName = event.data.roleName as string;
          const actionType = event.data.actionType as string;
          const details = event.data.details as Record<string, unknown>;

          this.enqueueNightActionSave(actorId, roleName as RoleName, actionType, details);
        }
      }
    });

    this.runGameAsync(playerList);

    return this.game;
  }

  /**
   * Runs the game asynchronously and handles completion.
   */
  private async runGameAsync(playerList: RoomPlayerInfo[]): Promise<void> {
    if (!this.game) return;

    console.log('runGameAsync starting...');
    try {
      console.log('Calling game.run()...');
      const result = await this.game.run();
      console.log('game.run() completed with result:', result.winningTeams);

      // Convert maps to records for JSON serialization
      const finalRolesRecord: Record<string, RoleName> = {};
      for (const [gameId, role] of result.finalRoles) {
        const roomId = this.gameToRoomPlayerMap.get(gameId) || gameId;
        finalRolesRecord[roomId] = role;
      }

      const votesRecord: Record<string, string> = {};
      for (const [voterId, targetId] of result.votes) {
        const roomVoterId = this.gameToRoomPlayerMap.get(voterId) || voterId;
        const roomTargetId = this.gameToRoomPlayerMap.get(targetId) || targetId;
        votesRecord[roomVoterId] = roomTargetId;
      }

      // Map winning/eliminated players to room IDs
      const winningPlayers = result.winningPlayers.map(
        gameId => this.gameToRoomPlayerMap.get(gameId) || gameId
      );
      const eliminatedPlayers = result.eliminatedPlayers.map(
        gameId => this.gameToRoomPlayerMap.get(gameId) || gameId
      );

      // Build game summary for post-game review
      const gameSummary = this.buildGameSummary(playerList, votesRecord);

      // Game completed - send results to all players
      // Create serializable result (Maps -> Records for JSON)
      const serializableResult: SerializableGameResult = {
        winningTeams: [...result.winningTeams],
        winningPlayers,
        eliminatedPlayers,
        finalRoles: finalRolesRecord,
        votes: votesRecord
      };

      // Save votes to database (queued with retry)
      for (const [voterId, targetId] of result.votes) {
        this.enqueueVoteSave(voterId, targetId);
      }

      // Save game results to database (queued with retry)
      this.enqueueGameResultsSave(serializableResult, playerList);

      // Get final center cards
      const centerCards = this.game.getCenterCards();

      for (const roomPlayer of playerList) {
        if (roomPlayer.connection.isConnected()) {
          const message: ServerMessage = {
            type: 'gameEnd',
            result: serializableResult,
            finalRoles: finalRolesRecord,
            centerCards,
            summary: gameSummary,
            timestamp: Date.now()
          };
          roomPlayer.connection.send(message);
        }
      }

      this.status = RoomStatus.ENDED;
      this.emitEvent('gameEnded', { result });
    } catch (error) {
      console.error('Game error:', error);
      // Notify players of error
      for (const roomPlayer of playerList) {
        if (roomPlayer.connection.isConnected()) {
          const message: ServerMessage = {
            type: 'error',
            code: 'GAME_ERROR',
            message: error instanceof Error ? error.message : 'Game error',
            timestamp: Date.now()
          };
          roomPlayer.connection.send(message);
        }
      }
    }
  }

  /**
   * @summary Builds a game summary for post-game review.
   *
   * @description
   * Creates a detailed summary of all game events including:
   * - Night actions with human-readable descriptions
   * - Day phase statements
   * - Vote summary with player names
   * - Starting role assignments
   *
   * @param {RoomPlayerInfo[]} playerList - List of players in the game
   * @param {Record<string, string>} votesRecord - Votes mapped to room player IDs
   *
   * @returns {GameSummary} Complete game summary
   *
   * @private
   */
  private buildGameSummary(
    playerList: RoomPlayerInfo[],
    votesRecord: Record<string, string>
  ): GameSummary {
    if (!this.game) {
      return {
        nightActions: [],
        statements: [],
        votes: {},
        startingRoles: {}
      };
    }

    // Build player name lookup (room ID -> name)
    const playerNames = new Map<string, string>();
    for (const player of playerList) {
      playerNames.set(player.id, player.name);
    }

    // Get all night actions and create summaries
    const nightResults = this.game.getAllNightResults();
    const nightActions: NightActionSummary[] = nightResults.map(result => {
      const roomPlayerId = this.gameToRoomPlayerMap.get(result.actorId) || result.actorId;
      const playerName = playerNames.get(roomPlayerId) || roomPlayerId;

      return {
        playerId: roomPlayerId,
        playerName,
        roleName: result.roleName,
        description: this.describeNightAction(result, playerNames)
      };
    });

    // Sort night actions by wake order
    const wakeOrderMap = new Map<RoleName, number>();
    NIGHT_WAKE_ORDER.forEach((role, index) => wakeOrderMap.set(role, index));
    nightActions.sort((a, b) => {
      const orderA = wakeOrderMap.get(a.roleName as RoleName) ?? 999;
      const orderB = wakeOrderMap.get(b.roleName as RoleName) ?? 999;
      return orderA - orderB;
    });

    // Get statements and map player IDs to names
    const rawStatements = this.game.getStatements();
    const statements = rawStatements.map(stmt => {
      const roomPlayerId = this.gameToRoomPlayerMap.get(stmt.playerId) || stmt.playerId;
      const playerName = playerNames.get(roomPlayerId) || roomPlayerId;
      return {
        playerId: roomPlayerId,
        playerName,
        statement: stmt.statement,
        timestamp: stmt.timestamp
      };
    });

    // Build vote summary with names
    const votesByName: Record<string, string> = {};
    for (const [voterId, targetId] of Object.entries(votesRecord)) {
      const voterName = playerNames.get(voterId) || voterId;
      const targetName = playerNames.get(targetId) || targetId;
      votesByName[voterName] = targetName;
    }

    // Get starting roles
    const startingRolesMap = this.game.getStartingRoles();
    const startingRoles: Record<string, RoleName> = {};
    for (const [gameId, role] of startingRolesMap) {
      const roomId = this.gameToRoomPlayerMap.get(gameId) || gameId;
      startingRoles[roomId] = role;
    }

    // Build card state history for audit
    const cardStateHistory: CardStateSnapshot[] = this.game.getCardStateHistory().map(entry => {
      const snapshotObj = entry.snapshot.toObject();
      // Map game player IDs to room player IDs in playerCards
      const mappedPlayerCards: Record<PlayerId, RoleName> = {};
      for (const [gameId, role] of Object.entries(snapshotObj.playerCards)) {
        const roomId = this.gameToRoomPlayerMap.get(gameId) || gameId;
        mappedPlayerCards[roomId] = role as RoleName;
      }

      return {
        afterAction: entry.actionDescription,
        actorName: entry.actorName,
        actorRole: entry.actorRole,
        playerCards: mappedPlayerCards,
        centerCards: snapshotObj.centerCards as RoleName[]
      };
    });

    // Get win condition results
    const winConditionResults: WinConditionResult[] = this.game.getWinConditionResults().map(r => ({
      team: r.team.toString(),
      won: r.won,
      reason: r.reason
    }));

    // Get final team assignments
    const finalTeams: PlayerTeamAssignment[] = this.game.getFinalTeamAssignments().map(assignment => {
      const roomId = this.gameToRoomPlayerMap.get(assignment.playerId) || assignment.playerId;
      const playerName = playerNames.get(roomId) || roomId;
      return {
        playerId: roomId,
        playerName,
        finalRole: assignment.finalRole,
        team: assignment.team.toString(),
        isWinner: assignment.isWinner
      };
    });

    return {
      nightActions,
      statements,
      votes: votesByName,
      startingRoles,
      cardStateHistory,
      winConditionResults,
      finalTeams
    };
  }

  /**
   * @summary Creates a human-readable description of a night action.
   *
   * @param {NightActionResult} result - The night action result
   * @param {Map<string, string>} playerNames - Map of player IDs to names
   *
   * @returns {string} Human-readable description
   *
   * @private
   */
  private describeNightAction(
    result: { roleName: RoleName; actionType: string; info: unknown },
    playerNames: Map<string, string>
  ): string {
    const info = result.info as Record<string, unknown> || {};

    switch (result.roleName) {
      case RoleName.DOPPELGANGER: {
        const copied = info.copied as { fromPlayerId: string; role: string } | undefined;
        if (copied) {
          const roomId = this.gameToRoomPlayerMap.get(copied.fromPlayerId) || copied.fromPlayerId;
          const targetName = playerNames.get(roomId) || roomId;
          let description = `Looked at ${targetName}'s card and became ${copied.role}`;

          // Add details of the copied role's action
          const copiedRole = copied.role;
          const swapped = info.swapped as { from: { playerId?: string; centerIndex?: number }; to: { playerId?: string; centerIndex?: number } } | undefined;
          const viewed = info.viewed as Array<{ playerId?: string; centerIndex?: number; role: string }> | undefined;

          if (copiedRole === 'ROBBER' && swapped && viewed && viewed.length > 1) {
            const robbedRoomId = this.gameToRoomPlayerMap.get(swapped.to.playerId || '') || swapped.to.playerId;
            const robbedName = playerNames.get(robbedRoomId || '') || robbedRoomId;
            const newRole = viewed[1]?.role || 'unknown';
            description += `. Then robbed ${robbedName} and got ${newRole}`;
          } else if (copiedRole === 'SEER' && viewed && viewed.length > 1) {
            const seerViews = viewed.slice(1);
            if (seerViews[0]?.playerId) {
              const viewedRoomId = this.gameToRoomPlayerMap.get(seerViews[0].playerId) || seerViews[0].playerId;
              const viewedName = playerNames.get(viewedRoomId) || viewedRoomId;
              description += `. Then viewed ${viewedName}'s card: ${seerViews[0].role}`;
            } else if (seerViews.length >= 2) {
              const cards = seerViews.map(v => `Card ${(v.centerIndex || 0) + 1} = ${v.role}`).join(', ');
              description += `. Then viewed center: ${cards}`;
            }
          } else if (copiedRole === 'TROUBLEMAKER' && swapped) {
            const name1RoomId = this.gameToRoomPlayerMap.get(swapped.from.playerId || '') || swapped.from.playerId;
            const name2RoomId = this.gameToRoomPlayerMap.get(swapped.to.playerId || '') || swapped.to.playerId;
            const name1 = playerNames.get(name1RoomId || '') || name1RoomId;
            const name2 = playerNames.get(name2RoomId || '') || name2RoomId;
            description += `. Then swapped ${name1} and ${name2}'s cards`;
          } else if (copiedRole === 'DRUNK' && swapped && swapped.to.centerIndex !== undefined) {
            description += `. Then swapped with center card ${swapped.to.centerIndex + 1}`;
          } else if (copiedRole === 'WEREWOLF') {
            const werewolves = info.werewolves as string[] | undefined;
            if (werewolves && werewolves.length > 0) {
              const names = werewolves.map(id => {
                const wRoomId = this.gameToRoomPlayerMap.get(id) || id;
                return playerNames.get(wRoomId) || wRoomId;
              });
              description += `. Saw Werewolf(s): ${names.join(', ')}`;
            } else if (viewed && viewed.length > 1 && viewed[1].centerIndex !== undefined) {
              description += `. Lone wolf - peeked at center card ${viewed[1].centerIndex + 1}: ${viewed[1].role}`;
            }
          } else if (copiedRole === 'MINION') {
            const werewolves = info.werewolves as string[] | undefined;
            if (werewolves && werewolves.length > 0) {
              const names = werewolves.map(id => {
                const wRoomId = this.gameToRoomPlayerMap.get(id) || id;
                return playerNames.get(wRoomId) || wRoomId;
              });
              description += `. Saw Werewolf(s): ${names.join(', ')}`;
            } else {
              description += `. No Werewolves among players`;
            }
          } else if (copiedRole === 'MASON') {
            const masons = info.masons as string[] | undefined;
            if (masons && masons.length > 0) {
              const names = masons.map(id => {
                const mRoomId = this.gameToRoomPlayerMap.get(id) || id;
                return playerNames.get(mRoomId) || mRoomId;
              });
              description += `. Saw fellow Mason(s): ${names.join(', ')}`;
            } else {
              description += `. No other Masons`;
            }
          }

          return description;
        }
        return 'Copied another player\'s role';
      }

      case RoleName.WEREWOLF: {
        const werewolves = info.werewolves as string[] | undefined;
        if (werewolves && werewolves.length > 0) {
          const names = werewolves.map(id => {
            const roomId = this.gameToRoomPlayerMap.get(id) || id;
            return playerNames.get(roomId) || roomId;
          });
          return `Saw fellow Werewolf(s): ${names.join(', ')}`;
        }
        // Lone wolf - check if they viewed a center card
        const viewed = info.viewed as Array<{ centerIndex: number; role: string }> | undefined;
        if (viewed && viewed.length > 0) {
          const card = viewed[0];
          return `Lone wolf - peeked at center card ${card.centerIndex + 1}: ${card.role}`;
        }
        return 'Woke up (no other Werewolves)';
      }

      case RoleName.MINION: {
        const werewolves = info.werewolves as string[] | undefined;
        if (werewolves && werewolves.length > 0) {
          const names = werewolves.map(id => {
            const roomId = this.gameToRoomPlayerMap.get(id) || id;
            return playerNames.get(roomId) || roomId;
          });
          return `Saw Werewolf(s): ${names.join(', ')}`;
        }
        return 'No Werewolves among players';
      }

      case RoleName.MASON: {
        const masons = info.masons as string[] | undefined;
        if (masons && masons.length > 0) {
          const names = masons.map(id => {
            const roomId = this.gameToRoomPlayerMap.get(id) || id;
            return playerNames.get(roomId) || roomId;
          });
          return `Saw fellow Mason(s): ${names.join(', ')}`;
        }
        return 'No other Masons';
      }

      case RoleName.SEER: {
        const viewed = info.viewed as Array<{ playerId?: string; centerIndex?: number; role: string }> | undefined;
        if (viewed && viewed.length > 0) {
          if (viewed[0].playerId) {
            const roomId = this.gameToRoomPlayerMap.get(viewed[0].playerId) || viewed[0].playerId;
            const name = playerNames.get(roomId) || roomId;
            return `Viewed ${name}'s card: ${viewed[0].role}`;
          } else {
            return `Viewed center cards: ${viewed.map(v => `Card ${(v.centerIndex || 0) + 1} = ${v.role}`).join(', ')}`;
          }
        }
        return 'Viewed cards';
      }

      case RoleName.ROBBER: {
        const swapped = info.swapped as { from: { playerId: string }; to: { playerId: string } } | undefined;
        const viewed = info.viewed as Array<{ playerId: string; role: string }> | undefined;
        if (swapped && viewed && viewed.length > 0) {
          const targetId = swapped.to.playerId;
          const stolenRole = viewed[0].role;
          const roomId = this.gameToRoomPlayerMap.get(targetId) || targetId;
          const name = playerNames.get(roomId) || roomId;
          return `Robbed ${name} and became ${stolenRole}`;
        }
        return 'Robbed a player';
      }

      case RoleName.TROUBLEMAKER: {
        const swapped = info.swapped as { from: { playerId: string }; to: { playerId: string } } | undefined;
        if (swapped) {
          const roomId1 = this.gameToRoomPlayerMap.get(swapped.from.playerId) || swapped.from.playerId;
          const roomId2 = this.gameToRoomPlayerMap.get(swapped.to.playerId) || swapped.to.playerId;
          const name1 = playerNames.get(roomId1) || roomId1;
          const name2 = playerNames.get(roomId2) || roomId2;
          return `Swapped ${name1} and ${name2}'s cards`;
        }
        return 'Swapped two players\' cards';
      }

      case RoleName.DRUNK: {
        const centerIndex = info.centerCardIndex as number | undefined;
        if (centerIndex !== undefined) {
          return `Swapped with center card ${centerIndex + 1}`;
        }
        return 'Swapped with a center card';
      }

      case RoleName.INSOMNIAC: {
        const finalRole = info.currentRole as string | undefined;
        if (finalRole) {
          return `Checked their card: still ${finalRole}`;
        }
        return 'Checked their final card';
      }

      default:
        return result.actionType || 'No action';
    }
  }

  /**
   * @summary Ends the current game.
   *
   * @param {Record<string, unknown>} [result] - Game result data
   */
  endGame(result?: Record<string, unknown>): void {
    if (this.status !== RoomStatus.PLAYING) {
      return;
    }

    this.status = RoomStatus.ENDED;

    this.emitEvent('gameEnded', {
      result: result ?? {}
    });

    // Notify all players - broadcast happens via room events
  }

  /**
   * @summary Closes the room.
   *
   * @param {string} [reason] - Reason for closing
   */
  close(reason?: string): void {
    this.status = RoomStatus.CLOSED;

    this.emitEvent('roomClosed', {
      reason: reason ?? 'Room closed'
    });

    // Notify all players
    const closeMessage: ServerMessage = {
      type: 'roomClosed',
      reason: reason ?? 'Room closed',
      timestamp: Date.now()
    };
    this.broadcast(closeMessage);

    // Disconnect all players
    for (const player of this.players.values()) {
      player.connection.close(reason);
    }

    this.players.clear();
  }

  /**
   * @summary Registers an event handler.
   *
   * @param {RoomEventHandler} handler - Handler function
   *
   * @returns {() => void} Unsubscribe function
   */
  onEvent(handler: RoomEventHandler): () => void {
    this.eventHandlers.add(handler);
    return () => this.eventHandlers.delete(handler);
  }

  /**
   * @summary Emits a room event.
   *
   * @param {RoomEventType} type - Event type
   * @param {Record<string, unknown>} data - Event data
   *
   * @private
   */
  private emitEvent(type: RoomEventType, data: Record<string, unknown>): void {
    const event: RoomEvent = {
      type,
      roomCode: this.code,
      data,
      timestamp: Date.now()
    };

    for (const handler of this.eventHandlers) {
      try {
        handler(event);
      } catch (error) {
        console.error('Error in room event handler:', error);
      }
    }
  }

  /**
   * @summary Broadcasts a message to all players.
   *
   * @param {ServerMessage} message - Message to send
   */
  broadcast(message: ServerMessage): void {
    for (const player of this.players.values()) {
      if (player.connection.isConnected()) {
        try {
          player.connection.send(message);
        } catch (error) {
          console.error(`Failed to send to ${player.id}:`, error);
        }
      }
    }
  }

  /**
   * @summary Gets the time remaining in the current phase.
   *
   * @description
   * Computes remaining time based on phase start time and duration.
   * Returns null if phase has no time limit or timing info is not available.
   *
   * @returns {number | null} Remaining time in seconds, or null
   */
  getTimeRemaining(): number | null {
    if (this.phaseStartedAt === null || this.phaseDurationMs === null) {
      return null;
    }

    const elapsed = Date.now() - this.phaseStartedAt;
    const remaining = Math.max(0, this.phaseDurationMs - elapsed);
    return Math.ceil(remaining / 1000); // Return seconds
  }

  /**
   * @summary Broadcasts room state to all players.
   *
   * @private
   */
  private broadcastRoomState(): void {
    const state = this.getState();
    const message: ServerMessage = {
      type: 'roomUpdate',
      state,
      timestamp: Date.now()
    };
    this.broadcast(message);
  }

  /**
   * @summary Converts internal status to protocol status.
   *
   * @private
   */
  private getProtocolStatus(): RoomState['status'] {
    switch (this.status) {
      case RoomStatus.WAITING:
        return 'waiting';
      case RoomStatus.PLAYING:
        return 'playing';
      case RoomStatus.ENDED:
        return 'ended';
      case RoomStatus.CLOSED:
        return 'ended';
      default:
        return 'waiting';
    }
  }

  /**
   * @summary Gets the current room state for clients.
   *
   * @returns {RoomState} Room state
   */
  getState(): RoomState {
    const players: RoomPlayer[] = Array.from(this.players.values()).map(p => ({
      id: p.id,
      name: p.name,
      isReady: p.isReady,
      isHost: p.id === this.hostId,
      isConnected: p.connection.isConnected(),
      isAI: p.isAI
    }));

    return {
      roomCode: this.code,
      hostId: this.hostId,
      players,
      config: this.config,
      status: this.getProtocolStatus(),
      createdAt: this.createdAt
    };
  }

  // ==========================================================================
  // DATABASE INTEGRATION
  // ==========================================================================
  // @pattern Repository Pattern - All database access goes through repositories
  // @pattern Facade Pattern - Room acts as facade, hiding database complexity
  // @pattern 6NF Compliance - Data is stored in fully normalized tables
  // ==========================================================================

  /**
   * @summary Saves game to database when it starts.
   *
   * @description
   * Creates the game record, player records, and center cards in the database.
   * This operation is non-blocking - the game continues even if the database
   * save fails, ensuring graceful degradation.
   *
   * @pattern Repository Pattern - Uses IGameRepository for data access
   * @pattern Graceful Degradation - Game continues if database fails
   *
   * @param {RoomPlayerInfo[]} playerList - List of players in the game
   * @returns {Promise<void>} Resolves when save completes or fails gracefully
   *
   * @private
   */
  private async saveGameToDatabase(playerList: RoomPlayerInfo[]): Promise<void> {
    const db = getDatabase();
    if (!db.isConnected()) {
      console.log('Database not connected, skipping game save');
      return;
    }

    try {
      // Get the host's database user ID
      // The host is identified by this.hostId (room player ID)
      const hostPlayer = playerList.find((p) => p.id === this.hostId);
      const hostUserId = hostPlayer?.userId || this.hostId;

      // Create game in database
      this.dbGameId = await this.gameRepository.createGame({
        hostUserId: hostUserId,
        roomCode: this.code,
        playerCount: playerList.length,
        selectedRoles: [...this.config.roles], // Spread to create mutable array
        dayDurationSeconds: Math.floor(this.dayDurationMs / 1000),
        voteDurationSeconds: Math.floor(this.votingDurationMs / 1000),
        isPrivate: true,
        allowSpectators: false
      });

      console.log(`Game saved to database with ID: ${this.dbGameId}`);

      // Add players to database
      for (let i = 0; i < playerList.length; i++) {
        const roomPlayer = playerList[i];
        const gamePlayerId = this.roomToGamePlayerMap.get(roomPlayer.id);

        if (gamePlayerId && this.game) {
          const startingRole = this.game.getPlayerStartingRole(gamePlayerId);

          const dbPlayerId = await this.gameRepository.addPlayer({
            gameId: this.dbGameId,
            userId: roomPlayer.userId,  // undefined for AI players
            isAI: roomPlayer.isAI,
            seatPosition: i,
            startingRole: startingRole
          });

          this.dbPlayerIds.set(roomPlayer.id, dbPlayerId);
        }
      }

      // Set center cards
      if (this.game) {
        const centerCards = this.game.getCenterCards();
        await this.gameRepository.setCenterCards(this.dbGameId, centerCards);
      }

      // Update game status
      await this.gameRepository.updateStatus(this.dbGameId, 'night');

      console.log(`Game ${this.dbGameId}: ${playerList.length} players saved`);
    } catch (error) {
      console.error('Error saving game to database:', error);
      this.dbGameId = null;
    }
  }

  /**
   * @summary Saves a night action to the database.
   *
   * @description
   * Persists a night action using 6NF-compliant decomposed tables.
   * Action details are extracted into separate tables: targets, views,
   * swaps, copies, and teammates.
   *
   * @pattern Repository Pattern - Uses IReplayRepository for data access
   * @pattern 6NF Compliance - Data decomposed into normalized tables
   * @pattern Graceful Degradation - Continues silently on failure
   *
   * @param {string} gamePlayerId - Game player ID who performed action
   * @param {RoleName} role - Role that performed the action
   * @param {string} actionType - Type of action (view_player, swap_players, etc.)
   * @param {Record<string, unknown>} details - Action-specific details
   * @returns {Promise<void>} Resolves when save completes
   *
   * @private
   */
  private async saveNightActionToDatabase(
    gamePlayerId: string,
    role: RoleName,
    actionType: string,
    details: Record<string, unknown>
  ): Promise<void> {
    if (!this.dbGameId) return;

    const roomPlayerId = this.gameToRoomPlayerMap.get(gamePlayerId);
    if (!roomPlayerId) return;

    const dbPlayerId = this.dbPlayerIds.get(roomPlayerId);
    if (!dbPlayerId) return;

    try {
      await this.replayRepository.saveNightAction({
        gameId: this.dbGameId,
        actorPlayerId: dbPlayerId,
        performedAsRole: role,
        actionType,
        sequenceOrder: this.nightActionSequence++,
        isDoppelgangerAction: false,
        targets: this.extractTargets(details),
        views: this.extractViews(details),
        swap: this.extractSwap(details),
        copy: this.extractCopy(details),
        teammates: this.extractTeammates(details)
      });
    } catch (error) {
      console.error('Error saving night action to database:', error);
    }
  }

  /**
   * @summary Saves a statement to the database.
   *
   * @description
   * Persists a day phase statement for full game replay capability.
   * Statements are stored in sequence order for accurate reconstruction.
   *
   * @pattern Repository Pattern - Uses IReplayRepository for data access
   * @pattern Graceful Degradation - Continues silently on failure
   *
   * @param {string} gamePlayerId - Game player ID who made statement
   * @param {string} text - Statement text
   * @returns {Promise<void>} Resolves when save completes
   *
   * @private
   */
  private async saveStatementToDatabase(
    gamePlayerId: string,
    text: string
  ): Promise<void> {
    if (!this.dbGameId) return;

    const roomPlayerId = this.gameToRoomPlayerMap.get(gamePlayerId);
    if (!roomPlayerId) return;

    const dbPlayerId = this.dbPlayerIds.get(roomPlayerId);
    if (!dbPlayerId) return;

    try {
      await this.replayRepository.saveStatement({
        gameId: this.dbGameId,
        speakerPlayerId: dbPlayerId,
        text,
        type: 'claim',
        sequenceOrder: this.statementSequence++
      });
    } catch (error) {
      console.error('Error saving statement to database:', error);
    }
  }

  /**
   * @summary Saves a vote to the database.
   *
   * @description
   * Persists a player's vote for full game replay and statistics.
   * Supports both votes for players and abstentions (null target).
   *
   * @pattern Repository Pattern - Uses IReplayRepository for data access
   * @pattern Graceful Degradation - Continues silently on failure
   *
   * @param {string} voterGamePlayerId - Game player ID of voter
   * @param {string | null} targetGamePlayerId - Game player ID of target (null for no vote)
   * @returns {Promise<void>} Resolves when save completes
   *
   * @private
   */
  private async saveVoteToDatabase(
    voterGamePlayerId: string,
    targetGamePlayerId: string | null
  ): Promise<void> {
    if (!this.dbGameId) return;

    const voterRoomId = this.gameToRoomPlayerMap.get(voterGamePlayerId);
    if (!voterRoomId) return;

    const voterDbId = this.dbPlayerIds.get(voterRoomId);
    if (!voterDbId) return;

    let targetDbId: string | null = null;
    if (targetGamePlayerId) {
      const targetRoomId = this.gameToRoomPlayerMap.get(targetGamePlayerId);
      if (targetRoomId) {
        targetDbId = this.dbPlayerIds.get(targetRoomId) || null;
      }
    }

    try {
      await this.replayRepository.saveVote({
        gameId: this.dbGameId,
        voterPlayerId: voterDbId,
        targetPlayerId: targetDbId,
        isFinal: true
      });
    } catch (error) {
      console.error('Error saving vote to database:', error);
    }
  }

  /**
   * @summary Saves game results to the database.
   *
   * @description
   * Persists final game state including winners, eliminations, and
   * team assignments. Also triggers statistics update via database
   * trigger for automatic leaderboard maintenance.
   *
   * @pattern Repository Pattern - Uses IGameRepository and IStatisticsRepository
   * @pattern Graceful Degradation - Continues silently on failure
   * @pattern Event Sourcing - Results reconstructable from saved events
   *
   * @param {SerializableGameResult} result - Game result with winners and votes
   * @param {RoomPlayerInfo[]} playerList - List of players in the game
   * @returns {Promise<void>} Resolves when save completes
   *
   * @private
   */
  private async saveGameResultsToDatabase(
    result: SerializableGameResult,
    playerList: RoomPlayerInfo[]
  ): Promise<void> {
    if (!this.dbGameId || !this.game) return;

    try {
      // Update game status
      await this.gameRepository.updateStatus(this.dbGameId, 'completed');

      // Update final roles for all players
      for (const [roomId, role] of Object.entries(result.finalRoles)) {
        const dbPlayerId = this.dbPlayerIds.get(roomId);
        if (dbPlayerId) {
          await this.gameRepository.updateFinalRole(dbPlayerId, role);
        }
      }

      // Build player results for statistics
      const playerResults: Array<{
        playerId: string;
        userId?: string;
        isAI: boolean;
        finalTeam: string;
        isWinner: boolean;
        isEliminated: boolean;
        votesReceived: number;
        voteCastFor: string | null;
      }> = [];

      const finalTeams = this.game.getFinalTeamAssignments();

      for (const roomPlayer of playerList) {
        const dbPlayerId = this.dbPlayerIds.get(roomPlayer.id);
        if (!dbPlayerId) continue;

        const gamePlayerId = this.roomToGamePlayerMap.get(roomPlayer.id);
        if (!gamePlayerId) continue;

        const teamAssignment = finalTeams.find(t => {
          const tRoomId = this.gameToRoomPlayerMap.get(t.playerId);
          return tRoomId === roomPlayer.id;
        });

        const isEliminated = result.eliminatedPlayers.includes(roomPlayer.id);
        const isWinner = result.winningPlayers.includes(roomPlayer.id);

        // Count votes received
        const votesReceived = Object.values(result.votes).filter(
          target => target === roomPlayer.id
        ).length;

        // Get who this player voted for
        const voteCastFor = result.votes[roomPlayer.id] || null;
        const voteCastForDbId = voteCastFor ? this.dbPlayerIds.get(voteCastFor) || null : null;

        playerResults.push({
          playerId: dbPlayerId,
          userId: roomPlayer.userId,  // undefined for AI players
          isAI: roomPlayer.isAI,
          finalTeam: teamAssignment?.team.toString() || 'village',
          isWinner,
          isEliminated,
          votesReceived,
          voteCastFor: voteCastForDbId
        });
      }

      // Get win conditions
      const winConditions = this.game.getWinConditionResults().map(wc => ({
        team: wc.team.toString(),
        won: wc.won,
        reason: wc.reason
      }));

      // Save game results (this triggers statistics update via database trigger)
      await this.statisticsRepository.saveGameResult({
        gameId: this.dbGameId,
        winningTeam: result.winningTeams[0] || null,
        playerResults,
        winConditions
      });

      console.log(`Game ${this.dbGameId}: Results saved to database`);
    } catch (error) {
      console.error('Error saving game results to database:', error);
    }
  }

  // ==========================================================================
  // WRITE QUEUE ENQUEUE METHODS
  // ==========================================================================
  // @pattern Command Pattern - Operations encapsulated for queue processing
  // @pattern Retry Pattern - Automatic retry with exponential backoff
  // ==========================================================================

  /**
   * @summary Enqueues game save operation.
   *
   * @description
   * Wraps saveGameToDatabase in a queued command with retry support.
   *
   * @param {RoomPlayerInfo[]} playerList - List of players
   * @private
   */
  private enqueueGameSave(playerList: RoomPlayerInfo[]): void {
    const queue = getWriteQueue();
    queue.enqueueWrite(
      'saveGame',
      { roomCode: this.code, playerCount: playerList.length },
      async () => {
        await this.saveGameToDatabase(playerList);
      }
    );
  }

  /**
   * @summary Enqueues statement save operation.
   *
   * @param {string} gamePlayerId - Game player ID
   * @param {string} text - Statement text
   * @private
   */
  private enqueueStatementSave(gamePlayerId: string, text: string): void {
    if (!this.dbGameId) return;

    const queue = getWriteQueue();
    queue.enqueueWrite(
      'saveStatement',
      { gameId: this.dbGameId, gamePlayerId, textLength: text.length },
      async () => {
        await this.saveStatementToDatabase(gamePlayerId, text);
      }
    );
  }

  /**
   * @summary Enqueues game status update operation.
   *
   * @param {string} status - New game status
   * @private
   */
  private enqueueStatusUpdate(status: string): void {
    if (!this.dbGameId) return;

    const queue = getWriteQueue();
    const gameId = this.dbGameId; // Capture for closure
    queue.enqueueWrite(
      'updateStatus',
      { gameId, status },
      async () => {
        await this.gameRepository.updateStatus(gameId, status);
      }
    );
  }

  /**
   * @summary Enqueues night action save operation.
   *
   * @param {string} actorId - Actor game player ID
   * @param {RoleName} role - Role performing action
   * @param {string} actionType - Type of action
   * @param {Record<string, unknown>} details - Action details
   * @private
   */
  private enqueueNightActionSave(
    actorId: string,
    role: RoleName,
    actionType: string,
    details: Record<string, unknown>
  ): void {
    if (!this.dbGameId) return;

    const queue = getWriteQueue();
    queue.enqueueWrite(
      'saveNightAction',
      { gameId: this.dbGameId, role, actionType },
      async () => {
        await this.saveNightActionToDatabase(actorId, role, actionType, details);
      }
    );
  }

  /**
   * @summary Enqueues vote save operation.
   *
   * @param {string} voterId - Voter game player ID
   * @param {string | null} targetId - Target game player ID
   * @private
   */
  private enqueueVoteSave(voterId: string, targetId: string | null): void {
    if (!this.dbGameId) return;

    const queue = getWriteQueue();
    queue.enqueueWrite(
      'saveVote',
      { gameId: this.dbGameId, voterId },
      async () => {
        await this.saveVoteToDatabase(voterId, targetId);
      }
    );
  }

  /**
   * @summary Enqueues game results save operation.
   *
   * @param {SerializableGameResult} result - Game result
   * @param {RoomPlayerInfo[]} playerList - List of players
   * @private
   */
  private enqueueGameResultsSave(
    result: SerializableGameResult,
    playerList: RoomPlayerInfo[]
  ): void {
    if (!this.dbGameId) return;

    const queue = getWriteQueue();
    queue.enqueueWrite(
      'saveGameResults',
      { gameId: this.dbGameId, winningTeams: result.winningTeams },
      async () => {
        await this.saveGameResultsToDatabase(result, playerList);
      }
    );
  }

  // ==========================================================================
  // HELPER METHODS FOR 6NF DATA EXTRACTION
  // ==========================================================================

  /**
   * @summary Extracts targets from night action details.
   *
   * @description
   * Parses night action details to extract target information for
   * storage in the 6NF night_action_targets table.
   *
   * @pattern 6NF Compliance - Extracts data for normalized storage
   * @pattern Information Hiding - Implementation details hidden from callers
   *
   * @param {Record<string, unknown>} details - Action-specific details
   * @returns {Array} Normalized target records
   *
   * @private
   */
  private extractTargets(
    details: Record<string, unknown>
  ): Array<{ targetType: 'player' | 'center' | 'self'; targetPlayerId?: string; targetCenterPosition?: number; targetOrder: number }> {
    const targets: Array<{ targetType: 'player' | 'center' | 'self'; targetPlayerId?: string; targetCenterPosition?: number; targetOrder: number }> = [];

    const viewed = details.viewed as Array<{ playerId?: string; centerIndex?: number }> | undefined;
    if (viewed) {
      viewed.forEach((v, i) => {
        if (v.playerId) {
          const roomId = this.gameToRoomPlayerMap.get(v.playerId);
          const dbId = roomId ? this.dbPlayerIds.get(roomId) : undefined;
          if (dbId) {
            targets.push({ targetType: 'player', targetPlayerId: dbId, targetOrder: i });
          }
        } else if (v.centerIndex !== undefined) {
          targets.push({ targetType: 'center', targetCenterPosition: v.centerIndex, targetOrder: i });
        }
      });
    }

    const swapped = details.swapped as { from: { playerId?: string; centerIndex?: number }; to: { playerId?: string; centerIndex?: number } } | undefined;
    if (swapped) {
      if (swapped.from.playerId) {
        const roomId = this.gameToRoomPlayerMap.get(swapped.from.playerId);
        const dbId = roomId ? this.dbPlayerIds.get(roomId) : undefined;
        if (dbId) {
          targets.push({ targetType: 'player', targetPlayerId: dbId, targetOrder: 0 });
        }
      }
      if (swapped.to.playerId) {
        const roomId = this.gameToRoomPlayerMap.get(swapped.to.playerId);
        const dbId = roomId ? this.dbPlayerIds.get(roomId) : undefined;
        if (dbId) {
          targets.push({ targetType: 'player', targetPlayerId: dbId, targetOrder: 1 });
        }
      }
    }

    return targets;
  }

  /**
   * @summary Extracts views from night action details.
   *
   * @description
   * Parses night action details to extract view information (roles seen)
   * for storage in the 6NF night_action_views table.
   *
   * @pattern 6NF Compliance - Extracts data for normalized storage
   * @pattern Information Hiding - Implementation details hidden from callers
   *
   * @param {Record<string, unknown>} details - Action-specific details
   * @returns {Array} Normalized view records
   *
   * @private
   */
  private extractViews(
    details: Record<string, unknown>
  ): Array<{ viewSourceType: 'player' | 'center' | 'self'; sourcePlayerId?: string; sourceCenterPosition?: number; viewedRole: string; viewOrder: number }> {
    const views: Array<{ viewSourceType: 'player' | 'center' | 'self'; sourcePlayerId?: string; sourceCenterPosition?: number; viewedRole: string; viewOrder: number }> = [];

    const viewed = details.viewed as Array<{ playerId?: string; centerIndex?: number; role: string }> | undefined;
    if (viewed) {
      viewed.forEach((v, i) => {
        if (v.playerId) {
          const roomId = this.gameToRoomPlayerMap.get(v.playerId);
          const dbId = roomId ? this.dbPlayerIds.get(roomId) : undefined;
          if (dbId) {
            views.push({ viewSourceType: 'player', sourcePlayerId: dbId, viewedRole: v.role, viewOrder: i });
          }
        } else if (v.centerIndex !== undefined) {
          views.push({ viewSourceType: 'center', sourceCenterPosition: v.centerIndex, viewedRole: v.role, viewOrder: i });
        }
      });
    }

    return views;
  }

  /**
   * @summary Extracts swap from night action details.
   *
   * @description
   * Parses night action details to extract swap operation data
   * for storage in the 6NF night_action_swaps table.
   *
   * @pattern 6NF Compliance - Extracts data for normalized storage
   * @pattern Information Hiding - Implementation details hidden from callers
   *
   * @param {Record<string, unknown>} details - Action-specific details
   * @returns {object | undefined} Normalized swap record or undefined if no swap
   *
   * @private
   */
  private extractSwap(
    details: Record<string, unknown>
  ): { fromType: 'player' | 'center'; fromPlayerId?: string; fromCenterPosition?: number; toType: 'player' | 'center'; toPlayerId?: string; toCenterPosition?: number } | undefined {
    const swapped = details.swapped as { from: { playerId?: string; centerIndex?: number }; to: { playerId?: string; centerIndex?: number } } | undefined;
    if (!swapped) return undefined;

    const swap: { fromType: 'player' | 'center'; fromPlayerId?: string; fromCenterPosition?: number; toType: 'player' | 'center'; toPlayerId?: string; toCenterPosition?: number } = {
      fromType: swapped.from.playerId ? 'player' : 'center',
      toType: swapped.to.playerId ? 'player' : 'center'
    };

    if (swapped.from.playerId) {
      const roomId = this.gameToRoomPlayerMap.get(swapped.from.playerId);
      swap.fromPlayerId = roomId ? this.dbPlayerIds.get(roomId) : undefined;
    } else {
      swap.fromCenterPosition = swapped.from.centerIndex;
    }

    if (swapped.to.playerId) {
      const roomId = this.gameToRoomPlayerMap.get(swapped.to.playerId);
      swap.toPlayerId = roomId ? this.dbPlayerIds.get(roomId) : undefined;
    } else {
      swap.toCenterPosition = swapped.to.centerIndex;
    }

    return swap;
  }

  /**
   * @summary Extracts copy from night action details.
   *
   * @description
   * Parses night action details to extract Doppelganger copy data
   * for storage in the 6NF night_action_copies table.
   *
   * @pattern 6NF Compliance - Extracts data for normalized storage
   * @pattern Information Hiding - Implementation details hidden from callers
   *
   * @param {Record<string, unknown>} details - Action-specific details
   * @returns {object | undefined} Normalized copy record or undefined if no copy
   *
   * @private
   */
  private extractCopy(
    details: Record<string, unknown>
  ): { copiedFromPlayerId: string; copiedRole: string } | undefined {
    const copied = details.copied as { fromPlayerId: string; role: string } | undefined;
    if (!copied) return undefined;

    const roomId = this.gameToRoomPlayerMap.get(copied.fromPlayerId);
    const dbId = roomId ? this.dbPlayerIds.get(roomId) : undefined;
    if (!dbId) return undefined;

    return {
      copiedFromPlayerId: dbId,
      copiedRole: copied.role
    };
  }

  /**
   * @summary Extracts teammates from night action details.
   *
   * @description
   * Parses night action details to extract teammate player IDs
   * (werewolves, masons) for storage in the 6NF night_action_teammates table.
   *
   * @pattern 6NF Compliance - Extracts data for normalized storage
   * @pattern Information Hiding - Implementation details hidden from callers
   *
   * @param {Record<string, unknown>} details - Action-specific details
   * @returns {string[]} Array of database player IDs for teammates
   *
   * @private
   */
  private extractTeammates(details: Record<string, unknown>): string[] {
    const teammates: string[] = [];

    const werewolves = details.werewolves as string[] | undefined;
    if (werewolves) {
      for (const id of werewolves) {
        const roomId = this.gameToRoomPlayerMap.get(id);
        const dbId = roomId ? this.dbPlayerIds.get(roomId) : undefined;
        if (dbId) teammates.push(dbId);
      }
    }

    const masons = details.masons as string[] | undefined;
    if (masons) {
      for (const id of masons) {
        const roomId = this.gameToRoomPlayerMap.get(id);
        const dbId = roomId ? this.dbPlayerIds.get(roomId) : undefined;
        if (dbId) teammates.push(dbId);
      }
    }

    return teammates;
  }
}
