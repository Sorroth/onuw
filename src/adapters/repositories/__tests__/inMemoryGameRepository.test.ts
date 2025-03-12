import { InMemoryGameRepository } from '../inMemoryGameRepository';
import { Game } from '../../../core/domain/entities/game';
import { Role } from '../../../core/domain/entities/role';
import { GamePhase } from '../../../core/domain/valueObjects/gamePhase';

// Mock the Game class to avoid UUID randomness in tests
jest.mock('../../../core/domain/entities/game', () => {
  return {
    Game: jest.fn().mockImplementation((config) => {
      const mockId = 'test-game-id';
      return {
        getId: () => mockId,
        getState: () => ({
          players: [],
          centerCards: [],
          roles: config.roleList,
          nightActionLog: [],
          phase: GamePhase.Setup
        })
      };
    })
  };
});

describe('InMemoryGameRepository', () => {
  let repository: InMemoryGameRepository;
  let game: Game;

  beforeEach(() => {
    repository = new InMemoryGameRepository();
    game = new Game({
      roleList: [Role.Werewolf, Role.Seer, Role.Villager],
      playerCount: 2,
      centerCardCount: 1
    });
  });

  it('should save and find a game by ID', async () => {
    // Arrange
    const gameId = game.getId();

    // Act
    await repository.save(game);
    const foundGame = await repository.findById(gameId);

    // Assert
    expect(foundGame).not.toBeNull();
    expect(foundGame!.getId()).toBe(gameId);
  });

  it('should return null when finding a non-existent game', async () => {
    // Act
    const foundGame = await repository.findById('non-existent-id');

    // Assert
    expect(foundGame).toBeNull();
  });

  it('should find active games', async () => {
    // Arrange
    await repository.save(game);

    // Act
    const activeGames = await repository.findActive();

    // Assert
    expect(activeGames).toHaveLength(1);
    expect(activeGames[0].getId()).toBe(game.getId());
  });

  it('should delete a game', async () => {
    // Arrange
    const gameId = game.getId();
    await repository.save(game);

    // Act
    await repository.delete(gameId);
    const foundGame = await repository.findById(gameId);

    // Assert
    expect(foundGame).toBeNull();
  });
}); 