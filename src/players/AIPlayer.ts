/**
 * @fileoverview AI Player adapter for local AI agents.
 * @module players/AIPlayer
 *
 * @summary Adapts existing IAgent implementations to the IPlayer interface.
 *
 * @description
 * AIPlayer wraps an existing AI agent (AIAgent or RandomAgent) to conform
 * to the unified IPlayer interface. This enables:
 * - Using existing AI logic with the new player abstraction
 * - Seamless integration with multiplayer infrastructure
 * - AI takeover when human players disconnect
 *
 * @pattern Adapter Pattern - Adapts IAgent to IPlayer interface
 * @pattern Wrapper Pattern - Wraps agent behavior with player semantics
 *
 * @example
 * ```typescript
 * // Wrap existing agent
 * const agent = new AIAgent('player-1', RoleName.SEER);
 * const player = new AIPlayer('player-1', 'AI Seer', agent);
 *
 * // Use through IPlayer interface
 * const target = await player.selectPlayer(options, context);
 * ```
 */

import { AbstractPlayer, PlayerType } from './IPlayer';
import { IAgent } from '../agents/Agent';
import {
  NightActionContext,
  DayContext,
  VotingContext,
  NightActionResult
} from '../types';

/**
 * @summary AI Player that adapts an IAgent to IPlayer interface.
 *
 * @description
 * Provides a bridge between the existing agent system and the new
 * multiplayer player interface. All decisions are delegated to the
 * wrapped agent, while player metadata (type, status) is managed here.
 *
 * @extends AbstractPlayer
 *
 * @pattern Adapter Pattern - Converts IAgent interface to IPlayer
 *
 * @remarks
 * - Instant responses (no network latency)
 * - Never times out
 * - Used for AI opponents and disconnection takeover
 *
 * @example
 * ```typescript
 * // Create AI player wrapping an agent
 * const aiAgent = new AIAgent('ai-1', RoleName.WEREWOLF);
 * const aiPlayer = new AIPlayer('ai-1', 'Wolf AI', aiAgent);
 *
 * // All IPlayer methods work
 * const choice = await aiPlayer.chooseSeerOption(context);
 * const vote = await aiPlayer.vote(votingContext);
 * ```
 */
export class AIPlayer extends AbstractPlayer {
  /** @inheritdoc */
  readonly type: PlayerType = 'ai';

  /** The wrapped AI agent that provides decision logic */
  private readonly agent: IAgent;

  /**
   * @summary Creates a new AI Player.
   *
   * @description
   * Wraps an existing agent to expose it through the IPlayer interface.
   * The agent handles all decision-making; the player handles metadata.
   *
   * @param {string} id - Unique player identifier (should match agent ID)
   * @param {string} name - Display name for the AI player
   * @param {IAgent} agent - The agent providing decision logic
   *
   * @throws {Error} If agent ID doesn't match player ID
   *
   * @example
   * ```typescript
   * const agent = new AIAgent('player-1', RoleName.SEER);
   * const player = new AIPlayer('player-1', 'Sage AI', agent);
   * ```
   */
  constructor(id: string, name: string, agent: IAgent) {
    super(id, name);

    if (agent.id !== id) {
      throw new Error(`Agent ID ${agent.id} must match player ID ${id}`);
    }

    this.agent = agent;
    this._status = 'connected';
  }

  /**
   * @summary Gets the wrapped agent.
   *
   * @description
   * Provides access to the underlying agent for advanced operations.
   *
   * @returns {IAgent} The wrapped agent
   *
   * @example
   * ```typescript
   * const agent = player.getAgent();
   * const nightInfo = agent.getNightInfo(); // If agent has this method
   * ```
   */
  getAgent(): IAgent {
    return this.agent;
  }

  /**
   * @summary Selects a player target.
   *
   * @description
   * Delegates to the wrapped agent's selectPlayer method.
   *
   * @param {string[]} options - Valid player IDs to choose from
   * @param {NightActionContext} context - Current game context
   *
   * @returns {Promise<string>} Selected player ID
   *
   * @example
   * ```typescript
   * const target = await player.selectPlayer(
   *   ['player-2', 'player-3'],
   *   context
   * );
   * ```
   */
  async selectPlayer(options: string[], context: NightActionContext): Promise<string> {
    return this.agent.selectPlayer(options, context);
  }

  /**
   * @summary Selects a center card.
   *
   * @description
   * Delegates to the wrapped agent's selectCenterCard method.
   *
   * @param {NightActionContext} context - Current game context
   *
   * @returns {Promise<number>} Center card index (0-2)
   */
  async selectCenterCard(context: NightActionContext): Promise<number> {
    return this.agent.selectCenterCard(context);
  }

  /**
   * @summary Selects two center cards.
   *
   * @description
   * Delegates to the wrapped agent's selectTwoCenterCards method.
   *
   * @param {NightActionContext} context - Current game context
   *
   * @returns {Promise<[number, number]>} Two center card indices
   */
  async selectTwoCenterCards(context: NightActionContext): Promise<[number, number]> {
    return this.agent.selectTwoCenterCards(context);
  }

  /**
   * @summary Chooses between viewing a player or center cards.
   *
   * @description
   * Delegates to the wrapped agent's chooseSeerOption method.
   *
   * @param {NightActionContext} context - Current game context
   *
   * @returns {Promise<'player' | 'center'>} The chosen option
   */
  async chooseSeerOption(context: NightActionContext): Promise<'player' | 'center'> {
    return this.agent.chooseSeerOption(context);
  }

  /**
   * @summary Selects two players for Troublemaker swap.
   *
   * @description
   * Delegates to the wrapped agent's selectTwoPlayers method.
   *
   * @param {string[]} options - Valid player IDs to choose from
   * @param {NightActionContext} context - Current game context
   *
   * @returns {Promise<[string, string]>} Two player IDs
   */
  async selectTwoPlayers(
    options: string[],
    context: NightActionContext
  ): Promise<[string, string]> {
    return this.agent.selectTwoPlayers(options, context);
  }

  /**
   * @summary Makes a statement during day phase.
   *
   * @description
   * Delegates to the wrapped agent's makeStatement method.
   *
   * @param {DayContext} context - Day phase context
   *
   * @returns {Promise<string>} The AI's statement
   */
  async makeStatement(context: DayContext): Promise<string> {
    return this.agent.makeStatement(context);
  }

  /**
   * @summary Casts a vote.
   *
   * @description
   * Delegates to the wrapped agent's vote method.
   *
   * @param {VotingContext} context - Voting context
   *
   * @returns {Promise<string>} Player ID to vote for
   */
  async vote(context: VotingContext): Promise<string> {
    return this.agent.vote(context);
  }

  /**
   * @summary Receives night action information.
   *
   * @description
   * Forwards night info to both the abstract player storage
   * and the wrapped agent.
   *
   * @param {NightActionResult} info - Night action result
   */
  receiveNightInfo(info: NightActionResult): void {
    super.receiveNightInfo(info);
    this.agent.receiveNightInfo(info);
  }
}

/**
 * @summary Factory for creating AI players.
 *
 * @description
 * Provides convenient methods for creating AI players with various
 * agent types and configurations.
 *
 * @pattern Factory Pattern - Creates AIPlayer instances
 *
 * @example
 * ```typescript
 * const player = AIPlayerFactory.createWithNewAgent(
 *   'ai-1',
 *   'Smart AI',
 *   RoleName.SEER
 * );
 * ```
 */
export class AIPlayerFactory {
  /**
   * @summary Creates an AI player wrapping an existing agent.
   *
   * @param {string} id - Player ID
   * @param {string} name - Display name
   * @param {IAgent} agent - Agent to wrap
   *
   * @returns {AIPlayer} New AI player
   */
  static createFromAgent(id: string, name: string, agent: IAgent): AIPlayer {
    return new AIPlayer(id, name, agent);
  }

  /**
   * @summary Creates a named AI player for display purposes.
   *
   * @description
   * Creates an AI player with a descriptive name that includes
   * the AI number and optional role hint.
   *
   * @param {number} number - AI player number (1, 2, 3, etc.)
   * @param {IAgent} agent - Agent to wrap
   * @param {string} [roleHint] - Optional role to include in name
   *
   * @returns {AIPlayer} Named AI player
   *
   * @example
   * ```typescript
   * const player = AIPlayerFactory.createNamed(1, agent, 'Seer');
   * // player.name = "AI Player 1 (Seer)"
   * ```
   */
  static createNamed(number: number, agent: IAgent, roleHint?: string): AIPlayer {
    const name = roleHint
      ? `AI Player ${number} (${roleHint})`
      : `AI Player ${number}`;

    return new AIPlayer(agent.id, name, agent);
  }
}
