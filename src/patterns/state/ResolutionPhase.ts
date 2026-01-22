/**
 * @fileoverview Resolution phase state implementation.
 * @module patterns/state/ResolutionPhase
 *
 * @summary Handles the final resolution phase where winners are determined.
 *
 * @description
 * The Resolution phase concludes the game:
 * - Vote counts are tallied
 * - Player(s) with most votes are eliminated
 * - Win conditions are checked against current (not starting) roles
 * - Hunter's ability triggers if applicable
 * - Winners are announced
 *
 * @pattern State Pattern - Concrete State for Resolution phase
 *
 * @remarks
 * Win condition rules:
 * - **Village wins** if at least one Werewolf dies
 * - **Werewolf team wins** if no Werewolves die
 * - **Minion** wins with Werewolves (and can die without losing)
 * - **Tanner wins** if Tanner dies (Werewolves CANNOT win if Tanner dies)
 * - **Special**: If no Werewolves in game, Village wins if Minion dies OR no one dies
 * - **Special**: If everyone gets exactly 1 vote, no one dies
 *
 * @example
 * ```typescript
 * const resolution = new ResolutionPhase();
 * await resolution.execute(gameContext);
 * // Game ends, winners determined
 * const next = resolution.getNextState(); // null (game over)
 * ```
 */

import { GamePhase } from '../../enums';
import {
  AbstractGamePhaseState,
  IGamePhaseState,
  IGameContext
} from './GamePhaseState';

/**
 * @summary Resolution phase state - handles game conclusion.
 *
 * @description
 * During this phase:
 * 1. Votes are tallied to find elimination target(s)
 * 2. If Hunter is eliminated, their vote target also dies
 * 3. Final roles are revealed (cards may have been swapped)
 * 4. Win conditions are evaluated
 * 5. Winners are declared
 *
 * @pattern State Pattern - Concrete State (terminal state)
 *
 * @remarks
 * This is the terminal state - getNextState() returns null.
 * The game cannot continue past resolution.
 *
 * Important: Players win/lose based on their CURRENT card,
 * not their starting card. If a Robber stole a Werewolf card,
 * they are now on the Werewolf team!
 *
 * @example
 * ```typescript
 * const resolution = new ResolutionPhase();
 * await resolution.execute(gameContext);
 * // Results:
 * // - Player 3 eliminated (was Werewolf)
 * // - Village team wins!
 * ```
 */
export class ResolutionPhase extends AbstractGamePhaseState {
  /** Valid actions during resolution phase */
  private static readonly VALID_ACTIONS = new Set([
    'REVEAL_VOTES',
    'ELIMINATE',
    'DETERMINE_WINNER'
  ]);

  /**
   * @summary Creates a new ResolutionPhase instance.
   *
   * @example
   * ```typescript
   * const resolution = new ResolutionPhase();
   * ```
   */
  constructor() {
    super();
  }

  /**
   * @summary Returns the phase name.
   *
   * @returns {GamePhase} GamePhase.RESOLUTION
   */
  getName(): GamePhase {
    return GamePhase.RESOLUTION;
  }

  /**
   * @summary Returns valid actions for this phase.
   *
   * @returns {Set<string>} Set of valid resolution actions
   *
   * @protected
   */
  protected getValidActions(): Set<string> {
    return ResolutionPhase.VALID_ACTIONS;
  }

  /**
   * @summary Called when entering resolution phase.
   *
   * @description
   * Logs the start of resolution. At this point, all votes
   * have been collected and are ready to be tallied.
   *
   * @param {IGameContext} context - The game context
   */
  async enter(context: IGameContext): Promise<void> {
    context.logAuditEvent('RESOLUTION_STARTED', {
      phase: this.getName(),
      timestamp: Date.now()
    });
  }

  /**
   * @summary Executes the resolution phase.
   *
   * @description
   * Resolves the game by:
   * 1. Tallying votes
   * 2. Determining eliminations (including ties)
   * 3. Processing Hunter ability if applicable
   * 4. Evaluating win conditions
   * 5. Declaring winners
   *
   * @param {IGameContext} context - The game context
   *
   * @throws {Error} If resolution logic fails
   *
   * @remarks
   * The resolution logic handles several edge cases:
   * - If all players get exactly 1 vote, no one dies
   * - If there's a tie for most votes, all tied players die
   * - If Hunter dies, their vote target also dies
   * - Win conditions check CURRENT roles, not starting roles
   *
   * @example
   * ```typescript
   * await resolutionPhase.execute(gameContext);
   * // Votes: P1->P3, P2->P3, P3->P1, P4->P3
   * // P3 eliminated (3 votes)
   * // P3's current card: Werewolf
   * // Winner: Village team
   * ```
   */
  async execute(context: IGameContext): Promise<void> {
    context.logAuditEvent('RESOLUTION_EXECUTION_STARTED', {
      timestamp: Date.now()
    });

    // Delegate to game context to resolve the game
    // This includes vote tallying, eliminations, and win determination
    await context.resolveGame();

    context.logAuditEvent('RESOLUTION_EXECUTION_COMPLETED', {
      timestamp: Date.now()
    });
  }

  /**
   * @summary Called when exiting resolution phase.
   *
   * @description
   * Logs the end of the game. This is the final phase.
   *
   * @param {IGameContext} context - The game context
   */
  async exit(context: IGameContext): Promise<void> {
    context.logAuditEvent('GAME_ENDED', {
      phase: this.getName(),
      timestamp: Date.now()
    });
  }

  /**
   * @summary Returns the next phase state.
   *
   * @description
   * Resolution is the terminal state - there is no next phase.
   * The game is over after resolution completes.
   *
   * @returns {null} Always returns null (game over)
   */
  getNextState(): IGamePhaseState | null {
    return null; // Game is over
  }
}
