/**
 * @fileoverview Zustand store for debug mode state management.
 * @module stores/debugStore
 *
 * @description
 * Manages debug mode settings for admin users, allowing role forcing,
 * role visibility, and other testing utilities.
 *
 * @pattern Single Responsibility - Dedicated store for debug concerns
 * @pattern Observer Pattern - Components subscribe to debug state changes
 */

import { create } from 'zustand';
import { RoleName } from '@/types/game';

interface DebugStore {
  // Debug mode state (admin only)
  debugMode: boolean;
  debugForceRole: RoleName | null;
  debugRevealAllRoles: boolean;
  debugForceHostElimination: boolean;
  debugShowCenterCards: boolean;
  debugDisableTimers: boolean;
  debugShowPositionLines: boolean;  // Frontend-only: show positioning measurement lines
  debugForceWerewolvesToCenter: boolean;  // Place both werewolves in center cards

  // Actions
  setDebugMode: (enabled: boolean) => void;
  setDebugForceRole: (role: RoleName | null) => void;
  setDebugRevealAllRoles: (enabled: boolean) => void;
  setDebugForceHostElimination: (enabled: boolean) => void;
  setDebugShowCenterCards: (enabled: boolean) => void;
  setDebugDisableTimers: (enabled: boolean) => void;
  setDebugShowPositionLines: (enabled: boolean) => void;
  setDebugForceWerewolvesToCenter: (enabled: boolean) => void;
  resetDebugState: () => void;

  // Helper to get debug options for startGame message
  getDebugOptions: () => DebugOptions | null;
}

export interface DebugOptions {
  forceRole?: RoleName;
  revealAllRoles?: boolean;
  forceHostElimination?: boolean;
  showCenterCards?: boolean;
  disableTimers?: boolean;
  forceWerewolvesToCenter?: boolean;
}

const initialDebugState = {
  debugMode: false,
  debugForceRole: null as RoleName | null,
  debugRevealAllRoles: false,
  debugForceHostElimination: false,
  debugShowCenterCards: false,
  debugDisableTimers: false,
  debugShowPositionLines: false,
  debugForceWerewolvesToCenter: false,
};

export const useDebugStore = create<DebugStore>((set, get) => ({
  ...initialDebugState,

  setDebugMode: (enabled) => set({ debugMode: enabled }),

  setDebugForceRole: (role) => set({ debugForceRole: role }),

  setDebugRevealAllRoles: (enabled) => set({ debugRevealAllRoles: enabled }),

  setDebugForceHostElimination: (enabled) => set({ debugForceHostElimination: enabled }),

  setDebugShowCenterCards: (enabled) => set({ debugShowCenterCards: enabled }),

  setDebugDisableTimers: (enabled) => set({ debugDisableTimers: enabled }),

  setDebugShowPositionLines: (enabled) => set({ debugShowPositionLines: enabled }),

  setDebugForceWerewolvesToCenter: (enabled) => set({ debugForceWerewolvesToCenter: enabled }),

  resetDebugState: () => set(initialDebugState),

  getDebugOptions: () => {
    const {
      debugMode,
      debugForceRole,
      debugRevealAllRoles,
      debugForceHostElimination,
      debugShowCenterCards,
      debugDisableTimers,
      debugForceWerewolvesToCenter
    } = get();

    if (!debugMode) return null;

    const options: DebugOptions = {};
    if (debugForceRole) options.forceRole = debugForceRole;
    if (debugRevealAllRoles) options.revealAllRoles = true;
    if (debugForceHostElimination) options.forceHostElimination = true;
    if (debugShowCenterCards) options.showCenterCards = true;
    if (debugDisableTimers) options.disableTimers = true;
    if (debugForceWerewolvesToCenter) options.forceWerewolvesToCenter = true;

    return Object.keys(options).length > 0 ? options : null;
  }
}));
