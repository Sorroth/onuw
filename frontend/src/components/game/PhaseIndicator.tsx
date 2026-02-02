'use client';

/**
 * @fileoverview Phase indicator component showing game progression.
 * @module components/game/PhaseIndicator
 *
 * @description
 * Horizontal stepper showing the current phase in the game flow:
 * Night -> Day -> Voting -> Results
 *
 * @pattern Observer Pattern - Subscribes to game phase changes
 */

import { Fragment, useState, useEffect } from 'react';
import { GamePhase } from '@/types/game';
import { cn, formatTime } from '@/lib/utils';
import { useDebugStore } from '@/stores/debugStore';

interface PhaseIndicatorProps {
  currentPhase: GamePhase;
  timeRemaining?: number | null;
  className?: string;
}

const PHASES = [
  { phase: GamePhase.NIGHT, label: 'Night', icon: MoonIcon },
  { phase: GamePhase.DAY, label: 'Day', icon: SunIcon },
  { phase: GamePhase.VOTING, label: 'Vote', icon: BallotIcon },
  { phase: GamePhase.RESOLUTION, label: 'Results', icon: TrophyIcon }
];

function MoonIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M21.64 13a1 1 0 00-1.05-.14 8.05 8.05 0 01-3.37.73 8.15 8.15 0 01-8.14-8.1 8.59 8.59 0 01.25-2A1 1 0 008 2.36a10.14 10.14 0 1014 11.69 1 1 0 00-.36-1.05z" />
    </svg>
  );
}

function SunIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <circle cx="12" cy="12" r="5" />
      <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function BallotIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 14l-5-5 1.41-1.41L12 14.17l7.59-7.59L21 8l-9 9z" />
    </svg>
  );
}

function TrophyIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M19 5h-2V3H7v2H5c-1.1 0-2 .9-2 2v1c0 2.55 1.92 4.63 4.39 4.94.63 1.5 1.98 2.63 3.61 2.96V19H7v2h10v-2h-4v-3.1c1.63-.33 2.98-1.46 3.61-2.96C19.08 12.63 21 10.55 21 8V7c0-1.1-.9-2-2-2zM5 8V7h2v3.82C5.84 10.4 5 9.3 5 8zm14 0c0 1.3-.84 2.4-2 2.82V7h2v1z" />
    </svg>
  );
}

export function PhaseIndicator({ currentPhase, timeRemaining, className }: PhaseIndicatorProps) {
  const { debugDisableTimers } = useDebugStore();
  const [seconds, setSeconds] = useState(timeRemaining ?? 0);

  // Reset timer when timeRemaining changes (new phase or server update)
  useEffect(() => {
    if (timeRemaining !== null && timeRemaining !== undefined) {
      setSeconds(timeRemaining);
    }
  }, [timeRemaining]);

  // Local countdown
  useEffect(() => {
    if (debugDisableTimers || seconds <= 0) return;

    const timer = setInterval(() => {
      setSeconds(prev => Math.max(0, prev - 1));
    }, 1000);

    return () => clearInterval(timer);
  }, [seconds, debugDisableTimers]);

  const currentIndex = PHASES.findIndex(p => p.phase === currentPhase);
  // Handle SETUP phase - show Night as upcoming
  const effectiveIndex = currentPhase === GamePhase.SETUP ? -1 : currentIndex;
  const isWarning = seconds <= 10 && seconds > 0;

  return (
    <div className={cn('flex items-center gap-1 sm:gap-2', className)}>
      {PHASES.map((p, i) => {
        const isActive = i === effectiveIndex;
        const isCompleted = i < effectiveIndex;
        const isUpcoming = i > effectiveIndex;
        const Icon = p.icon;

        return (
          <Fragment key={p.phase}>
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  'flex items-center gap-1 px-2 py-1 rounded-full transition-all duration-300',
                  isActive && 'bg-blue-600 text-white shadow-lg shadow-blue-600/30',
                  isCompleted && 'bg-green-600/20 text-green-400',
                  isUpcoming && 'bg-gray-700/50 text-gray-500'
                )}
              >
                <Icon className="w-4 h-4" />
                <span className="text-xs font-medium hidden sm:inline">{p.label}</span>
              </div>
              {/* Inline timer under active phase */}
              {isActive && seconds > 0 && (
                <span
                  className={cn(
                    'text-xs font-mono mt-0.5 transition-colors',
                    isWarning ? 'text-red-400 animate-pulse' : 'text-gray-400'
                  )}
                >
                  {formatTime(seconds)}
                </span>
              )}
            </div>
            {i < PHASES.length - 1 && (
              <div
                className={cn(
                  'w-4 sm:w-6 h-0.5 transition-colors duration-300',
                  isCompleted ? 'bg-green-500' : 'bg-gray-600'
                )}
              />
            )}
          </Fragment>
        );
      })}
    </div>
  );
}
