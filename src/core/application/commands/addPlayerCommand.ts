import { GameRepository } from '../ports/repositories/gameRepository';
import { EventBus } from '../ports/services/eventBus';

export interface AddPlayerCommandParams {
  gameId: string;
  playerName: string;
}

/**
 * Command to add a player to a game
 */
export class AddPlayerCommand {
  constructor(
    private readonly gameRepository: GameRepository,
    private readonly eventBus: EventBus
  ) {}

  /**
   * Execute the command
   */
  public async execute(params: AddPlayerCommandParams): Promise<string> {
    // Find the game
    const game = await this.gameRepository.findById(params.gameId);
    if (!game) {
      throw new Error(`Game with ID ${params.gameId} not found`);
    }

    // Add the player
    const playerId = game.addPlayer(params.playerName);

    // Save the game
    await this.gameRepository.save(game);

    // Publish events
    for (const event of game.getEvents()) {
      await this.eventBus.publish(event);
    }

    return playerId;
  }
} 