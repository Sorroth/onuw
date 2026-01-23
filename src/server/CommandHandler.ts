/**
 * @fileoverview Command handler for processing network commands.
 * @module server/CommandHandler
 *
 * @summary Processes incoming network commands with validation and execution.
 *
 * @description
 * This module provides server-side command handling that:
 * - Deserializes network commands from client messages
 * - Validates commands against current game state
 * - Executes valid commands and broadcasts results
 * - Logs all commands for audit trail
 *
 * @pattern Command Pattern - Processes command objects
 * @pattern Chain of Responsibility - Validation chain
 *
 * @example
 * ```typescript
 * const handler = new CommandHandler(auditLog);
 *
 * // Handle incoming action response
 * const result = handler.handleActionResponse(
 *   playerId,
 *   requestId,
 *   response,
 *   game,
 *   validationContext
 * );
 *
 * if (result.success) {
 *   // Command was valid and processed
 * } else {
 *   // Send error to client
 *   connection.send({ type: 'error', message: result.error });
 * }
 * ```
 */

import {
  NetworkCommandFactory,
  SerializedCommand,
  NetworkCommandValidationContext,
  INetworkCommand,
  SelectPlayerCommand,
  SelectCenterCommand,
  SelectTwoCentersCommand,
  SelectTwoPlayersCommand,
  SeerChoiceCommand,
  StatementCommand,
  VoteCommand
} from '../patterns/command';
import { Game } from '../core/Game';
import { GamePhase } from '../enums';
import { AuditLog } from '../audit/AuditLog';

/**
 * @summary Result of command processing.
 */
export interface CommandResult {
  /** Whether command was successfully processed */
  success: boolean;

  /** Error message if failed */
  error?: string;

  /** The processed command (if successful) */
  command?: INetworkCommand;

  /** The response value extracted from the command */
  value?: unknown;
}

/**
 * @summary Handles network commands from clients.
 *
 * @description
 * The CommandHandler is responsible for:
 * 1. Creating command objects from client action responses
 * 2. Validating commands against game rules
 * 3. Logging commands for audit
 *
 * @pattern Command Pattern - Invoker role
 *
 * @example
 * ```typescript
 * const handler = new CommandHandler(auditLog);
 *
 * // When client responds to action request
 * const result = handler.processActionResponse(
 *   'player-1',
 *   'selectPlayer',
 *   'player-2',
 *   game,
 *   { validOptions: ['player-2', 'player-3'] }
 * );
 * ```
 */
export class CommandHandler {
  /** Audit log for recording commands */
  private auditLog?: AuditLog;

  /**
   * @summary Creates a new CommandHandler.
   *
   * @param {AuditLog} [auditLog] - Optional audit log for recording commands
   */
  constructor(auditLog?: AuditLog) {
    this.auditLog = auditLog;
  }

  /**
   * @summary Processes an action response from a client.
   *
   * @description
   * Converts a client action response into a command, validates it,
   * and returns the extracted value if valid.
   *
   * @param {string} playerId - Player who sent the response
   * @param {string} actionType - Type of action being responded to
   * @param {unknown} response - The response value from client
   * @param {Game} game - The game instance for validation
   * @param {Partial<NetworkCommandValidationContext>} [additionalContext] - Extra validation context
   *
   * @returns {CommandResult} Result of command processing
   *
   * @example
   * ```typescript
   * const result = handler.processActionResponse(
   *   'player-1',
   *   'selectPlayer',
   *   'player-2',
   *   game,
   *   { validOptions: ['player-2', 'player-3'] }
   * );
   *
   * if (result.success) {
   *   const selectedPlayer = result.value as string;
   * }
   * ```
   */
  processActionResponse(
    playerId: string,
    actionType: string,
    response: unknown,
    game: Game,
    additionalContext?: Partial<NetworkCommandValidationContext>
  ): CommandResult {
    try {
      // Create command from action type and response
      const command = this.createCommandFromResponse(
        playerId,
        game.getId?.() || 'game',
        actionType,
        response
      );

      if (!command) {
        return {
          success: false,
          error: `Unknown action type: ${actionType}`
        };
      }

      // Build validation context
      const context: NetworkCommandValidationContext = {
        phase: game.getPhase(),
        playerIds: game.getPlayerIds?.() || [],
        ...additionalContext
      };

      // Validate the command
      const validation = command.validate(context);
      if (!validation.valid) {
        return {
          success: false,
          error: validation.error || 'Invalid command'
        };
      }

      // Log the command for audit
      if (this.auditLog) {
        const serialized = command.serialize();
        this.auditLog.record('COMMAND_EXECUTED', {
          actorId: playerId,
          commandType: serialized.type,
          commandId: serialized.commandId,
          payload: serialized.payload
        });
      }

      // Extract the response value based on command type
      const value = this.extractValueFromCommand(command);

      return {
        success: true,
        command,
        value
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Command processing failed'
      };
    }
  }

  /**
   * @summary Creates a command object from an action response.
   *
   * @param {string} playerId - Player ID
   * @param {string} gameId - Game ID
   * @param {string} actionType - Type of action
   * @param {unknown} response - Response value
   *
   * @returns {INetworkCommand | null} Command object or null if unknown type
   *
   * @private
   */
  private createCommandFromResponse(
    playerId: string,
    gameId: string,
    actionType: string,
    response: unknown
  ): INetworkCommand | null {
    switch (actionType) {
      case 'selectPlayer':
        return new SelectPlayerCommand(playerId, gameId, response as string);

      case 'selectCenter':
        return new SelectCenterCommand(playerId, gameId, response as number);

      case 'selectTwoCenter':
      case 'selectTwoCenters':
        return new SelectTwoCentersCommand(playerId, gameId, response as [number, number]);

      case 'selectTwoPlayers':
        return new SelectTwoPlayersCommand(playerId, gameId, response as [string, string]);

      case 'seerChoice':
        return new SeerChoiceCommand(playerId, gameId, response as 'player' | 'center');

      case 'statement':
        return new StatementCommand(playerId, gameId, response as string);

      case 'vote':
        return new VoteCommand(playerId, gameId, response as string);

      default:
        return null;
    }
  }

  /**
   * @summary Extracts the response value from a command.
   *
   * @param {INetworkCommand} command - The command to extract from
   *
   * @returns {unknown} The extracted value
   *
   * @private
   */
  private extractValueFromCommand(command: INetworkCommand): unknown {
    if (command instanceof SelectPlayerCommand) {
      return command.targetId;
    }
    if (command instanceof SelectCenterCommand) {
      return command.centerIndex;
    }
    if (command instanceof SelectTwoCentersCommand) {
      return command.indices;
    }
    if (command instanceof SelectTwoPlayersCommand) {
      return command.targets;
    }
    if (command instanceof SeerChoiceCommand) {
      return command.choice;
    }
    if (command instanceof StatementCommand) {
      return command.statement;
    }
    if (command instanceof VoteCommand) {
      return command.targetId;
    }
    return null;
  }

  /**
   * @summary Processes a serialized command from the network.
   *
   * @description
   * Deserializes and validates a command received as JSON.
   *
   * @param {unknown} data - Raw command data (should be SerializedCommand)
   * @param {Game} game - Game instance for validation
   *
   * @returns {CommandResult} Result of command processing
   *
   * @example
   * ```typescript
   * const data = JSON.parse(message);
   * const result = handler.processSerializedCommand(data, game);
   * ```
   */
  processSerializedCommand(
    data: unknown,
    game: Game
  ): CommandResult {
    try {
      // Validate structure
      if (!NetworkCommandFactory.isValidSerializedCommand(data)) {
        return {
          success: false,
          error: 'Invalid command structure'
        };
      }

      // Deserialize
      const command = NetworkCommandFactory.deserialize(data);

      // Validate
      const context: NetworkCommandValidationContext = {
        phase: game.getPhase(),
        playerIds: game.getPlayerIds?.() || []
      };

      const validation = command.validate(context);
      if (!validation.valid) {
        return {
          success: false,
          error: validation.error
        };
      }

      // Log
      if (this.auditLog) {
        this.auditLog.record('COMMAND_EXECUTED', {
          actorId: command.playerId,
          commandType: command.type,
          commandId: command.id
        });
      }

      return {
        success: true,
        command,
        value: this.extractValueFromCommand(command)
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Deserialization failed'
      };
    }
  }
}
