package game

import (
	"errors"
	"fmt"
	"log"
	"math/rand/v2"
	"onuw/pkg/logger"
	"strconv"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/gorilla/websocket"
)

type GameManager struct {
	games       map[string]*Game
	mu          sync.RWMutex
	connections map[string]map[string]*websocket.Conn // gameID -> playerID -> connection
	creators    map[string]string                     // playerName -> gameId
}

func NewGameManager() *GameManager {
	return &GameManager{
		games:       make(map[string]*Game),
		connections: make(map[string]map[string]*websocket.Conn),
		creators:    make(map[string]string),
	}
}

func generateID() string {
	return uuid.New().String()
}

func (gm *GameManager) CreateGame(creatorName string) (*Game, error) {
	gm.mu.Lock()
	defer gm.mu.Unlock()

	log := logger.GetLogger()

	// Check if player already created a game
	if existingGameId, exists := gm.creators[creatorName]; exists {
		if game, ok := gm.games[existingGameId]; ok && game.State == StateWaiting {
			return nil, fmt.Errorf("player already created game %s", existingGameId)
		}
	}

	gameID := generateID()
	log.Info("Creating new game with ID: %s", gameID)

	game := &Game{
		ID:          gameID,
		Players:     make(map[string]Player),
		State:       StateWaiting,
		CenterCards: make([]RoleType, 3), // Three center cards
		NightOrder: []RoleType{
			RoleDoppelganger,
			RoleWerewolf,
			RoleMinion,
			RoleMason,
			RoleSeer,
			RoleRobber,
			RoleTroublemaker,
			RoleDrunk,
			RoleInsomniac,
		},
		Votes: make(map[string]string),
		Round: 0,
	}

	gm.games[game.ID] = game
	gm.creators[creatorName] = gameID

	return game, nil
}

func (gm *GameManager) JoinGame(gameID string, playerName string) (*Player, error) {
	log := logger.GetLogger()
	gm.mu.Lock()
	defer gm.mu.Unlock()

	game, exists := gm.games[gameID]
	if !exists {
		log.Warn("Attempt to join non-existent game: %s", gameID)
		return nil, errors.New("game not found")
	}

	if len(game.Players) >= 10 {
		log.Warn("Attempt to join full game: %s", gameID)
		return nil, errors.New("game is full")
	}

	playerID := generateID()
	log.Info("Player %s (ID: %s) joining game %s", playerName, playerID, gameID)

	player := Player{
		ID:   playerID,
		Name: playerName,
	}

	game.Players[player.ID] = player
	return &player, nil
}

func (gm *GameManager) GetGame(gameID string) (*Game, bool) {
	gm.mu.RLock()
	defer gm.mu.RUnlock()
	game, exists := gm.games[gameID]
	return game, exists
}

func (gm *GameManager) SetPlayerReady(gameID string, playerID string, ready bool) error {
	gm.mu.Lock()
	defer gm.mu.Unlock()

	game, exists := gm.games[gameID]
	if !exists {
		return errors.New("game not found")
	}

	player, exists := game.Players[playerID]
	if !exists {
		return errors.New("player not found")
	}

	player.Ready = ready
	game.Players[playerID] = player

	// Check if all players are ready and we have enough players to start
	if game.State == StateWaiting {
		allReady := true
		playerCount := len(game.Players)

		if playerCount < 3 {
			return nil // Need at least 3 players
		}

		for _, p := range game.Players {
			if !p.Ready {
				allReady = false
				break
			}
		}

		if allReady {
			if err := gm.startGame(game); err != nil {
				return err
			}
			gm.BroadcastGameState(gameID)
		}
	}

	return nil
}

func (gm *GameManager) startGame(game *Game) error {
	if len(game.Players) < 3 || len(game.Players) > 10 {
		return errors.New("invalid number of players")
	}

	// Assign roles
	availableRoles := gm.generateRoleList(len(game.Players))

	// Shuffle roles
	rand.Shuffle(len(availableRoles), func(i, j int) {
		availableRoles[i], availableRoles[j] = availableRoles[j], availableRoles[i]
	})

	// Assign roles to players
	i := 0
	for playerID := range game.Players {
		player := game.Players[playerID]
		player.Role = availableRoles[i]
		player.Original = availableRoles[i]
		game.Players[playerID] = player
		i++
	}

	// Assign center cards
	game.CenterCards = availableRoles[len(game.Players):]

	// Update game state
	game.State = StateNight
	game.Round = 1
	game.CurrentAction = string(RoleDoppelganger) // First role to act

	// Start the night phase in a goroutine
	go gm.startNightPhase(game.ID)

	return nil
}

func (gm *GameManager) generateRoleList(playerCount int) []RoleType {
	// Basic roles that should always be included
	roles := []RoleType{
		RoleWerewolf,
		RoleWerewolf,
		RoleSeer,
		RoleRobber,
		RoleTroublemaker,
		RoleVillager,
	}

	// Add additional roles based on player count
	if playerCount > 3 {
		roles = append(roles, RoleMason, RoleMason)
	}
	if playerCount > 5 {
		roles = append(roles, RoleInsomniac)
	}
	if playerCount > 6 {
		roles = append(roles, RoleTanner)
	}
	if playerCount > 7 {
		roles = append(roles, RoleDrunk)
	}
	if playerCount > 8 {
		roles = append(roles, RoleMinion)
	}
	if playerCount > 9 {
		roles = append(roles, RoleDoppelganger)
	}

	// Add extra villagers if needed
	for len(roles) < playerCount+3 { // +3 for center cards
		roles = append(roles, RoleVillager)
	}

	return roles
}

func (gm *GameManager) RegisterConnection(gameID, playerID string, conn *websocket.Conn) {
	gm.mu.Lock()
	defer gm.mu.Unlock()

	if _, exists := gm.connections[gameID]; !exists {
		gm.connections[gameID] = make(map[string]*websocket.Conn)
	}
	gm.connections[gameID][playerID] = conn
}

func (gm *GameManager) RemoveConnection(gameID, playerID string) {
	gm.mu.Lock()
	defer gm.mu.Unlock()

	if conns, exists := gm.connections[gameID]; exists {
		delete(conns, playerID)
		if len(conns) == 0 {
			delete(gm.connections, gameID)
		}
	}
}

func (gm *GameManager) BroadcastGameState(gameID string) {
	game, exists := gm.games[gameID]
	if !exists {
		return
	}

	msg := WSMessage{
		Type: WSGameState,
		Payload: GameStateUpdate{
			Game:    game,
			Message: fmt.Sprintf("Current action: %s", game.CurrentAction),
		},
	}

	if conns, exists := gm.connections[gameID]; exists {
		for playerID, conn := range conns {
			if err := conn.WriteJSON(msg); err != nil {
				log.Printf("Error sending to player %s: %v", playerID, err)
				conn.Close()
				delete(conns, playerID)
			}
		}
	}
}

func (gm *GameManager) startNightPhase(gameID string) {
	game, exists := gm.GetGame(gameID)
	if !exists {
		return
	}

	go func() {
		for _, role := range game.NightOrder {
			game.CurrentAction = string(role)
			gm.BroadcastGameState(gameID)

			// Special handling for Doppelganger
			if role == RoleDoppelganger {
				// Wait for Doppelganger action
				time.Sleep(DoppelgangerTime * time.Second)

				// Check if there was a Doppelganger action
				gm.mu.Lock()
				game, exists = gm.GetGame(gameID)
				if exists {
					for _, action := range game.NightActions {
						if action.Role == RoleDoppelganger {
							// Give time for the copied role's action
							game.CurrentAction = string(action.Result.Data.(map[string]interface{})["newRole"].(RoleType))
							gm.BroadcastGameState(gameID)
							time.Sleep(getRoleTime(RoleType(game.CurrentAction)) * time.Second)
							break
						}
					}
				}
				gm.mu.Unlock()
				continue
			}

			// Wait for the role's time limit
			time.Sleep(getRoleTime(role) * time.Second)
		}

		// Night phase complete, move to discussion
		gm.mu.Lock()
		game.State = StateDiscussion
		game.CurrentAction = ""
		gm.mu.Unlock()
		gm.BroadcastGameState(gameID)

		// Wait for discussion phase
		time.Sleep(DiscussionTime * time.Second)

		// Move to voting phase
		gm.mu.Lock()
		game.State = StateVoting
		gm.mu.Unlock()
		gm.BroadcastGameState(gameID)
	}()
}

func getRoleTime(role RoleType) time.Duration {
	switch role {
	case RoleDoppelganger:
		return DoppelgangerTime
	case RoleWerewolf:
		return WerewolfTime
	case RoleMinion:
		return MinionTime
	case RoleMason:
		return MasonTime
	case RoleSeer:
		return SeerTime
	case RoleRobber:
		return RobberTime
	case RoleTroublemaker:
		return TroublemakerTime
	case RoleDrunk:
		return DrunkTime
	case RoleInsomniac:
		return InsomniacTime
	default:
		return 10
	}
}

// HandleNightAction processes a night action from a player
func (gm *GameManager) HandleNightAction(gameID string, playerID string, action PlayerAction) error {
	gm.mu.Lock()
	defer gm.mu.Unlock()

	game, exists := gm.games[gameID]
	if !exists {
		return errors.New("game not found")
	}

	player, exists := game.Players[playerID]
	if !exists {
		return errors.New("player not found")
	}

	// Verify it's the correct role's turn
	if string(player.Role) != game.CurrentAction {
		return errors.New("not your turn")
	}

	// Process the action based on the role
	var result ActionResult
	switch player.Role {
	case RoleDoppelganger:
		result = gm.handleDoppelgangerAction(game, playerID, action)
	case RoleWerewolf:
		if action.Action == "VIEW_CENTER" {
			result = gm.handleWerewolfCenterCardAction(game, action)
		} else {
			result = gm.handleWerewolfAction(game)
		}
	case RoleSeer:
		result = gm.handleSeerAction(game, action)
	case RoleRobber:
		result = gm.handleRobberAction(game, playerID, action)
	case RoleTroublemaker:
		result = gm.handleTroublemakerAction(game, action)
	case RoleDrunk:
		result = gm.handleDrunkAction(game, playerID, action)
	case RoleInsomniac:
		result = gm.handleInsomniacAction(game, playerID)
	case RoleMinion:
		result = gm.handleMinionAction(game)
	case RoleMason:
		result = gm.handleMasonAction(game)
	default:
		return errors.New("invalid role action")
	}

	// Record the action
	game.NightActions = append(game.NightActions, NightAction{
		Role:     player.Role,
		PlayerID: playerID,
		Action:   action.Action,
		Targets:  action.Targets,
		Result:   result,
	})

	return nil
}

func (gm *GameManager) handleSeerAction(game *Game, action PlayerAction) ActionResult {
	if len(action.Targets) != 1 && len(action.Targets) != 2 {
		return ActionResult{Success: false, Message: "Seer must choose one player or two center cards"}
	}

	if len(action.Targets) == 1 {
		// Looking at another player's card
		targetPlayer, exists := game.Players[action.Targets[0]]
		if !exists {
			return ActionResult{Success: false, Message: "Target player not found"}
		}
		return ActionResult{
			Success: true,
			Message: fmt.Sprintf("Player %s is a %s", targetPlayer.Name, targetPlayer.Role),
			Data:    targetPlayer.Role,
		}
	} else {
		// Looking at two center cards
		centerIndices := make([]int, 2)
		for i, target := range action.Targets {
			idx, err := strconv.Atoi(target)
			if err != nil || idx < 0 || idx > 2 {
				return ActionResult{Success: false, Message: "Invalid center card index"}
			}
			centerIndices[i] = idx
		}
		return ActionResult{
			Success: true,
			Message: "Viewed center cards",
			Data: map[string]RoleType{
				fmt.Sprintf("center%d", centerIndices[0]): game.CenterCards[centerIndices[0]],
				fmt.Sprintf("center%d", centerIndices[1]): game.CenterCards[centerIndices[1]],
			},
		}
	}
}

func (gm *GameManager) handleRobberAction(game *Game, playerID string, action PlayerAction) ActionResult {
	if len(action.Targets) != 1 {
		return ActionResult{Success: false, Message: "Robber must choose exactly one player"}
	}

	targetID := action.Targets[0]
	targetPlayer, exists := game.Players[targetID]
	if !exists {
		return ActionResult{Success: false, Message: "Target player not found"}
	}

	// Swap roles
	currentPlayer := game.Players[playerID]
	oldRole := currentPlayer.Role
	currentPlayer.Role = targetPlayer.Role
	targetPlayer.Role = oldRole

	game.Players[playerID] = currentPlayer
	game.Players[targetID] = targetPlayer

	return ActionResult{
		Success: true,
		Message: fmt.Sprintf("Swapped roles with %s, your new role is %s", targetPlayer.Name, currentPlayer.Role),
		Data:    currentPlayer.Role,
	}
}

func (gm *GameManager) handleTroublemakerAction(game *Game, action PlayerAction) ActionResult {
	if len(action.Targets) != 2 {
		return ActionResult{Success: false, Message: "Troublemaker must choose exactly two players"}
	}

	player1, exists1 := game.Players[action.Targets[0]]
	player2, exists2 := game.Players[action.Targets[1]]
	if !exists1 || !exists2 {
		return ActionResult{Success: false, Message: "One or more target players not found"}
	}

	// Swap roles
	player1Role := player1.Role
	player1.Role = player2.Role
	player2.Role = player1Role

	game.Players[action.Targets[0]] = player1
	game.Players[action.Targets[1]] = player2

	return ActionResult{
		Success: true,
		Message: fmt.Sprintf("Swapped roles between %s and %s", player1.Name, player2.Name),
	}
}

func (gm *GameManager) handleDrunkAction(game *Game, playerID string, action PlayerAction) ActionResult {
	if len(action.Targets) != 1 {
		return ActionResult{Success: false, Message: "Drunk must choose exactly one center card"}
	}

	idx, err := strconv.Atoi(action.Targets[0])
	if err != nil || idx < 0 || idx > 2 {
		return ActionResult{Success: false, Message: "Invalid center card index"}
	}

	// Swap with center card
	player := game.Players[playerID]
	oldRole := player.Role
	player.Role = game.CenterCards[idx]
	game.CenterCards[idx] = oldRole
	game.Players[playerID] = player

	return ActionResult{
		Success: true,
		Message: "Swapped with a center card",
	}
}

func (gm *GameManager) handleInsomniacAction(game *Game, playerID string) ActionResult {
	player := game.Players[playerID]
	return ActionResult{
		Success: true,
		Message: fmt.Sprintf("Your current role is %s", player.Role),
		Data:    player.Role,
	}
}

func (gm *GameManager) handleMinionAction(game *Game) ActionResult {
	werewolves := make([]string, 0)
	for _, player := range game.Players {
		if player.Role == RoleWerewolf {
			werewolves = append(werewolves, player.Name)
		}
	}

	return ActionResult{
		Success: true,
		Message: fmt.Sprintf("The Werewolves are: %v", werewolves),
		Data:    werewolves,
	}
}

func (gm *GameManager) handleMasonAction(game *Game) ActionResult {
	masons := make([]string, 0)
	for _, player := range game.Players {
		if player.Role == RoleMason {
			masons = append(masons, player.Name)
		}
	}

	return ActionResult{
		Success: true,
		Message: fmt.Sprintf("The other Masons are: %v", masons),
		Data:    masons,
	}
}

func (gm *GameManager) handleWerewolfAction(game *Game) ActionResult {
	werewolves := make([]string, 0)
	for _, player := range game.Players {
		if player.Role == RoleWerewolf {
			werewolves = append(werewolves, player.Name)
		}
	}

	// If there's only one werewolf, they get to look at a center card
	if len(werewolves) == 1 {
		return ActionResult{
			Success: true,
			Message: "You are the only Werewolf. You may look at one center card.",
			Data: map[string]interface{}{
				"werewolves":    werewolves,
				"canViewCenter": true,
			},
		}
	}

	return ActionResult{
		Success: true,
		Message: fmt.Sprintf("The other Werewolves are: %v", werewolves),
		Data: map[string]interface{}{
			"werewolves":    werewolves,
			"canViewCenter": false,
		},
	}
}

func (gm *GameManager) handleDoppelgangerAction(game *Game, playerID string, action PlayerAction) ActionResult {
	if len(action.Targets) != 1 {
		return ActionResult{Success: false, Message: "Doppelganger must choose exactly one player"}
	}

	targetID := action.Targets[0]
	targetPlayer, exists := game.Players[targetID]
	if !exists {
		return ActionResult{Success: false, Message: "Target player not found"}
	}

	// Copy the target's role
	currentPlayer := game.Players[playerID]
	newRole := targetPlayer.Role
	currentPlayer.Role = newRole
	game.Players[playerID] = currentPlayer

	// Return initial result
	result := ActionResult{
		Success: true,
		Message: fmt.Sprintf("You are now a %s", newRole),
		Data: map[string]interface{}{
			"newRole": newRole,
		},
	}

	// Handle immediate actions for certain roles
	switch newRole {
	case RoleWerewolf:
		werewolfResult := gm.handleWerewolfAction(game)
		result.Message += ". " + werewolfResult.Message
		result.Data = werewolfResult.Data
	case RoleMason:
		masonResult := gm.handleMasonAction(game)
		result.Message += ". " + masonResult.Message
		result.Data = masonResult.Data
	case RoleMinion:
		minionResult := gm.handleMinionAction(game)
		result.Message += ". " + minionResult.Message
		result.Data = minionResult.Data
	case RoleInsomniac:
		// Insomniac ability happens at the end of the night
		// Store that this player should check their role later
		game.NightActions = append(game.NightActions, NightAction{
			Role:     RoleInsomniac,
			PlayerID: playerID,
			Action:   "CHECK_LATER",
		})
	}

	return result
}

func (gm *GameManager) HandleVote(gameID string, playerID string, targetID string) error {
	gm.mu.Lock()
	defer gm.mu.Unlock()

	game, exists := gm.games[gameID]
	if !exists {
		return errors.New("game not found")
	}

	if game.State != StateVoting {
		return errors.New("not in voting phase")
	}

	player, exists := game.Players[playerID]
	if !exists {
		return errors.New("player not found")
	}

	if player.HasVoted {
		return errors.New("already voted")
	}

	if _, exists := game.Players[targetID]; !exists {
		return errors.New("target player not found")
	}

	// Record the vote
	player.HasVoted = true
	player.Vote = targetID
	game.Players[playerID] = player
	game.Votes[playerID] = targetID

	// Check if all players have voted
	allVoted := true
	for _, p := range game.Players {
		if !p.HasVoted {
			allVoted = false
			break
		}
	}

	if allVoted {
		gm.endGame(game)
	}

	gm.BroadcastGameState(gameID)
	return nil
}

func (gm *GameManager) endGame(game *Game) {
	// Count votes
	voteCount := make(map[string]int)
	for _, targetID := range game.Votes {
		voteCount[targetID]++
	}

	// Find player(s) with most votes
	maxVotes := 0
	var killedPlayers []string
	for playerID, votes := range voteCount {
		if votes > maxVotes {
			maxVotes = votes
			killedPlayers = []string{playerID}
		} else if votes == maxVotes {
			killedPlayers = append(killedPlayers, playerID)
		}
	}

	// Determine winners
	winners := gm.determineWinners(game, killedPlayers)
	game.State = StateComplete

	// Send final game state with results
	gm.BroadcastGameState(game.ID)
	gm.broadcastGameResults(game, killedPlayers, winners)
}

func (gm *GameManager) determineWinners(game *Game, killedPlayers []string) []string {
	// Check for special win conditions first
	if len(killedPlayers) == 1 {
		killedPlayer := game.Players[killedPlayers[0]]
		if killedPlayer.Role == RoleTanner {
			// Tanner wins if they die
			return []string{killedPlayers[0]}
		}
	}

	// Check if any werewolves were killed
	werewolfKilled := false
	for _, playerID := range killedPlayers {
		if game.Players[playerID].Role == RoleWerewolf {
			werewolfKilled = true
			break
		}
	}

	// Determine winners based on roles and who was killed
	winners := make([]string, 0)
	for playerID, player := range game.Players {
		switch player.Role {
		case RoleWerewolf:
			if !werewolfKilled {
				winners = append(winners, playerID)
			}
		case RoleMinion:
			if !werewolfKilled {
				winners = append(winners, playerID)
			}
		default:
			// Villager team
			if werewolfKilled {
				winners = append(winners, playerID)
			}
		}
	}

	return winners
}

func (gm *GameManager) broadcastGameResults(game *Game, killedPlayers []string, winners []string) {
	msg := WSMessage{
		Type: WSGameState,
		Payload: GameStateUpdate{
			Game: game,
			Message: fmt.Sprintf("Game Over! Players killed: %v. Winners: %v",
				formatPlayerNames(game, killedPlayers),
				formatPlayerNames(game, winners)),
		},
	}

	if conns, exists := gm.connections[game.ID]; exists {
		for _, conn := range conns {
			conn.WriteJSON(msg)
		}
	}
}

func formatPlayerNames(game *Game, playerIDs []string) []string {
	names := make([]string, len(playerIDs))
	for i, id := range playerIDs {
		if player, exists := game.Players[id]; exists {
			names[i] = player.Name
		}
	}
	return names
}

const (
	DiscussionTime = 300 // 5 minutes for discussion
)

func (gm *GameManager) handleWerewolfCenterCardAction(game *Game, action PlayerAction) ActionResult {
	if len(action.Targets) != 1 {
		return ActionResult{Success: false, Message: "Must choose exactly one center card"}
	}

	idx, err := strconv.Atoi(action.Targets[0])
	if err != nil || idx < 0 || idx > 2 {
		return ActionResult{Success: false, Message: "Invalid center card index"}
	}

	return ActionResult{
		Success: true,
		Message: fmt.Sprintf("Center card %d is %s", idx+1, game.CenterCards[idx]),
		Data:    game.CenterCards[idx],
	}
}

func (gm *GameManager) ListGames() []GameSummary {
	gm.mu.RLock()
	defer gm.mu.RUnlock()

	games := make([]GameSummary, 0)
	for _, game := range gm.games {
		// Only show games in WAITING state
		if game.State == StateWaiting {
			games = append(games, GameSummary{
				ID:          game.ID,
				PlayerCount: len(game.Players),
				State:       game.State,
			})
		}
	}
	return games
}

type GameSummary struct {
	ID          string    `json:"id"`
	PlayerCount int       `json:"playerCount"`
	State       GameState `json:"state"`
}
