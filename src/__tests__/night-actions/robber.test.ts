/**
 * @fileoverview Robber role tests.
 * Tests R1-R6 from the test checklist.
 */

import { RoleName, Team } from '../../enums';
import {
  createTestGame,
  teamWon,
  playerEliminated,
  getFinalRole
} from '../setup/testUtils';

describe('Robber Role Tests', () => {
  describe('Night Action Tests', () => {
    it('R1: Robber should swap and see stolen village role', async () => {
      const ROBBER_ROLES = [
        RoleName.ROBBER, RoleName.VILLAGER, RoleName.WEREWOLF,
        RoleName.VILLAGER, RoleName.VILLAGER,
        RoleName.VILLAGER, RoleName.VILLAGER, RoleName.VILLAGER
      ];

      let robberNightInfo: any = null;

      const agentConfigs = new Map([
        [0, {
          selectPlayerTarget: 'player-2', // Steal from Villager
          onNightInfo: (info: any) => { robberNightInfo = info; },
          voteTarget: 'player-3'
        }],
        [1, { voteTarget: 'player-3' }],
        [2, { voteTarget: 'player-3' }],
        [3, { voteTarget: 'player-3' }],
        [4, { voteTarget: 'player-3' }]
      ]);

      const { result } = await createTestGame({
        roles: ROBBER_ROLES,
        forcedRoles: new Map([
          [0, RoleName.ROBBER],
          [1, RoleName.VILLAGER]
        ]),
        agentConfigs
      });

      expect(robberNightInfo).not.toBeNull();
      expect(robberNightInfo.roleName).toBe(RoleName.ROBBER);
      expect(robberNightInfo.actionType).toBe('SWAP');
      expect(robberNightInfo.info.swapped).toBeDefined();
      expect(robberNightInfo.info.viewed).toBeDefined();
      expect(robberNightInfo.info.viewed[0].role).toBe(RoleName.VILLAGER);

      // Robber should now have Villager card
      expect(getFinalRole(result, 'player-1')).toBe(RoleName.VILLAGER);
      // Villager should now have Robber card
      expect(getFinalRole(result, 'player-2')).toBe(RoleName.ROBBER);
    });

    it('R2: Robber should become Werewolf team when stealing Werewolf', async () => {
      const ROBBER_ROLES = [
        RoleName.ROBBER, RoleName.WEREWOLF,
        RoleName.VILLAGER, RoleName.VILLAGER, RoleName.VILLAGER,
        RoleName.VILLAGER, RoleName.VILLAGER, RoleName.VILLAGER
      ];

      let robberNightInfo: any = null;

      const agentConfigs = new Map([
        [0, {
          selectPlayerTarget: 'player-2', // Steal from Werewolf
          onNightInfo: (info: any) => { robberNightInfo = info; },
          voteTarget: 'player-3'
        }],
        [1, { voteTarget: 'player-3' }],
        [2, { voteTarget: 'player-3' }],
        [3, { voteTarget: 'player-3' }],
        [4, { voteTarget: 'player-3' }]
      ]);

      const { result } = await createTestGame({
        roles: ROBBER_ROLES,
        forcedRoles: new Map([
          [0, RoleName.ROBBER],
          [1, RoleName.WEREWOLF]
        ]),
        agentConfigs
      });

      expect(robberNightInfo.info.viewed[0].role).toBe(RoleName.WEREWOLF);
      expect(getFinalRole(result, 'player-1')).toBe(RoleName.WEREWOLF);

      // Player-1 (Robber-turned-Werewolf) should now win with werewolves
      expect(teamWon(result, Team.WEREWOLF)).toBe(true);
      expect(result.winningPlayers).toContain('player-1');
    });

    it('R3: Robber should become Tanner team when stealing Tanner', async () => {
      const ROBBER_TANNER_ROLES = [
        RoleName.ROBBER, RoleName.TANNER, RoleName.WEREWOLF,
        RoleName.VILLAGER, RoleName.VILLAGER,
        RoleName.VILLAGER, RoleName.VILLAGER, RoleName.VILLAGER
      ];

      let robberNightInfo: any = null;

      const agentConfigs = new Map([
        [0, {
          selectPlayerTarget: 'player-2', // Steal from Tanner
          onNightInfo: (info: any) => { robberNightInfo = info; },
          voteTarget: 'player-4'
        }],
        [1, { voteTarget: 'player-4' }],
        [2, { voteTarget: 'player-4' }],
        [3, { voteTarget: 'player-4' }],
        [4, { voteTarget: 'player-4' }]
      ]);

      const { result } = await createTestGame({
        roles: ROBBER_TANNER_ROLES,
        forcedRoles: new Map([
          [0, RoleName.ROBBER],
          [1, RoleName.TANNER],
          [2, RoleName.WEREWOLF]
        ]),
        agentConfigs
      });

      expect(robberNightInfo.info.viewed[0].role).toBe(RoleName.TANNER);
      expect(getFinalRole(result, 'player-1')).toBe(RoleName.TANNER);
    });

    it('R4: Robber stealing Doppelganger should see Doppelganger card', async () => {
      const ROBBER_DOPPEL_ROLES = [
        RoleName.ROBBER, RoleName.DOPPELGANGER, RoleName.WEREWOLF,
        RoleName.VILLAGER, RoleName.VILLAGER,
        RoleName.VILLAGER, RoleName.VILLAGER, RoleName.VILLAGER
      ];

      let robberNightInfo: any = null;

      const agentConfigs = new Map([
        [0, {
          selectPlayerTarget: 'player-2', // Steal from Doppelganger
          onNightInfo: (info: any) => { robberNightInfo = info; },
          voteTarget: 'player-4'
        }],
        [1, { selectPlayerTarget: 'player-3', voteTarget: 'player-4' }], // Doppel copies Werewolf
        [2, { voteTarget: 'player-4' }],
        [3, { voteTarget: 'player-4' }],
        [4, { voteTarget: 'player-4' }]
      ]);

      const { result } = await createTestGame({
        roles: ROBBER_DOPPEL_ROLES,
        forcedRoles: new Map([
          [0, RoleName.ROBBER],
          [1, RoleName.DOPPELGANGER],
          [2, RoleName.WEREWOLF]
        ]),
        agentConfigs
      });

      // Robber sees Doppelganger card (which has copied Werewolf)
      expect(robberNightInfo.info.viewed[0].role).toBe(RoleName.DOPPELGANGER);
      expect(getFinalRole(result, 'player-1')).toBe(RoleName.DOPPELGANGER);
    });
  });

  describe('Win Condition Tests', () => {
    it('R5: Robber-turned-Werewolf should win when werewolves survive', async () => {
      const ROBBER_ROLES = [
        RoleName.ROBBER, RoleName.WEREWOLF,
        RoleName.VILLAGER, RoleName.VILLAGER, RoleName.VILLAGER,
        RoleName.VILLAGER, RoleName.VILLAGER, RoleName.VILLAGER
      ];

      const agentConfigs = new Map([
        [0, { selectPlayerTarget: 'player-2', voteTarget: 'player-3' }], // Steal Werewolf, vote villager
        [1, { voteTarget: 'player-3' }],
        [2, { voteTarget: 'player-3' }],
        [3, { voteTarget: 'player-3' }],
        [4, { voteTarget: 'player-3' }]
      ]);

      const { result } = await createTestGame({
        roles: ROBBER_ROLES,
        forcedRoles: new Map([
          [0, RoleName.ROBBER],
          [1, RoleName.WEREWOLF]
        ]),
        agentConfigs
      });

      // Robber now has Werewolf card
      expect(getFinalRole(result, 'player-1')).toBe(RoleName.WEREWOLF);
      // Neither werewolf (original or robber) is eliminated
      expect(playerEliminated(result, 'player-3')).toBe(true); // Villager
      expect(teamWon(result, Team.WEREWOLF)).toBe(true);
      expect(result.winningPlayers).toContain('player-1'); // Robber-Werewolf wins
    });

    it('R6: Robber-turned-Werewolf should lose when eliminated', async () => {
      const ROBBER_ROLES = [
        RoleName.ROBBER, RoleName.WEREWOLF,
        RoleName.VILLAGER, RoleName.VILLAGER, RoleName.VILLAGER,
        RoleName.VILLAGER, RoleName.VILLAGER, RoleName.VILLAGER
      ];

      const agentConfigs = new Map([
        [0, { selectPlayerTarget: 'player-2', voteTarget: 'player-3' }], // Steal Werewolf
        [1, { voteTarget: 'player-1' }], // Vote for Robber-Werewolf
        [2, { voteTarget: 'player-1' }],
        [3, { voteTarget: 'player-1' }],
        [4, { voteTarget: 'player-1' }]
      ]);

      const { result } = await createTestGame({
        roles: ROBBER_ROLES,
        forcedRoles: new Map([
          [0, RoleName.ROBBER],
          [1, RoleName.WEREWOLF]
        ]),
        agentConfigs
      });

      expect(getFinalRole(result, 'player-1')).toBe(RoleName.WEREWOLF);
      expect(playerEliminated(result, 'player-1')).toBe(true);
      expect(teamWon(result, Team.VILLAGE)).toBe(true);
    });
  });
});
