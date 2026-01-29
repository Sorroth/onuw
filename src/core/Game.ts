/**
 * @fileoverview Main Game class implementation.
 * @module core/Game
 *
 * @summary The central game engine for One Night Ultimate Werewolf.
 *
 * @description
 * The Game class orchestrates all game components and phases:
 * - Manages game state (players, roles, center cards)
 * - Controls phase transitions using State Pattern
 * - Executes night actions using Strategy Pattern
 * - Logs actions using Command Pattern
 * - Broadcasts events using Observer Pattern
 * - Creates roles using Factory Pattern
 *
 * @pattern Mediator Pattern - Coordinates communication between components
 * @pattern Facade Pattern - Provides simple interface to complex subsystem
 *
 * @remarks
 * The Game class is the entry point for running a game. It:
 * 1. Sets up players and deals roles
 * 2. Executes night phase (role actions in order)
 * 3. Collects day statements
 * 4. Collects votes
 * 5. Resolves the game and determines winners
 *
 * @example
 * ```typescript
 * const game = new Game({
 *   players: ['Alice', 'Bob', 'Charlie', 'Diana', 'Eve'],
 *   roles: [
 *     RoleName.WEREWOLF, RoleName.WEREWOLF,
 *     RoleName.SEER, RoleName.ROBBER, RoleName.TROUBLEMAKER,
 *     RoleName.VILLAGER, RoleName.VILLAGER, RoleName.DRUNK
 *   ]
 * });
 *
 * // Register agents
 * game.registerAgents(agents);
 *
 * // Run the game
 * const result = await game.run();
 * console.log('Winners:', result.winningTeams);
 * ```
 */

import { GamePhase, RoleName, Team, NIGHT_WAKE_ORDER } from '../enums';
import {
  GameConfig,
  GameState,
  GameResult,
  NightActionResult,
  NightActionContext,
  PlayerStatement,
  VotingContext,
  DayContext,
  AuditLevel
} from '../types';
import { Role, ROLE_TEAMS } from './Role';
import { Player } from './Player';
import {
  IGamePhaseState,
  IGameContext,
  SetupPhase,
  GameEventEmitter,
  RoleFactory,
  INightActionGameState,
  CardPosition,
  IWinCondition,
  VillageWinCondition,
  WerewolfWinCondition,
  TannerWinCondition,
  WinConditionContext,
  PlayerWinInfo,
  WinConditionResult
} from '../patterns';
import { GameStateSnapshot } from '../audit/GameStateSnapshot';

/**
 * @summary Interface for game agents (AI or human).
 *
 * @description
 * Agents make decisions during the game. Each player has an associated agent.
 */
export interface IGameAgent {
  readonly id: string;

  /**
   * @summary Indicates if this agent is backed by a remote connection.
   *
   * @description
   * - true: NetworkAgent (human player over WebSocket)
   * - false: AI agents (RandomAgent, AIAgent)
   *
   * Used to determine behavior during day phase (real-time vs sequential).
   */
  readonly isRemote: boolean;

  // Night action decisions
  selectPlayer(options: string[], context: NightActionContext): Promise<string>;
  selectCenterCard(context: NightActionContext): Promise<number>;
  selectTwoCenterCards(context: NightActionContext): Promise<[number, number]>;
  chooseSeerOption(context: NightActionContext): Promise<'player' | 'center'>;
  selectTwoPlayers(options: string[], context: NightActionContext): Promise<[string, string]>;

  // Day phase
  makeStatement(context: DayContext): Promise<string>;

  // Voting
  vote(context: VotingContext): Promise<string>;

  // Information receiving
  receiveNightInfo(info: NightActionResult): void;
}

/**
 * @summary Main game engine for One Night Ultimate Werewolf.
 *
 * @description
 * Orchestrates all game components and manages the game lifecycle.
 *
 * @pattern Mediator Pattern - Coordinates all game components
 * @pattern Facade Pattern - Simple interface to complex game logic
 *
 * @implements {IGameContext} - For State Pattern phase transitions
 * @implements {INightActionGameState} - For Strategy Pattern night actions
 *
 * @example
 * ```typescript
 * const game = new Game(config);
 * game.registerAgents(agents);
 * const result = await game.run();
 * ```
 */
export class Game implements IGameContext, INightActionGameState {
  /** Game configuration */
  private readonly config: GameConfig;

  /** All players in the game */
  private readonly players: Map<string, Player> = new Map();

  /** Player order (for turn-based operations) */
  private readonly playerOrder: string[] = [];

  /** Center cards (3 cards) */
  private readonly centerCards: Role[] = [];

  /** Current phase state */
  private currentPhaseState: IGamePhaseState;

  /** Event emitter for broadcasting events */
  private readonly eventEmitter: GameEventEmitter;

  /** Registered agents for each player */
  private readonly agents: Map<string, IGameAgent> = new Map();

  /** Night action results for each player */
  private readonly nightResults: Map<string, NightActionResult[]> = new Map();

  /** Statements made during day */
  private readonly statements: PlayerStatement[] = [];

  /** Votes cast during voting */
  private readonly votes: Map<string, string> = new Map();

  /** Resolver for ending the day phase (real-time discussion) */
  private dayPhaseResolver: (() => void) | null = null;

  /** Win condition strategies */
  private readonly winConditions: IWinCondition[] = [
    new VillageWinCondition(),
    new WerewolfWinCondition(),
    new TannerWinCondition()
  ];

  /** Audit log callback */
  private auditCallback?: (action: string, details: Record<string, unknown>) => void;

  /** Card state history for audit - snapshots based on audit level */
  private readonly cardStateHistory: Array<{
    snapshot: GameStateSnapshot;
    actionDescription: string;
    actorName: string;
    actorRole: RoleName;
  }> = [];

  /** Stored win condition results (populated when game resolves) */
  private winConditionResults: WinConditionResult[] = [];

  /**
   * @summary Tracks what role each Doppelganger copied during night phase.
   *
   * @description
   * Maps player ID to the role they copied. This is used to allow
   * Werewolves to see Doppelganger-Werewolves as fellow pack members.
   *
   * @private
   */
  private readonly doppelgangerCopiedRoles: Map<string, RoleName> = new Map();

  /**
   * @summary Audit logging level for card state snapshots.
   *
   * @description
   * Controls snapshot frequency:
   * - minimal: No snapshots during gameplay
   * - standard: Snapshots at phase boundaries only
   * - verbose: Snapshots after every night action
   *
   * @private
   */
  private readonly auditLevel: AuditLevel;

  /**
   * @summary Creates a new Game instance.
   *
   * @param {GameConfig} config - Game configuration
   *
   * @throws {Error} If configuration is invalid
   *
   * @example
   * ```typescript
   * const game = new Game({
   *   players: ['Alice', 'Bob', 'Charlie'],
   *   roles: [RoleName.WEREWOLF, RoleName.SEER, RoleName.ROBBER,
   *           RoleName.VILLAGER, RoleName.VILLAGER, RoleName.DRUNK]
   * });
   * ```
   */
  constructor(config: GameConfig) {
    this.config = config;
    this.eventEmitter = new GameEventEmitter();
    this.currentPhaseState = new SetupPhase();
    this.auditLevel = config.auditLevel ?? 'standard';

    this.validateConfig();
    this.setupGame();
  }

  /**
   * @summary Validates the game configuration.
   *
   * @throws {Error} If configuration is invalid
   *
   * @private
   */
  private validateConfig(): void {
    const validation = RoleFactory.validateSetup(
      [...this.config.roles],
      this.config.players.length
    );

    if (!validation.valid) {
      throw new Error(`Invalid game configuration: ${validation.errors.join(', ')}`);
    }
  }

  /**
   * @summary Sets up the game by dealing roles.
   *
   * @description
   * Creates roles and deals them to players. Supports debug mode
   * where specific players can be forced to receive specific roles.
   *
   * @private
   */
  private setupGame(): void {
    // Create all roles
    const roles = RoleFactory.createRoles([...this.config.roles]);

    // Shuffle roles
    this.shuffleArray(roles);

    // Handle forced roles for debug mode
    if (this.config.forcedRoles && this.config.forcedRoles.size > 0) {
      for (const [playerIndex, forcedRoleName] of this.config.forcedRoles) {
        // Find a role matching the forced role name
        const forcedRoleIndex = roles.findIndex(r => r.name === forcedRoleName);
        if (forcedRoleIndex !== -1 && playerIndex < this.config.players.length) {
          // Swap the forced role into the player's position
          [roles[playerIndex], roles[forcedRoleIndex]] = [roles[forcedRoleIndex], roles[playerIndex]];
          console.log(`Debug: Forced player ${playerIndex} to have role ${forcedRoleName}`);
        }
      }
    }

    // Deal to players
    for (let i = 0; i < this.config.players.length; i++) {
      const playerName = this.config.players[i];
      const playerId = `player-${i + 1}`;
      const role = roles[i];

      const player = new Player(playerId, playerName, role);
      this.players.set(playerId, player);
      this.playerOrder.push(playerId);
      this.nightResults.set(playerId, []);
    }

    // Put remaining 3 in center
    for (let i = this.config.players.length; i < roles.length; i++) {
      this.centerCards.push(roles[i]);
    }
  }

  /**
   * @summary Fisher-Yates shuffle algorithm.
   *
   * @param {T[]} array - Array to shuffle in place
   *
   * @private
   */
  private shuffleArray<T>(array: T[]): void {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
  }

  // =========================================================================
  // PUBLIC API
  // =========================================================================

  /**
   * @summary Registers agents for all players.
   *
   * @param {Map<string, IGameAgent>} agents - Map of player ID to agent
   *
   * @throws {Error} If not all players have agents
   *
   * @example
   * ```typescript
   * const agents = new Map();
   * agents.set('player-1', new AIAgent('player-1'));
   * game.registerAgents(agents);
   * ```
   */
  registerAgents(agents: Map<string, IGameAgent>): void {
    for (const playerId of this.playerOrder) {
      const agent = agents.get(playerId);
      if (!agent) {
        throw new Error(`No agent registered for player ${playerId}`);
      }
      this.agents.set(playerId, agent);
    }
  }

  /**
   * @summary Sets the audit callback for logging.
   *
   * @param {Function} callback - Callback for audit events
   *
   * @example
   * ```typescript
   * game.setAuditCallback((action, details) => {
   *   auditLog.record(action, details);
   * });
   * ```
   */
  setAuditCallback(callback: (action: string, details: Record<string, unknown>) => void): void {
    this.auditCallback = callback;
  }

  /**
   * @summary Adds an event observer.
   *
   * @param {IGameObserver} observer - Observer to add
   *
   * @example
   * ```typescript
   * game.addObserver(new ConsoleObserver());
   * ```
   */
  addObserver(observer: { onEvent(event: unknown): void }): void {
    this.eventEmitter.addObserver(observer as any);
  }

  /**
   * @summary Runs the complete game.
   *
   * @description
   * Executes all phases in sequence:
   * Setup -> Night -> Day -> Voting -> Resolution
   *
   * @returns {Promise<GameResult>} The final game result
   *
   * @throws {Error} If agents are not registered
   *
   * @example
   * ```typescript
   * const result = await game.run();
   * console.log('Winners:', result.winningTeams);
   * ```
   */
  async run(): Promise<GameResult> {
    if (this.agents.size !== this.playerOrder.length) {
      throw new Error('Must register agents for all players before running');
    }

    this.eventEmitter.emitGameStarted(
      this.playerOrder,
      this.config.roles.map(r => r.toString())
    );

    try {
      // Execute all phases
      while (this.currentPhaseState !== null) {
        await this.currentPhaseState.enter(this);
        await this.currentPhaseState.execute(this);
        await this.currentPhaseState.exit(this);

        const nextState = this.currentPhaseState.getNextState();
        if (nextState) {
          this.eventEmitter.emitPhaseChanged(
            this.currentPhaseState.getName(),
            nextState.getName()
          );
          this.currentPhaseState = nextState;
        } else {
          break;
        }
      }

      return this.getGameResult();
    } catch (error) {
      // Log the error and emit an error event before re-throwing
      const err = error instanceof Error ? error : new Error(String(error));
      this.logAuditEvent('GAME_ERROR', {
        phase: this.currentPhaseState?.getName() || 'unknown',
        error: err.message,
        stack: err.stack
      });
      this.eventEmitter.emitError('Game execution failed', err);
      throw error;
    }
  }

  /**
   * @summary Gets the current game state.
   *
   * @returns {GameState} Snapshot of current state
   */
  getState(): GameState {
    const playerArray = Array.from(this.players.values());
    return {
      phase: this.currentPhaseState.getName(),
      players: playerArray,
      centerCards: [...this.centerCards],
      votes: new Map(this.votes),
      nightActionLog: Array.from(this.nightResults.values()).flat(),
      timestamp: Date.now()
    };
  }

  // =========================================================================
  // IGameContext IMPLEMENTATION (for State Pattern)
  // =========================================================================

  getPhase(): GamePhase {
    return this.currentPhaseState.getName();
  }

  setPhaseState(state: IGamePhaseState): void {
    // Validate phase transition if there's a current phase
    if (this.currentPhaseState !== null) {
      const validNextPhases = this.currentPhaseState.getValidNextPhases();
      const newPhaseName = state.getName();

      if (!validNextPhases.includes(newPhaseName)) {
        const currentPhaseName = this.currentPhaseState.getName();
        throw new Error(
          `Invalid phase transition: ${currentPhaseName} → ${newPhaseName}. ` +
          `Valid transitions: ${validNextPhases.join(', ') || 'none'}`
        );
      }
    }

    this.currentPhaseState = state;
  }

  getPlayerIds(): string[] {
    return [...this.playerOrder];
  }

  getRolesInGame(): string[] {
    return this.config.roles.map(r => r.toString());
  }

  logAuditEvent(action: string, details: Record<string, unknown>): void {
    if (this.auditCallback) {
      this.auditCallback(action, {
        ...details,
        phase: this.currentPhaseState.getName()
      });
    }
  }

  /**
   * @summary Executes night actions for roles at a specific wake order.
   *
   * @param {number} roleOrder - The night wake order (1-9, plus 10 for Doppel-Insomniac)
   */
  async executeNightActionsForRole(roleOrder: number): Promise<void> {
    // Order 10 is special: Doppelganger who copied Insomniac wakes at very end
    if (roleOrder === 10) {
      await this.executeDoppelInsomniacAction();
      return;
    }

    // Find the role name for this order
    const roleName = NIGHT_WAKE_ORDER.find(
      rn => RoleFactory.createRole(rn).nightOrder === roleOrder
    );

    if (!roleName) {
      return; // No role at this order
    }

    // Find all players with this STARTING role
    for (const playerId of this.playerOrder) {
      const player = this.players.get(playerId)!;

      if (player.startingRole.name === roleName) {
        await this.executeNightActionForPlayer(player);
      }
    }
  }

  /**
   * @summary Executes the Doppel-Insomniac action at the end of night.
   *
   * @description
   * Doppelganger who copied Insomniac wakes at the very end of night
   * to see their final card (after all swaps have occurred).
   *
   * @private
   */
  private async executeDoppelInsomniacAction(): Promise<void> {
    const doppelInsomniacs = this.getDoppelgangersWhoCopied(RoleName.INSOMNIAC);

    for (const playerId of doppelInsomniacs) {
      const player = this.players.get(playerId);
      if (!player) continue;

      const agent = this.agents.get(playerId);
      if (!agent) continue;

      // Get their current role (after all swaps)
      const finalRole = player.currentRole.name;

      const result: NightActionResult = {
        actorId: playerId,
        roleName: RoleName.DOPPELGANGER, // Acting as Doppel-Insomniac
        actionType: 'VIEW',
        success: true,
        info: {
          viewed: [{ playerId, role: finalRole }]
        }
      };

      // Store result
      const results = this.nightResults.get(playerId) || [];
      results.push(result);
      this.nightResults.set(playerId, results);

      // Notify agent
      agent.receiveNightInfo(result);

      this.logAuditEvent('DOPPEL_INSOMNIAC_WOKE', {
        playerId,
        sawRole: finalRole
      });
    }
  }

  /**
   * @summary Executes night action for a specific player.
   *
   * @param {Player} player - The player to execute action for
   *
   * @private
   */
  private async executeNightActionForPlayer(player: Player): Promise<void> {
    const agent = this.agents.get(player.id)!;
    const action = player.startingRole.nightAction;

    const context: NightActionContext = {
      myPlayerId: player.id,
      myStartingRole: player.startingRole.name,
      allPlayerIds: this.playerOrder.filter(id => id !== player.id),
      rolesInGame: this.config.roles,
      previousResults: this.nightResults.get(player.id) || []
    };

    try {
      const result = await action.execute(context, agent, this);

      // Store result
      const results = this.nightResults.get(player.id) || [];
      results.push(result);
      this.nightResults.set(player.id, results);

      // Capture card state snapshot after the action for audit (verbose level only)
      if (this.auditLevel === 'verbose') {
        const snapshot = new GameStateSnapshot(this.getState());
        this.cardStateHistory.push({
          snapshot,
          actionDescription: result.actionType,
          actorName: player.name,
          actorRole: player.startingRole.name
        });
      }

      // Notify agent
      agent.receiveNightInfo(result);

      // Emit event
      this.eventEmitter.emitNightAction(
        player.id,
        player.startingRole.name,
        result.actionType,
        result.info as Record<string, unknown>
      );

      this.logAuditEvent('NIGHT_ACTION_EXECUTED', {
        playerId: player.id,
        role: player.startingRole.name,
        result
      });
    } catch (error) {
      this.eventEmitter.emitError(`Night action failed for ${player.id}`, error as Error);
    }
  }

  /**
   * @summary Collects statements from all players.
   *
   * @description
   * For human players in a networked game, this waits for real-time
   * statement submissions via addStatement() until endDayPhase() is called.
   * For AI players, it collects statements immediately.
   *
   * The method supports both:
   * - Real-time mode: Wait for endDayPhase() signal (networked human players)
   * - Sequential mode: Collect from AI agents immediately
   */
  async collectStatements(): Promise<void> {
    // Check if we have any human agents (remote agents)
    // If all agents are AI, collect sequentially for backward compatibility
    const hasHumanPlayers = Array.from(this.agents.values()).some(
      agent => agent.isRemote
    );

    if (hasHumanPlayers) {
      // Real-time mode: Wait for human players to submit statements
      // and for endDayPhase() to be called
      await this.waitForDayPhaseEnd();
    } else {
      // Sequential mode: AI-only game, collect statements immediately
      await this.collectStatementsSequentially();
    }
  }

  /**
   * @summary Collects statements sequentially from AI agents.
   *
   * @description
   * Used for AI-only games where we don't need to wait for real-time input.
   *
   * @private
   */
  private async collectStatementsSequentially(): Promise<void> {
    for (const playerId of this.playerOrder) {
      const player = this.players.get(playerId)!;
      const agent = this.agents.get(playerId)!;

      // Build player names map
      const playerNames = new Map<string, string>();
      for (const [pid, p] of this.players) {
        playerNames.set(pid, p.name);
      }

      const context: DayContext = {
        myPlayerId: playerId,
        myStartingRole: player.startingRole.name,
        myNightInfo: (this.nightResults.get(playerId) || [])[0] || null,
        statements: [...this.statements],
        rolesInGame: this.config.roles,
        allPlayerIds: this.playerOrder,
        playerNames
      };

      const statement = await agent.makeStatement(context);

      this.statements.push({
        playerId,
        statement,
        timestamp: Date.now()
      });

      this.eventEmitter.emitStatement(playerId, statement);
      this.logAuditEvent('STATEMENT_MADE', { playerId, statement });
    }
  }

  /**
   * @summary Waits for the day phase to end.
   *
   * @description
   * Creates a Promise that resolves when endDayPhase() is called.
   * Used for real-time networked games where human players submit
   * statements asynchronously.
   *
   * @private
   */
  private async waitForDayPhaseEnd(): Promise<void> {
    // Collect statements from AI players immediately
    for (const playerId of this.playerOrder) {
      const agent = this.agents.get(playerId)!;

      // Only collect from AI agents (non-remote agents)
      if (!agent.isRemote) {
        const player = this.players.get(playerId)!;

        // Build player names map
        const playerNames = new Map<string, string>();
        for (const [pid, p] of this.players) {
          playerNames.set(pid, p.name);
        }

        const context: DayContext = {
          myPlayerId: playerId,
          myStartingRole: player.startingRole.name,
          myNightInfo: (this.nightResults.get(playerId) || [])[0] || null,
          statements: [...this.statements],
          rolesInGame: this.config.roles,
          allPlayerIds: this.playerOrder,
          playerNames
        };

        const statement = await agent.makeStatement(context);
        this.addStatement(playerId, statement);
      }
    }

    // Wait for endDayPhase() to be called by human players
    return new Promise<void>((resolve) => {
      this.dayPhaseResolver = resolve;
    });
  }

  /**
   * @summary Adds a statement during the day phase (real-time).
   *
   * @description
   * Allows players to submit statements at any time during the DAY phase.
   * The statement is recorded and broadcast to all players via Observer pattern.
   * Multiple statements from the same player are allowed.
   *
   * @param {string} playerId - Player submitting the statement
   * @param {string} statement - The statement text
   *
   * @pattern Observer - Statement is broadcast via event emitter
   */
  addStatement(playerId: string, statement: string): void {
    this.statements.push({
      playerId,
      statement,
      timestamp: Date.now()
    });

    this.eventEmitter.emitStatement(playerId, statement);
    this.logAuditEvent('STATEMENT_MADE', { playerId, statement });
  }

  /**
   * @summary Ends the day phase and moves to voting.
   *
   * @description
   * Called when all human players have signaled they're ready to vote.
   * This resolves the Promise created in waitForDayPhaseEnd(), allowing
   * the game to proceed to the voting phase.
   */
  endDayPhase(): void {
    if (this.dayPhaseResolver) {
      this.dayPhaseResolver();
      this.dayPhaseResolver = null;
    }
  }

  /**
   * @summary Collects votes from all players.
   */
  async collectVotes(): Promise<void> {
    // Collect all votes simultaneously
    const votePromises = this.playerOrder.map(async playerId => {
      const player = this.players.get(playerId)!;
      const agent = this.agents.get(playerId)!;

      const context: VotingContext = {
        myPlayerId: playerId,
        myStartingRole: player.startingRole.name,
        myNightInfo: (this.nightResults.get(playerId) || [])[0] || null,
        allStatements: [...this.statements],
        eligibleTargets: this.playerOrder.filter(id => id !== playerId),
        rolesInGame: this.config.roles
      };

      const targetId = await agent.vote(context);
      return { voterId: playerId, targetId };
    });

    const results = await Promise.all(votePromises);

    for (const { voterId, targetId } of results) {
      this.votes.set(voterId, targetId);
      this.eventEmitter.emitVote(voterId, targetId);
      this.logAuditEvent('VOTE_CAST', { voterId, targetId });
    }
  }

  /**
   * @summary Resolves the game and determines winners.
   */
  async resolveGame(): Promise<void> {
    // Tally votes
    const voteCounts = new Map<string, number>();
    for (const targetId of this.votes.values()) {
      voteCounts.set(targetId, (voteCounts.get(targetId) || 0) + 1);
    }

    // Find max votes
    const maxVotes = Math.max(...voteCounts.values());

    // Check for tie where everyone has 1 vote
    const allHaveOne = Array.from(voteCounts.values()).every(v => v === 1) &&
      voteCounts.size === this.playerOrder.length;

    let eliminatedIds: string[] = [];

    if (!allHaveOne && maxVotes > 0) {
      // Eliminate player(s) with most votes
      eliminatedIds = Array.from(voteCounts.entries())
        .filter(([_, count]) => count === maxVotes)
        .map(([id, _]) => id);

      for (const id of eliminatedIds) {
        this.players.get(id)!.eliminate();
      }

      // Handle Hunter ability
      for (const id of eliminatedIds) {
        const player = this.players.get(id)!;
        if (player.currentRole.name === RoleName.HUNTER) {
          const hunterTarget = this.votes.get(id);
          if (hunterTarget && !eliminatedIds.includes(hunterTarget)) {
            this.players.get(hunterTarget)!.eliminate();
            eliminatedIds.push(hunterTarget);
            this.logAuditEvent('HUNTER_TRIGGERED', {
              hunterId: id,
              targetId: hunterTarget
            });
          }
        }
      }
    }

    this.logAuditEvent('RESOLUTION_COMPLETE', {
      voteCounts: Object.fromEntries(voteCounts),
      eliminated: eliminatedIds
    });
  }

  // =========================================================================
  // INightActionGameState IMPLEMENTATION (for Strategy Pattern)
  // =========================================================================

  getPlayerRole(playerId: string): RoleName {
    const player = this.players.get(playerId);
    if (!player) {
      throw new Error(`Player not found: ${playerId}`);
    }
    return player.currentRole.name;
  }

  getCenterCard(index: number): RoleName {
    if (index < 0 || index >= this.centerCards.length) {
      throw new Error(`Invalid center index: ${index}`);
    }
    return this.centerCards[index].name;
  }

  /**
   * @summary Gets all center card roles.
   *
   * @returns {RoleName[]} Array of center card roles (3 cards)
   */
  getCenterCards(): RoleName[] {
    return this.centerCards.map(role => role.name);
  }

  swapCards(pos1: CardPosition, pos2: CardPosition): void {
    const role1 = this.getCardAtPosition(pos1);
    const role2 = this.getCardAtPosition(pos2);

    this.setCardAtPosition(pos1, role2);
    this.setCardAtPosition(pos2, role1);

    this.logAuditEvent('CARDS_SWAPPED', { pos1, pos2 });
  }

  getPlayersWithRole(roleName: RoleName): string[] {
    return this.playerOrder.filter(id => {
      const player = this.players.get(id)!;
      return player.currentRole.name === roleName;
    });
  }

  getPlayersWithStartingRole(roleName: RoleName): string[] {
    return this.playerOrder.filter(id => {
      const player = this.players.get(id)!;
      return player.startingRole.name === roleName;
    });
  }

  getAllPlayerIds(): string[] {
    return [...this.playerOrder];
  }

  /**
   * @summary Records that a Doppelganger copied a specific role.
   *
   * @description
   * Called by DoppelgangerAction when a player copies a role.
   * This allows other roles (like Werewolf) to identify Doppelgangers
   * who have joined their team.
   *
   * @param {string} playerId - The Doppelganger player's ID
   * @param {RoleName} role - The role that was copied
   *
   * @example
   * ```typescript
   * // In DoppelgangerAction after copying Werewolf:
   * gameState.setDoppelgangerCopiedRole('player-2', RoleName.WEREWOLF);
   * ```
   */
  setDoppelgangerCopiedRole(playerId: string, role: RoleName): void {
    this.doppelgangerCopiedRoles.set(playerId, role);
    this.logAuditEvent('DOPPELGANGER_COPIED_ROLE', { playerId, copiedRole: role });
  }

  /**
   * @summary Gets all Doppelgangers who copied a specific role.
   *
   * @description
   * Returns player IDs of Doppelgangers who copied the specified role.
   * Used by Werewolf action to see Doppelganger-Werewolves as teammates.
   *
   * @param {RoleName} role - The role to search for
   *
   * @returns {string[]} Player IDs of Doppelgangers who copied this role
   *
   * @example
   * ```typescript
   * // In WerewolfAction to find Doppel-Werewolves:
   * const doppelWerewolves = gameState.getDoppelgangersWhoCopied(RoleName.WEREWOLF);
   * ```
   */
  getDoppelgangersWhoCopied(role: RoleName): string[] {
    const result: string[] = [];
    for (const [playerId, copiedRole] of this.doppelgangerCopiedRoles) {
      if (copiedRole === role) {
        result.push(playerId);
      }
    }
    return result;
  }

  /**
   * @summary Gets the effective team for a player, accounting for Doppelganger.
   *
   * @description
   * For most players, this returns their current card's team.
   * For Doppelgangers, this returns the team of the role they copied,
   * since a Doppelganger who copies Werewolf should be on Werewolf team.
   *
   * @param {string} playerId - The player's ID
   *
   * @returns {Team} The effective team for win conditions
   *
   * @private
   */
  private getEffectiveTeam(playerId: string): Team {
    const player = this.players.get(playerId);
    if (!player) {
      throw new Error(`Player ${playerId} not found`);
    }

    // Check if this player is a Doppelganger who copied a role
    const copiedRole = this.doppelgangerCopiedRoles.get(playerId);
    if (copiedRole) {
      // Return the team of the copied role
      return ROLE_TEAMS[copiedRole];
    }

    // Otherwise, return the team based on current card
    return player.getTeam();
  }

  /**
   * @summary Gets the card at a position.
   *
   * @private
   */
  private getCardAtPosition(pos: CardPosition): Role {
    if (pos.playerId !== undefined) {
      return this.players.get(pos.playerId)!.currentRole;
    }
    if (pos.centerIndex !== undefined) {
      return this.centerCards[pos.centerIndex];
    }
    throw new Error('Invalid card position');
  }

  /**
   * @summary Sets the card at a position.
   *
   * @private
   */
  private setCardAtPosition(pos: CardPosition, role: Role): void {
    if (pos.playerId !== undefined) {
      this.players.get(pos.playerId)!.currentRole = role;
      return;
    }
    if (pos.centerIndex !== undefined) {
      this.centerCards[pos.centerIndex] = role;
      return;
    }
    throw new Error('Invalid card position');
  }

  // =========================================================================
  // GAME RESULT
  // =========================================================================

  /**
   * @summary Builds the final game result.
   *
   * @private
   */
  private getGameResult(): GameResult {
    // Build win condition context
    // Note: Use getEffectiveTeam() to handle Doppelganger's team based on copied role
    const allPlayers: PlayerWinInfo[] = this.playerOrder.map(id => {
      const player = this.players.get(id)!;
      return {
        playerId: id,
        currentRole: player.currentRole.name,
        team: this.getEffectiveTeam(id),
        isEliminated: !player.isAlive
      };
    });

    const eliminatedPlayers = allPlayers.filter(p => p.isEliminated);

    const context: WinConditionContext = {
      allPlayers,
      eliminatedPlayers,
      werewolvesExistAmongPlayers: allPlayers.some(
        p => p.currentRole === RoleName.WEREWOLF
      ),
      minionExistsAmongPlayers: allPlayers.some(
        p => p.currentRole === RoleName.MINION
      ),
      tannerWasEliminated: eliminatedPlayers.some(
        p => p.currentRole === RoleName.TANNER
      )
    };

    // Evaluate all win conditions
    const winResults = this.winConditions.map(wc => wc.evaluate(context));
    const winners = winResults.filter(r => r.won);

    // Store win condition results for audit
    this.winConditionResults = winResults;

    // Build final result
    const winningTeams = winners.map(w => w.team);
    const winningPlayers = [...new Set(winners.flatMap(w => w.winners))];

    const result: GameResult = {
      winningTeams,
      winningPlayers,
      eliminatedPlayers: eliminatedPlayers.map(p => p.playerId),
      finalRoles: new Map(this.playerOrder.map(id => [
        id,
        this.players.get(id)!.currentRole.name
      ])),
      votes: new Map(this.votes)
    };

    this.eventEmitter.emitGameEnded(
      winningTeams.map(t => t.toString()),
      winningPlayers,
      [...result.eliminatedPlayers]
    );

    return result;
  }

  // =========================================================================
  // MULTIPLAYER SUPPORT METHODS
  // =========================================================================

  /** Unique game identifier */
  private readonly gameId: string = this.generateGameId();

  /** Game result (null until game ends) */
  private gameResult: GameResult | null = null;

  /** Player connection status */
  private readonly playerConnections: Map<string, boolean> = new Map();

  /** Player AI status */
  private readonly playerIsAI: Map<string, boolean> = new Map();

  /**
   * @summary Generates a unique game identifier.
   *
   * @returns {string} Unique game ID
   *
   * @private
   */
  private generateGameId(): string {
    return `game-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * @summary Gets the unique game identifier.
   *
   * @returns {string} Game ID
   */
  getId(): string {
    return this.gameId;
  }

  /**
   * @summary Checks if the game has ended.
   *
   * @returns {boolean} True if game has ended
   */
  isGameEnded(): boolean {
    return this.gameResult !== null;
  }

  /**
   * @summary Gets the game result (only valid after game ends).
   *
   * @returns {GameResult | null} Game result or null if game not ended
   */
  getResult(): GameResult | null {
    return this.gameResult;
  }

  /**
   * @summary Gets all statements made during day phase.
   *
   * @returns {PlayerStatement[]} Array of statements
   */
  getStatements(): PlayerStatement[] {
    return [...this.statements];
  }

  /**
   * @summary Gets all votes cast during voting phase.
   *
   * @returns {Map<string, string>} Map of voterId to targetId
   */
  getVotes(): Map<string, string> {
    return new Map(this.votes);
  }

  /**
   * @summary Gets IDs of eliminated players.
   *
   * @returns {string[]} Array of eliminated player IDs
   */
  getEliminatedPlayers(): string[] {
    return this.playerOrder.filter(id => {
      const player = this.players.get(id);
      return player && !player.isAlive;
    });
  }

  /**
   * @summary Gets night action results for a specific player.
   *
   * @param {string} playerId - Player ID
   *
   * @returns {NightActionResult[]} Array of night results for this player
   */
  getPlayerNightInfo(playerId: string): NightActionResult[] {
    return [...(this.nightResults.get(playerId) || [])];
  }

  /**
   * @summary Gets all night action results from all players.
   *
   * @description
   * Returns all night actions in the order they were executed.
   * Used for building post-game summaries.
   *
   * @returns {NightActionResult[]} All night results
   */
  getAllNightResults(): NightActionResult[] {
    return Array.from(this.nightResults.values()).flat();
  }

  /**
   * @summary Gets all players' starting roles.
   *
   * @description
   * Returns a map of player IDs to their starting role names.
   * Used for building post-game summaries.
   *
   * @returns {Map<string, RoleName>} Map of player ID to starting role
   */
  getStartingRoles(): Map<string, RoleName> {
    const roles = new Map<string, RoleName>();
    for (const [playerId, player] of this.players) {
      roles.set(playerId, player.startingRole.name);
    }
    return roles;
  }

  /**
   * @summary Checks if a player is currently connected.
   *
   * @param {string} playerId - Player ID
   *
   * @returns {boolean} True if connected
   */
  isPlayerConnected(playerId: string): boolean {
    return this.playerConnections.get(playerId) ?? true;
  }

  /**
   * @summary Sets a player's connection status.
   *
   * @param {string} playerId - Player ID
   * @param {boolean} connected - Connection status
   */
  setPlayerConnected(playerId: string, connected: boolean): void {
    this.playerConnections.set(playerId, connected);
  }

  /**
   * @summary Checks if a player is AI-controlled.
   *
   * @param {string} playerId - Player ID
   *
   * @returns {boolean} True if AI-controlled
   */
  isPlayerAI(playerId: string): boolean {
    return this.playerIsAI.get(playerId) ?? false;
  }

  /**
   * @summary Sets a player's AI status.
   *
   * @param {string} playerId - Player ID
   * @param {boolean} isAI - AI status
   */
  setPlayerAI(playerId: string, isAI: boolean): void {
    this.playerIsAI.set(playerId, isAI);
  }

  /**
   * @summary Replaces a player's agent (for AI takeover or reconnection).
   *
   * @param {string} playerId - Player ID
   * @param {IGameAgent} newAgent - New agent to use
   *
   * @throws {Error} If player not found
   */
  replaceAgent(playerId: string, newAgent: IGameAgent): void {
    if (!this.players.has(playerId)) {
      throw new Error(`Player ${playerId} not found`);
    }
    this.agents.set(playerId, newAgent);
  }

  // =========================================================================
  // AUDIT DATA ACCESS
  // =========================================================================

  /**
   * @summary Captures a phase boundary snapshot for 'standard' audit level.
   *
   * @description
   * Called at the start and end of night phase to capture card states
   * without the overhead of per-action snapshots.
   *
   * @param {string} description - Description of the phase boundary
   *
   * @example
   * ```typescript
   * game.capturePhaseSnapshot('Night Phase Start');
   * // ... execute night actions ...
   * game.capturePhaseSnapshot('Night Phase End');
   * ```
   */
  capturePhaseSnapshot(description: string): void {
    // 'minimal' level captures no snapshots
    // 'verbose' level captures per-action (handled in executeNightActionForPlayer)
    // 'standard' level captures at phase boundaries
    if (this.auditLevel === 'minimal') {
      return;
    }

    const snapshot = new GameStateSnapshot(this.getState());
    this.cardStateHistory.push({
      snapshot,
      actionDescription: description,
      actorName: 'System',
      actorRole: RoleName.VILLAGER // Placeholder for system-level snapshots
    });
  }

  /**
   * @summary Gets card state history for audit.
   *
   * @description
   * Returns snapshots of card states after each night action.
   * Used for verifying strict rule compliance.
   *
   * @returns {Array} Card state history with action descriptions
   */
  getCardStateHistory(): Array<{
    snapshot: GameStateSnapshot;
    actionDescription: string;
    actorName: string;
    actorRole: RoleName;
  }> {
    return [...this.cardStateHistory];
  }

  /**
   * @summary Gets win condition evaluation results.
   *
   * @description
   * Returns the results of evaluating each team's win condition,
   * including the reasoning for why each team won or lost.
   *
   * @returns {WinConditionResult[]} Win condition results with reasons
   */
  getWinConditionResults(): WinConditionResult[] {
    return [...this.winConditionResults];
  }

  /**
   * @summary Gets final team assignments for all players.
   *
   * @description
   * Returns each player's final role and team based on card swaps,
   * along with whether they won.
   *
   * @returns {Array} Team assignment info for each player
   */
  getFinalTeamAssignments(): Array<{
    playerId: string;
    playerName: string;
    finalRole: RoleName;
    team: Team;
    isWinner: boolean;
  }> {
    const winningTeams = this.winConditionResults
      .filter(r => r.won)
      .map(r => r.team);

    return this.playerOrder.map(playerId => {
      const player = this.players.get(playerId)!;
      // Use getEffectiveTeam to handle Doppelganger's team based on copied role
      const team = this.getEffectiveTeam(playerId);
      const isWinner = winningTeams.includes(team);

      return {
        playerId,
        playerName: player.name,
        finalRole: player.currentRole.name,
        team,
        isWinner
      };
    });
  }

  /**
   * @summary Gets the starting role for a player.
   *
   * @param {string} playerId - Player ID
   *
   * @returns {RoleName} Starting role name
   *
   * @throws {Error} If player not found
   */
  getPlayerStartingRole(playerId: string): RoleName {
    const player = this.players.get(playerId);
    if (!player) {
      throw new Error(`Player ${playerId} not found`);
    }
    return player.startingRole.name;
  }

  /**
   * @summary Gets a player's starting team.
   *
   * @param {string} playerId - Player ID
   *
   * @returns {Team} The player's starting team
   */
  getStartingRoleTeam(playerId: string): Team {
    const player = this.players.get(playerId);
    if (!player) {
      throw new Error(`Player ${playerId} not found`);
    }
    return player.getStartingTeam();
  }

  /**
   * @summary Stores the game result when game ends.
   *
   * @description
   * Called internally when resolution phase completes.
   * After this, getResult() will return the result.
   *
   * @private
   */
  private storeResult(result: GameResult): void {
    this.gameResult = result;
  }
}
