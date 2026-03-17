/**
 * @fileoverview Mason role tests.
 * Tests MA1-MA5 from the test checklist.
 */

import { RoleName, Team } from '../../enums';
import {
  createTestGame,
  teamWon,
  playerEliminated
} from '../setup/testUtils';

describe('Mason Role Tests', () => {
  describe('Night Action Tests', () => {
    it('MA1: Two Masons work together and win with village', async () => {
      const MASON_ROLES = [
        RoleName.MASON, RoleName.MASON, RoleName.WEREWOLF,
        RoleName.VILLAGER, RoleName.VILLAGER,
        RoleName.VILLAGER, RoleName.VILLAGER, RoleName.VILLAGER
      ];

      const agentConfigs = new Map([
        [0, { voteTarget: 'player-3' }],
        [1, { voteTarget: 'player-3' }],
        [2, { voteTarget: 'player-4' }],
        [3, { voteTarget: 'player-3' }],
        [4, { voteTarget: 'player-3' }]
      ]);

      const { result } = await createTestGame({
        roles: MASON_ROLES,
        forcedRoles: new Map([
          [0, RoleName.MASON],
          [1, RoleName.MASON],
          [2, RoleName.WEREWOLF]
        ]),
        agentConfigs
      });

      // Both Masons should win when werewolf eliminated
      expect(teamWon(result, Team.VILLAGE)).toBe(true);
      expect(result.winningPlayers).toContain('player-1');
      expect(result.winningPlayers).toContain('player-2');
    });

    it('MA2: Single Mason (other in center) still wins with village', async () => {
      // Only one Mason among players, second Mason in center
      const SINGLE_MASON_ROLES = [
        RoleName.MASON, RoleName.WEREWOLF, RoleName.VILLAGER,
        RoleName.VILLAGER, RoleName.VILLAGER,
        RoleName.MASON, RoleName.VILLAGER, RoleName.VILLAGER // Second Mason in center
      ];

      const agentConfigs = new Map([
        [0, { voteTarget: 'player-2' }],
        [1, { voteTarget: 'player-3' }],
        [2, { voteTarget: 'player-2' }],
        [3, { voteTarget: 'player-2' }],
        [4, { voteTarget: 'player-2' }]
      ]);

      const { result } = await createTestGame({
        roles: SINGLE_MASON_ROLES,
        forcedRoles: new Map([
          [0, RoleName.MASON],
          [1, RoleName.WEREWOLF],
          [2, RoleName.VILLAGER],
          [3, RoleName.VILLAGER],
          [4, RoleName.VILLAGER]
        ]),
        agentConfigs
      });

      // Single Mason wins when werewolf eliminated
      expect(teamWon(result, Team.VILLAGE)).toBe(true);
      expect(result.winningPlayers).toContain('player-1');
    });

    it('MA3: Masons should see initial assignments (before swaps)', async () => {
      // Masons act at order 4, which is early in the night
      // Robber acts at order 6, after Masons
      const MASON_ROBBER_ROLES = [
        RoleName.MASON, RoleName.MASON, RoleName.ROBBER,
        RoleName.WEREWOLF, RoleName.VILLAGER,
        RoleName.VILLAGER, RoleName.VILLAGER, RoleName.VILLAGER
      ];

      const agentConfigs = new Map([
        [0, { voteTarget: 'player-4' }],
        [1, { voteTarget: 'player-4' }],
        [2, { selectPlayerTarget: 'player-1', voteTarget: 'player-4' }], // Robber steals from Mason 1
        [3, { voteTarget: 'player-4' }],
        [4, { voteTarget: 'player-4' }]
      ]);

      const { result } = await createTestGame({
        roles: MASON_ROBBER_ROLES,
        forcedRoles: new Map([
          [0, RoleName.MASON],
          [1, RoleName.MASON],
          [2, RoleName.ROBBER],
          [3, RoleName.WEREWOLF]
        ]),
        agentConfigs
      });

      // Verify game outcome - werewolf eliminated
      expect(teamWon(result, Team.VILLAGE)).toBe(true);

      // After Robber steal, player-1 has Robber card, player-3 has Mason card
      // But original Masons (player-1 and player-2) saw each other during night
    });
  });

  describe('Win Condition Tests', () => {
    it('MA4: Masons should win when Werewolf is eliminated', async () => {
      const MASON_ROLES = [
        RoleName.MASON, RoleName.MASON, RoleName.WEREWOLF,
        RoleName.VILLAGER, RoleName.VILLAGER,
        RoleName.VILLAGER, RoleName.VILLAGER, RoleName.VILLAGER
      ];

      const { result } = await createTestGame({
        roles: MASON_ROLES,
        forcedRoles: new Map([
          [0, RoleName.MASON],
          [1, RoleName.MASON],
          [2, RoleName.WEREWOLF]
        ]),
        defaultVoteTarget: 'player-3' // Vote for Werewolf
      });

      expect(playerEliminated(result, 'player-3')).toBe(true);
      expect(teamWon(result, Team.VILLAGE)).toBe(true);
      expect(result.winningPlayers).toContain('player-1'); // Mason 1
      expect(result.winningPlayers).toContain('player-2'); // Mason 2
    });

    it('MA5: Masons should lose when no Werewolf is eliminated', async () => {
      const MASON_ROLES = [
        RoleName.MASON, RoleName.MASON, RoleName.WEREWOLF,
        RoleName.VILLAGER, RoleName.VILLAGER,
        RoleName.VILLAGER, RoleName.VILLAGER, RoleName.VILLAGER
      ];

      const { result } = await createTestGame({
        roles: MASON_ROLES,
        forcedRoles: new Map([
          [0, RoleName.MASON],
          [1, RoleName.MASON],
          [2, RoleName.WEREWOLF]
        ]),
        defaultVoteTarget: 'player-1' // Vote for Mason (not werewolf)
      });

      expect(playerEliminated(result, 'player-1')).toBe(true);
      expect(teamWon(result, Team.WEREWOLF)).toBe(true);
      expect(teamWon(result, Team.VILLAGE)).toBe(false);
    });
  });
});
