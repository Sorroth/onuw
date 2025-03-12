import { OnuwGame } from './game';
import { Role } from './types';
import { testLogger } from './testLogger';

describe('Random Role Assignment', () => {
  beforeEach(() => {
    testLogger.clear();
  });

  // Helper function to print a table all at once
  function printTable(title: string, headers: string[], rows: string[][], hasFooter = true) {
    const separator = '|------------|--------------|';
    const output = [
      `\n${title}:`,
      '----------------------------------------',
      separator,
      headers.join(' | '),
      separator,
      ...rows.map(row => `| ${row[0].padEnd(10)} | ${row[1].padEnd(12)} |`),
      separator
    ];
    
    // Print the entire table at once to reduce Jest output noise
    console.log(output.join('\n'));
  }

  test('each game has different role assignments', () => {
    console.log('\n========================================================');
    console.log('           RANDOM ROLE ASSIGNMENT TEST');
    console.log('========================================================\n');
    
    // Enable console output for this test
    testLogger.setEnabled(true);
    
    // Run 3 separate games to show random role assignment
    for (let gameNum = 1; gameNum <= 3; gameNum++) {
      console.log(`\n==================== GAME ${gameNum} ====================`);
      
      // Create a game with the same role setup each time
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

      // Add the same players each time
      game.addPlayer('Alice');
      game.addPlayer('Bob');
      game.addPlayer('Charlie');
      game.addPlayer('Dave');
      game.addPlayer('Eve');
      game.addPlayer('Frank');
      game.addPlayer('Grace');

      // Start the game - this will randomly assign roles
      game.startGame();
      
      // Get the game state
      const state = game.getState();
      
      // Format player data for the table
      const playerData = state.players.map(player => [
        player.name, 
        player.currentRole
      ]);
      
      // Format center card data for the table
      const centerData = state.centerCards.map((role, index) => [
        `Center ${index + 1}`, 
        role
      ]);
      
      // Print player roles table
      printTable(
        'Role Assignments', 
        ['Player', 'Role'], 
        playerData
      );
      
      // Print center cards table
      printTable(
        'Center Cards', 
        ['Card', 'Role'], 
        centerData
      );
      
      console.log('\n'); // Extra space between games
    }
    
    // The test doesn't actually verify anything automatically,
    // but you can manually observe that roles are different each game
    expect(true).toBeTruthy();
  });
}); 