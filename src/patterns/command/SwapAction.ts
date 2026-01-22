/**
 * @fileoverview Swap action command implementation.
 * @module patterns/command/SwapAction
 *
 * @summary Represents a card swap action in the game.
 *
 * @description
 * A SwapAction records when two card positions are swapped.
 * This occurs during:
 * - Robber stealing a card
 * - Troublemaker swapping two players
 * - Drunk swapping with center
 * - Doppelganger performing any of the above
 *
 * @pattern Command Pattern - Concrete Command for swaps
 *
 * @example
 * ```typescript
 * // Robber swaps with another player
 * const robberSwap = new SwapAction(
 *   'player-1',
 *   GamePhase.NIGHT,
 *   RoleName.ROBBER,
 *   { playerId: 'player-1' },
 *   { playerId: 'player-3' }
 * );
 *
 * // Drunk swaps with center
 * const drunkSwap = new SwapAction(
 *   'player-2',
 *   GamePhase.NIGHT,
 *   RoleName.DRUNK,
 *   { playerId: 'player-2' },
 *   { centerIndex: 1 }
 * );
 * ```
 */

import { GamePhase, RoleName } from '../../enums';
import { CardPosition } from '../../types';
import { AbstractGameAction } from './GameAction';

/**
 * @summary Command representing a card swap.
 *
 * @description
 * Encapsulates all information about a card swap:
 * - Who initiated the swap
 * - What role they were using
 * - Which two positions were swapped
 *
 * @pattern Command Pattern - Concrete Command
 *
 * @example
 * ```typescript
 * const swap = new SwapAction(
 *   'player-1',
 *   GamePhase.NIGHT,
 *   RoleName.TROUBLEMAKER,
 *   { playerId: 'player-2' },
 *   { playerId: 'player-4' }
 * );
 *
 * console.log(swap.getDescription());
 * // "player-1 (TROUBLEMAKER) swapped player-2 with player-4"
 * ```
 */
export class SwapAction extends AbstractGameAction {
  /** The role that performed the swap */
  public readonly roleName: RoleName;

  /** First position in the swap */
  public readonly position1: CardPosition;

  /** Second position in the swap */
  public readonly position2: CardPosition;

  /**
   * @summary Creates a new SwapAction.
   *
   * @param {string} actorId - Player who initiated the swap
   * @param {GamePhase} phase - Current game phase
   * @param {RoleName} roleName - Role performing the swap
   * @param {CardPosition} position1 - First position
   * @param {CardPosition} position2 - Second position
   *
   * @example
   * ```typescript
   * const swap = new SwapAction(
   *   'player-1',
   *   GamePhase.NIGHT,
   *   RoleName.ROBBER,
   *   { playerId: 'player-1' },
   *   { playerId: 'player-3' }
   * );
   * ```
   */
  constructor(
    actorId: string,
    phase: GamePhase,
    roleName: RoleName,
    position1: CardPosition,
    position2: CardPosition
  ) {
    super(actorId, phase);
    this.roleName = roleName;
    this.position1 = position1;
    this.position2 = position2;
  }

  /**
   * @summary Returns the action type.
   *
   * @returns {'SWAP'} Always returns 'SWAP'
   */
  getType(): string {
    return 'SWAP';
  }

  /**
   * @summary Gets the swap details.
   *
   * @returns {Record<string, unknown>} Position and role information
   */
  getDetails(): Record<string, unknown> {
    return {
      roleName: this.roleName,
      position1: this.position1,
      position2: this.position2
    };
  }

  /**
   * @summary Gets a human-readable description of the swap.
   *
   * @returns {string} Description of who swapped what
   *
   * @example
   * ```typescript
   * swap.getDescription();
   * // "player-1 (ROBBER) swapped player-1 with player-3"
   * ```
   */
  getDescription(): string {
    const pos1Str = this.formatPosition(this.position1);
    const pos2Str = this.formatPosition(this.position2);
    return `${this.actorId} (${this.roleName}) swapped ${pos1Str} with ${pos2Str}`;
  }

  /**
   * @summary Formats a card position for display.
   *
   * @param {CardPosition} pos - Position to format
   *
   * @returns {string} Formatted position string
   *
   * @private
   */
  private formatPosition(pos: CardPosition): string {
    if (pos.playerId !== undefined) {
      return pos.playerId;
    }
    if (pos.centerIndex !== undefined) {
      return `center[${pos.centerIndex}]`;
    }
    return 'unknown';
  }
}
