'use client';

/**
 * @fileoverview Debug information panel for admin testing.
 * @module components/game/DebugInfoPanel
 *
 * @description
 * Displays debug information for admin players when debug mode is enabled.
 * Shows all player roles and center cards to help test specific scenarios.
 */

import { useGameStore } from '@/stores/gameStore';
import { DebugInfo, ROLE_METADATA, RoleName, Team } from '@/types/game';
import { createPlayerNameResolver } from '@/lib/playerUtils';

interface DebugInfoPanelProps {
  debugInfo: DebugInfo;
}

export function DebugInfoPanel({ debugInfo }: DebugInfoPanelProps) {
  const { playerIdMapping, roomState } = useGameStore();
  const getPlayerName = createPlayerNameResolver(playerIdMapping, roomState);

  if (!debugInfo.allPlayerRoles && !debugInfo.centerCards) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 bg-yellow-900/90 border-2 border-yellow-500 rounded-lg p-4 max-w-xs shadow-lg z-50">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-lg">🔧</span>
        <h3 className="text-yellow-400 font-bold">Debug Info</h3>
      </div>

      {/* All Player Roles */}
      {debugInfo.allPlayerRoles && (
        <div className="mb-4">
          <h4 className="text-yellow-300 text-sm font-semibold mb-2">All Player Roles:</h4>
          <div className="space-y-1">
            {Object.entries(debugInfo.allPlayerRoles).map(([playerId, role]) => {
              const meta = ROLE_METADATA[role];
              const teamColor = meta.team === Team.WEREWOLF
                ? 'text-red-400'
                : meta.team === Team.TANNER
                ? 'text-amber-400'
                : 'text-blue-400';

              return (
                <div key={playerId} className="flex justify-between text-sm">
                  <span className="text-gray-300">{getPlayerName(playerId)}</span>
                  <span className={`font-medium ${teamColor}`}>
                    {meta.displayName}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Center Cards */}
      {debugInfo.centerCards && debugInfo.centerCards.length > 0 && (
        <div>
          <h4 className="text-yellow-300 text-sm font-semibold mb-2">Center Cards:</h4>
          <div className="flex gap-2">
            {debugInfo.centerCards.map((role, index) => {
              const meta = ROLE_METADATA[role];
              const teamColor = meta.team === Team.WEREWOLF
                ? 'bg-red-900/50 text-red-300 border-red-600'
                : meta.team === Team.TANNER
                ? 'bg-amber-900/50 text-amber-300 border-amber-600'
                : 'bg-blue-900/50 text-blue-300 border-blue-600';

              return (
                <div
                  key={index}
                  className={`flex-1 text-center p-2 rounded border ${teamColor}`}
                >
                  <div className="text-xs text-gray-400">#{index + 1}</div>
                  <div className="text-xs font-medium">{meta.displayName}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <p className="text-xs text-yellow-500/70 mt-3 italic">
        Debug mode - only visible to admin
      </p>
    </div>
  );
}
