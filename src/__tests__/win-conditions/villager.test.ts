/**
 * @fileoverview Villager role tests.
 * Tests V1-V3 from the test checklist.
 */

import { RoleName, Team } from '../../enums';
import {
  createTestGame,
  teamWon,
  playerEliminated,
} from '../setup/testUtils';

describe('Villager Role Tests', () => {
  const VILLAGER_ROLES = [
    RoleName.WEREWOLF, RoleName.WEREWOLF,
    RoleName.VILLAGER, RoleName.VILLAGER, RoleName.VILLAGER,
    RoleName.VILLAGER, RoleName.VILLAGER, RoleName.VILLAGER
  ];

  describe('Night Action Tests', () => {
    it('V1: Villager should have no night action', async () => {
      let villagerNightInfo: any = null;

      const agentConfigs = new Map([
        [0, { voteTarget: 'player-4' }],
        [1, { voteTarget: 'player-4' }],
        [2, {
          onNightInfo: (info: any) => { villagerNightInfo = info; },
          voteTarget: 'player-4'
        }],
        [3, { voteTarget: 'player-4' }],
        [4, { voteTarget: 'player-4' }]
      ]);

      await createTestGame({
        roles: VILLAGER_ROLES,
        forcedRoles: new Map([[2, RoleName.VILLAGER]]),
        agentConfigs
      });

      // Villager should not receive any night info (no night action)
      expect(villagerNightInfo).toBeNull();
    });
  });

  describe('Win Condition Tests', () => {
    it('V2: Villager should win when Werewolf is eliminated', async () => {
      const { result } = await createTestGame({
        roles: VILLAGER_ROLES,
        forcedRoles: new Map([
          [0, RoleName.WEREWOLF],
          [2, RoleName.VILLAGER]
        ]),
        defaultVoteTarget: 'player-1' // Vote for Werewolf
      });

      expect(playerEliminated(result, 'player-1')).toBe(true);
      expect(teamWon(result, Team.VILLAGE)).toBe(true);
      expect(result.winningPlayers).toContain('player-3'); // Villager wins
    });

    it('V3: Villager should lose when no Werewolf is eliminated', async () => {
      const { result } = await createTestGame({
        roles: VILLAGER_ROLES,
        forcedRoles: new Map([
          [0, RoleName.WEREWOLF],
          [2, RoleName.VILLAGER]
        ]),
        defaultVoteTarget: 'player-3' // Vote for Villager
      });

      expect(playerEliminated(result, 'player-3')).toBe(true);
      expect(teamWon(result, Team.WEREWOLF)).toBe(true);
      expect(teamWon(result, Team.VILLAGE)).toBe(false);
    });
  });
});
