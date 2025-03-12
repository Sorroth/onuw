import { Player } from '../entities/player';
import { Role, Team } from '../entities/role';
import { GamePhase } from './gamePhase';
import { NightAction } from './nightAction';

export interface GameState {
  players: Player[];
  centerCards: Role[];
  roles: Role[];
  nightActionLog: NightAction[];
  phase: GamePhase;
  winner?: Team;
}

export interface GameConfig {
  roleList: Role[];
  playerCount: number;
  centerCardCount: number;
}

export class GameStateEntity implements GameState {
  public players: Player[];
  public centerCards: Role[];
  public roles: Role[];
  public nightActionLog: NightAction[];
  public phase: GamePhase;
  public winner?: Team;

  constructor(config?: GameConfig) {
    this.players = [];
    this.centerCards = [];
    this.roles = config?.roleList || [];
    this.nightActionLog = [];
    this.phase = GamePhase.Setup;
  }

  /**
   * Create a deep copy of the game state
   */
  public clone(): GameStateEntity {
    const clonedState = new GameStateEntity();
    clonedState.players = [...this.players];
    clonedState.centerCards = [...this.centerCards];
    clonedState.roles = [...this.roles];
    clonedState.nightActionLog = [...this.nightActionLog];
    clonedState.phase = this.phase;
    clonedState.winner = this.winner;
    return clonedState;
  }

  /**
   * Creates a plain object representation of the game state
   */
  public toDTO(): GameState {
    return {
      players: [...this.players],
      centerCards: [...this.centerCards],
      roles: [...this.roles],
      nightActionLog: [...this.nightActionLog],
      phase: this.phase,
      winner: this.winner
    };
  }
} 