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

import { useMemo } from 'react';
import { useGameStore } from '@/stores/gameStore';
import { ROLE_METADATA, RoleName, TEAM_COLORS } from '@/types/game';
import { createPlayerNameResolver } from '@/lib/playerUtils';
import { cn } from '@/lib/utils';
import { ROLE_ICONS } from './RoleCard';

/** Get the emoji icon for a role */
function getRoleIcon(role: RoleName): string {
  return ROLE_ICONS[role] || '❓';
}

/** Get the team color class for a role */
function getRoleTeamColor(role: RoleName): string {
  const team = ROLE_METADATA[role].team;
  return TEAM_COLORS[team];
}

interface NightInfoPanelProps {
  className?: string;
  compact?: boolean;
  selectedPlayers?: string[];
  selectedCenterCards?: number[];
}

type NightInfoType = NonNullable<ReturnType<typeof useGameStore.getState>['gameView']>['myNightInfo'][number];

export function NightInfoPanel({ className, compact = false, selectedPlayers = [], selectedCenterCards = [] }: NightInfoPanelProps) {
  const { gameView, playerIdMapping, roomState, pendingActionRequest } = useGameStore();
  const getPlayerName = createPlayerNameResolver(playerIdMapping, roomState);

  // Get role emojis from the game's roles (excluding Doppelganger) for Doppelganger display
  const gameRoleEmojis = useMemo(() => {
    const roles = roomState?.config?.roles || [];
    const otherRoles = roles.filter(role => role !== RoleName.DOPPELGANGER);
    const emojis = otherRoles.map(role => ROLE_ICONS[role] || '❓');
    // Shuffle and return at least 5 emojis (repeat if needed)
    const shuffled = shuffleArray(emojis);
    while (shuffled.length < 5) {
      shuffled.push(...shuffleArray(emojis));
    }
    return shuffled.slice(0, 5);
  }, [roomState?.config?.roles]);

  // Random copy emoji for doppelganger target (stable per component mount)
  const doppelgangerCopyEmoji = useMemo(() =>
    gameRoleEmojis[Math.floor(Math.random() * gameRoleEmojis.length)] || '👤',
  [gameRoleEmojis]);

  // Check if Doppelganger is making their initial selection
  const isDoppelganger = gameView?.myStartingRole === RoleName.DOPPELGANGER;
  const resultsWithCopied = gameView?.myNightInfo.filter(info => info.info.copied) || [];
  const copyInfo = resultsWithCopied.length > 0 ? resultsWithCopied[resultsWithCopied.length - 1] : null;
  const isDoppelgangerWaitingToSelect = isDoppelganger && !copyInfo && pendingActionRequest?.actionType === 'selectPlayer';

  if (!gameView || (gameView.myNightInfo.length === 0 && !isDoppelgangerWaitingToSelect)) {
    return null;
  }

  // For Doppelganger, separate the copy info from the follow-up action info
  const otherInfo = gameView.myNightInfo.filter(info => !info.info.copied);

  return (
    <div className={cn('space-y-2', className)}>
      <h3 className={cn(
        'font-semibold text-yellow-400 pb-1 border-b border-yellow-400/30',
        compact ? 'text-xs' : 'text-sm'
      )}>
        What you learned
      </h3>
      <div className="space-y-3">
        {/* For Doppelganger: show initial selection UI */}
        {isDoppelgangerWaitingToSelect && (
          <div className={cn('text-gray-300', compact ? 'text-xs' : 'text-sm')}>
            <p className="text-purple-400 font-medium text-[10px] uppercase tracking-wide mb-1">
              👥 As Doppelganger
            </p>
            <div className="space-y-2 animate-pulse">
              <p className="text-sm font-semibold text-yellow-300 text-center">
                Waiting for selection...
              </p>
              <div className="doppelganger-copy-box-dynamic text-xs text-gray-300 space-y-1 border-2 border-purple-500/70 rounded-md p-2 bg-purple-950/80">
                <span className="doppelganger-sparkle-0">{gameRoleEmojis[0] || '❓'}</span>
                <span className="doppelganger-sparkle-1">{gameRoleEmojis[1] || '❓'}</span>
                <span className="doppelganger-sparkle-2">{gameRoleEmojis[2] || '❓'}</span>
                <span className="doppelganger-sparkle-3">{gameRoleEmojis[3] || '❓'}</span>
                <span className="doppelganger-sparkle-4">{gameRoleEmojis[4] || '❓'}</span>
                <div className="text-center flex items-center justify-center gap-2">
                  <span className="text-lg">👤</span>
                  <span>Click a player to copy their role</span>
                </div>
                <p className="text-purple-300/70 text-[10px] text-center">
                  You become whatever they are
                </p>
                <div className="mt-2 pt-2 border-t border-purple-600/50">
                  <p className="text-purple-400 text-[10px] uppercase tracking-wide mb-1 text-center">Target</p>
                  {selectedPlayers.length > 0 ? (
                    <div className="text-center text-purple-200 flex items-center justify-center gap-2">
                      <span className="text-lg">{doppelgangerCopyEmoji}</span>
                      <span>{getPlayerName(selectedPlayers[0])}</span>
                    </div>
                  ) : (
                    <div className="text-center text-gray-500 flex items-center justify-center">
                      <span className="text-lg opacity-40">❓</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
        {/* For Doppelganger: show copied role first */}
        {copyInfo && (
          <div className={cn(
            'text-gray-300',
            compact ? 'text-xs' : 'text-sm'
          )}>
            <p className="text-purple-400 font-medium text-[10px] uppercase tracking-wide mb-1">
              👥 As Doppelganger
            </p>
            <p className="flex items-start gap-1.5">
              <span className="text-gray-500">•</span>
              <span>
                <span className="text-gray-400">Saw </span>
                <span className="text-white">{getPlayerName(copyInfo.info.copied!.fromPlayerId)}</span>
                <span className="text-gray-400">&apos;s card is </span>
                <span className={cn('font-medium', getRoleTeamColor(copyInfo.info.copied!.role))}>
                  {ROLE_METADATA[copyInfo.info.copied!.role].displayName}
                </span>
              </span>
            </p>
            <p className="flex items-start gap-1.5 mt-1">
              <span className="text-gray-500">•</span>
              <span className="flex flex-col">
                <span className="text-gray-400">Your role changed:</span>
                <span className="ml-2">
                  <span className="text-purple-400">Doppelganger</span>
                  <span className="text-gray-400"> → </span>
                  <span className={cn('font-medium', getRoleTeamColor(copyInfo.info.copied!.role))}>
                    {ROLE_METADATA[copyInfo.info.copied!.role].displayName}
                  </span>
                </span>
              </span>
            </p>
          </div>
        )}
        {/* Show copied role action section */}
        {copyInfo && (
          <CopiedRoleActionSection
            copyInfo={copyInfo}
            compact={compact}
            selectedPlayers={selectedPlayers}
            selectedCenterCards={selectedCenterCards}
            getPlayerName={getPlayerName}
          />
        )}
        {/* Remaining info from copied role's action or other roles */}
        {otherInfo.map((info, idx) => {
          // For Doppelganger, check if this is a result from their copied role's action
          // (roleName would be DOPPELGANGER but it's actually the copied role acting)
          const isDoppelgangerCopiedAction = isDoppelganger && copyInfo && info.roleName === RoleName.DOPPELGANGER;
          const effectiveActingRole = isDoppelgangerCopiedAction ? copyInfo.info.copied!.role : info.roleName;
          const textSize = compact ? 'text-xs' : 'text-sm';

          // Show header for Doppelganger's copied role actions that have results
          const hasViewedResults = info.info.viewed && info.info.viewed.length > 0;
          const needsHeader = isDoppelgangerCopiedAction && hasViewedResults;

          return needsHeader ? (
            <div key={idx} className={cn('text-gray-300', textSize)}>
              <p className={cn('font-medium text-[10px] uppercase tracking-wide mb-1', getRoleTeamColor(effectiveActingRole))}>
                {getRoleIcon(effectiveActingRole)} As {ROLE_METADATA[effectiveActingRole].displayName}
              </p>
              <NightInfoItem
                info={info}
                compact={compact}
                actingRole={effectiveActingRole}
              />
            </div>
          ) : (
            <NightInfoItem
              key={idx}
              info={info}
              compact={compact}
              actingRole={effectiveActingRole}
            />
          );
        })}
      </div>
    </div>
  );
}

/** Roles that require the player to make a selection */
const ACTIVE_ACTION_ROLES = [
  RoleName.SEER,
  RoleName.ROBBER,
  RoleName.TROUBLEMAKER,
  RoleName.DRUNK,
];

interface CopiedRoleActionSectionProps {
  copyInfo: NightInfoType;
  compact?: boolean;
  selectedPlayers?: string[];
  selectedCenterCards?: number[];
  getPlayerName: (id: string) => string;
}

const ROBBER_LOOT_EMOJIS = ['💰', '💎', '🔦', '🔓', '👑'];
const SEER_MAGIC_EMOJIS = ['🔮', '✨', '⭐', '🌟', '💫'];
const TROUBLEMAKER_CHAOS_EMOJIS = ['🎭', '🔀', '🃏', '🌀', '🎪'];
const DRUNK_TIPSY_EMOJIS = ['🍻', '🍷', '🍾', '🥴', '🥂'];

/** Shuffle array using Fisher-Yates algorithm */
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function CopiedRoleActionSection({ copyInfo, compact, selectedPlayers = [], selectedCenterCards = [], getPlayerName }: CopiedRoleActionSectionProps) {
  const copiedRole = copyInfo.info.copied!.role;
  const hasResults = copyInfo.info.werewolves !== undefined ||
                     copyInfo.info.masons !== undefined ||
                     copyInfo.info.viewed ||
                     copyInfo.info.swapped;

  const requiresAction = ACTIVE_ACTION_ROLES.includes(copiedRole);
  const textSize = compact ? 'text-xs' : 'text-sm';

  // Random loot emoji for robber target (stable per component mount)
  const robberLootEmoji = useMemo(() =>
    ROBBER_LOOT_EMOJIS[Math.floor(Math.random() * ROBBER_LOOT_EMOJIS.length)],
  []);

  // Random magic emoji for seer target (stable per component mount)
  const seerMagicEmoji = useMemo(() =>
    SEER_MAGIC_EMOJIS[Math.floor(Math.random() * SEER_MAGIC_EMOJIS.length)],
  []);

  // Random chaos emoji for troublemaker targets (stable per component mount)
  const troublemakerChaosEmoji = useMemo(() =>
    TROUBLEMAKER_CHAOS_EMOJIS[Math.floor(Math.random() * TROUBLEMAKER_CHAOS_EMOJIS.length)],
  []);

  // Random tipsy emoji for drunk target (stable per component mount)
  const drunkTipsyEmoji = useMemo(() =>
    DRUNK_TIPSY_EMOJIS[Math.floor(Math.random() * DRUNK_TIPSY_EMOJIS.length)],
  []);

  // Don't show section if role doesn't require action and has no results
  if (!requiresAction && !hasResults) {
    return null;
  }

  // For roles with passive results (Werewolf, Minion, Mason), only show when results exist
  if (!requiresAction && hasResults) {
    return (
      <div className={cn('text-gray-300', textSize)}>
        <p className={cn('font-medium text-[10px] uppercase tracking-wide mb-1', getRoleTeamColor(copiedRole))}>
          {getRoleIcon(copiedRole)} As {ROLE_METADATA[copiedRole].displayName}
        </p>
        <NightInfoItem
          info={copyInfo}
          compact={compact}
          actingRole={copiedRole}
        />
      </div>
    );
  }

  // For active roles with results, show same format as passive roles
  if (hasResults) {
    return (
      <div className={cn('text-gray-300', textSize)}>
        <p className={cn('font-medium text-[10px] uppercase tracking-wide mb-1', getRoleTeamColor(copiedRole))}>
          {getRoleIcon(copiedRole)} As {ROLE_METADATA[copiedRole].displayName}
        </p>
        <NightInfoItem
          info={copyInfo}
          compact={compact}
          actingRole={copiedRole}
        />
      </div>
    );
  }

  // For active roles waiting for selection, show header + waiting UI
  return (
    <div className="space-y-2">
      <h3 className={cn(
        'font-semibold text-yellow-400 pb-1 border-b border-yellow-400/30',
        compact ? 'text-xs' : 'text-sm'
      )}>
        Your action
      </h3>
      <div className={cn('text-gray-300', textSize)}>
        <p className={cn('font-medium text-[10px] uppercase tracking-wide mb-1', getRoleTeamColor(copiedRole))}>
          {getRoleIcon(copiedRole)} As {ROLE_METADATA[copiedRole].displayName}
        </p>
          <div className="space-y-2 animate-pulse">
            <p className="text-sm font-semibold text-yellow-300 text-center">
              Waiting for selection...
            </p>
            {copiedRole === RoleName.SEER ? (
              <div className="seer-magic-box text-xs text-gray-300 space-y-1 border-2 border-purple-400/70 rounded-md p-2 bg-purple-900/50">
                <span className="seer-sparkle-1">🔮</span>
                <span className="seer-sparkle-2">✨</span>
                <span className="seer-sparkle-3">⭐</span>
                <div className="text-center flex items-center justify-center gap-2">
                  <span className="text-lg">👤</span>
                  <span>Click a player to see their card</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="flex-1 border-t border-purple-400/50" />
                  <span className="text-purple-300">or</span>
                  <span className="flex-1 border-t border-purple-400/50" />
                </div>
                <div className="text-center flex items-center justify-center gap-2">
                  <span className="text-lg">🎴🎴</span>
                  <span>Click two center cards</span>
                </div>
                <div className="mt-2 pt-2 border-t border-purple-400/30">
                  <p className="text-purple-300 text-[10px] uppercase tracking-wide mb-1 text-center">Selected</p>
                  {selectedPlayers.length > 0 ? (
                    <div className="text-center text-purple-200 flex items-center justify-center gap-2">
                      <span className="text-lg">{seerMagicEmoji}</span>
                      <span>{getPlayerName(selectedPlayers[0])}</span>
                    </div>
                  ) : selectedCenterCards.length > 0 ? (
                    <div className="text-center text-purple-200 flex items-center justify-center gap-2">
                      <span className="text-lg">🎴</span>
                      <span>Center {selectedCenterCards.map(i => i + 1).join(' & ')}</span>
                    </div>
                  ) : (
                    <div className="text-center text-purple-400/60 flex items-center justify-center">
                      <span className="text-lg opacity-40">❓</span>
                    </div>
                  )}
                </div>
              </div>
            ) : copiedRole === RoleName.ROBBER ? (
              <div className="robber-stealth-box text-xs text-gray-300 space-y-1 border-2 border-gray-500/70 rounded-md p-2 bg-gray-950/95">
                <span className="robber-sparkle-1">🔦</span>
                <span className="robber-sparkle-2">🔓</span>
                <span className="robber-sparkle-3">👑</span>
                <div className="text-center flex items-center justify-center gap-2">
                  <span className="text-lg">👤</span>
                  <span>Click a player to steal their role</span>
                </div>
                <p className="text-gray-400 text-[10px] text-center">
                  Swap cards and see what you stole
                </p>
                <div className="mt-2 pt-2 border-t border-gray-600/50">
                  <p className="text-amber-400 text-[10px] uppercase tracking-wide mb-1 text-center">Target</p>
                  {selectedPlayers.length > 0 ? (
                    <div className="text-center text-amber-300 flex items-center justify-center gap-2">
                      <span className="text-lg">{robberLootEmoji}</span>
                      <span>{getPlayerName(selectedPlayers[0])}</span>
                    </div>
                  ) : (
                    <div className="text-center text-gray-500 flex items-center justify-center">
                      <span className="text-lg opacity-40">❓</span>
                    </div>
                  )}
                </div>
              </div>
            ) : copiedRole === RoleName.TROUBLEMAKER ? (
              <div className="troublemaker-chaos-box text-xs text-gray-300 space-y-1 border-2 border-pink-500/70 rounded-md p-2 bg-pink-950/80">
                <span className="troublemaker-sparkle-1">🃏</span>
                <span className="troublemaker-sparkle-2">🌀</span>
                <span className="troublemaker-sparkle-3">🎪</span>
                <div className="text-center flex items-center justify-center gap-2">
                  <span className="text-lg">👤👤</span>
                  <span>Click two players to swap</span>
                </div>
                <p className="text-pink-300/70 text-[10px] text-center">
                  They won&apos;t know their cards changed
                </p>
                <div className="mt-2 pt-2 border-t border-pink-600/50">
                  <p className="text-orange-400 text-[10px] uppercase tracking-wide mb-1 text-center">Targets</p>
                  {selectedPlayers.length > 0 ? (
                    <div className="text-center text-orange-300 flex items-center justify-center gap-2">
                      <span className="text-lg">{troublemakerChaosEmoji}</span>
                      <span>{selectedPlayers.map(id => getPlayerName(id)).join(' ↔ ')}</span>
                    </div>
                  ) : (
                    <div className="text-center text-gray-500 flex items-center justify-center">
                      <span className="text-lg opacity-40">❓ ↔ ❓</span>
                    </div>
                  )}
                </div>
              </div>
            ) : copiedRole === RoleName.DRUNK ? (
              <div className="drunk-tipsy-box text-xs text-gray-300 space-y-1 border-2 border-amber-500/70 rounded-md p-2 bg-amber-950/80">
                <span className="drunk-sparkle-1">🍾</span>
                <span className="drunk-sparkle-2">🥴</span>
                <span className="drunk-sparkle-3">🥂</span>
                <div className="text-center flex items-center justify-center gap-2">
                  <span className="text-lg">🎴</span>
                  <span>Click a center card to swap</span>
                </div>
                <p className="text-amber-300/70 text-[10px] text-center">
                  You won&apos;t see your new role
                </p>
                <div className="mt-2 pt-2 border-t border-amber-600/50">
                  <p className="text-amber-400 text-[10px] uppercase tracking-wide mb-1 text-center">Target</p>
                  {selectedCenterCards.length > 0 ? (
                    <div className="text-center text-amber-300 flex items-center justify-center gap-2">
                      <span className="text-lg">{drunkTipsyEmoji}</span>
                      <span>Center {selectedCenterCards[0] + 1}</span>
                    </div>
                  ) : (
                    <div className="text-center text-gray-500 flex items-center justify-center">
                      <span className="text-lg opacity-40">❓</span>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-xs text-gray-400">
                {ROLE_METADATA[copiedRole].nightActionDescription}
              </p>
            )}
          </div>
      </div>
    </div>
  );
}

interface NightInfoItemProps {
  info: NightInfoType;
  compact?: boolean;
  /** The role that performed this action (for context-aware messages) */
  actingRole?: RoleName;
}

function NightInfoItem({ info, compact, actingRole }: NightInfoItemProps) {
  const { gameView, playerIdMapping, roomState } = useGameStore();
  const getPlayerName = createPlayerNameResolver(playerIdMapping, roomState);
  const { info: actionInfo } = info;
  const myPlayerId = gameView?.myPlayerId;

  // Determine if this is a Minion viewing werewolves (vs a Werewolf viewing teammates)
  const isMinion = actingRole === RoleName.MINION;

  const textSize = compact ? 'text-xs' : 'text-sm';

  return (
    <div className={cn('text-gray-300 space-y-1', textSize)}>
      {/* Werewolves seen - different messages for Werewolf vs Minion */}
      {actionInfo.werewolves !== undefined && (
        actionInfo.werewolves.length > 0 ? (
          isMinion ? (
            // Minion sees werewolves (but they don't know who Minion is)
            <>
              <p className="flex items-start gap-1.5">
                <span className="text-gray-500">•</span>
                <span className="text-gray-400">Looked up and saw the werewolves</span>
              </p>
              <div className="flex items-start gap-1.5">
                <span className="text-gray-500">•</span>
                <div className="flex flex-col">
                  <span className="text-gray-400">The werewolves are:</span>
                  {actionInfo.werewolves.map((id, idx) => (
                    <span key={idx} className="text-red-400 font-medium ml-2">{getPlayerName(id)}</span>
                  ))}
                </div>
              </div>
              <span className="text-gray-400 italic ml-2">They don&apos;t know you exist</span>
            </>
          ) : (
            // Werewolf sees teammates
            <>
              <p className="flex items-start gap-1.5">
                <span className="text-gray-500">•</span>
                <span className="text-gray-400">Looked up and saw other werewolves</span>
              </p>
              <div className="flex items-start gap-1.5">
                <span className="text-gray-500">•</span>
                <div className="flex flex-col">
                  <span className="text-gray-400">Your teammates are:</span>
                  {actionInfo.werewolves.map((id, idx) => (
                    <span key={idx} className="text-red-400 font-medium ml-2">{getPlayerName(id)}</span>
                  ))}
                </div>
              </div>
            </>
          )
        ) : (
          isMinion ? (
            // Minion sees no werewolves
            <p className="flex items-start gap-1.5">
              <span className="text-gray-500">•</span>
              <span>
                <span className="text-gray-400">Looked up and saw </span>
                <span className="text-red-400 font-medium">no werewolves</span>
                <span className="text-gray-400"> — they&apos;re all in the center</span>
              </span>
            </p>
          ) : (
            // Werewolf is lone wolf
            <p className="flex items-start gap-1.5">
              <span className="text-gray-500">•</span>
              <span>
                <span className="text-gray-400">Looked up and saw </span>
                <span className="text-red-400 font-medium">no other werewolves</span>
                <span className="text-gray-400"> — you are the lone wolf</span>
              </span>
            </p>
          )
        )
      )}

      {/* Masons seen */}
      {actionInfo.masons !== undefined && (
        actionInfo.masons.length > 0 ? (
          <div className="flex items-start gap-1.5">
            <span className="text-gray-500">•</span>
            <div className="flex flex-col">
              <span className="text-gray-400">Fellow Masons:</span>
              {actionInfo.masons.map((id, idx) => (
                <span key={idx} className="text-blue-400 font-medium ml-2">{getPlayerName(id)}</span>
              ))}
            </div>
          </div>
        ) : (
          <p className="flex items-start gap-1.5">
            <span className="text-gray-500">•</span>
            <span>
              <span className="text-blue-400 font-medium">Lone mason</span>
              <span className="text-gray-400"> — no other masons</span>
            </span>
          </p>
        )
      )}

      {/* Swap info - shown BEFORE viewed cards (steal first, then see what you got) */}
      {actionInfo.swapped && (() => {
        const fromId = actionInfo.swapped.from.playerId;
        const toId = actionInfo.swapped.to.playerId;
        const fromRoomId = fromId ? (playerIdMapping[fromId] ?? fromId) : null;
        const toRoomId = toId ? (playerIdMapping[toId] ?? toId) : null;
        const isSelfInvolved = fromRoomId === myPlayerId || toRoomId === myPlayerId;
        const isPlayerSwap = fromId && toId;
        const isCenterSwap = !fromId || !toId;

        // Determine swap type: Robber (self ↔ other), Troublemaker (other ↔ other), Drunk (self ↔ center)
        const swapMessage = isCenterSwap
          ? "Swapped your card with a center card"
          : isSelfInvolved
            ? "Stole role from another player"
            : "Swapped two other players' cards";

        // For Robber, only show the target (not self). Drunk and Troublemaker show both.
        const showBothPlayers = isCenterSwap || !isSelfInvolved;
        const targetId = isSelfInvolved && isPlayerSwap
          ? (fromRoomId === myPlayerId ? toId : fromId)
          : null;

        return (
          <div className="space-y-1">
            <p className="flex items-start gap-1.5">
              <span className="text-gray-500">•</span>
              <span className="text-gray-400">{swapMessage}</span>
            </p>
            <p className="flex items-start gap-1.5 ml-4">
              {showBothPlayers ? (
                <>
                  <span className="text-white">
                    {fromId ? getPlayerName(fromId) : `Center ${(actionInfo.swapped.from.centerIndex ?? 0) + 1}`}
                  </span>
                  <span className="text-gray-400">↔</span>
                  <span className="text-white">
                    {toId ? getPlayerName(toId) : `Center ${(actionInfo.swapped.to.centerIndex ?? 0) + 1}`}
                  </span>
                </>
              ) : (
                <span className="text-white">{targetId ? getPlayerName(targetId) : '???'}</span>
              )}
            </p>
          </div>
        );
      })()}

      {/* Viewed cards - shown AFTER swap info */}
      {actionInfo.viewed && actionInfo.viewed.length > 0 && (
        <div className="space-y-1">
          {actionInfo.viewed.map((view, i) => {
            const viewRoomPlayerId = view.playerId ? (playerIdMapping[view.playerId] ?? view.playerId) : null;
            const isSelfView = viewRoomPlayerId && viewRoomPlayerId === myPlayerId;
            // Robber views their own card after swapping (role changed)
            const isRobberSelfView = isSelfView && actingRole === RoleName.ROBBER;
            // Insomniac (or any other self-view that's not Robber) wakes up to check their card
            const isInsomniacSelfView = isSelfView && !isRobberSelfView;

            return isRobberSelfView ? (
              // Robber's new card - show in "role changed" format
              <div key={i} className="flex items-start gap-1.5">
                <span className="text-gray-500">•</span>
                <span className="flex flex-col">
                  <span className="text-gray-400">Your role changed:</span>
                  <span className="ml-2">
                    <span className={cn('font-medium', getRoleTeamColor(RoleName.ROBBER))}>
                      {ROLE_METADATA[RoleName.ROBBER].displayName}
                    </span>
                    <span className="text-gray-400"> → </span>
                    <span className={cn('font-medium', getRoleTeamColor(view.role))}>
                      {ROLE_METADATA[view.role].displayName}
                    </span>
                  </span>
                </span>
              </div>
            ) : isInsomniacSelfView ? (
              // Insomniac waking up to check their card at end of night
              <div key={i} className="flex items-start gap-1.5">
                <span className="text-gray-500">•</span>
                <span className="flex flex-col">
                  <span className="text-gray-400">Woke up as:</span>
                  <span className={cn('font-medium ml-2', getRoleTeamColor(view.role))}>
                    {ROLE_METADATA[view.role].displayName}
                  </span>
                </span>
              </div>
            ) : (
              // Other views (Seer looking at players/center)
              <p key={i} className="flex items-start gap-1.5">
                <span className="text-gray-500">•</span>
                <span>
                  {view.playerId ? (
                    <>
                      <span className="text-white">{getPlayerName(view.playerId)}</span>
                      <span className="text-gray-400">&apos;s card: </span>
                    </>
                  ) : (
                    <span className="text-gray-400">Center {(view.centerIndex ?? 0) + 1}: </span>
                  )}
                  <span className={cn('font-medium', getRoleTeamColor(view.role))}>
                    {ROLE_METADATA[view.role].displayName}
                  </span>
                </span>
              </p>
            );
          })}
        </div>
      )}

      {/* Copied role - now shown separately at top of panel for Doppelganger */}
    </div>
  );
}
