/**
 * @fileoverview Voting phase state implementation.
 * @module patterns/state/VotingPhase
 *
 * @summary Handles the voting phase where players vote to eliminate.
 *
 * @description
 * The Voting phase is the decision point:
 * - All players simultaneously point at who they want to eliminate
 * - The player(s) with the most votes are eliminated
 * - In case of ties, all tied players are eliminated
 * - Special rule: If all players receive exactly 1 vote, no one dies
 *
 * @pattern State Pattern - Concrete State for Voting phase
 *
 * @remarks
 * Voting is simultaneous to prevent last-vote manipulation.
 * Each player must vote for exactly one other player (or themselves
 * in rare strategic situations). Players cannot abstain.
 *
 * @example
 * ```typescript
 * const votingPhase = new VotingPhase();
 * await votingPhase.execute(gameContext);
 * // All votes collected simultaneously
 * const nextPhase = votingPhase.getNextState(); // ResolutionPhase
 * ```
 */

import { GamePhase } from '../../enums';
import {
  AbstractGamePhaseState,
  IGamePhaseState,
  IGameContext
} from './GamePhaseState';
import { ResolutionPhase } from './ResolutionPhase';

/**
 * @summary Voting phase state - handles vote collection.
 *
 * @description
 * During this phase:
 * 1. All players decide who to vote for
 * 2. Votes are collected simultaneously (no player sees others' votes first)
 * 3. Vote totals are tallied
 * 4. Results determine who is eliminated
 *
 * @pattern State Pattern - Concrete State
 *
 * @remarks
 * The simultaneity is important for fairness. In physical games,
 * players count down and point together. For AI agents, all agents
 * make their decision based on the same information state.
 *
 * @example
 * ```typescript
 * const voting = new VotingPhase();
 * await voting.execute(gameContext);
 * // Votes: Player1 -> Player3
 * //        Player2 -> Player3
 * //        Player3 -> Player1
 * // Result: Player3 eliminated with 2 votes
 * ```
 */
export class VotingPhase extends AbstractGamePhaseState {
  /** Valid actions during voting phase */
  private static readonly VALID_ACTIONS = new Set([
    'CAST_VOTE',
    'VOTE'
  ]);

  /** Stores collected votes: voterPlayerId -> targetPlayerId */
  private votes: Map<string, string> = new Map();

  /**
   * @summary Creates a new VotingPhase instance.
   *
   * @example
   * ```typescript
   * const voting = new VotingPhase();
   * ```
   */
  constructor() {
    super();
  }

  /**
   * @summary Returns the phase name.
   *
   * @returns {GamePhase} GamePhase.VOTING
   */
  getName(): GamePhase {
    return GamePhase.VOTING;
  }

  /**
   * @summary Returns valid actions for this phase.
   *
   * @returns {Set<string>} Set containing 'CAST_VOTE' and 'VOTE'
   *
   * @protected
   */
  protected getValidActions(): Set<string> {
    return VotingPhase.VALID_ACTIONS;
  }

  /**
   * @summary Called when entering voting phase.
   *
   * @description
   * Logs the start of voting and clears any previous votes.
   *
   * @param {IGameContext} context - The game context
   */
  async enter(context: IGameContext): Promise<void> {
    this.votes.clear();

    context.logAuditEvent('VOTING_STARTED', {
      phase: this.getName(),
      eligibleVoters: context.getPlayerIds(),
      timestamp: Date.now()
    });
  }

  /**
   * @summary Executes the voting phase.
   *
   * @description
   * Collects votes from all players simultaneously.
   * The Game's collectVotes method ensures fairness.
   *
   * @param {IGameContext} context - The game context
   *
   * @throws {Error} If vote collection fails or a player doesn't vote
   *
   * @remarks
   * After votes are collected, they are tallied but not revealed
   * until the Resolution phase. This allows for proper Hunter handling.
   *
   * @example
   * ```typescript
   * await votingPhase.execute(gameContext);
   * // All votes collected; ready for resolution
   * ```
   */
  async execute(context: IGameContext): Promise<void> {
    context.logAuditEvent('VOTE_COLLECTION_STARTED', {
      timestamp: Date.now()
    });

    // Delegate to game context to collect all votes
    await context.collectVotes();

    context.logAuditEvent('VOTE_COLLECTION_COMPLETED', {
      voterCount: context.getPlayerIds().length,
      timestamp: Date.now()
    });
  }

  /**
   * @summary Called when exiting voting phase.
   *
   * @description
   * Logs the completion of voting. Vote results will be
   * processed in the Resolution phase.
   *
   * @param {IGameContext} context - The game context
   */
  async exit(context: IGameContext): Promise<void> {
    context.logAuditEvent('VOTING_ENDED', {
      phase: this.getName(),
      nextPhase: GamePhase.RESOLUTION,
      timestamp: Date.now()
    });
  }

  /**
   * @summary Returns the next phase state.
   *
   * @description
   * After voting, the game resolves to determine winners.
   *
   * @returns {IGamePhaseState} A new ResolutionPhase instance
   */
  getNextState(): IGamePhaseState {
    return new ResolutionPhase();
  }
}
