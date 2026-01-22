/**
 * @fileoverview Agent system exports.
 * @module agents
 *
 * @summary Exports all agent types for game players.
 *
 * @description
 * This module provides different agent implementations:
 * - IAgent/AbstractAgent: Base interface and class
 * - RandomAgent: Random valid decisions (testing)
 * - AIAgent: Strategic reasoning-based decisions
 * - RuleEnforcer: Validation wrapper
 *
 * @example
 * ```typescript
 * import { AIAgent, RuleEnforcer, RandomAgent } from './agents';
 *
 * // Create agents for a game
 * const agents = new Map();
 * agents.set('player-1', new AIAgent('player-1', RoleName.SEER));
 * agents.set('player-2', new RuleEnforcer(new RandomAgent('player-2')));
 *
 * game.registerAgents(agents);
 * ```
 */

// Base interface and abstract class
export { IAgent, AbstractAgent } from './Agent';

// Concrete agent implementations
export { RandomAgent } from './RandomAgent';
export { AIAgent } from './AIAgent';

// Validation wrapper
export { RuleEnforcer, RuleViolationError } from './RuleEnforcer';
