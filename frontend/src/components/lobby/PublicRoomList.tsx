'use client';

/**
 * @fileoverview Public room list component for room browser.
 * @module components/lobby/PublicRoomList
 *
 * @description
 * Displays a list of public rooms that are waiting for players.
 * Users can browse and join available rooms without knowing the code.
 *
 * @pattern Observer Pattern - Subscribes to publicRooms state
 * @pattern Composite Pattern - Room items composed of UI primitives
 */

import { useEffect } from 'react';
import { PublicRoomInfo, RoleName, ROLE_METADATA, Team } from '@/types/game';
import { Button } from '@/components/ui';
import { cn } from '@/lib/utils';

interface PublicRoomListProps {
  /** List of public rooms */
  rooms: PublicRoomInfo[];
  /** Callback to refresh room list */
  onRefresh: () => void;
  /** Callback when user selects a room to join */
  onJoinRoom: (roomCode: string) => void;
  /** Whether the component is loading */
  isLoading?: boolean;
}

/**
 * @summary Displays a browsable list of public rooms.
 *
 * @description
 * Shows available public rooms with player count, host name,
 * and role preview. Includes refresh functionality and auto-refresh
 * on mount.
 *
 * @param {PublicRoomListProps} props - Component props
 * @returns {JSX.Element} Public room list
 */
export function PublicRoomList({
  rooms,
  onRefresh,
  onJoinRoom,
  isLoading = false
}: PublicRoomListProps) {
  // Auto-refresh on mount
  useEffect(() => {
    onRefresh();
  }, [onRefresh]);

  // Auto-refresh every 10 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      onRefresh();
    }, 10000);
    return () => clearInterval(interval);
  }, [onRefresh]);

  return (
    <div className="space-y-3">
      {/* Header with refresh button */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-400">
          Public Rooms ({rooms.length})
        </h3>
        <Button
          onClick={onRefresh}
          variant="ghost"
          size="sm"
          disabled={isLoading}
        >
          {isLoading ? 'Refreshing...' : 'Refresh'}
        </Button>
      </div>

      {/* Room list */}
      {rooms.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <p>No public rooms available</p>
          <p className="text-sm mt-1">Create your own or try again later</p>
        </div>
      ) : (
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {rooms.map((room) => (
            <RoomListItem
              key={room.roomCode}
              room={room}
              onJoin={() => onJoinRoom(room.roomCode)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface RoomListItemProps {
  room: PublicRoomInfo;
  onJoin: () => void;
}

/**
 * @summary Individual room item in the public room list.
 */
function RoomListItem({ room, onJoin }: RoomListItemProps) {
  const isFull = room.playerCount >= room.maxPlayers;

  // Count roles by team for preview
  const werewolfCount = room.roles.filter(
    r => ROLE_METADATA[r]?.team === Team.WEREWOLF
  ).length;

  return (
    <div
      className={cn(
        'flex items-center justify-between p-3 rounded-lg',
        'bg-gray-700/50 hover:bg-gray-700/70 transition-colors',
        isFull && 'opacity-60'
      )}
    >
      <div className="flex-1 min-w-0">
        {/* Room code and host */}
        <div className="flex items-center gap-2">
          <span className="font-mono text-white font-medium">
            {room.roomCode}
          </span>
          <span className="text-gray-400 text-sm truncate">
            hosted by {room.hostName}
          </span>
        </div>

        {/* Player count and role preview */}
        <div className="flex items-center gap-3 mt-1">
          {/* Player indicators */}
          <div className="flex items-center gap-1">
            {Array.from({ length: room.maxPlayers }).map((_, i) => (
              <div
                key={i}
                className={cn(
                  'w-2 h-2 rounded-full',
                  i < room.playerCount ? 'bg-green-500' : 'bg-gray-600'
                )}
              />
            ))}
            <span className="text-xs text-gray-400 ml-1">
              {room.playerCount}/{room.maxPlayers}
            </span>
          </div>

          {/* Werewolf count indicator */}
          <span className="text-xs text-red-400">
            {werewolfCount} wolf{werewolfCount !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* Join button */}
      <Button
        onClick={onJoin}
        variant={isFull ? 'ghost' : 'primary'}
        size="sm"
        disabled={isFull}
      >
        {isFull ? 'Full' : 'Join'}
      </Button>
    </div>
  );
}
