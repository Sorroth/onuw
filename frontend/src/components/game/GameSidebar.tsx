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
  const shouldShowFinalRole = showFinalRole && finalRole;
  const isNightPhase = gameView.phase === GamePhase.NIGHT;
  const hasAllNightActions = allNightActions && allNightActions.length > 0;

  // Get copied role for Doppelganger display
  // Use the LAST matching result (backend sends partial first, then complete with all info)
  const doppelResults = gameView.myStartingRole === RoleName.DOPPELGANGER
    ? gameView.myNightInfo.filter(result => result.roleName === RoleName.DOPPELGANGER && result.info.copied)
    : [];
  const copiedRoleInfo = doppelResults.length > 0 ? doppelResults[doppelResults.length - 1].info.copied : null;
  const copiedRole = copiedRoleInfo?.role;

  // Check if Robber (or Doppelganger-Robber) has stolen a role
  // The Robber sees their new card after stealing - they only view one card (their own new card)
  // NOTE: For Doppelganger-Robber, the results are under roleName: DOPPELGANGER, not ROBBER
  const isRobber = gameView.myStartingRole === RoleName.ROBBER || copiedRole === RoleName.ROBBER;

  // Get the viewed info based on whether it's a regular Robber or Doppelganger-Robber
  const robberViewedInfo = (() => {
    if (copiedRole === RoleName.ROBBER) {
      // Doppelganger-Robber: viewed info is in the Doppelganger result
      const doppelWithViewed = doppelResults.find(r =>
        Array.isArray(r.info.viewed) && r.info.viewed.length > 0
      );
      return doppelWithViewed?.info.viewed ?? null;
    } else if (gameView.myStartingRole === RoleName.ROBBER) {
      // Regular Robber: viewed info is in the Robber result
      const robberResult = gameView.myNightInfo.find(r =>
        r.roleName === RoleName.ROBBER &&
        Array.isArray(r.info.viewed) &&
        r.info.viewed.length > 0
      );
      return robberResult?.info.viewed ?? null;
    }
    return null;
  })();

  // Robber views exactly one card - their own new card after stealing
  const stolenRole = robberViewedInfo && robberViewedInfo.length > 0
    ? robberViewedInfo[0].role
    : undefined;

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
          {/* Your Starting Role - or stolen role if Robber has acted */}
          <div>
            <h3 className="text-xs text-gray-400 mb-2 uppercase tracking-wide">
              {stolenRole ? 'Your Role (Stolen)' : copiedRole ? 'Your Role (Copied)' : 'Your Role'}
            </h3>
            {stolenRole ? (
              // Robber has stolen - show the stolen role
              <RoleCard
                role={stolenRole}
                size="sm"
              />
            ) : (
              // Normal display - starting role with optional copied role
              <RoleCard
                role={gameView.myStartingRole}
                size="sm"
                copiedRole={copiedRole}
              />
            )}
          </div>

          {/* Role description - always show for stolen/copied roles, only hide during active night actions */}
          {stolenRole ? (
            // Robber has stolen - show the stolen role's description crossed out (no action taken)
            <div className="text-xs leading-relaxed space-y-1">
              {ROLE_METADATA[stolenRole].nightActionDescription && (
                <div className="text-gray-500 line-through">
                  <span>As {ROLE_METADATA[stolenRole].displayName}:</span>{' '}
                  {ROLE_METADATA[stolenRole].nightActionDescription}
                </div>
              )}
              <div className="text-yellow-400/80 italic">
                You take no action — the Robber only steals, not performs.
              </div>
            </div>
          ) : copiedRole ? (
            // Doppelganger has copied - show the copied role's description (night action or passive ability)
            (ROLE_METADATA[copiedRole].nightActionDescription || ROLE_METADATA[copiedRole].description) && (
              <div className="text-xs text-gray-400 leading-relaxed">
                <span className="text-purple-400">As {ROLE_METADATA[copiedRole].displayName}:</span>{' '}
                {ROLE_METADATA[copiedRole].nightActionDescription || ROLE_METADATA[copiedRole].description}
              </div>
            )
          ) : !actionContext && (
            // Normal role - show own description only when no active action
            roleMetadata.nightActionDescription && (
              <div className="text-xs text-gray-400 leading-relaxed">
                {roleMetadata.nightActionDescription}
              </div>
            )
          )}

          {/* Current action context (especially for Doppelganger multi-step) */}
          {isNightPhase && actionContext && (
            <div className="text-xs text-gray-400 leading-relaxed">
              <span className="text-purple-400">{actionContext.title}:</span>{' '}
              {actionContext.description}
            </div>
          )}

          {/* Selection feedback during night actions - hide if Doppelganger (initial or copied active role) as it's shown in NightInfoPanel */}
          {isNightPhase && (selectedPlayers.length > 0 || selectedCenterCards.length > 0) &&
           !(gameView.myStartingRole === RoleName.DOPPELGANGER && !copiedRole) &&
           !(copiedRole && [RoleName.SEER, RoleName.ROBBER, RoleName.TROUBLEMAKER, RoleName.DRUNK].includes(copiedRole)) && (
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

          {/* Night Information */}
          {(gameView.myNightInfo.length > 0 ||
            (gameView.myStartingRole === RoleName.DOPPELGANGER && isNightPhase && pendingActionRequest)) && (
            <div className="pt-2 border-t border-gray-700">
              <NightInfoPanel
                compact
                selectedPlayers={selectedPlayers}
                selectedCenterCards={selectedCenterCards}
              />
            </div>
          )}

          {/* Final role - always shown in results, with swap message if changed */}
          {shouldShowFinalRole && (
            <div className="pt-2 border-t border-gray-700">
              <h3 className="text-xs text-gray-400 mb-2 uppercase tracking-wide">
                Final Role
              </h3>
              {/* For Doppelganger who copied a role and wasn't swapped, show the copied role */}
              {gameView.myStartingRole === RoleName.DOPPELGANGER && copiedRole && finalRole === RoleName.DOPPELGANGER ? (
                <RoleCard role={RoleName.DOPPELGANGER} size="sm" copiedRole={copiedRole} />
              ) : (
                <RoleCard role={finalRole as RoleName} size="sm" />
              )}
              {hasFinalRoleChange && (
                <p className="text-xs text-amber-400 mt-1">
                  Your role was swapped during the night!
                </p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
