'use client';

/**
 * @fileoverview Game lobby view component.
 * @module components/game/LobbyView
 *
 * @description
 * Displays the pre-game lobby with player list, roles, and ready state.
 * Allows host to add AI players, configure roles, and start the game.
 *
 * @pattern Observer Pattern - Subscribes to game store for room state
 * @pattern Composite Pattern - Composes player list and role display
 */

import { useState, useCallback } from 'react';
import { useGameStore } from '@/stores/gameStore';
import { useDebugStore } from '@/stores/debugStore';
import { DEBUG_PRESETS, DebugPreset } from '@/lib/debugPresets';
import { Button, Card, CardContent, CardHeader, CardTitle } from '@/components/ui';
import { RoleSelector } from '@/components/lobby';
import { RoleName, ROLE_METADATA, Team } from '@/types/game';
import { cn } from '@/lib/utils';

/** Debug mode default roles: all unique roles, no villagers (13 roles for 10 players + 3 center) */
const DEBUG_ROLES: RoleName[] = [
  RoleName.WEREWOLF,
  RoleName.WEREWOLF,
  RoleName.MINION,
  RoleName.DOPPELGANGER,
  RoleName.MASON,
  RoleName.MASON,
  RoleName.SEER,
  RoleName.ROBBER,
  RoleName.TROUBLEMAKER,
  RoleName.DRUNK,
  RoleName.INSOMNIAC,
  RoleName.HUNTER,
  RoleName.TANNER
];

interface LobbyViewProps {
  onLeave: () => void;
}

export function LobbyView({ onLeave }: LobbyViewProps) {
  const {
    roomState,
    playerId,
    setReady,
    addAI,
    kickPlayer,
    startGame,
    updateRoomConfig,
    isAdmin
  } = useGameStore();

  const {
    debugMode,
    debugForceRole,
    debugRevealAllRoles,
    debugForceHostElimination,
    debugShowCenterCards,
    debugDisableTimers,
    debugShowPositionLines,
    debugForceWerewolvesToCenter,
    setDebugMode,
    setDebugForceRole,
    setDebugRevealAllRoles,
    setDebugForceHostElimination,
    setDebugShowCenterCards,
    setDebugDisableTimers,
    setDebugShowPositionLines,
    setDebugForceWerewolvesToCenter
  } = useDebugStore();

  const [showRoleSelector, setShowRoleSelector] = useState(false);
  const [isConfigValid, setIsConfigValid] = useState(true);

  const handleConfigChange = useCallback((playerCount: number, roles: RoleName[]) => {
    updateRoomConfig({
      minPlayers: Math.min(3, playerCount),
      maxPlayers: playerCount,
      roles
    });
  }, [updateRoomConfig]);

  if (!roomState) return null;

  const isHost = roomState.hostId === playerId;
  const currentPlayer = roomState.players.find(p => p.id === playerId);
  const allReady = roomState.players.every(p => p.isReady || p.isHost);
  const requiredRoles = roomState.config.maxPlayers + 3;
  const hasCorrectRoles = roomState.config.roles.length === requiredRoles;
  const canStart = isHost && roomState.players.length >= roomState.config.minPlayers && allReady && hasCorrectRoles;

  const handleToggleReady = () => {
    if (currentPlayer) {
      setReady(!currentPlayer.isReady);
    }
  };

  /** Enables debug mode with auto-configuration: 10 players, 9 AIs, all unique roles */
  const handleEnableDebugMode = (enabled: boolean) => {
    setDebugMode(enabled);

    if (enabled && roomState) {
      // Set up 10-player configuration with debug roles
      updateRoomConfig({
        minPlayers: 3,
        maxPlayers: 10,
        roles: DEBUG_ROLES
      });

      // Add AI players to fill up to 10 (we have 1 host, need 9 more)
      const currentPlayerCount = roomState.players.length;
      const aiToAdd = 10 - currentPlayerCount;

      // Add AIs with a small delay between each to avoid race conditions
      for (let i = 0; i < aiToAdd; i++) {
        setTimeout(() => addAI(), i * 100);
      }
    }
  };

  /** Apply a debug preset to quickly configure common test scenarios */
  const handleApplyPreset = (preset: DebugPreset) => {
    const { options } = preset;
    if (options.forceRole !== undefined) setDebugForceRole(options.forceRole ?? null);
    if (options.revealAllRoles !== undefined) setDebugRevealAllRoles(options.revealAllRoles);
    if (options.forceHostElimination !== undefined) setDebugForceHostElimination(options.forceHostElimination);
    if (options.showCenterCards !== undefined) setDebugShowCenterCards(options.showCenterCards);
    if (options.disableTimers !== undefined) setDebugDisableTimers(options.disableTimers);
  };

  return (
    <div className="max-w-2xl mx-auto">
      {/* Room Header */}
      <div className="text-center mb-6">
        <h1 className="text-3xl font-bold text-white mb-2">Room {roomState.roomCode}</h1>
        <p className="text-gray-400">
          {roomState.players.length}/{roomState.config.maxPlayers} players
        </p>
      </div>

      {/* Players List */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Players</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {roomState.players.map((player) => (
              <div
                key={player.id}
                className={cn(
                  'flex items-center justify-between p-3 rounded-lg',
                  player.id === playerId ? 'bg-blue-900/30' : 'bg-gray-700/50'
                )}
              >
                <div className="flex items-center gap-3">
                  {/* Connection indicator */}
                  <div
                    className={cn(
                      'w-2 h-2 rounded-full',
                      player.isConnected ? 'bg-green-500' : 'bg-red-500'
                    )}
                  />
                  {/* Name */}
                  <span className="text-white font-medium">
                    {player.name}
                    {player.isHost && (
                      <span className="ml-2 text-xs text-yellow-500">(Host)</span>
                    )}
                    {player.isAI && (
                      <span className="ml-2 text-xs text-purple-400">(AI)</span>
                    )}
                    {player.id === playerId && (
                      <span className="ml-2 text-xs text-blue-400">(You)</span>
                    )}
                  </span>
                </div>
                {/* Ready status and kick button */}
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      'text-sm px-2 py-1 rounded',
                      player.isReady || player.isHost
                        ? 'bg-green-900/50 text-green-400'
                        : 'bg-gray-600/50 text-gray-400'
                    )}
                  >
                    {player.isHost ? 'Host' : player.isReady ? 'Ready' : 'Not Ready'}
                  </span>
                  {/* Kick button - only for host, not for self */}
                  {isHost && !player.isHost && (
                    <button
                      onClick={() => kickPlayer(player.id)}
                      className="w-6 h-6 rounded flex items-center justify-center text-gray-400 hover:text-red-400 hover:bg-red-900/30 transition-colors"
                      title={`Remove ${player.name}`}
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Add AI button (host only) */}
          {isHost && roomState.players.length < roomState.config.maxPlayers && (
            <Button
              onClick={addAI}
              variant="ghost"
              className="w-full mt-4"
            >
              + Add AI Player
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Role Selector (Host only) */}
      {isHost && showRoleSelector && (
        <div className="mb-6">
          <RoleSelector
            initialPlayerCount={roomState.config.maxPlayers}
            initialRoles={[...roomState.config.roles]}
            onConfigChange={handleConfigChange}
            minPlayerCount={roomState.players.length}
            onValidityChange={setIsConfigValid}
          />
          <Button
            onClick={() => setShowRoleSelector(false)}
            variant={isConfigValid ? 'primary' : 'ghost'}
            disabled={!isConfigValid}
            className="w-full mt-2"
          >
            {isConfigValid ? 'Done Configuring' : 'Fix role count to continue'}
          </Button>
        </div>
      )}

      {/* Roles in Game - hidden when configuring to avoid duplication */}
      {!showRoleSelector && (
      <Card className="mb-6">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Roles in Game</CardTitle>
          {isHost && (
            <Button
              onClick={() => setShowRoleSelector(true)}
              variant="ghost"
              size="sm"
            >
              Configure
            </Button>
          )}
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {roomState.config.roles.map((role, index) => {
              const meta = ROLE_METADATA[role];
              return (
                <span
                  key={`${role}-${index}`}
                  className={cn(
                    'px-3 py-1 rounded-full text-sm font-medium',
                    meta.team === Team.WEREWOLF
                      ? 'bg-red-900/50 text-red-300'
                      : meta.team === Team.TANNER
                      ? 'bg-amber-900/50 text-amber-300'
                      : 'bg-blue-900/50 text-blue-300'
                  )}
                >
                  {meta.displayName}
                </span>
              );
            })}
          </div>
          {!hasCorrectRoles && (
            <p className="text-yellow-400 text-sm mt-2">
              Need {requiredRoles} roles for {roomState.config.maxPlayers} players ({roomState.config.roles.length} selected)
            </p>
          )}
        </CardContent>
      </Card>
      )}

      {/* Debug Mode (Admin only, Host only) */}
      {isAdmin && isHost && (
        <Card className="mb-6 border-yellow-600/50">
          <CardHeader>
            <CardTitle className="text-yellow-400 flex items-center gap-2">
              <span className="text-lg">🔧</span>
              Debug Mode
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Debug mode toggle */}
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={debugMode}
                  onChange={(e) => handleEnableDebugMode(e.target.checked)}
                  className="w-5 h-5 rounded border-gray-500 bg-gray-700 text-yellow-500 focus:ring-yellow-500"
                />
                <div>
                  <span className="text-gray-300">Enable debug mode</span>
                  <p className="text-xs text-gray-500">Auto-configures 10 players with all unique roles + 9 AIs</p>
                </div>
              </label>

              {/* Debug options when enabled */}
              {debugMode && (
                <div className="ml-8 space-y-4 border-l-2 border-yellow-600/30 pl-4">
                  {/* Quick presets */}
                  <div>
                    <label className="block text-sm text-gray-400 mb-2">
                      Quick presets:
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {DEBUG_PRESETS.map((preset) => (
                        <button
                          key={preset.id}
                          onClick={() => handleApplyPreset(preset)}
                          className="px-3 py-1.5 text-xs bg-yellow-900/30 hover:bg-yellow-800/40 border border-yellow-600/40 hover:border-yellow-500/60 rounded-lg text-yellow-300 transition-colors"
                          title={preset.description}
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Divider */}
                  <div className="border-t border-gray-700 pt-4">
                    <p className="text-xs text-gray-500 mb-3">Or customize individually:</p>
                  </div>

                  {/* Role selector */}
                  <div>
                    <label className="block text-sm text-gray-400 mb-2">
                      Force my role:
                    </label>
                    <select
                      value={debugForceRole ?? ''}
                      onChange={(e) => setDebugForceRole(e.target.value as RoleName || null)}
                      className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500"
                    >
                      <option value="">-- No role override --</option>
                      {Object.values(RoleName).map((role) => {
                        const meta = ROLE_METADATA[role];
                        return (
                          <option key={role} value={role}>
                            {meta.displayName} ({meta.team})
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  {/* Reveal All Roles toggle */}
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={debugRevealAllRoles}
                      onChange={(e) => setDebugRevealAllRoles(e.target.checked)}
                      className="w-4 h-4 rounded border-gray-500 bg-gray-700 text-yellow-500 focus:ring-yellow-500"
                    />
                    <div>
                      <span className="text-gray-300">Reveal all roles</span>
                      <p className="text-xs text-gray-500">See everyone's starting role (for Doppelganger testing)</p>
                    </div>
                  </label>

                  {/* Show Center Cards toggle */}
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={debugShowCenterCards}
                      onChange={(e) => setDebugShowCenterCards(e.target.checked)}
                      className="w-4 h-4 rounded border-gray-500 bg-gray-700 text-yellow-500 focus:ring-yellow-500"
                    />
                    <div>
                      <span className="text-gray-300">Show center cards</span>
                      <p className="text-xs text-gray-500">See the 3 center cards (for Drunk, Werewolf testing)</p>
                    </div>
                  </label>

                  {/* Force My Elimination toggle */}
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={debugForceHostElimination}
                      onChange={(e) => setDebugForceHostElimination(e.target.checked)}
                      className="w-4 h-4 rounded border-gray-500 bg-gray-700 text-yellow-500 focus:ring-yellow-500"
                    />
                    <div>
                      <span className="text-gray-300">Force my elimination</span>
                      <p className="text-xs text-gray-500">All bots vote for you (for Hunter testing)</p>
                    </div>
                  </label>

                  {/* Pause Timers toggle */}
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={debugDisableTimers}
                      onChange={(e) => setDebugDisableTimers(e.target.checked)}
                      className="w-4 h-4 rounded border-gray-500 bg-gray-700 text-yellow-500 focus:ring-yellow-500"
                    />
                    <div>
                      <span className="text-gray-300">Pause all timers</span>
                      <p className="text-xs text-gray-500">Timers display but don't count down</p>
                    </div>
                  </label>

                  {/* Force Werewolves to Center toggle */}
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={debugForceWerewolvesToCenter}
                      onChange={(e) => setDebugForceWerewolvesToCenter(e.target.checked)}
                      className="w-4 h-4 rounded border-gray-500 bg-gray-700 text-yellow-500 focus:ring-yellow-500"
                    />
                    <div>
                      <span className="text-gray-300">Force werewolves to center</span>
                      <p className="text-xs text-gray-500">Place both werewolves in center cards (for Minion testing)</p>
                    </div>
                  </label>

                  {/* Show Position Lines toggle (frontend only) */}
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={debugShowPositionLines}
                      onChange={(e) => setDebugShowPositionLines(e.target.checked)}
                      className="w-4 h-4 rounded border-gray-500 bg-gray-700 text-yellow-500 focus:ring-yellow-500"
                    />
                    <div>
                      <span className="text-gray-300">Show position lines</span>
                      <p className="text-xs text-gray-500">Display measurement lines for element positioning (frontend only)</p>
                    </div>
                  </label>

                  {/* Summary of active debug options */}
                  {(debugForceRole || debugRevealAllRoles || debugShowCenterCards || debugForceHostElimination || debugDisableTimers || debugShowPositionLines || debugForceWerewolvesToCenter) && (
                    <div className="mt-4 p-3 bg-yellow-900/20 rounded-lg border border-yellow-600/30">
                      <p className="text-sm text-yellow-400 font-medium mb-1">Active debug options:</p>
                      <ul className="text-xs text-yellow-400/70 space-y-1">
                        {debugForceRole && <li>• You will be: {ROLE_METADATA[debugForceRole].displayName}</li>}
                        {debugRevealAllRoles && <li>• All player roles will be visible</li>}
                        {debugShowCenterCards && <li>• Center cards will be visible</li>}
                        {debugForceHostElimination && <li>• You will be eliminated (bots vote for you)</li>}
                        {debugDisableTimers && <li>• All timers are paused (visible but frozen)</li>}
                        {debugForceWerewolvesToCenter && <li>• Both werewolves placed in center</li>}
                        {debugShowPositionLines && <li>• Position measurement lines visible</li>}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        <Button onClick={onLeave} variant="ghost" className="flex-1">
          Leave Room
        </Button>

        {!isHost && (
          <Button
            onClick={handleToggleReady}
            variant={currentPlayer?.isReady ? 'secondary' : 'primary'}
            className="flex-1"
          >
            {currentPlayer?.isReady ? 'Not Ready' : 'Ready'}
          </Button>
        )}

        {isHost && (
          <Button
            onClick={startGame}
            disabled={!canStart}
            className="flex-1"
          >
            Start Game
            {!canStart && roomState.players.length < roomState.config.minPlayers && (
              <span className="ml-2 text-xs opacity-75">
                ({roomState.config.minPlayers - roomState.players.length} more needed)
              </span>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
