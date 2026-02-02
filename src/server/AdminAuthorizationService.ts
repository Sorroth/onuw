/**
 * @fileoverview Centralized admin authorization service.
 * @module server/AdminAuthorizationService
 *
 * @summary Manages admin user authorization for privileged operations.
 *
 * @description
 * AdminAuthorizationService centralizes all admin-related authorization:
 * - Tracks which connections belong to admin users
 * - Provides authorization checks for admin-only operations
 * - Logs unauthorized access attempts
 *
 * @pattern Single Responsibility - Handles only admin authorization
 * @pattern Service Pattern - Provides authorization as a service
 *
 * @example
 * ```typescript
 * const adminAuth = new AdminAuthorizationService();
 *
 * // Register admin on authentication
 * adminAuth.registerAdmin(connectionId);
 *
 * // Check authorization before privileged operation
 * if (adminAuth.canUseDebugOptions(connectionId)) {
 *   // Allow debug options
 * }
 * ```
 */

import { DebugOptions } from '../network/protocol';

/**
 * @summary Admin authorization result.
 */
export interface AuthorizationResult {
  /** Whether the operation is authorized */
  authorized: boolean;
  /** Reason if not authorized */
  reason?: string;
}

/**
 * @summary Admin operation types that require authorization.
 */
export type AdminOperation =
  | 'useDebugOptions'
  | 'forceRole'
  | 'forceHostElimination'
  | 'revealAllRoles'
  | 'showCenterCards';

/**
 * @summary Service for admin user authorization.
 *
 * @description
 * Centralizes all admin authorization checks to ensure consistent
 * handling across the server. Provides logging for unauthorized
 * access attempts.
 *
 * @pattern Service Pattern - Encapsulates authorization logic
 */
export class AdminAuthorizationService {
  /** Set of connection IDs belonging to admin users */
  private readonly adminConnections: Set<string> = new Set();

  /** Logger function for unauthorized attempts */
  private readonly logger: (message: string) => void;

  /**
   * @summary Creates a new admin authorization service.
   *
   * @param {(message: string) => void} [logger=console.log] - Logger function
   */
  constructor(logger: (message: string) => void = console.log) {
    this.logger = logger;
  }

  /**
   * @summary Registers a connection as belonging to an admin user.
   *
   * @param {string} connectionId - Connection ID to register
   *
   * @example
   * ```typescript
   * // On authentication, if user is admin
   * if (user.isAdmin) {
   *   adminAuth.registerAdmin(connection.id);
   * }
   * ```
   */
  registerAdmin(connectionId: string): void {
    this.adminConnections.add(connectionId);
    this.logger(`[AdminAuth] Admin registered: ${connectionId}`);
  }

  /**
   * @summary Unregisters a connection from admin status.
   *
   * @param {string} connectionId - Connection ID to unregister
   *
   * @example
   * ```typescript
   * // On disconnect
   * adminAuth.unregisterAdmin(connection.id);
   * ```
   */
  unregisterAdmin(connectionId: string): void {
    if (this.adminConnections.delete(connectionId)) {
      this.logger(`[AdminAuth] Admin unregistered: ${connectionId}`);
    }
  }

  /**
   * @summary Checks if a connection belongs to an admin user.
   *
   * @param {string} connectionId - Connection ID to check
   *
   * @returns {boolean} True if connection is admin
   */
  isAdmin(connectionId: string): boolean {
    return this.adminConnections.has(connectionId);
  }

  /**
   * @summary Checks if a connection can use debug options.
   *
   * @param {string} connectionId - Connection ID to check
   * @param {string} [playerId] - Optional player ID for logging
   *
   * @returns {AuthorizationResult} Authorization result
   */
  canUseDebugOptions(connectionId: string, playerId?: string): AuthorizationResult {
    if (this.adminConnections.has(connectionId)) {
      return { authorized: true };
    }

    this.logUnauthorizedAttempt('useDebugOptions', connectionId, playerId);
    return {
      authorized: false,
      reason: 'Debug options require admin privileges'
    };
  }

  /**
   * @summary Authorizes and filters debug options.
   *
   * @description
   * For admin users, returns the debug options as-is.
   * For non-admin users, returns undefined and logs the attempt.
   *
   * @param {string} connectionId - Connection ID
   * @param {DebugOptions | undefined} options - Debug options from request
   * @param {string} [playerId] - Optional player ID for logging
   *
   * @returns {DebugOptions | undefined} Authorized options or undefined
   *
   * @example
   * ```typescript
   * const debugOptions = adminAuth.authorizeDebugOptions(
   *   connection.id,
   *   message.debug,
   *   session.playerId
   * );
   *
   * // debugOptions will be undefined if user is not admin
   * room.startGame(playerId, debugOptions);
   * ```
   */
  authorizeDebugOptions(
    connectionId: string,
    options: DebugOptions | undefined,
    playerId?: string
  ): DebugOptions | undefined {
    if (!options) {
      return undefined;
    }

    if (this.adminConnections.has(connectionId)) {
      return options;
    }

    this.logUnauthorizedAttempt('useDebugOptions', connectionId, playerId);
    return undefined;
  }

  /**
   * @summary Checks authorization for a specific admin operation.
   *
   * @param {AdminOperation} operation - Operation to authorize
   * @param {string} connectionId - Connection ID
   * @param {string} [playerId] - Optional player ID for logging
   *
   * @returns {AuthorizationResult} Authorization result
   */
  authorize(
    operation: AdminOperation,
    connectionId: string,
    playerId?: string
  ): AuthorizationResult {
    if (this.adminConnections.has(connectionId)) {
      return { authorized: true };
    }

    this.logUnauthorizedAttempt(operation, connectionId, playerId);
    return {
      authorized: false,
      reason: `Operation '${operation}' requires admin privileges`
    };
  }

  /**
   * @summary Gets the count of active admin connections.
   *
   * @returns {number} Number of admin connections
   */
  getAdminCount(): number {
    return this.adminConnections.size;
  }

  /**
   * @summary Clears all admin registrations.
   *
   * @description
   * Should be called when the server is shutting down.
   */
  clear(): void {
    this.adminConnections.clear();
    this.logger('[AdminAuth] All admin registrations cleared');
  }

  /**
   * @summary Logs an unauthorized access attempt.
   *
   * @param {AdminOperation} operation - Attempted operation
   * @param {string} connectionId - Connection ID
   * @param {string} [playerId] - Optional player ID
   *
   * @private
   */
  private logUnauthorizedAttempt(
    operation: AdminOperation,
    connectionId: string,
    playerId?: string
  ): void {
    const identifier = playerId ?? connectionId;
    this.logger(`[AdminAuth] Unauthorized attempt: ${operation} by ${identifier}`);
  }
}
