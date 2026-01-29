/**
 * @fileoverview Session repository for database operations.
 * @module database/repositories/SessionRepository
 *
 * @description
 * Provides data access methods for session management including
 * creation, validation, and cleanup of user sessions.
 *
 * @pattern Repository Pattern - Abstracts data access logic
 */

import { DatabaseService, getDatabase } from '../DatabaseService';
import { DbSession, SessionDto } from '../types';
import { ISessionRepository, CreateSessionParams, SessionWithUser } from './interfaces';

/**
 * @summary Repository for session data access.
 *
 * @description
 * Handles all database operations related to sessions, including:
 * - Session creation and validation
 * - Session revocation
 * - Cleanup of expired sessions
 */
export class SessionRepository implements ISessionRepository {
  private db: DatabaseService;

  constructor(db?: DatabaseService) {
    this.db = db || getDatabase();
  }

  /**
   * @summary Creates a new session.
   *
   * @param {CreateSessionParams} params - Session parameters
   * @returns {Promise<string>} Session ID
   */
  async createSession(params: CreateSessionParams): Promise<string> {
    const result = await this.db.queryOne<{ session_id: string }>(
      `INSERT INTO sessions (user_id, token_hash, expires_at, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING session_id`,
      [
        params.userId,
        params.tokenHash,
        params.expiresAt,
        params.ipAddress || null,
        params.userAgent || null
      ]
    );

    return result!.session_id;
  }

  /**
   * @summary Finds a session by token hash.
   *
   * @param {string} tokenHash - SHA-256 hash of the session token
   * @returns {Promise<SessionWithUser | null>} Session or null
   */
  async findByToken(tokenHash: string): Promise<SessionWithUser | null> {
    const result = await this.db.queryOne<DbSession>(
      `SELECT * FROM sessions WHERE token_hash = $1`,
      [tokenHash]
    );

    if (!result) return null;

    return {
      sessionId: result.session_id,
      userId: result.user_id,
      expiresAt: result.expires_at,
      createdAt: result.created_at,
      isRevoked: result.is_revoked
    };
  }

  /**
   * @summary Validates a session token.
   *
   * @description
   * Checks if the session exists, is not revoked, and has not expired.
   * Also updates the last activity timestamp.
   *
   * @param {string} tokenHash - SHA-256 hash of the session token
   * @returns {Promise<string | null>} User ID if valid, null otherwise
   */
  async validateSession(tokenHash: string): Promise<string | null> {
    const result = await this.db.queryOne<{ user_id: string }>(
      `UPDATE sessions
       SET last_activity_at = NOW()
       WHERE token_hash = $1
         AND is_revoked = FALSE
         AND expires_at > NOW()
       RETURNING user_id`,
      [tokenHash]
    );

    return result?.user_id || null;
  }

  /**
   * @summary Validates a session by session ID.
   *
   * @description
   * Checks if the session exists, is not revoked, and has not expired.
   * Also updates the last activity timestamp.
   *
   * @param {string} sessionId - The session UUID
   * @returns {Promise<string | null>} User ID if valid, null otherwise
   */
  async validateSessionById(sessionId: string): Promise<string | null> {
    const result = await this.db.queryOne<{ user_id: string }>(
      `UPDATE sessions
       SET last_activity_at = NOW()
       WHERE session_id = $1
         AND is_revoked = FALSE
         AND expires_at > NOW()
       RETURNING user_id`,
      [sessionId]
    );

    return result?.user_id || null;
  }

  /**
   * @summary Revokes a session.
   *
   * @param {string} sessionId - Session ID to revoke
   */
  async revokeSession(sessionId: string): Promise<void> {
    await this.db.query(
      `UPDATE sessions SET is_revoked = TRUE WHERE session_id = $1`,
      [sessionId]
    );
  }

  /**
   * @summary Revokes a session by token hash.
   *
   * @param {string} tokenHash - Token hash of session to revoke
   */
  async revokeByToken(tokenHash: string): Promise<void> {
    await this.db.query(
      `UPDATE sessions SET is_revoked = TRUE WHERE token_hash = $1`,
      [tokenHash]
    );
  }

  /**
   * @summary Revokes all sessions for a user.
   *
   * @param {string} userId - User ID
   * @param {string} [exceptSessionId] - Session ID to keep (optional)
   */
  async revokeAllUserSessions(userId: string, exceptSessionId?: string): Promise<void> {
    if (exceptSessionId) {
      await this.db.query(
        `UPDATE sessions
         SET is_revoked = TRUE
         WHERE user_id = $1 AND session_id != $2 AND is_revoked = FALSE`,
        [userId, exceptSessionId]
      );
    } else {
      await this.db.query(
        `UPDATE sessions SET is_revoked = TRUE WHERE user_id = $1 AND is_revoked = FALSE`,
        [userId]
      );
    }
  }

  /**
   * @summary Gets all active sessions for a user.
   *
   * @param {string} userId - User ID
   * @returns {Promise<SessionWithUser[]>} Active sessions
   */
  async getActiveSessions(userId: string): Promise<SessionWithUser[]> {
    const results = await this.db.queryAll<DbSession>(
      `SELECT * FROM sessions
       WHERE user_id = $1 AND is_revoked = FALSE AND expires_at > NOW()
       ORDER BY last_activity_at DESC`,
      [userId]
    );

    return results.map((s) => ({
      sessionId: s.session_id,
      userId: s.user_id,
      expiresAt: s.expires_at,
      createdAt: s.created_at,
      isRevoked: s.is_revoked
    }));
  }

  /**
   * @summary Cleans up expired sessions.
   *
   * @description
   * Deletes sessions that have expired or been revoked for more than 7 days.
   *
   * @returns {Promise<number>} Number of sessions deleted
   */
  async cleanupExpired(): Promise<number> {
    const result = await this.db.query(
      `DELETE FROM sessions
       WHERE expires_at < NOW() - INTERVAL '7 days'
          OR (is_revoked = TRUE AND created_at < NOW() - INTERVAL '7 days')`,
      []
    );

    return result.rowCount || 0;
  }

  /**
   * @summary Extends a session's expiration.
   *
   * @param {string} sessionId - Session ID
   * @param {Date} newExpiresAt - New expiration date
   */
  async extendSession(sessionId: string, newExpiresAt: Date): Promise<void> {
    await this.db.query(
      `UPDATE sessions SET expires_at = $1 WHERE session_id = $2`,
      [newExpiresAt, sessionId]
    );
  }
}
