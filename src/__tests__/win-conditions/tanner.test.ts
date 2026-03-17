/**
 * @fileoverview Tanner role tests.
 * Tests TA1-TA5 from the test checklist.
 */

import { RoleName, Team } from '../../enums';
import {
  createTestGame,
  teamWon,
  playerEliminated,
  createTwoWayTieConfigs
} from '../setup/testUtils';

describe('Tanner Role Tests', () => {
  const TANNER_ROLES = [
    RoleName.WEREWOLF, RoleName.WEREWOLF, RoleName.TANNER,
    RoleName.VILLAGER, RoleName.VILLAGER,
    RoleName.VILLAGER, RoleName.VILLAGER, RoleName.VILLAGER
  ];

  describe('Night Action Tests', () => {
    it('TA1: Tanner should have no night action', async () => {
      let tannerNightInfo: any = null;

      const agentConfigs = new Map([
        [0, { voteTarget: 'player-4' }],
        [1, { voteTarget: 'player-4' }],
        [2, {
          onNightInfo: (info: any) => { tannerNightInfo = info; },
          voteTarget: 'player-4'
        }],
        [3, { voteTarget: 'player-4' }],
        [4, { voteTarget: 'player-4' }]
      ]);

      await createTestGame({
        roles: TANNER_ROLES,
        forcedRoles: new Map([[2, RoleName.TANNER]]),
        agentConfigs
      });

      // Tanner should not receive any night info (no night action)
      expect(tannerNightInfo).toBeNull();
    });
  });

  describe('Win Condition Tests', () => {
    it('TA2: Tanner should win when eliminated (solo win)', async () => {
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
      expect(result.winningPlayers).toContain('player-3');
    });

    it('TA3: Both Tanner and Village can win if Tanner + Werewolf both die', async () => {
      // Create a tie where both Tanner and Werewolf are eliminated
      const agentConfigs = createTwoWayTieConfigs(5, 0, 2); // Tie between player-1 (wolf) and player-3 (tanner)

      const { result } = await createTestGame({
        roles: TANNER_ROLES,
        forcedRoles: new Map([
          [0, RoleName.WEREWOLF],
          [2, RoleName.TANNER]
        ]),
        agentConfigs
      });

      // Both should be eliminated in a tie
      expect(playerEliminated(result, 'player-1')).toBe(true); // Werewolf
      expect(playerEliminated(result, 'player-3')).toBe(true); // Tanner

      // Both Tanner and Village should win
      expect(teamWon(result, Team.TANNER)).toBe(true);
      expect(teamWon(result, Team.VILLAGE)).toBe(true);
      expect(teamWon(result, Team.WEREWOLF)).toBe(false);
    });

    it('TA4: Tanner death should block Werewolf win', async () => {
      const { result } = await createTestGame({
        roles: TANNER_ROLES,
        forcedRoles: new Map([
          [0, RoleName.WEREWOLF],
          [2, RoleName.TANNER]
        ]),
        defaultVoteTarget: 'player-3' // Vote for Tanner only
      });

      expect(playerEliminated(result, 'player-3')).toBe(true);
      expect(teamWon(result, Team.TANNER)).toBe(true);
      expect(teamWon(result, Team.WEREWOLF)).toBe(false);
    });

    it('TA5: Tanner should lose if they survive', async () => {
      const { result } = await createTestGame({
        roles: TANNER_ROLES,
        forcedRoles: new Map([
          [0, RoleName.WEREWOLF],
          [2, RoleName.TANNER],
          [3, RoleName.VILLAGER]
        ]),
        defaultVoteTarget: 'player-4' // Vote for villager, not Tanner
      });

      expect(playerEliminated(result, 'player-4')).toBe(true);
      expect(playerEliminated(result, 'player-3')).toBe(false); // Tanner survives
      expect(teamWon(result, Team.TANNER)).toBe(false);
      expect(teamWon(result, Team.WEREWOLF)).toBe(true); // Werewolves win
    });
  });
});
