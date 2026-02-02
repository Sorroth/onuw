'use client';

/**
 * @fileoverview Night information panel component.
 * @module components/game/NightInfoPanel
 *
 * @description
 * Displays what the player learned during the night phase.
 * Used in the sidebar across all phases to show persistent night info.
 *
 * @pattern Observer Pattern - Subscribes to game store for night info
 */

import { useGameStore } from '@/stores/gameStore';
import { ROLE_METADATA } from '@/types/game';
import { createPlayerNameResolver } from '@/lib/playerUtils';
import { cn } from '@/lib/utils';

interface NightInfoPanelProps {
  className?: string;
  compact?: boolean;
}

type NightInfoType = NonNullable<ReturnType<typeof useGameStore.getState>['gameView']>['myNightInfo'][number];

export function NightInfoPanel({ className, compact = false }: NightInfoPanelProps) {
  const { gameView, playerIdMapping, roomState } = useGameStore();
  const getPlayerName = createPlayerNameResolver(playerIdMapping, roomState);

  if (!gameView || gameView.myNightInfo.length === 0) {
    return null;
  }

  // For Doppelganger, separate the copy info from the follow-up action info
  const copyInfo = gameView.myNightInfo.find(info => info.info.copied);
  const otherInfo = gameView.myNightInfo.filter(info => !info.info.copied);

  return (
    <div className={cn('space-y-3', className)}>
      <h3 className={cn(
        'font-semibold text-yellow-400',
        compact ? 'text-xs' : 'text-sm'
      )}>
        What you learned
      </h3>
      <div className="space-y-2">
        {/* For Doppelganger: show copied role first as a header */}
        {copyInfo && (
          <div className={cn(
            'text-gray-300 pb-2 border-b border-gray-700',
            compact ? 'text-xs' : 'text-sm'
          )}>
            <p>
              <span className="text-purple-400 font-medium">Copied </span>
              <span className="text-white">{getPlayerName(copyInfo.info.copied!.fromPlayerId)}</span>
              <span className="text-gray-400">&apos;s role: </span>
              <span className="text-yellow-400 font-medium">
                {ROLE_METADATA[copyInfo.info.copied!.role].displayName}
              </span>
            </p>
          </div>
        )}
        {/* Remaining info from copied role's action or other roles */}
        {otherInfo.map((info, idx) => (
          <NightInfoItem
            key={idx}
            info={info}
            compact={compact}
          />
        ))}
      </div>
    </div>
  );
}

interface NightInfoItemProps {
  info: NightInfoType;
  compact?: boolean;
}

function NightInfoItem({ info, compact }: NightInfoItemProps) {
  const { gameView, playerIdMapping, roomState } = useGameStore();
  const getPlayerName = createPlayerNameResolver(playerIdMapping, roomState);
  const { info: actionInfo } = info;
  const myPlayerId = gameView?.myPlayerId;

  const textSize = compact ? 'text-xs' : 'text-sm';

  return (
    <div className={cn('text-gray-300 space-y-1', textSize)}>
      {/* Werewolves seen */}
      {actionInfo.werewolves && actionInfo.werewolves.length > 0 && (
        <p>
          <span className="text-gray-400">Werewolves:</span>{' '}
          <span className="text-red-400 font-medium">
            {actionInfo.werewolves.map(getPlayerName).join(', ')}
          </span>
        </p>
      )}

      {/* Masons seen */}
      {actionInfo.masons && actionInfo.masons.length > 0 && (
        <p>
          <span className="text-gray-400">Masons:</span>{' '}
          <span className="text-blue-400 font-medium">
            {actionInfo.masons.map(getPlayerName).join(', ')}
          </span>
        </p>
      )}

      {/* Viewed cards */}
      {actionInfo.viewed && actionInfo.viewed.length > 0 && (
        <div className="space-y-0.5">
          {actionInfo.viewed.map((view, i) => {
            const viewRoomPlayerId = view.playerId ? (playerIdMapping[view.playerId] ?? view.playerId) : null;
            const isSelfView = viewRoomPlayerId && viewRoomPlayerId === myPlayerId;

            return (
              <p key={i}>
                {isSelfView ? (
                  <span className="text-gray-400">Your final card: </span>
                ) : view.playerId ? (
                  <>
                    <span className="text-white">{getPlayerName(view.playerId)}</span>
                    <span className="text-gray-400"> is </span>
                  </>
                ) : (
                  <span className="text-gray-400">Center {(view.centerIndex ?? 0) + 1}: </span>
                )}
                <span className="text-yellow-400 font-medium">
                  {ROLE_METADATA[view.role].displayName}
                </span>
              </p>
            );
          })}
        </div>
      )}

      {/* Swap info */}
      {actionInfo.swapped && (
        <p>
          <span className="text-gray-400">Swapped: </span>
          <span className="text-white">
            {actionInfo.swapped.from.playerId
              ? getPlayerName(actionInfo.swapped.from.playerId)
              : `Center ${(actionInfo.swapped.from.centerIndex ?? 0) + 1}`}
          </span>
          <span className="text-gray-400"> ↔ </span>
          <span className="text-white">
            {actionInfo.swapped.to.playerId
              ? getPlayerName(actionInfo.swapped.to.playerId)
              : `Center ${(actionInfo.swapped.to.centerIndex ?? 0) + 1}`}
          </span>
        </p>
      )}

      {/* Copied role - now shown separately at top of panel for Doppelganger */}
    </div>
  );
}
