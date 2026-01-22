/**
 * @fileoverview State Pattern exports for game phases.
 * @module patterns/state
 *
 * @summary Exports all game phase state classes and interfaces.
 *
 * @description
 * This module provides the State Pattern implementation for managing
 * game phases in One Night Ultimate Werewolf. The game progresses
 * through five sequential phases:
 *
 * 1. **Setup** - Roles dealt, center cards placed
 * 2. **Night** - Roles wake and perform actions
 * 3. **Day** - Players discuss and make claims
 * 4. **Voting** - Players vote to eliminate
 * 5. **Resolution** - Winners determined
 *
 * @pattern State Pattern
 * - Eliminates phase-specific conditionals in Game class
 * - Each phase encapsulates its own behavior
 * - Easy to understand and extend
 *
 * @example
 * ```typescript
 * import {
 *   IGamePhaseState,
 *   SetupPhase,
 *   NightPhase,
 *   DayPhase,
 *   VotingPhase,
 *   ResolutionPhase
 * } from './patterns/state';
 *
 * // Game starts in setup phase
 * let currentPhase: IGamePhaseState = new SetupPhase();
 *
 * // Execute and transition through phases
 * while (currentPhase !== null) {
 *   await currentPhase.enter(gameContext);
 *   await currentPhase.execute(gameContext);
 *   await currentPhase.exit(gameContext);
 *   currentPhase = currentPhase.getNextState();
 * }
 * ```
 */

// Interface and abstract base
export {
  IGamePhaseState,
  IGameContext,
  AbstractGamePhaseState
} from './GamePhaseState';

// Concrete phase states
export { SetupPhase } from './SetupPhase';
export { NightPhase } from './NightPhase';
export { DayPhase } from './DayPhase';
export { VotingPhase } from './VotingPhase';
export { ResolutionPhase } from './ResolutionPhase';
