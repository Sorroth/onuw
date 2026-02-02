/**
 * @fileoverview NextAuth.js configuration for OAuth authentication.
 * @module auth
 *
 * @description
 * Configures NextAuth.js with multiple OAuth providers following the
 * Adapter Pattern - each provider implements a common interface for
 * authentication.
 *
 * @pattern Adapter Pattern - Unified interface for different OAuth providers
 * @pattern Facade Pattern - Simplified authentication API
 * @pattern Strategy Pattern - Interchangeable authentication strategies
 */

import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';
import Discord from 'next-auth/providers/discord';
import GitHub from 'next-auth/providers/github';
import type { NextAuthConfig } from 'next-auth';

/**
 * OAuth provider configuration.
 * Maps to database oauth_providers table (provider_code field).
 */
const PROVIDER_CODES = {
  google: 'google',
  discord: 'discord',
  github: 'github',
} as const;

/**
 * Backend API URL for OAuth token exchange.
 */
const BACKEND_URL = process.env.BACKEND_URL ?? 'http://localhost:8080';

/**
 * Exchange OAuth credentials with backend to get game server token.
 *
 * @description
 * After NextAuth authenticates with the OAuth provider, we exchange
 * the provider's user info for our own JWT token from the backend.
 * This follows the Command Pattern - encapsulating the exchange request.
 *
 * @param providerCode - OAuth provider code (google, discord, github)
 * @param externalId - User's ID from the OAuth provider
 * @param email - User's email from the OAuth provider
 * @param name - User's display name from the OAuth provider
 * @param image - User's avatar URL from the OAuth provider
 * @param accessToken - OAuth access token (optional, for token refresh)
 * @returns Backend auth result with JWT token
 */
async function exchangeOAuthForBackendToken(params: {
  providerCode: string;
  externalId: string;
  email: string;
  name: string;
  image?: string;
  accessToken?: string;
}): Promise<{ token: string; userId: string; displayName: string; isAdmin?: boolean } | null> {
  console.log('[OAuth] Exchanging token with backend:', BACKEND_URL);
  console.log('[OAuth] Params:', { ...params, accessToken: params.accessToken ? '***' : undefined });

  try {
    // Call backend OAuth endpoint via HTTP
    const response = await fetch(`${BACKEND_URL}/api/auth/oauth`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        providerCode: params.providerCode,
        externalId: params.externalId,
        email: params.email,
        displayName: params.name,
        avatarUrl: params.image,
        accessToken: params.accessToken,
      }),
    });

    console.log('[OAuth] Backend response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[OAuth] Backend OAuth exchange failed:', response.status, errorText);
      return null;
    }

    const result = await response.json();
    console.log('[OAuth] Backend response:', { success: result.success, hasData: !!result.data });

    if (result.success && result.data) {
      console.log('[OAuth] Exchange successful, userId:', result.data.userId);
      return result.data;
    }
    console.error('[OAuth] Backend returned success=false or no data');
    return null;
  } catch (error) {
    console.error('[OAuth] Error exchanging OAuth token with backend:', error);
    return null;
  }
}

/**
 * NextAuth configuration following the Strategy Pattern.
 * Each provider is an interchangeable authentication strategy.
 */
export const authConfig: NextAuthConfig = {
  providers: [
    /**
     * Google OAuth Provider
     * @see https://console.cloud.google.com/apis/credentials
     */
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      authorization: {
        params: {
          prompt: 'consent',
          access_type: 'offline',
          response_type: 'code',
        },
      },
    }),

    /**
     * Discord OAuth Provider
     * @see https://discord.com/developers/applications
     */
    Discord({
      clientId: process.env.DISCORD_CLIENT_ID,
      clientSecret: process.env.DISCORD_CLIENT_SECRET,
    }),

    /**
     * GitHub OAuth Provider
     * @see https://github.com/settings/developers
     */
    GitHub({
      clientId: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
    }),
  ],

  /**
   * Custom pages for authentication flow.
   */
  pages: {
    signIn: '/auth/signin',
    error: '/auth/signin',
  },

  /**
   * Callbacks implement the Observer Pattern - reacting to auth events.
   */
  callbacks: {
    /**
     * JWT callback - called when token is created or updated.
     * We exchange the OAuth token for our backend token here.
     *
     * @pattern Observer Pattern - React to authentication events
     */
    async jwt({ token, account, profile }) {
      console.log('[OAuth] JWT callback called, hasAccount:', !!account, 'hasProfile:', !!profile);

      // On initial sign-in, exchange OAuth for backend token
      if (account && profile) {
        console.log('[OAuth] New sign-in detected, provider:', account.provider);
        const providerCode = PROVIDER_CODES[account.provider as keyof typeof PROVIDER_CODES];

        if (providerCode) {
          console.log('[OAuth] Calling backend exchange for provider:', providerCode);
          const backendAuth = await exchangeOAuthForBackendToken({
            providerCode,
            externalId: account.providerAccountId,
            email: profile.email ?? '',
            name: profile.name ?? profile.email ?? 'User',
            image: (profile as { picture?: string; avatar_url?: string; image?: string }).picture
              ?? (profile as { avatar_url?: string }).avatar_url
              ?? (profile as { image?: string }).image,
            accessToken: account.access_token,
          });

          if (backendAuth) {
            console.log('[OAuth] Backend auth successful, storing in token');
            // Store backend token in NextAuth JWT
            token.backendToken = backendAuth.token;
            token.backendUserId = backendAuth.userId;
            token.displayName = backendAuth.displayName;
            token.isAdmin = backendAuth.isAdmin;
          } else {
            console.error('[OAuth] Backend auth failed, no token stored');
          }
        }
      }

      console.log('[OAuth] JWT callback returning, hasBackendToken:', !!token.backendToken);
      return token;
    },

    /**
     * Session callback - customize session object sent to client.
     * Only expose necessary data following Information Hiding principle.
     *
     * @pattern Information Hiding - Only expose what client needs
     */
    async session({ session, token }) {
      // Add backend token and user info to session
      if (token.backendToken) {
        session.backendToken = token.backendToken as string;
        session.backendUserId = token.backendUserId as string;
        session.user.id = token.backendUserId as string;
        session.isAdmin = token.isAdmin as boolean | undefined;
        if (token.displayName) {
          session.user.name = token.displayName as string;
        }
      }

      return session;
    },

    /**
     * Authorized callback - determine if request is authorized.
     */
    authorized({ auth }) {
      return !!auth?.user;
    },
  },

  /**
   * Session configuration.
   */
  session: {
    strategy: 'jwt',
    maxAge: 7 * 24 * 60 * 60, // 7 days
  },

  /**
   * Enable debug logging in development.
   */
  debug: process.env.NODE_ENV === 'development',

  /**
   * Trust the host header for Docker/proxy environments.
   * Required when running behind reverse proxy or in containers.
   */
  trustHost: true,
};

/**
 * NextAuth handlers and utilities.
 * @pattern Facade Pattern - Simple interface to complex auth system
 */
export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);
