/**
 * @fileoverview Console logger observer implementation.
 * @module patterns/observer/ConsoleObserver
 *
 * @summary An observer that logs game events to the console.
 *
 * @description
 * ConsoleObserver is a concrete observer that outputs game events
 * to the console in a formatted, readable manner. Useful for:
 * - Debugging
 * - Game narration
 * - Development testing
 *
 * @pattern Observer Pattern - Concrete Observer
 *
 * @example
 * ```typescript
 * const emitter = new GameEventEmitter();
 * emitter.addObserver(new ConsoleObserver());
 *
 * // Events will be logged to console
 * emitter.emitGameStarted([...], [...]);
 * // Console: [GAME_STARTED] Game started with 5 players
 * ```
 */

import { IGameObserver, GameEvent } from '../../types';

/**
 * @summary Observer that logs events to console.
 *
 * @description
 * Formats and outputs game events in a readable format.
 * Supports all event types with appropriate formatting.
 *
 * @pattern Observer Pattern - Concrete Observer
 *
 * @implements {IGameObserver}
 *
 * @example
 * ```typescript
 * const logger = new ConsoleObserver();
 * emitter.addObserver(logger);
 *
 * // Later, when events are emitted:
 * // [PHASE_CHANGED] Phase: NIGHT -> DAY
 * // [STATEMENT_MADE] player-1: "I am the Seer..."
 * // [VOTE_CAST] player-1 votes for player-3
 * ```
 */
export class ConsoleObserver implements IGameObserver {
  /** Whether to include timestamps in output */
  private readonly showTimestamp: boolean;

  /** Whether to use colors (ANSI codes) */
  private readonly useColors: boolean;

  /**
   * @summary Creates a new ConsoleObserver.
   *
   * @param {object} options - Configuration options
   * @param {boolean} [options.showTimestamp=false] - Include timestamps
   * @param {boolean} [options.useColors=true] - Use ANSI colors
   *
   * @example
   * ```typescript
   * const logger = new ConsoleObserver({ showTimestamp: true });
   * ```
   */
  constructor(options: { showTimestamp?: boolean; useColors?: boolean } = {}) {
    this.showTimestamp = options.showTimestamp ?? false;
    this.useColors = options.useColors ?? true;
  }

  /**
   * @summary Handles a game event by logging to console.
   *
   * @param {GameEvent} event - The event to log
   *
   * @example
   * ```typescript
   * logger.onEvent({
   *   type: 'PHASE_CHANGED',
   *   timestamp: Date.now(),
   *   data: { from: 'NIGHT', to: 'DAY' }
   * });
   * // Output: [PHASE_CHANGED] Phase: NIGHT -> DAY
   * ```
   */
  onEvent(event: GameEvent): void {
    const prefix = this.formatPrefix(event);
    const message = this.formatMessage(event);

    console.log(`${prefix} ${message}`);
  }

  /**
   * @summary Formats the log prefix.
   *
   * @param {GameEvent} event - The event
   *
   * @returns {string} Formatted prefix
   *
   * @private
   */
  private formatPrefix(event: GameEvent): string {
    const typeStr = `[${event.type}]`;
    const colored = this.useColors ? this.colorize(typeStr, event.type) : typeStr;

    if (this.showTimestamp) {
      const time = new Date(event.timestamp).toISOString();
      return `${time} ${colored}`;
    }

    return colored;
  }

  /**
   * @summary Formats the event message.
   *
   * @param {GameEvent} event - The event
   *
   * @returns {string} Formatted message
   *
   * @private
   */
  private formatMessage(event: GameEvent): string {
    switch (event.type) {
      case 'GAME_STARTED':
        return this.formatGameStarted(event.data);

      case 'PHASE_CHANGED':
        return this.formatPhaseChanged(event.data);

      case 'NIGHT_ACTION_EXECUTED':
        return this.formatNightAction(event.data);

      case 'STATEMENT_MADE':
        return this.formatStatement(event.data);

      case 'VOTE_CAST':
        return this.formatVote(event.data);

      case 'GAME_ENDED':
        return this.formatGameEnded(event.data);

      case 'ERROR':
        return this.formatError(event.data);

      default:
        return JSON.stringify(event.data);
    }
  }

  /**
   * @summary Formats GAME_STARTED event.
   * @private
   */
  private formatGameStarted(data: Record<string, unknown>): string {
    const players = data.playerIds as string[];
    const roles = data.roleNames as string[];
    return `Game started with ${players.length} players. Roles: ${roles.join(', ')}`;
  }

  /**
   * @summary Formats PHASE_CHANGED event.
   * @private
   */
  private formatPhaseChanged(data: Record<string, unknown>): string {
    return `Phase: ${data.from} -> ${data.to}`;
  }

  /**
   * @summary Formats NIGHT_ACTION_EXECUTED event.
   * @private
   */
  private formatNightAction(data: Record<string, unknown>): string {
    return `${data.actorId} (${data.roleName}) performed ${data.actionType}`;
  }

  /**
   * @summary Formats STATEMENT_MADE event.
   * @private
   */
  private formatStatement(data: Record<string, unknown>): string {
    return `${data.playerId}: "${data.statement}"`;
  }

  /**
   * @summary Formats VOTE_CAST event.
   * @private
   */
  private formatVote(data: Record<string, unknown>): string {
    return `${data.voterId} votes for ${data.targetId}`;
  }

  /**
   * @summary Formats GAME_ENDED event.
   * @private
   */
  private formatGameEnded(data: Record<string, unknown>): string {
    const winners = data.winningTeams as string[];
    const eliminated = data.eliminatedPlayers as string[];
    return `Game Over! Winners: ${winners.join(', ')}. Eliminated: ${eliminated.join(', ') || 'none'}`;
  }

  /**
   * @summary Formats ERROR event.
   * @private
   */
  private formatError(data: Record<string, unknown>): string {
    return `ERROR: ${data.message}${data.error ? ` (${data.error})` : ''}`;
  }

  /**
   * @summary Applies ANSI color to text.
   *
   * @param {string} text - Text to colorize
   * @param {string} eventType - Event type for color selection
   *
   * @returns {string} Colorized text
   *
   * @private
   */
  private colorize(text: string, eventType: string): string {
    const colors: Record<string, string> = {
      'GAME_STARTED': '\x1b[32m',    // Green
      'PHASE_CHANGED': '\x1b[36m',    // Cyan
      'NIGHT_ACTION_EXECUTED': '\x1b[35m', // Magenta
      'STATEMENT_MADE': '\x1b[33m',   // Yellow
      'VOTE_CAST': '\x1b[34m',        // Blue
      'GAME_ENDED': '\x1b[32m',       // Green
      'ERROR': '\x1b[31m'             // Red
    };

    const reset = '\x1b[0m';
    const color = colors[eventType] || '';

    return `${color}${text}${reset}`;
  }
}
