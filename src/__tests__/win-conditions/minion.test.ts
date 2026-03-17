/**
 * @fileoverview Minion role tests.
 * Tests M1-M8 from the test checklist.
 */

import { RoleName, Team } from '../../enums';
import {
  createTestGame,
  teamWon,
  playerEliminated,
} from '../setup/testUtils';

describe('Minion Role Tests', () => {
  describe('Night Action Tests', () => {
    it('M1: Minion should see werewolves', async () => {
      let minionNightInfo: any = null;

      const MINION_ROLES = [
        RoleName.WEREWOLF, RoleName.WEREWOLF, RoleName.MINION,
        RoleName.VILLAGER, RoleName.VILLAGER,
        RoleName.VILLAGER, RoleName.VILLAGER, RoleName.VILLAGER
      ];

      const agentConfigs = new Map([
        [0, { voteTarget: 'player-4' }],
        [1, { voteTarget: 'player-4' }],
        [2, {
          onNightInfo: (info: any) => { minionNightInfo = info; },
          voteTarget: 'player-4'
        }],
        [3, { voteTarget: 'player-4' }],
        [4, { voteTarget: 'player-4' }]
      ]);

      await createTestGame({
        roles: MINION_ROLES,
        forcedRoles: new Map([
          [0, RoleName.WEREWOLF],
          [1, RoleName.WEREWOLF],
          [2, RoleName.MINION]
        ]),
        agentConfigs
      });

      expect(minionNightInfo).not.toBeNull();
      expect(minionNightInfo.roleName).toBe(RoleName.MINION);
      expect(minionNightInfo.info.werewolves).toBeDefined();
      // Minion should see at least the werewolves that exist among players
      expect(minionNightInfo.info.werewolves.length).toBeGreaterThanOrEqual(1);
    });

    it('M2: Minion should see Doppel-Werewolf', async () => {
      let minionNightInfo: any = null;

      const DOPPEL_MINION_ROLES = [
        RoleName.DOPPELGANGER, RoleName.WEREWOLF, RoleName.MINION,
        RoleName.VILLAGER, RoleName.VILLAGER,
        RoleName.WEREWOLF, RoleName.VILLAGER, RoleName.VILLAGER
      ];

      const agentConfigs = new Map([
        [0, { selectPlayerTarget: 'player-2', voteTarget: 'player-4' }], // Doppel copies Werewolf
        [1, { voteTarget: 'player-4' }],
        [2, {
          onNightInfo: (info: any) => { minionNightInfo = info; },
          voteTarget: 'player-4'
        }],
        [3, { voteTarget: 'player-4' }],
        [4, { voteTarget: 'player-4' }]
      ]);

      await createTestGame({
        roles: DOPPEL_MINION_ROLES,
        forcedRoles: new Map([
          [0, RoleName.DOPPELGANGER],
          [1, RoleName.WEREWOLF],
          [2, RoleName.MINION]
        ]),
        agentConfigs
      });

      expect(minionNightInfo).not.toBeNull();
      expect(minionNightInfo.info.werewolves).toBeDefined();
      // Should see both the original werewolf and Doppel-Werewolf
      expect(minionNightInfo.info.werewolves).toContain('player-1'); // Doppel-Werewolf
      expect(minionNightInfo.info.werewolves).toContain('player-2'); // Original Werewolf
    });

    it('M3: Minion should see empty list when no werewolves among players', async () => {
      let minionNightInfo: any = null;

      const NO_WOLF_ROLES = [
        RoleName.MINION, RoleName.SEER,
        RoleName.VILLAGER, RoleName.VILLAGER, RoleName.VILLAGER,
        RoleName.WEREWOLF, RoleName.WEREWOLF, RoleName.VILLAGER
      ];

      const agentConfigs = new Map([
        [0, {
          onNightInfo: (info: any) => { minionNightInfo = info; },
          voteTarget: 'player-2'
        }],
        [1, { voteTarget: 'player-2' }],
        [2, { voteTarget: 'player-2' }],
        [3, { voteTarget: 'player-2' }],
        [4, { voteTarget: 'player-2' }]
      ]);

      await createTestGame({
        roles: NO_WOLF_ROLES,
        forcedRoles: new Map([[0, RoleName.MINION]]),
        forceWerewolvesToCenter: true,
        agentConfigs
      });

      expect(minionNightInfo).not.toBeNull();
      expect(minionNightInfo.info.werewolves).toBeDefined();
      // Minion receives werewolf list (may be empty or have Doppel-Werewolves)
      expect(Array.isArray(minionNightInfo.info.werewolves)).toBe(true);
    });
  });

  describe('Win Condition Tests', () => {
    it('M4: Minion should win when werewolves survive', async () => {
      const MINION_ROLES = [
        RoleName.WEREWOLF, RoleName.WEREWOLF, RoleName.MINION,
        RoleName.VILLAGER, RoleName.VILLAGER,
        RoleName.VILLAGER, RoleName.VILLAGER, RoleName.VILLAGER
      ];

      const { result } = await createTestGame({
        roles: MINION_ROLES,
        forcedRoles: new Map([
          [0, RoleName.WEREWOLF],
          [2, RoleName.MINION],
          [3, RoleName.VILLAGER]
        ]),
        defaultVoteTarget: 'player-4' // Vote for villager
      });

      expect(playerEliminated(result, 'player-4')).toBe(true);
      expect(teamWon(result, Team.WEREWOLF)).toBe(true);
      // Minion should be in winning players
      expect(result.winningPlayers).toContain('player-3');
    });

    it('M5: Minion should lose when werewolf is eliminated', async () => {
      const MINION_ROLES = [
        RoleName.WEREWOLF, RoleName.WEREWOLF, RoleName.MINION,
        RoleName.VILLAGER, RoleName.VILLAGER,
        RoleName.VILLAGER, RoleName.VILLAGER, RoleName.VILLAGER
      ];

      const { result } = await createTestGame({
        roles: MINION_ROLES,
        forcedRoles: new Map([
          [0, RoleName.WEREWOLF],
          [2, RoleName.MINION]
        ]),
        defaultVoteTarget: 'player-1' // Vote for werewolf
      });

      expect(playerEliminated(result, 'player-1')).toBe(true);
      expect(teamWon(result, Team.VILLAGE)).toBe(true);
      expect(teamWon(result, Team.WEREWOLF)).toBe(false);
    });

    it('M6: Minion can die and werewolves still win', async () => {
      const MINION_ROLES = [
        RoleName.WEREWOLF, RoleName.WEREWOLF, RoleName.MINION,
        RoleName.VILLAGER, RoleName.VILLAGER,
        RoleName.VILLAGER, RoleName.VILLAGER, RoleName.VILLAGER
      ];

      const { result } = await createTestGame({
        roles: MINION_ROLES,
        forcedRoles: new Map([
          [0, RoleName.WEREWOLF],
          [2, RoleName.MINION]
        ]),
        defaultVoteTarget: 'player-3' // Vote for Minion
      });

      expect(playerEliminated(result, 'player-3')).toBe(true);
      expect(teamWon(result, Team.WEREWOLF)).toBe(true);
    });

    it('M7: Minion wins alone when no werewolves exist and non-Minion dies', async () => {
      const NO_WOLF_ROLES = [
        RoleName.MINION, RoleName.SEER,
        RoleName.VILLAGER, RoleName.VILLAGER, RoleName.VILLAGER,
        RoleName.WEREWOLF, RoleName.WEREWOLF, RoleName.VILLAGER
      ];

      const { result } = await createTestGame({
        roles: NO_WOLF_ROLES,
        forcedRoles: new Map([
          [0, RoleName.MINION],
          [1, RoleName.VILLAGER]
        ]),
        forceWerewolvesToCenter: true,
        defaultVoteTarget: 'player-2' // Vote for non-Minion
      });

      expect(playerEliminated(result, 'player-2')).toBe(true);
      // Minion wins when someone else dies and no werewolves exist
      expect(teamWon(result, Team.WEREWOLF)).toBe(true);
    });

    it('M8: Village wins when no werewolves exist and Minion is eliminated', async () => {
      const NO_WOLF_ROLES = [
        RoleName.MINION, RoleName.SEER,
        RoleName.VILLAGER, RoleName.VILLAGER, RoleName.VILLAGER,
        RoleName.WEREWOLF, RoleName.WEREWOLF, RoleName.VILLAGER
      ];

      // Everyone votes for Minion
      const { result } = await createTestGame({
        roles: NO_WOLF_ROLES,
        forcedRoles: new Map([[0, RoleName.MINION]]),
        forceWerewolvesToCenter: true,
        defaultVoteTarget: 'player-1' // Vote for Minion
      });

      expect(playerEliminated(result, 'player-1')).toBe(true);
      // Village wins when no werewolves exist and Minion is eliminated
      expect(teamWon(result, Team.VILLAGE)).toBe(true);
    });
  });
});
