'use client';

/**
 * @fileoverview Speech bubble component for player statements.
 * @module components/game/SpeechBubble
 *
 * @description
 * Displays a speech bubble near a player's avatar showing their latest statement.
 * Bubbles extend radially outward from the center of the player circle.
 */

import { cn } from '@/lib/utils';

type BubbleDirection = 'top' | 'bottom' | 'left' | 'right' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center';

interface SpeechBubbleProps {
  statement: string;
  /** Direction the bubble extends (outward from circle center) */
  direction: BubbleDirection;
  isOwn?: boolean;
  isExiting?: boolean;
  className?: string;
}

/**
 * Get positioning styles based on direction.
 * Bubbles are pushed far outside the player circle using pixel offsets.
 */
function getPositionStyle(direction: BubbleDirection): React.CSSProperties {
  // For 'center' direction, the bubble is positioned directly at the target point
  // No offset needed since parent handles positioning
  if (direction === 'center') {
    return {};
  }

  // Large offsets to push bubbles well outside the player circle
  const offset = 45; // pixels from player edge
  const diagOffset = 35;

  switch (direction) {
    case 'top':
      return { bottom: '100%', marginBottom: offset, left: '50%', transform: 'translateX(-50%)' };
    case 'bottom':
      return { top: '100%', marginTop: offset, left: '50%', transform: 'translateX(-50%)' };
    case 'left':
      return { right: '100%', marginRight: offset, top: '50%', transform: 'translateY(-50%)' };
    case 'right':
      return { left: '100%', marginLeft: offset, top: '50%', transform: 'translateY(-50%)' };
    case 'top-left':
      return { bottom: '100%', right: '100%', marginBottom: diagOffset, marginRight: diagOffset };
    case 'top-right':
      return { bottom: '100%', left: '100%', marginBottom: diagOffset, marginLeft: diagOffset };
    case 'bottom-left':
      return { top: '100%', right: '100%', marginTop: diagOffset, marginRight: diagOffset };
    case 'bottom-right':
      return { top: '100%', left: '100%', marginTop: diagOffset, marginLeft: diagOffset };
    default:
      return { bottom: '100%', marginBottom: offset, left: '50%', transform: 'translateX(-50%)' };
  }
}

/**
 * Get arrow/tail classes based on direction
 */
function getArrowClasses(direction: BubbleDirection, isOwn: boolean): string {
  const baseColor = isOwn ? 'blue-900/90' : 'gray-800/95';

  switch (direction) {
    case 'top':
      return `top-full left-1/2 -translate-x-1/2 border-l-[6px] border-r-[6px] border-t-[6px] border-l-transparent border-r-transparent border-t-${baseColor}`;
    case 'bottom':
      return `bottom-full left-1/2 -translate-x-1/2 border-l-[6px] border-r-[6px] border-b-[6px] border-l-transparent border-r-transparent border-b-${baseColor}`;
    case 'left':
      return `left-full top-1/2 -translate-y-1/2 border-t-[6px] border-b-[6px] border-l-[6px] border-t-transparent border-b-transparent border-l-${baseColor}`;
    case 'right':
      return `right-full top-1/2 -translate-y-1/2 border-t-[6px] border-b-[6px] border-r-[6px] border-t-transparent border-b-transparent border-r-${baseColor}`;
    // For diagonal directions, we'll skip the arrow for simplicity
    default:
      return 'hidden';
  }
}

export function SpeechBubble({
  statement,
  direction,
  isOwn = false,
  isExiting = false,
  className
}: SpeechBubbleProps) {
  // Truncate long statements
  const maxLength = 50;
  const displayText = statement.length > maxLength
    ? `${statement.slice(0, maxLength)}...`
    : statement;

  return (
    <div
      className={cn(
        'z-30 pointer-events-none',
        direction !== 'center' && 'absolute',
        isExiting ? 'speech-bubble-exit' : 'speech-bubble-enter',
        className
      )}
      style={getPositionStyle(direction)}
    >
      {/* Bubble content */}
      <div
        className={cn(
          'relative px-2 py-1.5 rounded-lg',
          'text-[11px] text-white leading-tight',
          'backdrop-blur-sm shadow-lg',
          'max-w-[120px] whitespace-normal break-words',
          isOwn
            ? 'bg-blue-900/90 border border-blue-700/50'
            : 'bg-gray-800/95 border border-gray-600/50'
        )}
      >
        {displayText}

        {/* Arrow/tail pointing to player - only for cardinal directions */}
        {['top', 'bottom', 'left', 'right'].includes(direction) && (
          <div
            className={cn(
              'absolute w-0 h-0',
              direction === 'top' && 'top-full left-1/2 -translate-x-1/2 border-l-[5px] border-r-[5px] border-t-[5px] border-l-transparent border-r-transparent',
              direction === 'bottom' && 'bottom-full left-1/2 -translate-x-1/2 border-l-[5px] border-r-[5px] border-b-[5px] border-l-transparent border-r-transparent',
              direction === 'left' && 'left-full top-1/2 -translate-y-1/2 border-t-[5px] border-b-[5px] border-l-[5px] border-t-transparent border-b-transparent',
              direction === 'right' && 'right-full top-1/2 -translate-y-1/2 border-t-[5px] border-b-[5px] border-r-[5px] border-t-transparent border-b-transparent',
              // Arrow colors
              isOwn
                ? direction === 'top' ? 'border-t-blue-900/90'
                  : direction === 'bottom' ? 'border-b-blue-900/90'
                  : direction === 'left' ? 'border-l-blue-900/90'
                  : 'border-r-blue-900/90'
                : direction === 'top' ? 'border-t-gray-800/95'
                  : direction === 'bottom' ? 'border-b-gray-800/95'
                  : direction === 'left' ? 'border-l-gray-800/95'
                  : 'border-r-gray-800/95'
            )}
          />
        )}
      </div>
    </div>
  );
}

/**
 * Calculate the outward direction for a bubble based on player position in circle.
 * Position is given as percentage (0-100) where 50,50 is center.
 */
export function calculateBubbleDirection(x: number, y: number): BubbleDirection {
  // Calculate angle from center (50, 50)
  const dx = x - 50;
  const dy = y - 50;
  const angle = Math.atan2(dy, dx) * (180 / Math.PI);

  // Map angle to 8 directions
  // Angle 0 = right, 90 = down, -90 = up, 180/-180 = left
  if (angle >= -22.5 && angle < 22.5) return 'right';
  if (angle >= 22.5 && angle < 67.5) return 'bottom-right';
  if (angle >= 67.5 && angle < 112.5) return 'bottom';
  if (angle >= 112.5 && angle < 157.5) return 'bottom-left';
  if (angle >= 157.5 || angle < -157.5) return 'left';
  if (angle >= -157.5 && angle < -112.5) return 'top-left';
  if (angle >= -112.5 && angle < -67.5) return 'top';
  if (angle >= -67.5 && angle < -22.5) return 'top-right';

  return 'top'; // fallback
}
