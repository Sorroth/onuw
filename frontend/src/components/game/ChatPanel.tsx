'use client';

/**
 * @fileoverview Slide-out chat panel for full discussion history.
 * @module components/game/ChatPanel
 *
 * @description
 * A slide-out panel from the right side showing all player statements.
 * Provides full chat history view complementing the speech bubbles.
 */

import { useState, useEffect, useRef, KeyboardEvent } from 'react';
import { PlayerStatement } from '@/types/game';
import { Button } from '@/components/ui';
import { cn } from '@/lib/utils';

interface ChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
  statements: readonly PlayerStatement[];
  getPlayerName: (playerId: string) => string;
  myPlayerId: string;
  /** Optional - if not provided, input is hidden (read-only mode) */
  onSubmitStatement?: (text: string) => void;
  /** Optional custom message when no statements exist */
  emptyMessage?: string;
}

export function ChatPanel({
  isOpen,
  onClose,
  statements,
  getPlayerName,
  myPlayerId,
  onSubmitStatement,
  emptyMessage = 'No statements yet'
}: ChatPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [statement, setStatement] = useState('');

  const handleSubmit = () => {
    if (statement.trim() && onSubmitStatement) {
      onSubmitStatement(statement.trim());
      setStatement('');
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  // Auto-scroll to bottom when new statements arrive
  useEffect(() => {
    if (isOpen && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [statements.length, isOpen]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop - click to close */}
      <div
        className="fixed inset-0 z-30 bg-black/30"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        className={cn(
          'fixed right-0 z-40 w-80',
          'top-[var(--header-height)] bottom-0',
          'bg-gray-900/98 backdrop-blur-sm',
          'border-l border-gray-800',
          'flex flex-col',
          'chat-panel-enter'
        )}
        role="dialog"
        aria-label="Discussion panel"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
          <h2 className="text-sm font-semibold text-white">Discussion</h2>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-white rounded transition-colors"
            aria-label="Close panel"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Statements list */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-2">
          {statements.length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-4">
              {emptyMessage}
            </p>
          ) : (
            statements.map((stmt, i) => {
              const isOwn = stmt.playerId === myPlayerId;
              return (
                <div
                  key={i}
                  className={cn(
                    'p-2 rounded-lg',
                    isOwn
                      ? 'bg-blue-900/40 ml-4'
                      : 'bg-gray-800/60 mr-4'
                  )}
                >
                  <p className="text-xs text-gray-400 mb-0.5">
                    {isOwn ? 'You' : getPlayerName(stmt.playerId)}
                  </p>
                  <p className="text-sm text-white">{stmt.statement}</p>
                </div>
              );
            })
          )}
        </div>

        {/* Input section - only shown if onSubmitStatement provided */}
        {onSubmitStatement && (
          <div className="p-3 border-t border-gray-800">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={statement}
                onChange={(e) => setStatement(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Make a statement..."
                className={cn(
                  'flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg',
                  'text-sm text-white placeholder-gray-500',
                  'focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500',
                  'transition-colors'
                )}
              />
              <Button
                onClick={handleSubmit}
                disabled={!statement.trim()}
                size="sm"
                variant="primary"
              >
                Send
              </Button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
