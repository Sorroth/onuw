/**
 * @fileoverview Troublemaker role tests.
 * Tests T1-T5 from the test checklist.
 */

import { RoleName, Team } from '../../enums';
import {
  createTestGame,
  teamWon,
  getFinalRole,
  playerEliminated
} from '../setup/testUtils';

describe('Troublemaker Role Tests', () => {
  describe('Night Action Tests', () => {
    it('T1: Troublemaker should swap two players\' cards', async () => {
      const TM_ROLES = [
        RoleName.TROUBLEMAKER, RoleName.WEREWOLF, RoleName.VILLAGER,
        RoleName.VILLAGER, RoleName.VILLAGER,
        RoleName.VILLAGER, RoleName.VILLAGER, RoleName.VILLAGER
      ];

      let tmNightInfo: any = null;

      const agentConfigs = new Map([
        [0, {
          selectTwoPlayersTargets: ['player-2', 'player-3'] as [string, string], // Swap Werewolf and Villager
          onNightInfo: (info: any) => { tmNightInfo = info; },
          voteTarget: 'player-4'
        }],
        [1, { voteTarget: 'player-4' }],
        [2, { voteTarget: 'player-4' }],
        [3, { voteTarget: 'player-4' }],
        [4, { voteTarget: 'player-4' }]
      ]);

      const { result } = await createTestGame({
        roles: TM_ROLES,
        forcedRoles: new Map([
          [0, RoleName.TROUBLEMAKER],
          [1, RoleName.WEREWOLF],
          [2, RoleName.VILLAGER]
        ]),
        agentConfigs
      });

      expect(tmNightInfo).not.toBeNull();
      expect(tmNightInfo.roleName).toBe(RoleName.TROUBLEMAKER);
      expect(tmNightInfo.actionType).toBe('SWAP');
      expect(tmNightInfo.info.swapped).toBeDefined();

      // Cards should be swapped
      expect(getFinalRole(result, 'player-2')).toBe(RoleName.VILLAGER);
      expect(getFinalRole(result, 'player-3')).toBe(RoleName.WEREWOLF);
    });

    it('T2: Troublemaker swapping wolf with villager should change teams', async () => {
      const TM_ROLES = [
        RoleName.TROUBLEMAKER, RoleName.WEREWOLF, RoleName.VILLAGER,
        RoleName.VILLAGER, RoleName.VILLAGER,
        RoleName.VILLAGER, RoleName.VILLAGER, RoleName.VILLAGER
      ];

      const agentConfigs = new Map([
        [0, {
          selectTwoPlayersTargets: ['player-2', 'player-3'] as [string, string],
          voteTarget: 'player-2'
        }],
        [1, { voteTarget: 'player-2' }],
        [2, { voteTarget: 'player-2' }],
        [3, { voteTarget: 'player-2' }],
        [4, { voteTarget: 'player-2' }]
      ]);

      const { result } = await createTestGame({
        roles: TM_ROLES,
        forcedRoles: new Map([
          [0, RoleName.TROUBLEMAKER],
          [1, RoleName.WEREWOLF],
          [2, RoleName.VILLAGER]
        ]),
        agentConfigs
      });

      // Player-2 now has Villager card, player-3 has Werewolf
      expect(getFinalRole(result, 'player-2')).toBe(RoleName.VILLAGER);
      expect(getFinalRole(result, 'player-3')).toBe(RoleName.WEREWOLF);

      // Voting for player-2 (now Villager) should result in Werewolf win
      expect(teamWon(result, Team.WEREWOLF)).toBe(true);
    });

    it('T3: Troublemaker swap does not affect win conditions when swapping same team', async () => {
      // Troublemaker swaps two villagers - doesn't affect werewolf team
      const TM_ROLES = [
        RoleName.TROUBLEMAKER, RoleName.WEREWOLF, RoleName.VILLAGER,
        RoleName.VILLAGER, RoleName.VILLAGER,
        RoleName.VILLAGER, RoleName.VILLAGER, RoleName.VILLAGER
      ];

      const agentConfigs = new Map([
        [0, {
          selectTwoPlayersTargets: ['player-3', 'player-4'] as [string, string], // Swap two villagers
          voteTarget: 'player-2'
        }],
        [1, { voteTarget: 'player-2' }],
        [2, { voteTarget: 'player-2' }],
        [3, { voteTarget: 'player-2' }],
        [4, { voteTarget: 'player-2' }]
      ]);

      const { result } = await createTestGame({
        roles: TM_ROLES,
        forcedRoles: new Map([
          [0, RoleName.TROUBLEMAKER],
          [1, RoleName.WEREWOLF]
        ]),
        agentConfigs
      });

      // Werewolf eliminated, village wins
      expect(playerEliminated(result, 'player-2')).toBe(true);
      expect(teamWon(result, Team.VILLAGE)).toBe(true);
    });

    it('T4: Troublemaker swap after Robber should swap already-swapped cards', async () => {
      // Robber acts at order 6, Troublemaker at order 7
      const COMBO_ROLES = [
        RoleName.TROUBLEMAKER, RoleName.ROBBER, RoleName.WEREWOLF,
        RoleName.VILLAGER, RoleName.VILLAGER,
        RoleName.VILLAGER, RoleName.VILLAGER, RoleName.VILLAGER
      ];

      const agentConfigs = new Map([
        [0, {
          selectTwoPlayersTargets: ['player-2', 'player-4'] as [string, string], // TM swaps Robber(->Wolf) and Villager
          voteTarget: 'player-5'
        }],
        [1, { selectPlayerTarget: 'player-3', voteTarget: 'player-5' }], // Robber steals from Werewolf
        [2, { voteTarget: 'player-5' }],
        [3, { voteTarget: 'player-5' }],
        [4, { voteTarget: 'player-5' }]
      ]);

      const { result } = await createTestGame({
        roles: COMBO_ROLES,
        forcedRoles: new Map([
          [0, RoleName.TROUBLEMAKER],
          [1, RoleName.ROBBER],
          [2, RoleName.WEREWOLF],
          [3, RoleName.VILLAGER]
        ]),
        agentConfigs
      });

      // After Robber: player-2 has Werewolf, player-3 has Robber
      // After TM: player-2 has Villager, player-4 has Werewolf, player-3 has Robber
      expect(getFinalRole(result, 'player-2')).toBe(RoleName.VILLAGER);
      expect(getFinalRole(result, 'player-3')).toBe(RoleName.ROBBER);
      expect(getFinalRole(result, 'player-4')).toBe(RoleName.WEREWOLF);
    });
  });

  describe('Win Condition Tests', () => {
    it('T5: Troublemaker should win with Village when wolf is eliminated', async () => {
      const TM_ROLES = [
        RoleName.TROUBLEMAKER, RoleName.WEREWOLF, RoleName.VILLAGER,
        RoleName.VILLAGER, RoleName.VILLAGER,
        RoleName.VILLAGER, RoleName.VILLAGER, RoleName.VILLAGER
      ];

      const agentConfigs = new Map([
        [0, {
          selectTwoPlayersTargets: ['player-3', 'player-4'] as [string, string], // Swap villagers (no effect on wolves)
          voteTarget: 'player-2'
        }],
        [1, { voteTarget: 'player-2' }],
        [2, { voteTarget: 'player-2' }],
        [3, { voteTarget: 'player-2' }],
        [4, { voteTarget: 'player-2' }]
      ]);

      const { result } = await createTestGame({
        roles: TM_ROLES,
        forcedRoles: new Map([
          [0, RoleName.TROUBLEMAKER],
          [1, RoleName.WEREWOLF]
        ]),
        agentConfigs
      });

      expect(teamWon(result, Team.VILLAGE)).toBe(true);
      expect(result.winningPlayers).toContain('player-1'); // Troublemaker
    });
  });
});
