/**
 * @fileoverview Network-backed agent for human players.
 * @module server/NetworkAgent
 *
 * @summary Provides a network proxy for human players in multiplayer games.
 *
 * @description
 * This module implements the Proxy Pattern to allow human players to participate
 * in games over a network connection. The NetworkAgent implements the same IAgent
 * interface as AI agents, making the game engine agnostic to whether a player
 * is human or AI.
 *
 * When the game needs a decision from a human player:
 * 1. NetworkAgent sends an `actionRequired` message over WebSocket
 * 2. The human player sees the UI and makes a choice
 * 3. The client sends an `actionResponse` message back
 * 4. NetworkAgent resolves the pending promise with the response
 *
 * @pattern Proxy Pattern - Acts as local representative for remote human player
 * @pattern Adapter Pattern - Adapts WebSocket communication to IAgent interface
 *
 * @example
 * ```typescript
 * // Create agent for a connected human player
 * const agent = new NetworkAgent('player-1', connection);
 *
 * // Game engine uses it like any other agent
 * const target = await agent.selectPlayer(options, context);
 * const statement = await agent.makeStatement(dayContext);
 * const vote = await agent.vote(votingContext);
 *
 * // Clean up when done
 * agent.dispose();
 * ```
 */

import { IAgent } from '../agents/Agent';
import { IClientConnection } from '../network/IClientConnection';
import { ServerMessage, ClientMessage, RequestId } from '../network/protocol';
import { NightActionContext, DayContext, VotingContext } from '../types';

/**
 * @summary Network proxy agent for human players.
 *
 * @description
 * NetworkAgent acts as a proxy between the game engine and a remote human player.
 * It implements the IAgent interface, allowing the game to treat human and AI
 * players uniformly.
 *
 * The agent manages:
 * - Sending action requests to the client
 * - Tracking pending requests with unique IDs
 * - Handling timeouts for unresponsive players
 * - Cleaning up resources on disposal
 *
 * @pattern Proxy Pattern - Local representative for remote object
 * @pattern Adapter Pattern - Adapts network protocol to IAgent interface
 *
 * @implements {IAgent}
 *
 * @example
 * ```typescript
 * // In Room.startGame()
 * const agent = new NetworkAgent(gamePlayerId, playerConnection);
 * agents.set(gamePlayerId, agent);
 *
 * // Game engine calls agent methods
 * const choice = await agent.chooseSeerOption(context);
 * if (choice === 'player') {
 *   const target = await agent.selectPlayer(options, context);
 * }
 * ```
 *
 * @remarks
 * - Each request has a configurable timeout (default 60 seconds)
 * - Timed out requests reject with an error
 * - The agent should be disposed when the game ends or player disconnects
 * - Messages are automatically serialized/deserialized as JSON
 */
export class NetworkAgent implements IAgent {
  /**
   * @summary Unique identifier for this agent/player.
   * @readonly
   */
  readonly id: string;

  /**
   * @summary Indicates this is a remote (network-backed) agent.
   * @readonly
   */
  readonly isRemote: boolean = true;

  /**
   * @summary Whether timeouts are disabled (debug mode).
   * @private
   */
  private disableTimeouts: boolean = false;

  /**
   * @summary WebSocket connection to the remote player.
   * @private
   */
  private connection: IClientConnection;

  /**
   * @summary Map of pending requests awaiting responses.
   *
   * @description
   * Each entry maps a request ID to its resolve/reject handlers.
   * Entries are removed when responses arrive or timeouts occur.
   *
   * @private
   */
  private pendingRequests: Map<RequestId, {
    resolve: (value: unknown) => void;
    reject: (error: Error) => void;
  }> = new Map();

  /**
   * @summary Counter for generating unique request IDs.
   * @private
   */
  private requestCounter = 0;

  /**
   * @summary Function to unsubscribe from connection messages.
   * @private
   */
  private unsubscribe: (() => void) | null = null;

  /**
   * @summary Creates a new NetworkAgent for a human player.
   *
   * @param {string} id - Unique identifier for this player (game player ID)
   * @param {IClientConnection} connection - WebSocket connection to the client
   * @param {boolean} [disableTimeouts=false] - Whether to disable action timeouts (debug mode)
   *
   * @example
   * ```typescript
   * const agent = new NetworkAgent('player-1', connection);
   * // Or with disabled timeouts for debug mode:
   * const debugAgent = new NetworkAgent('player-1', connection, true);
   * ```
   */
  constructor(id: string, connection: IClientConnection, disableTimeouts: boolean = false) {
    this.id = id;
    this.connection = connection;
    this.disableTimeouts = disableTimeouts;
    this.setupMessageHandler();
  }

  /**
   * @summary Sets up the message handler for incoming responses.
   *
   * @description
   * Listens for `actionResponse` messages from the client and
   * resolves the corresponding pending request.
   *
   * @private
   */
  private setupMessageHandler(): void {
    this.unsubscribe = this.connection.onMessage((msg: ClientMessage) => {
      if (msg.type === 'actionResponse') {
        const pending = this.pendingRequests.get(msg.requestId);
        if (pending) {
          this.pendingRequests.delete(msg.requestId);
          pending.resolve(msg.response);
        }
      }
    });
  }

  /**
   * @summary Generates a unique request ID.
   *
   * @returns {RequestId} Unique request ID in format "playerId-counter"
   *
   * @private
   */
  private generateRequestId(): RequestId {
    return `${this.id}-${++this.requestCounter}`;
  }

  /**
   * @summary Sends an action request to the client and waits for response.
   *
   * @description
   * Core method that handles the request/response pattern:
   * 1. Generates a unique request ID
   * 2. Sets up a timeout timer
   * 3. Stores resolve/reject handlers in pendingRequests
   * 4. Sends the actionRequired message to client
   * 5. Returns a promise that resolves when response arrives
   *
   * @template T - Type of the expected response
   *
   * @param {string} actionType - Type of action being requested
   * @param {Record<string, unknown>} additionalFields - Extra fields for the request
   * @param {number} [timeoutMs=60000] - Timeout in milliseconds (default 60s)
   *
   * @returns {Promise<T>} Promise that resolves with the player's response
   *
   * @throws {Error} If the request times out
   *
   * @private
   *
   * @example
   * ```typescript
   * const target = await this.sendRequest<string>('selectPlayer', {
   *   options: ['player-2', 'player-3'],
   *   reason: 'Select a player to view'
   * });
   * ```
   */
  private async sendRequest<T>(
    actionType: string,
    additionalFields: Record<string, unknown>,
    timeoutMs: number = 60000
  ): Promise<T> {
    const requestId = this.generateRequestId();
    console.log(`[NetworkAgent ${this.id}] sendRequest: actionType=${actionType}, timeoutMs=${timeoutMs}, disableTimeouts=${this.disableTimeouts}`);

    return new Promise((resolve, reject) => {
      // Only set timeout if timeouts are not disabled
      let timeout: ReturnType<typeof setTimeout> | null = null;
      if (!this.disableTimeouts) {
        console.log(`[NetworkAgent ${this.id}] Setting ${timeoutMs}ms timeout for ${actionType}`);
        timeout = setTimeout(() => {
          console.log(`[NetworkAgent ${this.id}] TIMEOUT FIRED for ${actionType} - this should not happen if timers are disabled!`);
          this.pendingRequests.delete(requestId);
          reject(new Error(`Request ${actionType} timed out`));
        }, timeoutMs);
      } else {
        console.log(`[NetworkAgent ${this.id}] Timeouts DISABLED - no timeout set for ${actionType}`);
      }

      this.pendingRequests.set(requestId, {
        resolve: (value) => {
          if (timeout) clearTimeout(timeout);
          resolve(value as T);
        },
        reject: (error) => {
          if (timeout) clearTimeout(timeout);
          reject(error);
        }
      });

      const message: ServerMessage = {
        type: 'actionRequired',
        request: {
          actionType,
          requestId,
          timeoutMs,
          timestamp: Date.now(),
          ...additionalFields
        } as ServerMessage['request' extends keyof ServerMessage ? 'request' : never],
        timestamp: Date.now()
      } as ServerMessage;

      this.connection.send(message);
    });
  }

  /**
   * @summary Asks the player to select a target player.
   *
   * @description
   * Used by Seer (to view a player), Robber (to rob), Doppelganger (to copy).
   * Sends options to client and waits for selection.
   *
   * @param {string[]} options - Valid player IDs to choose from
   * @param {NightActionContext} context - Night action context (unused, for interface compatibility)
   *
   * @returns {Promise<string>} Selected player ID
   *
   * @throws {Error} If request times out (60 seconds)
   *
   * @example
   * ```typescript
   * const target = await agent.selectPlayer(
   *   ['player-2', 'player-3'],
   *   nightContext
   * );
   * ```
   */
  async selectPlayer(options: string[], context: NightActionContext): Promise<string> {
    return this.sendRequest('selectPlayer', {
      options,
      reason: 'Select a player'
    });
  }

  /**
   * @summary Asks the player to select a center card.
   *
   * @description
   * Used by Drunk (to swap with) and Werewolf (lone wolf to peek).
   * Client shows 3 center card positions (0, 1, 2).
   *
   * @param {NightActionContext} context - Night action context (unused)
   *
   * @returns {Promise<number>} Selected center card index (0, 1, or 2)
   *
   * @throws {Error} If request times out
   */
  async selectCenterCard(context: NightActionContext): Promise<number> {
    return this.sendRequest('selectCenter', {
      count: 1,
      reason: 'Select a center card'
    });
  }

  /**
   * @summary Asks the player to select two center cards.
   *
   * @description
   * Used by Seer when choosing to view center cards instead of a player.
   *
   * @param {NightActionContext} context - Night action context (unused)
   *
   * @returns {Promise<[number, number]>} Tuple of two center card indices
   *
   * @throws {Error} If request times out
   */
  async selectTwoCenterCards(context: NightActionContext): Promise<[number, number]> {
    return this.sendRequest('selectTwoCenter', {
      count: 2,
      reason: 'Select two center cards'
    });
  }

  /**
   * @summary Asks the Seer to choose between viewing a player or center cards.
   *
   * @description
   * Seer's unique choice: view one player's card OR view two center cards.
   *
   * @param {NightActionContext} context - Night action context (unused)
   *
   * @returns {Promise<'player' | 'center'>} The Seer's choice
   *
   * @throws {Error} If request times out
   */
  async chooseSeerOption(context: NightActionContext): Promise<'player' | 'center'> {
    return this.sendRequest('seerChoice', {
      options: ['player', 'center'],
      reason: 'Choose to view a player or two center cards'
    });
  }

  /**
   * @summary Asks the player to select two other players.
   *
   * @description
   * Used by Troublemaker to swap two other players' cards.
   * Player cannot select themselves.
   *
   * @param {string[]} options - Valid player IDs to choose from
   * @param {NightActionContext} context - Night action context (unused)
   *
   * @returns {Promise<[string, string]>} Tuple of two selected player IDs
   *
   * @throws {Error} If request times out
   */
  async selectTwoPlayers(options: string[], context: NightActionContext): Promise<[string, string]> {
    return this.sendRequest('selectTwoPlayers', {
      options,
      reason: 'Select two players'
    });
  }

  /**
   * @summary Asks the player to make a statement during the day phase.
   *
   * @description
   * During the day phase, each player makes a statement about their role,
   * what they saw, or accusations against others.
   *
   * @param {DayContext} context - Day context with previous statements
   *
   * @returns {Promise<string>} The player's statement text
   *
   * @throws {Error} If request times out
   *
   * @example
   * ```typescript
   * const statement = await agent.makeStatement({
   *   statements: previousStatements,
   *   players: allPlayers
   * });
   * // "I am the Seer and I saw player-3 is a Werewolf!"
   * ```
   */
  async makeStatement(context: DayContext): Promise<string> {
    return this.sendRequest('statement', {
      previousStatements: context.statements,
      reason: 'Make your statement'
    });
  }

  /**
   * @summary Asks the player to vote for who to eliminate.
   *
   * @description
   * Final phase where all players simultaneously vote.
   * Player(s) with most votes are eliminated.
   *
   * @param {VotingContext} context - Voting context with eligible targets
   *
   * @returns {Promise<string>} ID of player being voted for
   *
   * @throws {Error} If request times out
   */
  async vote(context: VotingContext): Promise<string> {
    return this.sendRequest('vote', {
      eligibleTargets: context.eligibleTargets,
      reason: 'Vote for who to eliminate'
    });
  }

  /**
   * @summary Sends night action results to the player.
   *
   * @description
   * After a player's night action completes, they receive information
   * about what they learned (e.g., Seer sees a role, Robber sees new role).
   *
   * @param {unknown} info - Night action result information
   *
   * @remarks
   * This is a one-way notification, not a request/response.
   * The player doesn't need to respond to this message.
   *
   * @example
   * ```typescript
   * // Seer learns player-2 is Werewolf
   * agent.receiveNightInfo({
   *   action: 'view',
   *   target: 'player-2',
   *   role: 'WEREWOLF'
   * });
   * ```
   */
  receiveNightInfo(info: unknown): void {
    // Send night info to client
    const message: ServerMessage = {
      type: 'nightResult',
      result: info as ServerMessage['result' extends keyof ServerMessage ? 'result' : never],
      timestamp: Date.now()
    } as ServerMessage;
    this.connection.send(message);
  }

  /**
   * @summary Cleans up the agent and rejects pending requests.
   *
   * @description
   * Should be called when:
   * - The game ends
   * - The player disconnects
   * - The agent is being replaced (e.g., by AI takeover)
   *
   * This method:
   * 1. Unsubscribes from connection messages
   * 2. Rejects all pending requests with "Agent disposed" error
   * 3. Clears the pending requests map
   *
   * @example
   * ```typescript
   * // When game ends
   * for (const agent of agents.values()) {
   *   if (agent instanceof NetworkAgent) {
   *     agent.dispose();
   *   }
   * }
   * ```
   */
  dispose(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
    }
    for (const pending of this.pendingRequests.values()) {
      pending.reject(new Error('Agent disposed'));
    }
    this.pendingRequests.clear();
  }
}
