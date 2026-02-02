/**
 * @fileoverview NextAuth.js SessionProvider wrapper.
 * @module components/providers/SessionProvider
 *
 * @description
 * Wraps the application with NextAuth.js SessionProvider for
 * OAuth session management.
 *
 * @pattern Provider Pattern - Provides session context to children
 */

'use client';

import { SessionProvider as NextAuthSessionProvider } from 'next-auth/react';
import { ReactNode } from 'react';

interface SessionProviderProps {
  children: ReactNode;
}

/**
 * @summary Session provider for OAuth authentication.
 *
 * @description
 * Wraps the application to provide NextAuth.js session context.
 * Must be used as a client component wrapper.
 *
 * @param {SessionProviderProps} props - Component props
 * @returns {JSX.Element} Provider wrapper
 */
export function SessionProvider({ children }: SessionProviderProps) {
  return (
    <NextAuthSessionProvider>
      {children}
    </NextAuthSessionProvider>
  );
}
