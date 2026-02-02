'use client';

/**
 * @fileoverview Role selector component for game configuration.
 * @module components/lobby/RoleSelector
 *
 * @description
 * Allows the host to configure player count and select which roles
 * to include in the game. Enforces the rule that total roles must
 * equal player count + 3 (for center cards).
 *
 * @pattern Observer Pattern - Reacts to selection state changes
 * @pattern Strategy Pattern - Different validation based on player count
 */

import { useState, useEffect, useCallback } from 'react';
import { RoleName, Team, ROLE_METADATA } from '@/types/game';
import { Button, Card, CardContent, CardHeader, CardTitle } from '@/components/ui';
import { cn } from '@/lib/utils';

/**
 * Configuration constants for role selection.
 * @internal
 */
const ROLE_SELECTOR_DEFAULTS = {
  /** Minimum players allowed */
  MIN_PLAYERS: 3,
  /** Maximum players allowed */
  MAX_PLAYERS: 10,
  /** Number of center cards in the game */
  CENTER_CARD_COUNT: 3,
  /** Default player count */
  DEFAULT_PLAYERS: 5,
} as const;

/**
 * All available roles in order of night action priority.
 */
const AVAILABLE_ROLES: readonly RoleName[] = [
  RoleName.DOPPELGANGER,
  RoleName.WEREWOLF,
  RoleName.MINION,
  RoleName.MASON,
  RoleName.SEER,
  RoleName.ROBBER,
  RoleName.TROUBLEMAKER,
  RoleName.DRUNK,
  RoleName.INSOMNIAC,
  RoleName.VILLAGER,
  RoleName.HUNTER,
  RoleName.TANNER,
];

/**
 * Maximum copies of each role allowed.
 */
const MAX_ROLE_COPIES: Partial<Record<RoleName, number>> = {
  [RoleName.WEREWOLF]: 2,
  [RoleName.MASON]: 2,
  [RoleName.VILLAGER]: 3,
};

interface RoleSelectorProps {
  initialPlayerCount?: number;
  initialRoles?: RoleName[];
  onConfigChange: (playerCount: number, roles: RoleName[]) => void;
  disabled?: boolean;
  /** Minimum player count (e.g., current players in room) */
  minPlayerCount?: number;
  /** Called when validity changes (true = valid config) */
  onValidityChange?: (isValid: boolean) => void;
}

export function RoleSelector({
  initialPlayerCount = ROLE_SELECTOR_DEFAULTS.DEFAULT_PLAYERS,
  initialRoles,
  onConfigChange,
  disabled = false,
  minPlayerCount = ROLE_SELECTOR_DEFAULTS.MIN_PLAYERS,
  onValidityChange
}: RoleSelectorProps) {
  const [playerCount, setPlayerCount] = useState(initialPlayerCount);
  const [selectedRoles, setSelectedRoles] = useState<RoleName[]>(
    initialRoles ?? getDefaultRoles(initialPlayerCount)
  );

  const requiredRoles = playerCount + ROLE_SELECTOR_DEFAULTS.CENTER_CARD_COUNT;
  const currentRoleCount = selectedRoles.length;
  const rolesNeeded = requiredRoles - currentRoleCount;

  const isValid = rolesNeeded === 0;

  // Notify parent of changes
  useEffect(() => {
    if (isValid) {
      onConfigChange(playerCount, selectedRoles);
    }
  }, [playerCount, selectedRoles, isValid, onConfigChange]);

  // Notify parent of validity changes
  useEffect(() => {
    onValidityChange?.(isValid);
  }, [isValid, onValidityChange]);

  const getRoleCount = useCallback((role: RoleName): number => {
    return selectedRoles.filter(r => r === role).length;
  }, [selectedRoles]);

  const canAddRole = useCallback((role: RoleName): boolean => {
    if (rolesNeeded <= 0) return false;
    const currentCount = getRoleCount(role);
    const maxCopies = MAX_ROLE_COPIES[role] ?? 1;
    return currentCount < maxCopies;
  }, [rolesNeeded, getRoleCount]);

  const canRemoveRole = useCallback((role: RoleName): boolean => {
    return getRoleCount(role) > 0;
  }, [getRoleCount]);

  const addRole = (role: RoleName) => {
    if (!canAddRole(role)) return;
    setSelectedRoles(prev => [...prev, role]);
  };

  const removeRole = (role: RoleName) => {
    if (!canRemoveRole(role)) return;
    const index = selectedRoles.lastIndexOf(role);
    if (index !== -1) {
      setSelectedRoles(prev => {
        const next = [...prev];
        next.splice(index, 1);
        return next;
      });
    }
  };

  const handlePlayerCountChange = (newCount: number) => {
    const effectiveMin = Math.max(ROLE_SELECTOR_DEFAULTS.MIN_PLAYERS, minPlayerCount);
    if (newCount < effectiveMin || newCount > ROLE_SELECTOR_DEFAULTS.MAX_PLAYERS) return;

    setPlayerCount(newCount);

    // Auto-adjust roles if needed
    const newRequired = newCount + ROLE_SELECTOR_DEFAULTS.CENTER_CARD_COUNT;
    if (selectedRoles.length > newRequired) {
      // Remove roles from the end
      setSelectedRoles(prev => prev.slice(0, newRequired));
    }
  };

  const resetToDefault = () => {
    setSelectedRoles(getDefaultRoles(playerCount));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Game Setup</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Player Count Selector */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Number of Players
          </label>
          <div className="flex items-center gap-3">
            <Button
              onClick={() => handlePlayerCountChange(playerCount - 1)}
              disabled={disabled || playerCount <= Math.max(ROLE_SELECTOR_DEFAULTS.MIN_PLAYERS, minPlayerCount)}
              variant="secondary"
              size="sm"
            >
              -
            </Button>
            <span className="text-2xl font-bold text-white w-12 text-center">
              {playerCount}
            </span>
            <Button
              onClick={() => handlePlayerCountChange(playerCount + 1)}
              disabled={disabled || playerCount >= ROLE_SELECTOR_DEFAULTS.MAX_PLAYERS}
              variant="secondary"
              size="sm"
            >
              +
            </Button>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            {requiredRoles} roles needed ({playerCount} players + {ROLE_SELECTOR_DEFAULTS.CENTER_CARD_COUNT} center cards)
          </p>
        </div>

        {/* Role Status */}
        <div className={cn(
          'text-sm font-medium px-3 py-2 rounded-lg text-center',
          rolesNeeded === 0
            ? 'bg-green-900/30 text-green-400'
            : rolesNeeded > 0
            ? 'bg-yellow-900/30 text-yellow-400'
            : 'bg-red-900/30 text-red-400'
        )}>
          {rolesNeeded === 0
            ? '✓ Ready to play!'
            : rolesNeeded > 0
            ? `Add ${rolesNeeded} more role${rolesNeeded > 1 ? 's' : ''}`
            : `Remove ${Math.abs(rolesNeeded)} role${Math.abs(rolesNeeded) > 1 ? 's' : ''}`}
        </div>

        {/* Role Selection */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-gray-300">
              Select Roles
            </label>
            <Button
              onClick={resetToDefault}
              variant="ghost"
              size="sm"
              disabled={disabled}
            >
              Reset to Default
            </Button>
          </div>

          {/* Werewolf Team */}
          <div>
            <h4 className="text-xs font-semibold text-red-400 uppercase tracking-wide mb-2">
              Werewolf Team
            </h4>
            <div className="grid grid-cols-2 gap-2">
              {AVAILABLE_ROLES.filter(r => ROLE_METADATA[r].team === Team.WEREWOLF).map(role => (
                <RoleButton
                  key={role}
                  role={role}
                  count={getRoleCount(role)}
                  maxCount={MAX_ROLE_COPIES[role] ?? 1}
                  canAdd={canAddRole(role)}
                  canRemove={canRemoveRole(role)}
                  onAdd={() => addRole(role)}
                  onRemove={() => removeRole(role)}
                  disabled={disabled}
                />
              ))}
            </div>
          </div>

          {/* Village Team */}
          <div>
            <h4 className="text-xs font-semibold text-blue-400 uppercase tracking-wide mb-2">
              Village Team
            </h4>
            <div className="grid grid-cols-2 gap-2">
              {AVAILABLE_ROLES.filter(r => ROLE_METADATA[r].team === Team.VILLAGE).map(role => (
                <RoleButton
                  key={role}
                  role={role}
                  count={getRoleCount(role)}
                  maxCount={MAX_ROLE_COPIES[role] ?? 1}
                  canAdd={canAddRole(role)}
                  canRemove={canRemoveRole(role)}
                  onAdd={() => addRole(role)}
                  onRemove={() => removeRole(role)}
                  disabled={disabled}
                />
              ))}
            </div>
          </div>

          {/* Tanner (Solo) */}
          <div>
            <h4 className="text-xs font-semibold text-amber-400 uppercase tracking-wide mb-2">
              Solo
            </h4>
            <div className="grid grid-cols-2 gap-2">
              {AVAILABLE_ROLES.filter(r => ROLE_METADATA[r].team === Team.TANNER).map(role => (
                <RoleButton
                  key={role}
                  role={role}
                  count={getRoleCount(role)}
                  maxCount={MAX_ROLE_COPIES[role] ?? 1}
                  canAdd={canAddRole(role)}
                  canRemove={canRemoveRole(role)}
                  onAdd={() => addRole(role)}
                  onRemove={() => removeRole(role)}
                  disabled={disabled}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Selected Roles Summary */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Roles in Game ({currentRoleCount}/{requiredRoles})
          </label>
          <div className="flex flex-wrap gap-1">
            {selectedRoles.length === 0 ? (
              <span className="text-gray-500 text-sm">No roles selected</span>
            ) : (
              selectedRoles.map((role, index) => {
                const meta = ROLE_METADATA[role];
                return (
                  <span
                    key={`${role}-${index}`}
                    className={cn(
                      'px-2 py-0.5 rounded text-xs font-medium',
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
              })
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Individual role selection button with +/- controls.
 */
interface RoleButtonProps {
  role: RoleName;
  count: number;
  maxCount: number;
  canAdd: boolean;
  canRemove: boolean;
  onAdd: () => void;
  onRemove: () => void;
  disabled?: boolean;
}

function RoleButton({
  role,
  count,
  maxCount,
  canAdd,
  canRemove,
  onAdd,
  onRemove,
  disabled = false
}: RoleButtonProps) {
  const meta = ROLE_METADATA[role];
  const isSelected = count > 0;

  return (
    <div
      className={cn(
        'flex items-center justify-between p-2 rounded-lg border transition-all',
        isSelected
          ? meta.team === Team.WEREWOLF
            ? 'border-red-600 bg-red-900/20'
            : meta.team === Team.TANNER
            ? 'border-amber-600 bg-amber-900/20'
            : 'border-blue-600 bg-blue-900/20'
          : 'border-gray-700 bg-gray-800/50'
      )}
    >
      <div className="flex-1 min-w-0 mr-2">
        <p className={cn(
          'text-sm font-medium truncate',
          isSelected ? 'text-white' : 'text-gray-400'
        )}>
          {meta.displayName}
        </p>
        {maxCount > 1 && (
          <p className="text-xs text-gray-500">
            {count}/{maxCount}
          </p>
        )}
      </div>
      <div className="flex items-center gap-1">
        <button
          onClick={onRemove}
          disabled={disabled || !canRemove}
          className={cn(
            'w-6 h-6 rounded flex items-center justify-center text-sm font-bold transition-colors',
            canRemove && !disabled
              ? 'bg-gray-700 hover:bg-gray-600 text-white'
              : 'bg-gray-800 text-gray-600 cursor-not-allowed'
          )}
        >
          -
        </button>
        <span className="w-4 text-center text-sm font-medium text-white">
          {count}
        </span>
        <button
          onClick={onAdd}
          disabled={disabled || !canAdd}
          className={cn(
            'w-6 h-6 rounded flex items-center justify-center text-sm font-bold transition-colors',
            canAdd && !disabled
              ? 'bg-gray-700 hover:bg-gray-600 text-white'
              : 'bg-gray-800 text-gray-600 cursor-not-allowed'
          )}
        >
          +
        </button>
      </div>
    </div>
  );
}

/**
 * Generate default roles for a given player count.
 * Returns a balanced set of roles based on player count + 3 center cards.
 */
function getDefaultRoles(playerCount: number): RoleName[] {
  const totalRoles = playerCount + ROLE_SELECTOR_DEFAULTS.CENTER_CARD_COUNT;

  // Base roles that should always be included
  const baseRoles: RoleName[] = [
    RoleName.WEREWOLF,
    RoleName.WEREWOLF,
    RoleName.SEER,
    RoleName.ROBBER,
    RoleName.TROUBLEMAKER,
  ];

  // Additional roles to fill remaining slots
  const additionalRoles: RoleName[] = [
    RoleName.VILLAGER,
    RoleName.DRUNK,
    RoleName.INSOMNIAC,
    RoleName.MASON,
    RoleName.MASON,
    RoleName.MINION,
    RoleName.HUNTER,
    RoleName.TANNER,
    RoleName.VILLAGER,
    RoleName.DOPPELGANGER,
    RoleName.VILLAGER,
  ];

  const roles = [...baseRoles];
  let index = 0;

  while (roles.length < totalRoles && index < additionalRoles.length) {
    roles.push(additionalRoles[index]);
    index++;
  }

  return roles.slice(0, totalRoles);
}
