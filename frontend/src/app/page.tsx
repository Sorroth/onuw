'use client';

/**
 * @fileoverview Home page with authentication and room management.
 * @module app/page
 *
 * @description
 * Main entry point for the ONUW game. Handles user authentication
 * (guest, OAuth, email/password) and room creation/joining.
 *
 * @pattern Facade Pattern - Simplified interface to complex auth/room operations
 * @pattern Observer Pattern - Reacts to auth and room state changes
 * @pattern Strategy Pattern - Multiple authentication strategies available
 */

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Card, CardContent, CardHeader, CardTitle, Input } from '@/components/ui';
import { PublicRoomList } from '@/components/lobby';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useOAuth } from '@/hooks/useOAuth';
import { ROUTES } from '@/lib/routes';
import { getConnectionStatusDisplay } from '@/lib/connectionStatus';

/**
 * Home page component.
 * Provides authentication options and room management interface.
 */
export default function Home() {
  const router = useRouter();
  const {
    connectionState,
    isConnected,
    isAuthenticated: isWsAuthenticated,
    playerName: wsPlayerName,
    roomState,
    publicRooms,
    error,
    authenticateAsGuest,
    createRoom,
    joinRoom,
    listPublicRooms,
    clearError
  } = useWebSocket();

  const {
    isOAuthAuthenticated,
    name: oauthName,
    isLoading: oauthLoading,
    signOutOAuth
  } = useOAuth();

  // Combined auth state - authenticated via either WebSocket or OAuth
  const isAuthenticated = isWsAuthenticated || isOAuthAuthenticated;
  const playerName = wsPlayerName || oauthName || '';

  const [name, setName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [mode, setMode] = useState<'home' | 'join'>('home');
  const [joinMode, setJoinMode] = useState<'browse' | 'code'>('browse');
  const [isMounted, setIsMounted] = useState(false);

  // Prevent hydration mismatch by only rendering auth-dependent content on client
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Navigate to lobby when room is joined
  useEffect(() => {
    if (roomState) {
      router.push(ROUTES.ROOM(roomState.roomCode));
    }
  }, [roomState, router]);

  const handleQuickPlay = () => {
    if (!name.trim()) return;
    authenticateAsGuest(name.trim());
  };

  const handleCreateRoom = () => {
    if (!isAuthenticated) return;
    createRoom({});
  };

  const handleJoinRoom = () => {
    // Use stored playerName for authenticated users, local name state for guests
    const joinName = isAuthenticated ? playerName : name.trim();
    if (!roomCode.trim() || !joinName) return;
    clearError(); // Clear any previous errors before attempting join
    if (!isAuthenticated) {
      authenticateAsGuest(name.trim());
    }
    // Small delay to ensure authentication completes
    setTimeout(() => {
      joinRoom(roomCode.trim().toUpperCase(), joinName);
    }, 100);
  };

  // Handler for joining a public room from the browser
  const handleJoinPublicRoom = useCallback((code: string) => {
    clearError();
    const joinName = isAuthenticated ? playerName : name.trim();
    if (!joinName) {
      // Need a name first
      setRoomCode(code);
      setJoinMode('code');
      return;
    }
    joinRoom(code, joinName);
  }, [clearError, isAuthenticated, playerName, name, joinRoom]);

  // Memoize refresh callback
  const handleRefreshRooms = useCallback(() => {
    listPublicRooms();
  }, [listPublicRooms]);

  const status = getConnectionStatusDisplay(connectionState);

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-4">
      {/* Logo/Title */}
      <div className="text-center mb-8">
        <h1 className="text-4xl md:text-5xl font-bold text-white mb-2">
          One Night
        </h1>
        <h2 className="text-2xl md:text-3xl font-semibold text-red-500">
          Ultimate Werewolf
        </h2>
        <p className="text-gray-400 mt-2">
          Deception, deduction, and one night of chaos
        </p>
      </div>

      {/* Connection Status */}
      <div className={`text-sm mb-4 ${status.color}`}>
        {status.text}
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-900/50 text-red-300 px-4 py-2 rounded-lg mb-4 max-w-md text-center">
          {error}
        </div>
      )}

      {/* Main Card */}
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-center">
            {mode === 'home' ? 'Play Now' : 'Join Room'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Show loading state until client-side hydration is complete */}
          {!isMounted || oauthLoading ? (
            <div className="text-center text-gray-400 py-4">Loading...</div>
          ) : mode === 'home' ? (
            <div className="space-y-4">
              {/* Name Input */}
              {!isAuthenticated && (
                <Input
                  label="Your Name"
                  placeholder="Enter your name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={20}
                />
              )}

              {isAuthenticated ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-gray-300">
                      Playing as <span className="text-white font-semibold">{playerName}</span>
                    </p>
                    <Button
                      onClick={signOutOAuth}
                      variant="ghost"
                      size="sm"
                      className="text-gray-400 hover:text-white"
                    >
                      Logout
                    </Button>
                  </div>

                  {/* Create Room */}
                  <Button
                    onClick={handleCreateRoom}
                    disabled={!isConnected}
                    className="w-full"
                    size="lg"
                  >
                    Create Room
                  </Button>

                  {/* Join Room */}
                  <Button
                    onClick={() => { clearError(); setMode('join'); }}
                    variant="secondary"
                    className="w-full"
                    size="lg"
                  >
                    Join Room
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Quick Play (Guest) */}
                  <Button
                    onClick={handleQuickPlay}
                    disabled={!isConnected || !name.trim()}
                    className="w-full"
                    size="lg"
                  >
                    Quick Play
                  </Button>

                  {/* Divider */}
                  <div className="relative my-4">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-gray-700"></div>
                    </div>
                    <div className="relative flex justify-center text-sm">
                      <span className="px-2 bg-gray-800 text-gray-400">or</span>
                    </div>
                  </div>

                  {/* Sign In */}
                  <Button
                    onClick={() => router.push(ROUTES.AUTH.SIGNIN)}
                    variant="secondary"
                    className="w-full"
                  >
                    Sign In
                  </Button>

                  {/* Create Account */}
                  <Button
                    onClick={() => router.push(ROUTES.AUTH.SIGNUP)}
                    variant="ghost"
                    className="w-full"
                  >
                    Create Account
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {/* Tab Switcher */}
              <div className="flex rounded-lg bg-gray-700/50 p-1">
                <button
                  onClick={() => setJoinMode('browse')}
                  className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                    joinMode === 'browse'
                      ? 'bg-gray-600 text-white'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  Browse Public
                </button>
                <button
                  onClick={() => setJoinMode('code')}
                  className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                    joinMode === 'code'
                      ? 'bg-gray-600 text-white'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  Enter Code
                </button>
              </div>

              {/* Browse Public Rooms */}
              {joinMode === 'browse' && (
                <PublicRoomList
                  rooms={publicRooms}
                  onRefresh={handleRefreshRooms}
                  onJoinRoom={handleJoinPublicRoom}
                />
              )}

              {/* Enter Room Code */}
              {joinMode === 'code' && (
                <div className="space-y-4">
                  <Input
                    label="Room Code"
                    placeholder="Enter 6-character code"
                    value={roomCode}
                    onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                    maxLength={6}
                    className="text-center text-2xl tracking-widest font-mono"
                  />

                  {/* Name (if not authenticated) */}
                  {!isAuthenticated && (
                    <Input
                      label="Your Name"
                      placeholder="Enter your name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      maxLength={20}
                    />
                  )}

                  {/* Join Button */}
                  <Button
                    onClick={handleJoinRoom}
                    disabled={!isConnected || !roomCode.trim() || (!isAuthenticated && !name.trim())}
                    className="w-full"
                    size="lg"
                  >
                    Join Room
                  </Button>
                </div>
              )}

              {/* Back Button */}
              <Button
                onClick={() => { clearError(); setMode('home'); }}
                variant="ghost"
                className="w-full"
              >
                Back
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Footer */}
      <p className="text-gray-500 text-sm mt-8">
        3-10 players • 10 minute games
      </p>
    </main>
  );
}
