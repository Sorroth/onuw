import { GameState } from '../../domain/valueObjects/gameState';
import { GameRepository } from '../ports/repositories/gameRepository';

/**
 * Query to get all active games
 */
export class GetActiveGamesQuery {
  constructor(
    private readonly gameRepository: GameRepository
  ) {}

  /**
   * Execute the query
   */
  public async execute(): Promise<GameState[]> {
    // Find all active games
    const games = await this.gameRepository.findActive();
    
    // Return the game states
    return games.map(game => game.getState());
  }
} 