/**
 * @fileoverview Design patterns exports.
 * @module patterns
 *
 * @summary Exports all design pattern implementations used in ONUW.
 *
 * @description
 * This module provides a unified export point for all design patterns:
 * - **State Pattern**: Game phase management
 * - **Strategy Pattern**: Night actions and win conditions
 * - **Factory Method Pattern**: Role creation
 * - **Command Pattern**: Action logging
 * - **Observer Pattern**: Event system
 *
 * @example
 * ```typescript
 * import {
 *   // State Pattern
 *   IGamePhaseState, SetupPhase, NightPhase,
 *
 *   // Strategy Pattern
 *   INightAction, SeerAction, VillageWinCondition,
 *
 *   // Factory Method
 *   RoleFactory,
 *
 *   // Command Pattern
 *   SwapAction, ViewAction, VoteAction,
 *
 *   // Observer Pattern
 *   GameEventEmitter, ConsoleObserver
 * } from './patterns';
 * ```
 */

// State Pattern - Game phases
export * from './state';

// Strategy Pattern - Night actions and win conditions
export * from './strategy';

// Factory Method Pattern - Role creation
export * from './factory';

// Command Pattern - Action logging
export * from './command';

// Observer Pattern - Event system
export * from './observer';
