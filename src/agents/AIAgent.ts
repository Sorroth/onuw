/**
 * @fileoverview AI agent with reasoning capabilities.
 * @module agents/AIAgent
 *
 * @summary An agent that uses game-aware reasoning for decisions.
 *
 * @description
 * AIAgent makes decisions based on:
 * - Known role information
 * - Night action results
 * - Analysis of other players' statements
 * - Win condition awareness
 *
 * Unlike RandomAgent, it applies strategy appropriate to its role.
 *
 * @pattern Strategy Pattern - Concrete strategy (reasoning-based)
 *
 * @example
 * ```typescript
 * const agent = new AIAgent('player-1', RoleName.SEER);
 * // Agent will act as a Seer should
 * ```
 */

import { AbstractAgent } from './Agent';
import {
  NightActionContext,
  DayContext,
  VotingContext,
  NightActionResult,
  PlayerStatement
} from '../types';
import { RoleName, Team } from '../enums';
import { ROLE_TEAMS } from '../core/Role';

/**
 * @summary Agent that uses reasoning for decisions.
 *
 * @description
 * Makes strategic decisions based on:
 * - Role-appropriate behavior
 * - Information analysis
 * - Claim tracking
 * - Contradiction detection
 *
 * @extends AbstractAgent
 *
 * @example
 * ```typescript
 * const seerAgent = new AIAgent('player-1', RoleName.SEER);
 * const werewolfAgent = new AIAgent('player-2', RoleName.WEREWOLF);
 * ```
 */
export class AIAgent extends AbstractAgent {
  // =========================================================================
  // MEMOIZED ROLE PATTERNS (Static - computed once)
  // =========================================================================

  /**
   * @summary Pre-computed patterns for detecting role claims in statements.
   *
   * @description
   * Instead of computing lowercase role patterns on every statement parse,
   * we pre-compute them once when the class loads. This provides a small
   * performance improvement when parsing many statements.
   *
   * Map structure: lowercase pattern -> RoleName
   * Example: "i am the seer" -> RoleName.SEER
   *
   * @static
   * @private
   */
  private static readonly ROLE_CLAIM_PATTERNS: Map<string, RoleName> = (() => {
    const patterns = new Map<string, RoleName>();
    for (const roleName of Object.values(RoleName)) {
      const lowerRole = roleName.toLowerCase();
      // "I am the Seer" pattern
      patterns.set(`i am the ${lowerRole}`, roleName);
      // "I am a Seer" pattern
      patterns.set(`i am a ${lowerRole}`, roleName);
    }
    return patterns;
  })();

  // =========================================================================
  // INSTANCE PROPERTIES
  // =========================================================================

  /** Starting role for this agent */
  private readonly startingRole: RoleName;

  /** Claims made by other players: playerId -> claimed role */
  private readonly claims: Map<string, RoleName> = new Map();

  /** Known werewolves (if Minion or Werewolf) */
  private knownWerewolves: string[] = [];

  /** Known role of another player (from viewing) */
  private knownPlayerRoles: Map<string, RoleName> = new Map();

  /** Current role (may change if Robber/Troublemaker/Drunk affected us) */
  private currentRole: RoleName;

  /**
   * @summary Creates a new AIAgent.
   *
   * @param {string} id - Player ID to control
   * @param {RoleName} startingRole - The role dealt to this player
   *
   * @example
   * ```typescript
   * const agent = new AIAgent('player-1', RoleName.SEER);
   * ```
   */
  constructor(id: string, startingRole: RoleName) {
    super(id);
    this.startingRole = startingRole;
    this.currentRole = startingRole;
  }

  /**
   * @summary Gets the team this agent is playing for.
   */
  private getTeam(): Team {
    return ROLE_TEAMS[this.currentRole];
  }

  /**
   * @summary Selects a player strategically.
   *
   * @description
   * Selection strategy depends on role:
   * - Seer: Selects player most likely to be Werewolf
   * - Robber: Selects player with desirable role
   * - Doppelganger: Selects player with powerful role
   */
  async selectPlayer(options: string[], context: NightActionContext): Promise<string> {
    switch (this.startingRole) {
      case RoleName.SEER:
        // As Seer, pick someone we don't have info about
        return this.selectUnknownPlayer(options);

      case RoleName.ROBBER:
        // As Robber, prefer stealing from unknown players
        return this.selectUnknownPlayer(options);

      case RoleName.DOPPELGANGER:
        // As Doppelganger, pick randomly (any role could be good)
        return options[Math.floor(Math.random() * options.length)];

      default:
        return options[Math.floor(Math.random() * options.length)];
    }
  }

  /**
   * @summary Selects a player we don't have information about.
   */
  private selectUnknownPlayer(options: string[]): string {
    const unknown = options.filter(id => !this.knownPlayerRoles.has(id));
    if (unknown.length > 0) {
      return unknown[Math.floor(Math.random() * unknown.length)];
    }
    return options[Math.floor(Math.random() * options.length)];
  }

  /**
   * @summary Selects a center card strategically.
   */
  async selectCenterCard(_context: NightActionContext): Promise<number> {
    // Random center card (no strategic preference)
    return Math.floor(Math.random() * 3);
  }

  /**
   * @summary Selects two center cards.
   */
  async selectTwoCenterCards(_context: NightActionContext): Promise<[number, number]> {
    const indices = [0, 1, 2].sort(() => Math.random() - 0.5);
    return [indices[0], indices[1]];
  }

  /**
   * @summary Chooses between viewing player or center.
   *
   * @description
   * As Seer, viewing a player gives more actionable info,
   * but center can reveal if Werewolves are in play.
   */
  async chooseSeerOption(_context: NightActionContext): Promise<'player' | 'center'> {
    // 70% chance to view player (more direct info)
    return Math.random() < 0.7 ? 'player' : 'center';
  }

  /**
   * @summary Selects two players for Troublemaker swap.
   *
   * @description
   * As Troublemaker, try to swap:
   * - Known werewolf with unknown player, OR
   * - Two unknown players
   */
  async selectTwoPlayers(options: string[], _context: NightActionContext): Promise<[string, string]> {
    // Just pick two random players
    const shuffled = [...options].sort(() => Math.random() - 0.5);
    return [shuffled[0], shuffled[1]];
  }

  /**
   * @summary Makes a strategic statement.
   *
   * @description
   * Statement depends on team:
   * - Village: Share truthful information
   * - Werewolf: Lie/deflect
   * - Tanner: Act slightly suspicious
   */
  async makeStatement(context: DayContext): Promise<string> {
    // Parse other statements for claims
    this.parseStatements(context.statements);

    const team = this.getTeam();

    if (team === Team.VILLAGE) {
      return this.makeVillageStatement(context);
    } else if (team === Team.WEREWOLF) {
      return this.makeWerewolfStatement(context);
    } else {
      return this.makeTannerStatement(context);
    }
  }

  /**
   * @summary Makes a village team statement.
   */
  private makeVillageStatement(context: DayContext): string {
    switch (this.startingRole) {
      case RoleName.SEER:
        return this.makeSeerStatement();

      case RoleName.ROBBER:
        return this.makeRobberStatement();

      case RoleName.TROUBLEMAKER:
        return this.makeTroublemakerStatement();

      case RoleName.MASON:
        return this.makeMasonStatement();

      case RoleName.INSOMNIAC:
        return this.makeInsomniacStatement();

      case RoleName.DRUNK:
        return `I am the Drunk. I swapped with a center card but don't know what I am now.`;

      default:
        return `I am a ${this.startingRole}. I don't have specific information to share.`;
    }
  }

  /**
   * @summary Makes a Seer statement based on night info.
   */
  private makeSeerStatement(): string {
    if (this.nightInfo.length === 0) {
      return 'I am the Seer but something went wrong with my action.';
    }

    const result = this.nightInfo[0];
    if (result.info.viewed && result.info.viewed.length > 0) {
      const viewed = result.info.viewed;

      if (viewed.length === 1 && viewed[0].playerId) {
        const playerId = viewed[0].playerId;
        const role = viewed[0].role;
        this.knownPlayerRoles.set(playerId, role);

        if (role === RoleName.WEREWOLF) {
          return `I am the Seer! I looked at ${playerId} and they are a WEREWOLF! We must vote for them!`;
        } else if (role === RoleName.TANNER) {
          return `I am the Seer. I looked at ${playerId} and they are the Tanner. Be careful not to vote for them!`;
        } else {
          return `I am the Seer. I looked at ${playerId} and they are a ${role}. They are on the Village team.`;
        }
      } else {
        // Viewed center cards
        const centerInfo = viewed.map(v => `${v.role}`).join(' and ');
        return `I am the Seer. I looked at two center cards and saw: ${centerInfo}.`;
      }
    }

    return 'I am the Seer but I did not see anything useful.';
  }

  /**
   * @summary Makes a Robber statement based on night info.
   */
  private makeRobberStatement(): string {
    if (this.nightInfo.length === 0 || !this.nightInfo[0].info.viewed) {
      return 'I am the Robber but something went wrong.';
    }

    const viewed = this.nightInfo[0].info.viewed[0];
    const newRole = viewed.role;

    if (newRole === RoleName.WEREWOLF) {
      return `I am the Robber. I stole a Werewolf card! The person I stole from is now the Robber and innocent.`;
    }

    return `I am the Robber. I swapped with someone and am now the ${newRole}.`;
  }

  /**
   * @summary Makes a Troublemaker statement.
   */
  private makeTroublemakerStatement(): string {
    if (this.nightInfo.length === 0 || !this.nightInfo[0].info.swapped) {
      return 'I am the Troublemaker but something went wrong.';
    }

    const swap = this.nightInfo[0].info.swapped;
    return `I am the Troublemaker. I swapped ${swap.from.playerId}'s card with ${swap.to.playerId}'s card.`;
  }

  /**
   * @summary Makes a Mason statement.
   */
  private makeMasonStatement(): string {
    if (this.nightInfo.length > 0 && this.nightInfo[0].info.masons) {
      const otherMasons = this.nightInfo[0].info.masons;
      if (otherMasons.length > 0) {
        return `I am a Mason. My Mason partner is ${otherMasons[0]}.`;
      }
      return 'I am a Mason. I did not see another Mason, so the other Mason card is in the center.';
    }
    return 'I am a Mason.';
  }

  /**
   * @summary Makes an Insomniac statement.
   */
  private makeInsomniacStatement(): string {
    if (this.nightInfo.length > 0 && this.nightInfo[0].info.viewed) {
      const viewed = this.nightInfo[0].info.viewed[0];
      const finalRole = viewed.role;

      if (finalRole === RoleName.INSOMNIAC) {
        return 'I am the Insomniac. I checked my card at the end of night and I am still the Insomniac.';
      }
      return `I am the Insomniac. I checked my card and it changed to ${finalRole}! I was swapped!`;
    }
    return 'I am the Insomniac.';
  }

  /**
   * @summary Makes a Werewolf team statement (lie/deflect).
   */
  private makeWerewolfStatement(context: DayContext): string {
    // Check which roles are unclaimed
    const claimedRoles = new Set(this.claims.values());

    // Claim a safe role
    if (!claimedRoles.has(RoleName.VILLAGER)) {
      return 'I am a Villager. I have no night information.';
    }

    if (!claimedRoles.has(RoleName.HUNTER)) {
      return 'I am the Hunter. I have no night information, but be careful if you vote for me.';
    }

    // If common claims are taken, claim Villager anyway
    return 'I am a Villager. I have no information to share.';
  }

  /**
   * @summary Makes a Tanner statement (act suspicious).
   */
  private makeTannerStatement(context: DayContext): string {
    // Tanner wants to seem slightly suspicious but not obviously Tanner
    const suspicious = [
      'I... I\'m the Seer. I looked at someone but I don\'t want to say who.',
      'I\'m a Villager. Why is everyone looking at me?',
      'I have information but I\'m not sure I should share it.',
      'I think I might be a Werewolf? No wait, I\'m a Villager.',
    ];

    return suspicious[Math.floor(Math.random() * suspicious.length)];
  }

  /**
   * @summary Votes strategically.
   *
   * @description
   * Voting strategy depends on team:
   * - Village: Vote for known/suspected Werewolf
   * - Werewolf: Vote for Village member
   * - Tanner: Vote randomly (doesn't matter)
   */
  async vote(context: VotingContext): Promise<string> {
    this.parseStatements(context.allStatements);

    const team = this.getTeam();

    if (team === Team.VILLAGE) {
      return this.voteAsVillage(context);
    } else if (team === Team.WEREWOLF) {
      return this.voteAsWerewolf(context);
    } else {
      // Tanner doesn't care who dies
      return context.eligibleTargets[
        Math.floor(Math.random() * context.eligibleTargets.length)
      ] as string;
    }
  }

  /**
   * @summary Votes as Village team member.
   */
  private voteAsVillage(context: VotingContext): string {
    // Priority: known werewolf > suspicious > random
    for (const [playerId, role] of this.knownPlayerRoles) {
      if (role === RoleName.WEREWOLF && context.eligibleTargets.includes(playerId)) {
        return playerId;
      }
    }

    // Vote for someone who claimed suspiciously
    for (const targetId of context.eligibleTargets) {
      const claim = this.claims.get(targetId as string);
      if (!claim) {
        // No claim is suspicious
        return targetId as string;
      }
    }

    // Random vote
    return context.eligibleTargets[
      Math.floor(Math.random() * context.eligibleTargets.length)
    ] as string;
  }

  /**
   * @summary Votes as Werewolf team member.
   */
  private voteAsWerewolf(context: VotingContext): string {
    // Don't vote for known werewolves
    const safeTargets = (context.eligibleTargets as string[]).filter(
      id => !this.knownWerewolves.includes(id)
    );

    if (safeTargets.length === 0) {
      // All targets are werewolves, vote randomly
      return context.eligibleTargets[
        Math.floor(Math.random() * context.eligibleTargets.length)
      ] as string;
    }

    // Vote for someone who claimed Seer (dangerous to werewolves)
    for (const targetId of safeTargets) {
      const claim = this.claims.get(targetId);
      if (claim === RoleName.SEER) {
        return targetId;
      }
    }

    // Random safe target
    return safeTargets[Math.floor(Math.random() * safeTargets.length)];
  }

  /**
   * @summary Parses statements to extract claims.
   *
   * @description
   * Uses pre-computed role patterns for efficient claim detection.
   * Patterns are memoized in ROLE_CLAIM_PATTERNS static property.
   */
  private parseStatements(statements: ReadonlyArray<PlayerStatement>): void {
    for (const stmt of statements) {
      const text = stmt.statement.toLowerCase();

      // Use memoized patterns for efficient claim detection
      for (const [pattern, roleName] of AIAgent.ROLE_CLAIM_PATTERNS) {
        if (text.includes(pattern)) {
          this.claims.set(stmt.playerId, roleName);
          break;
        }
      }
    }
  }

  /**
   * @summary Processes night information.
   */
  receiveNightInfo(info: NightActionResult): void {
    super.receiveNightInfo(info);

    // Update known information
    if (info.info.werewolves) {
      this.knownWerewolves = [...info.info.werewolves];
    }

    if (info.info.viewed) {
      for (const view of info.info.viewed) {
        if (view.playerId) {
          this.knownPlayerRoles.set(view.playerId, view.role);
        }
      }
    }

    // If Robber or affected by swap, update current role
    if (info.info.viewed && info.roleName === RoleName.ROBBER) {
      this.currentRole = info.info.viewed[0].role;
    }
  }
}
