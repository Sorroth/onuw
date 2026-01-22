/**
 * @fileoverview Strategy Pattern interface for night actions.
 * @module patterns/strategy/NightAction
 *
 * @summary Defines the contract for all role night actions.
 *
 * @description
 * The Strategy Pattern is used to encapsulate each role's night action.
 * This allows:
 * - Each role's behavior to be defined independently
 * - Easy addition of new roles
 * - Clean separation of action logic from game logic
 * - Testing of individual actions in isolation
 *
 * @pattern Strategy Pattern
 * - Strategy: INightAction interface
 * - ConcreteStrategies: WerewolfAction, SeerAction, RobberAction, etc.
 * - Context: Role class that holds and delegates to a night action
 *
 * @remarks
 * Night actions may:
 * - View cards (Seer, Werewolf lone wolf, Insomniac)
 * - Swap cards (Robber, Troublemaker, Drunk)
 * - Gain information (Mason, Minion)
 * - Copy abilities (Doppelganger)
 * - Do nothing (Villager, Hunter, Tanner)
 *
 * @example
 * ```typescript
 * const seerAction: INightAction = new SeerAction();
 * const result = await seerAction.execute(context, agent, gameState);
 * // Result contains what the Seer saw
 * ```
 */

import { RoleName } from '../../enums';
import { NightActionResult, NightActionContext } from '../../types';

/**
 * Forward declaration for game state access during night actions.
 * The actual implementation provides controlled access to game state.
 */
export interface INightActionGameState {
  /** Get a player's current role */
  getPlayerRole(playerId: string): RoleName;

  /** Get a center card role */
  getCenterCard(index: number): RoleName;

  /** Swap two card positions */
  swapCards(pos1: CardPosition, pos2: CardPosition): void;

  /** Get all player IDs with a specific role */
  getPlayersWithRole(roleName: RoleName): string[];

  /** Get all player IDs */
  getAllPlayerIds(): string[];
}

/**
 * Position specification for card operations.
 */
export interface CardPosition {
  /** Player ID for player positions */
  playerId?: string;
  /** Index 0-2 for center positions */
  centerIndex?: number;
}

/**
 * Agent interface for night action decisions.
 * Agents provide the decision-making for choosing targets.
 */
export interface INightActionAgent {
  /** Agent's player ID */
  readonly id: string;

  /**
   * Select a player target from available options.
   * @param options Available player IDs to choose from
   * @param context Context about why selection is needed
   * @returns Selected player ID
   */
  selectPlayer(options: string[], context: NightActionContext): Promise<string>;

  /**
   * Select a center card (0, 1, or 2).
   * @param context Context about why selection is needed
   * @returns Center card index (0-2)
   */
  selectCenterCard(context: NightActionContext): Promise<number>;

  /**
   * Select two center cards for Seer ability.
   * @param context Context about why selection is needed
   * @returns Tuple of two center card indices
   */
  selectTwoCenterCards(context: NightActionContext): Promise<[number, number]>;

  /**
   * Choose between viewing a player or center cards (Seer choice).
   * @param context Context about why selection is needed
   * @returns 'player' or 'center'
   */
  chooseSeerOption(context: NightActionContext): Promise<'player' | 'center'>;

  /**
   * Select two different players (for Troublemaker).
   * @param options Available player IDs to choose from
   * @param context Context about why selection is needed
   * @returns Tuple of two player IDs
   */
  selectTwoPlayers(options: string[], context: NightActionContext): Promise<[string, string]>;
}

/**
 * @summary Interface for night action strategies.
 *
 * @description
 * Each role's night action implements this interface. The execute method
 * is called during the night phase when that role wakes.
 *
 * @pattern Strategy Pattern - This is the Strategy interface
 * @pattern Null Object Pattern - NoAction implements this for roles with no action
 *
 * @remarks
 * The action receives:
 * - Context: Information the player knows (their ID, starting role, etc.)
 * - Agent: Decision-maker for choosing targets
 * - GameState: Controlled access to view/modify game state
 *
 * @example
 * ```typescript
 * class SeerAction implements INightAction {
 *   getRoleName(): RoleName { return RoleName.SEER; }
 *   getNightOrder(): number { return 5; }
 *
 *   async execute(context, agent, gameState): Promise<NightActionResult> {
 *     const choice = await agent.chooseSeerOption(context);
 *     if (choice === 'player') {
 *       const targetId = await agent.selectPlayer(options, context);
 *       const role = gameState.getPlayerRole(targetId);
 *       return { viewed: [{ playerId: targetId, role }], ... };
 *     }
 *     // ... handle center viewing
 *   }
 * }
 * ```
 */
export interface INightAction {
  /**
   * @summary Gets the role name this action belongs to.
   *
   * @returns {RoleName} The role this action is for
   *
   * @example
   * ```typescript
   * seerAction.getRoleName(); // RoleName.SEER
   * ```
   */
  getRoleName(): RoleName;

  /**
   * @summary Gets the night wake order for this action.
   *
   * @description
   * Returns the position in the night wake sequence (1-9).
   * Returns -1 for roles with no night action.
   *
   * @returns {number} Night order (1-9) or -1 if no night action
   *
   * @remarks
   * Night order determines when the role acts:
   * 1. Doppelganger
   * 2. Werewolf
   * 3. Minion
   * 4. Mason
   * 5. Seer
   * 6. Robber
   * 7. Troublemaker
   * 8. Drunk
   * 9. Insomniac
   *
   * @example
   * ```typescript
   * seerAction.getNightOrder(); // 5
   * villagerAction.getNightOrder(); // -1
   * ```
   */
  getNightOrder(): number;

  /**
   * @summary Executes the night action.
   *
   * @description
   * Performs the role's night ability. This may involve:
   * - Viewing cards
   * - Swapping cards
   * - Gaining information
   * - Doing nothing (Null Object)
   *
   * @param {NightActionContext} context - What the player knows
   * @param {INightActionAgent} agent - Decision-maker for choices
   * @param {INightActionGameState} gameState - Game state access
   *
   * @returns {Promise<NightActionResult>} The result of the action
   *
   * @throws {Error} If the action fails (invalid target, etc.)
   *
   * @remarks
   * The agent makes all decisions (which player to view, etc.).
   * This allows both AI and human players to use the same action code.
   *
   * @example
   * ```typescript
   * const result = await seerAction.execute(context, agent, gameState);
   * // result.viewed contains what the Seer saw
   * ```
   */
  execute(
    context: NightActionContext,
    agent: INightActionAgent,
    gameState: INightActionGameState
  ): Promise<NightActionResult>;

  /**
   * @summary Gets a description of this action.
   *
   * @description
   * Human-readable description of what this action does.
   * Used for logging and UI display.
   *
   * @returns {string} Description of the action
   *
   * @example
   * ```typescript
   * seerAction.getDescription();
   * // "Look at one player's card OR two center cards"
   * ```
   */
  getDescription(): string;
}

/**
 * @summary Abstract base class for night actions.
 *
 * @description
 * Provides common functionality for night actions.
 * Concrete actions extend this class.
 *
 * @pattern Strategy Pattern - Abstract Strategy
 * @pattern Template Method Pattern - Provides execute template
 *
 * @example
 * ```typescript
 * class SeerAction extends AbstractNightAction {
 *   getRoleName(): RoleName { return RoleName.SEER; }
 *   getNightOrder(): number { return 5; }
 *   getDescription(): string { return "Look at one player's card OR two center cards"; }
 *
 *   protected async doExecute(context, agent, gameState): Promise<NightActionResult> {
 *     // Seer-specific logic
 *   }
 * }
 * ```
 */
export abstract class AbstractNightAction implements INightAction {
  /**
   * @summary Gets the role name.
   * @abstract Must be implemented by concrete classes.
   */
  abstract getRoleName(): RoleName;

  /**
   * @summary Gets the night order.
   * @abstract Must be implemented by concrete classes.
   */
  abstract getNightOrder(): number;

  /**
   * @summary Gets the action description.
   * @abstract Must be implemented by concrete classes.
   */
  abstract getDescription(): string;

  /**
   * @summary Executes the night action with validation.
   *
   * @description
   * Template method that validates context before delegating
   * to the concrete implementation.
   *
   * @param {NightActionContext} context - What the player knows
   * @param {INightActionAgent} agent - Decision-maker for choices
   * @param {INightActionGameState} gameState - Game state access
   *
   * @returns {Promise<NightActionResult>} The result of the action
   *
   * @throws {Error} If context is invalid
   */
  async execute(
    context: NightActionContext,
    agent: INightActionAgent,
    gameState: INightActionGameState
  ): Promise<NightActionResult> {
    // Validate context
    this.validateContext(context);

    // Delegate to concrete implementation
    return this.doExecute(context, agent, gameState);
  }

  /**
   * @summary Validates the action context.
   *
   * @description
   * Ensures the context has required fields.
   * Override in subclasses for role-specific validation.
   *
   * @param {NightActionContext} context - The context to validate
   *
   * @throws {Error} If context is invalid
   *
   * @protected
   */
  protected validateContext(context: NightActionContext): void {
    if (!context.myPlayerId) {
      throw new Error('NightActionContext must have myPlayerId');
    }
    if (!context.allPlayerIds || context.allPlayerIds.length === 0) {
      throw new Error('NightActionContext must have allPlayerIds');
    }
  }

  /**
   * @summary Concrete implementation of the night action.
   *
   * @description
   * Override this method in concrete classes to implement
   * the role-specific night action logic.
   *
   * @param {NightActionContext} context - What the player knows
   * @param {INightActionAgent} agent - Decision-maker for choices
   * @param {INightActionGameState} gameState - Game state access
   *
   * @returns {Promise<NightActionResult>} The result of the action
   *
   * @protected
   * @abstract
   */
  protected abstract doExecute(
    context: NightActionContext,
    agent: INightActionAgent,
    gameState: INightActionGameState
  ): Promise<NightActionResult>;

  /**
   * @summary Creates a success result.
   *
   * @description
   * Helper method for creating successful action results.
   *
   * @param {Partial<NightActionResult>} partial - Partial result to complete
   *
   * @returns {NightActionResult} Complete success result
   *
   * @protected
   */
  protected createSuccessResult(
    actorId: string,
    info: NightActionResult['info']
  ): NightActionResult {
    return {
      actorId,
      roleName: this.getRoleName(),
      actionType: this.getActionType(),
      success: true,
      info
    };
  }

  /**
   * @summary Creates a failure result.
   *
   * @description
   * Helper method for creating failed action results.
   *
   * @param {string} actorId - The actor's player ID
   * @param {string} error - Error message
   *
   * @returns {NightActionResult} Complete failure result
   *
   * @protected
   */
  protected createFailureResult(actorId: string, error: string): NightActionResult {
    return {
      actorId,
      roleName: this.getRoleName(),
      actionType: 'NONE',
      success: false,
      info: {},
      error
    };
  }

  /**
   * @summary Gets the action type for this night action.
   *
   * @description
   * Override in subclasses if needed. Default is 'VIEW'.
   *
   * @returns {'VIEW' | 'SWAP' | 'NONE'} The action type
   *
   * @protected
   */
  protected getActionType(): 'VIEW' | 'SWAP' | 'NONE' {
    return 'VIEW';
  }
}
