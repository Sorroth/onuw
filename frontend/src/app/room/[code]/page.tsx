'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useWebSocket } from '@/hooks/useWebSocket';
import { GamePhase } from '@/types/game';
import { LobbyView } from '@/components/game/LobbyView';
import { NightPhaseView } from '@/components/game/NightPhaseView';
import { DayPhaseView } from '@/components/game/DayPhaseView';
import { VotingPhaseView } from '@/components/game/VotingPhaseView';
import { ResultsView } from '@/components/game/ResultsView';
import { Button } from '@/components/ui';
import { ROUTES } from '@/lib/routes';

export default function RoomPage() {
  const params = useParams();
  const router = useRouter();
  const roomCode = params.code as string;

  // useWebSocket maintains the WebSocket connection
  const {
    roomState,
    gameView,
    gameResult,
    connectionState,
    error,
    leaveRoom
  } = useWebSocket();

  // Redirect if not in a room
  useEffect(() => {
    if (connectionState === 'connected' && !roomState && !gameView) {
      router.push(ROUTES.HOME);
    }
  }, [connectionState, roomState, gameView, router]);

  const handleLeave = () => {
    leaveRoom();
    router.push(ROUTES.HOME);
  };

  // Loading state
  if (connectionState === 'connecting' || connectionState === 'reconnecting') {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-400">Connecting...</p>
        </div>
      </main>
    );
  }

  // Error state
  if (error) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center p-4">
        <div className="bg-red-900/50 text-red-300 px-6 py-4 rounded-lg mb-4 text-center">
          <p className="font-semibold mb-2">Error</p>
          <p>{error}</p>
        </div>
        <Button onClick={() => router.push(ROUTES.HOME)} variant="secondary">
          Return Home
        </Button>
      </main>
    );
  }

  // Game results view
  if (gameResult) {
    return (
      <main className="min-h-screen p-4">
        <ResultsView onLeave={handleLeave} />
      </main>
    );
  }

  // Active game view - render based on phase
  if (gameView) {
    return (
      <main className="min-h-screen">
        {gameView.phase === GamePhase.NIGHT && <NightPhaseView />}
        {gameView.phase === GamePhase.DAY && <DayPhaseView />}
        {gameView.phase === GamePhase.VOTING && <VotingPhaseView />}
        {(gameView.phase === GamePhase.SETUP || gameView.phase === GamePhase.RESOLUTION) && (
          <div className="flex items-center justify-center min-h-screen">
            <div className="text-center">
              <div className="animate-pulse text-2xl text-gray-400">
                {gameView.phase === GamePhase.SETUP ? 'Setting up game...' : 'Calculating results...'}
              </div>
            </div>
          </div>
        )}
      </main>
    );
  }

  // Lobby view (pre-game)
  if (roomState) {
    return (
      <main className="min-h-screen p-4">
        <LobbyView onLeave={handleLeave} />
      </main>
    );
  }

  // Fallback
  return (
    <main className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <p className="text-gray-400 mb-4">Room not found</p>
        <Button onClick={() => router.push(ROUTES.HOME)}>Return Home</Button>
      </div>
    </main>
  );
}
