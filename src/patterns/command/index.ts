/**
 * @fileoverview Command Pattern exports.
 * @module patterns/command
 *
 * @summary Exports all command pattern implementations for game actions.
 *
 * @description
 * This module provides Command Pattern implementations for
 * encapsulating game actions. Commands enable:
 * - Audit logging of all actions
 * - Serializable game history
 * - Decoupled action handling
 *
 * @pattern Command Pattern
 * - Encapsulates actions as objects
 * - Supports logging and history
 * - Enables serialization
 *
 * @example
 * ```typescript
 * import {
 *   IGameAction,
 *   SwapAction,
 *   ViewAction,
 *   VoteAction
 * } from './patterns/command';
 *
 * // Create and log actions
 * const swap = new SwapAction(actorId, phase, role, pos1, pos2);
 * const view = new ViewAction(actorId, phase, role, viewedCards);
 * const vote = new VoteAction(actorId, phase, targetId);
 *
 * // Get audit entries
 * auditLog.add(swap.getAuditEntry(stateHash));
 * ```
 */

// Interface and base class
export { IGameAction, AbstractGameAction } from './GameAction';

// Concrete commands
export { SwapAction } from './SwapAction';
export { ViewAction } from './ViewAction';
export { VoteAction } from './VoteAction';

// Network-serializable commands
export {
  // Types
  NetworkCommandType,
  SerializedCommand,
  INetworkCommand,
  NetworkCommandValidationContext,
  NetworkCommandValidationResult,

  // Base class
  AbstractNetworkCommand,

  // Concrete network commands
  SelectPlayerCommand,
  SelectCenterCommand,
  SelectTwoCentersCommand,
  SelectTwoPlayersCommand,
  SeerChoiceCommand,
  StatementCommand,
  VoteCommand,

  // Factory
  NetworkCommandFactory,

  // Utilities
  resetCommandIdCounter
} from './NetworkCommand';
