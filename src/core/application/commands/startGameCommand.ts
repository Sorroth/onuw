import { GameState } from '../../domain/valueObjects/gameState';
import { GameRepository } from '../ports/repositories/gameRepository';
import { EventBus } from '../ports/services/eventBus';

export interface StartGameCommandParams {
  gameId: string;
}

/**
 * Command to start a game
 */
export class StartGameCommand {
  constructor(
    private readonly gameRepository: GameRepository,
    private readonly eventBus: EventBus
  ) {}

  /**
   * Execute the command
   */
  public async execute(params: StartGameCommandParams): Promise<GameState> {
    // Find the game
    const game = await this.gameRepository.findById(params.gameId);
    if (!game) {
      throw new Error(`Game with ID ${params.gameId} not found`);
    }

    // Start the game
    const gameState = game.startGame();

    // Save the game
    await this.gameRepository.save(game);

    // Publish events
    for (const event of game.getEvents()) {
      await this.eventBus.publish(event);
    }

    return gameState;
  }
} 