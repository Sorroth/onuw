'use client';

/**
 * @fileoverview Night phase game view component.
 * @module components/game/NightPhaseView
 *
 * @description
 * Displays the night phase UI with unified layout.
 * Players click on PlayerCircle to select targets for night actions.
 * Seer can click either players OR center cards (mutually exclusive).
 *
 * @pattern Observer Pattern - Subscribes to game store state changes
 * @pattern Composite Pattern - Composes layout, sidebar, and action components
 */

import { useState, useEffect, useMemo, useRef } from 'react';
import { useGameStore } from '@/stores/gameStore';
import { GamePhase } from '@/types/game';
import { GamePhaseLayout } from './GamePhaseLayout';
import { GameSidebar } from './GameSidebar';
import { PlayerCircle } from './PlayerCircle';
import { ChatPanel } from './ChatPanel';
import { FloatingChatButton } from './FloatingChatButton';
import { DebugInfoPanel } from './DebugInfoPanel';
import { toServerPlayerId, createPlayerNameResolver } from '@/lib/playerUtils';
import { useSpeechBubbles } from '@/hooks/useSpeechBubbles';

export function NightPhaseView() {
  const {
    gameView,
    roomState,
    pendingActionRequest,
    sendActionResponse,
    playerIdMapping
  } = useGameStore();

  // Selection state
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>([]);
  const [selectedCenterCards, setSelectedCenterCards] = useState<number[]>([]);

  // Chat panel state
  const [chatPanelOpen, setChatPanelOpen] = useState(false);

  const getPlayerName = createPlayerNameResolver(playerIdMapping, roomState);

  // Speech bubbles for chat messages
  const { visibleBubblePlayerIds, exitingBubblePlayerIds } = useSpeechBubbles({
    statements: gameView?.statements || [],
    enabled: true
  });

  // Track pending seer selection to auto-send when follow-up arrives
  const pendingSeerTarget = useRef<{ type: 'player' | 'center'; player?: string; centerCards?: number[] } | null>(null);

  // Reset selections when action request changes
  useEffect(() => {
    // Check if this is a follow-up action from seerChoice
    const actionType = pendingActionRequest?.actionType;
    if (pendingSeerTarget.current) {
      if (actionType === 'selectPlayer' && pendingSeerTarget.current.type === 'player' && pendingSeerTarget.current.player) {
        // Auto-send the pre-selected player
        const serverId = toServerPlayerId(pendingSeerTarget.current.player, playerIdMapping);
        sendActionResponse(pendingActionRequest!.requestId, serverId);
        pendingSeerTarget.current = null;
        return;
      }
      if (actionType === 'selectCenter' && pendingSeerTarget.current.type === 'center' && pendingSeerTarget.current.centerCards) {
        // Auto-send the pre-selected center cards
        sendActionResponse(pendingActionRequest!.requestId, pendingSeerTarget.current.centerCards);
        pendingSeerTarget.current = null;
        return;
      }
    }

    // Normal reset for new actions
    setSelectedPlayers([]);
    setSelectedCenterCards([]);
  }, [pendingActionRequest?.requestId, playerIdMapping, sendActionResponse]);

  if (!gameView) return null;

  // Determine action type and eligibility
  const actionType = pendingActionRequest?.actionType;
  const isPlayerAction = actionType === 'selectPlayer' || actionType === 'selectTwoPlayers';
  const isCenterAction = actionType === 'selectCenter';
  const isSeerChoice = actionType === 'seerChoice';

  // Max selections based on action type
  const maxPlayerSelections = actionType === 'selectTwoPlayers' ? 2 : 1;
  const maxCenterSelections = isCenterAction && pendingActionRequest && 'count' in pendingActionRequest
    ? pendingActionRequest.count
    : 1;

  // Check if selection is complete
  const canConfirm = useMemo(() => {
    if (!pendingActionRequest) return false;

    switch (actionType) {
      case 'selectPlayer':
        return selectedPlayers.length === 1;
      case 'selectTwoPlayers':
        return selectedPlayers.length === 2;
      case 'selectCenter':
        return selectedCenterCards.length === maxCenterSelections;
      case 'seerChoice':
        // For seer: 1 player OR 2 center cards
        return selectedPlayers.length === 1 || selectedCenterCards.length === 2;
      default:
        return false;
    }
  }, [actionType, selectedPlayers, selectedCenterCards, maxCenterSelections, pendingActionRequest]);

  // Handle player click - for seerChoice, clears center cards (mutually exclusive)
  const handlePlayerClick = (playerId: string) => {
    if (isSeerChoice) {
      // Seer: clicking player clears center selection
      setSelectedCenterCards([]);
      if (selectedPlayers.includes(playerId)) {
        setSelectedPlayers([]);
      } else {
        setSelectedPlayers([playerId]);
      }
      return;
    }

    if (!isPlayerAction) return;

    if (selectedPlayers.includes(playerId)) {
      // Clicking already-selected player deselects them
      setSelectedPlayers(selectedPlayers.filter(id => id !== playerId));
    } else if (selectedPlayers.length < maxPlayerSelections) {
      // Room for more selections - add to list
      setSelectedPlayers([...selectedPlayers, playerId]);
    } else {
      // At max selections - replace appropriately
      if (maxPlayerSelections === 1) {
        // Single-select: replace current selection
        setSelectedPlayers([playerId]);
      } else {
        // Multi-select (e.g., Troublemaker): replace last selected
        setSelectedPlayers([...selectedPlayers.slice(0, -1), playerId]);
      }
    }
  };

  // Handle center card click - for seerChoice, clears player selection (mutually exclusive)
  const handleCenterCardClick = (index: number) => {
    if (isSeerChoice) {
      // Seer: clicking center clears player selection
      setSelectedPlayers([]);
      if (selectedCenterCards.includes(index)) {
        // Clicking already-selected card deselects it
        setSelectedCenterCards(selectedCenterCards.filter(i => i !== index));
      } else if (selectedCenterCards.length < 2) {
        // Room for more - add to selection
        setSelectedCenterCards([...selectedCenterCards, index]);
      } else {
        // At max (2) - replace last selected
        setSelectedCenterCards([...selectedCenterCards.slice(0, -1), index]);
      }
      return;
    }

    if (!isCenterAction) return;

    if (selectedCenterCards.includes(index)) {
      // Clicking already-selected card deselects it
      setSelectedCenterCards(selectedCenterCards.filter(i => i !== index));
    } else if (selectedCenterCards.length < maxCenterSelections) {
      // Room for more - add to selection
      setSelectedCenterCards([...selectedCenterCards, index]);
    } else {
      // At max - replace appropriately
      if (maxCenterSelections === 1) {
        // Single-select: replace current
        setSelectedCenterCards([index]);
      } else {
        // Multi-select: replace last selected
        setSelectedCenterCards([...selectedCenterCards.slice(0, -1), index]);
      }
    }
  };

  // Handle confirm for all night actions (called from inline buttons)
  const handleNightConfirm = () => {
    if (!pendingActionRequest || !canConfirm) return;

    switch (actionType) {
      case 'seerChoice':
        // Seer: send choice type, then auto-send target on follow-up
        if (selectedPlayers.length === 1) {
          pendingSeerTarget.current = { type: 'player', player: selectedPlayers[0] };
          sendActionResponse(pendingActionRequest.requestId, 'player');
        } else if (selectedCenterCards.length === 2) {
          pendingSeerTarget.current = { type: 'center', centerCards: selectedCenterCards };
          sendActionResponse(pendingActionRequest.requestId, 'center');
        }
        break;
      case 'selectPlayer':
        sendActionResponse(pendingActionRequest.requestId,
          toServerPlayerId(selectedPlayers[0], playerIdMapping));
        break;
      case 'selectTwoPlayers':
        sendActionResponse(pendingActionRequest.requestId,
          selectedPlayers.map(id => toServerPlayerId(id, playerIdMapping)));
        break;
      case 'selectCenter':
        sendActionResponse(pendingActionRequest.requestId,
          maxCenterSelections === 1 ? selectedCenterCards[0] : selectedCenterCards
        );
        break;
    }
  };

  // Handle cancel for all night actions
  const handleNightCancel = () => {
    setSelectedPlayers([]);
    setSelectedCenterCards([]);
  };

  // Determine if we should use inline confirm (all night actions now use inline)
  const useInlineConfirm = isPlayerAction || isCenterAction || isSeerChoice;

  // Expected center card count for inline UI
  const expectedCenterCount = isSeerChoice ? 2 : maxCenterSelections;

  return (
    <>
      <GamePhaseLayout
        phase={GamePhase.NIGHT}
        showTimer={true}
        showSidebar={true}
        sidebarContent={
          <GameSidebar
            selectedPlayers={selectedPlayers}
            selectedCenterCards={selectedCenterCards}
          />
        }
        showPlayerCircle={true}
        playerCircleContent={
          <PlayerCircle
            players={gameView.players}
            selectedId={null}
            onPlayerClick={handlePlayerClick}
            interactive={isPlayerAction || isSeerChoice}
            showCenterCards={true}
            centerCardsInteractive={isCenterAction || isSeerChoice}
            onCenterCardClick={handleCenterCardClick}
            selectedCenterIndices={selectedCenterCards}
            nightActionMode={isPlayerAction || isCenterAction || isSeerChoice}
            nightSelectedIds={selectedPlayers}
            nightEligibleIds={undefined}
            // Inline confirm props (for all night actions)
            nightInlineConfirm={useInlineConfirm}
            nightSelectionComplete={canConfirm}
            onNightConfirm={handleNightConfirm}
            onNightCancel={handleNightCancel}
            // Center card expected count for selection UI
            centerCardExpectedCount={expectedCenterCount}
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

      {/* Slide-out chat panel (read-only during night - no talking!) */}
      <ChatPanel
        isOpen={chatPanelOpen}
        onClose={() => setChatPanelOpen(false)}
        statements={gameView.statements}
        getPlayerName={getPlayerName}
        myPlayerId={gameView.myPlayerId}
        emptyMessage="Night phase in progress. Discussion begins during the day phase."
      />
    </>
  );
}
