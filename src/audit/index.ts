/**
 * @fileoverview Audit system exports.
 * @module audit
 *
 * @summary Exports audit system components for game tracking.
 *
 * @description
 * This module provides comprehensive game auditing:
 * - AuditLog: Records all game events
 * - GameStateSnapshot: Captures game state
 * - CircularDetector: Prevents infinite loops
 *
 * @example
 * ```typescript
 * import { AuditLog, GameStateSnapshot, CircularDetector } from './audit';
 *
 * const auditLog = new AuditLog();
 * game.setAuditCallback((action, details) => {
 *   auditLog.record(action, details, game.getState());
 * });
 *
 * // After game
 * console.log(auditLog.getSummary());
 * ```
 */

export { AuditLog } from './AuditLog';
export { GameStateSnapshot } from './GameStateSnapshot';
export { CircularDetector } from './CircularDetector';
