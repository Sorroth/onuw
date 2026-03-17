/**
 * @fileoverview Hunter role tests.
 * Tests H1-H6 from the test checklist.
 */

import { RoleName, Team } from '../../enums';
import {
  createTestGame,
  teamWon,
  playerEliminated,
} from '../setup/testUtils';

describe('Hunter Role Tests', () => {
  const HUNTER_ROLES = [
    RoleName.WEREWOLF, RoleName.WEREWOLF, RoleName.HUNTER,
    RoleName.VILLAGER, RoleName.VILLAGER,
    RoleName.VILLAGER, RoleName.VILLAGER, RoleName.VILLAGER
  ];

  describe('Night Action Tests', () => {
    it('H1: Hunter should have no night action', async () => {
      let hunterNightInfo: any = null;

      const agentConfigs = new Map([
        [0, { voteTarget: 'player-4' }],
        [1, { voteTarget: 'player-4' }],
        [2, {
          onNightInfo: (info: any) => { hunterNightInfo = info; },
          voteTarget: 'player-4'
        }],
        [3, { voteTarget: 'player-4' }],
        [4, { voteTarget: 'player-4' }]
      ]);

      await createTestGame({
        roles: HUNTER_ROLES,
        forcedRoles: new Map([[2, RoleName.HUNTER]]),
        agentConfigs
      });

      // Hunter should not receive any night info (no night action)
      expect(hunterNightInfo).toBeNull();
    });
  });

  describe('Elimination Ability Tests', () => {
    it('H2: Hunter should kill their vote target when eliminated', async () => {
      // Hunter votes for player-4, everyone else votes for Hunter
      const agentConfigs = new Map([
        [0, { voteTarget: 'player-3' }], // Vote for Hunter
        [1, { voteTarget: 'player-3' }],
        [2, { voteTarget: 'player-4' }], // Hunter votes for player-4
        [3, { voteTarget: 'player-3' }],
        [4, { voteTarget: 'player-3' }]
      ]);

      const { result } = await createTestGame({
        roles: HUNTER_ROLES,
        forcedRoles: new Map([
          [0, RoleName.WEREWOLF],
          [2, RoleName.HUNTER],
          [3, RoleName.VILLAGER]
        ]),
        agentConfigs
      });

      // Both Hunter and their target should be eliminated
      expect(playerEliminated(result, 'player-3')).toBe(true); // Hunter
      expect(playerEliminated(result, 'player-4')).toBe(true); // Hunter's target
    });

    it('H3: Hunter killing Werewolf should result in Village win', async () => {
      // Hunter votes for Werewolf, everyone else votes for Hunter
      const agentConfigs = new Map([
        [0, { voteTarget: 'player-3' }], // Vote for Hunter
        [1, { voteTarget: 'player-3' }],
        [2, { voteTarget: 'player-1' }], // Hunter votes for Werewolf
        [3, { voteTarget: 'player-3' }],
        [4, { voteTarget: 'player-3' }]
      ]);

      const { result } = await createTestGame({
        roles: HUNTER_ROLES,
        forcedRoles: new Map([
          [0, RoleName.WEREWOLF],
          [2, RoleName.HUNTER]
        ]),
        agentConfigs
      });

      expect(playerEliminated(result, 'player-3')).toBe(true); // Hunter
      expect(playerEliminated(result, 'player-1')).toBe(true); // Werewolf (killed by Hunter)
      expect(teamWon(result, Team.VILLAGE)).toBe(true);
    });

    it('H4: Hunter killing Tanner should result in Tanner win', async () => {
      const HUNTER_TANNER_ROLES = [
        RoleName.WEREWOLF, RoleName.TANNER, RoleName.HUNTER,
        RoleName.VILLAGER, RoleName.VILLAGER,
        RoleName.VILLAGER, RoleName.VILLAGER, RoleName.VILLAGER
      ];

      // Hunter votes for Tanner, everyone else votes for Hunter
      const agentConfigs = new Map([
        [0, { voteTarget: 'player-3' }], // Vote for Hunter
        [1, { voteTarget: 'player-3' }], // Tanner votes for Hunter
        [2, { voteTarget: 'player-2' }], // Hunter votes for Tanner
        [3, { voteTarget: 'player-3' }],
        [4, { voteTarget: 'player-3' }]
      ]);

      const { result } = await createTestGame({
        roles: HUNTER_TANNER_ROLES,
        forcedRoles: new Map([
          [0, RoleName.WEREWOLF],
          [1, RoleName.TANNER],
          [2, RoleName.HUNTER]
        ]),
        agentConfigs
      });

      expect(playerEliminated(result, 'player-3')).toBe(true); // Hunter
      expect(playerEliminated(result, 'player-2')).toBe(true); // Tanner (killed by Hunter)
      expect(teamWon(result, Team.TANNER)).toBe(true);
      expect(teamWon(result, Team.WEREWOLF)).toBe(false); // Blocked by Tanner death
    });

    it('H5: Hunter chain reaction - Hunter kills another Hunter', async () => {
      // This test requires Doppelganger copying Hunter
      const DOUBLE_HUNTER_ROLES = [
        RoleName.DOPPELGANGER, RoleName.HUNTER, RoleName.WEREWOLF,
        RoleName.VILLAGER, RoleName.VILLAGER,
        RoleName.VILLAGER, RoleName.VILLAGER, RoleName.VILLAGER
      ];

      // Doppelganger copies Hunter
      // Hunter-1 (Doppel-Hunter) votes for Hunter-2
      // Hunter-2 votes for Werewolf
      // Everyone else votes for Doppel-Hunter
      const agentConfigs = new Map([
        [0, { selectPlayerTarget: 'player-2', voteTarget: 'player-2' }], // Doppel copies Hunter, votes for Hunter
        [1, { voteTarget: 'player-3' }], // Hunter votes for Werewolf
        [2, { voteTarget: 'player-1' }], // Werewolf votes for Doppel-Hunter
        [3, { voteTarget: 'player-1' }],
        [4, { voteTarget: 'player-1' }]
      ]);

      const { result } = await createTestGame({
        roles: DOUBLE_HUNTER_ROLES,
        forcedRoles: new Map([
          [0, RoleName.DOPPELGANGER],
          [1, RoleName.HUNTER],
          [2, RoleName.WEREWOLF]
        ]),
        agentConfigs
      });

      // Doppel-Hunter is eliminated, kills Hunter
      // Hunter is killed, kills Werewolf
      expect(playerEliminated(result, 'player-1')).toBe(true); // Doppel-Hunter
      expect(playerEliminated(result, 'player-2')).toBe(true); // Hunter (chain)
      expect(playerEliminated(result, 'player-3')).toBe(true); // Werewolf (chain from Hunter)
      expect(teamWon(result, Team.VILLAGE)).toBe(true);
    });
  });

  describe('Win Condition Tests', () => {
    it('H6: Hunter should win if Village wins and Hunter survives', async () => {
      // Everyone votes for Werewolf (Hunter survives)
      const { result } = await createTestGame({
        roles: HUNTER_ROLES,
        forcedRoles: new Map([
          [0, RoleName.WEREWOLF],
          [2, RoleName.HUNTER]
        ]),
        defaultVoteTarget: 'player-1' // Vote for Werewolf
      });

      expect(playerEliminated(result, 'player-1')).toBe(true); // Werewolf
      expect(playerEliminated(result, 'player-3')).toBe(false); // Hunter survives
      expect(teamWon(result, Team.VILLAGE)).toBe(true);
      expect(result.winningPlayers).toContain('player-3'); // Hunter wins with Village
    });
  });
});
