'use client';

/**
 * @fileoverview Custom hook for managing speech bubble display.
 * @module hooks/useSpeechBubbles
 *
 * @description
 * Encapsulates the speech bubble state management logic including
 * showing bubbles for new statements, auto-dismissing after timeout,
 * and managing exit animations.
 *
 * @pattern Custom Hook - Reusable stateful logic
 * @pattern Observer - Reacts to statement changes
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { PlayerStatement } from '@/types/game';

/** How long a speech bubble stays visible (ms) */
const BUBBLE_DISPLAY_DURATION = 8000;
/** Max number of bubbles shown at once */
const MAX_VISIBLE_BUBBLES = 10;

interface UseSpeechBubblesOptions {
  statements: readonly PlayerStatement[];
  enabled?: boolean;
}

interface UseSpeechBubblesReturn {
  visibleBubblePlayerIds: string[];
  exitingBubblePlayerIds: string[];
}

export function useSpeechBubbles({
  statements,
  enabled = true
}: UseSpeechBubblesOptions): UseSpeechBubblesReturn {
  const [visibleBubblePlayerIds, setVisibleBubblePlayerIds] = useState<string[]>([]);
  const [exitingBubblePlayerIds, setExitingBubblePlayerIds] = useState<string[]>([]);
  const bubbleTimers = useRef<Map<string, NodeJS.Timeout>>(new Map());
  // Initialize to current count so existing statements don't trigger on mount
  const prevStatementCount = useRef(statements.length);
  const isInitialized = useRef(false);

  // Schedule bubble removal with exit animation
  const scheduleBubbleRemoval = useCallback((playerId: string) => {
    // Clear existing timer if any
    const existingTimer = bubbleTimers.current.get(playerId);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Set timer to start exit animation
    const timer = setTimeout(() => {
      setExitingBubblePlayerIds(prev => [...prev, playerId]);

      // After exit animation, remove from visible
      setTimeout(() => {
        setVisibleBubblePlayerIds(prev => prev.filter(id => id !== playerId));
        setExitingBubblePlayerIds(prev => prev.filter(id => id !== playerId));
        bubbleTimers.current.delete(playerId);
      }, 300); // Match exit animation duration
    }, BUBBLE_DISPLAY_DURATION);

    bubbleTimers.current.set(playerId, timer);
  }, []);

  // Handle new statements - show speech bubbles
  useEffect(() => {
    if (!enabled) return;

    // Skip first render to avoid triggering bubbles for existing statements
    if (!isInitialized.current) {
      isInitialized.current = true;
      prevStatementCount.current = statements.length;
      return;
    }

    if (statements.length > prevStatementCount.current) {
      // New statement(s) arrived
      const newStatements = statements.slice(prevStatementCount.current);

      for (const stmt of newStatements) {
        const playerId = stmt.playerId;

        // Add to visible bubbles (or move to end if already visible)
        setVisibleBubblePlayerIds(prev => {
          const filtered = prev.filter(id => id !== playerId);
          const newVisible = [...filtered, playerId];
          // Limit to max bubbles
          if (newVisible.length > MAX_VISIBLE_BUBBLES) {
            return newVisible.slice(-MAX_VISIBLE_BUBBLES);
          }
          return newVisible;
        });

        // Remove from exiting if was in exit state
        setExitingBubblePlayerIds(prev => prev.filter(id => id !== playerId));

        // Schedule removal
        scheduleBubbleRemoval(playerId);
      }
    }

    prevStatementCount.current = statements.length;
  }, [statements.length, statements, enabled, scheduleBubbleRemoval]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      bubbleTimers.current.forEach(timer => clearTimeout(timer));
      bubbleTimers.current.clear();
    };
  }, []);

  return {
    visibleBubblePlayerIds,
    exitingBubblePlayerIds
  };
}
