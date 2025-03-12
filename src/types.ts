export enum Role {
  Doppelganger = 'doppelganger',
  Werewolf = 'werewolf',
  Minion = 'minion',
  Mason = 'mason',
  Seer = 'seer',
  Robber = 'robber',
  Troublemaker = 'troublemaker',
  Drunk = 'drunk',
  Insomniac = 'insomniac',
  Villager = 'villager',
  Hunter = 'hunter',
  Tanner = 'tanner'
}

export enum Team {
  Villager = 'villager',
  Werewolf = 'werewolf',
  Tanner = 'tanner'
}

export interface Player {
  id: string;
  name: string;
  originalRole: Role;
  currentRole: Role;
  voteFor?: string;
}

export interface GameState {
  players: Player[];
  centerCards: Role[];
  roles: Role[];
  nightActionLog: NightAction[];
  phase: GamePhase;
  winner?: Team;
}

export enum GamePhase {
  Setup = 'setup',
  Night = 'night',
  Day = 'day',
  Voting = 'voting',
  End = 'end'
}

export interface NightAction {
  role: Role;
  performerId: string;
  actionType: NightActionType;
  targetId?: string | string[];
  targetCardIndices?: number[];
  revealedRoles?: { [key: string]: Role };
  swappedCards?: { from: string | number, to: string | number };
}

export enum NightActionType {
  View = 'view',
  Swap = 'swap',
  None = 'none'
}

export interface GameConfig {
  roleList: Role[];
  playerCount: number;
  centerCardCount: number;
} 