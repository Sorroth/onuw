import { Game } from '../../core/domain/entities/game';
import { GameRepository } from '../../core/application/ports/repositories/gameRepository';
import { GamePhase } from '../../core/domain/valueObjects/gamePhase';

/**
 * In-memory implementation of the GameRepository interface
 * Used for testing and development
 */
export class InMemoryGameRepository implements GameRepository {
  private games: Map<string, Game> = new Map();

  /**
   * Save a game to the in-memory store
   */
  public async save(game: Game): Promise<void> {
    this.games.set(game.getId(), game);
  }

  /**
   * Find a game by ID
   */
  public async findById(id: string): Promise<Game | null> {
    return this.games.get(id) || null;
  }

  /**
   * Find all active games (games not in the End phase)
   */
  public async findActive(): Promise<Game[]> {
    return Array.from(this.games.values()).filter(game => {
      const state = game.getState();
      return state.phase !== GamePhase.End;
    });
  }

  /**
   * Delete a game from the in-memory store
   */
  public async delete(id: string): Promise<void> {
    this.games.delete(id);
  }
} 