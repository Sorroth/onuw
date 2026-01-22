/**
 * @fileoverview Night phase state implementation.
 * @module patterns/state/NightPhase
 *
 * @summary Handles the night phase where roles wake and perform actions.
 *
 * @description
 * The Night phase is where the core gameplay mechanics occur:
 * - Roles wake in a specific order (1-9)
 * - Each role performs their unique ability
 * - Cards may be viewed or swapped
 * - Players learn information based on their role
 *
 * @pattern State Pattern - Concrete State for Night phase
 * @pattern Template Method Pattern - Night execution follows fixed order
 *
 * @remarks
 * The wake order is critical:
 * 1. Doppelganger - copies a role
 * 2. Werewolf - sees other werewolves
 * 3. Minion - sees werewolves
 * 4. Mason - sees other masons
 * 5. Seer - views cards
 * 6. Robber - swaps and views
 * 7. Troublemaker - swaps two others
 * 8. Drunk - swaps with center
 * 9. Insomniac - views own card
 *
 * @example
 * ```typescript
 * const nightPhase = new NightPhase();
 * await nightPhase.execute(gameContext);
 * // All night actions executed in order
 * const nextPhase = nightPhase.getNextState(); // DayPhase
 * ```
 */

import { GamePhase, NIGHT_WAKE_ORDER } from '../../enums';
import {
  AbstractGamePhaseState,
  IGamePhaseState,
  IGameContext
} from './GamePhaseState';
import { DayPhase } from './DayPhase';

/**
 * @summary Night phase state - handles night action execution.
 *
 * @description
 * During this phase:
 * 1. Each role wakes in the defined order
 * 2. Players with that role make their choices
 * 3. Actions are executed (view, swap, etc.)
 * 4. Results are recorded for the acting player
 * 5. Audit log tracks all actions
 *
 * @pattern State Pattern - Concrete State
 * @pattern Template Method Pattern - Fixed algorithm for night execution
 *
 * @remarks
 * Important rule: Players act based on their STARTING role, not their
 * current card. If a Robber steals the Seer card, the original Seer
 * already acted (Seer wakes before Robber), and the Robber does not
 * get a Seer action.
 *
 * @example
 * ```typescript
 * // Night phase executes all actions automatically
 * const night = new NightPhase();
 * await night.execute(gameContext);
 * ```
 */
export class NightPhase extends AbstractGamePhaseState {
  /** Valid actions during night phase */
  private static readonly VALID_ACTIONS = new Set([
    'NIGHT_ACTION',
    'VIEW_CARD',
    'SWAP_CARDS',
    'COPY_ROLE'
  ]);

  /** Tracks which role orders have been processed */
  private processedOrders: Set<number> = new Set();

  /**
   * @summary Creates a new NightPhase instance.
   *
   * @example
   * ```typescript
   * const night = new NightPhase();
   * ```
   */
  constructor() {
    super();
  }

  /**
   * @summary Returns the phase name.
   *
   * @returns {GamePhase} GamePhase.NIGHT
   */
  getName(): GamePhase {
    return GamePhase.NIGHT;
  }

  /**
   * @summary Returns valid actions for this phase.
   *
   * @returns {Set<string>} Set of valid night actions
   *
   * @protected
   */
  protected getValidActions(): Set<string> {
    return NightPhase.VALID_ACTIONS;
  }

  /**
   * @summary Called when entering night phase.
   *
   * @description
   * Logs the start of night and resets processed orders.
   *
   * @param {IGameContext} context - The game context
   */
  async enter(context: IGameContext): Promise<void> {
    this.processedOrders.clear();

    context.logAuditEvent('NIGHT_STARTED', {
      phase: this.getName(),
      wakeOrder: NIGHT_WAKE_ORDER,
      timestamp: Date.now()
    });
  }

  /**
   * @summary Executes the night phase.
   *
   * @description
   * Iterates through all role wake orders (1-9) and executes
   * night actions for any players with roles at that order.
   *
   * The order is critical for game correctness:
   * - Earlier roles act on original game state
   * - Later roles may see/act on modified state
   *
   * @param {IGameContext} context - The game context
   *
   * @throws {Error} If night action execution fails
   *
   * @remarks
   * Each role order is processed once, even if multiple players
   * have the same role (e.g., two Werewolves both see each other
   * at order 2).
   *
   * @example
   * ```typescript
   * await nightPhase.execute(gameContext);
   * // Order 1: Doppelganger acts
   * // Order 2: All Werewolves see each other
   * // Order 3: Minion sees Werewolves
   * // ... etc.
   * ```
   */
  async execute(context: IGameContext): Promise<void> {
    context.logAuditEvent('NIGHT_EXECUTION_STARTED', {
      timestamp: Date.now()
    });

    // Execute night actions in order (1 through 9)
    for (let order = 1; order <= 9; order++) {
      if (this.processedOrders.has(order)) {
        continue; // Already processed (shouldn't happen normally)
      }

      context.logAuditEvent('NIGHT_ORDER_STARTED', {
        order,
        timestamp: Date.now()
      });

      await context.executeNightActionsForRole(order);
      this.processedOrders.add(order);

      context.logAuditEvent('NIGHT_ORDER_COMPLETED', {
        order,
        timestamp: Date.now()
      });
    }

    context.logAuditEvent('NIGHT_EXECUTION_COMPLETED', {
      processedOrders: Array.from(this.processedOrders),
      timestamp: Date.now()
    });
  }

  /**
   * @summary Called when exiting night phase.
   *
   * @description
   * Logs the end of night and prepares for day discussion.
   *
   * @param {IGameContext} context - The game context
   */
  async exit(context: IGameContext): Promise<void> {
    context.logAuditEvent('NIGHT_ENDED', {
      phase: this.getName(),
      nextPhase: GamePhase.DAY,
      timestamp: Date.now()
    });
  }

  /**
   * @summary Returns the next phase state.
   *
   * @description
   * After night, the game moves to the day phase where
   * players discuss and make claims.
   *
   * @returns {IGamePhaseState} A new DayPhase instance
   */
  getNextState(): IGamePhaseState {
    return new DayPhase();
  }
}
