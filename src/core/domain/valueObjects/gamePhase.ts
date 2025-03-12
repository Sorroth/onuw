export enum GamePhase {
  Setup = 'setup',
  Night = 'night',
  Day = 'day',
  Voting = 'voting',
  End = 'end'
}

export class GamePhaseTransition {
  private static readonly validTransitions: Record<GamePhase, GamePhase[]> = {
    [GamePhase.Setup]: [GamePhase.Night],
    [GamePhase.Night]: [GamePhase.Day],
    [GamePhase.Day]: [GamePhase.Voting],
    [GamePhase.Voting]: [GamePhase.End],
    [GamePhase.End]: [GamePhase.Setup] // Only for starting a new game
  };

  /**
   * Validate if a phase transition is allowed
   * @param currentPhase The current game phase
   * @param nextPhase The phase to transition to
   * @returns True if the transition is valid, false otherwise
   */
  public static isValidTransition(currentPhase: GamePhase, nextPhase: GamePhase): boolean {
    const allowedPhases = this.validTransitions[currentPhase] || [];
    return allowedPhases.includes(nextPhase);
  }

  /**
   * Get the next phase in the standard game flow
   * @param currentPhase The current game phase
   * @returns The next phase in the standard game flow
   */
  public static getNextPhase(currentPhase: GamePhase): GamePhase {
    switch (currentPhase) {
      case GamePhase.Setup:
        return GamePhase.Night;
      case GamePhase.Night:
        return GamePhase.Day;
      case GamePhase.Day:
        return GamePhase.Voting;
      case GamePhase.Voting:
        return GamePhase.End;
      case GamePhase.End:
        return GamePhase.Setup;
      default:
        throw new Error(`Invalid game phase: ${currentPhase}`);
    }
  }
} 