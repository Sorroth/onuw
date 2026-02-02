/**
 * @fileoverview NextAuth.js type extensions.
 * @module types/next-auth
 *
 * @description
 * Extends NextAuth.js types to include our custom session properties
 * (backendToken, backendUserId) following TypeScript declaration merging.
 */

import 'next-auth';
import 'next-auth/jwt';

declare module 'next-auth' {
  /**
   * Extended session interface with backend authentication data.
   */
  interface Session {
    /** JWT token from our backend for WebSocket authentication */
    backendToken?: string;
    /** User ID from our backend database */
    backendUserId?: string;
    /** Whether the user has admin privileges */
    isAdmin?: boolean;
    user: {
      id?: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }
}

declare module 'next-auth/jwt' {
  /**
   * Extended JWT interface with backend authentication data.
   */
  interface JWT {
    /** JWT token from our backend */
    backendToken?: string;
    /** User ID from our backend database */
    backendUserId?: string;
    /** Display name from backend */
    displayName?: string;
    /** Whether the user has admin privileges */
    isAdmin?: boolean;
  }
}
