/**
 * @fileoverview Test utilities for ONUW automated testing.
 * @module __tests__/setup/testUtils
 *
 * @description
 * Provides helper functions for creating test games with specific configurations,
 * registering test agents, and verifying game outcomes.
 */

import { Game, IGameAgent } from '../../core/Game';
import { RoleName, Team } from '../../enums';
import { GameConfig, GameResult } from '../../types';
import { TestAgent, TestAgentConfig } from './TestAgent';

/**
 * Standard 5-player role configurations for different test scenarios.
 */
export const ROLE_CONFIGS = {
  /** Standard village vs werewolf setup */
  STANDARD: [
    RoleName.WEREWOLF, RoleName.WEREWOLF,
    RoleName.SEER, RoleName.ROBBER, RoleName.TROUBLEMAKER,
    RoleName.VILLAGER, RoleName.VILLAGER, RoleName.DRUNK
  ] as RoleName[],

  /** Setup with Doppelganger */
  WITH_DOPPELGANGER: [
    RoleName.DOPPELGANGER, RoleName.WEREWOLF, RoleName.WEREWOLF,
    RoleName.SEER, RoleName.ROBBER,
    RoleName.VILLAGER, RoleName.TROUBLEMAKER, RoleName.DRUNK
  ] as RoleName[],

  /** Setup with Minion */
  WITH_MINION: [
    RoleName.WEREWOLF, RoleName.WEREWOLF, RoleName.MINION,
    RoleName.SEER, RoleName.ROBBER,
    RoleName.VILLAGER, RoleName.TROUBLEMAKER, RoleName.DRUNK
  ] as RoleName[],

  /** Setup with Tanner */
  WITH_TANNER: [
    RoleName.WEREWOLF, RoleName.WEREWOLF, RoleName.TANNER,
    RoleName.SEER, RoleName.ROBBER,
    RoleName.VILLAGER, RoleName.TROUBLEMAKER, RoleName.DRUNK
  ] as RoleName[],

  /** Setup with Hunter */
  WITH_HUNTER: [
    RoleName.WEREWOLF, RoleName.WEREWOLF, RoleName.HUNTER,
    RoleName.SEER, RoleName.ROBBER,
    RoleName.VILLAGER, RoleName.TROUBLEMAKER, RoleName.DRUNK
  ] as RoleName[],

  /** Setup with Mason pair */
  WITH_MASONS: [
    RoleName.WEREWOLF, RoleName.WEREWOLF, RoleName.MASON, RoleName.MASON,
    RoleName.SEER,
    RoleName.ROBBER, RoleName.TROUBLEMAKER, RoleName.DRUNK
  ] as RoleName[],

  /** Setup with Insomniac */
  WITH_INSOMNIAC: [
    RoleName.WEREWOLF, RoleName.WEREWOLF, RoleName.INSOMNIAC,
    RoleName.ROBBER, RoleName.TROUBLEMAKER,
    RoleName.SEER, RoleName.VILLAGER, RoleName.DRUNK
  ] as RoleName[],

  /** Doppelganger + Tanner setup */
  DOPPEL_TANNER: [
    RoleName.DOPPELGANGER, RoleName.TANNER, RoleName.WEREWOLF,
    RoleName.SEER, RoleName.ROBBER,
    RoleName.VILLAGER, RoleName.TROUBLEMAKER, RoleName.DRUNK
  ] as RoleName[],

  /** Doppelganger + Hunter setup */
  DOPPEL_HUNTER: [
    RoleName.DOPPELGANGER, RoleName.HUNTER, RoleName.WEREWOLF,
    RoleName.SEER, RoleName.ROBBER,
    RoleName.VILLAGER, RoleName.TROUBLEMAKER, RoleName.DRUNK
  ] as RoleName[],

  /** Doppelganger + Minion setup */
  DOPPEL_MINION: [
    RoleName.DOPPELGANGER, RoleName.MINION, RoleName.WEREWOLF,
    RoleName.SEER, RoleName.ROBBER,
    RoleName.VILLAGER, RoleName.TROUBLEMAKER, RoleName.DRUNK
  ] as RoleName[],

  /** Doppelganger + Insomniac setup */
  DOPPEL_INSOMNIAC: [
    RoleName.DOPPELGANGER, RoleName.INSOMNIAC, RoleName.WEREWOLF,
    RoleName.SEER, RoleName.ROBBER,
    RoleName.VILLAGER, RoleName.TROUBLEMAKER, RoleName.DRUNK
  ] as RoleName[],

  /** All village roles (no werewolves in player hands) */
  NO_WEREWOLVES_PLAYERS: [
    RoleName.SEER, RoleName.ROBBER, RoleName.TROUBLEMAKER,
    RoleName.VILLAGER, RoleName.MINION,
    RoleName.WEREWOLF, RoleName.WEREWOLF, RoleName.DRUNK
  ] as RoleName[],
};

/**
 * Configuration for creating a test game.
 */
export interface TestGameConfig {
  /** Number of players (default: 5) */
  playerCount?: number;

  /** Role configuration to use */
  roles: RoleName[];

  /** Force specific players to have specific roles (playerIndex -> role) */
  forcedRoles?: Map<number, RoleName>;

  /** Force all werewolves to center */
  forceWerewolvesToCenter?: boolean;

  /** Agent configurations by player index */
  agentConfigs?: Map<number, TestAgentConfig>;

  /** Default vote target for all agents (player ID) */
  defaultVoteTarget?: string;
}

/**
 * Result of a test game with additional helper data.
 */
export interface TestGameResult {
  /** The game instance */
  game: Game;

  /** The game result */
  result: GameResult;

  /** Map of player ID to TestAgent */
  agents: Map<string, TestAgent>;

  /** Player IDs in order */
  playerIds: string[];
}

/**
 * Creates a test game with the specified configuration.
 *
 * @example
 * ```typescript
 * const { game, result, agents } = await createTestGame({
 *   roles: ROLE_CONFIGS.STANDARD,
 *   forcedRoles: new Map([[0, RoleName.WEREWOLF]]),
 *   agentConfigs: new Map([[0, { voteTarget: 'player-2' }]])
 * });
 * ```
 */
export async function createTestGame(config: TestGameConfig): Promise<TestGameResult> {
  const playerCount = config.playerCount ?? 5;
  const players = Array.from({ length: playerCount }, (_, i) => `Player${i + 1}`);
  const playerIds = Array.from({ length: playerCount }, (_, i) => `player-${i + 1}`);

  // Create game config
  const gameConfig: GameConfig = {
    players,
    roles: config.roles,
    forcedRoles: config.forcedRoles,
    forceWerewolvesToCenter: config.forceWerewolvesToCenter,
    auditLevel: 'minimal' // Reduce noise in tests
  };

  const game = new Game(gameConfig);

  // Create agents
  const agents = new Map<string, TestAgent>();
  for (let i = 0; i < playerCount; i++) {
    const playerId = playerIds[i];
    const agentConfig = config.agentConfigs?.get(i) ?? {};

    // Apply default vote target if not specified
    if (!agentConfig.voteTarget && config.defaultVoteTarget) {
      agentConfig.voteTarget = config.defaultVoteTarget;
    }

    const agent = new TestAgent(playerId, agentConfig);
    agents.set(playerId, agent);
  }

  // Register agents
  game.registerAgents(agents as Map<string, IGameAgent>);

  // Run the game
  const result = await game.run();

  return { game, result, agents, playerIds };
}

/**
 * Creates a simple test game where everyone votes for a specific player.
 */
export async function createGameWithUnanimousVote(
  roles: RoleName[],
  forcedRoles: Map<number, RoleName>,
  voteTargetIndex: number
): Promise<TestGameResult> {
  const playerCount = roles.length - 3; // 3 center cards
  const voteTarget = `player-${voteTargetIndex + 1}`;

  return createTestGame({
    playerCount,
    roles,
    forcedRoles,
    defaultVoteTarget: voteTarget
  });
}

/**
 * Checks if a specific team won the game.
 */
export function teamWon(result: GameResult, team: Team): boolean {
  return result.winningTeams.includes(team);
}

/**
 * Checks if a specific player won the game.
 */
export function playerWon(result: GameResult, playerId: string): boolean {
  return result.winningPlayers.includes(playerId);
}

/**
 * Checks if a specific player was eliminated.
 */
export function playerEliminated(result: GameResult, playerId: string): boolean {
  return result.eliminatedPlayers.includes(playerId);
}

/**
 * Gets a player's final role from the result.
 */
export function getFinalRole(result: GameResult, playerId: string): RoleName | undefined {
  return result.finalRoles.get(playerId);
}

/**
 * Checks if no one was eliminated (tie vote).
 */
export function noOneEliminated(result: GameResult): boolean {
  return result.eliminatedPlayers.length === 0;
}

/**
 * Gets the vote count for each player.
 */
export function getVoteCounts(result: GameResult): Map<string, number> {
  const counts = new Map<string, number>();
  for (const targetId of result.votes.values()) {
    counts.set(targetId, (counts.get(targetId) ?? 0) + 1);
  }
  return counts;
}

/**
 * Creates agent configs that make everyone vote for a specific player index.
 */
export function createUnanimousVoteConfigs(
  playerCount: number,
  voteTargetIndex: number
): Map<number, TestAgentConfig> {
  const configs = new Map<number, TestAgentConfig>();
  const voteTarget = `player-${voteTargetIndex + 1}`;

  for (let i = 0; i < playerCount; i++) {
    configs.set(i, { voteTarget });
  }

  return configs;
}

/**
 * Creates agent configs for a tie vote (everyone votes for themselves).
 */
export function createTieVoteConfigs(playerCount: number): Map<number, TestAgentConfig> {
  const configs = new Map<number, TestAgentConfig>();

  for (let i = 0; i < playerCount; i++) {
    configs.set(i, { voteTarget: `player-${i + 1}` });
  }

  return configs;
}

/**
 * Creates agent configs where two players are tied for most votes.
 */
export function createTwoWayTieConfigs(
  playerCount: number,
  target1Index: number,
  target2Index: number
): Map<number, TestAgentConfig> {
  const configs = new Map<number, TestAgentConfig>();
  const target1 = `player-${target1Index + 1}`;
  const target2 = `player-${target2Index + 1}`;

  // Split votes between two targets
  for (let i = 0; i < playerCount; i++) {
    const target = i % 2 === 0 ? target1 : target2;
    configs.set(i, { voteTarget: target });
  }

  return configs;
}
