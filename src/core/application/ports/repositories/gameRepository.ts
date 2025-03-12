import { Game } from '../../../domain/entities/game';

/**
 * Repository interface for Game entities
 */
export interface GameRepository {
  /**
   * Save a game
   */
  save(game: Game): Promise<void>;
  
  /**
   * Find a game by ID
   */
  findById(id: string): Promise<Game | null>;
  
  /**
   * Find all active games
   */
  findActive(): Promise<Game[]>;
  
  /**
   * Delete a game
   */
  delete(id: string): Promise<void>;
} 