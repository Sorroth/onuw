'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button, Card, CardContent, CardHeader, CardTitle, Input, GoogleIcon, DiscordIcon, GitHubIcon } from '@/components/ui';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useOAuth } from '@/hooks/useOAuth';
import { ROUTES } from '@/lib/routes';

/**
 * @fileoverview Sign-up page with email/password and OAuth options.
 * @module app/auth/signup/page
 *
 * @description
 * Provides multiple registration methods following the Strategy Pattern:
 * - Email/password registration via WebSocket
 * - OAuth registration via NextAuth.js (Google, Discord, GitHub)
 *
 * @pattern Strategy Pattern - Multiple interchangeable auth strategies
 * @pattern Observer Pattern - Reacts to auth state changes
 */
export default function SignUpPage() {
  const router = useRouter();
  const { register, error, isLoading, isAuthenticated } = useWebSocket();
  const {
    signInWithProvider,
    isOAuthAuthenticated,
    isLoading: oauthLoading
  } = useOAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [validationError, setValidationError] = useState('');

  // Redirect if authenticated via either method
  useEffect(() => {
    if (isAuthenticated || isOAuthAuthenticated) {
      router.push(ROUTES.HOME);
    }
  }, [isAuthenticated, isOAuthAuthenticated, router]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError('');

    if (password !== confirmPassword) {
      setValidationError('Passwords do not match');
      return;
    }

    if (password.length < 8) {
      setValidationError('Password must be at least 8 characters');
      return;
    }

    if (displayName.length < 2) {
      setValidationError('Display name must be at least 2 characters');
      return;
    }

    register(email, password, displayName);
  };

  const handleOAuthSignUp = async (provider: 'google' | 'discord' | 'github') => {
    await signInWithProvider(provider);
  };

  const displayError = validationError || error;

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-center">Create Account</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {displayError && (
              <div className="bg-red-900/50 text-red-300 px-4 py-2 rounded-lg text-center text-sm">
                {displayError}
              </div>
            )}

            <Input
              label="Display Name"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your display name"
              maxLength={20}
              required
            />

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
              placeholder="At least 8 characters"
              required
            />

            <Input
              label="Confirm Password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm your password"
              required
            />

            <Button
              type="submit"
              disabled={isLoading || !email || !password || !displayName}
              isLoading={isLoading}
              className="w-full"
              size="lg"
            >
              Create Account
            </Button>
          </form>

          {/* OAuth buttons */}
          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-700"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-gray-800 text-gray-400">Or sign up with</span>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-3">
              <Button
                variant="secondary"
                onClick={() => handleOAuthSignUp('google')}
                disabled={oauthLoading}
                className="flex items-center justify-center gap-2"
              >
                <GoogleIcon className="w-5 h-5" />
                <span className="sr-only sm:not-sr-only">Google</span>
              </Button>
              <Button
                variant="secondary"
                onClick={() => handleOAuthSignUp('discord')}
                disabled={oauthLoading}
                className="flex items-center justify-center gap-2"
              >
                <DiscordIcon className="w-5 h-5" />
                <span className="sr-only sm:not-sr-only">Discord</span>
              </Button>
              <Button
                variant="secondary"
                onClick={() => handleOAuthSignUp('github')}
                disabled={oauthLoading}
                className="flex items-center justify-center gap-2"
              >
                <GitHubIcon className="w-5 h-5" />
                <span className="sr-only sm:not-sr-only">GitHub</span>
              </Button>
            </div>
          </div>

          {/* Sign in link */}
          <p className="mt-6 text-center text-gray-400">
            Already have an account?{' '}
            <Link href={ROUTES.AUTH.SIGNIN} className="text-blue-400 hover:underline">
              Sign in
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
