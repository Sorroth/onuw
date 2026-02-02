'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button, Card, CardContent, CardHeader, CardTitle, Input, GoogleIcon, DiscordIcon, GitHubIcon } from '@/components/ui';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useOAuth } from '@/hooks/useOAuth';
import { ROUTES } from '@/lib/routes';

/**
 * @fileoverview Sign-in page with email/password and OAuth options.
 * @module app/auth/signin/page
 *
 * @description
 * Provides multiple authentication methods following the Strategy Pattern:
 * - Email/password login via WebSocket
 * - OAuth login via NextAuth.js (Google, Discord, GitHub)
 *
 * @pattern Strategy Pattern - Multiple interchangeable auth strategies
 * @pattern Observer Pattern - Reacts to auth state changes
 */
export default function SignInPage() {
  const router = useRouter();
  const { login, error, isLoading, isAuthenticated } = useWebSocket();
  const {
    signInWithProvider,
    isOAuthAuthenticated,
    isLoading: oauthLoading
  } = useOAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Redirect if authenticated via either method
  useEffect(() => {
    if (isAuthenticated || isOAuthAuthenticated) {
      router.push(ROUTES.HOME);
    }
  }, [isAuthenticated, isOAuthAuthenticated, router]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email && password) {
      login(email, password);
    }
  };

  const handleOAuthSignIn = async (provider: 'google' | 'discord' | 'github') => {
    await signInWithProvider(provider);
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-center">Sign In</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-red-900/50 text-red-300 px-4 py-2 rounded-lg text-center text-sm">
                {error}
              </div>
            )}

            <Input
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              required
            />

            <Input
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
            />

            <Button
              type="submit"
              disabled={isLoading || !email || !password}
              isLoading={isLoading}
              className="w-full"
              size="lg"
            >
              Sign In
            </Button>
          </form>

          {/* OAuth buttons */}
          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-700"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-gray-800 text-gray-400">Or continue with</span>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-3">
              <Button
                variant="secondary"
                onClick={() => handleOAuthSignIn('google')}
                disabled={oauthLoading}
                className="flex items-center justify-center gap-2"
              >
                <GoogleIcon className="w-5 h-5" />
                <span className="sr-only sm:not-sr-only">Google</span>
              </Button>
              <Button
                variant="secondary"
                onClick={() => handleOAuthSignIn('discord')}
                disabled={oauthLoading}
                className="flex items-center justify-center gap-2"
              >
                <DiscordIcon className="w-5 h-5" />
                <span className="sr-only sm:not-sr-only">Discord</span>
              </Button>
              <Button
                variant="secondary"
                onClick={() => handleOAuthSignIn('github')}
                disabled={oauthLoading}
                className="flex items-center justify-center gap-2"
              >
                <GitHubIcon className="w-5 h-5" />
                <span className="sr-only sm:not-sr-only">GitHub</span>
              </Button>
            </div>
          </div>

          {/* Sign up link */}
          <p className="mt-6 text-center text-gray-400">
            Don't have an account?{' '}
            <Link href={ROUTES.AUTH.SIGNUP} className="text-blue-400 hover:underline">
              Sign up
            </Link>
          </p>

          {/* Back link */}
          <p className="mt-2 text-center">
            <Link href={ROUTES.HOME} className="text-gray-500 hover:text-gray-300">
              ← Back to home
            </Link>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
