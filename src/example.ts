import { OnuwGame } from './game';
import { Role, NightActionType, Team, GamePhase } from './types';

/**
 * This example demonstrates a simple game scenario with 5 players
 */
function runExampleGame() {
  console.log('--- One Night Ultimate Werewolf Example Game ---');
  
  // 1. Create a game with a specific role list
  const game = new OnuwGame({
    roleList: [
      Role.Werewolf, // Player 1
      Role.Villager, // Player 2
      Role.Seer,     // Player 3
      Role.Robber,   // Player 4
      Role.Villager, // Player 5
      Role.Tanner,   // Center 1
      Role.Hunter    // Center 2
    ],
    playerCount: 5,
    centerCardCount: 2
  });

  // 2. Add players
  const players = [
    { id: game.addPlayer('Alice'), name: 'Alice' },
    { id: game.addPlayer('Bob'), name: 'Bob' },
    { id: game.addPlayer('Charlie'), name: 'Charlie' },
    { id: game.addPlayer('Dave'), name: 'Dave' },
    { id: game.addPlayer('Eve'), name: 'Eve' }
  ];

  // For this example, we'll manually assign roles to make the example deterministic
  // Set up the test state
  game.setupTestState({
    players: [
      { id: players[0].id, name: 'Alice', originalRole: Role.Werewolf, currentRole: Role.Werewolf },
      { id: players[1].id, name: 'Bob', originalRole: Role.Villager, currentRole: Role.Villager },
      { id: players[2].id, name: 'Charlie', originalRole: Role.Seer, currentRole: Role.Seer },
      { id: players[3].id, name: 'Dave', originalRole: Role.Robber, currentRole: Role.Robber },
      { id: players[4].id, name: 'Eve', originalRole: Role.Villager, currentRole: Role.Villager },
    ],
    centerCards: [Role.Tanner, Role.Hunter],
    phase: GamePhase.Night  // Set the phase to Night
  });
  
  // 3. Get the state
  const state = game.getState();
  
  // Print starting roles
  console.log('\n--- Starting Game ---');
  console.log('\nStarting roles:');
  players.forEach((player, index) => {
    console.log(`${player.name}: ${state.players[index].originalRole}`);
  });
  console.log(`Center cards: ${state.centerCards.join(', ')}`);

  // 4. Night Phase - each player performs their night action
  console.log('\n--- Night Phase ---');
  
  // Werewolf looks for other werewolves (there are none in this example)
  console.log('\nAlice (Werewolf) looks for other werewolves');
  game.performNightAction(players[0].id, NightActionType.View);
  
  // Seer looks at a card
  console.log('\nCharlie (Seer) looks at Bob\'s card');
  game.performNightAction(players[2].id, NightActionType.View, { targetPlayerId: players[1].id });
  
  // Robber steals from Werewolf (interesting!)
  console.log('\nDave (Robber) steals from Alice (Werewolf)');
  game.performNightAction(players[3].id, NightActionType.Swap, { targetPlayerId: players[0].id });
  
  // 5. Day Phase - discussion would happen here
  console.log('\n--- Day Phase ---');
  game.startDay();
  
  const updatedState = game.getState();
  
  // Print current roles after night actions
  console.log('\nRoles after night phase:');
  players.forEach((player, index) => {
    console.log(`${player.name}: original=${updatedState.players[index].originalRole}, current=${updatedState.players[index].currentRole}`);
  });

  // 6. Voting Phase
  console.log('\n--- Voting Phase ---');
  game.startVoting();
  
  // Everyone votes 
  game.vote(players[0].id, players[3].id); // Ex-werewolf votes for Robber (now Werewolf)
  game.vote(players[1].id, players[3].id); // Villager votes for Robber (now Werewolf) 
  game.vote(players[2].id, players[3].id); // Seer votes for Robber (now Werewolf)
  game.vote(players[3].id, players[0].id); // Robber (now Werewolf) votes for Ex-werewolf
  game.vote(players[4].id, players[3].id); // Villager votes for Robber (now Werewolf)
  
  console.log('Votes:');
  const finalState = game.getState();
  players.forEach(player => {
    const votedFor = finalState.players.find(p => p.id === finalState.players.find(p2 => p2.id === player.id)?.voteFor)?.name || 'No one';
    console.log(`${player.name} voted for ${votedFor}`);
  });

  // 7. End Game and determine winner
  console.log('\n--- Game End ---');
  const endGameState = game.endGame();
  
  console.log(`\nWinner: ${endGameState.winner}`);
  if (endGameState.winner === Team.Villager) {
    console.log('The Villagers won by identifying and killing the Werewolf!');
  } else if (endGameState.winner === Team.Werewolf) {
    console.log('The Werewolf survived the vote and won!');
  } else if (endGameState.winner === Team.Tanner) {
    console.log('The Tanner won by getting killed!');
  }
}

// Run the example
runExampleGame(); 