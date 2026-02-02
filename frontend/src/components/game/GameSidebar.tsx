'use client';

/**
 * @fileoverview Game sidebar component.
 * @module components/game/GameSidebar
 *
 * @description
 * Persistent left sidebar showing the player's role card, night information,
 * and night action choices (like Seer's player/center choice).
 *
 * @pattern Composite Pattern - Composes RoleCard, NightInfoPanel, and NightActionChoice
 */

import { useState } from 'react';
import { useGameStore } from '@/stores/gameStore';
import { RoleCard } from './RoleCard';
import { NightInfoPanel } from './NightInfoPanel';
import { ROLE_METADATA, GamePhase, RoleName, NightActionSummary, TEAM_COLORS, Team, TEAM_BG_COLORS } from '@/types/game';
import { cn } from '@/lib/utils';
import { createPlayerNameResolver } from '@/lib/playerUtils';
import { getActionContext } from '@/lib/gameActionUtils';

interface GameSidebarProps {
  className?: string;
  showFinalRole?: boolean;
  finalRole?: string;
  /** Selected players for display feedback */
  selectedPlayers?: string[];
  /** Selected center card indices for display feedback */
  selectedCenterCards?: number[];
  /** All night actions for results view toggle */
  allNightActions?: readonly NightActionSummary[];
  /** Whether player won (for results view) */
  isWinner?: boolean;
  /** Winning teams (for results view) */
  winningTeams?: readonly Team[];
}

export function GameSidebar({
  className,
  showFinalRole,
  finalRole,
  selectedPlayers = [],
  selectedCenterCards = [],
  allNightActions,
  isWinner,
  winningTeams
}: GameSidebarProps) {
  const { gameView, pendingActionRequest, playerIdMapping, roomState } = useGameStore();
  const [showAllActions, setShowAllActions] = useState(false);

  if (!gameView) return null;

  const getPlayerName = createPlayerNameResolver(playerIdMapping, roomState);
  const roleMetadata = ROLE_METADATA[gameView.myStartingRole];
  const hasFinalRoleChange = showFinalRole && finalRole && finalRole !== gameView.myStartingRole;
  const isNightPhase = gameView.phase === GamePhase.NIGHT;
  const hasAllNightActions = allNightActions && allNightActions.length > 0;

  // Get copied role for Doppelganger display
  const copiedRoleInfo = gameView.myStartingRole === RoleName.DOPPELGANGER
    ? gameView.myNightInfo.find(result => result.roleName === RoleName.DOPPELGANGER && result.info.copied)?.info.copied
    : null;
  const copiedRole = copiedRoleInfo?.role;

  // Get contextual action info for Doppelganger and other multi-step actions
  const actionContext = getActionContext(
    pendingActionRequest,
    gameView.myStartingRole,
    gameView.myNightInfo
  );

  return (
    <div className={cn('space-y-4', className)}>
      {/* Win/Loss indicator and winning teams for results */}
      {isWinner !== undefined && (
        <div className="space-y-2">
          <div className={cn(
            'flex items-center justify-center gap-2 py-2 px-3 rounded-lg',
            isWinner
              ? 'bg-green-900/50 border border-green-700'
              : 'bg-red-900/50 border border-red-700'
          )}>
            <span className="text-lg">{isWinner ? '🏆' : '💀'}</span>
            <span className={cn(
              'font-semibold text-sm',
              isWinner ? 'text-green-400' : 'text-red-400'
            )}>
              {isWinner ? 'Victory!' : 'Defeat'}
            </span>
          </div>
          {winningTeams && winningTeams.length > 0 && (
            <div className="flex flex-wrap justify-center gap-1">
              {winningTeams.map((team) => (
                <span
                  key={team}
                  className={cn(
                    'px-2 py-0.5 rounded text-xs font-medium text-white',
                    TEAM_BG_COLORS[team]
                  )}
                >
                  {team} Wins
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Toggle for results view */}
      {hasAllNightActions && (
        <div className="flex rounded-lg bg-gray-800/50 p-0.5">
          <button
            onClick={() => setShowAllActions(false)}
            className={cn(
              'flex-1 px-2 py-1.5 text-xs font-medium rounded-md transition-colors',
              !showAllActions
                ? 'bg-gray-700 text-white'
                : 'text-gray-400 hover:text-gray-300'
            )}
          >
            Your Role
          </button>
          <button
            onClick={() => setShowAllActions(true)}
            className={cn(
              'flex-1 px-2 py-1.5 text-xs font-medium rounded-md transition-colors',
              showAllActions
                ? 'bg-gray-700 text-white'
                : 'text-gray-400 hover:text-gray-300'
            )}
          >
            All Actions
          </button>
        </div>
      )}

      {/* All Night Actions View */}
      {showAllActions && hasAllNightActions ? (
        <div className="space-y-2">
          <h3 className="text-xs text-gray-400 uppercase tracking-wide">
            Night Actions
          </h3>
          <div className="space-y-2 max-h-[calc(100vh-16rem)] overflow-y-auto">
            {allNightActions.map((action, i) => (
              <div
                key={i}
                className="p-2 bg-gray-800/50 rounded-lg"
              >
                <div className="flex items-center gap-1.5 text-xs">
                  <span className="text-white font-medium">{action.playerName}</span>
                  <span className="text-gray-500">as</span>
                  <span className={cn(
                    'font-medium',
                    TEAM_COLORS[ROLE_METADATA[action.roleName].team]
                  )}>
                    {ROLE_METADATA[action.roleName].displayName}
                  </span>
                </div>
                <p className="text-gray-400 text-xs mt-1">{action.description}</p>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <>
          {/* Your Starting Role */}
          <div>
            <h3 className="text-xs text-gray-400 mb-2 uppercase tracking-wide">
              {copiedRole ? 'Your Role (Copied)' : 'Your Role'}
            </h3>
            <RoleCard
              role={gameView.myStartingRole}
              size="sm"
              copiedRole={copiedRole}
            />
          </div>

          {/* Role description */}
          {roleMetadata.nightActionDescription && !actionContext && (
            <div className="text-xs text-gray-400 leading-relaxed">
              {roleMetadata.nightActionDescription}
            </div>
          )}

          {/* Current action context (especially for Doppelganger multi-step) */}
          {isNightPhase && actionContext && (
            <div className="pt-2 border-t border-gray-700">
              <h3 className="text-xs text-purple-400 mb-1 uppercase tracking-wide">
                {actionContext.title}
              </h3>
              <p className="text-xs text-gray-300 leading-relaxed">
                {actionContext.description}
              </p>
            </div>
          )}

          {/* Selection feedback during night actions */}
          {isNightPhase && (selectedPlayers.length > 0 || selectedCenterCards.length > 0) && (
            <div className="pt-2 border-t border-gray-700">
              <h3 className="text-xs text-gray-400 mb-2 uppercase tracking-wide">
                Selected
              </h3>
              {selectedPlayers.length > 0 && (
                <div className="text-sm text-purple-300">
                  {selectedPlayers.map((id, i) => (
                    <span key={id} className="inline-flex items-center gap-1">
                      <span className="bg-purple-600 text-white text-xs w-4 h-4 rounded-full flex items-center justify-center">
                        {i + 1}
                      </span>
                      <span>{getPlayerName(id)}</span>
                      {i < selectedPlayers.length - 1 && ', '}
                    </span>
                  ))}
                </div>
              )}
              {selectedCenterCards.length > 0 && (
                <div className="text-sm text-purple-300">
                  Center cards: {selectedCenterCards.map(i => i + 1).join(', ')}
                </div>
              )}
            </div>
          )}

          {/* Final role (if changed) */}
          {hasFinalRoleChange && (
            <div className="pt-2 border-t border-gray-700">
              <h3 className="text-xs text-gray-400 mb-2 uppercase tracking-wide">
                Final Role
              </h3>
              <RoleCard role={finalRole as RoleName} size="sm" />
              <p className="text-xs text-amber-400 mt-1">
                Your role was swapped during the night!
              </p>
            </div>
          )}

          {/* Night Information */}
          {gameView.myNightInfo.length > 0 && (
            <div className="pt-2 border-t border-gray-700">
              <NightInfoPanel compact />
            </div>
          )}
        </>
      )}
    </div>
  );
}
