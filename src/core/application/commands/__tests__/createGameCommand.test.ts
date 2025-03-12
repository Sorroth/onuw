import { CreateGameCommand } from '../createGameCommand';
import { InMemoryGameRepository } from '../../../../adapters/repositories/inMemoryGameRepository';
import { InMemoryEventBus } from '../../../../adapters/services/inMemoryEventBus';
import { Role } from '../../../domain/entities/role';
import { GameCreatedEvent } from '../../../domain/events/gameEvent';

describe('CreateGameCommand', () => {
  let gameRepository: InMemoryGameRepository;
  let eventBus: InMemoryEventBus;
  let createGameCommand: CreateGameCommand;

  beforeEach(() => {
    gameRepository = new InMemoryGameRepository();
    eventBus = new InMemoryEventBus();
    createGameCommand = new CreateGameCommand(gameRepository, eventBus);
  });

  it('should create a game with the correct parameters', async () => {
    // Arrange
    const roleList = [Role.Werewolf, Role.Seer, Role.Robber, Role.Villager, Role.Tanner];
    const playerCount = 3;
    const centerCardCount = 2;
    let publishedEvent: GameCreatedEvent | null = null;
    
    eventBus.subscribe('GAME_CREATED', (event) => {
      publishedEvent = event as GameCreatedEvent;
    });

    // Act
    const gameId = await createGameCommand.execute({
      roleList,
      playerCount,
      centerCardCount
    });

    // Assert
    expect(gameId).toBeDefined();
    
    const game = await gameRepository.findById(gameId);
    expect(game).not.toBeNull();
    
    const gameState = game!.getState();
    expect(gameState.roles).toEqual(roleList);
    expect(gameState.players).toHaveLength(0); // No players added yet
    
    // Check that the event was published
    expect(publishedEvent).not.toBeNull();
    expect(publishedEvent!.type).toBe('GAME_CREATED');
    expect(publishedEvent!.gameId).toBe(gameId);
    expect(publishedEvent!.roles).toEqual(roleList);
  });

  it('should throw an error if the number of roles does not match player count plus center card count', async () => {
    // Arrange
    const roleList = [Role.Werewolf, Role.Seer, Role.Robber];
    const playerCount = 3;
    const centerCardCount = 2;

    // Act & Assert
    await expect(createGameCommand.execute({
      roleList,
      playerCount,
      centerCardCount
    })).rejects.toThrow('Number of roles must equal player count plus center card count');
  });
}); 