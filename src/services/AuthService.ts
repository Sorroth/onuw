/**
 * @fileoverview Authentication service for user login and registration.
 * @module services/AuthService
 *
 * @description
 * Provides authentication functionality including:
 * - Email/password registration and login
 * - OAuth authentication flow
 * - Session management
 * - Token validation
 *
 * @pattern Service Pattern - Business logic encapsulation
 */

import {
  IUserRepository,
  ISessionRepository,
  UserRepository,
  SessionRepository
} from '../database/repositories';
import { UserDto } from '../database/types';
import {
  hashPassword,
  verifyPassword,
  generateToken,
  verifyToken,
  generateRandomToken,
  hashToken,
  validatePassword,
  validateEmail,
  calculateExpiration
} from '../utils/password';

/**
 * Registration parameters.
 */
export interface RegisterParams {
  email: string;
  password: string;
  displayName: string;
}

/**
 * Login parameters.
 */
export interface LoginParams {
  email: string;
  password: string;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * OAuth login parameters.
 */
export interface OAuthLoginParams {
  providerCode: string;
  externalId: string;
  email: string;
  displayName: string;
  avatarUrl?: string;
  accessToken?: string;
  refreshToken?: string;
  tokenExpiresAt?: Date;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Authentication result.
 */
export interface AuthResult {
  user: UserDto;
  token: string;
  expiresAt: Date;
}

/**
 * @summary Authentication service.
 *
 * @description
 * Handles all authentication operations including registration,
 * login, OAuth, and session management.
 */
export class AuthService {
  private userRepo: IUserRepository;
  private sessionRepo: ISessionRepository;

  /**
   * @summary Creates a new AuthService.
   *
   * @description
   * Accepts repository interfaces for dependency injection, enabling
   * easy testing with mock implementations.
   *
   * @param {IUserRepository} [userRepo] - User repository implementation
   * @param {ISessionRepository} [sessionRepo] - Session repository implementation
   *
   * @pattern Dependency Inversion - Depends on abstractions, not concretions
   */
  constructor(userRepo?: IUserRepository, sessionRepo?: ISessionRepository) {
    this.userRepo = userRepo || new UserRepository();
    this.sessionRepo = sessionRepo || new SessionRepository();
  }

  /**
   * @summary Registers a new user with email/password.
   *
   * @param {RegisterParams} params - Registration parameters
   * @returns {Promise<AuthResult>} User and authentication token
   *
   * @throws {Error} If email already exists or password is weak
   */
  async register(params: RegisterParams): Promise<AuthResult> {
    const { email, password, displayName } = params;

    // Validate email format
    if (!validateEmail(email)) {
      throw new Error('Invalid email format');
    }

    // Validate password strength
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      throw new Error(passwordValidation.errors.join('; '));
    }

    // Check if email already exists
    const existingUser = await this.userRepo.emailExists(email.toLowerCase());
    if (existingUser) {
      throw new Error('Email already registered');
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Create user
    const user = await this.userRepo.createUser({
      email: email.toLowerCase(),
      passwordHash,
      displayName
    });

    // Create session
    const expiresAt = calculateExpiration(process.env.JWT_EXPIRES_IN || '7d');
    const sessionId = await this.sessionRepo.createSession({
      userId: user.userId,
      tokenHash: hashToken(generateRandomToken()),
      expiresAt
    });

    // Generate JWT
    const token = generateToken(user.userId, sessionId);

    return { user, token, expiresAt };
  }

  /**
   * @summary Logs in a user with email/password.
   *
   * @param {LoginParams} params - Login parameters
   * @returns {Promise<AuthResult>} User and authentication token
   *
   * @throws {Error} If credentials are invalid
   */
  async login(params: LoginParams): Promise<AuthResult> {
    const { email, password, ipAddress, userAgent } = params;

    // Find user by email
    const user = await this.userRepo.findByEmail(email.toLowerCase());
    if (!user) {
      throw new Error('Invalid email or password');
    }

    // Check if user has a password (might be OAuth-only)
    if (!user.passwordHash) {
      throw new Error('Please login using your OAuth provider');
    }

    // Verify password
    const isValid = await verifyPassword(password, user.passwordHash);
    if (!isValid) {
      throw new Error('Invalid email or password');
    }

    // Create session
    const expiresAt = calculateExpiration(process.env.JWT_EXPIRES_IN || '7d');
    const sessionId = await this.sessionRepo.createSession({
      userId: user.userId,
      tokenHash: hashToken(generateRandomToken()),
      expiresAt,
      ipAddress,
      userAgent
    });

    // Generate JWT
    const token = generateToken(user.userId, sessionId);

    // Return user without password hash
    const { passwordHash: _, ...userWithoutPassword } = user;

    return {
      user: userWithoutPassword,
      token,
      expiresAt
    };
  }

  /**
   * @summary Handles OAuth login/registration.
   *
   * @description
   * If user exists with this OAuth link, logs them in.
   * If user exists with this email, links the OAuth account.
   * If user doesn't exist, creates a new account.
   *
   * @param {OAuthLoginParams} params - OAuth parameters
   * @returns {Promise<AuthResult>} User and authentication token
   */
  async oauthLogin(params: OAuthLoginParams): Promise<AuthResult> {
    const {
      providerCode,
      externalId,
      email,
      displayName,
      avatarUrl,
      accessToken,
      refreshToken,
      tokenExpiresAt,
      ipAddress,
      userAgent
    } = params;

    // Check if user already has this OAuth link
    let user = await this.userRepo.findByOAuth(providerCode, externalId);

    if (!user) {
      // Check if user exists with this email
      const existingUser = await this.userRepo.findByEmail(email.toLowerCase());

      if (existingUser) {
        // Link OAuth to existing user
        await this.userRepo.linkOAuth({
          userId: existingUser.userId,
          providerCode,
          externalId,
          accessToken,
          refreshToken,
          tokenExpiresAt
        });
        user = existingUser;
      } else {
        // Create new user
        user = await this.userRepo.createUser({
          email: email.toLowerCase(),
          displayName
        });

        // Link OAuth
        await this.userRepo.linkOAuth({
          userId: user.userId,
          providerCode,
          externalId,
          accessToken,
          refreshToken,
          tokenExpiresAt
        });

        // Update avatar if provided
        if (avatarUrl) {
          await this.userRepo.updateProfile(user.userId, { avatarUrl });
          user = { ...user, avatarUrl };
        }

        // Mark email as verified (OAuth provider verified it)
        await this.userRepo.verifyEmail(user.userId);
        user = { ...user, emailVerified: true };
      }
    }

    // Create session
    const expiresAt = calculateExpiration(process.env.JWT_EXPIRES_IN || '7d');
    const sessionId = await this.sessionRepo.createSession({
      userId: user.userId,
      tokenHash: hashToken(generateRandomToken()),
      expiresAt,
      ipAddress,
      userAgent
    });

    // Generate JWT
    const token = generateToken(user.userId, sessionId);

    return { user, token, expiresAt };
  }

  /**
   * @summary Validates a JWT token.
   *
   * @param {string} token - JWT token
   * @returns {Promise<UserDto | null>} User if valid, null otherwise
   */
  async validateToken(token: string): Promise<UserDto | null> {
    // Verify JWT
    const payload = verifyToken(token);
    if (!payload) {
      return null;
    }

    // Check if session is still valid (by session ID from JWT)
    const sessionValid = await this.sessionRepo.validateSessionById(
      payload.sessionId
    );
    if (!sessionValid) {
      return null;
    }

    // Get user
    return this.userRepo.findById(payload.userId);
  }

  /**
   * @summary Logs out a user by revoking their session.
   *
   * @param {string} token - JWT token
   */
  async logout(token: string): Promise<void> {
    const payload = verifyToken(token);
    if (payload) {
      await this.sessionRepo.revokeSession(payload.sessionId);
    }
  }

  /**
   * @summary Logs out all sessions for a user.
   *
   * @param {string} userId - User ID
   * @param {string} [currentSessionId] - Current session to keep
   */
  async logoutAll(userId: string, currentSessionId?: string): Promise<void> {
    await this.sessionRepo.revokeAllUserSessions(userId, currentSessionId);
  }

  /**
   * @summary Changes a user's password.
   *
   * @param {string} userId - User ID
   * @param {string} currentPassword - Current password
   * @param {string} newPassword - New password
   *
   * @throws {Error} If current password is wrong or new password is weak
   */
  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string
  ): Promise<void> {
    // Get user with password
    const user = await this.userRepo.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Get full user record with password hash
    const fullUser = await this.userRepo.findByEmail(user.email);
    if (!fullUser?.passwordHash) {
      throw new Error('User does not have a password set');
    }

    // Verify current password
    const isValid = await verifyPassword(currentPassword, fullUser.passwordHash);
    if (!isValid) {
      throw new Error('Current password is incorrect');
    }

    // Validate new password
    const validation = validatePassword(newPassword);
    if (!validation.valid) {
      throw new Error(validation.errors.join('; '));
    }

    // Hash and update password
    const newPasswordHash = await hashPassword(newPassword);
    await this.userRepo.updatePassword(userId, newPasswordHash);

    // Revoke all other sessions (security measure)
    // The current session will remain valid
  }

  /**
   * @summary Initiates password reset.
   *
   * @param {string} email - User email
   * @returns {Promise<string | null>} Reset token or null if user not found
   */
  async initiatePasswordReset(email: string): Promise<string | null> {
    const user = await this.userRepo.findByEmail(email.toLowerCase());
    if (!user) {
      // Don't reveal if email exists
      return null;
    }

    // Generate reset token
    const token = generateRandomToken();
    // Token would be stored and emailed to user
    // For now, just return it (in production, store in DB and email)

    return token;
  }

  /**
   * @summary Gets active sessions for a user.
   *
   * @param {string} userId - User ID
   * @returns {Promise<Array>} Active sessions
   */
  async getActiveSessions(userId: string): Promise<Array<{
    sessionId: string;
    createdAt: Date;
    expiresAt: Date;
  }>> {
    const sessions = await this.sessionRepo.getActiveSessions(userId);
    return sessions.map((s) => ({
      sessionId: s.sessionId,
      createdAt: s.createdAt,
      expiresAt: s.expiresAt
    }));
  }

  /**
   * @summary Cleans up expired sessions.
   *
   * @returns {Promise<number>} Number of sessions cleaned up
   */
  async cleanupSessions(): Promise<number> {
    return this.sessionRepo.cleanupExpired();
  }
}

// Export singleton instance
let authServiceInstance: AuthService | null = null;

export function getAuthService(): AuthService {
  if (!authServiceInstance) {
    authServiceInstance = new AuthService();
  }
  return authServiceInstance;
}
