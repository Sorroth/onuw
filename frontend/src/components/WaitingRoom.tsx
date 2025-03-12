import React, { useEffect, useState } from 'react';
import { Game as GameType, Player } from '../types/game';
import { logger } from '../services/logger';
import './WaitingRoom.css';

interface WaitingRoomProps {
    gameId: string;
    playerId: string;
}

export const WaitingRoom: React.FC<WaitingRoomProps> = ({ gameId, playerId }) => {
    const [game, setGame] = useState<GameType | null>(null);
    const [isReady, setIsReady] = useState(false);

    useEffect(() => {
        const ws = new WebSocket(`ws://localhost:8080/ws/game/${gameId}?playerId=${playerId}`);

        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if (data.type === 'GAME_STATE' && data.payload.game) {
                    setGame(data.payload.game);
                    // Update local ready state based on player data
                    if (data.payload.game.players[playerId]) {
                        setIsReady(data.payload.game.players[playerId].ready);
                    }
                }
            } catch (error) {
                logger.error('Error processing WebSocket message', error);
            }
        };

        return () => ws.close();
    }, [gameId, playerId]);

    const handleReadyToggle = async () => {
        try {
            const response = await fetch(
                `http://localhost:8080/api/games/${gameId}/players/${playerId}/ready`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ ready: !isReady }),
                }
            );
            if (!response.ok) {
                throw new Error('Failed to update ready status');
            }
        } catch (error) {
            logger.error('Error updating ready status:', error);
        }
    };

    if (!game) return <div>Loading...</div>;

    const playerCount = Object.keys(game.players).length;
    const readyCount = Object.values(game.players).filter(p => p.ready).length;

    return (
        <div className="waiting-room">
            <h2>Waiting Room</h2>
            <div className="game-info">
                <p>Game ID: <span className="game-id">{gameId}</span></p>
                <p>Players: {playerCount}/10</p>
                <p>Ready: {readyCount}/{playerCount}</p>
            </div>
            
            <div className="player-list">
                <h3>Players</h3>
                {Object.values(game.players).map((player: Player) => (
                    <div 
                        key={player.id} 
                        className={`player ${player.id === playerId ? 'current-player' : ''}`}
                    >
                        <span className="player-name">{player.name}</span>
                        <span className={`ready-status ${player.ready ? 'is-ready' : ''}`}>
                            {player.ready ? '✓ Ready' : 'Not Ready'}
                        </span>
                    </div>
                ))}
            </div>

            <button 
                className={`ready-button ${isReady ? 'is-ready' : ''}`}
                onClick={handleReadyToggle}
            >
                {isReady ? 'Not Ready' : 'Ready'}
            </button>

            <div className="instructions">
                <h3>How to Play</h3>
                <ul>
                    <li>Minimum 3 players required to start</li>
                    <li>All players must click Ready to begin</li>
                    <li>Share the Game ID with friends to let them join</li>
                </ul>
            </div>
        </div>
    );
}; 