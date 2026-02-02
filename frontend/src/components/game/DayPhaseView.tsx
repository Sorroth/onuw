'use client';

/**
 * @fileoverview Day phase game view component.
 * @module components/game/DayPhaseView
 *
 * @description
 * Displays the day phase UI with speech bubbles on players,
 * a slide-out chat panel, and a compact bottom bar.
 *
 * @pattern Observer Pattern - Subscribes to game store state changes
 * @pattern Composite Pattern - Composes layout, sidebar, speech bubbles, and chat
 */

import { useState } from 'react';
import { useGameStore } from '@/stores/gameStore';
import { GamePhase } from '@/types/game';
import { GamePhaseLayout } from './GamePhaseLayout';
import { GameSidebar } from './GameSidebar';
import { PlayerCircle } from './PlayerCircle';
import { ChatPanel } from './ChatPanel';
import { FloatingChatButton } from './FloatingChatButton';
import { PlayerStatementPopup } from './PlayerStatementPopup';
import { DebugInfoPanel } from './DebugInfoPanel';
import { Button } from '@/components/ui';
import { createPlayerNameResolver } from '@/lib/playerUtils';
import { useSpeechBubbles } from '@/hooks/useSpeechBubbles';
import { usePlayerPopup } from '@/hooks/usePlayerPopup';

export function DayPhaseView() {
  const {
    gameView,
    roomState,
    playerIdMapping,
    submitStatement,
    readyToVote
  } = useGameStore();

  // Chat panel state
  const [chatPanelOpen, setChatPanelOpen] = useState(false);

  const getPlayerName = createPlayerNameResolver(playerIdMapping, roomState);

  // Speech bubbles (using custom hook)
  const { visibleBubblePlayerIds, exitingBubblePlayerIds } = useSpeechBubbles({
    statements: gameView?.statements || [],
    enabled: true
  });

  // Player popup (using custom hook)
  const {
    selectedPlayerId,
    popupPosition,
    handlePlayerClick,
    handleClosePopup
  } = usePlayerPopup();

  if (!gameView) return null;

  return (
    <>
      <GamePhaseLayout
        phase={GamePhase.DAY}
        showTimer={true}
        showSidebar={true}
        sidebarContent={<GameSidebar />}
        showPlayerCircle={true}
        playerCircleContent={
          <PlayerCircle
            players={gameView.players}
            selectedId={null}
            onPlayerClick={handlePlayerClick}
            interactive={true}
            allowSelfClick={true}
            showCenterCards={true}
            statements={gameView.statements}
            visibleBubblePlayerIds={visibleBubblePlayerIds}
            exitingBubblePlayerIds={exitingBubblePlayerIds}
            centerHeaderContent={
              <Button
                onClick={readyToVote}
                variant="primary"
                size="sm"
              >
                Ready to Vote
              </Button>
            }
          />
        }
        footerContent={null}
      >
        {/* Debug Info Panel (admin only) */}
        {gameView.debugInfo && (
          <div className="max-w-2xl mx-auto">
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

      {/* Backdrop for popup */}
      {selectedPlayerId && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/40"
            onClick={handleClosePopup}
            aria-hidden="true"
          />
          {/* Popup rendered at root level for proper stacking */}
          <div
            className="fixed z-50 pointer-events-auto"
            style={popupPosition ? {
              left: `${popupPosition.x}px`,
              top: `${popupPosition.y}px`,
              transform: 'translate(-50%, -50%)'
            } : {
              left: '50%',
              top: '50%',
              transform: 'translate(-50%, -50%)'
            }}
          >
            <PlayerStatementPopup
              playerId={selectedPlayerId}
              playerName={getPlayerName(selectedPlayerId)}
              statements={gameView.statements}
              onClose={handleClosePopup}
            />
          </div>
        </>
      )}
    </>
  );
}
