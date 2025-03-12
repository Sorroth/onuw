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

/**
 * Determines which team a role belongs to
 */
export function getRoleTeam(role: Role): Team {
  switch (role) {
    case Role.Werewolf:
      return Team.Werewolf;
    case Role.Minion:
      return Team.Werewolf; // Minion is on the werewolf team
    case Role.Tanner:
      return Team.Tanner;
    default:
      return Team.Villager;
  }
} 