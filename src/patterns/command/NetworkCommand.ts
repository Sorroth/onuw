/**
 * @fileoverview Network-serializable command system for multiplayer.
 * @module patterns/command/NetworkCommand
 *
 * @summary Extends Command Pattern for network transmission.
 *
 * @description
 * This module provides network-serializable commands for multiplayer:
 * - Commands can be serialized to JSON for network transmission
 * - Commands can be deserialized and executed on the server
 * - Enables action replay, audit logging, and event sourcing
 *
 * @pattern Command Pattern - Network-serializable commands
 * @pattern Serialization - JSON-safe command representation
 *
 * @example
 * ```typescript
 * // Client sends
 * const data = NetworkCommand.serialize(selectPlayerCommand);
 * socket.send(JSON.stringify(data));
 *
 * // Server receives
 * const command = NetworkCommand.deserialize(data);
 * const result = await command.execute(game);
 * ```
 */

import { GamePhase, RoleName } from '../../enums';

/**
 * @summary Types of network commands.
 */
export type NetworkCommandType =
  | 'selectPlayer'
  | 'selectCenter'
  | 'selectTwoCenters'
  | 'selectTwoPlayers'
  | 'seerChoice'
  | 'statement'
  | 'vote';

/**
 * @summary Serialized command data for network transmission.
 *
 * @description
 * JSON-safe representation of a command that can be sent over
 * WebSocket or HTTP.
 */
export interface SerializedCommand {
  /** Command type identifier */
  type: NetworkCommandType;

  /** Unique command ID */
  commandId: string;

  /** Player who issued the command */
  playerId: string;

  /** Game ID this command belongs to */
  gameId: string;

  /** Timestamp when command was created */
  timestamp: number;

  /** Command-specific payload */
  payload: Record<string, unknown>;

  /** Client-side request ID for response matching */
  requestId?: string;
}

/**
 * @summary Interface for network-serializable commands.
 *
 * @description
 * Extends the basic command pattern with serialization capabilities
 * for network transmission.
 *
 * @pattern Command Pattern - Command interface
 *
 * @example
 * ```typescript
 * class SelectPlayerCommand implements INetworkCommand {
 *   serialize(): SerializedCommand {
 *     return {
 *       type: 'selectPlayer',
 *       commandId: this.id,
 *       playerId: this.playerId,
 *       gameId: this.gameId,
 *       timestamp: this.timestamp,
 *       payload: { targetId: this.targetId }
 *     };
 *   }
 * }
 * ```
 */
export interface INetworkCommand {
  /** Command type */
  readonly type: NetworkCommandType;

  /** Unique command identifier */
  readonly id: string;

  /** Player who issued the command */
  readonly playerId: string;

  /** Game this command belongs to */
  readonly gameId: string;

  /** When the command was created */
  readonly timestamp: number;

  /**
   * @summary Serializes the command for network transmission.
   *
   * @returns {SerializedCommand} Serialized command data
   */
  serialize(): SerializedCommand;

  /**
   * @summary Validates the command is legal.
   *
   * @description
   * Checks that the command represents a valid action given
   * the current game state.
   *
   * @param {NetworkCommandValidationContext} context - Validation context
   *
   * @returns {NetworkCommandValidationResult} Validation result
   */
  validate(context: NetworkCommandValidationContext): NetworkCommandValidationResult;
}

/**
 * @summary Context for command validation.
 */
export interface NetworkCommandValidationContext {
  /** Current game phase */
  phase: GamePhase;

  /** Player IDs in the game */
  playerIds: string[];

  /** Player whose turn it is (if applicable) */
  currentPlayerId?: string;

  /** Valid options for selection (if applicable) */
  validOptions?: string[] | number[];
}

/**
 * @summary Result of command validation.
 */
export interface NetworkCommandValidationResult {
  /** Whether the command is valid */
  valid: boolean;

  /** Error message if invalid */
  error?: string;
}

/**
 * @summary Counter for generating unique command IDs.
 */
let commandIdCounter = 0;

/**
 * @summary Generates a unique command ID.
 *
 * @returns {string} Unique command ID
 */
function generateCommandId(): string {
  return `cmd-${++commandIdCounter}-${Date.now()}`;
}

/**
 * @summary Resets the command ID counter (for testing).
 */
export function resetCommandIdCounter(): void {
  commandIdCounter = 0;
}

/**
 * @summary Abstract base class for network commands.
 *
 * @description
 * Provides common functionality for all network commands.
 *
 * @pattern Command Pattern - Abstract Command
 */
export abstract class AbstractNetworkCommand implements INetworkCommand {
  readonly id: string;
  readonly timestamp: number;

  abstract readonly type: NetworkCommandType;

  /**
   * @summary Creates a new network command.
   *
   * @param {string} playerId - Player issuing the command
   * @param {string} gameId - Game the command belongs to
   */
  constructor(
    readonly playerId: string,
    readonly gameId: string
  ) {
    this.id = generateCommandId();
    this.timestamp = Date.now();
  }

  /**
   * @summary Gets the command payload.
   *
   * @returns {Record<string, unknown>} Command-specific payload
   *
   * @protected
   */
  protected abstract getPayload(): Record<string, unknown>;

  /** @inheritdoc */
  serialize(): SerializedCommand {
    return {
      type: this.type,
      commandId: this.id,
      playerId: this.playerId,
      gameId: this.gameId,
      timestamp: this.timestamp,
      payload: this.getPayload()
    };
  }

  /** @inheritdoc */
  abstract validate(context: NetworkCommandValidationContext): NetworkCommandValidationResult;
}

/**
 * @summary Command for selecting a player target.
 *
 * @description
 * Used by Seer, Robber, Doppelganger for night actions.
 *
 * @extends AbstractNetworkCommand
 *
 * @example
 * ```typescript
 * const cmd = new SelectPlayerCommand('player-1', 'game-1', 'player-2');
 * const valid = cmd.validate({ validOptions: ['player-2', 'player-3'] });
 * ```
 */
export class SelectPlayerCommand extends AbstractNetworkCommand {
  readonly type: NetworkCommandType = 'selectPlayer';

  /**
   * @summary Creates a select player command.
   *
   * @param {string} playerId - Player making the selection
   * @param {string} gameId - Game ID
   * @param {string} targetId - Selected target player ID
   */
  constructor(
    playerId: string,
    gameId: string,
    readonly targetId: string
  ) {
    super(playerId, gameId);
  }

  protected getPayload(): Record<string, unknown> {
    return { targetId: this.targetId };
  }

  validate(context: NetworkCommandValidationContext): NetworkCommandValidationResult {
    if (context.validOptions) {
      const options = context.validOptions as string[];
      if (!options.includes(this.targetId)) {
        return {
          valid: false,
          error: `Invalid target: ${this.targetId}. Valid options: ${options.join(', ')}`
        };
      }
    }
    return { valid: true };
  }
}

/**
 * @summary Command for selecting a center card.
 *
 * @description
 * Used by Drunk, Werewolf (lone wolf) for center card selection.
 *
 * @extends AbstractNetworkCommand
 */
export class SelectCenterCommand extends AbstractNetworkCommand {
  readonly type: NetworkCommandType = 'selectCenter';

  /**
   * @summary Creates a select center command.
   *
   * @param {string} playerId - Player making the selection
   * @param {string} gameId - Game ID
   * @param {number} centerIndex - Selected center card index (0-2)
   */
  constructor(
    playerId: string,
    gameId: string,
    readonly centerIndex: number
  ) {
    super(playerId, gameId);
  }

  protected getPayload(): Record<string, unknown> {
    return { centerIndex: this.centerIndex };
  }

  validate(context: NetworkCommandValidationContext): NetworkCommandValidationResult {
    if (this.centerIndex < 0 || this.centerIndex > 2) {
      return {
        valid: false,
        error: `Invalid center index: ${this.centerIndex}. Must be 0, 1, or 2.`
      };
    }
    return { valid: true };
  }
}

/**
 * @summary Command for selecting two center cards.
 *
 * @description
 * Used by Seer when choosing to view center cards.
 *
 * @extends AbstractNetworkCommand
 */
export class SelectTwoCentersCommand extends AbstractNetworkCommand {
  readonly type: NetworkCommandType = 'selectTwoCenters';

  /**
   * @summary Creates a select two centers command.
   *
   * @param {string} playerId - Player making the selection
   * @param {string} gameId - Game ID
   * @param {[number, number]} indices - Two center card indices
   */
  constructor(
    playerId: string,
    gameId: string,
    readonly indices: [number, number]
  ) {
    super(playerId, gameId);
  }

  protected getPayload(): Record<string, unknown> {
    return { indices: this.indices };
  }

  validate(_context: NetworkCommandValidationContext): NetworkCommandValidationResult {
    const [idx1, idx2] = this.indices;

    if (idx1 < 0 || idx1 > 2 || idx2 < 0 || idx2 > 2) {
      return {
        valid: false,
        error: `Invalid center indices: [${idx1}, ${idx2}]. Must be 0, 1, or 2.`
      };
    }

    if (idx1 === idx2) {
      return {
        valid: false,
        error: 'Must select two different center cards.'
      };
    }

    return { valid: true };
  }
}

/**
 * @summary Command for selecting two players.
 *
 * @description
 * Used by Troublemaker to swap two players' cards.
 *
 * @extends AbstractNetworkCommand
 */
export class SelectTwoPlayersCommand extends AbstractNetworkCommand {
  readonly type: NetworkCommandType = 'selectTwoPlayers';

  /**
   * @summary Creates a select two players command.
   *
   * @param {string} playerId - Player making the selection
   * @param {string} gameId - Game ID
   * @param {[string, string]} targets - Two target player IDs
   */
  constructor(
    playerId: string,
    gameId: string,
    readonly targets: [string, string]
  ) {
    super(playerId, gameId);
  }

  protected getPayload(): Record<string, unknown> {
    return { targets: this.targets };
  }

  validate(context: NetworkCommandValidationContext): NetworkCommandValidationResult {
    const [target1, target2] = this.targets;

    if (target1 === target2) {
      return {
        valid: false,
        error: 'Must select two different players.'
      };
    }

    if (context.validOptions) {
      const options = context.validOptions as string[];
      if (!options.includes(target1)) {
        return {
          valid: false,
          error: `Invalid target: ${target1}`
        };
      }
      if (!options.includes(target2)) {
        return {
          valid: false,
          error: `Invalid target: ${target2}`
        };
      }
    }

    return { valid: true };
  }
}

/**
 * @summary Command for Seer's choice between player and center.
 *
 * @extends AbstractNetworkCommand
 */
export class SeerChoiceCommand extends AbstractNetworkCommand {
  readonly type: NetworkCommandType = 'seerChoice';

  /**
   * @summary Creates a Seer choice command.
   *
   * @param {string} playerId - Player making the choice
   * @param {string} gameId - Game ID
   * @param {'player' | 'center'} choice - The choice made
   */
  constructor(
    playerId: string,
    gameId: string,
    readonly choice: 'player' | 'center'
  ) {
    super(playerId, gameId);
  }

  protected getPayload(): Record<string, unknown> {
    return { choice: this.choice };
  }

  validate(_context: NetworkCommandValidationContext): NetworkCommandValidationResult {
    if (this.choice !== 'player' && this.choice !== 'center') {
      return {
        valid: false,
        error: `Invalid choice: ${this.choice}. Must be 'player' or 'center'.`
      };
    }
    return { valid: true };
  }
}

/**
 * @summary Command for making a statement during day phase.
 *
 * @extends AbstractNetworkCommand
 */
export class StatementCommand extends AbstractNetworkCommand {
  readonly type: NetworkCommandType = 'statement';

  /**
   * @summary Creates a statement command.
   *
   * @param {string} playerId - Player making the statement
   * @param {string} gameId - Game ID
   * @param {string} statement - The statement text
   */
  constructor(
    playerId: string,
    gameId: string,
    readonly statement: string
  ) {
    super(playerId, gameId);
  }

  protected getPayload(): Record<string, unknown> {
    return { statement: this.statement };
  }

  validate(context: NetworkCommandValidationContext): NetworkCommandValidationResult {
    if (context.phase !== GamePhase.DAY) {
      return {
        valid: false,
        error: 'Statements can only be made during the Day phase.'
      };
    }

    if (!this.statement || this.statement.trim().length === 0) {
      return {
        valid: false,
        error: 'Statement cannot be empty.'
      };
    }

    if (this.statement.length > 1000) {
      return {
        valid: false,
        error: 'Statement exceeds maximum length of 1000 characters.'
      };
    }

    return { valid: true };
  }
}

/**
 * @summary Command for casting a vote.
 *
 * @extends AbstractNetworkCommand
 */
export class VoteCommand extends AbstractNetworkCommand {
  readonly type: NetworkCommandType = 'vote';

  /**
   * @summary Creates a vote command.
   *
   * @param {string} playerId - Player casting the vote
   * @param {string} gameId - Game ID
   * @param {string} targetId - Player being voted for
   */
  constructor(
    playerId: string,
    gameId: string,
    readonly targetId: string
  ) {
    super(playerId, gameId);
  }

  protected getPayload(): Record<string, unknown> {
    return { targetId: this.targetId };
  }

  validate(context: NetworkCommandValidationContext): NetworkCommandValidationResult {
    if (context.phase !== GamePhase.VOTING) {
      return {
        valid: false,
        error: 'Votes can only be cast during the Voting phase.'
      };
    }

    if (context.validOptions) {
      const options = context.validOptions as string[];
      if (!options.includes(this.targetId)) {
        return {
          valid: false,
          error: `Invalid vote target: ${this.targetId}`
        };
      }
    }

    return { valid: true };
  }
}

/**
 * @summary Factory for deserializing network commands.
 *
 * @description
 * Recreates command objects from serialized JSON data.
 *
 * @pattern Factory Pattern - Creates command instances from serialized data
 *
 * @example
 * ```typescript
 * const data = JSON.parse(message);
 * const command = NetworkCommandFactory.deserialize(data);
 * const result = command.validate(context);
 * ```
 */
export class NetworkCommandFactory {
  /**
   * @summary Deserializes a command from JSON data.
   *
   * @param {SerializedCommand} data - Serialized command data
   *
   * @returns {INetworkCommand} Reconstructed command object
   *
   * @throws {Error} If command type is unknown
   *
   * @example
   * ```typescript
   * const command = NetworkCommandFactory.deserialize({
   *   type: 'selectPlayer',
   *   commandId: 'cmd-1',
   *   playerId: 'player-1',
   *   gameId: 'game-1',
   *   timestamp: Date.now(),
   *   payload: { targetId: 'player-2' }
   * });
   * ```
   */
  static deserialize(data: SerializedCommand): INetworkCommand {
    switch (data.type) {
      case 'selectPlayer':
        return new SelectPlayerCommand(
          data.playerId,
          data.gameId,
          data.payload.targetId as string
        );

      case 'selectCenter':
        return new SelectCenterCommand(
          data.playerId,
          data.gameId,
          data.payload.centerIndex as number
        );

      case 'selectTwoCenters':
        return new SelectTwoCentersCommand(
          data.playerId,
          data.gameId,
          data.payload.indices as [number, number]
        );

      case 'selectTwoPlayers':
        return new SelectTwoPlayersCommand(
          data.playerId,
          data.gameId,
          data.payload.targets as [string, string]
        );

      case 'seerChoice':
        return new SeerChoiceCommand(
          data.playerId,
          data.gameId,
          data.payload.choice as 'player' | 'center'
        );

      case 'statement':
        return new StatementCommand(
          data.playerId,
          data.gameId,
          data.payload.statement as string
        );

      case 'vote':
        return new VoteCommand(
          data.playerId,
          data.gameId,
          data.payload.targetId as string
        );

      default:
        throw new Error(`Unknown command type: ${(data as SerializedCommand).type}`);
    }
  }

  /**
   * @summary Validates serialized command data structure.
   *
   * @param {unknown} data - Data to validate
   *
   * @returns {data is SerializedCommand} True if data is valid
   */
  static isValidSerializedCommand(data: unknown): data is SerializedCommand {
    if (typeof data !== 'object' || data === null) {
      return false;
    }

    const obj = data as Record<string, unknown>;

    return (
      typeof obj.type === 'string' &&
      typeof obj.commandId === 'string' &&
      typeof obj.playerId === 'string' &&
      typeof obj.gameId === 'string' &&
      typeof obj.timestamp === 'number' &&
      typeof obj.payload === 'object' &&
      obj.payload !== null
    );
  }
}
