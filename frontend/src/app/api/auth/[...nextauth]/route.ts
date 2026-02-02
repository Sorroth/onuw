/**
 * @fileoverview NextAuth.js API route handler.
 * @module app/api/auth/[...nextauth]/route
 *
 * @description
 * Exports the NextAuth.js route handlers for OAuth authentication.
 * This follows the Facade Pattern - providing a simple interface
 * to the complex NextAuth authentication system.
 *
 * @pattern Facade Pattern - Simple API route interface
 */

import { handlers } from '@/auth';

export const { GET, POST } = handlers;
