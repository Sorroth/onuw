/**
 * @fileoverview Password hashing and JWT token utilities.
 * @module utils/password
 *
 * @description
 * Provides secure password hashing using bcrypt and JWT token
 * generation/verification for authentication.
 */

import * as bcrypt from 'bcrypt';
import * as jwt from 'jsonwebtoken';
import * as crypto from 'crypto';

/**
 * Number of salt rounds for bcrypt.
 * Higher = more secure but slower.
 */
const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS || '12', 10);

/**
 * JWT configuration.
 */
const JWT_SECRET = process.env.JWT_SECRET || 'change-this-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

/**
 * Token payload interface.
 */
export interface TokenPayload {
  userId: string;
  sessionId: string;
  iat?: number;
  exp?: number;
}

/**
 * @summary Hashes a password using bcrypt.
 *
 * @param {string} password - Plain text password
 * @returns {Promise<string>} Bcrypt hash
 *
 * @example
 * ```typescript
 * const hash = await hashPassword('mySecurePassword123');
 * // Store hash in database
 * ```
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

/**
 * @summary Verifies a password against a hash.
 *
 * @param {string} password - Plain text password to verify
 * @param {string} hash - Bcrypt hash to compare against
 * @returns {Promise<boolean>} True if password matches
 *
 * @example
 * ```typescript
 * const isValid = await verifyPassword('myPassword', storedHash);
 * if (isValid) {
 *   // Login successful
 * }
 * ```
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * @summary Generates a JWT access token.
 *
 * @param {string} userId - User ID to encode
 * @param {string} sessionId - Session ID to encode
 * @returns {string} JWT token
 *
 * @example
 * ```typescript
 * const token = generateToken(user.id, session.id);
 * // Send token to client
 * ```
 */
export function generateToken(userId: string, sessionId: string): string {
  const payload: TokenPayload = { userId, sessionId };
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'] });
}

/**
 * @summary Verifies and decodes a JWT token.
 *
 * @param {string} token - JWT token to verify
 * @returns {TokenPayload | null} Decoded payload or null if invalid
 *
 * @example
 * ```typescript
 * const payload = verifyToken(token);
 * if (payload) {
 *   // Token is valid, payload.userId contains the user ID
 * }
 * ```
 */
export function verifyToken(token: string): TokenPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as TokenPayload;
  } catch {
    return null;
  }
}

/**
 * @summary Generates a random token for email verification or password reset.
 *
 * @param {number} length - Length of the token in bytes (will be hex encoded)
 * @returns {string} Random hex-encoded token
 *
 * @example
 * ```typescript
 * const verificationToken = generateRandomToken(32);
 * // 64 character hex string
 * ```
 */
export function generateRandomToken(length: number = 32): string {
  return crypto.randomBytes(length).toString('hex');
}

/**
 * @summary Hashes a token for storage.
 *
 * @description
 * Uses SHA-256 to hash tokens before storing in database.
 * This way, even if the database is compromised, the actual
 * tokens cannot be recovered.
 *
 * @param {string} token - Token to hash
 * @returns {string} SHA-256 hash
 *
 * @example
 * ```typescript
 * const token = generateRandomToken();
 * const hash = hashToken(token);
 * // Store hash in database, send token to user
 * ```
 */
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * @summary Validates password strength.
 *
 * @description
 * Checks that password meets minimum security requirements:
 * - At least 8 characters
 * - Contains at least one uppercase letter
 * - Contains at least one lowercase letter
 * - Contains at least one number
 *
 * @param {string} password - Password to validate
 * @returns {object} Validation result
 *
 * @example
 * ```typescript
 * const { valid, errors } = validatePassword('weak');
 * if (!valid) {
 *   console.log(errors); // ['Password must be at least 8 characters']
 * }
 * ```
 */
export function validatePassword(password: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (password.length < 8) {
    errors.push('Password must be at least 8 characters');
  }
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * @summary Validates email format.
 *
 * @param {string} email - Email to validate
 * @returns {boolean} True if valid email format
 */
export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * @summary Calculates token expiration date.
 *
 * @param {string} expiresIn - Expiration string (e.g., '7d', '1h', '30m')
 * @returns {Date} Expiration date
 */
export function calculateExpiration(expiresIn: string): Date {
  const match = expiresIn.match(/^(\d+)([smhd])$/);
  if (!match) {
    throw new Error(`Invalid expiration format: ${expiresIn}`);
  }

  const value = parseInt(match[1], 10);
  const unit = match[2];

  const now = new Date();
  switch (unit) {
    case 's':
      return new Date(now.getTime() + value * 1000);
    case 'm':
      return new Date(now.getTime() + value * 60 * 1000);
    case 'h':
      return new Date(now.getTime() + value * 60 * 60 * 1000);
    case 'd':
      return new Date(now.getTime() + value * 24 * 60 * 60 * 1000);
    default:
      throw new Error(`Unknown time unit: ${unit}`);
  }
}
