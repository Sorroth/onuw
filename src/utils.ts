import { Role, Team, Player, GameState } from './types';

/**
 * Shuffles an array in place
 */
export function shuffle<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
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

/**
 * Determines the winning team based on voting results
 */
export function determineWinner(state: GameState): Team | null {
  const voteCounts: Record<string, number> = {};
  
  // Count votes
  state.players.forEach(player => {
    if (player.voteFor) {
      voteCounts[player.voteFor] = (voteCounts[player.voteFor] || 0) + 1;
    }
  });
  
  // Find players with the most votes
  let maxVotes = 0;
  let playersWithMostVotes: Player[] = [];
  
  state.players.forEach(player => {
    const voteCount = voteCounts[player.id] || 0;
    
    if (voteCount > maxVotes) {
      maxVotes = voteCount;
      playersWithMostVotes = [player];
    } else if (voteCount === maxVotes && voteCount > 0) {
      playersWithMostVotes.push(player);
    }
  });
  
  // Check if Tanner was killed
  const tannerKilled = playersWithMostVotes.some(p => p.currentRole === Role.Tanner);
  if (tannerKilled) {
    return Team.Tanner;
  }
  
  // Check if Werewolf was killed
  let werewolfKilled = playersWithMostVotes.some(p => p.currentRole === Role.Werewolf);
  
  // Check for Hunter effect (if Hunter is killed, check who they voted for)
  playersWithMostVotes.forEach(player => {
    if (player.currentRole === Role.Hunter && player.voteFor) {
      const hunterTarget = state.players.find(p => p.id === player.voteFor);
      if (hunterTarget && hunterTarget.currentRole === Role.Werewolf) {
        werewolfKilled = true;
      }
    }
  });
  
  // Determine winner based on werewolf status
  if (werewolfKilled) {
    return Team.Villager;
  } else {
    // Check if there are werewolves in the game
    const hasWerewolves = state.players.some(p => p.currentRole === Role.Werewolf);
    return hasWerewolves ? Team.Werewolf : Team.Villager;
  }
}

/**
 * Deep clone a game state object to avoid mutations
 */
export function cloneGameState(state: GameState): GameState {
  return JSON.parse(JSON.stringify(state));
} 