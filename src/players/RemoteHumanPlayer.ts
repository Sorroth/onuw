/**
 * @fileoverview Remote human player proxy for network communication.
 * @module players/RemoteHumanPlayer
 *
 * @summary Proxies IPlayer interface over network connection.
 *
 * @description
 * RemoteHumanPlayer is a network proxy that implements IPlayer by:
 * - Sending action requests to the client
 * - Waiting for client responses
 * - Handling timeouts with configurable strategies
 * - Supporting disconnection and reconnection
 *
 * @pattern Proxy Pattern - Represents remote player locally
 * @pattern Strategy Pattern - Configurable timeout strategies
 *
 * @example
 * ```typescript
 * // Create player with connection
 * const player = new RemoteHumanPlayer('player-1', 'Alice', connection);
 *
 * // Use like any IPlayer - sends requests over network
 * const target = await player.selectPlayer(options, context);
 * ```
 */

import { AbstractPlayer, PlayerType, TimeoutError } from './IPlayer';
import { IClientConnection } from '../network/IClientConnection';
import {
  ServerMessage,
  ClientMessage,
  ActionRequest,
  RequestId
} from '../network/protocol';
import {
  NightActionContext,
  DayContext,
  VotingContext,
  NightActionResult
} from '../types';

/**
 * @summary Timeout strategy configuration.
 *
 * @description
 * Defines how the player handles timeouts for different actions.
 */
export interface TimeoutConfig {
  /** Timeout for night actions in milliseconds */
  nightActionMs: number;

  /** Timeout for making statements in milliseconds */
  statementMs: number;

  /** Timeout for voting in milliseconds */
  voteMs: number;

  /** Whether to use AI fallback on timeout (vs random) */
  useAIFallback: boolean;
}

/**
 * @summary Default timeout configurations by mode.
 */
export const TimeoutConfigs = {
  /** Casual mode - generous timeouts */
  CASUAL: {
    nightActionMs: 60000,
    statementMs: 120000,
    voteMs: 60000,
    useAIFallback: false
  },

  /** Competitive mode - standard timeouts */
  COMPETITIVE: {
    nightActionMs: 30000,
    statementMs: 60000,
    voteMs: 30000,
    useAIFallback: true
  },

  /** Tournament mode - strict timeouts */
  TOURNAMENT: {
    nightActionMs: 15000,
    statementMs: 30000,
    voteMs: 15000,
    useAIFallback: true
  }
} as const;

/**
 * @summary Pending request awaiting response.
 */
interface PendingRequest<T> {
  /** Request ID for matching responses */
  requestId: RequestId;

  /** Resolve function for the promise */
  resolve: (value: T) => void;

  /** Reject function for the promise */
  reject: (reason: Error) => void;

  /** Timeout handle */
  timeoutHandle: ReturnType<typeof setTimeout>;

  /** Action type for error messages */
  actionType: string;
}

/**
 * @summary Remote human player proxy.
 *
 * @description
 * Represents a human player connected over the network. All IPlayer
 * methods are proxied to the client via the connection, with responses
 * awaited asynchronously.
 *
 * @extends AbstractPlayer
 *
 * @pattern Proxy Pattern - Proxies remote player through network
 * @pattern Strategy Pattern - Configurable timeout behavior
 *
 * @remarks
 * - All methods return Promises that resolve when client responds
 * - Timeouts result in TimeoutError or fallback behavior
 * - Handles disconnection gracefully with reconnection support
 *
 * @example
 * ```typescript
 * const connection = new WebSocketConnection('player-1', socket);
 * const player = new RemoteHumanPlayer('player-1', 'Alice', connection);
 *
 * // Configure timeouts
 * player.setTimeoutConfig(TimeoutConfigs.COMPETITIVE);
 *
 * // Methods send requests and wait for responses
 * const vote = await player.vote(context);
 * ```
 */
export class RemoteHumanPlayer extends AbstractPlayer {
  /** @inheritdoc */
  readonly type: PlayerType = 'human';

  /** Network connection to the client */
  private connection: IClientConnection;

  /** Timeout configuration */
  private timeoutConfig: TimeoutConfig = TimeoutConfigs.CASUAL;

  /** Pending requests awaiting responses */
  private readonly pendingRequests: Map<RequestId, PendingRequest<unknown>> = new Map();

  /** Counter for generating unique request IDs */
  private requestIdCounter: number = 0;

  /** Unsubscribe function for message handler */
  private unsubscribeMessage: (() => void) | null = null;

  /** Unsubscribe function for disconnect handler */
  private unsubscribeDisconnect: (() => void) | null = null;

  /**
   * @summary Creates a new remote human player.
   *
   * @description
   * Initializes the player with a network connection and sets up
   * message handlers for receiving responses.
   *
   * @param {string} id - Unique player identifier
   * @param {string} name - Display name
   * @param {IClientConnection} connection - Network connection
   *
   * @example
   * ```typescript
   * const player = new RemoteHumanPlayer(
   *   'player-1',
   *   'Alice',
   *   webSocketConnection
   * );
   * ```
   */
  constructor(id: string, name: string, connection: IClientConnection) {
    super(id, name);
    this.connection = connection;
    this._status = connection.isConnected() ? 'connected' : 'disconnected';
    this.setupConnectionHandlers();
  }

  /**
   * @summary Sets the timeout configuration.
   *
   * @param {TimeoutConfig} config - New timeout configuration
   *
   * @example
   * ```typescript
   * player.setTimeoutConfig(TimeoutConfigs.TOURNAMENT);
   * ```
   */
  setTimeoutConfig(config: TimeoutConfig): void {
    this.timeoutConfig = config;
  }

  /**
   * @summary Gets the current timeout configuration.
   *
   * @returns {TimeoutConfig} Current configuration
   */
  getTimeoutConfig(): TimeoutConfig {
    return { ...this.timeoutConfig };
  }

  /**
   * @summary Updates the connection (for reconnection).
   *
   * @param {IClientConnection} connection - New connection
   */
  updateConnection(connection: IClientConnection): void {
    // Clean up old handlers
    if (this.unsubscribeMessage) {
      this.unsubscribeMessage();
    }
    if (this.unsubscribeDisconnect) {
      this.unsubscribeDisconnect();
    }

    this.connection = connection;
    this._status = connection.isConnected() ? 'connected' : 'disconnected';
    this.setupConnectionHandlers();
  }

  /**
   * @summary Gets the underlying connection.
   *
   * @returns {IClientConnection} The connection
   */
  getConnection(): IClientConnection {
    return this.connection;
  }

  /**
   * @summary Sets up connection event handlers.
   *
   * @private
   */
  private setupConnectionHandlers(): void {
    this.unsubscribeMessage = this.connection.onMessage((msg) => {
      this.handleMessage(msg);
    });

    this.unsubscribeDisconnect = this.connection.onDisconnect((reason) => {
      this.handleDisconnect(reason);
    });
  }

  /**
   * @summary Handles incoming messages from client.
   *
   * @param {ClientMessage} message - Received message
   *
   * @private
   */
  private handleMessage(message: ClientMessage): void {
    if (message.type === 'actionResponse') {
      const pending = this.pendingRequests.get(message.requestId);
      if (pending) {
        clearTimeout(pending.timeoutHandle);
        this.pendingRequests.delete(message.requestId);
        pending.resolve(message.response);
      }
    }
  }

  /**
   * @summary Handles disconnection.
   *
   * @param {string} reason - Disconnect reason
   *
   * @private
   */
  private handleDisconnect(reason: string): void {
    this._status = 'disconnected';

    // Reject all pending requests
    for (const [requestId, pending] of this.pendingRequests) {
      clearTimeout(pending.timeoutHandle);
      this.pendingRequests.delete(requestId);
      pending.reject(new Error(`Disconnected: ${reason}`));
    }
  }

  /**
   * @summary Generates a unique request ID.
   *
   * @returns {RequestId} Unique request ID
   *
   * @private
   */
  private generateRequestId(): RequestId {
    return `${this.id}-${++this.requestIdCounter}`;
  }

  /**
   * @summary Sends an action request and waits for response.
   *
   * @description
   * Sends a request to the client, creates a pending promise,
   * and sets up timeout handling.
   *
   * @param {ActionRequest} request - Action request to send
   * @param {number} timeoutMs - Timeout in milliseconds
   *
   * @returns {Promise<T>} Response from client
   *
   * @throws {TimeoutError} If client doesn't respond in time
   * @throws {Error} If disconnected
   *
   * @private
   */
  private async sendActionRequest<T>(
    actionType: string,
    additionalFields: Record<string, unknown>,
    timeoutMs: number
  ): Promise<T> {
    if (!this.connection.isConnected()) {
      throw new Error(`Player ${this.id} is disconnected`);
    }

    const requestId = this.generateRequestId();

    return new Promise<T>((resolve, reject) => {
      const timeoutHandle = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        reject(new TimeoutError(this.id, actionType, timeoutMs));
      }, timeoutMs);

      this.pendingRequests.set(requestId, {
        requestId,
        resolve: resolve as (value: unknown) => void,
        reject,
        timeoutHandle,
        actionType
      });

      const fullRequest = {
        actionType,
        requestId,
        timeoutMs,
        timestamp: Date.now(),
        ...additionalFields
      } as ActionRequest;

      const message: ServerMessage = {
        type: 'actionRequired',
        request: fullRequest,
        timestamp: Date.now()
      };

      this.connection.send(message);
    });
  }

  /**
   * @summary Selects a player target.
   *
   * @description
   * Sends a 'selectPlayer' request to the client and waits for response.
   *
   * @param {string[]} options - Valid player IDs to choose from
   * @param {NightActionContext} context - Current game context
   *
   * @returns {Promise<string>} Selected player ID
   *
   * @throws {TimeoutError} If client doesn't respond in time
   */
  async selectPlayer(options: string[], _context: NightActionContext): Promise<string> {
    return this.sendActionRequest<string>(
      'selectPlayer',
      { options, reason: 'Select a player' },
      this.timeoutConfig.nightActionMs
    );
  }

  /**
   * @summary Selects a center card.
   *
   * @description
   * Sends a 'selectCenter' request to the client.
   *
   * @param {NightActionContext} context - Current game context
   *
   * @returns {Promise<number>} Center card index (0-2)
   *
   * @throws {TimeoutError} If client doesn't respond in time
   */
  async selectCenterCard(_context: NightActionContext): Promise<number> {
    return this.sendActionRequest<number>(
      'selectCenter',
      { count: 1, reason: 'Select a center card' },
      this.timeoutConfig.nightActionMs
    );
  }

  /**
   * @summary Selects two center cards.
   *
   * @description
   * Sends a 'selectCenter' request with count=2 to the client.
   *
   * @param {NightActionContext} context - Current game context
   *
   * @returns {Promise<[number, number]>} Two center card indices
   *
   * @throws {TimeoutError} If client doesn't respond in time
   */
  async selectTwoCenterCards(_context: NightActionContext): Promise<[number, number]> {
    return this.sendActionRequest<[number, number]>(
      'selectCenter',
      { count: 2, reason: 'Select two center cards' },
      this.timeoutConfig.nightActionMs
    );
  }

  /**
   * @summary Chooses between viewing a player or center cards.
   *
   * @description
   * Sends a 'seerChoice' request to the client.
   *
   * @param {NightActionContext} context - Current game context
   *
   * @returns {Promise<'player' | 'center'>} The chosen option
   *
   * @throws {TimeoutError} If client doesn't respond in time
   */
  async chooseSeerOption(_context: NightActionContext): Promise<'player' | 'center'> {
    return this.sendActionRequest<'player' | 'center'>(
      'seerChoice',
      { options: ['player', 'center'] },
      this.timeoutConfig.nightActionMs
    );
  }

  /**
   * @summary Selects two players for Troublemaker swap.
   *
   * @description
   * Sends a 'selectTwoPlayers' request to the client.
   *
   * @param {string[]} options - Valid player IDs
   * @param {NightActionContext} context - Current game context
   *
   * @returns {Promise<[string, string]>} Two player IDs
   *
   * @throws {TimeoutError} If client doesn't respond in time
   */
  async selectTwoPlayers(
    options: string[],
    _context: NightActionContext
  ): Promise<[string, string]> {
    return this.sendActionRequest<[string, string]>(
      'selectTwoPlayers',
      { options, reason: 'Select two players to swap' },
      this.timeoutConfig.nightActionMs
    );
  }

  /**
   * @summary Makes a statement during day phase.
   *
   * @description
   * Sends a 'makeStatement' request to the client.
   *
   * @param {DayContext} context - Day phase context
   *
   * @returns {Promise<string>} The player's statement
   *
   * @throws {TimeoutError} If client doesn't respond in time
   */
  async makeStatement(context: DayContext): Promise<string> {
    return this.sendActionRequest<string>(
      'statement',
      { previousStatements: context.statements },
      this.timeoutConfig.statementMs
    );
  }

  /**
   * @summary Casts a vote.
   *
   * @description
   * Sends a 'vote' request to the client.
   *
   * @param {VotingContext} context - Voting context
   *
   * @returns {Promise<string>} Player ID to vote for
   *
   * @throws {TimeoutError} If client doesn't respond in time
   */
  async vote(context: VotingContext): Promise<string> {
    return this.sendActionRequest<string>(
      'vote',
      { eligibleTargets: [...context.eligibleTargets], allStatements: context.allStatements },
      this.timeoutConfig.voteMs
    );
  }

  /**
   * @summary Receives night action information.
   *
   * @description
   * Stores the info locally and sends it to the client.
   *
   * @param {NightActionResult} info - Night action result
   */
  receiveNightInfo(info: NightActionResult): void {
    super.receiveNightInfo(info);

    // Also send to client
    if (this.connection.isConnected()) {
      const message: ServerMessage = {
        type: 'nightResult',
        result: info,
        timestamp: Date.now()
      };
      this.connection.send(message);
    }
  }

  /**
   * @summary Called when player is replaced by AI.
   *
   * @description
   * Notifies the client that AI is taking over (if still connected).
   *
   * @param {string} reason - Why the player is being replaced
   */
  onReplacedByAI(reason: string): void {
    this._status = 'disconnected';

    // Cancel all pending requests
    for (const [requestId, pending] of this.pendingRequests) {
      clearTimeout(pending.timeoutHandle);
      this.pendingRequests.delete(requestId);
      pending.reject(new Error(`Replaced by AI: ${reason}`));
    }

    // Notify client if still connected
    if (this.connection.isConnected()) {
      const message: ServerMessage = {
        type: 'error',
        code: 'AI_TAKEOVER',
        message: `You have been replaced by AI: ${reason}`,
        timestamp: Date.now()
      };
      this.connection.send(message);
    }
  }

  /**
   * @summary Called when player reconnects.
   *
   * @description
   * Restores player state and sends catch-up information.
   *
   * @param {NightActionResult[]} nightInfo - Night info to restore
   */
  onReconnected(nightInfo: NightActionResult[]): void {
    this._status = 'connected';

    // Restore night info
    for (const info of nightInfo) {
      if (!this.nightInfo.some(existing =>
        existing.roleName === info.roleName &&
        existing.actorId === info.actorId
      )) {
        this.nightInfo.push(info);
      }
    }

    // Send reconnection acknowledgment with catch-up info
    if (this.connection.isConnected()) {
      const message: ServerMessage = {
        type: 'playerReconnected',
        playerId: this.id,
        playerName: this.name,
        timestamp: Date.now()
      };
      this.connection.send(message);
    }
  }

  /**
   * @summary Cleans up resources.
   *
   * @description
   * Removes event handlers and rejects pending requests.
   */
  dispose(): void {
    if (this.unsubscribeMessage) {
      this.unsubscribeMessage();
      this.unsubscribeMessage = null;
    }

    if (this.unsubscribeDisconnect) {
      this.unsubscribeDisconnect();
      this.unsubscribeDisconnect = null;
    }

    // Reject all pending requests
    for (const [requestId, pending] of this.pendingRequests) {
      clearTimeout(pending.timeoutHandle);
      pending.reject(new Error('Player disposed'));
    }
    this.pendingRequests.clear();
  }
}
