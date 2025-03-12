import { OnuwGame } from './game';
import { Role, Team, GamePhase, NightActionType } from './types';
import { testLogger } from './testLogger';

describe('OnuwGame Detailed Log', () => {
  beforeEach(() => {
    // Clear the logger before each test
    testLogger.clear();
  });

  test('full game cycle produces a complete action log', () => {
    console.log('\n====== BEGINNING TEST: FULL GAME CYCLE ======\n');
    
    // Enable console output for this specific test
    testLogger.setEnabled(true);
    
    // Create a game with a specific role setup
    const game = new OnuwGame({
      roleList: [
        Role.Werewolf, Role.Werewolf, 
        Role.Seer, Role.Robber, Role.Troublemaker, 
        Role.Drunk, Role.Insomniac, 
        Role.Villager, Role.Villager, Role.Tanner
      ],
      playerCount: 7,
      centerCardCount: 3
    });

    // Add players
    const p1 = game.addPlayer('Alice');  // Will become Werewolf
    const p2 = game.addPlayer('Bob');    // Will become Werewolf
    const p3 = game.addPlayer('Charlie'); // Will become Seer
    const p4 = game.addPlayer('Dave');   // Will become Robber
    const p5 = game.addPlayer('Eve');    // Will become Troublemaker
    const p6 = game.addPlayer('Frank');  // Will become Drunk
    const p7 = game.addPlayer('Grace');  // Will become Insomniac

    // Set up the game state to ensure specific roles
    game.setupTestState({
      players: [
        { id: p1, name: 'Alice', originalRole: Role.Werewolf, currentRole: Role.Werewolf },
        { id: p2, name: 'Bob', originalRole: Role.Werewolf, currentRole: Role.Werewolf },
        { id: p3, name: 'Charlie', originalRole: Role.Seer, currentRole: Role.Seer },
        { id: p4, name: 'Dave', originalRole: Role.Robber, currentRole: Role.Robber },
        { id: p5, name: 'Eve', originalRole: Role.Troublemaker, currentRole: Role.Troublemaker },
        { id: p6, name: 'Frank', originalRole: Role.Drunk, currentRole: Role.Drunk },
        { id: p7, name: 'Grace', originalRole: Role.Insomniac, currentRole: Role.Insomniac },
      ],
      centerCards: [Role.Villager, Role.Villager, Role.Tanner],
      phase: GamePhase.Night
    });

    console.log('\n====== NIGHT PHASE ======\n');

    // Night Phase - Werewolves look at each other
    console.log('\n== Werewolves Awakening ==');
    game.performNightAction(p1, NightActionType.View);
    // Second werewolf turn is redundant but included for completeness
    game.performNightAction(p2, NightActionType.View);

    // Seer looks at a player's card
    console.log('\n== Seer Awakening ==');
    game.performNightAction(p3, NightActionType.View, { targetPlayerId: p1 });

    // Robber steals from a player
    console.log('\n== Robber Awakening ==');
    game.performNightAction(p4, NightActionType.Swap, { targetPlayerId: p7 });

    // Troublemaker swaps two players
    console.log('\n== Troublemaker Awakening ==');
    game.performNightAction(p5, NightActionType.Swap, { targetPlayerIds: [p1, p2] });

    // Drunk swaps with a center card
    console.log('\n== Drunk Awakening ==');
    game.performNightAction(p6, NightActionType.Swap, { centerCardIndices: [2] });

    // Insomniac checks their role (which is now Robber after the swap)
    console.log('\n== Insomniac Awakening ==');
    // Grace now has the Robber role, so we need to provide a targetPlayerId for the Robber action
    game.performNightAction(p7, NightActionType.View, { targetPlayerId: p5 });  // Target Eve

    // Day phase - transition to discussion
    console.log('\n====== DAY PHASE ======\n');
    game.startDay();

    // Get the state after all actions
    const stateAfterNight = game.getState();
    
    // Log the final roles
    console.log('\n== Current Roles After Night Phase ==');
    stateAfterNight.players.forEach(player => {
      console.log(`${player.name}: Original=${player.originalRole}, Current=${player.currentRole}`);
    });
    stateAfterNight.centerCards.forEach((role, index) => {
      console.log(`Center Card ${index + 1}: ${role}`);
    });

    // Voting phase
    console.log('\n====== VOTING PHASE ======\n');
    game.startVoting();

    // Players vote
    game.vote(p1, p2); // Alice votes for Bob
    game.vote(p2, p1); // Bob votes for Alice
    game.vote(p3, p2); // Charlie votes for Bob
    game.vote(p4, p2); // Dave votes for Bob
    game.vote(p5, p2); // Eve votes for Bob
    game.vote(p6, p1); // Frank votes for Alice
    game.vote(p7, p2); // Grace votes for Bob

    // Game end and determine winner
    console.log('\n====== GAME END ======\n');
    const gameState = game.endGame();

    // Log the winners and losers
    console.log(`\nWinning Team: ${gameState.winner}`);

    // Print the full test log
    console.log('\n====== COMPLETE GAME LOG ======\n');
    console.log(testLogger.getLogsAsString());

    // Make some assertions to verify the game worked correctly
    const finalAlice = stateAfterNight.players.find(p => p.id === p1)!;
    const finalBob = stateAfterNight.players.find(p => p.id === p2)!;
    
    // Verify original roles
    expect(finalAlice.originalRole).toBe(Role.Werewolf);
    expect(finalBob.originalRole).toBe(Role.Werewolf);
    
    // Drunk should have swapped with center Tanner
    const finalFrank = stateAfterNight.players.find(p => p.id === p6)!;
    expect(finalFrank.originalRole).toBe(Role.Drunk);
    expect(finalFrank.currentRole).toBe(Role.Tanner);
    expect(stateAfterNight.centerCards[2]).toBe(Role.Drunk);
    
    // Robber (Dave) should have stolen Insomniac (Grace)'s role
    const finalDave = stateAfterNight.players.find(p => p.id === p4)!;
    const finalGrace = stateAfterNight.players.find(p => p.id === p7)!;
    const finalEve = stateAfterNight.players.find(p => p.id === p5)!;
    expect(finalDave.originalRole).toBe(Role.Robber);
    expect(finalDave.currentRole).toBe(Role.Insomniac);
    expect(finalGrace.originalRole).toBe(Role.Insomniac);
    expect(finalGrace.currentRole).toBe(Role.Troublemaker);
    expect(finalEve.originalRole).toBe(Role.Troublemaker);
    expect(finalEve.currentRole).toBe(Role.Robber);
    
    // With 5 votes for Bob, the villagers should win
    expect(gameState.winner).toBe(Team.Villager);
  });

  // Add more specific test cases here if needed
}); 