import { GameState } from '../../domain/valueObjects/gameState';
import { GameRepository } from '../ports/repositories/gameRepository';

export interface GetGameStateQueryParams {
  gameId: string;
}

/**
 * Query to get the current state of a game
 */
export class GetGameStateQuery {
  constructor(
    private readonly gameRepository: GameRepository
  ) {}

  /**
   * Execute the query
   */
  public async execute(params: GetGameStateQueryParams): Promise<GameState> {
    // Find the game
    const game = await this.gameRepository.findById(params.gameId);
    if (!game) {
      throw new Error(`Game with ID ${params.gameId} not found`);
    }

    // Return the game state
    return game.getState();
  }
} 