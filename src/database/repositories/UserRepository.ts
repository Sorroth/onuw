/**
 * @fileoverview User repository for database operations.
 * @module database/repositories/UserRepository
 *
 * @description
 * Provides data access methods for user-related operations including
 * user creation, lookup, profile management, and OAuth linking.
 *
 * @pattern Repository Pattern - Abstracts data access logic
 */

import { DatabaseService, getDatabase } from '../DatabaseService';
import { DbUser, DbUserProfile, DbUserOAuthLink, UserDto } from '../types';
import { IUserRepository, CreateUserParams, OAuthLinkParams } from './interfaces';

/**
 * @summary Repository for user data access.
 *
 * @description
 * Handles all database operations related to users, including:
 * - User creation and lookup
 * - Profile management
 * - OAuth account linking
 * - Preference management
 */
export class UserRepository implements IUserRepository {
  private db: DatabaseService;

  constructor(db?: DatabaseService) {
    this.db = db || getDatabase();
  }

  /**
   * @summary Creates a new user with profile.
   *
   * @param {CreateUserParams} params - User creation parameters
   * @returns {Promise<UserDto>} Created user
   */
  async createUser(params: CreateUserParams): Promise<UserDto> {
    const { email, passwordHash, displayName } = params;

    return this.db.transaction(async (client) => {
      // Create user
      const userResult = await client.query<DbUser>(
        `INSERT INTO users (email, password_hash)
         VALUES ($1, $2)
         RETURNING *`,
        [email, passwordHash || null]
      );
      const user = userResult.rows[0];

      // Create profile
      const profileResult = await client.query<DbUserProfile>(
        `INSERT INTO user_profiles (user_id, display_name)
         VALUES ($1, $2)
         RETURNING *`,
        [user.user_id, displayName]
      );
      const profile = profileResult.rows[0];

      // Initialize statistics
      await client.query(
        `INSERT INTO player_statistics (user_id) VALUES ($1)`,
        [user.user_id]
      );

      return this.toUserDto(user, profile);
    });
  }

  /**
   * @summary Finds a user by ID.
   *
   * @param {string} userId - User ID
   * @returns {Promise<UserDto | null>} User or null
   */
  async findById(userId: string): Promise<UserDto | null> {
    const result = await this.db.queryOne<DbUser & DbUserProfile>(
      `SELECT u.*, up.display_name, up.avatar_url
       FROM users u
       JOIN user_profiles up ON u.user_id = up.user_id
       WHERE u.user_id = $1`,
      [userId]
    );

    if (!result) return null;

    return {
      userId: result.user_id,
      email: result.email,
      emailVerified: result.email_verified,
      displayName: result.display_name,
      avatarUrl: result.avatar_url,
      createdAt: result.created_at
    };
  }

  /**
   * @summary Finds a user by email.
   *
   * @param {string} email - Email address
   * @returns {Promise<(UserDto & { passwordHash: string | null }) | null>} User with password hash
   */
  async findByEmail(email: string): Promise<(UserDto & { passwordHash: string | null }) | null> {
    const result = await this.db.queryOne<DbUser & DbUserProfile>(
      `SELECT u.*, up.display_name, up.avatar_url
       FROM users u
       JOIN user_profiles up ON u.user_id = up.user_id
       WHERE u.email = $1`,
      [email.toLowerCase()]
    );

    if (!result) return null;

    return {
      userId: result.user_id,
      email: result.email,
      emailVerified: result.email_verified,
      displayName: result.display_name,
      avatarUrl: result.avatar_url,
      createdAt: result.created_at,
      passwordHash: result.password_hash
    };
  }

  /**
   * @summary Finds a user by OAuth provider and external ID.
   *
   * @param {string} providerCode - OAuth provider code
   * @param {string} externalId - External user ID from provider
   * @returns {Promise<UserDto | null>} User or null
   */
  async findByOAuth(providerCode: string, externalId: string): Promise<UserDto | null> {
    const result = await this.db.queryOne<DbUser & DbUserProfile & DbUserOAuthLink>(
      `SELECT u.*, up.display_name, up.avatar_url
       FROM users u
       JOIN user_profiles up ON u.user_id = up.user_id
       JOIN user_oauth_links uol ON u.user_id = uol.user_id
       WHERE uol.provider_code = $1 AND uol.external_id = $2`,
      [providerCode, externalId]
    );

    if (!result) return null;

    return {
      userId: result.user_id,
      email: result.email,
      emailVerified: result.email_verified,
      displayName: result.display_name,
      avatarUrl: result.avatar_url,
      createdAt: result.created_at
    };
  }

  /**
   * @summary Links an OAuth account to a user.
   *
   * @param {OAuthLinkParams} params - OAuth link parameters
   */
  async linkOAuth(params: OAuthLinkParams): Promise<void> {
    await this.db.query(
      `INSERT INTO user_oauth_links
         (user_id, provider_code, external_id, access_token, refresh_token, token_expires_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (user_id, provider_code)
       DO UPDATE SET
         external_id = EXCLUDED.external_id,
         access_token = EXCLUDED.access_token,
         refresh_token = EXCLUDED.refresh_token,
         token_expires_at = EXCLUDED.token_expires_at`,
      [
        params.userId,
        params.providerCode,
        params.externalId,
        params.accessToken || null,
        params.refreshToken || null,
        params.tokenExpiresAt || null
      ]
    );
  }

  /**
   * @summary Updates a user's profile.
   *
   * @param {string} userId - User ID
   * @param {object} updates - Profile updates
   */
  async updateProfile(
    userId: string,
    updates: { displayName?: string; avatarUrl?: string }
  ): Promise<void> {
    const setClauses: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (updates.displayName !== undefined) {
      setClauses.push(`display_name = $${paramIndex++}`);
      values.push(updates.displayName);
    }
    if (updates.avatarUrl !== undefined) {
      setClauses.push(`avatar_url = $${paramIndex++}`);
      values.push(updates.avatarUrl);
    }

    if (setClauses.length === 0) return;

    values.push(userId);
    await this.db.query(
      `UPDATE user_profiles SET ${setClauses.join(', ')} WHERE user_id = $${paramIndex}`,
      values
    );
  }

  /**
   * @summary Updates a user's password.
   *
   * @param {string} userId - User ID
   * @param {string} passwordHash - New password hash
   */
  async updatePassword(userId: string, passwordHash: string): Promise<void> {
    await this.db.query(
      `UPDATE users SET password_hash = $1 WHERE user_id = $2`,
      [passwordHash, userId]
    );
  }

  /**
   * @summary Marks a user's email as verified.
   *
   * @param {string} userId - User ID
   */
  async verifyEmail(userId: string): Promise<void> {
    await this.db.query(
      `UPDATE users SET email_verified = TRUE WHERE user_id = $1`,
      [userId]
    );
  }

  /**
   * @summary Gets a user preference.
   *
   * @param {string} userId - User ID
   * @param {string} key - Preference key
   * @returns {Promise<T | null>} Preference value or null
   */
  async getPreference<T>(userId: string, key: string): Promise<T | null> {
    const result = await this.db.queryOne<{ preference_value: T }>(
      `SELECT preference_value FROM user_preferences WHERE user_id = $1 AND preference_key = $2`,
      [userId, key]
    );
    return result?.preference_value || null;
  }

  /**
   * @summary Sets a user preference.
   *
   * @param {string} userId - User ID
   * @param {string} key - Preference key
   * @param {unknown} value - Preference value
   */
  async setPreference(userId: string, key: string, value: unknown): Promise<void> {
    await this.db.query(
      `INSERT INTO user_preferences (user_id, preference_key, preference_value)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, preference_key)
       DO UPDATE SET preference_value = EXCLUDED.preference_value`,
      [userId, key, JSON.stringify(value)]
    );
  }

  /**
   * @summary Gets all preferences for a user.
   *
   * @param {string} userId - User ID
   * @returns {Promise<Record<string, unknown>>} Preferences map
   */
  async getAllPreferences(userId: string): Promise<Record<string, unknown>> {
    const results = await this.db.queryAll<{ preference_key: string; preference_value: unknown }>(
      `SELECT preference_key, preference_value FROM user_preferences WHERE user_id = $1`,
      [userId]
    );

    const prefs: Record<string, unknown> = {};
    for (const row of results) {
      prefs[row.preference_key] = row.preference_value;
    }
    return prefs;
  }

  /**
   * @summary Checks if an email is already registered.
   *
   * @param {string} email - Email to check
   * @returns {Promise<boolean>} True if email exists
   */
  async emailExists(email: string): Promise<boolean> {
    const result = await this.db.queryOne<{ exists: boolean }>(
      `SELECT EXISTS(SELECT 1 FROM users WHERE email = $1) AS exists`,
      [email.toLowerCase()]
    );
    return result?.exists || false;
  }

  /**
   * @summary Converts database user to DTO.
   */
  private toUserDto(user: DbUser, profile: DbUserProfile): UserDto {
    return {
      userId: user.user_id,
      email: user.email,
      emailVerified: user.email_verified,
      displayName: profile.display_name,
      avatarUrl: profile.avatar_url,
      createdAt: user.created_at
    };
  }
}
