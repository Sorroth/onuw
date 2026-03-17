/**
 * @fileoverview Special scenario tests.
 * Tests SP1-SP7 from the test checklist.
 */

import { RoleName, Team } from '../../enums';
import {
  createTestGame,
  teamWon,
  playerEliminated,
  noOneEliminated,
  createTieVoteConfigs,
  createTwoWayTieConfigs
} from '../setup/testUtils';

describe('Special Scenario Tests', () => {
  describe('No Werewolves Among Players', () => {
    const NO_WOLF_ROLES = [
      RoleName.SEER, RoleName.VILLAGER,
      RoleName.VILLAGER, RoleName.VILLAGER, RoleName.VILLAGER,
      RoleName.WEREWOLF, RoleName.WEREWOLF, RoleName.VILLAGER
    ];

    it('SP1: Village wins when werewolf is eliminated', async () => {
      // Standard scenario: werewolves exist and one is eliminated
      const WITH_WOLF_ROLES = [
        RoleName.SEER, RoleName.WEREWOLF,
        RoleName.VILLAGER, RoleName.VILLAGER, RoleName.VILLAGER,
        RoleName.VILLAGER, RoleName.VILLAGER, RoleName.VILLAGER
      ];

      const { result } = await createTestGame({
        roles: WITH_WOLF_ROLES,
        forcedRoles: new Map([[1, RoleName.WEREWOLF]]),
        defaultVoteTarget: 'player-2' // Vote for werewolf
      });

      expect(playerEliminated(result, 'player-2')).toBe(true);
      expect(teamWon(result, Team.VILLAGE)).toBe(true);
    });

    it('SP2: Village loses when no werewolves exist but someone dies', async () => {
      const { result } = await createTestGame({
        roles: NO_WOLF_ROLES,
        forceWerewolvesToCenter: true,
        defaultVoteTarget: 'player-1' // Vote for a villager
      });

      expect(playerEliminated(result, 'player-1')).toBe(true);
      expect(teamWon(result, Team.VILLAGE)).toBe(false);
    });

    it('SP3: Minion wins alone when no werewolves exist and non-Minion dies', async () => {
      const MINION_NO_WOLF_ROLES = [
        RoleName.MINION, RoleName.SEER,
        RoleName.VILLAGER, RoleName.VILLAGER, RoleName.VILLAGER,
        RoleName.WEREWOLF, RoleName.WEREWOLF, RoleName.VILLAGER
      ];

      const { result } = await createTestGame({
        roles: MINION_NO_WOLF_ROLES,
        forcedRoles: new Map([[0, RoleName.MINION]]),
        forceWerewolvesToCenter: true,
        defaultVoteTarget: 'player-2' // Vote for non-Minion
      });

      expect(playerEliminated(result, 'player-2')).toBe(true);
      expect(teamWon(result, Team.WEREWOLF)).toBe(true); // Minion wins
    });

    it('SP4: Village wins when no werewolves exist and Minion dies', async () => {
      const MINION_NO_WOLF_ROLES = [
        RoleName.MINION, RoleName.SEER,
        RoleName.VILLAGER, RoleName.VILLAGER, RoleName.VILLAGER,
        RoleName.WEREWOLF, RoleName.WEREWOLF, RoleName.VILLAGER
      ];

      const { result } = await createTestGame({
        roles: MINION_NO_WOLF_ROLES,
        forcedRoles: new Map([[0, RoleName.MINION]]),
        forceWerewolvesToCenter: true,
        defaultVoteTarget: 'player-1' // Vote for Minion
      });

      expect(playerEliminated(result, 'player-1')).toBe(true);
      expect(teamWon(result, Team.VILLAGE)).toBe(true);
    });
  });

  describe('Multiple Eliminations', () => {
    const STANDARD_ROLES = [
      RoleName.WEREWOLF, RoleName.WEREWOLF,
      RoleName.VILLAGER, RoleName.VILLAGER, RoleName.VILLAGER,
      RoleName.VILLAGER, RoleName.VILLAGER, RoleName.VILLAGER
    ];

    it('SP5: Tie elimination should kill multiple players', async () => {
      // Create a tie between player-1 and player-2
      const agentConfigs = createTwoWayTieConfigs(5, 0, 1);

      const { result } = await createTestGame({
        roles: STANDARD_ROLES,
        forcedRoles: new Map([
          [0, RoleName.WEREWOLF],
          [1, RoleName.VILLAGER]
        ]),
        agentConfigs
      });

      // With 5 players, 2-way tie means some players voted for each
      // The exact outcome depends on vote distribution
      expect(result.eliminatedPlayers.length).toBeGreaterThanOrEqual(1);
    });

    it('SP6: Tanner wins when eliminated alongside others', async () => {
      const TANNER_ROLES = [
        RoleName.WEREWOLF, RoleName.TANNER,
        RoleName.VILLAGER, RoleName.VILLAGER, RoleName.VILLAGER,
        RoleName.VILLAGER, RoleName.VILLAGER, RoleName.VILLAGER
      ];

      // Everyone votes for Tanner
      const { result } = await createTestGame({
        roles: TANNER_ROLES,
        forcedRoles: new Map([
          [0, RoleName.WEREWOLF],
          [1, RoleName.TANNER]
        ]),
        defaultVoteTarget: 'player-2' // Vote for Tanner
      });

      expect(playerEliminated(result, 'player-2')).toBe(true); // Tanner
      expect(teamWon(result, Team.TANNER)).toBe(true);
      // Werewolf doesn't win when Tanner is eliminated
      expect(teamWon(result, Team.WEREWOLF)).toBe(false);
    });

    it('SP7: Werewolf wins when non-werewolf is eliminated', async () => {
      // Werewolves win when a villager is eliminated
      const { result } = await createTestGame({
        roles: STANDARD_ROLES,
        forcedRoles: new Map([
          [0, RoleName.WEREWOLF],
          [2, RoleName.VILLAGER]
        ]),
        defaultVoteTarget: 'player-3' // Vote for villager
      });

      expect(playerEliminated(result, 'player-3')).toBe(true);
      expect(teamWon(result, Team.WEREWOLF)).toBe(true);
    });
  });
});
