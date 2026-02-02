'use client';

/**
 * @fileoverview Center cards display component for PlayerCircle.
 * @module components/game/CenterCardsDisplay
 *
 * @description
 * Displays the 3 center cards in the middle of the PlayerCircle.
 * - Face-down by default
 * - Selectable during night actions (Seer, Drunk)
 * - Revealed in Results phase
 *
 * @pattern Observer Pattern - Reacts to selection state
 */

import { RoleName, ROLE_METADATA } from '@/types/game';
import { cn } from '@/lib/utils';
import { ROLE_ICONS } from './RoleCard';

interface CenterCard {
  role?: RoleName;
  revealed: boolean;
}

interface CenterCardsDisplayProps {
  cards?: CenterCard[];
  selectedIndices?: number[];
  onCardClick?: (index: number) => void;
  interactive?: boolean;
  size?: 'sm' | 'md';
  className?: string;
  // Inline confirm mode props (for all night actions)
  /** Enable inline confirm UI for center card selection */
  inlineConfirmMode?: boolean;
  /** Expected number of cards to select (for progress display) */
  expectedCount?: number;
  /** Callback when player confirms center card selection */
  onConfirm?: () => void;
  /** Callback when player cancels center card selection */
  onCancel?: () => void;
}

export function CenterCardsDisplay({
  cards = [
    { revealed: false },
    { revealed: false },
    { revealed: false }
  ],
  selectedIndices = [],
  onCardClick,
  interactive = false,
  size = 'sm',
  className,
  inlineConfirmMode = false,
  expectedCount = 2,
  onConfirm,
  onCancel
}: CenterCardsDisplayProps) {
  const cardSizes = {
    sm: 'w-10 h-14',
    md: 'w-14 h-20'
  };

  const iconSizes = {
    sm: 'text-lg',
    md: 'text-2xl'
  };

  const labelSizes = {
    sm: 'text-[8px]',
    md: 'text-[10px]'
  };

  const selectedCount = selectedIndices.length;
  const selectionComplete = selectedCount === expectedCount;
  const showInlineUI = inlineConfirmMode && selectedCount > 0;

  return (
    <div className={cn('flex flex-col items-center', className)}>
      {/* Cards row */}
      <div className="flex items-center justify-center gap-1">
        {[0, 1, 2].map((index) => {
          const card = cards[index] || { revealed: false };
          const isSelected = selectedIndices.includes(index);
          const canClick = interactive && onCardClick;

          return (
            <button
              key={index}
              onClick={() => canClick && onCardClick(index)}
              disabled={!canClick}
              className={cn(
                cardSizes[size],
                'rounded-md border-2 transition-all duration-200',
                'flex flex-col items-center justify-center',

                // Face down state
                !card.revealed && 'bg-gradient-to-br from-gray-700 to-gray-800 border-gray-600',

                // Revealed state
                card.revealed && card.role && getCardBackground(card.role),

                // Selection state (purple for night action inline confirm mode)
                isSelected && inlineConfirmMode && 'ring-2 ring-purple-500 ring-offset-2 ring-offset-gray-900 scale-110 border-purple-500',
                isSelected && !inlineConfirmMode && 'ring-2 ring-blue-500 ring-offset-2 ring-offset-gray-900 scale-110',

                // Interactive state
                canClick && !isSelected && inlineConfirmMode && 'hover:border-purple-400 hover:scale-105 cursor-pointer',
                canClick && !isSelected && !inlineConfirmMode && 'hover:border-blue-400 hover:scale-105 cursor-pointer',
                !canClick && 'cursor-default'
              )}
            >
              {card.revealed && card.role ? (
                // Revealed card
                <>
                  <span className={iconSizes[size]}>
                    {ROLE_ICONS[card.role]}
                  </span>
                  <span className={cn(
                    labelSizes[size],
                    'font-medium text-white/90 mt-0.5 leading-tight text-center'
                  )}>
                    {ROLE_METADATA[card.role].displayName.split(' ')[0]}
                  </span>
                </>
              ) : (
                // Face down card
                <>
                  <span className={cn(iconSizes[size], 'text-gray-500')}>?</span>
                  <span className={cn(labelSizes[size], 'text-gray-500')}>
                    {index + 1}
                  </span>
                </>
              )}
            </button>
          );
        })}
      </div>

      {/* Center card selection status and confirm/cancel */}
      {showInlineUI && (
        <div className="mt-2 flex items-center gap-2">
          <span className={cn(
            'text-xs',
            selectionComplete ? 'text-purple-300' : 'text-gray-400'
          )}>
            ({selectedCount}/{expectedCount} Selected)
          </span>
          {selectionComplete && (
            <>
              <button
                onClick={onCancel}
                className="w-6 h-6 rounded-full bg-red-600 hover:bg-red-500 text-white flex items-center justify-center shadow-md transition-colors"
              >
                <span className="text-xs font-bold">✕</span>
              </button>
              <button
                onClick={onConfirm}
                className="w-6 h-6 rounded-full bg-green-600 hover:bg-green-500 text-white flex items-center justify-center shadow-md transition-colors"
              >
                <span className="text-xs font-bold">✓</span>
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function getCardBackground(role: RoleName): string {
  const metadata = ROLE_METADATA[role];
  switch (metadata.team) {
    case 'WEREWOLF':
      return 'bg-gradient-to-br from-red-900 to-red-950 border-red-700';
    case 'TANNER':
      return 'bg-gradient-to-br from-amber-900 to-amber-950 border-amber-700';
    default:
      return 'bg-gradient-to-br from-blue-900 to-blue-950 border-blue-700';
  }
}
