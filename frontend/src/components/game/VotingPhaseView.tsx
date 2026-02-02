'use client';

/**
 * @fileoverview Voting phase game view component.
 * @module components/game/VotingPhaseView
 *
 * @description
 * Displays the voting phase UI with unified layout.
 * Players select who to eliminate with vote badges showing live counts.
 *
 * @pattern Observer Pattern - Subscribes to game store state changes
 * @pattern State Pattern - Different UI states based on voting status
 */

import { useState, useMemo } from 'react';
import { useGameStore } from '@/stores/gameStore';
import { GamePhase } from '@/types/game';
import { GamePhaseLayout } from './GamePhaseLayout';
import { GameSidebar } from './GameSidebar';
import { PlayerCircle } from './PlayerCircle';
import { ChatPanel } from './ChatPanel';
import { FloatingChatButton } from './FloatingChatButton';
import { calculateVoteCounts, getVotersForPlayer } from './VoteBadge';
import { createPlayerNameResolver, toServerPlayerId } from '@/lib/playerUtils';
import { DebugInfoPanel } from './DebugInfoPanel';
import { useSpeechBubbles } from '@/hooks/useSpeechBubbles';

export function VotingPhaseView() {
  const {
    gameView,
    roomState,
    playerIdMapping,
    pendingActionRequest,
    sendActionResponse,
    submitStatement
  } = useGameStore();

  const [selectedTarget, setSelectedTarget] = useState<string | null>(null);
  const [hasVoted, setHasVoted] = useState(false);

  // Chat panel state
  const [chatPanelOpen, setChatPanelOpen] = useState(false);

  const getPlayerName = createPlayerNameResolver(playerIdMapping, roomState);

  // Speech bubbles for chat messages
  const { visibleBubblePlayerIds, exitingBubblePlayerIds } = useSpeechBubbles({
    statements: gameView?.statements || [],
    enabled: true
  });

  if (!gameView) return null;

  const handleVote = () => {
    if (selectedTarget && !hasVoted && pendingActionRequest?.requestId) {
      // Translate room player ID to server's game ID
      sendActionResponse(pendingActionRequest.requestId,
        toServerPlayerId(selectedTarget, playerIdMapping));
      setHasVoted(true);
    }
  };

  const handleCancel = () => {
    setSelectedTarget(null);
  };

  const handlePlayerClick = (playerId: string) => {
    if (!hasVoted && playerId !== gameView.myPlayerId) {
      setSelectedTarget(playerId);
    }
  };

  // Calculate vote counts and voter details from visible votes
  const voteCounts = useMemo(() => {
    if (!gameView.votes) return {};
    return calculateVoteCounts(gameView.votes);
  }, [gameView.votes]);

  const voteDetails = useMemo(() => {
    if (!gameView.votes) return {};
    const details: Record<string, string[]> = {};
    for (const playerId of Object.keys(voteCounts)) {
      details[playerId] = getVotersForPlayer(playerId, gameView.votes || {}, getPlayerName);
    }
    return details;
  }, [gameView.votes, voteCounts, getPlayerName]);

  // Count votes progress
  const votedCount = gameView.players.filter(p => p.hasVoted).length;
  const totalPlayers = gameView.players.length;

  return (
    <>
      <GamePhaseLayout
        phase={GamePhase.VOTING}
        showTimer={true}
        showSidebar={true}
        sidebarContent={<GameSidebar />}
        showPlayerCircle={true}
        playerCircleContent={
          <PlayerCircle
            players={gameView.players}
            selectedId={null}
            onPlayerClick={handlePlayerClick}
            interactive={!hasVoted}
            showVoteStatus={true}
            showCenterCards={true}
            showVoteBadges={true}
            voteCounts={voteCounts}
            voteDetails={voteDetails}
            // Inline confirm for vote selection (same pattern as night phase)
            nightActionMode={!hasVoted && !!pendingActionRequest}
            nightSelectedIds={selectedTarget ? [selectedTarget] : []}
            nightInlineConfirm={!hasVoted && !!pendingActionRequest}
            nightSelectionComplete={!!selectedTarget}
            onNightConfirm={handleVote}
            onNightCancel={handleCancel}
            // Speech bubbles
            statements={gameView.statements}
            visibleBubblePlayerIds={visibleBubblePlayerIds}
            exitingBubblePlayerIds={exitingBubblePlayerIds}
          />
        }
        footerContent={null}
      >
        {/* Debug Info Panel (admin only) */}
        {gameView.debugInfo && (
          <div className="flex flex-col items-center">
            <DebugInfoPanel debugInfo={gameView.debugInfo} />
          </div>
        )}
      </GamePhaseLayout>

      {/* Floating chat toggle button */}
      <FloatingChatButton
        isOpen={chatPanelOpen}
        onClick={() => setChatPanelOpen(!chatPanelOpen)}
        statementCount={gameView.statements.length}
      />

      {/* Slide-out chat panel */}
      <ChatPanel
        isOpen={chatPanelOpen}
        onClose={() => setChatPanelOpen(false)}
        statements={gameView.statements}
        getPlayerName={getPlayerName}
        myPlayerId={gameView.myPlayerId}
        onSubmitStatement={submitStatement}
      />
    </>
  );
}
