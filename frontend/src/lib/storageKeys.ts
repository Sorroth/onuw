/**
 * @fileoverview Local storage key constants.
 * @module lib/storageKeys
 *
 * @description
 * Centralized localStorage key definitions to eliminate magic strings
 * and ensure consistency across the application.
 *
 * @pattern Constant Object Pattern - Centralized key definitions
 * @pattern Single Source of Truth - One location for storage keys
 */

/**
 * LocalStorage keys used throughout the application.
 * Use these constants instead of hardcoded strings.
 */
export const STORAGE_KEYS = {
  /** JWT auth token for backend authentication */
  AUTH_TOKEN: 'onuw_auth_token',

  /** Current player's ID */
  PLAYER_ID: 'onuw_player_id',

  /** Current player's display name */
  PLAYER_NAME: 'onuw_player_name',
} as const;

/**
 * Type for storage key values.
 */
export type StorageKey = typeof STORAGE_KEYS[keyof typeof STORAGE_KEYS];
