'use client';

/**
 * @fileoverview Unified game phase layout wrapper.
 * @module components/game/GamePhaseLayout
 *
 * @description
 * Master wrapper component providing consistent structure across all game phases.
 * Features:
 * - Fixed header with phase indicator and timer
 * - Left sidebar with role card and night info
 * - Center-dominant player circle
 * - Phase-specific content area
 *
 * @pattern Composite Pattern - Composes header, sidebar, and main content
 * @pattern Template Pattern - Provides consistent layout structure
 */

import { ReactNode, useMemo } from 'react';
import { GamePhase } from '@/types/game';
import { useGameStore } from '@/stores/gameStore';
import { GameHeader } from './GameHeader';
import { cn } from '@/lib/utils';

/**
 * Calculate time remaining for a pending action request
 */
function getActionTimeRemaining(
  timeoutMs: number | undefined,
  timestamp: number | undefined
): number | null {
  if (!timeoutMs || !timestamp) return null;
  const elapsed = Date.now() - timestamp;
  const remaining = Math.max(0, timeoutMs - elapsed);
  return Math.ceil(remaining / 1000); // Return seconds
}

interface GamePhaseLayoutProps {
  phase: GamePhase;
  children?: ReactNode;
  showTimer?: boolean;
  showSidebar?: boolean;
  sidebarContent?: ReactNode;
  showPlayerCircle?: boolean;
  playerCircleContent?: ReactNode;
  footerContent?: ReactNode;
  className?: string;
}

/**
 * Phase background overlay colors - subtle shifts instead of dramatic changes
 */
const PHASE_BACKGROUNDS: Record<GamePhase, string> = {
  [GamePhase.SETUP]: '',
  [GamePhase.NIGHT]: 'bg-gradient-to-b from-indigo-950/40 to-transparent',
  [GamePhase.DAY]: 'bg-gradient-to-b from-amber-900/10 to-transparent',
  [GamePhase.VOTING]: 'bg-gradient-to-b from-red-950/20 to-transparent',
  [GamePhase.RESOLUTION]: 'bg-gradient-to-b from-emerald-950/20 to-transparent'
};

export function GamePhaseLayout({
  phase,
  children,
  showTimer = true,
  showSidebar = true,
  sidebarContent,
  showPlayerCircle = true,
  playerCircleContent,
  footerContent,
  className
}: GamePhaseLayoutProps) {
  const { gameView, pendingActionRequest } = useGameStore();

  // For night phase, use action-level timeout; for other phases, use phase-level timeout
  const effectiveTimeRemaining = useMemo(() => {
    if (phase === GamePhase.NIGHT && pendingActionRequest) {
      return getActionTimeRemaining(
        pendingActionRequest.timeoutMs,
        pendingActionRequest.timestamp
      );
    }
    return gameView?.timeRemaining ?? null;
  }, [phase, pendingActionRequest, gameView?.timeRemaining]);

  return (
    <div
      className={cn(
        'min-h-screen',
        PHASE_BACKGROUNDS[phase],
        'phase-enter',
        className
      )}
    >
      {/* Fixed Header */}
      <GameHeader
        phase={phase}
        timeRemaining={effectiveTimeRemaining}
        showTimer={showTimer}
      />

      {/* Main content area - below header */}
      <div
        className={cn(
          "pt-[var(--header-height)] min-h-screen flex overflow-visible",
          footerContent && "pb-[var(--footer-height)]"
        )}
      >
        {/* Left Sidebar */}
        {showSidebar && (
          <aside
            className={cn(
              'hidden md:block',
              'w-[var(--sidebar-width-md)] lg:w-[var(--sidebar-width)]',
              'flex-shrink-0',
              'border-r border-gray-800',
              'bg-gray-900/50',
              'overflow-y-auto'
            )}
          >
            <div className="p-4 space-y-4">
              {sidebarContent}
            </div>
          </aside>
        )}

        {/* Main Content Area */}
        <main className="flex-1 flex flex-col">
          {/* Player Circle Area - centered between header and footer */}
          {showPlayerCircle && playerCircleContent && (
            <div className="flex-1 px-4 flex items-center justify-center overflow-visible">
              <div className="w-full max-w-lg overflow-visible">
                {playerCircleContent}
              </div>
            </div>
          )}

          {/* Phase-specific content */}
          {children && (
            <div className="flex-shrink-0 overflow-y-auto p-4">
              {children}
            </div>
          )}
        </main>
      </div>

      {/* Fixed Footer */}
      {footerContent && (
        <footer
          className={cn(
            'fixed bottom-0 left-0 right-0',
            'h-[var(--footer-height)] px-4',
            'bg-gray-900/95 backdrop-blur-sm',
            'border-t border-gray-800',
            'flex items-center justify-center',
            showSidebar && 'md:pl-[var(--sidebar-width-md)] lg:pl-[var(--sidebar-width)]'
          )}
        >
          {footerContent}
        </footer>
      )}
    </div>
  );
}
