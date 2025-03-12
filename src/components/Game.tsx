import React, { useEffect, useState } from 'react';
import { Game as GameType, Player, GameState } from '../types/game';
import { logger } from '../services/logger';
import '../styles/Game.css';
import { Timer } from './Timer';
import { ActionResult } from './ActionResult';

interface GameProps {
    gameId: string;
    playerId: string;
}

export const Game: React.FC<GameProps> = ({ gameId, playerId }) => {
    const [game, setGame] = useState<GameType | null>(null);
    const [player, setPlayer] = useState<Player | null>(null);
    const [troublemakerFirstTarget, setTroublemakerFirstTarget] = useState<string | null>(null);
    const [isActionLoading, setIsActionLoading] = useState(false);

    useEffect(() => {
        let reconnectTimeout: NodeJS.Timeout;
        const maxReconnectAttempts = 3;
        let reconnectAttempts = 0;

        const connect = () => {
            const ws = new WebSocket(`ws://localhost:8080/ws/game/${gameId}?playerId=${playerId}`);

            ws.onopen = () => {
                logger.info('WebSocket connection established');
                reconnectAttempts = 0;
            };

            ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    logger.debug('Received game update', data);
                    setGame(data.game);
                    setPlayer(data.game.players[playerId]);
                } catch (error) {
                    logger.error('Error processing WebSocket message', {
                        error,
                        data: event.data
                    });
                }
            };

            ws.onerror = (error) => {
                logger.error('WebSocket error occurred', error);
            };

            ws.onclose = (event) => {
                logger.info('WebSocket connection closed', event);
                if (reconnectAttempts < maxReconnectAttempts) {
                    reconnectAttempts++;
                    logger.info(`Attempting to reconnect (${reconnectAttempts}/${maxReconnectAttempts})`);
                    reconnectTimeout = setTimeout(connect, 1000 * reconnectAttempts);
                }
            };

            return ws;
        };

        const ws = connect();

        return () => {
            logger.info('Cleaning up WebSocket connection');
            clearTimeout(reconnectTimeout);
            ws.close();
        };
    }, [gameId, playerId]);

    const handleVote = async (targetId: string): Promise<void> => {
        setIsActionLoading(true);
        try {
            const response = await fetch(`http://localhost:8080/api/games/${gameId}/players/${playerId}/vote`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ targetId }),
            });

            if (!response.ok) {
                throw new Error('Failed to submit vote');
            }

            logger.info('Vote submitted successfully');
        } catch (error) {
            logger.error('Error submitting vote:', error);
        } finally {
            setIsActionLoading(false);
        }
    };

    const handleWerewolfCenterCardView = async (cardIndex: number) => {
        await handleNightAction('VIEW_CENTER', [cardIndex.toString()]);
    };

    const handleSeerAction = async (targetId: string | number, isPlayer: boolean): Promise<void> => {
        if (isPlayer) {
            await handleNightAction('VIEW', [String(targetId)]);
        } else {
            // When viewing center cards, we always look at cards 0 and 1
            await handleNightAction('VIEW', ['0', '1']);
        }
    };

    const handleRobberAction = async (targetId: string) => {
        await handleNightAction('SWAP', [targetId]);
    };

    const handleTroublemakerAction = async (target1Id: string, target2Id: string) => {
        await handleNightAction('SWAP', [target1Id, target2Id]);
    };

    const handleDrunkAction = async (cardIndex: number) => {
        await handleNightAction('SWAP', [cardIndex.toString()]);
    };

    const handleDoppelgangerAction = async (targetId: string) => {
        await handleNightAction('COPY', [targetId]);
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

    const renderVotingPhase = () => {
        if (!game || !player) return null;
        if (player.hasVoted) {
            return <div>Waiting for other players to vote...</div>;
        }

        return (
            <div className="voting-phase">
                <h3>Vote for a Player</h3>
                <div className="player-list">
                    {Object.values(game.players).map((p) => (
                        <button
                            key={p.id}
                            onClick={() => handleVote(p.id)}
                            disabled={p.id === playerId || isActionLoading}
                            className="vote-button"
                        >
                            {isActionLoading ? 'Submitting...' : p.name}
                        </button>
                    ))}
                </div>
            </div>
        );
    };

    const renderGameResults = () => {
        if (!game || game.state !== 'COMPLETE') return null;

        return (
            <div className="game-results">
                <h2>Game Over!</h2>
                <div className="final-roles">
                    <h3>Final Roles:</h3>
                    {Object.values(game.players).map((p) => (
                        <div key={p.id} className="player-role">
                            {p.name}: {p.role}
                            {p.original !== p.role && ` (Started as ${p.original})`}
                        </div>
                    ))}
                </div>
                <div className="center-cards">
                    <h3>Center Cards:</h3>
                    {game.centerCards.map((role, index) => (
                        <div key={index} className="center-role">
                            Card {index + 1}: {role}
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    const renderPlayerList = () => {
        if (!game) return null;
        
        return (
            <div className="player-list">
                <h3>Players</h3>
                {Object.values(game.players).map((p) => (
                    <div key={p.id} className={`player ${p.id === playerId ? 'current-player' : ''}`}>
                        <span>{p.name}</span>
                        <div className="player-status">
                            {p.ready && <span className="ready-status">✓</span>}
                            {game.state === 'VOTING' && p.hasVoted && 
                                <span className="voted-status">Voted</span>}
                        </div>
                    </div>
                ))}
            </div>
        );
    };

    const renderNightAction = () => {
        if (!game || !player || game.state !== 'NIGHT') return null;

        const lastAction = game.nightActions
            .filter(a => a.playerId === playerId)
            .slice(-1)[0];

        if (lastAction?.result) {
            return <ActionResult action={lastAction} />;
        }

        switch (game.currentAction) {
            case 'WEREWOLF':
                if (player.role === 'WEREWOLF') {
                    return (
                        <div className="night-action">
                            <h3>Werewolf Action</h3>
                            {game.nightActions.some(a => a.role === 'WEREWOLF' && a.result?.data?.canViewCenter) ? (
                                <div className="center-cards">
                                    <p>Choose one center card to view:</p>
                                    <div className="card-container">
                                        {[0, 1, 2].map(index => (
                                            <button
                                                key={index}
                                                onClick={() => handleWerewolfCenterCardView(index)}
                                                className="card"
                                            >
                                                Card {index + 1}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <p>Wait for other werewolves to wake up...</p>
                            )}
                        </div>
                    );
                }
                return <p>The Werewolves are waking up...</p>;
            case 'SEER':
                if (player.role === 'SEER') {
                    return (
                        <div className="night-action">
                            <h3>Seer Action</h3>
                            <p>Choose a player to view their card, or view two center cards:</p>
                            <div className="action-choices">
                                <div className="player-choices">
                                    <h4>View a player's card:</h4>
                                    {Object.values(game.players)
                                        .filter(p => p.id !== playerId)
                                        .map(p => (
                                            <button
                                                key={p.id}
                                                onClick={() => handleSeerAction(p.id, true)}
                                                className="action-button"
                                                disabled={isActionLoading}
                                            >
                                                {isActionLoading ? 'Submitting...' : p.name}
                                            </button>
                                        ))}
                                </div>
                                <div className="center-choices">
                                    <h4>View two center cards:</h4>
                                    <div className="card-container">
                                        {[0].map(index => (
                                            <button
                                                key={index}
                                                onClick={() => handleSeerAction(index, false)}
                                                className="action-button"
                                            >
                                                View Cards {index + 1} & {index + 2}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                }
                return <p>The Seer is looking for information...</p>;
            case 'ROBBER':
                if (player.role === 'ROBBER') {
                    return (
                        <div className="night-action">
                            <h3>Robber Action</h3>
                            <p>Choose a player to swap roles with:</p>
                            <div className="player-choices">
                                {Object.values(game.players)
                                    .filter(p => p.id !== playerId)
                                    .map(p => (
                                        <button
                                            key={p.id}
                                            onClick={() => handleRobberAction(p.id)}
                                            className="action-button"
                                            disabled={isActionLoading}
                                        >
                                            {isActionLoading ? 'Submitting...' : p.name}
                                        </button>
                                    ))}
                            </div>
                        </div>
                    );
                }
                return <p>The Robber is looking for someone to rob...</p>;
            case 'TROUBLEMAKER':
                if (player.role === 'TROUBLEMAKER') {
                    if (!troublemakerFirstTarget) {
                        return (
                            <div className="night-action">
                                <h3>Troublemaker Action</h3>
                                <p>Choose the first player to swap:</p>
                                <div className="player-choices">
                                    {Object.values(game.players)
                                        .filter(p => p.id !== playerId)
                                        .map(p => (
                                            <button
                                                key={p.id}
                                                onClick={() => setTroublemakerFirstTarget(p.id)}
                                                className="action-button"
                                                disabled={isActionLoading}
                                            >
                                                {isActionLoading ? 'Submitting...' : p.name}
                                            </button>
                                        ))}
                                </div>
                            </div>
                        );
                    }

                    return (
                        <div className="night-action">
                            <h3>Troublemaker Action</h3>
                            <p>Choose the second player to swap with {game.players[troublemakerFirstTarget].name}:</p>
                            <div className="player-choices">
                                {Object.values(game.players)
                                    .filter(p => p.id !== playerId && p.id !== troublemakerFirstTarget)
                                    .map(p => (
                                        <button
                                            key={p.id}
                                            onClick={() => {
                                                handleTroublemakerAction(troublemakerFirstTarget, p.id);
                                                setTroublemakerFirstTarget(null);
                                            }}
                                            className="action-button"
                                        >
                                            {p.name}
                                        </button>
                                    ))}
                            </div>
                        </div>
                    );
                }
                return <p>The Troublemaker is causing mischief...</p>;
            case 'DRUNK':
                if (player.role === 'DRUNK') {
                    return (
                        <div className="night-action">
                            <h3>Drunk Action</h3>
                            <p>Choose a center card to swap with:</p>
                            <div className="center-cards">
                                <div className="card-container">
                                    {[0, 1, 2].map(index => (
                                        <button
                                            key={index}
                                            onClick={() => handleDrunkAction(index)}
                                            className="card"
                                            disabled={isActionLoading}
                                        >
                                            {isActionLoading ? 'Submitting...' : `Card ${index + 1}`}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    );
                }
                return <p>The Drunk is stumbling around...</p>;
            case 'MASON':
                if (player.role === 'MASON') {
                    return (
                        <div className="night-action">
                            <h3>Mason Action</h3>
                            <p>Waiting to see other Masons...</p>
                        </div>
                    );
                }
                return <p>The Masons are identifying each other...</p>;
            case 'INSOMNIAC':
                if (player.role === 'INSOMNIAC') {
                    return (
                        <div className="night-action">
                            <h3>Insomniac Action</h3>
                            <p>Checking your final role...</p>
                        </div>
                    );
                }
                return <p>The Insomniac is checking their role...</p>;
            case 'DOPPELGANGER':
                if (player.role === 'DOPPELGANGER') {
                    return (
                        <div className="night-action">
                            <h3>Doppelganger Action</h3>
                            <p>Choose a player to copy their role:</p>
                            <div className="player-choices">
                                {Object.values(game.players)
                                    .filter(p => p.id !== playerId)
                                    .map(p => (
                                        <button
                                            key={p.id}
                                            onClick={() => handleDoppelgangerAction(p.id)}
                                            className="action-button"
                                            disabled={isActionLoading}
                                        >
                                            {isActionLoading ? 'Submitting...' : p.name}
                                        </button>
                                    ))}
                            </div>
                        </div>
                    );
                }
                return <p>The Doppelganger is choosing someone to copy...</p>;
            // Add other role cases here...
            default:
                return null;
        }
    };

    const DiscussionPhase: React.FC = () => {
        const onDiscussionComplete = () => {
            // The backend will handle the transition to voting
            logger.info('Discussion phase complete');
        };

        return (
            <div className="discussion-phase">
                <Timer duration={300} onComplete={onDiscussionComplete} />
                <h2>Discussion Time</h2>
                <p>Discuss with other players and try to figure out who the werewolves are!</p>
            </div>
        );
    };

    const renderGameContent = () => {
        switch (game?.state) {
            case 'VOTING':
                return (
                    <>
                        <Timer duration={60} />
                        {renderVotingPhase()}
                    </>
                );
            case 'DISCUSSION':
                return <DiscussionPhase />;
            case 'COMPLETE':
                return renderGameResults();
            default:
                return (
                    <div>
                        <h2>Game State: {game?.state}</h2>
                        <div>Your Role: {player?.role}</div>
                        {game?.currentAction && (
                            <>
                                <div>Current Action: {game.currentAction}</div>
                                {renderNightAction()}
                            </>
                        )}
                    </div>
                );
        }
    };

    if (!game || !player) {
        logger.debug('Game or player not yet loaded');
        return <div>Loading...</div>;
    }

    return (
        <div className="game-container">
            {renderPlayerList()}
            <div className="game-board">
                {renderGameContent()}
            </div>
        </div>
    );
}; 