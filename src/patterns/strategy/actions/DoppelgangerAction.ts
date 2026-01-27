/**
 * @fileoverview Doppelganger night action implementation.
 * @module patterns/strategy/actions/DoppelgangerAction
 *
 * @summary Handles the Doppelganger's night action - copying another player's role.
 *
 * @description
 * The Doppelganger is the most complex role in ONUW:
 * 1. Looks at another player's card
 * 2. BECOMES that role (copies abilities AND win condition)
 * 3. If the copied role has a night action, performs it IMMEDIATELY
 *
 * This means the Doppelganger can become anything - even a Werewolf!
 *
 * @pattern Strategy Pattern - Concrete Strategy for Doppelganger
 * @pattern Prototype Pattern - Doppelganger clones the target's role
 *
 * @remarks
 * Wake order: 1 (FIRST, before all other roles)
 *
 * Special timing rules:
 * - If copies Werewolf: Joins Werewolf wake (order 2)
 * - If copies Minion: Joins Minion wake (order 3)
 * - If copies Seer/Robber/etc: Acts immediately after viewing
 * - If copies Insomniac: Wakes AGAIN at the very end of night
 *
 * @example
 * ```typescript
 * const doppelgangerAction = new DoppelgangerAction();
 * const result = await doppelgangerAction.execute(context, agent, gameState);
 *
 * // result.info.copied shows what role was copied
 * // Additional results if copied role has immediate action
 * ```
 */

import { RoleName } from '../../../enums';
import { NightActionResult, NightActionContext, NightActionInfo } from '../../../types';
import {
  AbstractNightAction,
  INightActionAgent,
  INightActionGameState
} from '../NightAction';

/**
 * @summary Doppelganger night action - copy another player's role.
 *
 * @description
 * The Doppelganger:
 * 1. Wakes up first
 * 2. Looks at another player's card
 * 3. Becomes that role
 * 4. If the role has an immediate action, performs it
 *
 * @pattern Strategy Pattern - Concrete Strategy
 * @pattern Prototype Pattern - Clones the viewed role's behavior
 *
 * @remarks
 * The Doppelganger's complexity comes from timing:
 * - Doppel-Werewolf wakes with Werewolves (they see each other)
 * - Doppel-Minion wakes with Minion (sees Werewolves)
 * - Doppel-Seer acts immediately (views a card)
 * - Doppel-Insomniac wakes again at the very end
 *
 * @example
 * ```typescript
 * const doppelganger = new DoppelgangerAction();
 * const result = await doppelganger.execute(context, agent, gameState);
 * ```
 */
export class DoppelgangerAction extends AbstractNightAction {
  /**
   * @summary Creates a new DoppelgangerAction instance.
   */
  constructor() {
    super();
  }

  /**
   * @summary Returns the role name.
   *
   * @returns {RoleName} RoleName.DOPPELGANGER
   */
  getRoleName(): RoleName {
    return RoleName.DOPPELGANGER;
  }

  /**
   * @summary Returns the night wake order.
   *
   * @description
   * Doppelganger wakes FIRST at order 1. This ensures they can copy
   * a role before that role's normal wake time.
   *
   * @returns {number} 1
   */
  getNightOrder(): number {
    return 1;
  }

  /**
   * @summary Returns a description of the action.
   *
   * @returns {string} Description of Doppelganger night ability
   */
  getDescription(): string {
    return 'Look at another player\'s card and become that role';
  }

  /**
   * @summary Returns 'VIEW' as the action type.
   *
   * @description
   * Primary action is VIEW, though the copied role may cause swaps.
   *
   * @returns {'VIEW'} Always returns 'VIEW'
   *
   * @protected
   */
  protected getActionType(): 'VIEW' | 'SWAP' | 'NONE' {
    return 'VIEW';
  }

  /**
   * @summary Executes the Doppelganger night action.
   *
   * @description
   * 1. Ask agent to select a player to copy
   * 2. Look at their card and become that role
   * 3. If the role has an immediate action, execute it
   * 4. Return all results (copy info + any action results)
   *
   * @param {NightActionContext} context - What the player knows
   * @param {INightActionAgent} agent - Decision-maker for choices
   * @param {INightActionGameState} gameState - Game state access
   *
   * @returns {Promise<NightActionResult>} Result with copy info and any action results
   *
   * @remarks
   * The Doppelganger's result may include multiple pieces of info:
   * - What role was copied
   * - What the copied role's action revealed/changed
   *
   * @example
   * ```typescript
   * const result = await doppelgangerAction.doExecute(context, agent, gameState);
   * // result.info.copied = { fromPlayerId: 'player-3', role: RoleName.SEER }
   * // result.info.viewed = [{ playerId: 'player-2', role: RoleName.WEREWOLF }]
   * ```
   */
  protected async doExecute(
    context: NightActionContext,
    agent: INightActionAgent,
    gameState: INightActionGameState
  ): Promise<NightActionResult> {
    // Get valid targets (all players except self)
    const validTargets = context.allPlayerIds.filter(
      id => id !== context.myPlayerId
    );

    if (validTargets.length === 0) {
      return this.createFailureResult(
        context.myPlayerId,
        'No valid targets to copy'
      );
    }

    // Ask agent to select a player to copy
    const targetId = await agent.selectPlayer(validTargets, context);

    // Validate selection
    if (!validTargets.includes(targetId)) {
      return this.createFailureResult(
        context.myPlayerId,
        `Invalid target: ${targetId}`
      );
    }

    // Look at the target's card
    const copiedRole = gameState.getPlayerRole(targetId);

    // Record that this Doppelganger copied this role (for Werewolf/Mason visibility)
    gameState.setDoppelgangerCopiedRole(context.myPlayerId, copiedRole);

    // Build the result info
    const resultInfo: NightActionInfo = {
      copied: {
        fromPlayerId: targetId,
        role: copiedRole
      },
      viewed: [{
        playerId: targetId,
        role: copiedRole
      }]
    };

    // For roles that require player input, notify them what role they copied BEFORE asking
    // This ensures they know they're a "Doppel-Troublemaker" before selecting two players
    const rolesRequiringInput = [RoleName.SEER, RoleName.ROBBER, RoleName.TROUBLEMAKER, RoleName.DRUNK, RoleName.WEREWOLF];
    if (rolesRequiringInput.includes(copiedRole)) {
      const copyInfo = this.createSuccessResult(context.myPlayerId, {
        copied: {
          fromPlayerId: targetId,
          role: copiedRole
        },
        viewed: [{
          playerId: targetId,
          role: copiedRole
        }]
      });
      agent.receiveNightInfo(copyInfo);
    }

    // Handle immediate actions based on copied role
    const additionalInfo = await this.executeImmediateAction(
      copiedRole,
      context,
      agent,
      gameState
    );

    // Merge additional info
    if (additionalInfo) {
      if (additionalInfo.viewed) {
        resultInfo.viewed = [...(resultInfo.viewed || []), ...additionalInfo.viewed];
      }
      if (additionalInfo.swapped) {
        resultInfo.swapped = additionalInfo.swapped;
      }
      if (additionalInfo.werewolves) {
        resultInfo.werewolves = additionalInfo.werewolves;
      }
      if (additionalInfo.masons) {
        resultInfo.masons = additionalInfo.masons;
      }
    }

    return this.createSuccessResult(context.myPlayerId, resultInfo);
  }

  /**
   * @summary Executes the immediate action for the copied role.
   *
   * @description
   * Some roles perform their action immediately after being copied.
   * This method handles those cases.
   *
   * @param {RoleName} copiedRole - The role that was copied
   * @param {NightActionContext} context - What the player knows
   * @param {INightActionAgent} agent - Decision-maker for choices
   * @param {INightActionGameState} gameState - Game state access
   *
   * @returns {Promise<NightActionInfo | null>} Additional info from the action
   *
   * @private
   *
   * @remarks
   * Immediate actions:
   * - Seer: View a card now
   * - Robber: Swap now
   * - Troublemaker: Swap two others now
   * - Drunk: Swap with center now
   *
   * Delayed actions (handled by game):
   * - Werewolf: Joins Werewolf wake at order 2
   * - Minion: Joins Minion wake at order 3
   * - Mason: Joins Mason wake at order 4
   * - Insomniac: Wakes again at very end of night
   */
  private async executeImmediateAction(
    copiedRole: RoleName,
    context: NightActionContext,
    agent: INightActionAgent,
    gameState: INightActionGameState
  ): Promise<NightActionInfo | null> {
    switch (copiedRole) {
      case RoleName.SEER:
        return this.executeSeerAction(context, agent, gameState);

      case RoleName.ROBBER:
        return this.executeRobberAction(context, agent, gameState);

      case RoleName.TROUBLEMAKER:
        return this.executeTroublemakerAction(context, agent, gameState);

      case RoleName.DRUNK:
        return this.executeDrunkAction(context, agent, gameState);

      // Doppel-Werewolf: See other werewolves or peek at center if lone wolf
      case RoleName.WEREWOLF:
        return this.executeWerewolfAction(context, agent, gameState);

      // Doppel-Minion: See who the werewolves are
      case RoleName.MINION:
        return this.executeMinionAction(context, gameState);

      // Doppel-Mason: See other masons
      case RoleName.MASON:
        return this.executeMasonAction(context, gameState);

      // Doppel-Insomniac wakes again at the very end (not implemented yet)
      case RoleName.INSOMNIAC:
        return null;

      // These roles have no night action
      case RoleName.VILLAGER:
      case RoleName.HUNTER:
      case RoleName.TANNER:
      default:
        return null;
    }
  }

  /**
   * @summary Executes Seer action for Doppelganger.
   * @private
   */
  private async executeSeerAction(
    context: NightActionContext,
    agent: INightActionAgent,
    gameState: INightActionGameState
  ): Promise<NightActionInfo> {
    const choice = await agent.chooseSeerOption(context);

    if (choice === 'player') {
      const validTargets = context.allPlayerIds.filter(id => id !== context.myPlayerId);
      const targetId = await agent.selectPlayer(validTargets, context);
      const role = gameState.getPlayerRole(targetId);
      return { viewed: [{ playerId: targetId, role }] };
    } else {
      const [idx1, idx2] = await agent.selectTwoCenterCards(context);
      const role1 = gameState.getCenterCard(idx1);
      const role2 = gameState.getCenterCard(idx2);
      return {
        viewed: [
          { centerIndex: idx1, role: role1 },
          { centerIndex: idx2, role: role2 }
        ]
      };
    }
  }

  /**
   * @summary Executes Robber action for Doppelganger.
   * @private
   */
  private async executeRobberAction(
    context: NightActionContext,
    agent: INightActionAgent,
    gameState: INightActionGameState
  ): Promise<NightActionInfo> {
    const validTargets = context.allPlayerIds.filter(id => id !== context.myPlayerId);
    const targetId = await agent.selectPlayer(validTargets, context);

    // Perform swap
    gameState.swapCards(
      { playerId: context.myPlayerId },
      { playerId: targetId }
    );

    // Get new card
    const newRole = gameState.getPlayerRole(context.myPlayerId);

    return {
      swapped: {
        from: { playerId: context.myPlayerId },
        to: { playerId: targetId }
      },
      viewed: [{ playerId: context.myPlayerId, role: newRole }]
    };
  }

  /**
   * @summary Executes Troublemaker action for Doppelganger.
   * @private
   */
  private async executeTroublemakerAction(
    context: NightActionContext,
    agent: INightActionAgent,
    gameState: INightActionGameState
  ): Promise<NightActionInfo> {
    const validTargets = context.allPlayerIds.filter(id => id !== context.myPlayerId);
    const [player1Id, player2Id] = await agent.selectTwoPlayers(validTargets, context);

    gameState.swapCards(
      { playerId: player1Id },
      { playerId: player2Id }
    );

    return {
      swapped: {
        from: { playerId: player1Id },
        to: { playerId: player2Id }
      }
    };
  }

  /**
   * @summary Executes Drunk action for Doppelganger.
   * @private
   */
  private async executeDrunkAction(
    context: NightActionContext,
    agent: INightActionAgent,
    gameState: INightActionGameState
  ): Promise<NightActionInfo> {
    const centerIndex = await agent.selectCenterCard(context);

    gameState.swapCards(
      { playerId: context.myPlayerId },
      { centerIndex }
    );

    return {
      swapped: {
        from: { playerId: context.myPlayerId },
        to: { centerIndex }
      }
    };
  }

  /**
   * @summary Executes Werewolf action for Doppelganger.
   * @description Doppel-Werewolf sees other starting werewolves and other Doppel-Werewolves,
   * or peeks at center if lone wolf.
   * @private
   */
  private async executeWerewolfAction(
    context: NightActionContext,
    agent: INightActionAgent,
    gameState: INightActionGameState
  ): Promise<NightActionInfo> {
    // Find all players who STARTED as Werewolf
    const startingWerewolves = gameState.getPlayersWithStartingRole(RoleName.WEREWOLF);

    // Also find other Doppelgangers who copied Werewolf before this one
    // (Note: typically only one Doppelganger exists, but included for completeness)
    const otherDoppelWerewolves = gameState.getDoppelgangersWhoCopied(RoleName.WEREWOLF)
      .filter(id => id !== context.myPlayerId);

    // Combine both groups
    const allWerewolves = [...startingWerewolves, ...otherDoppelWerewolves];

    if (allWerewolves.length > 0) {
      // Doppel-Werewolf sees the starting werewolves and other Doppel-Werewolves
      return { werewolves: allWerewolves };
    }

    // Lone wolf (no starting werewolves or other Doppel-Werewolves) - peek at a center card
    const centerIndex = await agent.selectCenterCard(context);
    const centerRole = gameState.getCenterCard(centerIndex);

    return {
      werewolves: [],
      viewed: [{
        centerIndex,
        role: centerRole
      }]
    };
  }

  /**
   * @summary Executes Minion action for Doppelganger.
   * @description Doppel-Minion sees all werewolves (starting + other Doppel-Werewolves).
   * @private
   */
  private executeMinionAction(
    context: NightActionContext,
    gameState: INightActionGameState
  ): NightActionInfo {
    // Find all players who STARTED as Werewolf
    const startingWerewolves = gameState.getPlayersWithStartingRole(RoleName.WEREWOLF);

    // Also find other Doppelgangers who copied Werewolf
    // (Note: this Doppelganger is copying Minion, so they wouldn't be in this list)
    const doppelWerewolves = gameState.getDoppelgangersWhoCopied(RoleName.WEREWOLF);

    // Combine for complete werewolf team
    const werewolves = [...startingWerewolves, ...doppelWerewolves];
    return { werewolves };
  }

  /**
   * @summary Executes Mason action for Doppelganger.
   * @description Doppel-Mason sees other starting masons.
   * @private
   */
  private executeMasonAction(
    context: NightActionContext,
    gameState: INightActionGameState
  ): NightActionInfo {
    // Find all players who STARTED as Mason (excluding self)
    const allMasons = gameState.getPlayersWithStartingRole(RoleName.MASON);
    const otherMasons = allMasons.filter(id => id !== context.myPlayerId);
    return { masons: otherMasons };
  }
}
