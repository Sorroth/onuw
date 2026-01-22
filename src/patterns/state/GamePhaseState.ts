/**
 * @fileoverview State Pattern interface for game phases.
 * @module patterns/state/GamePhaseState
 *
 * @summary Defines the contract for all game phase states.
 *
 * @description
 * The State Pattern is used to manage game phase transitions. Each phase
 * (Setup, Night, Day, Voting, Resolution) has different valid actions and
 * behaviors. By encapsulating phase-specific logic in state objects, we:
 * - Eliminate large switch/if-else blocks in the Game class
 * - Make adding new phases straightforward
 * - Ensure only valid actions can occur in each phase
 *
 * @pattern State Pattern
 * - Context: Game class holds current state and delegates to it
 * - State: IGamePhaseState interface defines phase contract
 * - ConcreteStates: SetupPhase, NightPhase, DayPhase, VotingPhase, ResolutionPhase
 *
 * @remarks
 * The game progresses linearly: Setup -> Night -> Day -> Voting -> Resolution
 * There are no backward transitions in One Night Ultimate Werewolf.
 *
 * @example
 * ```typescript
 * // Game context delegates to current state
 * class Game {
 *   private currentState: IGamePhaseState;
 *
 *   async executePhase(): Promise<void> {
 *     await this.currentState.execute(this);
 *     this.currentState = this.currentState.getNextState();
 *   }
 * }
 * ```
 */

import { GamePhase } from '../../enums';

/**
 * Forward declaration of Game class to avoid circular dependencies.
 * The actual Game class will implement IGameContext.
 */
export interface IGameContext {
  /** Get the current game phase */
  getPhase(): GamePhase;

  /** Set the current phase state */
  setPhaseState(state: IGamePhaseState): void;

  /** Get all player IDs */
  getPlayerIds(): string[];

  /** Get roles in the game */
  getRolesInGame(): string[];

  /** Execute night actions for a specific role order position */
  executeNightActionsForRole(roleOrder: number): Promise<void>;

  /** Collect statements from all players */
  collectStatements(): Promise<void>;

  /** Collect votes from all players */
  collectVotes(): Promise<void>;

  /** Resolve the game and determine winners */
  resolveGame(): Promise<void>;

  /** Log an event to the audit system */
  logAuditEvent(action: string, details: Record<string, unknown>): void;
}

/**
 * @summary Interface for game phase state objects.
 *
 * @description
 * Each game phase implements this interface to define:
 * - What happens when entering the phase (enter)
 * - What actions occur during the phase (execute)
 * - What happens when leaving the phase (exit)
 * - What the next phase is (getNextState)
 *
 * @pattern State Pattern - This is the State interface
 *
 * @remarks
 * The execute method is async to allow for agent decision-making
 * which may involve delays or external calls.
 *
 * @example
 * ```typescript
 * class NightPhase implements IGamePhaseState {
 *   getName(): GamePhase { return GamePhase.NIGHT; }
 *
 *   async execute(context: IGameContext): Promise<void> {
 *     // Execute night actions in order
 *     for (let order = 1; order <= 9; order++) {
 *       await context.executeNightActionsForRole(order);
 *     }
 *   }
 *
 *   getNextState(): IGamePhaseState {
 *     return new DayPhase();
 *   }
 * }
 * ```
 */
export interface IGamePhaseState {
  /**
   * @summary Gets the name/identifier of this phase.
   *
   * @returns {GamePhase} The enum value representing this phase
   *
   * @example
   * ```typescript
   * const phase = currentState.getName(); // GamePhase.NIGHT
   * ```
   */
  getName(): GamePhase;

  /**
   * @summary Called when entering this phase.
   *
   * @description
   * Performs any setup needed when transitioning into this phase.
   * Called before execute().
   *
   * @param {IGameContext} context - The game context
   *
   * @example
   * ```typescript
   * async enter(context: IGameContext): Promise<void> {
   *   context.logAuditEvent('PHASE_ENTERED', { phase: this.getName() });
   * }
   * ```
   */
  enter(context: IGameContext): Promise<void>;

  /**
   * @summary Executes the main logic of this phase.
   *
   * @description
   * Performs all actions that occur during this phase.
   * For Night: executes all night actions in order.
   * For Day: collects player statements.
   * For Voting: collects and tallies votes.
   *
   * @param {IGameContext} context - The game context
   *
   * @throws {Error} If phase execution fails
   *
   * @example
   * ```typescript
   * async execute(context: IGameContext): Promise<void> {
   *   await context.collectStatements();
   * }
   * ```
   */
  execute(context: IGameContext): Promise<void>;

  /**
   * @summary Called when exiting this phase.
   *
   * @description
   * Performs any cleanup needed when transitioning out of this phase.
   * Called after execute() and before transitioning to next state.
   *
   * @param {IGameContext} context - The game context
   *
   * @example
   * ```typescript
   * async exit(context: IGameContext): Promise<void> {
   *   context.logAuditEvent('PHASE_EXITED', { phase: this.getName() });
   * }
   * ```
   */
  exit(context: IGameContext): Promise<void>;

  /**
   * @summary Gets the next phase state to transition to.
   *
   * @description
   * Returns a new instance of the next phase state.
   * In ONUW, progression is linear: Setup -> Night -> Day -> Voting -> Resolution
   *
   * @returns {IGamePhaseState | null} The next state, or null if game is over
   *
   * @example
   * ```typescript
   * // In NightPhase
   * getNextState(): IGamePhaseState {
   *   return new DayPhase();
   * }
   * ```
   */
  getNextState(): IGamePhaseState | null;

  /**
   * @summary Checks if a specific action is valid in this phase.
   *
   * @description
   * Used for validation before attempting an action.
   * Different phases allow different actions.
   *
   * @param {string} action - The action to validate
   * @returns {boolean} True if the action is valid in this phase
   *
   * @example
   * ```typescript
   * if (currentState.isValidAction('VOTE')) {
   *   // Process the vote
   * }
   * ```
   */
  isValidAction(action: string): boolean;
}

/**
 * @summary Abstract base class for game phase states.
 *
 * @description
 * Provides default implementations for common phase behavior.
 * Concrete phase classes extend this and override as needed.
 *
 * @pattern State Pattern - Abstract State with default behavior
 * @pattern Template Method Pattern - Defines algorithm skeleton
 *
 * @remarks
 * Using an abstract class allows sharing common logic like logging
 * while still requiring concrete classes to implement phase-specific behavior.
 *
 * @example
 * ```typescript
 * class NightPhase extends AbstractGamePhaseState {
 *   getName(): GamePhase {
 *     return GamePhase.NIGHT;
 *   }
 *
 *   protected getValidActions(): Set<string> {
 *     return new Set(['NIGHT_ACTION']);
 *   }
 *
 *   async execute(context: IGameContext): Promise<void> {
 *     // Night-specific logic
 *   }
 *
 *   getNextState(): IGamePhaseState {
 *     return new DayPhase();
 *   }
 * }
 * ```
 */
export abstract class AbstractGamePhaseState implements IGamePhaseState {
  /**
   * @summary Gets the name of this phase.
   * @abstract Must be implemented by concrete classes.
   */
  abstract getName(): GamePhase;

  /**
   * @summary Gets the set of valid actions for this phase.
   *
   * @description
   * Override in concrete classes to define what actions are allowed.
   *
   * @returns {Set<string>} Set of valid action names
   *
   * @protected
   */
  protected abstract getValidActions(): Set<string>;

  /**
   * @summary Default enter behavior - logs phase entry.
   *
   * @param {IGameContext} context - The game context
   *
   * @remarks
   * Override in concrete classes if additional setup is needed.
   */
  async enter(context: IGameContext): Promise<void> {
    context.logAuditEvent('PHASE_ENTERED', {
      phase: this.getName(),
      timestamp: Date.now()
    });
  }

  /**
   * @summary Executes phase-specific logic.
   * @abstract Must be implemented by concrete classes.
   */
  abstract execute(context: IGameContext): Promise<void>;

  /**
   * @summary Default exit behavior - logs phase exit.
   *
   * @param {IGameContext} context - The game context
   *
   * @remarks
   * Override in concrete classes if additional cleanup is needed.
   */
  async exit(context: IGameContext): Promise<void> {
    context.logAuditEvent('PHASE_EXITED', {
      phase: this.getName(),
      timestamp: Date.now()
    });
  }

  /**
   * @summary Gets the next phase state.
   * @abstract Must be implemented by concrete classes.
   */
  abstract getNextState(): IGamePhaseState | null;

  /**
   * @summary Checks if an action is valid in this phase.
   *
   * @param {string} action - The action to validate
   * @returns {boolean} True if the action is in the valid actions set
   */
  isValidAction(action: string): boolean {
    return this.getValidActions().has(action);
  }
}
