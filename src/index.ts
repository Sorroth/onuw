/**
 * @fileoverview One Night Ultimate Werewolf - Main Entry Point
 * @module onuw
 *
 * @summary Complete game engine for One Night Ultimate Werewolf.
 *
 * @description
 * This module provides a fully-functional ONUW game engine featuring:
 * - Complete role implementation (12 roles)
 * - Multiple design patterns (State, Strategy, Factory, Command, Observer)
 * - AI agent system for automated play
 * - Comprehensive audit logging
 * - Rule enforcement
 *
 * @example
 * ```typescript
 * import { runGame, RoleName } from './index';
 *
 * // Run a 5-player game
 * const result = await runGame({
 *   players: ['Alice', 'Bob', 'Charlie', 'Diana', 'Eve'],
 *   roles: [
 *     RoleName.WEREWOLF, RoleName.WEREWOLF,
 *     RoleName.SEER, RoleName.ROBBER, RoleName.TROUBLEMAKER,
 *     RoleName.VILLAGER, RoleName.VILLAGER, RoleName.DRUNK
 *   ]
 * });
 *
 * console.log('Winners:', result.winningTeams);
 * ```
 */

// ============================================================================
// ENUMS
// ============================================================================
export {
  GamePhase,
  Team,
  RoleName,
  NIGHT_WAKE_ORDER,
  NO_NIGHT_ACTION_ROLES
} from './enums';

// ============================================================================
// TYPES
// ============================================================================
export {
  IRole,
  IPlayer,
  GameState,
  GameConfig,
  GameResult,
  NightActionResult,
  NightActionInfo,
  NightActionContext,
  DayContext,
  VotingContext,
  PlayerStatement,
  ViewedCard,
  SwapInfo,
  CardPosition,
  AuditEntry,
  CircularCheckResult,
  GameEvent,
  GameEventType,
  IGameObserver,
  SeerChoice,
  TroublemakerChoice,
  SelectionOptions,
  isPlayerPosition,
  isCenterPosition
} from './types';

// ============================================================================
// CORE
// ============================================================================
export {
  Role,
  ROLE_TEAMS,
  NIGHT_ORDERS,
  ROLE_DESCRIPTIONS,
  Player,
  Game,
  IGameAgent
} from './core';

// ============================================================================
// PATTERNS
// ============================================================================
export {
  // State Pattern
  IGamePhaseState,
  IGameContext,
  AbstractGamePhaseState,
  SetupPhase,
  NightPhase,
  DayPhase,
  VotingPhase,
  ResolutionPhase,

  // Strategy Pattern - Night Actions
  INightAction,
  INightActionAgent,
  INightActionGameState,
  AbstractNightAction,
  DoppelgangerAction,
  WerewolfAction,
  MinionAction,
  MasonAction,
  SeerAction,
  RobberAction,
  TroublemakerAction,
  DrunkAction,
  InsomniacAction,
  NoAction,

  // Strategy Pattern - Win Conditions
  IWinCondition,
  AbstractWinCondition,
  WinConditionContext,
  WinConditionResult,
  PlayerWinInfo,
  VillageWinCondition,
  WerewolfWinCondition,
  TannerWinCondition,

  // Factory Pattern
  RoleFactory,

  // Command Pattern
  IGameAction,
  AbstractGameAction,
  SwapAction,
  ViewAction,
  VoteAction,

  // Observer Pattern
  GameEventEmitter,
  ConsoleObserver
} from './patterns';

// ============================================================================
// AUDIT
// ============================================================================
export {
  AuditLog,
  GameStateSnapshot,
  CircularDetector
} from './audit';

// ============================================================================
// AGENTS
// ============================================================================
export {
  IAgent,
  AbstractAgent,
  RandomAgent,
  AIAgent,
  RuleEnforcer,
  RuleViolationError
} from './agents';

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

import { Game, IGameAgent } from './core';
import { GameConfig, GameResult } from './types';
import { RoleName } from './enums';
import { AIAgent, RuleEnforcer } from './agents';
import { AuditLog } from './audit';
import { ConsoleObserver } from './patterns';
import { RoleFactory } from './patterns';

/**
 * @summary Runs a complete game with AI agents.
 *
 * @description
 * Convenience function to run a game with default AI agents.
 * Each player gets an AIAgent wrapped in RuleEnforcer.
 *
 * @param {GameConfig} config - Game configuration
 * @param {object} [options] - Optional settings
 * @param {boolean} [options.verbose=true] - Log to console
 * @param {boolean} [options.audit=true] - Enable audit logging
 *
 * @returns {Promise<{ result: GameResult; auditLog?: AuditLog }>}
 *
 * @example
 * ```typescript
 * const { result, auditLog } = await runGame({
 *   players: ['Alice', 'Bob', 'Charlie', 'Diana', 'Eve'],
 *   roles: [RoleName.WEREWOLF, RoleName.WEREWOLF, ...]
 * });
 * ```
 */
export async function runGame(
  config: GameConfig,
  options: { verbose?: boolean; audit?: boolean } = {}
): Promise<{ result: GameResult; auditLog?: AuditLog }> {
  const { verbose = true, audit = true } = options;

  // Create game
  const game = new Game(config);

  // Set up audit log
  let auditLog: AuditLog | undefined;
  if (audit) {
    auditLog = new AuditLog();
    game.setAuditCallback((action, details) => {
      auditLog!.record(action, details, game.getState());
    });
  }

  // Set up console logging
  if (verbose) {
    game.addObserver(new ConsoleObserver());
  }

  // Create AI agents
  const agents = new Map<string, IGameAgent>();
  const playerIds = game.getPlayerIds();
  const state = game.getState();

  for (let i = 0; i < playerIds.length; i++) {
    const playerId = playerIds[i];
    const player = state.players[i];
    const startingRole = player.startingRole.name;

    const aiAgent = new AIAgent(playerId, startingRole);
    const enforcedAgent = new RuleEnforcer(aiAgent);
    agents.set(playerId, enforcedAgent);
  }

  game.registerAgents(agents);

  // Run game
  const result = await game.run();

  return { result, auditLog };
}

/**
 * @summary Creates a standard 5-player game configuration.
 *
 * @returns {GameConfig} Standard game config
 *
 * @example
 * ```typescript
 * const config = createStandardConfig();
 * const { result } = await runGame(config);
 * ```
 */
export function createStandardConfig(): GameConfig {
  return {
    players: ['Alice', 'Bob', 'Charlie', 'Diana', 'Eve'],
    roles: [
      RoleName.WEREWOLF,
      RoleName.WEREWOLF,
      RoleName.SEER,
      RoleName.ROBBER,
      RoleName.TROUBLEMAKER,
      RoleName.VILLAGER,
      RoleName.VILLAGER,
      RoleName.DRUNK
    ]
  };
}

/**
 * @summary Main entry point for CLI execution.
 */
async function main(): Promise<void> {
  console.log('One Night Ultimate Werewolf - Game Engine\n');
  console.log('Running a 5-player game...\n');

  const config = createStandardConfig();
  const { result, auditLog } = await runGame(config, { verbose: true, audit: true });

  console.log('\n========================================');
  console.log('GAME RESULTS');
  console.log('========================================\n');

  console.log('Winning Teams:', result.winningTeams.join(', '));
  console.log('Winning Players:', result.winningPlayers.join(', '));
  console.log('Eliminated:', result.eliminatedPlayers.join(', ') || 'none');

  console.log('\nFinal Roles:');
  for (const [playerId, roleName] of result.finalRoles) {
    console.log(`  ${playerId}: ${roleName}`);
  }

  console.log('\nVotes:');
  for (const [voterId, targetId] of result.votes) {
    console.log(`  ${voterId} -> ${targetId}`);
  }

  if (auditLog) {
    console.log('\nAudit Summary:', auditLog.getSummary());
  }
}

// Run if executed directly
if (require.main === module) {
  main().catch(console.error);
}
