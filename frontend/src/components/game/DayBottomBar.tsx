'use client';

/**
 * @fileoverview Bottom bar for Day phase with statement input and controls.
 * @module components/game/DayBottomBar
 *
 * @description
 * Compact bottom bar containing chat toggle, statement input, send button,
 * and Ready to Vote button. Replaces the footer + chat card UI.
 */

import { useState, KeyboardEvent } from 'react';
import { Button } from '@/components/ui';
import { cn } from '@/lib/utils';

interface DayBottomBarProps {
  onSubmitStatement: (text: string) => void;
  onReadyToVote: () => void;
  onToggleChat: () => void;
  chatOpen: boolean;
  statementCount: number;
  className?: string;
}

export function DayBottomBar({
  onSubmitStatement,
  onReadyToVote,
  onToggleChat,
  chatOpen,
  statementCount,
  className
}: DayBottomBarProps) {
  const [statement, setStatement] = useState('');

  const handleSubmit = () => {
    if (statement.trim()) {
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

  return (
    <div
      className={cn(
        'fixed bottom-0 left-0 right-0',
        'h-14 px-4',
        'bg-gray-900/95 backdrop-blur-sm',
        'border-t border-gray-800',
        'flex items-center gap-3',
        'z-30',
        className
      )}
    >
      {/* Chat toggle button */}
      <button
        onClick={onToggleChat}
        className={cn(
          'flex items-center gap-1.5 px-3 py-1.5 rounded-lg',
          'text-sm font-medium transition-colors',
          chatOpen
            ? 'bg-blue-600 text-white'
            : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
        )}
        aria-label={chatOpen ? 'Close chat' : 'Open chat'}
      >
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
          />
        </svg>
        {statementCount > 0 && (
          <span className="min-w-[20px] text-center">{statementCount}</span>
        )}
      </button>

      {/* Statement input */}
      <div className="flex-1 flex items-center gap-2">
        <input
          type="text"
          value={statement}
          onChange={(e) => setStatement(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Make a statement..."
          className={cn(
            'flex-1 px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg',
            'text-sm text-white placeholder-gray-500',
            'focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500',
            'transition-colors'
          )}
        />
        <Button
          onClick={handleSubmit}
          disabled={!statement.trim()}
          size="sm"
          variant="secondary"
        >
          Send
        </Button>
      </div>

      {/* Ready to Vote button */}
      <Button
        onClick={onReadyToVote}
        variant="primary"
        size="sm"
        className="whitespace-nowrap"
      >
        Ready to Vote
      </Button>
    </div>
  );
}
