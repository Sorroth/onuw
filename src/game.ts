import { 
  Role, 
  Team, 
  Player, 
  GameState, 
  GamePhase, 
  NightAction, 
  NightActionType,
  GameConfig
} from './types';
import { shuffle, getRoleTeam, determineWinner, cloneGameState } from './utils';
import { testLogger } from './testLogger';

export class OnuwGame {
  private state: GameState;
  private readonly playerOrder: string[] = [];
  private readonly nightActionOrder: Role[] = [
    Role.Doppelganger,
    Role.Werewolf,
    Role.Minion,
    Role.Mason,
    Role.Seer,
    Role.Robber,
    Role.Troublemaker,
    Role.Drunk,
    Role.Insomniac
  ];

  constructor(config: GameConfig) {
    // Validate config
    if (config.playerCount + config.centerCardCount !== config.roleList.length) {
      throw new Error('Number of roles must equal player count plus center card count');
    }

    // Initialize empty game state
    this.state = {
      players: [],
      centerCards: [],
      roles: [...config.roleList],
      nightActionLog: [],
      phase: GamePhase.Setup
    };
    
    testLogger.log(`Game created with roles: ${config.roleList.join(', ')}`);
  }

  /**
   * Add a player to the game
   */
  public addPlayer(name: string): string {
    if (this.state.phase !== GamePhase.Setup) {
      throw new Error('Cannot add players after game has started');
    }

    const playerId = `player-${this.state.players.length + 1}`;
    
    this.state.players.push({
      id: playerId,
      name,
      originalRole: Role.Villager, // Placeholder, will be assigned during startGame
      currentRole: Role.Villager, // Placeholder, will be assigned during startGame
    });

    this.playerOrder.push(playerId);
    
    testLogger.log(`Added player: ${name} (${playerId})`);
    
    return playerId;
  }

  /**
   * Start the game - assign roles and transition to night phase
   */
  public startGame(): GameState {
    if (this.state.phase !== GamePhase.Setup) {
      throw new Error('Game has already started');
    }

    if (this.state.players.length === 0) {
      throw new Error('Cannot start game with no players');
    }

    testLogger.log('Starting game...');

    // Shuffle roles
    const shuffledRoles = shuffle([...this.state.roles]);
    
    // Assign roles to players
    this.state.players.forEach((player, index) => {
      const role = shuffledRoles[index];
      player.originalRole = role;
      player.currentRole = role;
      testLogger.logRoleAssignment(player.id, player.name, role);
    });
    
    // Assign remaining roles to center cards
    this.state.centerCards = shuffledRoles.slice(this.state.players.length);
    
    // Log center cards
    this.state.centerCards.forEach((role, index) => {
      testLogger.log(`Center card ${index + 1}: ${role}`);
    });
    
    // Transition to night phase
    this.state.phase = GamePhase.Night;
    testLogger.logPhaseChange(GamePhase.Night);
    
    return cloneGameState(this.state);
  }

  /**
   * Special method for tests that allows directly setting the game state
   * This should only be used in tests
   */
  public setupTestState(testState: Partial<GameState>): void {
    if (testState.players) {
      this.state.players = testState.players;
      testState.players.forEach(player => {
        testLogger.logRoleAssignment(player.id, player.name, player.currentRole);
      });
    }
    if (testState.centerCards) {
      this.state.centerCards = testState.centerCards;
      testState.centerCards.forEach((role, index) => {
        testLogger.log(`Center card ${index + 1}: ${role}`);
      });
    }
    if (testState.roles) {
      this.state.roles = testState.roles;
    }
    if (testState.phase !== undefined) {
      this.state.phase = testState.phase;
      testLogger.logPhaseChange(testState.phase);
    }
    if (testState.nightActionLog) {
      this.state.nightActionLog = testState.nightActionLog;
    }
    
    testLogger.log('Test state setup complete');
  }

  /**
   * Perform a night action for a role
   */
  public performNightAction(
    playerId: string, 
    actionType: NightActionType,
    options: {
      targetPlayerId?: string;
      targetPlayerIds?: string[];
      centerCardIndices?: number[];
    } = {}
  ): GameState {
    if (this.state.phase !== GamePhase.Night) {
      throw new Error('Night actions can only be performed during night phase');
    }

    const player = this.state.players.find(p => p.id === playerId);
    if (!player) {
      throw new Error(`Player with ID ${playerId} not found`);
    }

    testLogger.log(`Performing night action: ${player.name} (${player.currentRole}) - ${actionType}`);

    const role = player.currentRole;
    const action: NightAction = {
      role,
      performerId: playerId,
      actionType,
    };

    // Handle each role's specific night action
    switch (role) {
      case Role.Werewolf:
        // Werewolves look at each other
        action.revealedRoles = {};
        this.state.players.forEach(p => {
          if (p.currentRole === Role.Werewolf) {
            action.revealedRoles![p.id] = Role.Werewolf;
          }
        });
        break;

      case Role.Minion:
        // Minion looks at werewolves
        action.revealedRoles = {};
        this.state.players.forEach(p => {
          if (p.currentRole === Role.Werewolf) {
            action.revealedRoles![p.id] = Role.Werewolf;
          }
        });
        break;

      case Role.Mason:
        // Masons look at each other
        action.revealedRoles = {};
        this.state.players.forEach(p => {
          if (p.currentRole === Role.Mason) {
            action.revealedRoles![p.id] = Role.Mason;
          }
        });
        break;

      case Role.Seer:
        if (options.targetPlayerId) {
          // Seer looks at another player's card
          const targetPlayer = this.state.players.find(p => p.id === options.targetPlayerId);
          if (!targetPlayer) {
            throw new Error(`Target player ${options.targetPlayerId} not found`);
          }
          
          testLogger.log(`${player.name} (Seer) is looking at ${targetPlayer.name}'s card`);
          
          action.targetId = options.targetPlayerId;
          action.revealedRoles = { [options.targetPlayerId]: targetPlayer.currentRole };
        } else if (options.centerCardIndices && options.centerCardIndices.length === 2) {
          // Seer looks at two center cards
          const [index1, index2] = options.centerCardIndices;
          if (index1 < 0 || index1 >= this.state.centerCards.length || 
              index2 < 0 || index2 >= this.state.centerCards.length) {
            throw new Error('Invalid center card indices');
          }
          
          testLogger.log(`${player.name} (Seer) is looking at center cards ${index1 + 1} and ${index2 + 1}`);
          
          action.targetCardIndices = options.centerCardIndices;
          action.revealedRoles = { 
            [`center-${index1}`]: this.state.centerCards[index1],
            [`center-${index2}`]: this.state.centerCards[index2]
          };
        } else {
          throw new Error('Seer must either target one player or two center cards');
        }
        break;

      case Role.Robber:
        if (!options.targetPlayerId) {
          throw new Error('Robber must target a player');
        }
        
        const targetPlayer = this.state.players.find(p => p.id === options.targetPlayerId);
        if (!targetPlayer) {
          throw new Error(`Target player ${options.targetPlayerId} not found`);
        }
        
        testLogger.log(`${player.name} (Robber) is stealing from ${targetPlayer.name}`);
        
        action.targetId = options.targetPlayerId;
        action.revealedRoles = { [options.targetPlayerId]: targetPlayer.currentRole };
        action.swappedCards = { from: playerId, to: options.targetPlayerId };
        
        // Swap roles
        const playerRole = player.currentRole;
        player.currentRole = targetPlayer.currentRole;
        targetPlayer.currentRole = playerRole;
        
        testLogger.log(`${player.name} now has role ${player.currentRole}, ${targetPlayer.name} now has role ${targetPlayer.currentRole}`);
        break;

      case Role.Troublemaker:
        if (!options.targetPlayerIds || options.targetPlayerIds.length !== 2) {
          throw new Error('Troublemaker must target two players');
        }
        
        const [target1Id, target2Id] = options.targetPlayerIds;
        
        const target1 = this.state.players.find(p => p.id === target1Id);
        const target2 = this.state.players.find(p => p.id === target2Id);
        
        if (!target1 || !target2) {
          throw new Error('One or both target players not found');
        }
        
        testLogger.log(`${player.name} (Troublemaker) is swapping ${target1.name} and ${target2.name}`);
        
        action.targetId = options.targetPlayerIds;
        action.swappedCards = { from: target1Id, to: target2Id };
        
        // Swap roles
        const target1Role = target1.currentRole;
        target1.currentRole = target2.currentRole;
        target2.currentRole = target1Role;
        
        testLogger.log(`${target1.name} now has role ${target1.currentRole}, ${target2.name} now has role ${target2.currentRole}`);
        break;

      case Role.Drunk:
        if (options.centerCardIndices === undefined || options.centerCardIndices.length !== 1) {
          throw new Error('Drunk must target one center card');
        }
        
        const centerIndex = options.centerCardIndices[0];
        if (centerIndex < 0 || centerIndex >= this.state.centerCards.length) {
          throw new Error('Invalid center card index');
        }
        
        testLogger.log(`${player.name} (Drunk) is swapping with center card ${centerIndex + 1}`);
        
        action.targetCardIndices = [centerIndex];
        action.swappedCards = { from: playerId, to: `center-${centerIndex}` };
        
        // Swap roles with center card (drunk doesn't see new role)
        const centerRole = this.state.centerCards[centerIndex];
        this.state.centerCards[centerIndex] = player.currentRole;
        player.currentRole = centerRole;
        
        testLogger.log(`${player.name} now has unknown role (actually ${player.currentRole}), center card ${centerIndex + 1} now has role ${this.state.centerCards[centerIndex]}`);
        break;

      case Role.Insomniac:
        // Insomniac sees their current role
        action.revealedRoles = { [playerId]: player.currentRole };
        testLogger.log(`${player.name} (Insomniac) sees their current role: ${player.currentRole}`);
        break;

      case Role.Doppelganger:
        if (!options.targetPlayerId) {
          throw new Error('Doppelganger must target a player');
        }
        
        const doppelTarget = this.state.players.find(p => p.id === options.targetPlayerId);
        if (!doppelTarget) {
          throw new Error(`Target player ${options.targetPlayerId} not found`);
        }
        
        testLogger.log(`${player.name} (Doppelganger) is copying ${doppelTarget.name}`);
        
        action.targetId = options.targetPlayerId;
        action.revealedRoles = { [options.targetPlayerId]: doppelTarget.currentRole };
        
        // Doppelganger assumes the role they see
        player.currentRole = doppelTarget.currentRole;
        
        testLogger.log(`${player.name} now has role ${player.currentRole}`);
        
        // If the doppelganger becomes a role with a night action, they will need to perform that role's night action
        // This is handled outside this function by checking the doppelganger's new role
        break;

      case Role.Villager:
      case Role.Hunter:
      case Role.Tanner:
        // These roles have no night actions
        action.actionType = NightActionType.None;
        testLogger.log(`${player.name} (${player.currentRole}) has no night action`);
        break;

      default:
        throw new Error(`Unknown role: ${role}`);
    }

    // Log the action
    this.state.nightActionLog.push(action);
    testLogger.logNightAction(action, player.name);
    
    return cloneGameState(this.state);
  }

  /**
   * Transition to day phase after all night actions
   */
  public startDay(): GameState {
    if (this.state.phase !== GamePhase.Night) {
      throw new Error('Can only start day phase after night phase');
    }

    this.state.phase = GamePhase.Day;
    testLogger.logPhaseChange(GamePhase.Day);
    return cloneGameState(this.state);
  }

  /**
   * Start voting phase
   */
  public startVoting(): GameState {
    if (this.state.phase !== GamePhase.Day) {
      throw new Error('Can only start voting phase after day phase');
    }

    this.state.phase = GamePhase.Voting;
    testLogger.logPhaseChange(GamePhase.Voting);
    return cloneGameState(this.state);
  }

  /**
   * Register a player's vote
   */
  public vote(playerId: string, targetPlayerId: string): GameState {
    if (this.state.phase !== GamePhase.Voting) {
      throw new Error('Voting can only be done during voting phase');
    }

    const player = this.state.players.find(p => p.id === playerId);
    if (!player) {
      throw new Error(`Player with ID ${playerId} not found`);
    }

    const targetPlayer = this.state.players.find(p => p.id === targetPlayerId);
    if (!targetPlayer) {
      throw new Error(`Target player with ID ${targetPlayerId} not found`);
    }

    player.voteFor = targetPlayerId;
    testLogger.logVote(player.id, player.name, targetPlayer.id, targetPlayer.name);

    return cloneGameState(this.state);
  }

  /**
   * End the game and determine the winner
   */
  public endGame(): GameState {
    if (this.state.phase !== GamePhase.Voting) {
      throw new Error('Can only end game after voting phase');
    }

    this.state.phase = GamePhase.End;
    testLogger.logPhaseChange(GamePhase.End);
    
    const winningTeam = determineWinner(this.state);
    this.state.winner = winningTeam || undefined;
    
    if (this.state.winner) {
      testLogger.logWinner(this.state.winner);
      
      // Log vote count summary
      const voteCounts: Record<string, number> = {};
      this.state.players.forEach(player => {
        if (player.voteFor) {
          voteCounts[player.voteFor] = (voteCounts[player.voteFor] || 0) + 1;
        }
      });
      
      testLogger.log('Vote count summary:');
      Object.entries(voteCounts).forEach(([playerId, count]) => {
        const player = this.state.players.find(p => p.id === playerId);
        if (player) {
          testLogger.log(`${player.name} (${player.currentRole}): ${count} votes`);
        }
      });
    }

    return cloneGameState(this.state);
  }

  /**
   * Get the current game state
   */
  public getState(): GameState {
    return cloneGameState(this.state);
  }

  /**
   * Get a player's view of the game (only shows information they should know)
   */
  public getPlayerView(playerId: string): Partial<GameState> {
    const player = this.state.players.find(p => p.id === playerId);
    if (!player) {
      throw new Error(`Player with ID ${playerId} not found`);
    }

    const playerView: Partial<GameState> = {
      phase: this.state.phase,
      winner: this.state.winner,
    };

    // Player always knows their original role
    const playerData = {
      id: player.id,
      name: player.name,
      originalRole: player.originalRole,
      currentRole: player.currentRole
    };

    // Filter night actions for what this player saw
    const playerNightActions = this.state.nightActionLog.filter(action => {
      // Include actions performed by this player
      if (action.performerId === playerId) return true;
      
      // Include actions where this player was revealed (like by a Seer)
      if (action.revealedRoles && action.revealedRoles[playerId]) return true;
      
      return false;
    });

    return { 
      ...playerView, 
      players: [playerData],
      nightActionLog: playerNightActions
    };
  }
} 