/**
 * @fileoverview Werewolf role tests.
 * Tests W1-W8 from the test checklist.
 */

import { RoleName, Team } from '../../enums';
import { TestAgent } from '../setup/TestAgent';
import {
  createTestGame,
  teamWon,
  playerEliminated,
  noOneEliminated,
  createTieVoteConfigs
} from '../setup/testUtils';

describe('Werewolf Role Tests', () => {
  // Simple setup with no swap roles for predictable testing
  const SIMPLE_ROLES = [
    RoleName.WEREWOLF, RoleName.WEREWOLF,
    RoleName.SEER, RoleName.VILLAGER, RoleName.VILLAGER,
    RoleName.VILLAGER, RoleName.VILLAGER, RoleName.VILLAGER
  ];

  describe('Night Action Tests', () => {
    it('W1: Werewolves win when no werewolf is eliminated', async () => {
      const agentConfigs = new Map([
        [0, { voteTarget: 'player-3' }],
        [1, { voteTarget: 'player-3' }],
        [2, { voteTarget: 'player-3' }],
        [3, { voteTarget: 'player-3' }],
        [4, { voteTarget: 'player-3' }]
      ]);

      const { result } = await createTestGame({
        roles: SIMPLE_ROLES,
        forcedRoles: new Map([
          [0, RoleName.WEREWOLF]
        ]),
        agentConfigs
      });

      // Werewolf team should win when non-werewolf is eliminated
      expect(teamWon(result, Team.WEREWOLF)).toBe(true);
      // At least one werewolf should be in winners
      expect(result.winningPlayers.length).toBeGreaterThan(0);
    });

    it('W2: Werewolf should see Doppel-Werewolf as pack member', async () => {
      let werewolfNightInfo: any = null;

      const DOPPEL_ROLES = [
        RoleName.DOPPELGANGER, RoleName.WEREWOLF,
        RoleName.SEER, RoleName.VILLAGER, RoleName.VILLAGER,
        RoleName.WEREWOLF, RoleName.VILLAGER, RoleName.VILLAGER
      ];

      const agentConfigs = new Map([
        [0, { selectPlayerTarget: 'player-2', voteTarget: 'player-3' }], // Doppel copies Werewolf
        [1, {
          onNightInfo: (info: any) => { werewolfNightInfo = info; },
          voteTarget: 'player-3'
        }],
        [2, { voteTarget: 'player-3' }],
        [3, { voteTarget: 'player-3' }],
        [4, { voteTarget: 'player-3' }]
      ]);

      await createTestGame({
        roles: DOPPEL_ROLES,
        forcedRoles: new Map([
          [0, RoleName.DOPPELGANGER],
          [1, RoleName.WEREWOLF]
        ]),
        agentConfigs
      });

      // Werewolf should see Doppel-Werewolf in their pack
      expect(werewolfNightInfo).not.toBeNull();
      expect(werewolfNightInfo.info.werewolves).toBeDefined();
      expect(werewolfNightInfo.info.werewolves).toContain('player-1'); // Doppel-Werewolf
    });

    it('W3: Lone wolf should be able to peek at one center card', async () => {
      let loneWolfNightInfo: any = null;

      // Only one werewolf in player hands (other in center)
      const LONE_WOLF_ROLES = [
        RoleName.WEREWOLF, RoleName.SEER,
        RoleName.VILLAGER, RoleName.VILLAGER, RoleName.VILLAGER,
        RoleName.WEREWOLF, RoleName.VILLAGER, RoleName.VILLAGER
      ];

      const agentConfigs = new Map([
        [0, {
          selectCenterIndex: 0, // Peek at first center card
          onNightInfo: (info: any) => { loneWolfNightInfo = info; },
          voteTarget: 'player-2'
        }],
        [1, { voteTarget: 'player-2' }],
        [2, { voteTarget: 'player-2' }],
        [3, { voteTarget: 'player-2' }],
        [4, { voteTarget: 'player-2' }]
      ]);

      await createTestGame({
        roles: LONE_WOLF_ROLES,
        forcedRoles: new Map([[0, RoleName.WEREWOLF]]),
        agentConfigs
      });

      // Lone wolf should have peeked at center and received viewed info
      expect(loneWolfNightInfo).not.toBeNull();
      expect(loneWolfNightInfo.roleName).toBe(RoleName.WEREWOLF);
      expect(loneWolfNightInfo.info.werewolves).toBeDefined();
      expect(loneWolfNightInfo.info.werewolves.length).toBe(0); // No other werewolves
      // Should have viewed a center card
      expect(loneWolfNightInfo.info.viewed).toBeDefined();
      expect(loneWolfNightInfo.info.viewed.length).toBe(1);
      expect(loneWolfNightInfo.info.viewed[0].centerIndex).toBeDefined();
    });
  });

  describe('Win Condition Tests', () => {
    it('W5: Werewolf should win when villager eliminated', async () => {
      // Werewolves win by having non-werewolf eliminated
      const agentConfigs = new Map([
        [0, { voteTarget: 'player-3' }],
        [1, { voteTarget: 'player-3' }],
        [2, { voteTarget: 'player-3' }],
        [3, { voteTarget: 'player-3' }],
        [4, { voteTarget: 'player-3' }]
      ]);

      const { result } = await createTestGame({
        roles: SIMPLE_ROLES,
        forcedRoles: new Map([
          [0, RoleName.WEREWOLF],
          [2, RoleName.VILLAGER]
        ]),
        agentConfigs
      });

      expect(playerEliminated(result, 'player-3')).toBe(true);
      expect(teamWon(result, Team.WEREWOLF)).toBe(true);
    });

    it('W6: Werewolf should win when village member is eliminated', async () => {
      const { result } = await createTestGame({
        roles: SIMPLE_ROLES,
        forcedRoles: new Map([
          [0, RoleName.WEREWOLF],
          [2, RoleName.VILLAGER]
        ]),
        defaultVoteTarget: 'player-3' // Vote for villager
      });

      expect(playerEliminated(result, 'player-3')).toBe(true);
      expect(teamWon(result, Team.WEREWOLF)).toBe(true);
    });

    it('W7: Werewolf should lose when werewolf is eliminated', async () => {
      const { result } = await createTestGame({
        roles: SIMPLE_ROLES,
        forcedRoles: new Map([[0, RoleName.WEREWOLF]]),
        defaultVoteTarget: 'player-1' // Vote for werewolf
      });

      expect(playerEliminated(result, 'player-1')).toBe(true);
      expect(teamWon(result, Team.VILLAGE)).toBe(true);
      expect(teamWon(result, Team.WEREWOLF)).toBe(false);
    });

    it('W8: Tanner death should block Werewolf win', async () => {
      const TANNER_ROLES = [
        RoleName.WEREWOLF, RoleName.WEREWOLF, RoleName.TANNER,
        RoleName.VILLAGER, RoleName.VILLAGER,
        RoleName.VILLAGER, RoleName.VILLAGER, RoleName.VILLAGER
      ];

      const { result } = await createTestGame({
        roles: TANNER_ROLES,
        forcedRoles: new Map([
          [0, RoleName.WEREWOLF],
          [2, RoleName.TANNER]
        ]),
        defaultVoteTarget: 'player-3' // Vote for Tanner
      });

      expect(playerEliminated(result, 'player-3')).toBe(true);
      expect(teamWon(result, Team.TANNER)).toBe(true);
      expect(teamWon(result, Team.WEREWOLF)).toBe(false); // Blocked by Tanner death
    });
  });
});
