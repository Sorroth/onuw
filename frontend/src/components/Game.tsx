import React, { useEffect, useState } from 'react';
import { Game as GameType, Player, RoleType } from '../types/game';
import { logger } from '../services/logger';
import './Game.css';

interface GameProps {
    gameId: string;
    playerId: string;
}

export const Game: React.FC<GameProps> = ({ gameId, playerId }) => {
    const [game, setGame] = useState<GameType | null>(null);
    const [player, setPlayer] = useState<Player | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isConnecting, setIsConnecting] = useState(true);
    const [isActionLoading, setIsActionLoading] = useState(false);

    useEffect(() => {
        let reconnectTimeout: NodeJS.Timeout;
        const maxReconnectAttempts = 3;
        let reconnectAttempts = 0;
        let isComponentMounted = true;
        let isCleaningUp = false;

        const connect = () => {
            try {
                if (isCleaningUp) return null;
                setError(null);
                setIsConnecting(true);

                const ws = new WebSocket(`ws://localhost:8080/ws/game/${gameId}?playerId=${playerId}`);

                ws.onopen = () => {
                    if (!isComponentMounted) return;
                    logger.info('WebSocket connection established');
                    reconnectAttempts = 0;
                    setIsConnecting(false);
                };

                ws.onmessage = (event) => {
                    if (!isComponentMounted) return;
                    try {
                        const data = JSON.parse(event.data);
                        logger.debug('Received game update', data);
                        if (data.type === 'GAME_STATE' && data.payload.game) {
                            setGame(data.payload.game);
                            if (data.payload.game.players && data.payload.game.players[playerId]) {
                                setPlayer(data.payload.game.players[playerId]);
                            }
                        }
                    } catch (error) {
                        logger.error('Error processing WebSocket message', {
                            error,
                            data: event.data
                        });
                    }
                };

                ws.onerror = (error) => {
                    if (!isComponentMounted) return;
                    logger.error('WebSocket connection failed', error);
                };

                ws.onclose = (event) => {
                    if (!isComponentMounted || isCleaningUp) return;
                    logger.info('WebSocket connection closed', event);
                    if (reconnectAttempts < maxReconnectAttempts) {
                        reconnectAttempts++;
                        logger.info(`Attempting to reconnect (${reconnectAttempts}/${maxReconnectAttempts})`);
                        reconnectTimeout = setTimeout(connect, 1000 * reconnectAttempts);
                    }
                };

                return ws;
            } catch (error) {
                if (!isCleaningUp) {
                    logger.error('Failed to create WebSocket connection', error);
                    setError('Failed to connect to game server');
                    setIsConnecting(false);
                }
                return null;
            }
        };

        const ws = connect();

        return () => {
            isCleaningUp = true;
            isComponentMounted = false;
            clearTimeout(reconnectTimeout);
            if (ws) {
                logger.info('Cleaning up WebSocket connection');
                ws.close();
            }
        };
    }, [gameId, playerId]);

    const handleReady = async () => {
        try {
            const response = await fetch(`http://localhost:8080/api/games/${gameId}/players/${playerId}/ready`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ ready: !player?.ready }),
            });
            
            if (!response.ok) {
                throw new Error('Failed to update ready status');
            }
            
            logger.info('Updated ready status');
        } catch (error) {
            logger.error('Error updating ready status:', error);
        }
    };

    const handleNightAction = async (action: string, targets: string[]) => {
        try {
            setIsActionLoading(true);
            const response = await fetch(`http://localhost:8080/api/games/${gameId}/players/${playerId}/action`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ action, targets }),
            });

            if (!response.ok) {
                throw new Error('Failed to perform action');
            }

            logger.info('Action submitted successfully');
        } catch (error) {
            logger.error('Error submitting action:', error);
        } finally {
            setIsActionLoading(false);
        }
    };

    const handleSeerAction = async (targetId: string | number, isPlayer: boolean): Promise<void> => {
        if (isPlayer) {
            await handleNightAction('VIEW', [String(targetId)]);
        } else {
            // When viewing center cards, we always look at cards 0 and 1
            await handleNightAction('VIEW', ['0', '1']);
        }
    };

    if (error) {
        return (
            <div className="error-container">
                <h2>Error</h2>
                <p>{error}</p>
                <button onClick={() => window.location.reload()}>Try Again</button>
            </div>
        );
    }

    if (isConnecting) {
        return <div className="loading">Connecting to game...</div>;
    }

    if (!game || !player) {
        logger.debug('Game or player not yet loaded');
        return <div>Loading...</div>;
    }

    const renderPlayerList = () => {
        return (
            <div className="player-list">
                <h3>Players</h3>
                {Object.values(game!.players).map((p: Player) => (
                    <div key={p.id} className={`player ${p.id === playerId ? 'current-player' : ''}`}>
                        <span>{p.name}</span>
                        {p.ready && <span className="ready-status">✓</span>}
                    </div>
                ))}
            </div>
        );
    };

    const renderGameBoard = () => {
        return (
            <div className="game-board">
                <div className="game-status">
                    <h2>Game Status: {game!.state}</h2>
                    {game!.state === 'WAITING' && (
                        <button onClick={handleReady}>
                            {player!.ready ? 'Not Ready' : 'Ready'}
                        </button>
                    )}
                </div>
                <div className="center-cards">
                    <h3>Center Cards</h3>
                    <div className="card-container">
                        {game!.centerCards.map((card: RoleType, index: number) => (
                            <div key={index} className="card">
                                {game!.state === 'COMPLETE' ? card : '?'}
                            </div>
                        ))}
                    </div>
                </div>
                {player && (
                    <div className="player-info">
                        <h3>Your Role</h3>
                        <div className="role-card">
                            {player.role}
                        </div>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="game-container">
            {renderPlayerList()}
            {renderGameBoard()}
        </div>
    );
}; 