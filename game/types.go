package game

type RoleType string

const (
	RoleDoppelganger RoleType = "DOPPELGANGER"
	RoleWerewolf     RoleType = "WEREWOLF"
	RoleMinion       RoleType = "MINION"
	RoleMason        RoleType = "MASON"
	RoleSeer         RoleType = "SEER"
	RoleRobber       RoleType = "ROBBER"
	RoleTroublemaker RoleType = "TROUBLEMAKER"
	RoleDrunk        RoleType = "DRUNK"
	RoleInsomniac    RoleType = "INSOMNIAC"
	RoleVillager     RoleType = "VILLAGER"
	RoleHunter       RoleType = "HUNTER"
	RoleTanner       RoleType = "TANNER"
)

type GameState string

const (
	StateWaiting    GameState = "WAITING"
	StateNight      GameState = "NIGHT"
	StateDiscussion GameState = "DISCUSSION"
	StateVoting     GameState = "VOTING"
	StateComplete   GameState = "COMPLETE"
)

type WSMessageType string

const (
	WSJoinGame     WSMessageType = "JOIN_GAME"
	WSGameState    WSMessageType = "GAME_STATE"
	WSPlayerAction WSMessageType = "PLAYER_ACTION"
	WSError        WSMessageType = "ERROR"
)

type WSMessage struct {
	Type    WSMessageType `json:"type"`
	Payload interface{}   `json:"payload"`
}

type GameStateUpdate struct {
	Game    *Game  `json:"game"`
	Message string `json:"message,omitempty"`
}

// NightAction represents an action taken during the night phase
type NightAction struct {
	Role     RoleType     `json:"role"`
	PlayerID string       `json:"playerId"`
	Action   string       `json:"action"`
	Targets  []string     `json:"targets"`
	Result   ActionResult `json:"result,omitempty"`
}

// ActionResult stores the result of a night action
type ActionResult struct {
	Success bool        `json:"success"`
	Message string      `json:"message"`
	Data    interface{} `json:"data,omitempty"`
}

type Player struct {
	ID       string   `json:"id"`
	Name     string   `json:"name"`
	Role     RoleType `json:"role"`
	Original RoleType `json:"original"` // Original role before any swaps
	Ready    bool     `json:"ready"`
	HasVoted bool     `json:"hasVoted"`
	Vote     string   `json:"vote,omitempty"` // ID of the player they voted for
}

type Game struct {
	ID            string            `json:"id"`
	Players       map[string]Player `json:"players"`
	State         GameState         `json:"state"`
	CenterCards   []RoleType        `json:"centerCards"`
	CurrentAction string            `json:"currentAction"` // Current player/role acting
	Round         int               `json:"round"`
	NightActions  []NightAction     `json:"nightActions"`
	NightOrder    []RoleType        `json:"nightOrder"`
	Votes         map[string]string `json:"votes"` // PlayerID -> VotedForPlayerID
}

// Constants for night actions
const (
	ActionView   = "VIEW"   // For Seer, Insomniac
	ActionSwap   = "SWAP"   // For Robber, Troublemaker
	ActionCopy   = "COPY"   // For Doppelganger
	ActionReveal = "REVEAL" // For showing roles to Minion
)

// Constants for night phase timing
const (
	DoppelgangerTime = 10 // seconds
	WerewolfTime     = 15
	MinionTime       = 10
	MasonTime        = 10
	SeerTime         = 15
	RobberTime       = 15
	TroublemakerTime = 15
	DrunkTime        = 10
	InsomniacTime    = 10
)

type PlayerAction struct {
	Action  string   `json:"action"`
	Targets []string `json:"targets"`
}
