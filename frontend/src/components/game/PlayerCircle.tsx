'use client';

/**
 * @fileoverview Circular player layout component.
 * @module components/game/PlayerCircle
 *
 * @description
 * Displays players in a circular arrangement around a center point.
 * Supports selection, highlighting, center cards, vote badges, and various status indicators.
 *
 * @pattern Composite Pattern - Renders collection of player items
 * @pattern Observer Pattern - Subscribes to game store for player mapping
 */

import { useState, useRef } from 'react';
import { PublicPlayerInfo, RoleName, ROLE_METADATA, PlayerStatement, Team, TEAM_BG_COLORS } from '@/types/game';
import { useGameStore } from '@/stores/gameStore';
import { cn } from '@/lib/utils';
import { createPlayerNameResolver } from '@/lib/playerUtils';
import { CenterCardsDisplay } from './CenterCardsDisplay';
import { VoteBadge } from './VoteBadge';
import { ROLE_ICONS } from './RoleCard';
import { SpeechBubble } from './SpeechBubble';

/**
 * Circular layout configuration.
 * @internal
 */
const CIRCLE_LAYOUT = {
  /** Degrees in a full circle */
  FULL_CIRCLE_DEGREES: 360,
  /** Starting angle offset (top of circle, -90 degrees from right) */
  START_ANGLE_DEGREES: -90,
  /** Conversion factor from degrees to radians */
  DEG_TO_RAD: Math.PI / 180,
  /** Radius as percentage of container width for player avatars */
  RADIUS_PERCENT: 38,
  /** Radius for outer circle where speech bubbles/popups are centered */
  OUTER_RADIUS_PERCENT: 58,
  /** Center position as percentage */
  CENTER_PERCENT: 50,
} as const;

interface CenterCard {
  role?: RoleName;
  revealed: boolean;
}

interface PlayerCircleProps {
  players: readonly PublicPlayerInfo[];
  selectedId?: string | null;
  onPlayerClick: (playerId: string, position?: { x: number; y: number }, screenPosition?: { x: number; y: number }) => void;
  interactive?: boolean;
  showVoteStatus?: boolean;
  highlightedIds?: string[];
  /** Show the 3 center cards in the middle */
  showCenterCards?: boolean;
  /** Center card data */
  centerCards?: CenterCard[];
  /** Handler for center card clicks */
  onCenterCardClick?: (index: number) => void;
  /** Selected center card indices */
  selectedCenterIndices?: number[];
  /** Whether center cards are interactive */
  centerCardsInteractive?: boolean;
  /** Vote counts per player (playerId -> count) */
  voteCounts?: Record<string, number>;
  /** Voter names per player (playerId -> voter names) */
  voteDetails?: Record<string, string[]>;
  /** Show vote badges on players */
  showVoteBadges?: boolean;
  /** Show revealed roles on players (for results) */
  revealedRoles?: Record<string, RoleName>;
  /** Players who were eliminated */
  eliminatedIds?: readonly string[];

  // Night action selection mode
  /** Night action mode - enables purple selection styling */
  nightActionMode?: boolean;
  /** Selected player IDs for night action (supports multi-select) */
  nightSelectedIds?: string[];
  /** Eligible player IDs that can be selected (if not provided, all non-self are eligible) */
  nightEligibleIds?: string[];

  // Night action inline confirm - unified selection with inline confirm buttons
  /** Enable inline ✓/✕ confirm buttons on selection (for all night actions) */
  nightInlineConfirm?: boolean;
  /** Whether night selection is complete (all required targets selected) */
  nightSelectionComplete?: boolean;
  /** Callback when player confirms night selection */
  onNightConfirm?: () => void;
  /** Callback when player cancels night selection */
  onNightCancel?: () => void;
  /** Expected center card count for selection UI (e.g., 2 for Seer, 1 for Drunk) */
  centerCardExpectedCount?: number;

  // Day phase speech bubbles
  /** All statements for speech bubble display */
  statements?: readonly PlayerStatement[];
  /** Player IDs that should show speech bubbles */
  visibleBubblePlayerIds?: string[];
  /** IDs of bubbles currently in exit animation */
  exitingBubblePlayerIds?: string[];
  /** Allow clicking on self (for Day phase statement viewing) */
  allowSelfClick?: boolean;

  // Player statement popup (rendered at outer circle position)
  /** Player ID for popup display (null = no popup) */
  popupPlayerId?: string | null;
  /** Popup content render function */
  popupContent?: (position: { x: number; y: number }) => React.ReactNode;

  // Header content (rendered at top of outer circle, centered)
  /** Content to render at the top center of the outer circle */
  headerContent?: React.ReactNode;

  // Center header/footer content (rendered above/below center cards)
  /** Content to render above the center cards */
  centerHeaderContent?: React.ReactNode;
  /** Content to render below the center cards */
  centerFooterContent?: React.ReactNode;

  // Results view - winner indication
  /** Player IDs who won the game (shows green ring, others show red) */
  winnerIds?: readonly string[];
}

export function PlayerCircle({
  players,
  selectedId,
  onPlayerClick,
  interactive = true,
  showVoteStatus = false,
  highlightedIds = [],
  showCenterCards = false,
  centerCards,
  onCenterCardClick,
  selectedCenterIndices = [],
  centerCardsInteractive = false,
  voteCounts = {},
  voteDetails = {},
  showVoteBadges = false,
  revealedRoles,
  eliminatedIds = [],
  nightActionMode = false,
  nightSelectedIds = [],
  nightEligibleIds,
  nightInlineConfirm = false,
  nightSelectionComplete = false,
  onNightConfirm,
  onNightCancel,
  centerCardExpectedCount = 2,
  statements = [],
  visibleBubblePlayerIds = [],
  exitingBubblePlayerIds = [],
  allowSelfClick = false,
  popupPlayerId = null,
  popupContent,
  headerContent,
  centerHeaderContent,
  centerFooterContent,
  winnerIds
}: PlayerCircleProps) {
  const { gameView, roomState, playerIdMapping } = useGameStore();
  const getPlayerName = createPlayerNameResolver(playerIdMapping, roomState);
  const myPlayerId = gameView?.myPlayerId;
  const [expandedVoteBadge, setExpandedVoteBadge] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Center cards vertical offset for visual balance
  // Player names below avatars shift visual center upward, requiring compensation
  // Using percentage-based offsets so they scale with container size on different screens
  const centerCardsOffsetPercent = -8;
  const centerHeaderOffsetPercent = -9;  // Distance from center to header content (was 42px on 448px = ~9%)
  const centerFooterOffsetPercent = 11;  // Distance from center to footer content (was 50px on 448px = ~11%)

  // Calculate positions for circular layout
  const getPosition = (index: number, total: number) => {
    // Start from top and go clockwise
    const angleDegrees = (index / total) * CIRCLE_LAYOUT.FULL_CIRCLE_DEGREES + CIRCLE_LAYOUT.START_ANGLE_DEGREES;
    const angleRadians = angleDegrees * CIRCLE_LAYOUT.DEG_TO_RAD;
    const x = CIRCLE_LAYOUT.CENTER_PERCENT + CIRCLE_LAYOUT.RADIUS_PERCENT * Math.cos(angleRadians);
    const y = CIRCLE_LAYOUT.CENTER_PERCENT + CIRCLE_LAYOUT.RADIUS_PERCENT * Math.sin(angleRadians);
    return { x, y };
  };

  // Calculate position on the outer circle (for speech bubbles/popups)
  const getOuterPosition = (index: number, total: number) => {
    const angleDegrees = (index / total) * CIRCLE_LAYOUT.FULL_CIRCLE_DEGREES + CIRCLE_LAYOUT.START_ANGLE_DEGREES;
    const angleRadians = angleDegrees * CIRCLE_LAYOUT.DEG_TO_RAD;
    const x = CIRCLE_LAYOUT.CENTER_PERCENT + CIRCLE_LAYOUT.OUTER_RADIUS_PERCENT * Math.cos(angleRadians);
    const y = CIRCLE_LAYOUT.CENTER_PERCENT + CIRCLE_LAYOUT.OUTER_RADIUS_PERCENT * Math.sin(angleRadians);
    return { x, y };
  };

  return (
    <div ref={containerRef} className="relative w-full aspect-square max-w-md mx-auto overflow-visible">
      {/* Outer circle guide (dashed) */}
      <div
        className="absolute border border-dashed border-gray-700/50 rounded-full pointer-events-none"
        style={{
          left: '50%',
          top: '50%',
          width: `${CIRCLE_LAYOUT.OUTER_RADIUS_PERCENT * 2}%`,
          height: `${CIRCLE_LAYOUT.OUTER_RADIUS_PERCENT * 2}%`,
          transform: 'translate(-50%, -50%)'
        }}
      />

      {/* Header content at top of outer circle */}
      {headerContent && (
        <div
          className="absolute transform -translate-x-1/2 -translate-y-1/2 z-40"
          style={{
            left: '50%',
            top: `${CIRCLE_LAYOUT.CENTER_PERCENT - CIRCLE_LAYOUT.OUTER_RADIUS_PERCENT}%`
          }}
        >
          {headerContent}
        </div>
      )}

      {/* Dots on outer circle for each player position */}
      {players.map((player, index) => {
        const outerPos = getOuterPosition(index, players.length);
        return (
          <div
            key={`outer-dot-${player.id}`}
            className="absolute w-2 h-2 bg-gray-600 rounded-full pointer-events-none transform -translate-x-1/2 -translate-y-1/2"
            style={{
              left: `${outerPos.x}%`,
              top: `${outerPos.y}%`
            }}
          />
        );
      })}

      {/* Center area - cards or placeholder (shifted up slightly for visual balance) */}
      <div className="absolute inset-0 flex items-center justify-center" style={{ marginTop: `${centerCardsOffsetPercent}%` }}>
        {showCenterCards ? (
          <CenterCardsDisplay
            cards={centerCards}
            selectedIndices={selectedCenterIndices}
            onCardClick={onCenterCardClick}
            interactive={centerCardsInteractive}
            size="md"
            inlineConfirmMode={nightInlineConfirm}
            expectedCount={centerCardExpectedCount}
            onConfirm={onNightConfirm}
            onCancel={onNightCancel}
          />
        ) : (
          <div className="w-20 h-20 rounded-full bg-gray-800 border-2 border-gray-600 flex items-center justify-center">
            <span className="text-gray-400 text-sm">Center</span>
          </div>
        )}
      </div>

      {/* Content above center cards (positioned absolutely so it doesn't shift cards) */}
      {centerHeaderContent && (
        <div
          className="absolute left-1/2 transform -translate-x-1/2 -translate-y-full z-30"
          style={{ top: `calc(50% + ${centerCardsOffsetPercent}% + ${centerHeaderOffsetPercent}%)` }}
        >
          {centerHeaderContent}
        </div>
      )}

      {/* Content below center cards (positioned absolutely so it doesn't shift cards) */}
      {centerFooterContent && (
        <div
          className="absolute left-1/2 transform -translate-x-1/2 z-30"
          style={{ top: `calc(50% + ${centerCardsOffsetPercent}% + ${centerFooterOffsetPercent}%)` }}
        >
          {centerFooterContent}
        </div>
      )}

      {/* Players */}
      {players.map((player, index) => {
        const pos = getPosition(index, players.length);
        const isSelected = selectedId === player.id;
        const isMe = player.id === myPlayerId;
        const isHighlighted = highlightedIds.includes(player.id);
        const isEliminated = eliminatedIds.includes(player.id);
        const revealedRole = revealedRoles?.[player.id];
        const voteCount = voteCounts[player.id] || 0;
        const voters = voteDetails[player.id] || [];

        // Night action mode checks
        const isNightSelected = nightActionMode && nightSelectedIds.includes(player.id);
        const nightSelectionIndex = isNightSelected ? nightSelectedIds.indexOf(player.id) + 1 : 0;
        const isNightEligible = nightActionMode && !isMe && (
          !nightEligibleIds || nightEligibleIds.includes(player.id)
        );
        const isClickable = interactive && (allowSelfClick || !isMe) && (
          !nightActionMode || isNightEligible || isNightSelected
        );

        // Results mode - winner indication with team colors
        const showWinnerRing = winnerIds !== undefined;
        const isWinner = winnerIds?.includes(player.id) ?? false;
        const playerTeam = revealedRole ? ROLE_METADATA[revealedRole].team : null;

        return (
          <div
            key={player.id}
            className="absolute transform -translate-x-1/2 -translate-y-1/2"
            style={{
              left: `${pos.x}%`,
              top: `${pos.y}%`
            }}
          >
            {/* Player circle - clickable area */}
            <div className="relative">
              {/* Winner ring indicator (results view) - matches card colors */}
              {showWinnerRing && isWinner && (
                <div
                  className={cn(
                    'absolute rounded-full pointer-events-none',
                    playerTeam === Team.VILLAGE && 'border-blue-700',
                    playerTeam === Team.WEREWOLF && 'border-red-700',
                    playerTeam === Team.TANNER && 'border-amber-700'
                  )}
                  style={{
                    borderWidth: '4px',
                    inset: '-7px'
                  }}
                />
              )}
              <button
                onClick={() => {
                  if (!isClickable) return;
                  const outerPos = getOuterPosition(index, players.length);
                  let screenPos: { x: number; y: number } | undefined;
                  if (containerRef.current) {
                    const containerRect = containerRef.current.getBoundingClientRect();
                    screenPos = {
                      x: containerRect.left + (outerPos.x / 100) * containerRect.width,
                      y: containerRect.top + (outerPos.y / 100) * containerRect.height
                    };
                  }
                  onPlayerClick(player.id, outerPos, screenPos);
                }}
                disabled={!isClickable}
                className={cn(
                  'w-16 h-16 rounded-full flex flex-col items-center justify-center border-2 transition-all',
                  // Night action mode - purple styling takes priority
                  isNightSelected && 'border-purple-500 bg-purple-900/50 ring-2 ring-purple-500/50 shadow-lg shadow-purple-500/30',
                  // Voting mode - red styling
                  !nightActionMode && isSelected && 'border-red-500 bg-red-900/50 selection-pulse',
                  // Self - blue styling (unless selected)
                  isMe && !isSelected && !isNightSelected && 'border-blue-500 bg-blue-900/30',
                  // Highlighted
                  isHighlighted && !isSelected && !isNightSelected && 'border-yellow-500 bg-yellow-900/30',
                  // Default state
                  !isSelected && !isMe && !isHighlighted && !isNightSelected && 'border-gray-600 bg-gray-800',
                  // Disconnected
                  !player.isConnected && 'opacity-50',
                  // Eliminated
                  isEliminated && 'eliminated-overlay',
                  // Clickable hover states
                  isClickable && !nightActionMode && 'hover:scale-110 cursor-pointer',
                  isClickable && nightActionMode && !isNightSelected && 'hover:scale-110 hover:border-purple-400 cursor-pointer',
                  // Non-clickable styling (but don't dim in results view)
                  !isClickable && !showWinnerRing && 'cursor-default opacity-50',
                  !isClickable && showWinnerRing && 'cursor-default'
                )}
              >
                {/* Winner trophy badge in upper left - same size as vote badge */}
                {showWinnerRing && isWinner && (
                  <div className="absolute -top-1 -left-1 z-10 w-6 h-6 rounded-full bg-amber-500 border-2 border-amber-300 shadow-lg flex items-center justify-center">
                    <span className="text-xs">🏆</span>
                  </div>
                )}
                {/* Show role icon if revealed, otherwise initials */}
                {revealedRole ? (
                  <>
                    <span className="text-xl">{ROLE_ICONS[revealedRole]}</span>
                    <span className="text-[8px] text-white/80 font-medium leading-tight">
                      {ROLE_METADATA[revealedRole].displayName.split(' ')[0]}
                    </span>
                  </>
                ) : (
                  <span className={cn(
                    'text-lg font-bold',
                    isSelected ? 'text-red-300' :
                    isMe ? 'text-blue-300' :
                    isHighlighted ? 'text-yellow-300' :
                    'text-gray-300'
                  )}>
                    {getPlayerName(player.id).charAt(0).toUpperCase()}
                  </span>
                )}
              </button>

              {/* Night action selection number badge (for multi-select like Troublemaker) */}
              {/* Show badge when multiple selections, but hide on last player when showing confirm buttons */}
              {isNightSelected && nightSelectedIds.length > 1 && !(nightInlineConfirm && nightSelectionComplete && nightSelectionIndex === nightSelectedIds.length) && (
                <div className="absolute -top-1 -left-1 z-10">
                  <div className="w-5 h-5 rounded-full bg-purple-600 text-white text-xs font-bold flex items-center justify-center shadow-md">
                    {nightSelectionIndex}
                  </div>
                </div>
              )}

              {/* Inline confirm/cancel buttons on selected player */}
              {/* For single select: show on the selected player */}
              {/* For multi-select: show on the LAST selected player when selection complete */}
              {nightInlineConfirm && nightSelectionComplete && isNightSelected &&
               (nightSelectedIds.length === 1 || nightSelectionIndex === nightSelectedIds.length) && (
                <>
                  {/* Cancel button - top left */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onNightCancel?.();
                    }}
                    className="absolute -top-2 -left-2 z-20 w-7 h-7 rounded-full bg-red-600 hover:bg-red-500 text-white flex items-center justify-center shadow-lg transition-colors"
                  >
                    <span className="text-sm font-bold">✕</span>
                  </button>
                  {/* Confirm button - top right */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onNightConfirm?.();
                    }}
                    className="absolute -top-2 -right-2 z-20 w-7 h-7 rounded-full bg-green-600 hover:bg-green-500 text-white flex items-center justify-center shadow-lg transition-colors"
                  >
                    <span className="text-sm font-bold">✓</span>
                  </button>
                </>
              )}

              {/* Eliminated X overlay */}
              {isEliminated && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <span className="text-4xl text-red-500 font-bold opacity-80">✗</span>
                </div>
              )}

              {/* Vote badge - positioned at top-right, OUTSIDE the button */}
              {showVoteBadges && voteCount > 0 && (
                <div className="absolute -top-1 -right-1 z-10">
                  <VoteBadge
                    count={voteCount}
                    voters={voters}
                    isExpanded={expandedVoteBadge === player.id}
                    onToggle={() => setExpandedVoteBadge(
                      expandedVoteBadge === player.id ? null : player.id
                    )}
                  />
                </div>
              )}

            </div>

            {/* Player name */}
            <div className="mt-1 text-center">
              <p className={cn(
                'text-xs font-medium truncate max-w-16',
                isMe ? 'text-blue-400' : 'text-gray-300',
                isEliminated && 'line-through opacity-60'
              )}>
                {getPlayerName(player.id)}
                {isMe && ' (You)'}
              </p>

              {/* Status indicators */}
              <div className="flex justify-center gap-1 mt-0.5">
                {showVoteStatus && player.hasVoted && (
                  <span className="text-green-400 text-xs">✓</span>
                )}
                {player.isAI && (
                  <span className="text-purple-400 text-xs">AI</span>
                )}
              </div>
            </div>

          </div>
        );
      })}

      {/* Speech bubbles - rendered AFTER players for proper z-index stacking */}
      {players.map((player, index) => {
        if (!visibleBubblePlayerIds.includes(player.id)) return null;

        const playerStatements = statements.filter(s => s.playerId === player.id);
        const latestStatement = playerStatements[playerStatements.length - 1];
        if (!latestStatement) return null;

        const outerPos = getOuterPosition(index, players.length);
        const isMe = player.id === myPlayerId;
        const isExiting = exitingBubblePlayerIds.includes(player.id);

        return (
          <div
            key={`bubble-${player.id}`}
            className="absolute transform -translate-x-1/2 -translate-y-1/2 z-50 pointer-events-none"
            style={{
              left: `${outerPos.x}%`,
              top: `${outerPos.y}%`
            }}
          >
            <SpeechBubble
              statement={latestStatement.statement}
              direction="center"
              isOwn={isMe}
              isExiting={isExiting}
            />
          </div>
        );
      })}

      {/* Player statement popup - positioned at outer circle like speech bubbles */}
      {popupPlayerId && popupContent && (() => {
        const playerIndex = players.findIndex(p => p.id === popupPlayerId);
        if (playerIndex === -1) return null;
        const outerPos = getOuterPosition(playerIndex, players.length);
        return (
          <div
            className="absolute transform -translate-x-1/2 -translate-y-1/2 z-50"
            style={{
              left: `${outerPos.x}%`,
              top: `${outerPos.y}%`
            }}
          >
            {popupContent(outerPos)}
          </div>
        );
      })()}
    </div>
  );
}
