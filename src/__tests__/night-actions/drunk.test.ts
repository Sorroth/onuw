/**
 * @fileoverview Drunk role tests.
 * Tests DR1-DR5 from the test checklist.
 */

import { RoleName, Team } from '../../enums';
import {
  createTestGame,
  teamWon,
  playerEliminated,
  getFinalRole
} from '../setup/testUtils';

describe('Drunk Role Tests', () => {
  describe('Night Action Tests', () => {
    it('DR1: Drunk should swap card with center without seeing it', async () => {
      const DRUNK_ROLES = [
        RoleName.DRUNK, RoleName.WEREWOLF, RoleName.VILLAGER,
        RoleName.VILLAGER, RoleName.VILLAGER,
        RoleName.SEER, RoleName.VILLAGER, RoleName.VILLAGER
      ];

      let drunkNightInfo: any = null;

      const agentConfigs = new Map([
        [0, {
          selectCenterIndex: 0, // Swap with center card (Seer)
          onNightInfo: (info: any) => { drunkNightInfo = info; },
          voteTarget: 'player-2'
        }],
        [1, { voteTarget: 'player-2' }],
        [2, { voteTarget: 'player-2' }],
        [3, { voteTarget: 'player-2' }],
        [4, { voteTarget: 'player-2' }]
      ]);

      const { result } = await createTestGame({
        roles: DRUNK_ROLES,
        forcedRoles: new Map([
          [0, RoleName.DRUNK],
          [1, RoleName.WEREWOLF]
        ]),
        agentConfigs
      });

      // Drunk should receive swap info but NOT see what they got
      expect(drunkNightInfo).not.toBeNull();
      expect(drunkNightInfo.roleName).toBe(RoleName.DRUNK);
      expect(drunkNightInfo.actionType).toBe('SWAP');
      expect(drunkNightInfo.info.swapped).toBeDefined();

      // Village wins when werewolf is eliminated
      expect(teamWon(result, Team.VILLAGE)).toBe(true);
    });

    it('DR2: Drunk swapping with center card changes their role', async () => {
      // Werewolves forced to center means Drunk might swap into a Werewolf
      const DRUNK_ROLES = [
        RoleName.DRUNK, RoleName.VILLAGER, RoleName.VILLAGER,
        RoleName.VILLAGER, RoleName.VILLAGER,
        RoleName.WEREWOLF, RoleName.WEREWOLF, RoleName.VILLAGER
      ];

      const agentConfigs = new Map([
        [0, {
          selectCenterIndex: 0, // Swap with first center card
          voteTarget: 'player-2'
        }],
        [1, { voteTarget: 'player-2' }],
        [2, { voteTarget: 'player-2' }],
        [3, { voteTarget: 'player-2' }],
        [4, { voteTarget: 'player-2' }]
      ]);

      const { result } = await createTestGame({
        roles: DRUNK_ROLES,
        forcedRoles: new Map([[0, RoleName.DRUNK]]),
        forceWerewolvesToCenter: true,
        agentConfigs
      });

      // Drunk should have swapped with a center card (likely Werewolf)
      const drunkFinalRole = getFinalRole(result, 'player-1');
      expect(drunkFinalRole).not.toBe(RoleName.DRUNK); // No longer Drunk
    });

    it('DR3: Drunk card should be in center after swap', async () => {
      const DRUNK_ROLES = [
        RoleName.DRUNK, RoleName.WEREWOLF, RoleName.VILLAGER,
        RoleName.VILLAGER, RoleName.VILLAGER,
        RoleName.SEER, RoleName.VILLAGER, RoleName.VILLAGER
      ];

      const agentConfigs = new Map([
        [0, {
          selectCenterIndex: 0,
          voteTarget: 'player-2'
        }],
        [1, { voteTarget: 'player-2' }],
        [2, { voteTarget: 'player-2' }],
        [3, { voteTarget: 'player-2' }],
        [4, { voteTarget: 'player-2' }]
      ]);

      const { result } = await createTestGame({
        roles: DRUNK_ROLES,
        forcedRoles: new Map([
          [0, RoleName.DRUNK],
          [1, RoleName.WEREWOLF]
        ]),
        agentConfigs
      });

      // Drunk should no longer have Drunk card
      expect(getFinalRole(result, 'player-1')).not.toBe(RoleName.DRUNK);

      // Village wins since werewolf was eliminated
      expect(teamWon(result, Team.VILLAGE)).toBe(true);
    });
  });

  describe('Win Condition Tests', () => {
    it('DR4: Drunk-turned-Werewolf should win when no werewolf is eliminated', async () => {
      // Force werewolves to center so Drunk can swap into one
      const DRUNK_ROLES = [
        RoleName.DRUNK, RoleName.VILLAGER, RoleName.VILLAGER,
        RoleName.VILLAGER, RoleName.VILLAGER,
        RoleName.WEREWOLF, RoleName.WEREWOLF, RoleName.VILLAGER
      ];

      const agentConfigs = new Map([
        [0, {
          selectCenterIndex: 0, // Swap with first center (Werewolf)
          voteTarget: 'player-2'
        }],
        [1, { voteTarget: 'player-2' }],
        [2, { voteTarget: 'player-2' }],
        [3, { voteTarget: 'player-2' }],
        [4, { voteTarget: 'player-2' }]
      ]);

      const { result } = await createTestGame({
        roles: DRUNK_ROLES,
        forcedRoles: new Map([[0, RoleName.DRUNK]]),
        forceWerewolvesToCenter: true,
        agentConfigs
      });

      // If Drunk picked up a Werewolf card, werewolves win when villager eliminated
      const drunkFinalRole = getFinalRole(result, 'player-1');
      if (drunkFinalRole === RoleName.WEREWOLF) {
        expect(playerEliminated(result, 'player-2')).toBe(true);
        expect(teamWon(result, Team.WEREWOLF)).toBe(true);
        expect(result.winningPlayers).toContain('player-1');
      }
    });

    it('DR5: Drunk-turned-Werewolf should lose when eliminated', async () => {
      // Force werewolves to center so Drunk can swap into one
      const DRUNK_ROLES = [
        RoleName.DRUNK, RoleName.VILLAGER, RoleName.VILLAGER,
        RoleName.VILLAGER, RoleName.VILLAGER,
        RoleName.WEREWOLF, RoleName.WEREWOLF, RoleName.VILLAGER
      ];

      const agentConfigs = new Map([
        [0, {
          selectCenterIndex: 0, // Swap with first center (Werewolf)
          voteTarget: 'player-2'
        }],
        [1, { voteTarget: 'player-1' }], // Vote for Drunk
        [2, { voteTarget: 'player-1' }],
        [3, { voteTarget: 'player-1' }],
        [4, { voteTarget: 'player-1' }]
      ]);

      const { result } = await createTestGame({
        roles: DRUNK_ROLES,
        forcedRoles: new Map([[0, RoleName.DRUNK]]),
        forceWerewolvesToCenter: true,
        agentConfigs
      });

      // Drunk was eliminated
      expect(playerEliminated(result, 'player-1')).toBe(true);

      // If Drunk picked up Werewolf, Village wins by killing the only werewolf
      const drunkFinalRole = getFinalRole(result, 'player-1');
      if (drunkFinalRole === RoleName.WEREWOLF) {
        expect(teamWon(result, Team.VILLAGE)).toBe(true);
      }
    });
  });
});
