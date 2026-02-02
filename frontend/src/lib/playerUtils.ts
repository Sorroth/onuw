/**
 * @fileoverview Player utility functions.
 * @module lib/playerUtils
 *
 * @description
 * Shared utilities for player-related operations. Extracts common
 * player name resolution logic to avoid duplication across components.
 *
 * @pattern Utility Pattern - Shared stateless helper functions
 * @pattern DRY Principle - Single source of truth for player name resolution
 */

import { RoomState } from '@/types/game';

/**
 * Resolves a player's display name from their game ID.
 *
 * @description
 * Maps game-internal player IDs to room player IDs using the mapping,
 * then looks up the player's display name from the room state.
 *
 * @param id - The player's game-internal ID
 * @param playerIdMapping - Mapping from game IDs to room IDs
 * @param roomState - Current room state containing player list
 * @returns The player's display name, or the original ID if not found
 *
 * @example
 * ```tsx
 * const name = getPlayerName(playerId, playerIdMapping, roomState);
 * return <span>{name}</span>;
 * ```
 */
export function getPlayerName(
  id: string,
  playerIdMapping: Record<string, string>,
  roomState: RoomState | null
): string {
  const roomId = playerIdMapping[id] ?? id;
  const player = roomState?.players.find(p => p.id === roomId);
  return player?.name ?? id;
}

/**
 * Creates a memoized player name resolver function.
 *
 * @description
 * Returns a curried function that captures the mapping and room state,
 * allowing components to call it with just the player ID.
 *
 * @param playerIdMapping - Mapping from game IDs to room IDs
 * @param roomState - Current room state containing player list
 * @returns A function that takes a player ID and returns the display name
 *
 * @example
 * ```tsx
 * const getPlayerName = createPlayerNameResolver(playerIdMapping, roomState);
 * return <span>{getPlayerName(playerId)}</span>;
 * ```
 */
export function createPlayerNameResolver(
  playerIdMapping: Record<string, string>,
  roomState: RoomState | null
): (id: string) => string {
  return (id: string) => getPlayerName(id, playerIdMapping, roomState);
}

/**
 * Converts a room player ID to the server's game ID.
 *
 * @description
 * Reverse lookup: given a room player ID (like 'ai-100' or 'uuid'),
 * returns the server's internal game ID (like 'player-2').
 *
 * @param roomPlayerId - The room player's ID
 * @param playerIdMapping - Mapping from game IDs to room IDs
 * @returns The server's game ID, or the original ID if not found
 */
export function toServerPlayerId(
  roomPlayerId: string,
  playerIdMapping: Record<string, string>
): string {
  // playerIdMapping is { gameId -> roomId }, we need reverse lookup
  for (const [gameId, roomId] of Object.entries(playerIdMapping)) {
    if (roomId === roomPlayerId) {
      return gameId;
    }
  }
  return roomPlayerId; // fallback to original if not found
}
