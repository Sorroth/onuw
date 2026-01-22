/**
 * @fileoverview Observer Pattern exports.
 * @module patterns/observer
 *
 * @summary Exports observer pattern implementations for game events.
 *
 * @description
 * This module provides the Observer Pattern implementation for
 * broadcasting game events to interested parties.
 *
 * @pattern Observer Pattern
 * - Subject: GameEventEmitter
 * - Observer: IGameObserver interface
 * - ConcreteObservers: ConsoleObserver, etc.
 *
 * @example
 * ```typescript
 * import {
 *   GameEventEmitter,
 *   IGameObserver,
 *   ConsoleObserver
 * } from './patterns/observer';
 *
 * // Set up event system
 * const emitter = new GameEventEmitter();
 * emitter.addObserver(new ConsoleObserver());
 *
 * // Emit events from game
 * emitter.emitGameStarted(playerIds, roleNames);
 * emitter.emitPhaseChanged(GamePhase.SETUP, GamePhase.NIGHT);
 * ```
 */

// Event emitter (Subject)
export { GameEventEmitter, GameEvent, IGameObserver, GameEventType } from './GameObserver';

// Concrete observers
export { ConsoleObserver } from './ConsoleObserver';
