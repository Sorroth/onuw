import { Game } from '../../domain/entities/game';
import { Role } from '../../domain/entities/role';
import { GameRepository } from '../ports/repositories/gameRepository';
import { EventBus } from '../ports/services/eventBus';

export interface CreateGameCommandParams {
  roleList: Role[];
  playerCount: number;
  centerCardCount: number;
}

/**
 * Command to create a new game
 */
export class CreateGameCommand {
  constructor(
    private readonly gameRepository: GameRepository,
    private readonly eventBus: EventBus
  ) {}

  /**
   * Execute the command
   */
  public async execute(params: CreateGameCommandParams): Promise<string> {
    // Validate parameters
    if (params.playerCount + params.centerCardCount !== params.roleList.length) {
      throw new Error('Number of roles must equal player count plus center card count');
    }

    // Create a new game
    const game = new Game({
      roleList: params.roleList,
      playerCount: params.playerCount,
      centerCardCount: params.centerCardCount
    });

    // Save the game
    await this.gameRepository.save(game);

    // Publish events
    for (const event of game.getEvents()) {
      await this.eventBus.publish(event);
    }

    return game.getId();
  }
} 