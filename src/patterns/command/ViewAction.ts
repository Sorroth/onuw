/**
 * @fileoverview View action command implementation.
 * @module patterns/command/ViewAction
 *
 * @summary Represents a card viewing action in the game.
 *
 * @description
 * A ViewAction records when a player views one or more cards.
 * This occurs during:
 * - Seer viewing a player or center cards
 * - Werewolf lone wolf viewing center
 * - Robber viewing stolen card
 * - Insomniac viewing own card
 * - Doppelganger viewing copied role
 *
 * @pattern Command Pattern - Concrete Command for views
 *
 * @example
 * ```typescript
 * // Seer views a player
 * const seerView = new ViewAction(
 *   'player-1',
 *   GamePhase.NIGHT,
 *   RoleName.SEER,
 *   [{ playerId: 'player-3', role: RoleName.WEREWOLF }]
 * );
 *
 * // Seer views center cards
 * const centerView = new ViewAction(
 *   'player-1',
 *   GamePhase.NIGHT,
 *   RoleName.SEER,
 *   [
 *     { centerIndex: 0, role: RoleName.VILLAGER },
 *     { centerIndex: 2, role: RoleName.DRUNK }
 *   ]
 * );
 * ```
 */

import { GamePhase, RoleName } from '../../enums';
import { ViewedCard } from '../../types';
import { AbstractGameAction } from './GameAction';

/**
 * @summary Command representing a card view.
 *
 * @description
 * Encapsulates all information about a card viewing:
 * - Who viewed
 * - What role they were using
 * - What cards were seen and their roles
 *
 * @pattern Command Pattern - Concrete Command
 *
 * @example
 * ```typescript
 * const view = new ViewAction(
 *   'player-1',
 *   GamePhase.NIGHT,
 *   RoleName.SEER,
 *   [{ playerId: 'player-2', role: RoleName.WEREWOLF }]
 * );
 *
 * console.log(view.getDescription());
 * // "player-1 (SEER) viewed player-2: WEREWOLF"
 * ```
 */
export class ViewAction extends AbstractGameAction {
  /** The role that performed the view */
  public readonly roleName: RoleName;

  /** Cards that were viewed */
  public readonly viewedCards: ViewedCard[];

  /**
   * @summary Creates a new ViewAction.
   *
   * @param {string} actorId - Player who performed the view
   * @param {GamePhase} phase - Current game phase
   * @param {RoleName} roleName - Role performing the view
   * @param {ViewedCard[]} viewedCards - Cards that were seen
   *
   * @example
   * ```typescript
   * const view = new ViewAction(
   *   'player-1',
   *   GamePhase.NIGHT,
   *   RoleName.INSOMNIAC,
   *   [{ playerId: 'player-1', role: RoleName.WEREWOLF }]
   * );
   * ```
   */
  constructor(
    actorId: string,
    phase: GamePhase,
    roleName: RoleName,
    viewedCards: ViewedCard[]
  ) {
    super(actorId, phase);
    this.roleName = roleName;
    this.viewedCards = viewedCards;
  }

  /**
   * @summary Returns the action type.
   *
   * @returns {'VIEW'} Always returns 'VIEW'
   */
  getType(): string {
    return 'VIEW';
  }

  /**
   * @summary Gets the view details.
   *
   * @returns {Record<string, unknown>} Role and viewed cards information
   */
  getDetails(): Record<string, unknown> {
    return {
      roleName: this.roleName,
      viewedCards: this.viewedCards
    };
  }

  /**
   * @summary Gets a human-readable description of the view.
   *
   * @returns {string} Description of what was viewed
   *
   * @example
   * ```typescript
   * view.getDescription();
   * // "player-1 (SEER) viewed player-2: WEREWOLF"
   * ```
   */
  getDescription(): string {
    if (this.viewedCards.length === 0) {
      return `${this.actorId} (${this.roleName}) viewed nothing`;
    }

    const viewedStr = this.viewedCards
      .map(vc => this.formatViewedCard(vc))
      .join(', ');

    return `${this.actorId} (${this.roleName}) viewed ${viewedStr}`;
  }

  /**
   * @summary Formats a viewed card for display.
   *
   * @param {ViewedCard} vc - Viewed card to format
   *
   * @returns {string} Formatted view string
   *
   * @private
   */
  private formatViewedCard(vc: ViewedCard): string {
    if (vc.playerId !== undefined) {
      return `${vc.playerId}: ${vc.role}`;
    }
    if (vc.centerIndex !== undefined) {
      return `center[${vc.centerIndex}]: ${vc.role}`;
    }
    return `unknown: ${vc.role}`;
  }
}
