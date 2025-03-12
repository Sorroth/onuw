import { v4 as uuidv4 } from 'uuid';
import { Role, Team, getRoleTeam } from './role';
import { Player, PlayerEntity } from './player';
import { GameState, GameStateEntity, GameConfig } from '../valueObjects/gameState';
import { GamePhase, GamePhaseTransition } from '../valueObjects/gamePhase';
import { NightAction, NightActionEntity, NightActionType } from '../valueObjects/nightAction';
import {
  GameEvent,
  GameCreatedEvent,
  PlayerAddedEvent,
  RoleAssignedEvent,
  PhaseChangedEvent,
  NightActionPerformedEvent,
  VoteSubmittedEvent,
  GameEndedEvent
} from '../events/gameEvent';

export class Game {
  private readonly id: string;
  private state: GameStateEntity;
  private events: GameEvent[] = [];
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

  /**
   * Creates a new game instance
   */
  constructor(config: GameConfig) {
    // Validate config
    if (config.playerCount + config.centerCardCount !== config.roleList.length) {
      throw new Error('Number of roles must equal player count plus center card count');
    }

    this.id = uuidv4();
    this.state = new GameStateEntity(config);
    
    // Emit game created event
    this.applyEvent(new GameCreatedEvent(this.id, config.roleList));
  }

  /**
   * Add a player to the game
   */
  public addPlayer(name: string): string {
    if (this.state.phase !== GamePhase.Setup) {
      throw new Error('Cannot add players once the game has started');
    }

    const playerId = uuidv4();
    const player = new PlayerEntity(playerId, name, Role.Villager); // Temporary role, will be assigned properly in startGame
    
    this.state.players.push(player.toDTO());
    this.playerOrder.push(playerId);
    
    // Emit player added event
    this.applyEvent(new PlayerAddedEvent(this.id, playerId, name));
    
    return playerId;
  }

  /**
   * Start the game, assigning roles to players
   */
  public startGame(): GameState {
    if (this.state.phase !== GamePhase.Setup) {
      throw new Error('Game has already started');
    }

    if (this.state.players.length === 0) {
      throw new Error('Cannot start game with no players');
    }

    // Shuffle the roles
    const shuffledRoles = [...this.state.roles].sort(() => Math.random() - 0.5);
    
    // Assign roles to players
    this.state.players.forEach((player, index) => {
      const role = shuffledRoles[index];
      const playerEntity = new PlayerEntity(player.id, player.name, role);
      this.state.players[index] = playerEntity.toDTO();
      
      // Emit role assigned event
      this.applyEvent(new RoleAssignedEvent(this.id, player.id, role));
    });
    
    // Assign remaining roles to center cards
    this.state.centerCards = shuffledRoles.slice(this.state.players.length);
    
    // Change phase to Night
    this.changePhase(GamePhase.Night);
    
    return this.getState();
  }

  /**
   * Perform a night action for a player
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
      throw new Error('Night actions can only be performed during the night phase');
    }

    const playerIndex = this.state.players.findIndex(p => p.id === playerId);
    if (playerIndex === -1) {
      throw new Error(`Player with ID ${playerId} not found`);
    }

    const player = this.state.players[playerIndex];
    
    // Create night action
    const nightAction = new NightActionEntity(
      player.currentRole,
      playerId,
      actionType,
      {
        targetId: options.targetPlayerId || options.targetPlayerIds,
        targetCardIndices: options.centerCardIndices
      }
    );
    
    // Execute the action based on role
    this.executeNightAction(nightAction);
    
    // Add to the night action log
    this.state.nightActionLog.push(nightAction.toDTO());
    
    // Emit night action performed event
    this.applyEvent(new NightActionPerformedEvent(this.id, nightAction.toDTO()));
    
    return this.getState();
  }

  /**
   * Execute a night action based on the role and action type
   */
  private executeNightAction(nightAction: NightActionEntity): void {
    const { role, performerId, actionType } = nightAction;
    
    switch (role) {
      case Role.Werewolf:
        this.executeWerewolfAction(nightAction);
        break;
      case Role.Seer:
        this.executeSeerAction(nightAction);
        break;
      case Role.Robber:
        this.executeRobberAction(nightAction);
        break;
      case Role.Troublemaker:
        this.executeTroublemakerAction(nightAction);
        break;
      case Role.Drunk:
        this.executeDrunkAction(nightAction);
        break;
      case Role.Insomniac:
        this.executeInsomniacAction(nightAction);
        break;
      default:
        // No action for this role
        break;
    }
  }

  /**
   * Execute the Werewolf night action - view other werewolves
   */
  private executeWerewolfAction(nightAction: NightActionEntity): void {
    const otherWerewolves = this.state.players.filter(
      p => p.id !== nightAction.performerId && p.currentRole === Role.Werewolf
    );
    
    const revealedRoles = otherWerewolves.reduce((acc, player) => {
      acc[player.id] = player.currentRole;
      return acc;
    }, {} as { [key: string]: Role });
    
    // Add the performer's own role
    const performer = this.state.players.find(p => p.id === nightAction.performerId);
    if (performer) {
      revealedRoles[performer.id] = performer.currentRole;
    }
    
    nightAction.addRevealedRoles(revealedRoles);
  }

  /**
   * Execute the Seer night action - view another player's card or two center cards
   */
  private executeSeerAction(nightAction: NightActionEntity): void {
    if (nightAction.targetId && typeof nightAction.targetId === 'string') {
      // Looking at another player's card
      const target = this.state.players.find(p => p.id === nightAction.targetId);
      if (!target) {
        throw new Error(`Target player with ID ${nightAction.targetId} not found`);
      }
      
      nightAction.addRevealedRoles({ [target.id]: target.currentRole });
    } else if (nightAction.targetCardIndices && nightAction.targetCardIndices.length > 0) {
      // Looking at center cards
      const revealedRoles: { [key: string]: Role } = {};
      
      nightAction.targetCardIndices.forEach((index) => {
        if (index < 0 || index >= this.state.centerCards.length) {
          throw new Error(`Invalid center card index: ${index}`);
        }
        
        revealedRoles[`center-${index}`] = this.state.centerCards[index];
      });
      
      nightAction.addRevealedRoles(revealedRoles);
    } else {
      throw new Error('Seer must target either a player or center cards');
    }
  }

  /**
   * Execute the Robber night action - swap with another player and view the new card
   */
  private executeRobberAction(nightAction: NightActionEntity): void {
    if (!nightAction.targetId || typeof nightAction.targetId !== 'string') {
      throw new Error('Robber must target a player');
    }
    
    const performerIndex = this.state.players.findIndex(p => p.id === nightAction.performerId);
    const targetIndex = this.state.players.findIndex(p => p.id === nightAction.targetId);
    
    if (targetIndex === -1) {
      throw new Error(`Target player with ID ${nightAction.targetId} not found`);
    }
    
    // Swap roles
    const performerRole = this.state.players[performerIndex].currentRole;
    const targetRole = this.state.players[targetIndex].currentRole;
    
    this.state.players[performerIndex].currentRole = targetRole;
    this.state.players[targetIndex].currentRole = performerRole;
    
    // Record the swap
    nightAction.addSwappedCards(nightAction.performerId, nightAction.targetId);
    
    // The Robber sees the new card
    nightAction.addRevealedRoles({ [nightAction.performerId]: targetRole });
  }

  /**
   * Execute the Troublemaker night action - swap two other players' cards
   */
  private executeTroublemakerAction(nightAction: NightActionEntity): void {
    if (!nightAction.targetId || 
        !Array.isArray(nightAction.targetId) || 
        nightAction.targetId.length !== 2) {
      throw new Error('Troublemaker must target exactly two players');
    }
    
    const [targetId1, targetId2] = nightAction.targetId;
    const target1Index = this.state.players.findIndex(p => p.id === targetId1);
    const target2Index = this.state.players.findIndex(p => p.id === targetId2);
    
    if (target1Index === -1) {
      throw new Error(`Target player with ID ${targetId1} not found`);
    }
    if (target2Index === -1) {
      throw new Error(`Target player with ID ${targetId2} not found`);
    }
    
    // Swap roles
    const target1Role = this.state.players[target1Index].currentRole;
    const target2Role = this.state.players[target2Index].currentRole;
    
    this.state.players[target1Index].currentRole = target2Role;
    this.state.players[target2Index].currentRole = target1Role;
    
    // Record the swap
    nightAction.addSwappedCards(targetId1, targetId2);
  }

  /**
   * Execute the Drunk night action - swap with a center card without looking
   */
  private executeDrunkAction(nightAction: NightActionEntity): void {
    if (!nightAction.targetCardIndices || nightAction.targetCardIndices.length !== 1) {
      throw new Error('Drunk must target exactly one center card');
    }
    
    const centerIndex = nightAction.targetCardIndices[0];
    if (centerIndex < 0 || centerIndex >= this.state.centerCards.length) {
      throw new Error(`Invalid center card index: ${centerIndex}`);
    }
    
    const performerIndex = this.state.players.findIndex(p => p.id === nightAction.performerId);
    
    // Swap roles
    const performerRole = this.state.players[performerIndex].currentRole;
    const centerRole = this.state.centerCards[centerIndex];
    
    this.state.players[performerIndex].currentRole = centerRole;
    this.state.centerCards[centerIndex] = performerRole;
    
    // Record the swap
    nightAction.addSwappedCards(nightAction.performerId, `center-${centerIndex}`);
  }

  /**
   * Execute the Insomniac night action - view own card after all the swapping
   */
  private executeInsomniacAction(nightAction: NightActionEntity): void {
    const performerIndex = this.state.players.findIndex(p => p.id === nightAction.performerId);
    const currentRole = this.state.players[performerIndex].currentRole;
    
    // Record the revealed role
    nightAction.addRevealedRoles({ [nightAction.performerId]: currentRole });
  }

  /**
   * Start the day phase
   */
  public startDay(): GameState {
    if (this.state.phase !== GamePhase.Night) {
      throw new Error('Cannot start day phase unless currently in night phase');
    }
    
    this.changePhase(GamePhase.Day);
    return this.getState();
  }

  /**
   * Start the voting phase
   */
  public startVoting(): GameState {
    if (this.state.phase !== GamePhase.Day) {
      throw new Error('Cannot start voting phase unless currently in day phase');
    }
    
    this.changePhase(GamePhase.Voting);
    return this.getState();
  }

  /**
   * Submit a vote for a player
   */
  public vote(playerId: string, targetPlayerId: string): GameState {
    if (this.state.phase !== GamePhase.Voting) {
      throw new Error('Voting can only happen during the voting phase');
    }
    
    const playerIndex = this.state.players.findIndex(p => p.id === playerId);
    if (playerIndex === -1) {
      throw new Error(`Player with ID ${playerId} not found`);
    }
    
    const targetIndex = this.state.players.findIndex(p => p.id === targetPlayerId);
    if (targetIndex === -1) {
      throw new Error(`Target player with ID ${targetPlayerId} not found`);
    }
    
    // Update player's vote
    this.state.players[playerIndex].voteFor = targetPlayerId;
    
    // Emit vote submitted event
    this.applyEvent(new VoteSubmittedEvent(this.id, playerId, targetPlayerId));
    
    return this.getState();
  }

  /**
   * End the game and determine the winner
   */
  public endGame(): GameState {
    if (this.state.phase !== GamePhase.Voting) {
      throw new Error('Cannot end the game unless in voting phase');
    }
    
    // Count votes
    const voteCount: { [playerId: string]: number } = {};
    this.state.players.forEach(player => {
      if (player.voteFor) {
        voteCount[player.voteFor] = (voteCount[player.voteFor] || 0) + 1;
      }
    });
    
    // Find player(s) with the most votes
    let maxVotes = 0;
    let killedPlayers: string[] = [];
    
    Object.entries(voteCount).forEach(([playerId, votes]) => {
      if (votes > maxVotes) {
        maxVotes = votes;
        killedPlayers = [playerId];
      } else if (votes === maxVotes) {
        killedPlayers.push(playerId);
      }
    });
    
    // Determine winner based on killed players
    let winner: Team;
    
    // Check if a Tanner was killed
    const killedTanner = killedPlayers.some(id => {
      const player = this.state.players.find(p => p.id === id);
      return player && player.currentRole === Role.Tanner;
    });
    
    if (killedTanner) {
      winner = Team.Tanner;
    } else {
      // Check if a Werewolf was killed
      const killedWerewolf = killedPlayers.some(id => {
        const player = this.state.players.find(p => p.id === id);
        return player && getRoleTeam(player.currentRole) === Team.Werewolf;
      });
      
      if (killedWerewolf) {
        winner = Team.Villager;
      } else {
        winner = Team.Werewolf;
      }
    }
    
    // Update the state
    this.state.winner = winner;
    this.changePhase(GamePhase.End);
    
    // Emit game ended event
    this.applyEvent(new GameEndedEvent(this.id, winner, killedPlayers));
    
    return this.getState();
  }

  /**
   * Change the game phase
   */
  private changePhase(newPhase: GamePhase): void {
    if (!GamePhaseTransition.isValidTransition(this.state.phase, newPhase)) {
      throw new Error(`Invalid phase transition from ${this.state.phase} to ${newPhase}`);
    }
    
    this.state.phase = newPhase;
    
    // Emit phase changed event
    this.applyEvent(new PhaseChangedEvent(this.id, newPhase));
  }

  /**
   * Apply an event to the game and add it to the event log
   */
  private applyEvent(event: GameEvent): void {
    this.events.push(event);
    // Here we would also publish the event to an event bus
  }

  /**
   * Get the current state of the game
   */
  public getState(): GameState {
    return this.state.toDTO();
  }

  /**
   * Get all events that occurred in this game
   */
  public getEvents(): GameEvent[] {
    return [...this.events];
  }

  /**
   * Get the game ID
   */
  public getId(): string {
    return this.id;
  }
} 