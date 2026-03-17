/**
 * @fileoverview Insomniac role tests.
 * Tests I1-I4 from the test checklist.
 */

import { RoleName, Team } from '../../enums';
import {
  createTestGame,
  teamWon,
  getFinalRole
} from '../setup/testUtils';

describe('Insomniac Role Tests', () => {
  describe('Night Action Tests', () => {
    it('I1: Insomniac should see their own card at end of night (unchanged)', async () => {
      const INSOMNIAC_ROLES = [
        RoleName.INSOMNIAC, RoleName.WEREWOLF, RoleName.VILLAGER,
        RoleName.VILLAGER, RoleName.VILLAGER,
        RoleName.VILLAGER, RoleName.VILLAGER, RoleName.VILLAGER
      ];

      let insomniacNightInfo: any = null;

      const agentConfigs = new Map([
        [0, {
          onNightInfo: (info: any) => { insomniacNightInfo = info; },
          voteTarget: 'player-2'
        }],
        [1, { voteTarget: 'player-3' }],
        [2, { voteTarget: 'player-2' }],
        [3, { voteTarget: 'player-2' }],
        [4, { voteTarget: 'player-2' }]
      ]);

      const { result } = await createTestGame({
        roles: INSOMNIAC_ROLES,
        forcedRoles: new Map([
          [0, RoleName.INSOMNIAC],
          [1, RoleName.WEREWOLF]
        ]),
        agentConfigs
      });

      expect(insomniacNightInfo).not.toBeNull();
      expect(insomniacNightInfo.roleName).toBe(RoleName.INSOMNIAC);
      expect(insomniacNightInfo.actionType).toBe('VIEW');
      expect(insomniacNightInfo.info.viewed).toBeDefined();
      // Should see their own unchanged card
      expect(insomniacNightInfo.info.viewed[0].role).toBe(RoleName.INSOMNIAC);

      expect(teamWon(result, Team.VILLAGE)).toBe(true);
    });

    it('I2: Insomniac should see new card if swapped by Robber', async () => {
      const INSOMNIAC_ROBBER_ROLES = [
        RoleName.INSOMNIAC, RoleName.ROBBER, RoleName.WEREWOLF,
        RoleName.VILLAGER, RoleName.VILLAGER,
        RoleName.VILLAGER, RoleName.VILLAGER, RoleName.VILLAGER
      ];

      let insomniacNightInfo: any = null;

      const agentConfigs = new Map([
        [0, {
          onNightInfo: (info: any) => { insomniacNightInfo = info; },
          voteTarget: 'player-3'
        }],
        [1, { selectPlayerTarget: 'player-1', voteTarget: 'player-3' }], // Robber steals Insomniac's card
        [2, { voteTarget: 'player-3' }],
        [3, { voteTarget: 'player-3' }],
        [4, { voteTarget: 'player-3' }]
      ]);

      const { result } = await createTestGame({
        roles: INSOMNIAC_ROBBER_ROLES,
        forcedRoles: new Map([
          [0, RoleName.INSOMNIAC],
          [1, RoleName.ROBBER],
          [2, RoleName.WEREWOLF]
        ]),
        agentConfigs
      });

      expect(insomniacNightInfo).not.toBeNull();
      // Insomniac should see Robber card (what they now have after swap)
      expect(insomniacNightInfo.info.viewed[0].role).toBe(RoleName.ROBBER);

      // Verify final roles
      expect(getFinalRole(result, 'player-1')).toBe(RoleName.ROBBER);
      expect(getFinalRole(result, 'player-2')).toBe(RoleName.INSOMNIAC);
    });

    it('I3: Insomniac should see new card if swapped by Troublemaker', async () => {
      const INSOMNIAC_TM_ROLES = [
        RoleName.INSOMNIAC, RoleName.TROUBLEMAKER, RoleName.WEREWOLF,
        RoleName.VILLAGER, RoleName.VILLAGER,
        RoleName.VILLAGER, RoleName.VILLAGER, RoleName.VILLAGER
      ];

      let insomniacNightInfo: any = null;

      const agentConfigs = new Map([
        [0, {
          onNightInfo: (info: any) => { insomniacNightInfo = info; },
          voteTarget: 'player-4'
        }],
        [1, {
          selectTwoPlayersTargets: ['player-1', 'player-3'] as [string, string], // Swap Insomniac and Werewolf
          voteTarget: 'player-4'
        }],
        [2, { voteTarget: 'player-4' }],
        [3, { voteTarget: 'player-4' }],
        [4, { voteTarget: 'player-4' }]
      ]);

      const { result } = await createTestGame({
        roles: INSOMNIAC_TM_ROLES,
        forcedRoles: new Map([
          [0, RoleName.INSOMNIAC],
          [1, RoleName.TROUBLEMAKER],
          [2, RoleName.WEREWOLF]
        ]),
        agentConfigs
      });

      expect(insomniacNightInfo).not.toBeNull();
      // Insomniac should see Werewolf card (swapped by Troublemaker)
      expect(insomniacNightInfo.info.viewed[0].role).toBe(RoleName.WEREWOLF);

      // Verify final roles
      expect(getFinalRole(result, 'player-1')).toBe(RoleName.WEREWOLF);
      expect(getFinalRole(result, 'player-3')).toBe(RoleName.INSOMNIAC);
    });
  });

  describe('Win Condition Tests', () => {
    it('I4: Insomniac-turned-Werewolf should win/lose based on final card', async () => {
      const INSOMNIAC_TM_ROLES = [
        RoleName.INSOMNIAC, RoleName.TROUBLEMAKER, RoleName.WEREWOLF,
        RoleName.VILLAGER, RoleName.VILLAGER,
        RoleName.VILLAGER, RoleName.VILLAGER, RoleName.VILLAGER
      ];

      const agentConfigs = new Map([
        [0, { voteTarget: 'player-4' }],
        [1, {
          selectTwoPlayersTargets: ['player-1', 'player-3'] as [string, string], // Swap Insomniac and Werewolf
          voteTarget: 'player-4'
        }],
        [2, { voteTarget: 'player-4' }],
        [3, { voteTarget: 'player-4' }],
        [4, { voteTarget: 'player-4' }]
      ]);

      const { result } = await createTestGame({
        roles: INSOMNIAC_TM_ROLES,
        forcedRoles: new Map([
          [0, RoleName.INSOMNIAC],
          [1, RoleName.TROUBLEMAKER],
          [2, RoleName.WEREWOLF]
        ]),
        agentConfigs
      });

      // Insomniac now has Werewolf card
      expect(getFinalRole(result, 'player-1')).toBe(RoleName.WEREWOLF);

      // Player-4 (Villager) was eliminated, no werewolf killed
      expect(teamWon(result, Team.WEREWOLF)).toBe(true);
      expect(result.winningPlayers).toContain('player-1'); // Insomniac-Werewolf wins
    });
  });
});
