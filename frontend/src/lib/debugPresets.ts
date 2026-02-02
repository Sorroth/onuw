/**
 * @fileoverview Debug presets for testing scenarios.
 * @module lib/debugPresets
 *
 * @description
 * Provides preset debug configurations for common testing scenarios.
 * Mirrors the DebugOptionsFactory patterns from the backend.
 */

import { RoleName } from '@/types/game';

export interface DebugOptions {
  forceRole?: RoleName;
  revealAllRoles?: boolean;
  forceHostElimination?: boolean;
  showCenterCards?: boolean;
  disableTimers?: boolean;
}

export interface DebugPreset {
  id: string;
  label: string;
  description: string;
  options: DebugOptions;
}

/**
 * Predefined debug presets for common testing scenarios.
 */
export const DEBUG_PRESETS: DebugPreset[] = [
  {
    id: 'hunterTest',
    label: 'Test Hunter',
    description: 'Forces host elimination to test Hunter ability',
    options: {
      forceRole: RoleName.HUNTER,
      forceHostElimination: true,
      revealAllRoles: true
    }
  },
  {
    id: 'doppelgangerTest',
    label: 'Test Doppelganger',
    description: 'Play as Doppelganger with all roles revealed',
    options: {
      forceRole: RoleName.DOPPELGANGER,
      revealAllRoles: true
    }
  },
  {
    id: 'seerTest',
    label: 'Test Seer',
    description: 'Play as Seer with center cards visible',
    options: {
      forceRole: RoleName.SEER,
      showCenterCards: true
    }
  },
  {
    id: 'werewolfTest',
    label: 'Test Werewolf',
    description: 'Play as Werewolf with all roles revealed',
    options: {
      forceRole: RoleName.WEREWOLF,
      revealAllRoles: true
    }
  },
  {
    id: 'fullDebug',
    label: 'Full Debug',
    description: 'All debug options enabled',
    options: {
      revealAllRoles: true,
      showCenterCards: true,
      disableTimers: true
    }
  }
];

/**
 * Get a preset by ID.
 */
export function getPresetById(id: string): DebugPreset | undefined {
  return DEBUG_PRESETS.find(preset => preset.id === id);
}
