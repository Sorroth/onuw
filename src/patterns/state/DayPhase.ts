/**
 * @fileoverview Day phase state implementation.
 * @module patterns/state/DayPhase
 *
 * @summary Handles the day discussion phase where players make claims.
 *
 * @description
 * The Day phase is the social deduction core of the game:
 * - Players discuss and share (or lie about) information
 * - Claims are made about roles and night observations
 * - Players try to identify Werewolves (or protect them)
 * - Information is analyzed for contradictions
 *
 * @pattern State Pattern - Concrete State for Day phase
 *
 * @remarks
 * This phase is crucial for social deduction. Players must:
 * - Village team: Share information to find Werewolves
 * - Werewolf team: Deceive and misdirect
 * - Tanner: Act suspicious enough to get voted out
 *
 * @example
 * ```typescript
 * const dayPhase = new DayPhase();
 * await dayPhase.execute(gameContext);
 * // All players have made their statements
 * const nextPhase = dayPhase.getNextState(); // VotingPhase
 * ```
 */

import { GamePhase } from '../../enums';
import {
  AbstractGamePhaseState,
  IGamePhaseState,
  IGameContext
} from './GamePhaseState';
import { VotingPhase } from './VotingPhase';

/**
 * @summary Day phase state - handles player discussion.
 *
 * @description
 * During this phase:
 * 1. Players take turns making statements
 * 2. Statements may include claims, accusations, or defenses
 * 3. All statements are recorded for analysis
 * 4. Players can reference others' statements
 *
 * @pattern State Pattern - Concrete State
 *
 * @remarks
 * In ONUW, there's typically a timed discussion period.
 * For AI agents, each player gets one opportunity to make
 * a statement, considering all previous statements.
 *
 * @example
 * ```typescript
 * const day = new DayPhase();
 * await day.execute(gameContext);
 * // Player 1: "I am the Seer. I saw Player 3 is a Werewolf!"
 * // Player 2: "I am also the Seer..." (contradiction!)
 * // ... etc.
 * ```
 */
export class DayPhase extends AbstractGamePhaseState {
  /** Valid actions during day phase */
  private static readonly VALID_ACTIONS = new Set([
    'MAKE_STATEMENT',
    'MAKE_CLAIM',
    'ACCUSE',
    'DEFEND'
  ]);

  /** Tracks which players have spoken */
  private spokePlayers: Set<string> = new Set();

  /**
   * @summary Creates a new DayPhase instance.
   *
   * @example
   * ```typescript
   * const day = new DayPhase();
   * ```
   */
  constructor() {
    super();
  }

  /**
   * @summary Returns the phase name.
   *
   * @returns {GamePhase} GamePhase.DAY
   */
  getName(): GamePhase {
    return GamePhase.DAY;
  }

  /**
   * @summary Returns valid actions for this phase.
   *
   * @returns {Set<string>} Set of valid day actions
   *
   * @protected
   */
  protected getValidActions(): Set<string> {
    return DayPhase.VALID_ACTIONS;
  }

  /**
   * @summary Called when entering day phase.
   *
   * @description
   * Logs the start of day discussion and resets tracking.
   *
   * @param {IGameContext} context - The game context
   */
  async enter(context: IGameContext): Promise<void> {
    this.spokePlayers.clear();

    context.logAuditEvent('DAY_STARTED', {
      phase: this.getName(),
      playerCount: context.getPlayerIds().length,
      timestamp: Date.now()
    });
  }

  /**
   * @summary Executes the day phase.
   *
   * @description
   * Collects statements from all players. Each player makes
   * one statement, in order, with access to all previous statements.
   *
   * @param {IGameContext} context - The game context
   *
   * @throws {Error} If statement collection fails
   *
   * @remarks
   * The order of statements matters - later players have more
   * information to react to. This is handled by the Game's
   * collectStatements method.
   *
   * @example
   * ```typescript
   * await dayPhase.execute(gameContext);
   * // All players make statements based on their role/knowledge
   * ```
   */
  async execute(context: IGameContext): Promise<void> {
    context.logAuditEvent('DAY_DISCUSSION_STARTED', {
      timestamp: Date.now()
    });

    // Delegate to game context to collect all statements
    await context.collectStatements();

    const playerIds = context.getPlayerIds();
    playerIds.forEach(id => this.spokePlayers.add(id));

    context.logAuditEvent('DAY_DISCUSSION_COMPLETED', {
      statementsCollected: this.spokePlayers.size,
      timestamp: Date.now()
    });
  }

  /**
   * @summary Called when exiting day phase.
   *
   * @description
   * Logs the end of discussion and prepares for voting.
   *
   * @param {IGameContext} context - The game context
   */
  async exit(context: IGameContext): Promise<void> {
    context.logAuditEvent('DAY_ENDED', {
      phase: this.getName(),
      nextPhase: GamePhase.VOTING,
      playerSpoke: Array.from(this.spokePlayers),
      timestamp: Date.now()
    });
  }

  /**
   * @summary Returns the next phase state.
   *
   * @description
   * After day discussion, players vote to eliminate someone.
   *
   * @returns {IGamePhaseState} A new VotingPhase instance
   */
  getNextState(): IGamePhaseState {
    return new VotingPhase();
  }
}
