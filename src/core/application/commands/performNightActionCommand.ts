import { GameState } from '../../domain/valueObjects/gameState';
import { NightActionType } from '../../domain/valueObjects/nightAction';
import { GameRepository } from '../ports/repositories/gameRepository';
import { EventBus } from '../ports/services/eventBus';

export interface PerformNightActionCommandParams {
  gameId: string;
  playerId: string;
  actionType: NightActionType;
  targetPlayerId?: string;
  targetPlayerIds?: string[];
  centerCardIndices?: number[];
}

/**
 * Command to perform a night action
 */
export class PerformNightActionCommand {
  constructor(
    private readonly gameRepository: GameRepository,
    private readonly eventBus: EventBus
  ) {}

  /**
   * Execute the command
   */
  public async execute(params: PerformNightActionCommandParams): Promise<GameState> {
    // Find the game
    const game = await this.gameRepository.findById(params.gameId);
    if (!game) {
      throw new Error(`Game with ID ${params.gameId} not found`);
    }

    // Perform the night action
    const gameState = game.performNightAction(
      params.playerId,
      params.actionType,
      {
        targetPlayerId: params.targetPlayerId,
        targetPlayerIds: params.targetPlayerIds,
        centerCardIndices: params.centerCardIndices
      }
    );

    // Save the game
    await this.gameRepository.save(game);

    // Publish events
    for (const event of game.getEvents()) {
      await this.eventBus.publish(event);
    }

    return gameState;
  }
} 