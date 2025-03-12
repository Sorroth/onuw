import React, { useState } from 'react';
import { Game } from 'components/Game';
import { GameList } from 'components/GameList';
import { logger } from 'services/logger';
import { Game as GameType } from './types/game';
import './App.css';
import { WaitingRoom } from './components/WaitingRoom';

function App() {
    const [gameId, setGameId] = useState<string>('');
    const [playerName, setPlayerName] = useState('');
    const [playerId, setPlayerId] = useState<string>('');
    const [isJoined, setIsJoined] = useState(false);
    const [isNameEntered, setIsNameEntered] = useState(false);
    const [game, setGame] = useState<GameType | null>(null);
    const [showGames, setShowGames] = useState(false);

    const handleNameSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (playerName.trim()) {
            setIsNameEntered(true);
        }
    };

    const createGame = async () => {
        try {
            const response = await fetch('http://localhost:8080/api/games', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ playerName }),
            });
            if (!response.ok) {
                const error = await response.text();
                throw new Error(error);
            }
            const data = await response.json();
            setGameId(data.gameId);
            logger.info('Created game:', data);
            await joinGame(data.gameId);
        } catch (error) {
            logger.error('Error creating game:', error);
        }
    };

    const handleJoinGame = async () => {
        await joinGame(gameId);
    };

    const joinGame = async (gameIdToJoin: string) => {
        if (!gameIdToJoin || !playerName) {
            logger.warn('Game ID and player name are required');
            return;
        }

        try {
            const response = await fetch(`http://localhost:8080/api/games/${gameIdToJoin}/join`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ name: playerName }),
            });
            const data = await response.json();
            setPlayerId(data.playerId);
            setIsJoined(true);
            logger.info('Joined game:', data);
        } catch (error) {
            logger.error('Error joining game:', error);
        }
    };

    if (isJoined) {
        if (game?.state === 'WAITING') {
            return <WaitingRoom gameId={gameId} playerId={playerId} />;
        }
        return <Game gameId={gameId} playerId={playerId} />;
    }

    return (
        <div className="App">
            <h1>One Night Ultimate Werewolf</h1>
            {!isNameEntered ? (
                <form className="name-form" onSubmit={handleNameSubmit}>
                    <input
                        type="text"
                        placeholder="Enter Your Name"
                        value={playerName}
                        onChange={(e) => setPlayerName(e.target.value)}
                        required
                    />
                    <button type="submit">Continue</button>
                </form>
            ) : (
                <div className="game-form">
                    <button onClick={createGame}>Create New Game</button>
                    <GameList 
                        onSelectGame={setGameId}
                        isVisible={showGames}
                        onToggleVisibility={() => setShowGames(!showGames)}
                    />
                    {gameId && (
                        <>
                            <p className="game-id">Game ID: {gameId}</p>
                            <div className="input-group">
                                <button onClick={handleJoinGame}>Join Game</button>
                            </div>
                        </>
                    )}
                </div>
            )}
        </div>
    );
}

export default App; 