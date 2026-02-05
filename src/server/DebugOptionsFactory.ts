/**
 * @fileoverview Factory for debug options configurations.
 * @module server/DebugOptionsFactory
 *
 * @summary Provides preset debug configurations for testing scenarios.
 *
 * @description
 * DebugOptionsFactory creates preset debug configurations for common
 * testing scenarios:
 * - Hunter testing (force elimination)
 * - Doppelganger testing (reveal all roles)
 * - Center card testing (show center cards)
 * - Role-specific testing (force specific role)
 *
 * @pattern Factory Pattern - Creates debug option configurations
 *
 * @example
 * ```typescript
 * // Create preset for testing Hunter ability
 * const options = DebugOptionsFactory.createHunterTest();
 *
 * // Create custom configuration
 * const custom = DebugOptionsFactory.create({
 *   forceRole: RoleName.DOPPELGANGER,
 *   revealAllRoles: true
 * });
 * ```
 */

import { RoleName } from '../enums';
import { DebugOptions } from '../network/protocol';

/**
 * @summary Preset debug configuration names.
 */
export type DebugPreset =
  | 'hunterTest'
  | 'doppelgangerTest'
  | 'centerCardTest'
  | 'fullDebug';

/**
 * @summary Factory for creating debug options.
 *
 * @description
 * Provides methods for creating common debug configurations
 * and custom combinations for testing.
 *
 * @pattern Factory Pattern - Creates debug option configurations
 */
export class DebugOptionsFactory {
  /**
   * @summary Creates debug options from partial configuration.
   *
   * @param {Partial<DebugOptions>} options - Partial options
   *
   * @returns {DebugOptions} Complete debug options
   *
   * @example
   * ```typescript
   * const options = DebugOptionsFactory.create({
   *   forceRole: RoleName.WEREWOLF,
   *   showCenterCards: true
   * });
   * ```
   */
  static create(options: Partial<DebugOptions>): DebugOptions {
    return {
      forceRole: options.forceRole,
      forceHostElimination: options.forceHostElimination ?? false,
      revealAllRoles: options.revealAllRoles ?? false,
      showCenterCards: options.showCenterCards ?? false,
      disableTimers: options.disableTimers ?? false,
      forceWerewolvesToCenter: options.forceWerewolvesToCenter ?? false,
    };
  }

  /**
   * @summary Creates options for testing Hunter ability.
   *
   * @description
   * Forces the host to be eliminated so Hunter's death
   * ability can be tested.
   *
   * @param {RoleName} [forceRole=RoleName.HUNTER] - Role to force
   *
   * @returns {DebugOptions} Hunter test configuration
   *
   * @example
   * ```typescript
   * const options = DebugOptionsFactory.createHunterTest();
   * ```
   */
  static createHunterTest(forceRole: RoleName = RoleName.HUNTER): DebugOptions {
    return {
      forceRole,
      forceHostElimination: true,
      revealAllRoles: false,
      showCenterCards: false,
      disableTimers: false,
      forceWerewolvesToCenter: false,
    };
  }

  /**
   * @summary Creates options for testing Doppelganger.
   *
   * @description
   * Reveals all roles so the Doppelganger's copied role
   * behavior can be verified.
   *
   * @returns {DebugOptions} Doppelganger test configuration
   *
   * @example
   * ```typescript
   * const options = DebugOptionsFactory.createDoppelgangerTest();
   * ```
   */
  static createDoppelgangerTest(): DebugOptions {
    return {
      forceRole: RoleName.DOPPELGANGER,
      forceHostElimination: false,
      revealAllRoles: true,
      showCenterCards: false,
      disableTimers: false,
      forceWerewolvesToCenter: false,
    };
  }

  /**
   * @summary Creates options for testing center card interactions.
   *
   * @description
   * Shows center cards for testing Drunk, Werewolf lone wolf,
   * and Seer center viewing.
   *
   * @param {RoleName} [forceRole] - Optional role to force
   *
   * @returns {DebugOptions} Center card test configuration
   *
   * @example
   * ```typescript
   * const options = DebugOptionsFactory.createCenterCardTest(RoleName.DRUNK);
   * ```
   */
  static createCenterCardTest(forceRole?: RoleName): DebugOptions {
    return {
      forceRole,
      forceHostElimination: false,
      revealAllRoles: false,
      showCenterCards: true,
      disableTimers: false,
      forceWerewolvesToCenter: false,
    };
  }

  /**
   * @summary Creates full debug configuration.
   *
   * @description
   * Enables all debug options for comprehensive testing.
   *
   * @param {RoleName} [forceRole] - Optional role to force
   *
   * @returns {DebugOptions} Full debug configuration
   *
   * @example
   * ```typescript
   * const options = DebugOptionsFactory.createFullDebug(RoleName.SEER);
   * ```
   */
  static createFullDebug(forceRole?: RoleName): DebugOptions {
    return {
      forceRole,
      forceHostElimination: true,
      revealAllRoles: true,
      showCenterCards: true,
      disableTimers: true,
      forceWerewolvesToCenter: false,
    };
  }

  /**
   * @summary Creates options from a preset name.
   *
   * @param {DebugPreset} preset - Preset name
   * @param {RoleName} [forceRole] - Optional role override
   *
   * @returns {DebugOptions} Debug options for preset
   *
   * @example
   * ```typescript
   * const options = DebugOptionsFactory.fromPreset('hunterTest');
   * ```
   */
  static fromPreset(preset: DebugPreset, forceRole?: RoleName): DebugOptions {
    switch (preset) {
      case 'hunterTest':
        return this.createHunterTest(forceRole ?? RoleName.HUNTER);
      case 'doppelgangerTest':
        return this.createDoppelgangerTest();
      case 'centerCardTest':
        return this.createCenterCardTest(forceRole);
      case 'fullDebug':
        return this.createFullDebug(forceRole);
      default:
        return this.create({});
    }
  }

  /**
   * @summary Gets info about available presets.
   *
   * @returns {Array<{ name: DebugPreset; description: string }>} Preset info
   */
  static getPresetInfo(): Array<{ name: DebugPreset; description: string }> {
    return [
      {
        name: 'hunterTest',
        description: 'Force elimination to test Hunter death ability',
      },
      {
        name: 'doppelgangerTest',
        description: 'Reveal all roles to verify Doppelganger behavior',
      },
      {
        name: 'centerCardTest',
        description: 'Show center cards for Drunk/Werewolf/Seer testing',
      },
      {
        name: 'fullDebug',
        description: 'Enable all debug options for comprehensive testing',
      },
    ];
  }

  /**
   * @summary Validates debug options.
   *
   * @param {unknown} options - Options to validate
   *
   * @returns {boolean} True if valid
   */
  static isValid(options: unknown): options is DebugOptions {
    if (typeof options !== 'object' || options === null) {
      return false;
    }

    const opt = options as Record<string, unknown>;

    // forceRole must be a valid RoleName if present
    if (opt.forceRole !== undefined) {
      if (typeof opt.forceRole !== 'string') {
        return false;
      }
      if (!Object.values(RoleName).includes(opt.forceRole as RoleName)) {
        return false;
      }
    }

    // Boolean flags
    if (opt.forceHostElimination !== undefined && typeof opt.forceHostElimination !== 'boolean') {
      return false;
    }
    if (opt.revealAllRoles !== undefined && typeof opt.revealAllRoles !== 'boolean') {
      return false;
    }
    if (opt.showCenterCards !== undefined && typeof opt.showCenterCards !== 'boolean') {
      return false;
    }
    if (opt.disableTimers !== undefined && typeof opt.disableTimers !== 'boolean') {
      return false;
    }
    if (opt.forceWerewolvesToCenter !== undefined && typeof opt.forceWerewolvesToCenter !== 'boolean') {
      return false;
    }

    return true;
  }
}
