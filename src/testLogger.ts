import { Role, NightAction, GamePhase } from './types';

/**
 * A logger for testing that records all game actions
 */
export class TestLogger {
  private logs: string[] = [];
  private enabled: boolean = true;

  /**
   * Log a message
   */
  public log(message: string): void {
    if (this.enabled) {
      this.logs.push(message);
      // Uncomment this line if you want to see logs in real-time during test execution
      // console.log(message);
    }
  }

  /**
   * Log a player action
   */
  public logPlayerAction(playerId: string, playerName: string, action: string): void {
    this.log(`Player ${playerName} (${playerId}): ${action}`);
  }

  /**
   * Log a night action
   */
  public logNightAction(action: NightAction, playerName: string): void {
    let actionDescription = `${playerName} (${action.role}): `;

    switch (action.actionType) {
      case 'view':
        if (action.revealedRoles) {
          const revealedInfo = Object.entries(action.revealedRoles)
            .map(([id, role]) => `${id} -> ${role}`)
            .join(', ');
          actionDescription += `Viewed roles: ${revealedInfo}`;
        } else {
          actionDescription += 'Viewed nothing';
        }
        break;
      case 'swap':
        if (action.swappedCards) {
          actionDescription += `Swapped cards: ${action.swappedCards.from} with ${action.swappedCards.to}`;
        } else {
          actionDescription += 'Failed to swap';
        }
        break;
      case 'none':
        actionDescription += 'No action performed';
        break;
    }

    this.log(actionDescription);
  }

  /**
   * Log a phase change
   */
  public logPhaseChange(phase: GamePhase): void {
    this.log(`--- Phase changed to: ${phase} ---`);
  }

  /**
   * Log a role assignment
   */
  public logRoleAssignment(playerId: string, playerName: string, role: Role): void {
    this.log(`Assigned role ${role} to ${playerName} (${playerId})`);
  }

  /**
   * Log a vote
   */
  public logVote(voterId: string, voterName: string, targetId: string, targetName: string): void {
    this.log(`${voterName} (${voterId}) voted for ${targetName} (${targetId})`);
  }

  /**
   * Log a winner
   */
  public logWinner(team: string): void {
    this.log(`--- Winner: ${team} ---`);
  }

  /**
   * Enable or disable logging
   */
  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /**
   * Get all logs as a string
   */
  public getLogsAsString(): string {
    return this.logs.join('\n');
  }

  /**
   * Get all logs as an array
   */
  public getLogs(): string[] {
    return [...this.logs];
  }

  /**
   * Clear all logs
   */
  public clear(): void {
    this.logs = [];
  }
}

// Singleton instance for use throughout tests
export const testLogger = new TestLogger(); 