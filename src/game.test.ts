import { OnuwGame } from './game';
import { Role, Team, GamePhase, NightActionType } from './types';

describe('OnuwGame', () => {
  describe('Game Setup', () => {
    test('should initialize game with correct roles', () => {
      const roleList = [
        Role.Werewolf, Role.Werewolf, 
        Role.Seer, Role.Robber, Role.Troublemaker, 
        Role.Villager, Role.Villager, Role.Tanner
      ];
      
      const game = new OnuwGame({
        roleList,
        playerCount: 5,
        centerCardCount: 3
      });

      expect(game.getState().roles).toEqual(roleList);
      expect(game.getState().phase).toBe(GamePhase.Setup);
    });

    test('should add players to the game', () => {
      const game = new OnuwGame({
        roleList: [Role.Werewolf, Role.Seer, Role.Villager],
        playerCount: 2,
        centerCardCount: 1
      });

      const playerId1 = game.addPlayer('Player 1');
      const playerId2 = game.addPlayer('Player 2');

      const state = game.getState();
      expect(state.players.length).toBe(2);
      expect(state.players[0].name).toBe('Player 1');
      expect(state.players[1].name).toBe('Player 2');
      expect(state.players[0].id).toBe(playerId1);
      expect(state.players[1].id).toBe(playerId2);
    });

    test('should throw error when roles don\'t match player + center count', () => {
      expect(() => {
        new OnuwGame({
          roleList: [Role.Werewolf, Role.Seer],
          playerCount: 3,
          centerCardCount: 0
        });
      }).toThrow('Number of roles must equal player count plus center card count');
    });

    test('should assign roles to players and center cards', () => {
      const roleList = [
        Role.Werewolf, Role.Seer, Role.Robber, 
        Role.Troublemaker, Role.Villager
      ];
      
      const game = new OnuwGame({
        roleList,
        playerCount: 3,
        centerCardCount: 2
      });

      game.addPlayer('Player 1');
      game.addPlayer('Player 2');
      game.addPlayer('Player 3');

      const beforeState = game.getState();
      expect(beforeState.centerCards.length).toBe(0);

      const afterState = game.startGame();
      expect(afterState.phase).toBe(GamePhase.Night);
      expect(afterState.players.length).toBe(3);
      expect(afterState.centerCards.length).toBe(2);
      
      // Verify all roles were assigned (specific roles are random due to shuffle)
      const assignedRoles = [
        ...afterState.players.map(p => p.currentRole),
        ...afterState.centerCards
      ];
      
      // Sort both arrays to compare them regardless of order
      expect(assignedRoles.sort()).toEqual(roleList.sort());
    });
  });

  describe('Night Actions', () => {
    test('Werewolf should see other werewolves', () => {
      const game = new OnuwGame({
        roleList: [Role.Werewolf, Role.Werewolf, Role.Seer, Role.Villager, Role.Villager],
        playerCount: 5,
        centerCardCount: 0
      });

      const p1 = game.addPlayer('Werewolf 1');
      const p2 = game.addPlayer('Werewolf 2');
      const p3 = game.addPlayer('Seer');
      const p4 = game.addPlayer('Villager 1');
      const p5 = game.addPlayer('Villager 2');

      // Setup test state directly using the new method
      game.setupTestState({
        players: [
          { id: p1, name: 'Werewolf 1', originalRole: Role.Werewolf, currentRole: Role.Werewolf },
          { id: p2, name: 'Werewolf 2', originalRole: Role.Werewolf, currentRole: Role.Werewolf },
          { id: p3, name: 'Seer', originalRole: Role.Seer, currentRole: Role.Seer },
          { id: p4, name: 'Villager 1', originalRole: Role.Villager, currentRole: Role.Villager },
          { id: p5, name: 'Villager 2', originalRole: Role.Villager, currentRole: Role.Villager },
        ],
        phase: GamePhase.Night
      });

      // Werewolf 1 performs their night action
      const afterState = game.performNightAction(p1, NightActionType.View);
      
      // Check that werewolf 1 sees werewolf 2
      const action = afterState.nightActionLog[0];
      expect(action.role).toBe(Role.Werewolf);
      expect(action.performerId).toBe(p1);
      expect(action.revealedRoles![p1]).toBe(Role.Werewolf);
      expect(action.revealedRoles![p2]).toBe(Role.Werewolf);
      expect(action.revealedRoles![p3]).toBeUndefined();
    });

    test('Seer should be able to view another player\'s card', () => {
      const game = new OnuwGame({
        roleList: [Role.Seer, Role.Werewolf, Role.Villager, Role.Villager],
        playerCount: 3,
        centerCardCount: 1
      });

      const p1 = game.addPlayer('Seer');
      const p2 = game.addPlayer('Werewolf');
      const p3 = game.addPlayer('Villager');

      // Setup test state
      game.setupTestState({
        players: [
          { id: p1, name: 'Seer', originalRole: Role.Seer, currentRole: Role.Seer },
          { id: p2, name: 'Werewolf', originalRole: Role.Werewolf, currentRole: Role.Werewolf },
          { id: p3, name: 'Villager', originalRole: Role.Villager, currentRole: Role.Villager },
        ],
        centerCards: [Role.Villager],
        phase: GamePhase.Night
      });

      // Seer looks at werewolf's card
      const afterState = game.performNightAction(p1, NightActionType.View, { targetPlayerId: p2 });
      
      // Check that seer sees werewolf's role
      const action = afterState.nightActionLog[0];
      expect(action.role).toBe(Role.Seer);
      expect(action.performerId).toBe(p1);
      expect(action.targetId).toBe(p2);
      expect(action.revealedRoles![p2]).toBe(Role.Werewolf);
    });

    test('Robber should swap roles with another player', () => {
      const game = new OnuwGame({
        roleList: [Role.Robber, Role.Werewolf, Role.Villager, Role.Villager],
        playerCount: 3,
        centerCardCount: 1
      });

      const p1 = game.addPlayer('Robber');
      const p2 = game.addPlayer('Werewolf');
      const p3 = game.addPlayer('Villager');

      // Setup test state
      game.setupTestState({
        players: [
          { id: p1, name: 'Robber', originalRole: Role.Robber, currentRole: Role.Robber },
          { id: p2, name: 'Werewolf', originalRole: Role.Werewolf, currentRole: Role.Werewolf },
          { id: p3, name: 'Villager', originalRole: Role.Villager, currentRole: Role.Villager },
        ],
        centerCards: [Role.Villager],
        phase: GamePhase.Night
      });

      // Robber swaps with werewolf
      const afterState = game.performNightAction(p1, NightActionType.Swap, { targetPlayerId: p2 });
      
      // Check role swap occurred
      expect(afterState.players[0].originalRole).toBe(Role.Robber);
      expect(afterState.players[0].currentRole).toBe(Role.Werewolf);
      expect(afterState.players[1].originalRole).toBe(Role.Werewolf);
      expect(afterState.players[1].currentRole).toBe(Role.Robber);
      
      // Check that action was logged correctly
      const action = afterState.nightActionLog[0];
      expect(action.role).toBe(Role.Robber);
      expect(action.performerId).toBe(p1);
      expect(action.targetId).toBe(p2);
      expect(action.swappedCards).toEqual({ from: p1, to: p2 });
      expect(action.revealedRoles![p2]).toBe(Role.Werewolf); // Robber sees the card they took
    });

    test('Troublemaker should swap two other players', () => {
      const game = new OnuwGame({
        roleList: [Role.Troublemaker, Role.Werewolf, Role.Villager, Role.Villager],
        playerCount: 3,
        centerCardCount: 1
      });

      const p1 = game.addPlayer('Troublemaker');
      const p2 = game.addPlayer('Werewolf');
      const p3 = game.addPlayer('Villager');

      // Setup test state
      game.setupTestState({
        players: [
          { id: p1, name: 'Troublemaker', originalRole: Role.Troublemaker, currentRole: Role.Troublemaker },
          { id: p2, name: 'Werewolf', originalRole: Role.Werewolf, currentRole: Role.Werewolf },
          { id: p3, name: 'Villager', originalRole: Role.Villager, currentRole: Role.Villager },
        ],
        centerCards: [Role.Villager],
        phase: GamePhase.Night
      });

      // Troublemaker swaps werewolf and villager
      const afterState = game.performNightAction(p1, NightActionType.Swap, { 
        targetPlayerIds: [p2, p3] 
      });
      
      // Check role swap occurred
      expect(afterState.players[1].originalRole).toBe(Role.Werewolf);
      expect(afterState.players[1].currentRole).toBe(Role.Villager);
      expect(afterState.players[2].originalRole).toBe(Role.Villager);
      expect(afterState.players[2].currentRole).toBe(Role.Werewolf);
      
      // Check that action was logged
      const action = afterState.nightActionLog[0];
      expect(action.role).toBe(Role.Troublemaker);
      expect(action.performerId).toBe(p1);
      expect(action.targetId).toEqual([p2, p3]);
      expect(action.swappedCards).toEqual({ from: p2, to: p3 });
      expect(action.revealedRoles).toBeUndefined(); // Troublemaker doesn't see the cards
    });

    test('Drunk should swap with a center card without seeing it', () => {
      const game = new OnuwGame({
        roleList: [Role.Drunk, Role.Werewolf, Role.Villager, Role.Tanner],
        playerCount: 3,
        centerCardCount: 1
      });

      const p1 = game.addPlayer('Drunk');
      const p2 = game.addPlayer('Werewolf');
      const p3 = game.addPlayer('Villager');

      // Setup test state
      game.setupTestState({
        players: [
          { id: p1, name: 'Drunk', originalRole: Role.Drunk, currentRole: Role.Drunk },
          { id: p2, name: 'Werewolf', originalRole: Role.Werewolf, currentRole: Role.Werewolf },
          { id: p3, name: 'Villager', originalRole: Role.Villager, currentRole: Role.Villager },
        ],
        centerCards: [Role.Tanner],
        phase: GamePhase.Night
      });

      // Drunk swaps with center card
      const afterState = game.performNightAction(p1, NightActionType.Swap, { 
        centerCardIndices: [0] 
      });
      
      // Check role swap occurred
      expect(afterState.players[0].originalRole).toBe(Role.Drunk);
      expect(afterState.players[0].currentRole).toBe(Role.Tanner);
      expect(afterState.centerCards[0]).toBe(Role.Drunk);
      
      // Check that action was logged
      const action = afterState.nightActionLog[0];
      expect(action.role).toBe(Role.Drunk);
      expect(action.performerId).toBe(p1);
      expect(action.targetCardIndices).toEqual([0]);
      expect(action.swappedCards).toEqual({ from: p1, to: 'center-0' });
      expect(action.revealedRoles).toBeUndefined(); // Drunk doesn't see the new card
    });
  });

  describe('Game Flow', () => {
    test('complete game flow with voting and determining winner', () => {
      const game = new OnuwGame({
        roleList: [Role.Werewolf, Role.Seer, Role.Villager],
        playerCount: 3,
        centerCardCount: 0
      });

      const p1 = game.addPlayer('Werewolf');
      const p2 = game.addPlayer('Seer');
      const p3 = game.addPlayer('Villager');

      // Setup test state
      game.setupTestState({
        players: [
          { id: p1, name: 'Werewolf', originalRole: Role.Werewolf, currentRole: Role.Werewolf },
          { id: p2, name: 'Seer', originalRole: Role.Seer, currentRole: Role.Seer },
          { id: p3, name: 'Villager', originalRole: Role.Villager, currentRole: Role.Villager },
        ],
        phase: GamePhase.Night
      });

      // Perform night actions
      game.performNightAction(p1, NightActionType.View); // Werewolf looks
      game.performNightAction(p2, NightActionType.View, { targetPlayerId: p1 }); // Seer checks Werewolf

      // Start day phase
      let gameState = game.startDay();
      expect(gameState.phase).toBe(GamePhase.Day);

      // Start voting phase
      gameState = game.startVoting();
      expect(gameState.phase).toBe(GamePhase.Voting);

      // Everyone votes for the werewolf
      game.vote(p2, p1);
      game.vote(p3, p1);
      game.vote(p1, p3); // Werewolf votes for villager

      // End game and determine winner
      gameState = game.endGame();
      expect(gameState.phase).toBe(GamePhase.End);
      expect(gameState.winner).toBe(Team.Villager); // Villagers win by killing werewolf
    });
  });

  describe('Player Views', () => {
    test('player view should only contain information visible to that player', () => {
      const game = new OnuwGame({
        roleList: [Role.Werewolf, Role.Seer, Role.Villager],
        playerCount: 3,
        centerCardCount: 0
      });

      const p1 = game.addPlayer('Werewolf');
      const p2 = game.addPlayer('Seer');
      const p3 = game.addPlayer('Villager');

      // Setup test state
      game.setupTestState({
        players: [
          { id: p1, name: 'Werewolf', originalRole: Role.Werewolf, currentRole: Role.Werewolf },
          { id: p2, name: 'Seer', originalRole: Role.Seer, currentRole: Role.Seer },
          { id: p3, name: 'Villager', originalRole: Role.Villager, currentRole: Role.Villager },
        ],
        phase: GamePhase.Night,
        nightActionLog: [] // Start with a clean night action log
      });

      // Perform night actions
      game.performNightAction(p1, NightActionType.View); // Werewolf looks
      game.performNightAction(p2, NightActionType.View, { targetPlayerId: p1 }); // Seer checks Werewolf

      // Get player views
      const werewolfView = game.getPlayerView(p1);
      const seerView = game.getPlayerView(p2);
      const villagerView = game.getPlayerView(p3);

      // Werewolf should only see their own info
      expect(werewolfView.players!.length).toBe(1);
      expect(werewolfView.players![0].id).toBe(p1);
      expect(werewolfView.players![0].originalRole).toBe(Role.Werewolf);
      
      // Werewolf should see their own night action and the Seer's action that revealed them
      expect(werewolfView.nightActionLog!.length).toBe(2);
      expect(werewolfView.nightActionLog![0].performerId).toBe(p1);
      expect(werewolfView.nightActionLog![1].performerId).toBe(p2);

      // Seer should only see their own info and their night action
      expect(seerView.players!.length).toBe(1);
      expect(seerView.players![0].id).toBe(p2);
      expect(seerView.players![0].originalRole).toBe(Role.Seer);
      expect(seerView.nightActionLog!.length).toBe(1);
      expect(seerView.nightActionLog![0].performerId).toBe(p2);
      
      // Villager shouldn't see any night actions
      expect(villagerView.players!.length).toBe(1);
      expect(villagerView.players![0].id).toBe(p3);
      expect(villagerView.players![0].originalRole).toBe(Role.Villager);
      expect(villagerView.nightActionLog!.length).toBe(0);
    });
  });
}); 