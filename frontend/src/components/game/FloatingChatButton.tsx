'use client';

/**
 * @fileoverview Floating chat toggle button component.
 * @module components/game/FloatingChatButton
 *
 * @description
 * A floating button positioned in the bottom-right corner that toggles
 * the chat panel. Shows message count badge when there are statements.
 *
 * @pattern Single Responsibility - Only handles chat toggle UI
 * @pattern Composition - Designed to be composed with ChatPanel in phase views
 */

import { cn } from '@/lib/utils';

interface FloatingChatButtonProps {
  isOpen: boolean;
  onClick: () => void;
  statementCount: number;
  className?: string;
}

export function FloatingChatButton({
  isOpen,
  onClick,
  statementCount,
  className
}: FloatingChatButtonProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'fixed bottom-4 right-4 z-30',
        'flex items-center gap-2 px-4 py-3 rounded-full',
        'shadow-lg transition-all',
        isOpen
          ? 'bg-blue-600 text-white'
          : 'bg-gray-800 text-gray-300 hover:bg-gray-700',
        className
      )}
      aria-label={isOpen ? 'Close chat' : 'Open chat'}
    >
      <svg
        className="w-5 h-5"
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
        <span className="text-sm font-medium">{statementCount}</span>
      )}
    </button>
  );
}
