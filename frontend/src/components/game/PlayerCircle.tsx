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

import { useState, useRef, useEffect } from 'react';
import { PublicPlayerInfo, RoleName, ROLE_METADATA, PlayerStatement, Team, TEAM_BG_COLORS } from '@/types/game';
import { useGameStore } from '@/stores/gameStore';
import { useDebugStore } from '@/stores/debugStore';
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
  const { debugShowPositionLines } = useDebugStore();
  const getPlayerName = createPlayerNameResolver(playerIdMapping, roomState);
  const myPlayerId = gameView?.myPlayerId;
  const [expandedVoteBadge, setExpandedVoteBadge] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Vertical offset for visual balance
  // Player names below avatars shift visual center downward, requiring compensation
  // Using percentage-based offsets so they scale with container size on different screens
  const outerRingOffsetPercent = -9;  // Shift outer ring (dots) up
  const playerCircleOffsetPercent = -5.7;  // Shift player circles up (relative to container)
  const centerCardsOffsetPercent = -12.7;
  const centerHeaderOffsetPercent = -6.6;  // Distance from center to header content
  const centerFooterOffsetPercent = 25;  // Distance from center to footer content

  // Debug measurement lines - enabled via debug store toggle
  const DEBUG_SHOW_LINES = debugShowPositionLines;
  const topPlayerRef = useRef<HTMLButtonElement>(null);
  const bottomPlayerRef = useRef<HTMLButtonElement>(null);
  const topDotRef = useRef<HTMLDivElement>(null);
  const bottomDotRef = useRef<HTMLDivElement>(null);
  const centerCardsRef = useRef<HTMLDivElement>(null);
  const centerHeaderRef = useRef<HTMLDivElement>(null);
  const centerFooterRef = useRef<HTMLDivElement>(null);
  const [debugMeasurements, setDebugMeasurements] = useState({ red: 0, blue: 0, green: 0, yellow: 0, orange: 0, cyan: 0, pink: 0, lime: 0 });

  // Calculate actual pixel measurements and line positions
  const [debugLines, setDebugLines] = useState<{
    red: { top: number; height: number };
    blue: { top: number; height: number };
    green: { top: number; height: number };
    yellow: { top: number; height: number };
    orange: { top: number; height: number } | null;
    cyan: { top: number; height: number } | null;
    pink: { top: number; height: number } | null;
    lime: { top: number; height: number } | null;
  } | null>(null);

  useEffect(() => {
    if (!DEBUG_SHOW_LINES) return;
    const measure = () => {
      const container = containerRef.current?.getBoundingClientRect();
      const topPlayer = topPlayerRef.current?.getBoundingClientRect();
      const bottomPlayer = bottomPlayerRef.current?.getBoundingClientRect();
      const topDot = topDotRef.current?.getBoundingClientRect();
      const bottomDot = bottomDotRef.current?.getBoundingClientRect();
      const centerCards = centerCardsRef.current?.getBoundingClientRect();
      const centerHeader = centerHeaderRef.current?.getBoundingClientRect();
      const centerFooter = centerFooterRef.current?.getBoundingClientRect();

      if (container && topPlayer && bottomPlayer && topDot && bottomDot && centerCards) {
        const redHeight = centerCards.top - topPlayer.bottom;
        const blueHeight = bottomPlayer.top - centerCards.bottom;
        const greenHeight = topPlayer.top - topDot.bottom;
        const yellowHeight = bottomDot.top - bottomPlayer.bottom;

        // Header button measurements (if present)
        const orangeHeight = centerHeader ? centerHeader.top - topPlayer.bottom : 0;
        const cyanHeight = centerHeader ? centerCards.top - centerHeader.bottom : 0;

        // Footer button measurements (if present)
        const pinkHeight = centerFooter ? centerFooter.top - centerCards.bottom : 0;
        const limeHeight = centerFooter ? bottomPlayer.top - centerFooter.bottom : 0;

        setDebugMeasurements({
          red: Math.round(redHeight),
          blue: Math.round(blueHeight),
          green: Math.round(greenHeight),
          yellow: Math.round(yellowHeight),
          orange: centerHeader ? Math.round(orangeHeight) : 0,
          cyan: centerHeader ? Math.round(cyanHeight) : 0,
          pink: centerFooter ? Math.round(pinkHeight) : 0,
          lime: centerFooter ? Math.round(limeHeight) : 0,
        });

        setDebugLines({
          red: { top: topPlayer.bottom - container.top, height: redHeight },
          blue: { top: centerCards.bottom - container.top, height: blueHeight },
          green: { top: topDot.bottom - container.top, height: greenHeight },
          yellow: { top: bottomPlayer.bottom - container.top, height: yellowHeight },
          orange: centerHeader ? { top: topPlayer.bottom - container.top, height: orangeHeight } : null,
          cyan: centerHeader ? { top: centerHeader.bottom - container.top, height: cyanHeight } : null,
          pink: centerFooter ? { top: centerCards.bottom - container.top, height: pinkHeight } : null,
          lime: centerFooter ? { top: centerFooter.bottom - container.top, height: limeHeight } : null,
        });
      }
    };
    // Initial measure after a short delay to ensure refs are attached
    const initialTimeout = setTimeout(measure, 100);
    const interval = setInterval(measure, 500); // Update periodically
    window.addEventListener('resize', measure);
    return () => {
      clearTimeout(initialTimeout);
      clearInterval(interval);
      window.removeEventListener('resize', measure);
    };
  }, [players.length, DEBUG_SHOW_LINES, !!centerHeaderContent, !!centerFooterContent]);

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
          top: `calc(50% + ${outerRingOffsetPercent}%)`,
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
            top: `calc(${CIRCLE_LAYOUT.CENTER_PERCENT - CIRCLE_LAYOUT.OUTER_RADIUS_PERCENT}% + ${outerRingOffsetPercent}%)`
          }}
        >
          {headerContent}
        </div>
      )}

      {/* Dots on outer circle for each player position */}
      {players.map((player, index) => {
        const outerPos = getOuterPosition(index, players.length);
        const isTopDot = index === 0;
        const isBottomDot = index === Math.floor(players.length / 2);
        return (
          <div
            key={`outer-dot-${player.id}`}
            ref={isTopDot ? topDotRef : isBottomDot ? bottomDotRef : undefined}
            className="absolute w-2 h-2 bg-gray-600 rounded-full pointer-events-none transform -translate-x-1/2 -translate-y-1/2"
            style={{
              left: `${outerPos.x}%`,
              top: `calc(${outerPos.y}% + ${outerRingOffsetPercent}%)`
            }}
          />
        );
      })}

      {/* Center area - cards or placeholder (shifted up slightly for visual balance) */}
      <div className="absolute inset-0 flex items-center justify-center" style={{ marginTop: `calc(${centerCardsOffsetPercent}% + ${playerCircleOffsetPercent}%)` }}>
        {showCenterCards ? (
          <div ref={centerCardsRef}>
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
          </div>
        ) : (
          <div ref={centerCardsRef} className="w-20 h-20 rounded-full bg-gray-800 border-2 border-gray-600 flex items-center justify-center">
            <span className="text-gray-400 text-sm">Center</span>
          </div>
        )}
      </div>

      {/* Content above center cards (positioned absolutely so it doesn't shift cards) */}
      {centerHeaderContent && (
        <div
          ref={centerHeaderRef}
          className="absolute left-1/2 transform -translate-x-1/2 -translate-y-full z-30"
          style={{ top: `calc(50% + ${playerCircleOffsetPercent}% + ${centerCardsOffsetPercent}% + ${centerHeaderOffsetPercent}%)` }}
        >
          {centerHeaderContent}
        </div>
      )}

      {/* Content below center cards (positioned absolutely so it doesn't shift cards) */}
      {centerFooterContent && (
        <div
          ref={centerFooterRef}
          className="absolute left-1/2 transform -translate-x-1/2 z-30"
          style={{ top: `calc(50% + ${playerCircleOffsetPercent}% + ${centerCardsOffsetPercent}% + ${centerFooterOffsetPercent}%)` }}
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

        // Debug refs for top and bottom players
        const isTopPlayer = index === 0;
        const isBottomPlayer = index === Math.floor(players.length / 2);

        return (
          <div
            key={player.id}
            className="absolute transform -translate-x-1/2 -translate-y-1/2"
            style={{
              left: `${pos.x}%`,
              top: `calc(${pos.y}% + ${playerCircleOffsetPercent}%)`
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
                ref={isTopPlayer ? topPlayerRef : isBottomPlayer ? bottomPlayerRef : undefined}
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
              top: `calc(${outerPos.y}% + ${outerRingOffsetPercent}%)`
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
              top: `calc(${outerPos.y}% + ${outerRingOffsetPercent}%)`
            }}
          >
            {popupContent(outerPos)}
          </div>
        );
      })()}

      {/* DEBUG: Measurement display and lines */}
      {DEBUG_SHOW_LINES && (
        <>
          {/* Info panel - positioned outside the circle area */}
          <div className="absolute -bottom-36 left-0 z-50 bg-black/90 text-white text-xs p-2 rounded space-y-0.5 font-mono">
            <div className="text-red-400">RED (top player→cards): {debugMeasurements.red}px</div>
            <div className="text-blue-400">BLUE (cards→bottom player): {debugMeasurements.blue}px</div>
            <div className="text-green-400">GREEN (top dot→top player): {debugMeasurements.green}px</div>
            <div className="text-yellow-400">YELLOW (bottom player→bottom dot): {debugMeasurements.yellow}px</div>
            {centerHeaderContent && (
              <>
                <div className="text-orange-400">ORANGE (top player→header btn): {debugMeasurements.orange}px</div>
                <div className="text-cyan-400">CYAN (header btn→cards): {debugMeasurements.cyan}px</div>
              </>
            )}
            {centerFooterContent && (
              <>
                <div className="text-pink-400">PINK (cards→footer btn): {debugMeasurements.pink}px</div>
                <div className="text-lime-400">LIME (footer btn→bottom player): {debugMeasurements.lime}px</div>
              </>
            )}
            <div className="border-t border-gray-600 pt-0.5 mt-0.5 text-white">
              Cards diff: {debugMeasurements.red - debugMeasurements.blue}px | Ring diff: {debugMeasurements.green - debugMeasurements.yellow}px
              {centerHeaderContent && <> | Header diff: {debugMeasurements.orange - debugMeasurements.cyan}px</>}
              {centerFooterContent && <> | Footer diff: {debugMeasurements.pink - debugMeasurements.lime}px</>}
            </div>
          </div>

          {/* Visual lines */}
          {debugLines && (
            <>
              {/* RED: top player → cards */}
              <div
                className="absolute z-50 pointer-events-none flex items-center"
                style={{
                  left: 'calc(50% - 2px)',
                  top: debugLines.red.top,
                  height: Math.max(0, debugLines.red.height),
                  width: '4px',
                  backgroundColor: 'red',
                }}
              >
                <span className="absolute left-2 text-red-500 text-xs font-bold whitespace-nowrap bg-black/70 px-1 rounded">
                  {debugMeasurements.red}px
                </span>
              </div>

              {/* BLUE: cards → bottom player */}
              <div
                className="absolute z-50 pointer-events-none flex items-center"
                style={{
                  left: 'calc(50% - 2px)',
                  top: debugLines.blue.top,
                  height: Math.max(0, debugLines.blue.height),
                  width: '4px',
                  backgroundColor: 'blue',
                }}
              >
                <span className="absolute left-2 text-blue-500 text-xs font-bold whitespace-nowrap bg-black/70 px-1 rounded">
                  {debugMeasurements.blue}px
                </span>
              </div>

              {/* GREEN: top dot → top player */}
              <div
                className="absolute z-50 pointer-events-none flex items-center"
                style={{
                  left: 'calc(50% - 2px)',
                  top: debugLines.green.top,
                  height: Math.max(0, debugLines.green.height),
                  width: '4px',
                  backgroundColor: 'green',
                }}
              >
                <span className="absolute left-2 text-green-500 text-xs font-bold whitespace-nowrap bg-black/70 px-1 rounded">
                  {debugMeasurements.green}px
                </span>
              </div>

              {/* YELLOW: bottom player → bottom dot */}
              <div
                className="absolute z-50 pointer-events-none flex items-center"
                style={{
                  left: 'calc(50% - 2px)',
                  top: debugLines.yellow.top,
                  height: Math.max(0, debugLines.yellow.height),
                  width: '4px',
                  backgroundColor: 'yellow',
                }}
              >
                <span className="absolute right-2 text-yellow-500 text-xs font-bold whitespace-nowrap bg-black/70 px-1 rounded">
                  {debugMeasurements.yellow}px
                </span>
              </div>

              {/* ORANGE: top player → header button (left side) */}
              {debugLines.orange && (
                <div
                  className="absolute z-50 pointer-events-none flex items-center"
                  style={{
                    left: 'calc(50% - 2px)',
                    top: debugLines.orange.top,
                    height: Math.max(0, debugLines.orange.height),
                    width: '4px',
                    backgroundColor: 'orange',
                  }}
                >
                  <span className="absolute right-2 text-orange-500 text-xs font-bold whitespace-nowrap bg-black/70 px-1 rounded">
                    {debugMeasurements.orange}px
                  </span>
                </div>
              )}

              {/* CYAN: header button → cards (left side) */}
              {debugLines.cyan && (
                <div
                  className="absolute z-50 pointer-events-none flex items-center"
                  style={{
                    left: 'calc(50% - 16px)',
                    top: debugLines.cyan.top,
                    height: Math.max(0, debugLines.cyan.height),
                    width: '4px',
                    backgroundColor: 'cyan',
                  }}
                >
                  <span className="absolute right-2 text-cyan-500 text-xs font-bold whitespace-nowrap bg-black/70 px-1 rounded">
                    {debugMeasurements.cyan}px
                  </span>
                </div>
              )}

              {/* PINK: cards → footer button (right side) */}
              {debugLines.pink && (
                <div
                  className="absolute z-50 pointer-events-none flex items-center"
                  style={{
                    left: 'calc(50% + 10px)',
                    top: debugLines.pink.top,
                    height: Math.max(0, debugLines.pink.height),
                    width: '4px',
                    backgroundColor: 'hotpink',
                  }}
                >
                  <span className="absolute left-2 text-pink-500 text-xs font-bold whitespace-nowrap bg-black/70 px-1 rounded">
                    {debugMeasurements.pink}px
                  </span>
                </div>
              )}

              {/* LIME: footer button → bottom player (right side) */}
              {debugLines.lime && (
                <div
                  className="absolute z-50 pointer-events-none flex items-center"
                  style={{
                    left: 'calc(50% - 2px)',
                    top: debugLines.lime.top,
                    height: Math.max(0, debugLines.lime.height),
                    width: '4px',
                    backgroundColor: 'lime',
                  }}
                >
                  <span className="absolute left-2 text-lime-500 text-xs font-bold whitespace-nowrap bg-black/70 px-1 rounded">
                    {debugMeasurements.lime}px
                  </span>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
