/**
 * @fileoverview Base agent interface for game players.
 * @module agents/Agent
 *
 * @summary Defines the contract for all game agents (AI or human).
 *
 * @description
 * An Agent makes decisions during the game:
 * - Night action choices (who to view, who to swap)
 * - Day statements (what to claim, who to accuse)
 * - Voting decisions (who to eliminate)
 *
 * @pattern Strategy Pattern - Different agent types have different decision strategies
 *
 * @remarks
 * Agent types:
 * - RandomAgent: Makes random valid decisions (for testing)
 * - AIAgent: Uses reasoning based on game state
 * - HumanAgent: Prompts for human input (not implemented)
 *
 * @example
 * ```typescript
 * class MyAgent implements IAgent {
 *   async selectPlayer(options: string[], context: NightActionContext): Promise<string> {
 *     // Custom selection logic
 *     return options[0];
 *   }
 *   // ... other methods
 * }
 * ```
 */

import {
  NightActionContext,
  DayContext,
  VotingContext,
  NightActionResult
} from '../types';

/**
 * @summary Interface for game agents.
 *
 * @description
 * All agents must implement these methods to participate in a game.
 * Each method corresponds to a decision point in the game.
 *
 * @pattern Strategy Pattern - Agents are strategies for decision-making
 *
 * @example
 * ```typescript
 * const agent: IAgent = new AIAgent('player-1', RoleName.SEER);
 * const target = await agent.selectPlayer(['player-2', 'player-3'], context);
 * ```
 */
export interface IAgent {
  /**
   * @summary The player ID this agent controls.
   * @readonly
   */
  readonly id: string;

  /**
   * @summary Indicates if this agent is backed by a remote connection.
   *
   * @description
   * - true: NetworkAgent (human player over WebSocket)
   * - false: AI agents (RandomAgent, AIAgent)
   *
   * Used to determine behavior during day phase (real-time vs sequential).
   * @readonly
   */
  readonly isRemote: boolean;

  /**
   * @summary Selects a player from available options.
   *
   * @description
   * Used for actions that target one player:
   * - Seer viewing a player
   * - Robber selecting who to rob
   * - Doppelganger selecting who to copy
   *
   * @param {string[]} options - Available player IDs
   * @param {NightActionContext} context - Current context
   *
   * @returns {Promise<string>} Selected player ID
   *
   * @example
   * ```typescript
   * const target = await agent.selectPlayer(
   *   ['player-2', 'player-3', 'player-4'],
   *   context
   * );
   * ```
   */
  selectPlayer(options: string[], context: NightActionContext): Promise<string>;

  /**
   * @summary Selects a center card (0, 1, or 2).
   *
   * @description
   * Used for:
   * - Werewolf lone wolf peeking
   * - Drunk swapping with center
   *
   * @param {NightActionContext} context - Current context
   *
   * @returns {Promise<number>} Center card index (0-2)
   *
   * @example
   * ```typescript
   * const index = await agent.selectCenterCard(context);
   * // index is 0, 1, or 2
   * ```
   */
  selectCenterCard(context: NightActionContext): Promise<number>;

  /**
   * @summary Selects two center cards.
   *
   * @description
   * Used for Seer viewing two center cards.
   *
   * @param {NightActionContext} context - Current context
   *
   * @returns {Promise<[number, number]>} Two center indices
   *
   * @example
   * ```typescript
   * const [idx1, idx2] = await agent.selectTwoCenterCards(context);
   * ```
   */
  selectTwoCenterCards(context: NightActionContext): Promise<[number, number]>;

  /**
   * @summary Chooses between viewing a player or center cards.
   *
   * @description
   * Used for Seer's choice.
   *
   * @param {NightActionContext} context - Current context
   *
   * @returns {Promise<'player' | 'center'>} The choice
   *
   * @example
   * ```typescript
   * const choice = await agent.chooseSeerOption(context);
   * if (choice === 'player') {
   *   // Will view a player
   * }
   * ```
   */
  chooseSeerOption(context: NightActionContext): Promise<'player' | 'center'>;

  /**
   * @summary Selects two different players.
   *
   * @description
   * Used for Troublemaker selecting two players to swap.
   *
   * @param {string[]} options - Available player IDs
   * @param {NightActionContext} context - Current context
   *
   * @returns {Promise<[string, string]>} Two player IDs
   *
   * @example
   * ```typescript
   * const [p1, p2] = await agent.selectTwoPlayers(options, context);
   * ```
   */
  selectTwoPlayers(options: string[], context: NightActionContext): Promise<[string, string]>;

  /**
   * @summary Makes a statement during the day phase.
   *
   * @description
   * The agent decides what to say based on:
   * - Their starting role
   * - What they learned at night
   * - What others have said
   *
   * @param {DayContext} context - Day phase context
   *
   * @returns {Promise<string>} The statement to make
   *
   * @example
   * ```typescript
   * const statement = await agent.makeStatement(context);
   * // "I am the Seer. I looked at player-3 and they are a Werewolf!"
   * ```
   */
  makeStatement(context: DayContext): Promise<string>;

  /**
   * @summary Votes for a player to eliminate.
   *
   * @description
   * The agent decides who to vote for based on:
   * - Their team (village wants to kill werewolves)
   * - Information gathered
   * - Statements made
   *
   * @param {VotingContext} context - Voting context
   *
   * @returns {Promise<string>} Player ID to vote for
   *
   * @example
   * ```typescript
   * const target = await agent.vote(context);
   * ```
   */
  vote(context: VotingContext): Promise<string>;

  /**
   * @summary Receives night action information.
   *
   * @description
   * Called after the agent's night action executes to inform them
   * of what they learned.
   *
   * @param {NightActionResult} info - Result of night action
   *
   * @example
   * ```typescript
   * agent.receiveNightInfo({
   *   actorId: 'player-1',
   *   roleName: RoleName.SEER,
   *   actionType: 'VIEW',
   *   success: true,
   *   info: { viewed: [{ playerId: 'player-3', role: RoleName.WEREWOLF }] }
   * });
   * ```
   */
  receiveNightInfo(info: NightActionResult): void;
}

/**
 * @summary Abstract base class for agents.
 *
 * @description
 * Provides common functionality for all agent types.
 *
 * @example
 * ```typescript
 * class MyAgent extends AbstractAgent {
 *   async selectPlayer(options: string[]): Promise<string> {
 *     return options[0];
 *   }
 *   // ... implement other abstract methods
 * }
 * ```
 */
export abstract class AbstractAgent implements IAgent {
  /** The player ID this agent controls */
  public readonly id: string;

  /** Indicates this is a local (non-network) agent */
  public readonly isRemote: boolean = false;

  /** Night action results received */
  protected nightInfo: NightActionResult[] = [];

  /**
   * @summary Creates a new agent.
   *
   * @param {string} id - Player ID this agent controls
   */
  constructor(id: string) {
    this.id = id;
  }

  /**
   * @summary Stores night action information.
   *
   * @param {NightActionResult} info - Result to store
   */
  receiveNightInfo(info: NightActionResult): void {
    this.nightInfo.push(info);
  }

  /**
   * @summary Gets all received night information.
   *
   * @returns {NightActionResult[]} All night results
   */
  getNightInfo(): NightActionResult[] {
    return [...this.nightInfo];
  }

  // Abstract methods to be implemented by subclasses
  abstract selectPlayer(options: string[], context: NightActionContext): Promise<string>;
  abstract selectCenterCard(context: NightActionContext): Promise<number>;
  abstract selectTwoCenterCards(context: NightActionContext): Promise<[number, number]>;
  abstract chooseSeerOption(context: NightActionContext): Promise<'player' | 'center'>;
  abstract selectTwoPlayers(options: string[], context: NightActionContext): Promise<[string, string]>;
  abstract makeStatement(context: DayContext): Promise<string>;
  abstract vote(context: VotingContext): Promise<string>;
}
