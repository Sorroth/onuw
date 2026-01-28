/**
 * @fileoverview Random decision agent for testing.
 * @module agents/RandomAgent
 *
 * @summary An agent that makes random valid decisions.
 *
 * @description
 * RandomAgent is useful for:
 * - Testing game mechanics
 * - Baseline comparisons
 * - Quick game simulations
 *
 * It always makes valid choices but with no strategy.
 *
 * @pattern Strategy Pattern - Concrete strategy (random)
 *
 * @example
 * ```typescript
 * const agent = new RandomAgent('player-1');
 *
 * // Will select randomly from options
 * const target = await agent.selectPlayer(['player-2', 'player-3'], context);
 * ```
 */

import { AbstractAgent } from './Agent';
import { NightActionContext, DayContext, VotingContext, NightActionResult } from '../types';
import { RoleName } from '../enums';

/**
 * @summary Agent that makes random valid decisions.
 *
 * @description
 * All decisions are randomly selected from valid options.
 * Statements are simple role claims.
 *
 * @extends AbstractAgent
 *
 * @example
 * ```typescript
 * const agents = new Map();
 * for (const playerId of game.getPlayerIds()) {
 *   agents.set(playerId, new RandomAgent(playerId));
 * }
 * game.registerAgents(agents);
 * ```
 */
export class RandomAgent extends AbstractAgent {
  /** The role this agent will claim (set after receiving night info) */
  private claimedRole: RoleName | null = null;

  /** Optional forced vote target (for debug/testing) */
  private forcedVoteTarget: string | null = null;

  /**
   * @summary Creates a new RandomAgent.
   *
   * @param {string} id - Player ID to control
   * @param {string} [forcedVoteTarget] - Optional player ID to always vote for (for testing)
   *
   * @example
   * ```typescript
   * const agent = new RandomAgent('player-1');
   * // Or with forced vote target for testing Hunter ability:
   * const agent = new RandomAgent('player-1', 'player-2');
   * ```
   */
  constructor(id: string, forcedVoteTarget?: string) {
    super(id);
    this.forcedVoteTarget = forcedVoteTarget || null;
  }

  /**
   * @summary Randomly selects a player from options.
   *
   * @param {string[]} options - Available player IDs
   * @param {NightActionContext} _context - Context (unused)
   *
   * @returns {Promise<string>} Randomly selected player ID
   */
  async selectPlayer(options: string[], _context: NightActionContext): Promise<string> {
    return this.randomChoice(options);
  }

  /**
   * @summary Randomly selects a center card.
   *
   * @param {NightActionContext} _context - Context (unused)
   *
   * @returns {Promise<number>} Random index 0-2
   */
  async selectCenterCard(_context: NightActionContext): Promise<number> {
    return Math.floor(Math.random() * 3);
  }

  /**
   * @summary Randomly selects two center cards.
   *
   * @param {NightActionContext} _context - Context (unused)
   *
   * @returns {Promise<[number, number]>} Two different random indices
   */
  async selectTwoCenterCards(_context: NightActionContext): Promise<[number, number]> {
    const first = Math.floor(Math.random() * 3);
    let second = Math.floor(Math.random() * 3);
    while (second === first) {
      second = Math.floor(Math.random() * 3);
    }
    return [first, second];
  }

  /**
   * @summary Randomly chooses player or center.
   *
   * @param {NightActionContext} _context - Context (unused)
   *
   * @returns {Promise<'player' | 'center'>} Random choice
   */
  async chooseSeerOption(_context: NightActionContext): Promise<'player' | 'center'> {
    return Math.random() < 0.5 ? 'player' : 'center';
  }

  /**
   * @summary Randomly selects two different players.
   *
   * @param {string[]} options - Available player IDs
   * @param {NightActionContext} _context - Context (unused)
   *
   * @returns {Promise<[string, string]>} Two different player IDs
   */
  async selectTwoPlayers(options: string[], _context: NightActionContext): Promise<[string, string]> {
    const shuffled = [...options].sort(() => Math.random() - 0.5);
    return [shuffled[0], shuffled[1]];
  }

  /**
   * @summary Gets a player's display name from the context.
   *
   * @param {DayContext} context - Day context with player names
   * @param {string} playerId - Player ID to look up
   *
   * @returns {string} Player's display name or ID if not found
   */
  private getPlayerName(context: DayContext, playerId: string): string {
    return context.playerNames.get(playerId) || playerId;
  }

  /**
   * @summary Makes a simple statement claiming role.
   *
   * @param {DayContext} context - Day context
   *
   * @returns {Promise<string>} A simple statement
   */
  async makeStatement(context: DayContext): Promise<string> {
    // Use claimed role or starting role
    const role = this.claimedRole || context.myStartingRole;

    // Simple statements based on role
    switch (role) {
      case RoleName.SEER:
        if (this.nightInfo.length > 0 && this.nightInfo[0].info.viewed) {
          const viewed = this.nightInfo[0].info.viewed[0];
          if (viewed.playerId) {
            const targetName = this.getPlayerName(context, viewed.playerId);
            return `I am the Seer. I looked at ${targetName} and they are ${viewed.role}.`;
          } else {
            return `I am the Seer. I looked at the center and saw ${viewed.role}.`;
          }
        }
        return 'I am the Seer.';

      case RoleName.ROBBER:
        if (this.nightInfo.length > 0 && this.nightInfo[0].info.viewed) {
          const viewed = this.nightInfo[0].info.viewed[0];
          return `I am the Robber. I stole from someone and got ${viewed.role}.`;
        }
        return 'I am the Robber.';

      case RoleName.TROUBLEMAKER:
        if (this.nightInfo.length > 0 && this.nightInfo[0].info.swapped) {
          const swap = this.nightInfo[0].info.swapped;
          if (swap.from?.playerId && swap.to?.playerId) {
            const name1 = this.getPlayerName(context, swap.from.playerId);
            const name2 = this.getPlayerName(context, swap.to.playerId);
            return `I am the Troublemaker. I swapped ${name1} and ${name2}.`;
          }
        }
        return 'I am the Troublemaker. I swapped two players\' cards.';

      case RoleName.WEREWOLF:
        // Werewolves lie
        return `I am a Villager. I have no information.`;

      case RoleName.MINION:
        // Minion protects werewolves
        return `I am a Villager. We should focus on finding the Werewolves.`;

      case RoleName.TANNER:
        // Tanner acts suspicious
        return `I... I don't have much to say. I'm just a Villager.`;

      default:
        return `I am the ${role}. I don't have much information.`;
    }
  }

  /**
   * @summary Votes for a player (forced target or random).
   *
   * @param {VotingContext} context - Voting context
   *
   * @returns {Promise<string>} Forced target if set and eligible, otherwise random
   */
  async vote(context: VotingContext): Promise<string> {
    // If forced vote target is set and is an eligible target, use it
    if (this.forcedVoteTarget && context.eligibleTargets.includes(this.forcedVoteTarget)) {
      return this.forcedVoteTarget;
    }
    return this.randomChoice(context.eligibleTargets as string[]);
  }

  /**
   * @summary Stores night info and determines claim strategy.
   *
   * @param {NightActionResult} info - Night action result
   */
  receiveNightInfo(info: NightActionResult): void {
    super.receiveNightInfo(info);

    // Werewolves and Minion should claim something else
    if (info.roleName === RoleName.WEREWOLF || info.roleName === RoleName.MINION) {
      this.claimedRole = RoleName.VILLAGER;
    }
  }

  /**
   * @summary Randomly selects from an array.
   *
   * @param {T[]} options - Options to choose from
   *
   * @returns {T} Random selection
   *
   * @private
   */
  private randomChoice<T>(options: T[]): T {
    return options[Math.floor(Math.random() * options.length)];
  }
}
