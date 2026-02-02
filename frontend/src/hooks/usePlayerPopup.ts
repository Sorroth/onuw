'use client';

/**
 * @fileoverview Custom hook for managing player statement popup.
 * @module hooks/usePlayerPopup
 *
 * @description
 * Encapsulates the player popup state management for showing
 * a player's statement history when clicking on their avatar.
 *
 * @pattern Custom Hook - Reusable stateful logic
 */

import { useState, useCallback } from 'react';

interface UsePlayerPopupReturn {
  selectedPlayerId: string | null;
  popupPosition: { x: number; y: number } | null;
  handlePlayerClick: (playerId: string, position?: { x: number; y: number }, screenPosition?: { x: number; y: number }) => void;
  handleClosePopup: () => void;
}

export function usePlayerPopup(): UsePlayerPopupReturn {
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [popupPosition, setPopupPosition] = useState<{ x: number; y: number } | null>(null);

  const handlePlayerClick = useCallback((
    playerId: string,
    _position?: { x: number; y: number },
    screenPosition?: { x: number; y: number }
  ) => {
    setSelectedPlayerId(playerId);
    setPopupPosition(screenPosition || null);
  }, []);

  const handleClosePopup = useCallback(() => {
    setSelectedPlayerId(null);
    setPopupPosition(null);
  }, []);

  return {
    selectedPlayerId,
    popupPosition,
    handlePlayerClick,
    handleClosePopup
  };
}
