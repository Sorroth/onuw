/**
 * @fileoverview OAuth authentication hook for NextAuth.js integration.
 * @module hooks/useOAuth
 *
 * @description
 * Provides OAuth authentication functionality that integrates NextAuth.js
 * with our WebSocket-based game server authentication.
 *
 * @pattern Adapter Pattern - Adapts NextAuth session to game store
 * @pattern Observer Pattern - Watches session changes and updates store
 * @pattern Facade Pattern - Simple interface for OAuth operations
 */

'use client';

import { useEffect, useCallback } from 'react';
import { signIn, signOut, useSession } from 'next-auth/react';
import { useGameStore } from '@/stores/gameStore';
import { STORAGE_KEYS } from '@/lib/storageKeys';

/**
 * OAuth provider types supported by the application.
 * Maps to database oauth_providers.provider_code
 */
export type OAuthProvider = 'google' | 'discord' | 'github';

/**
 * OAuth authentication state and methods.
 */
export interface UseOAuthReturn {
  /** Whether user is authenticated via OAuth */
  isOAuthAuthenticated: boolean;
  /** Whether OAuth session is loading */
  isLoading: boolean;
  /** OAuth user email */
  email: string | null;
  /** OAuth user name */
  name: string | null;
  /** OAuth user avatar URL */
  image: string | null;
  /** Initiate OAuth sign-in with a provider */
  signInWithProvider: (provider: OAuthProvider) => Promise<void>;
  /** Sign out from OAuth */
  signOutOAuth: () => Promise<void>;
}

/**
 * @summary Hook for OAuth authentication.
 *
 * @description
 * Integrates NextAuth.js OAuth with the game store's authentication
 * state. When a user signs in via OAuth, the backend token is
 * synchronized to the game store for WebSocket authentication.
 *
 * @returns {UseOAuthReturn} OAuth state and methods
 *
 * @example
 * ```tsx
 * function SignInPage() {
 *   const { signInWithProvider, isLoading } = useOAuth();
 *
 *   return (
 *     <button onClick={() => signInWithProvider('google')} disabled={isLoading}>
 *       Sign in with Google
 *     </button>
 *   );
 * }
 * ```
 */
export function useOAuth(): UseOAuthReturn {
  const { data: session, status } = useSession();
  const {
    setAuthToken,
    setPlayerInfo,
    ws,
    isAuthenticated: gameStoreAuthenticated
  } = useGameStore();

  /**
   * Sync NextAuth session to game store.
   * This follows the Observer Pattern - reacting to session changes.
   */
  useEffect(() => {
    if (status === 'authenticated' && session?.backendToken && session?.backendUserId) {
      // Store the backend token in game store
      setAuthToken(session.backendToken);
      setPlayerInfo(session.backendUserId, session.user?.name ?? 'Player');

      // Save to localStorage for persistence
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, session.backendToken);
        localStorage.setItem(STORAGE_KEYS.PLAYER_ID, session.backendUserId);
        localStorage.setItem(STORAGE_KEYS.PLAYER_NAME, session.user?.name ?? 'Player');
      }

      // If WebSocket is connected, update credentials and re-authenticate
      // This ensures admin status is properly registered on the server
      if (ws) {
        ws.updateCredentials(
          session.backendUserId,
          session.user?.name ?? 'Player',
          session.backendToken
        );
        ws.reauthenticate();
      }
    }
  }, [session, status, setAuthToken, setPlayerInfo, ws]);

  /**
   * Sign in with an OAuth provider.
   * Uses NextAuth.js signIn function.
   */
  const signInWithProvider = useCallback(async (provider: OAuthProvider) => {
    await signIn(provider, { callbackUrl: '/' });
  }, []);

  /**
   * Sign out from OAuth.
   * Clears both NextAuth session and game store.
   */
  const signOutOAuth = useCallback(async () => {
    // Clear game store
    setAuthToken(null);

    // Clear localStorage
    if (typeof window !== 'undefined') {
      localStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN);
      localStorage.removeItem(STORAGE_KEYS.PLAYER_ID);
      localStorage.removeItem(STORAGE_KEYS.PLAYER_NAME);
    }

    // Sign out from NextAuth
    await signOut({ callbackUrl: '/' });
  }, [setAuthToken]);

  return {
    isOAuthAuthenticated: status === 'authenticated' && !!session?.backendToken,
    isLoading: status === 'loading',
    email: session?.user?.email ?? null,
    name: session?.user?.name ?? null,
    image: session?.user?.image ?? null,
    signInWithProvider,
    signOutOAuth
  };
}
