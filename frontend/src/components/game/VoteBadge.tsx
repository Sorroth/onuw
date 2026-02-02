'use client';

/**
 * @fileoverview Vote badge component for PlayerCircle.
 * @module components/game/VoteBadge
 *
 * @description
 * Small badge showing vote count on a player, expandable to show voter names.
 * Animates when receiving new votes.
 *
 * @pattern Observer Pattern - Reacts to vote count changes
 */

import { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

interface VoteBadgeProps {
  count: number;
  voters?: string[];
  isExpanded?: boolean;
  onToggle?: () => void;
  className?: string;
}

export function VoteBadge({
  count,
  voters = [],
  isExpanded = false,
  onToggle,
  className
}: VoteBadgeProps) {
  const [isAnimating, setIsAnimating] = useState(false);
  const prevCountRef = useRef(count);

  // Animate when count increases
  useEffect(() => {
    if (count > prevCountRef.current) {
      setIsAnimating(true);
      const timer = setTimeout(() => setIsAnimating(false), 400);
      return () => clearTimeout(timer);
    }
    prevCountRef.current = count;
  }, [count]);

  if (count === 0) return null;

  return (
    <div className={cn('relative', className)}>
      {/* Badge */}
      <button
        onClick={onToggle}
        className={cn(
          'w-6 h-6 rounded-full',
          'bg-red-600 text-white',
          'text-xs font-bold',
          'flex items-center justify-center',
          'border-2 border-red-400',
          'shadow-lg shadow-red-900/50',
          'transition-transform',
          isAnimating && 'vote-pulse',
          onToggle && 'cursor-pointer hover:bg-red-500'
        )}
      >
        {count}
      </button>

      {/* Expanded voter list */}
      {isExpanded && voters.length > 0 && (
        <div
          className={cn(
            'absolute z-50',
            'left-1/2 -translate-x-1/2',
            'top-full mt-2',
            'bg-gray-800 rounded-lg',
            'border border-gray-700',
            'shadow-xl shadow-black/50',
            'py-2 px-3',
            'min-w-max',
            'animate-in fade-in slide-in-from-top-2 duration-200'
          )}
        >
          <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1">
            Voted by
          </p>
          <div className="space-y-0.5">
            {voters.map((voter, i) => (
              <p key={i} className="text-xs text-white whitespace-nowrap">
                {voter}
              </p>
            ))}
          </div>
          {/* Arrow pointing up */}
          <div
            className="absolute -top-1.5 left-1/2 -translate-x-1/2
                       w-3 h-3 bg-gray-800 border-l border-t border-gray-700
                       rotate-45"
          />
        </div>
      )}
    </div>
  );
}

/**
 * Utility to calculate vote counts from an array of votes
 */
export function calculateVoteCounts(
  votes: Record<string, string>
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const targetId of Object.values(votes)) {
    counts[targetId] = (counts[targetId] || 0) + 1;
  }
  return counts;
}

/**
 * Utility to get voter names for a specific player
 */
export function getVotersForPlayer(
  playerId: string,
  votes: Record<string, string>,
  getPlayerName: (id: string) => string
): string[] {
  return Object.entries(votes)
    .filter(([, targetId]) => targetId === playerId)
    .map(([voterId]) => getPlayerName(voterId));
}
