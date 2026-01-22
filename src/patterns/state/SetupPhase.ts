/**
 * @fileoverview Setup phase state implementation.
 * @module patterns/state/SetupPhase
 *
 * @summary Handles the initial setup phase where roles are dealt.
 *
 * @description
 * The Setup phase is the first phase of the game where:
 * - Players are registered
 * - Roles are shuffled and dealt
 * - Three cards go to the center
 * - Each player receives their starting role
 *
 * @pattern State Pattern - Concrete State for Setup phase
 *
 * @example
 * ```typescript
 * const setupPhase = new SetupPhase();
 * await setupPhase.enter(gameContext);
 * await setupPhase.execute(gameContext);
 * const nextPhase = setupPhase.getNextState(); // NightPhase
 * ```
 */

import { GamePhase } from '../../enums';
import {
  AbstractGamePhaseState,
  IGamePhaseState,
  IGameContext
} from './GamePhaseState';
import { NightPhase } from './NightPhase';

/**
 * @summary Setup phase state - handles initial game setup.
 *
 * @description
 * During this phase:
 * 1. Validates game configuration (correct number of roles)
 * 2. Shuffles all role cards
 * 3. Deals one card to each player
 * 4. Places three cards in the center
 * 5. Informs each player of their starting role
 *
 * @pattern State Pattern - Concrete State
 *
 * @remarks
 * This phase has no player actions - it's purely administrative.
 * The Game class handles the actual card dealing; this state just
 * orchestrates the process and ensures proper transitions.
 *
 * @example
 * ```typescript
 * const game = new Game(config);
 * // Game starts in SetupPhase automatically
 * await game.start(); // Executes setup and moves to NightPhase
 * ```
 */
export class SetupPhase extends AbstractGamePhaseState {
  /** Valid actions during setup phase */
  private static readonly VALID_ACTIONS = new Set([
    'DEAL_CARDS',
    'REGISTER_PLAYER'
  ]);

  /**
   * @summary Creates a new SetupPhase instance.
   *
   * @example
   * ```typescript
   * const setup = new SetupPhase();
   * ```
   */
  constructor() {
    super();
  }

  /**
   * @summary Returns the phase name.
   *
   * @returns {GamePhase} GamePhase.SETUP
   *
   * @example
   * ```typescript
   * setupPhase.getName(); // GamePhase.SETUP
   * ```
   */
  getName(): GamePhase {
    return GamePhase.SETUP;
  }

  /**
   * @summary Returns valid actions for this phase.
   *
   * @returns {Set<string>} Set containing 'DEAL_CARDS' and 'REGISTER_PLAYER'
   *
   * @protected
   */
  protected getValidActions(): Set<string> {
    return SetupPhase.VALID_ACTIONS;
  }

  /**
   * @summary Called when entering setup phase.
   *
   * @description
   * Logs the game start event with configuration details.
   *
   * @param {IGameContext} context - The game context
   *
   * @example
   * ```typescript
   * await setupPhase.enter(gameContext);
   * // Logs: GAME_STARTED with player list and roles
   * ```
   */
  async enter(context: IGameContext): Promise<void> {
    context.logAuditEvent('GAME_STARTED', {
      phase: this.getName(),
      playerCount: context.getPlayerIds().length,
      roles: context.getRolesInGame(),
      timestamp: Date.now()
    });
  }

  /**
   * @summary Executes the setup phase.
   *
   * @description
   * In the setup phase, the Game class has already dealt cards
   * during construction. This method logs the setup completion
   * and prepares for the night phase.
   *
   * @param {IGameContext} context - The game context
   *
   * @remarks
   * The actual card dealing happens in Game.constructor() or
   * a dedicated setup method. This execute() confirms the setup
   * is valid and logs the starting state.
   *
   * @example
   * ```typescript
   * await setupPhase.execute(gameContext);
   * // Validates setup and logs initial state
   * ```
   */
  async execute(context: IGameContext): Promise<void> {
    const playerIds = context.getPlayerIds();
    const roles = context.getRolesInGame();

    // Validate setup
    if (roles.length !== playerIds.length + 3) {
      throw new Error(
        `Invalid setup: Expected ${playerIds.length + 3} roles for ${playerIds.length} players, got ${roles.length}`
      );
    }

    context.logAuditEvent('SETUP_COMPLETE', {
      playerCount: playerIds.length,
      roleCount: roles.length,
      centerCards: 3,
      timestamp: Date.now()
    });
  }

  /**
   * @summary Called when exiting setup phase.
   *
   * @description
   * Logs the transition to night phase.
   *
   * @param {IGameContext} context - The game context
   *
   * @example
   * ```typescript
   * await setupPhase.exit(gameContext);
   * // Logs: PHASE_EXITED and prepares for night
   * ```
   */
  async exit(context: IGameContext): Promise<void> {
    context.logAuditEvent('PHASE_EXITED', {
      phase: this.getName(),
      nextPhase: GamePhase.NIGHT,
      timestamp: Date.now()
    });
  }

  /**
   * @summary Returns the next phase state.
   *
   * @description
   * After setup, the game moves to the night phase where
   * roles wake and perform their actions.
   *
   * @returns {IGamePhaseState} A new NightPhase instance
   *
   * @example
   * ```typescript
   * const nextPhase = setupPhase.getNextState();
   * // nextPhase instanceof NightPhase === true
   * ```
   */
  getNextState(): IGamePhaseState {
    return new NightPhase();
  }
}
