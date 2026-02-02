'use client';

/**
 * @fileoverview Popup showing a single player's statement history.
 * @module components/game/PlayerStatementPopup
 *
 * @description
 * Popup that appears when clicking on a player avatar during Day phase.
 * Shows only that player's statements in chronological order.
 * Positioned by parent at the outer circle dot (same as speech bubbles).
 */

import { useEffect, useRef } from 'react';
import { PlayerStatement } from '@/types/game';
import { cn } from '@/lib/utils';

interface PlayerStatementPopupProps {
  playerId: string;
  playerName: string;
  statements: readonly PlayerStatement[];
  onClose: () => void;
}

export function PlayerStatementPopup({
  playerId,
  playerName,
  statements,
  onClose
}: PlayerStatementPopupProps) {
  // Filter statements for this player only
  const playerStatements = statements.filter(s => s.playerId === playerId);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  // Attach native wheel event listener to properly prevent default
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const handleWheel = (e: WheelEvent) => {
      // Prevent the page from scrolling
      e.preventDefault();
      e.stopPropagation();

      // Manually scroll the container
      el.scrollTop += e.deltaY;
    };

    // Use passive: false to allow preventDefault
    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, []);

  return (
    <div
      className={cn(
        'w-[240px]',
        'bg-gray-900/98 backdrop-blur-sm',
        'border border-gray-700 rounded-lg shadow-xl',
        'popup-enter'
      )}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-700 shrink-0">
        <span className="text-sm font-medium text-white truncate">{playerName}</span>
        <button
          onClick={onClose}
          className="p-0.5 text-gray-400 hover:text-white rounded transition-colors"
          aria-label="Close"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Statements - explicit max height for scrolling */}
      <div
        ref={scrollRef}
        className="statement-scroll-container p-2 space-y-2"
      >
        {playerStatements.length === 0 ? (
          <p className="text-gray-500 text-xs text-center py-3">
            No statements from {playerName}
          </p>
        ) : (
          playerStatements.map((stmt, i) => (
            <div
              key={i}
              className="p-2 bg-gray-800/60 rounded text-xs text-gray-200"
            >
              <p className="line-clamp-3 break-words">
                {stmt.statement}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
