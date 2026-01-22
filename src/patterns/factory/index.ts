/**
 * @fileoverview Factory Pattern exports.
 * @module patterns/factory
 *
 * @summary Exports factory classes for creating game objects.
 *
 * @description
 * This module provides Factory Method Pattern implementations for
 * creating game objects like Roles.
 *
 * @pattern Factory Method Pattern
 * - Encapsulates object creation logic
 * - Decouples clients from concrete classes
 * - Centralizes configuration
 *
 * @example
 * ```typescript
 * import { RoleFactory } from './patterns/factory';
 *
 * // Create a single role
 * const seer = RoleFactory.createRole(RoleName.SEER);
 *
 * // Create multiple roles for a game setup
 * const gameRoles = RoleFactory.createRoles([
 *   RoleName.WEREWOLF,
 *   RoleName.WEREWOLF,
 *   RoleName.SEER,
 *   RoleName.ROBBER,
 *   RoleName.TROUBLEMAKER,
 *   RoleName.VILLAGER,
 *   RoleName.VILLAGER,
 *   RoleName.DRUNK
 * ]);
 * ```
 */

export { RoleFactory } from './RoleFactory';
