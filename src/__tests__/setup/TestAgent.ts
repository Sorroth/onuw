/**
 * @fileoverview Deterministic test agent for automated testing.
 * @module __tests__/setup/TestAgent
 *
 * @description
 * TestAgent allows complete control over all agent decisions for testing.
 * Each decision can be pre-scripted to produce deterministic test outcomes.
 */

import { AbstractAgent } from '../../agents/Agent';
import {
  NightActionContext,
  DayContext,
  VotingContext,
  NightActionResult
} from '../../types';

/**
 * Configuration for a TestAgent's predetermined decisions.
 */
export interface TestAgentConfig {
  /** Player to select for single-player targeting (Seer, Robber, Doppelganger) */
  selectPlayerTarget?: string;

  /** Center card index to select (0, 1, or 2) for Drunk, lone Werewolf */
  selectCenterIndex?: number;

  /** Two center card indices for Seer viewing center */
  selectTwoCenterIndices?: [number, number];

  /** Seer's choice: view 'player' or 'center' */
  seerChoice?: 'player' | 'center';

  /** Two players for Troublemaker to swap */
  selectTwoPlayersTargets?: [string, string];

  /** Statement to make during day phase */
  statement?: string;

  /** Player to vote for */
  voteTarget?: string;

  /** Callback when night info is received (for assertions) */
  onNightInfo?: (info: NightActionResult) => void;
}

/**
 * A deterministic agent for testing that makes pre-configured decisions.
 *
 * @example
 * ```typescript
 * const agent = new TestAgent('player-1', {
 *   selectPlayerTarget: 'player-2',  // Doppelganger copies player-2
 *   voteTarget: 'player-3'           // Vote for player-3
 * });
 * ```
 */
export class TestAgent extends AbstractAgent {
  private config: TestAgentConfig;

  constructor(id: string, config: TestAgentConfig = {}) {
    super(id);
    this.config = config;
  }

  /**
   * Updates the agent's configuration.
   * Useful for changing behavior between phases.
   */
  updateConfig(config: Partial<TestAgentConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Selects a player from options.
   * Uses configured target or falls back to first option.
   */
  async selectPlayer(options: string[], _context: NightActionContext): Promise<string> {
    if (this.config.selectPlayerTarget && options.includes(this.config.selectPlayerTarget)) {
      return this.config.selectPlayerTarget;
    }
    // Default: select first available option
    return options[0];
  }

  /**
   * Selects a center card index (0-2).
   * Uses configured index or defaults to 0.
   */
  async selectCenterCard(_context: NightActionContext): Promise<number> {
    return this.config.selectCenterIndex ?? 0;
  }

  /**
   * Selects two center card indices.
   * Uses configured indices or defaults to [0, 1].
   */
  async selectTwoCenterCards(_context: NightActionContext): Promise<[number, number]> {
    return this.config.selectTwoCenterIndices ?? [0, 1];
  }

  /**
   * Chooses between viewing a player or center cards (Seer).
   * Uses configured choice or defaults to 'player'.
   */
  async chooseSeerOption(_context: NightActionContext): Promise<'player' | 'center'> {
    return this.config.seerChoice ?? 'player';
  }

  /**
   * Selects two different players (Troublemaker).
   * Uses configured targets or defaults to first two options.
   */
  async selectTwoPlayers(options: string[], _context: NightActionContext): Promise<[string, string]> {
    if (this.config.selectTwoPlayersTargets) {
      const [t1, t2] = this.config.selectTwoPlayersTargets;
      if (options.includes(t1) && options.includes(t2)) {
        return [t1, t2];
      }
    }
    // Default: first two options
    return [options[0], options[1]];
  }

  /**
   * Makes a statement during day phase.
   * Uses configured statement or a default.
   */
  async makeStatement(_context: DayContext): Promise<string> {
    return this.config.statement ?? 'I have nothing to say.';
  }

  /**
   * Votes for a player.
   * Uses configured target or falls back to first eligible target.
   */
  async vote(context: VotingContext): Promise<string> {
    if (this.config.voteTarget && context.eligibleTargets.includes(this.config.voteTarget)) {
      return this.config.voteTarget;
    }
    // Default: vote for first eligible target (not self if possible)
    const nonSelfTargets = context.eligibleTargets.filter(t => t !== this.id);
    return nonSelfTargets[0] ?? context.eligibleTargets[0];
  }

  /**
   * Receives night action information.
   * Calls configured callback if provided.
   */
  receiveNightInfo(info: NightActionResult): void {
    super.receiveNightInfo(info);
    if (this.config.onNightInfo) {
      this.config.onNightInfo(info);
    }
  }

  /**
   * Gets the received night info for assertions.
   */
  getReceivedNightInfo(): NightActionResult[] {
    return this.getNightInfo();
  }
}
