'use client';

/**
 * @fileoverview Fixed game header component.
 * @module components/game/GameHeader
 *
 * @description
 * Fixed header showing phase indicator with inline timer centered in the header.
 * Timer is displayed directly under the active phase indicator.
 *
 * @pattern Composite Pattern - Composes PhaseIndicator with integrated timer
 */

import { GamePhase } from '@/types/game';
import { PhaseIndicator } from './PhaseIndicator';
import { cn } from '@/lib/utils';

interface GameHeaderProps {
  phase: GamePhase;
  timeRemaining?: number | null;
  showTimer?: boolean;
  className?: string;
}

/** Phase-specific instruction messages */
const PHASE_INSTRUCTIONS: Record<GamePhase, string> = {
  [GamePhase.SETUP]: 'Waiting for players...',
  [GamePhase.NIGHT]: 'Perform your night action',
  [GamePhase.DAY]: 'Discuss and find the werewolves!',
  [GamePhase.VOTING]: 'Vote for who to eliminate',
  [GamePhase.RESOLUTION]: 'Game over'
};

export function GameHeader({
  phase,
  timeRemaining,
  showTimer = true,
  className
}: GameHeaderProps) {
  return (
    <header
      className={cn(
        'fixed top-0 left-0 right-0 z-50',
        'h-[var(--header-height)] px-4',
        'bg-gray-900/95 backdrop-blur-sm',
        'border-b border-gray-800',
        'flex flex-col items-center justify-center',
        // Account for sidebar width so content is centered over the main area
        'md:pl-[var(--sidebar-width-md)] lg:pl-[var(--sidebar-width)]',
        className
      )}
    >
      <PhaseIndicator
        currentPhase={phase}
        timeRemaining={showTimer ? timeRemaining : null}
      />
      <p className="text-gray-400 text-xs mt-1">{PHASE_INSTRUCTIONS[phase]}</p>
    </header>
  );
}
