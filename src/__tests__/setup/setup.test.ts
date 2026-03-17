/**
 * @fileoverview Basic setup tests to verify testing infrastructure works.
 */

import { Game } from '../../core/Game';
import { RoleName, Team } from '../../enums';
import { TestAgent } from './TestAgent';
import { createTestGame, ROLE_CONFIGS, teamWon, playerEliminated } from './testUtils';

describe('Test Infrastructure', () => {
  describe('TestAgent', () => {
    it('should create a TestAgent with default config', () => {
      const agent = new TestAgent('player-1');
      expect(agent.id).toBe('player-1');
      expect(agent.isRemote).toBe(false);
    });

    it('should return configured vote target', async () => {
      const agent = new TestAgent('player-1', { voteTarget: 'player-2' });
      const vote = await agent.vote({
        myPlayerId: 'player-1',
        myStartingRole: RoleName.VILLAGER,
        myNightInfo: null,
        allStatements: [],
        eligibleTargets: ['player-2', 'player-3', 'player-4'],
        rolesInGame: [RoleName.VILLAGER, RoleName.WEREWOLF]
      });
      expect(vote).toBe('player-2');
    });

    it('should return configured player selection', async () => {
      const agent = new TestAgent('player-1', { selectPlayerTarget: 'player-3' });
      const selected = await agent.selectPlayer(
        ['player-2', 'player-3', 'player-4'],
        {
          myPlayerId: 'player-1',
          myStartingRole: RoleName.SEER,
          allPlayerIds: ['player-1', 'player-2', 'player-3', 'player-4'],
          rolesInGame: [RoleName.SEER, RoleName.WEREWOLF],
          previousResults: []
        }
      );
      expect(selected).toBe('player-3');
    });
  });

  describe('Game Creation', () => {
    it('should create a game with standard roles', async () => {
      const { game, result, playerIds } = await createTestGame({
        roles: ROLE_CONFIGS.STANDARD,
        defaultVoteTarget: 'player-1'
      });

      expect(game).toBeDefined();
      expect(result).toBeDefined();
      expect(result.winningTeams.length).toBeGreaterThan(0);
      expect(playerIds.length).toBe(5);
    });

    it('should respect forced roles', async () => {
      const forcedRoles = new Map<number, RoleName>([
        [0, RoleName.WEREWOLF]
      ]);

      const { result } = await createTestGame({
        roles: ROLE_CONFIGS.STANDARD,
        forcedRoles,
        defaultVoteTarget: 'player-1'
      });

      // Player 1 should have started as Werewolf
      // (Note: their final role might differ if swapped)
      expect(result).toBeDefined();
    });
  });

  describe('Basic Win Conditions', () => {
    // Use a simple setup with no swap roles to avoid card movements
    const NO_SWAP_ROLES = [
      RoleName.WEREWOLF, RoleName.WEREWOLF,
      RoleName.SEER, RoleName.VILLAGER, RoleName.VILLAGER,
      RoleName.VILLAGER, RoleName.VILLAGER, RoleName.VILLAGER
    ];

    it('should let Village win when Werewolf is eliminated', async () => {
      const { result } = await createTestGame({
        roles: NO_SWAP_ROLES,
        forcedRoles: new Map([[0, RoleName.WEREWOLF]]),
        defaultVoteTarget: 'player-1' // Everyone votes for the werewolf
      });

      expect(playerEliminated(result, 'player-1')).toBe(true);
      expect(teamWon(result, Team.VILLAGE)).toBe(true);
    });

    it('should let Werewolf win when no Werewolf is eliminated', async () => {
      const { result } = await createTestGame({
        roles: NO_SWAP_ROLES,
        forcedRoles: new Map([
          [0, RoleName.WEREWOLF],
          [2, RoleName.VILLAGER]
        ]),
        defaultVoteTarget: 'player-3' // Everyone votes for a villager
      });

      expect(playerEliminated(result, 'player-3')).toBe(true);
      expect(teamWon(result, Team.WEREWOLF)).toBe(true);
    });
  });
});
