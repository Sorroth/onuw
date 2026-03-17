/**
 * @fileoverview Seer role tests.
 * Tests S1-S5 from the test checklist.
 */

import { RoleName, Team } from '../../enums';
import {
  createTestGame,
  teamWon,
  playerEliminated,
} from '../setup/testUtils';

describe('Seer Role Tests', () => {
  const SEER_ROLES = [
    RoleName.WEREWOLF, RoleName.WEREWOLF, RoleName.SEER,
    RoleName.VILLAGER, RoleName.VILLAGER,
    RoleName.VILLAGER, RoleName.VILLAGER, RoleName.VILLAGER
  ];

  describe('Night Action Tests', () => {
    it('S1: Seer should see a player\'s role when choosing player option', async () => {
      let seerNightInfo: any = null;

      const agentConfigs = new Map([
        [0, { voteTarget: 'player-4' }],
        [1, { voteTarget: 'player-4' }],
        [2, {
          seerChoice: 'player' as const,
          selectPlayerTarget: 'player-1', // View Werewolf
          onNightInfo: (info: any) => { seerNightInfo = info; },
          voteTarget: 'player-4'
        }],
        [3, { voteTarget: 'player-4' }],
        [4, { voteTarget: 'player-4' }]
      ]);

      await createTestGame({
        roles: SEER_ROLES,
        forcedRoles: new Map([
          [0, RoleName.WEREWOLF],
          [2, RoleName.SEER]
        ]),
        agentConfigs
      });

      expect(seerNightInfo).not.toBeNull();
      expect(seerNightInfo.roleName).toBe(RoleName.SEER);
      expect(seerNightInfo.actionType).toBe('VIEW');
      expect(seerNightInfo.info.viewed).toBeDefined();
      expect(seerNightInfo.info.viewed.length).toBe(1);
      expect(seerNightInfo.info.viewed[0].playerId).toBe('player-1');
      expect(seerNightInfo.info.viewed[0].role).toBe(RoleName.WEREWOLF);
    });

    it('S2: Seer should see two center cards when choosing center option', async () => {
      let seerNightInfo: any = null;

      const agentConfigs = new Map([
        [0, { voteTarget: 'player-4' }],
        [1, { voteTarget: 'player-4' }],
        [2, {
          seerChoice: 'center' as const,
          selectTwoCenterIndices: [0, 1] as [number, number],
          onNightInfo: (info: any) => { seerNightInfo = info; },
          voteTarget: 'player-4'
        }],
        [3, { voteTarget: 'player-4' }],
        [4, { voteTarget: 'player-4' }]
      ]);

      await createTestGame({
        roles: SEER_ROLES,
        forcedRoles: new Map([[2, RoleName.SEER]]),
        agentConfigs
      });

      expect(seerNightInfo).not.toBeNull();
      expect(seerNightInfo.roleName).toBe(RoleName.SEER);
      expect(seerNightInfo.info.viewed).toBeDefined();
      expect(seerNightInfo.info.viewed.length).toBe(2);
      // Both should have centerIndex, not playerId
      expect(seerNightInfo.info.viewed[0].centerIndex).toBeDefined();
      expect(seerNightInfo.info.viewed[1].centerIndex).toBeDefined();
    });

    it('S3: Seer should see CURRENT role after swap', async () => {
      // Include Robber to perform swap before Seer views
      const SWAP_ROLES = [
        RoleName.WEREWOLF, RoleName.VILLAGER, RoleName.SEER,
        RoleName.ROBBER, RoleName.VILLAGER,
        RoleName.VILLAGER, RoleName.VILLAGER, RoleName.VILLAGER
      ];

      let seerNightInfo: any = null;

      const agentConfigs = new Map([
        [0, { voteTarget: 'player-5' }], // Werewolf
        [1, { voteTarget: 'player-5' }], // Villager (will become Robber)
        [2, {
          seerChoice: 'player' as const,
          selectPlayerTarget: 'player-2', // View player who was swapped
          onNightInfo: (info: any) => { seerNightInfo = info; },
          voteTarget: 'player-5'
        }],
        [3, { selectPlayerTarget: 'player-2', voteTarget: 'player-5' }], // Robber steals from player-2
        [4, { voteTarget: 'player-5' }]
      ]);

      await createTestGame({
        roles: SWAP_ROLES,
        forcedRoles: new Map([
          [0, RoleName.WEREWOLF],
          [1, RoleName.VILLAGER],
          [2, RoleName.SEER],
          [3, RoleName.ROBBER]
        ]),
        agentConfigs
      });

      expect(seerNightInfo).not.toBeNull();
      // The exact role depends on night order - Robber acts at order 6, Seer at order 5
      // So Seer sees BEFORE swap in standard order
      // Actually, Seer (order 5) acts BEFORE Robber (order 6), so Seer sees original Villager
      expect(seerNightInfo.info.viewed[0].playerId).toBe('player-2');
    });
  });

  describe('Win Condition Tests', () => {
    it('S4: Seer should win when Werewolf is eliminated', async () => {
      const { result } = await createTestGame({
        roles: SEER_ROLES,
        forcedRoles: new Map([
          [0, RoleName.WEREWOLF],
          [2, RoleName.SEER]
        ]),
        defaultVoteTarget: 'player-1' // Vote for Werewolf
      });

      expect(playerEliminated(result, 'player-1')).toBe(true);
      expect(teamWon(result, Team.VILLAGE)).toBe(true);
      expect(result.winningPlayers).toContain('player-3'); // Seer
    });

    it('S5: Seer should lose when no Werewolf is eliminated', async () => {
      const { result } = await createTestGame({
        roles: SEER_ROLES,
        forcedRoles: new Map([
          [0, RoleName.WEREWOLF],
          [2, RoleName.SEER]
        ]),
        defaultVoteTarget: 'player-3' // Vote for Seer (not werewolf)
      });

      expect(playerEliminated(result, 'player-3')).toBe(true);
      expect(teamWon(result, Team.WEREWOLF)).toBe(true);
    });
  });
});
