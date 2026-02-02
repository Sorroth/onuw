'use client';

/**
 * @fileoverview Role card display components for game roles.
 * @module components/game/RoleCard
 *
 * @description
 * Displays game role cards with team-colored styling, icons, and
 * support for face-down state. Includes RoleCard and CenterCards components.
 *
 * @pattern Composite Pattern - RoleCard composed with CenterCards
 * @pattern Strategy Pattern - Different display strategies for face-up/down
 */

import { RoleName, ROLE_METADATA, Team, TEAM_COLORS, TEAM_BG_COLORS } from '@/types/game';
import { cn } from '@/lib/utils';

/** Role icons (emoji-based for simplicity, could be replaced with custom images) */
export const ROLE_ICONS: Record<RoleName, string> = {
  [RoleName.WEREWOLF]: '🐺',
  [RoleName.MINION]: '👹',
  [RoleName.SEER]: '🔮',
  [RoleName.ROBBER]: '🦹',
  [RoleName.TROUBLEMAKER]: '🎭',
  [RoleName.DRUNK]: '🍺',
  [RoleName.INSOMNIAC]: '😳',
  [RoleName.MASON]: '🧱',
  [RoleName.VILLAGER]: '👨‍🌾',
  [RoleName.HUNTER]: '🏹',
  [RoleName.TANNER]: '🪶',
  [RoleName.DOPPELGANGER]: '👥'
};

interface RoleCardProps {
  role: RoleName;
  size?: 'sm' | 'md' | 'lg';
  faceDown?: boolean;
  onClick?: () => void;
  selected?: boolean;
  className?: string;
  /** For Doppelganger: the role they copied */
  copiedRole?: RoleName;
}

export function RoleCard({
  role,
  size = 'md',
  faceDown = false,
  onClick,
  selected = false,
  className,
  copiedRole
}: RoleCardProps) {
  const metadata = ROLE_METADATA[role];
  const copiedMetadata = copiedRole ? ROLE_METADATA[copiedRole] : null;

  // For Doppelganger with copied role, use the copied role's team for styling
  const effectiveTeam = copiedMetadata ? copiedMetadata.team : metadata.team;

  const sizes = {
    sm: 'w-20 h-28',
    md: 'w-28 h-40',
    lg: 'w-36 h-52'
  };

  const textSizes = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base'
  };

  const iconSizes = {
    sm: 'text-2xl',
    md: 'text-4xl',
    lg: 'text-5xl'
  };

  if (faceDown) {
    return (
      <div
        onClick={onClick}
        className={cn(
          sizes[size],
          'rounded-lg border-2 border-gray-600 bg-gradient-to-br from-gray-700 to-gray-800',
          'flex items-center justify-center',
          onClick && 'cursor-pointer hover:border-gray-500 transition-colors',
          selected && 'border-blue-500 ring-2 ring-blue-500/50',
          className
        )}
      >
        <span className={cn(iconSizes[size], 'opacity-50')}>❓</span>
      </div>
    );
  }

  const teamColorClass = effectiveTeam === Team.WEREWOLF
    ? 'from-red-900 to-red-950 border-red-700'
    : effectiveTeam === Team.TANNER
    ? 'from-amber-900 to-amber-950 border-amber-700'
    : 'from-blue-900 to-blue-950 border-blue-700';

  return (
    <div
      onClick={onClick}
      className={cn(
        sizes[size],
        'rounded-lg border-2 bg-gradient-to-br',
        teamColorClass,
        'flex flex-col items-center justify-center p-2',
        onClick && 'cursor-pointer hover:brightness-110 transition-all',
        selected && 'ring-2 ring-yellow-500/50 scale-105',
        className
      )}
    >
      {/* Role icon */}
      <span className={iconSizes[size]}>
        {copiedMetadata ? (
          // Show both icons for Doppelganger with copied role
          <span className="flex items-center justify-center gap-0.5">
            <span className="opacity-60 text-[0.6em]">{ROLE_ICONS[role]}</span>
            <span>{ROLE_ICONS[copiedRole!]}</span>
          </span>
        ) : (
          ROLE_ICONS[role]
        )}
      </span>

      {/* Role name */}
      <p className={cn(
        'font-bold text-white text-center mt-1',
        textSizes[size]
      )}>
        {copiedMetadata
          ? `${metadata.displayName}-${copiedMetadata.displayName}`
          : metadata.displayName}
      </p>

      {/* Team indicator */}
      <span className={cn(
        'text-center mt-1 opacity-75',
        textSizes[size],
        TEAM_COLORS[effectiveTeam]
      )}>
        {effectiveTeam}
      </span>
    </div>
  );
}

interface CenterCardsProps {
  cards?: readonly RoleName[];
  onCardClick?: (index: number) => void;
  selectedIndices?: number[];
  revealed?: boolean;
}

export function CenterCards({
  cards,
  onCardClick,
  selectedIndices = [],
  revealed = false
}: CenterCardsProps) {
  return (
    <div className="flex justify-center gap-4">
      {[0, 1, 2].map((index) => (
        <div key={index} className="text-center">
          <p className="text-gray-400 text-xs mb-1">Card {index + 1}</p>
          {revealed && cards ? (
            <RoleCard
              role={cards[index]}
              size="sm"
              onClick={() => onCardClick?.(index)}
              selected={selectedIndices.includes(index)}
            />
          ) : (
            <RoleCard
              role={RoleName.VILLAGER}
              size="sm"
              faceDown
              onClick={() => onCardClick?.(index)}
              selected={selectedIndices.includes(index)}
            />
          )}
        </div>
      ))}
    </div>
  );
}
