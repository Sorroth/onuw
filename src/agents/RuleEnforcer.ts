/**
 * @fileoverview Rule enforcement wrapper for agents.
 * @module agents/RuleEnforcer
 *
 * @summary Validates that agent decisions follow game rules.
 *
 * @description
 * RuleEnforcer wraps another agent and validates all decisions:
 * - Player selections are from valid options
 * - Center indices are 0-2
 * - Two-player selections are different
 * - Votes are for eligible targets
 *
 * @pattern Decorator Pattern - Adds validation to existing agent
 *
 * @example
 * ```typescript
 * const baseAgent = new AIAgent('player-1', RoleName.SEER);
 * const safeAgent = new RuleEnforcer(baseAgent);
 *
 * // safeAgent validates all decisions
 * const target = await safeAgent.selectPlayer(options, context);
 * // Throws if base agent returns invalid option
 * ```
 */

import { IAgent, AbstractAgent } from './Agent';
import {
  NightActionContext,
  DayContext,
  VotingContext,
  NightActionResult
} from '../types';

/**
 * @summary Error thrown when an agent violates game rules.
 */
export class RuleViolationError extends Error {
  /** The agent that violated rules */
  public readonly agentId: string;

  /** The rule that was violated */
  public readonly rule: string;

  /** The invalid value */
  public readonly invalidValue: unknown;

  constructor(agentId: string, rule: string, invalidValue: unknown) {
    super(`Agent ${agentId} violated rule: ${rule}. Invalid value: ${JSON.stringify(invalidValue)}`);
    this.name = 'RuleViolationError';
    this.agentId = agentId;
    this.rule = rule;
    this.invalidValue = invalidValue;
  }
}

/**
 * @summary Decorator that validates agent decisions.
 *
 * @description
 * Wraps an agent and validates all return values against game rules.
 * Throws RuleViolationError if validation fails.
 *
 * @pattern Decorator Pattern - Adds behavior to existing object
 *
 * @example
 * ```typescript
 * const agent = new RuleEnforcer(new AIAgent('p1', RoleName.SEER));
 * // All decisions are validated
 * ```
 */
export class RuleEnforcer implements IAgent {
  /** The wrapped agent */
  private readonly innerAgent: IAgent;

  /** Whether to log violations instead of throwing */
  private readonly logOnly: boolean;

  /** Recorded violations */
  private readonly violations: RuleViolationError[] = [];

  /**
   * @summary Creates a new RuleEnforcer.
   *
   * @param {IAgent} agent - Agent to wrap
   * @param {boolean} [logOnly=false] - Log violations instead of throwing
   *
   * @example
   * ```typescript
   * const enforcer = new RuleEnforcer(baseAgent);
   * const lenientEnforcer = new RuleEnforcer(baseAgent, true);
   * ```
   */
  constructor(agent: IAgent, logOnly: boolean = false) {
    this.innerAgent = agent;
    this.logOnly = logOnly;
  }

  /**
   * @summary Gets the agent ID.
   */
  get id(): string {
    return this.innerAgent.id;
  }

  /**
   * @summary Validates and returns player selection.
   */
  async selectPlayer(options: string[], context: NightActionContext): Promise<string> {
    const selected = await this.innerAgent.selectPlayer(options, context);

    if (!options.includes(selected)) {
      return this.handleViolation(
        'selectPlayer must return a value from options',
        selected,
        options[0]
      );
    }

    return selected;
  }

  /**
   * @summary Validates and returns center card selection.
   */
  async selectCenterCard(context: NightActionContext): Promise<number> {
    const selected = await this.innerAgent.selectCenterCard(context);

    if (selected < 0 || selected > 2 || !Number.isInteger(selected)) {
      return this.handleViolation(
        'selectCenterCard must return 0, 1, or 2',
        selected,
        0
      );
    }

    return selected;
  }

  /**
   * @summary Validates and returns two center card selections.
   */
  async selectTwoCenterCards(context: NightActionContext): Promise<[number, number]> {
    const selected = await this.innerAgent.selectTwoCenterCards(context);

    if (!Array.isArray(selected) || selected.length !== 2) {
      return this.handleViolation(
        'selectTwoCenterCards must return array of 2 numbers',
        selected,
        [0, 1] as [number, number]
      );
    }

    const [a, b] = selected;

    if (a < 0 || a > 2 || b < 0 || b > 2) {
      return this.handleViolation(
        'selectTwoCenterCards indices must be 0, 1, or 2',
        selected,
        [0, 1] as [number, number]
      );
    }

    if (a === b) {
      return this.handleViolation(
        'selectTwoCenterCards must return two different indices',
        selected,
        [0, 1] as [number, number]
      );
    }

    return selected;
  }

  /**
   * @summary Validates and returns seer option choice.
   */
  async chooseSeerOption(context: NightActionContext): Promise<'player' | 'center'> {
    const choice = await this.innerAgent.chooseSeerOption(context);

    if (choice !== 'player' && choice !== 'center') {
      return this.handleViolation(
        'chooseSeerOption must return "player" or "center"',
        choice,
        'player'
      );
    }

    return choice;
  }

  /**
   * @summary Validates and returns two player selections.
   */
  async selectTwoPlayers(options: string[], context: NightActionContext): Promise<[string, string]> {
    const selected = await this.innerAgent.selectTwoPlayers(options, context);

    if (!Array.isArray(selected) || selected.length !== 2) {
      return this.handleViolation(
        'selectTwoPlayers must return array of 2 player IDs',
        selected,
        [options[0], options[1]] as [string, string]
      );
    }

    const [p1, p2] = selected;

    if (!options.includes(p1) || !options.includes(p2)) {
      return this.handleViolation(
        'selectTwoPlayers must return values from options',
        selected,
        [options[0], options[1]] as [string, string]
      );
    }

    if (p1 === p2) {
      return this.handleViolation(
        'selectTwoPlayers must return two different players',
        selected,
        [options[0], options[1]] as [string, string]
      );
    }

    return selected;
  }

  /**
   * @summary Validates and returns statement.
   */
  async makeStatement(context: DayContext): Promise<string> {
    const statement = await this.innerAgent.makeStatement(context);

    if (typeof statement !== 'string') {
      return this.handleViolation(
        'makeStatement must return a string',
        statement,
        'No statement'
      );
    }

    return statement;
  }

  /**
   * @summary Validates and returns vote.
   */
  async vote(context: VotingContext): Promise<string> {
    const target = await this.innerAgent.vote(context);

    if (!context.eligibleTargets.includes(target)) {
      return this.handleViolation(
        'vote must return an eligible target',
        target,
        context.eligibleTargets[0] as string
      );
    }

    return target;
  }

  /**
   * @summary Passes night info to wrapped agent.
   */
  receiveNightInfo(info: NightActionResult): void {
    this.innerAgent.receiveNightInfo(info);
  }

  /**
   * @summary Gets all recorded violations.
   *
   * @returns {RuleViolationError[]} Array of violations
   */
  getViolations(): RuleViolationError[] {
    return [...this.violations];
  }

  /**
   * @summary Gets violation count.
   */
  getViolationCount(): number {
    return this.violations.length;
  }

  /**
   * @summary Clears violation history.
   */
  clearViolations(): void {
    this.violations.length = 0;
  }

  /**
   * @summary Handles a rule violation.
   *
   * @param {string} rule - Rule that was violated
   * @param {unknown} value - Invalid value
   * @param {T} fallback - Fallback valid value
   *
   * @returns {T} Fallback value (if logOnly)
   *
   * @throws {RuleViolationError} If not logOnly
   *
   * @private
   */
  private handleViolation<T>(rule: string, value: unknown, fallback: T): T {
    const error = new RuleViolationError(this.id, rule, value);
    this.violations.push(error);

    if (this.logOnly) {
      console.warn(`Rule violation: ${error.message}`);
      return fallback;
    }

    throw error;
  }
}
