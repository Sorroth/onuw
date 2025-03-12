import React, { useEffect, useState } from 'react';
import { logger } from '../services/logger';
import './GameList.css';

interface GameSummary {
    id: string;
    playerCount: number;
    state: string;
}

interface GameListProps {
    onSelectGame: (gameId: string) => void;
    isVisible: boolean;
    onToggleVisibility: () => void;
}

export const GameList: React.FC<GameListProps> = ({ onSelectGame, isVisible, onToggleVisibility }) => {
    const [games, setGames] = useState<GameSummary[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [hasError, setHasError] = useState(false);

    const fetchGames = async () => {
        try {
            const response = await fetch('http://localhost:8080/api/games');
            if (!response.ok) {
                throw new Error('Failed to fetch games');
            }
            const data = await response.json();
            setGames(data);
            setHasError(false);
        } catch (error) {
            setHasError(true);
            logger.error('Error fetching games:', error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (!isVisible) return;
        fetchGames();
        // Poll for new games every 5 seconds
        const interval = setInterval(fetchGames, 5000);
        return () => clearInterval(interval);
    }, [isVisible]);

    if (!isVisible) {
        return (
            <button className="view-games-button" onClick={onToggleVisibility}>
                View Available Games
            </button>
        );
    }

    if (isLoading) return null;
    if (hasError) return null;
    if (games.length === 0) {
        return (
            <div className="no-games">
                <p>No games available to join</p>
                <button className="back-button" onClick={onToggleVisibility}>
                    Back
                </button>
            </div>
        );
    }

    return (
        <>
            <div className="game-list">
                <h3>Available Games</h3>
                {games.map(game => (
                    <div key={game.id} className="game-item" onClick={() => onSelectGame(game.id)}>
                        <span className="game-id">Game: {game.id}</span>
                        <span className="player-count">Players: {game.playerCount}</span>
                    </div>
                ))}
                <button className="back-button" onClick={onToggleVisibility}>
                    Back
                </button>
            </div>
        </>
    );
}; 