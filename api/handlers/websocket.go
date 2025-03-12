package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"onuw/game"
	"onuw/pkg/logger"

	"github.com/gorilla/mux"
	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true // For development
	},
}

func HandleGameWebSocket(w http.ResponseWriter, r *http.Request, gm *game.GameManager) {
	log := logger.GetLogger()

	vars := mux.Vars(r)
	gameID := vars["id"]
	playerID := r.URL.Query().Get("playerId")

	if playerID == "" {
		log.Error("No player ID provided")
		return
	}

	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Error("Failed to upgrade connection: %v", err)
		return
	}
	defer conn.Close()
	defer gm.RemoveConnection(gameID, playerID)

	gm.RegisterConnection(gameID, playerID, conn)

	// Send initial game state
	gameObj, exists := gm.GetGame(gameID)
	if !exists {
		sendError(conn, "Game not found")
		return
	}

	// Send initial game state
	err = conn.WriteJSON(game.WSMessage{
		Type: game.WSGameState,
		Payload: game.GameStateUpdate{
			Game:    gameObj,
			Message: fmt.Sprintf("Current action: %s", gameObj.CurrentAction),
		},
	})
	if err != nil {
		log.Error("Failed to send initial game state: %v", err)
		return
	}

	for {
		var msg game.WSMessage
		err := conn.ReadJSON(&msg)
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Error("WebSocket error: %v", err)
			}
			break
		}

		log.Debug("Received message: %v", msg)

		switch msg.Type {
		case game.WSPlayerAction:
			handlePlayerAction(conn, gm, gameID, playerID, msg.Payload)
		default:
			log.Warn("Unknown message type: %v", msg.Type)
		}
	}
}

func sendError(conn *websocket.Conn, message string) {
	conn.WriteJSON(game.WSMessage{
		Type: game.WSError,
		Payload: map[string]string{
			"error": message,
		},
	})
}

func handlePlayerAction(conn *websocket.Conn, gm *game.GameManager, gameID string, playerID string, payload interface{}) {
	log := logger.GetLogger()

	// Convert payload to PlayerAction
	payloadBytes, err := json.Marshal(payload)
	if err != nil {
		log.Error("Failed to marshal payload: %v", err)
		return
	}

	var action game.PlayerAction
	if err := json.Unmarshal(payloadBytes, &action); err != nil {
		log.Error("Failed to unmarshal player action: %v", err)
		return
	}

	if err := gm.HandleNightAction(gameID, playerID, action); err != nil {
		sendError(conn, err.Error())
		return
	}

	// Action processed successfully
	conn.WriteJSON(game.WSMessage{
		Type: game.WSGameState,
		Payload: map[string]string{
			"status": "action processed",
		},
	})
}
