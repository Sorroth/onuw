'use client';

/**
 * @fileoverview Game results view component.
 * @module components/game/ResultsView
 *
 * @description
 * Displays the end-of-game results with unified layout.
 * Shows PlayerCircle with revealed roles and winner announcement.
 * Night actions are accessible via sidebar toggle, discussion via chat panel.
 *
 * @pattern Observer Pattern - Subscribes to game store for results
 * @pattern Composite Pattern - Composes layout and result sections
 */

import { useState, useMemo } from 'react';
import { useGameStore } from '@/stores/gameStore';
import { GamePhase, RoleName, TEAM_BG_COLORS } from '@/types/game';
import { cn } from '@/lib/utils';
import { GamePhaseLayout } from './GamePhaseLayout';
import { GameSidebar } from './GameSidebar';
import { PlayerCircle } from './PlayerCircle';
import { ChatPanel } from './ChatPanel';
import { FloatingChatButton } from './FloatingChatButton';
import { Button } from '@/components/ui';
import { createPlayerNameResolver } from '@/lib/playerUtils';

interface ResultsViewProps {
  onLeave: () => void;
}

export function ResultsView({ onLeave }: ResultsViewProps) {
  const {
    gameView,
    gameResult,
    gameSummary,
    roomState,
    playerIdMapping
  } = useGameStore();

  // Chat panel state (read-only for results)
  const [chatPanelOpen, setChatPanelOpen] = useState(false);

  if (!gameResult || !gameSummary || !gameView) return null;

  const getPlayerName = createPlayerNameResolver(playerIdMapping, roomState);
  const myPlayerId = gameView?.myPlayerId;
  const isWinner = myPlayerId ? gameResult.winningPlayers.includes(myPlayerId) : false;

  // Build revealed roles map for PlayerCircle
  const revealedRoles: Record<string, RoleName> = gameResult.finalRoles;

  // Build center cards - use debug info if available, otherwise show face-down
  const debugCenterCards = gameView.debugInfo?.centerCards;
  const centerCards = debugCenterCards?.map(role => ({
    role: role as RoleName,
    revealed: true
  })) || [
    { revealed: false },
    { revealed: false },
    { revealed: false }
  ];

  // Calculate vote counts for display on player circle
  const voteCounts = useMemo(() => {
    if (!gameSummary.votes) return {};
    // gameSummary.votes uses player names, we need to map back to IDs
    const votesByName = gameSummary.votes;
    const counts: Record<string, number> = {};

    // For each player, count how many times they were targeted
    for (const targetName of Object.values(votesByName)) {
      // Find player ID by name
      for (const player of gameView.players) {
        if (getPlayerName(player.id) === targetName) {
          counts[player.id] = (counts[player.id] || 0) + 1;
          break;
        }
      }
    }
    return counts;
  }, [gameSummary.votes, gameView.players, getPlayerName]);

  const voteDetails = useMemo(() => {
    if (!gameSummary.votes) return {};
    const details: Record<string, string[]> = {};
    const votesByName = gameSummary.votes;

    // For each player, get the names of who voted for them
    for (const player of gameView.players) {
      const playerName = getPlayerName(player.id);
      const voters: string[] = [];
      for (const [voterName, targetName] of Object.entries(votesByName)) {
        if (targetName === playerName) {
          voters.push(voterName);
        }
      }
      if (voters.length > 0) {
        details[player.id] = voters;
      }
    }
    return details;
  }, [gameSummary.votes, gameView.players, getPlayerName]);

  // Get final role for sidebar
  const myFinalRole = myPlayerId ? gameResult.finalRoles[myPlayerId] : undefined;

  return (
    <>
      <GamePhaseLayout
        phase={GamePhase.RESOLUTION}
        showTimer={false}
        showSidebar={true}
        sidebarContent={
          <GameSidebar
            showFinalRole={true}
            finalRole={myFinalRole}
            allNightActions={gameSummary.nightActions}
            isWinner={isWinner}
            winningTeams={gameResult.winningTeams}
          />
        }
        showPlayerCircle={true}
        playerCircleContent={
          <PlayerCircle
            players={gameView.players}
            selectedId={null}
            onPlayerClick={() => {}}
            interactive={false}
            showCenterCards={true}
            centerCards={centerCards}
            revealedRoles={revealedRoles}
            eliminatedIds={gameResult.eliminatedPlayers}
            showVoteBadges={true}
            voteCounts={voteCounts}
            voteDetails={voteDetails}
            winnerIds={gameResult.winningPlayers}
            centerFooterContent={
              <Button onClick={onLeave} variant="secondary" size="sm">
                Leave Room
              </Button>
            }
          />
        }
        footerContent={null}
      />

      {/* Floating chat toggle button */}
      <FloatingChatButton
        isOpen={chatPanelOpen}
        onClick={() => setChatPanelOpen(!chatPanelOpen)}
        statementCount={gameView.statements.length}
      />

      {/* Slide-out chat panel (read-only - no input) */}
      <ChatPanel
        isOpen={chatPanelOpen}
        onClose={() => setChatPanelOpen(false)}
        statements={gameView.statements}
        getPlayerName={getPlayerName}
        myPlayerId={gameView.myPlayerId}
        emptyMessage="Game over. No discussion took place."
      />
    </>
  );
}
