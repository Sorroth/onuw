import { GamePhase } from '../valueObjects/gamePhase';
import { NightAction } from '../valueObjects/nightAction';
import { Role, Team } from '../entities/role';

export interface GameEvent {
  type: string;
  gameId: string;
  timestamp: Date;
}

export class GameCreatedEvent implements GameEvent {
  public readonly type = 'GAME_CREATED';
  public readonly gameId: string;
  public readonly timestamp: Date;
  public readonly roles: Role[];

  constructor(gameId: string, roles: Role[]) {
    this.gameId = gameId;
    this.timestamp = new Date();
    this.roles = [...roles];
  }
}

export class PlayerAddedEvent implements GameEvent {
  public readonly type = 'PLAYER_ADDED';
  public readonly gameId: string;
  public readonly timestamp: Date;
  public readonly playerId: string;
  public readonly playerName: string;

  constructor(gameId: string, playerId: string, playerName: string) {
    this.gameId = gameId;
    this.timestamp = new Date();
    this.playerId = playerId;
    this.playerName = playerName;
  }
}

export class RoleAssignedEvent implements GameEvent {
  public readonly type = 'ROLE_ASSIGNED';
  public readonly gameId: string;
  public readonly timestamp: Date;
  public readonly playerId: string;
  public readonly role: Role;

  constructor(gameId: string, playerId: string, role: Role) {
    this.gameId = gameId;
    this.timestamp = new Date();
    this.playerId = playerId;
    this.role = role;
  }
}

export class PhaseChangedEvent implements GameEvent {
  public readonly type = 'PHASE_CHANGED';
  public readonly gameId: string;
  public readonly timestamp: Date;
  public readonly phase: GamePhase;

  constructor(gameId: string, phase: GamePhase) {
    this.gameId = gameId;
    this.timestamp = new Date();
    this.phase = phase;
  }
}

export class NightActionPerformedEvent implements GameEvent {
  public readonly type = 'NIGHT_ACTION_PERFORMED';
  public readonly gameId: string;
  public readonly timestamp: Date;
  public readonly nightAction: NightAction;

  constructor(gameId: string, nightAction: NightAction) {
    this.gameId = gameId;
    this.timestamp = new Date();
    this.nightAction = nightAction;
  }
}

export class VoteSubmittedEvent implements GameEvent {
  public readonly type = 'VOTE_SUBMITTED';
  public readonly gameId: string;
  public readonly timestamp: Date;
  public readonly playerId: string;
  public readonly targetPlayerId: string;

  constructor(gameId: string, playerId: string, targetPlayerId: string) {
    this.gameId = gameId;
    this.timestamp = new Date();
    this.playerId = playerId;
    this.targetPlayerId = targetPlayerId;
  }
}

export class GameEndedEvent implements GameEvent {
  public readonly type = 'GAME_ENDED';
  public readonly gameId: string;
  public readonly timestamp: Date;
  public readonly winner: Team;
  public readonly killedPlayers: string[];

  constructor(gameId: string, winner: Team, killedPlayers: string[]) {
    this.gameId = gameId;
    this.timestamp = new Date();
    this.winner = winner;
    this.killedPlayers = [...killedPlayers];
  }
} 