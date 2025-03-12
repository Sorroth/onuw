package handlers

import (
	"encoding/json"
	"net/http"
	"onuw/game"

	"github.com/gorilla/mux"
)

func HandleCreateGame(gm *game.GameManager) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		var createRequest struct {
			PlayerName string `json:"playerName"`
		}

		if err := json.NewDecoder(r.Body).Decode(&createRequest); err != nil {
			http.Error(w, "Invalid request body", http.StatusBadRequest)
			return
		}

		if createRequest.PlayerName == "" {
			http.Error(w, "Player name is required", http.StatusBadRequest)
			return
		}

		game, err := gm.CreateGame(createRequest.PlayerName)
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{
			"gameId": game.ID,
		})
	}
}

func HandleJoinGame(gm *game.GameManager) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		gameID := mux.Vars(r)["id"]
		var joinRequest struct {
			Name string `json:"name"`
		}

		if err := json.NewDecoder(r.Body).Decode(&joinRequest); err != nil {
			http.Error(w, "Invalid request body", http.StatusBadRequest)
			return
		}

		player, err := gm.JoinGame(gameID, joinRequest.Name)
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{
			"playerId": player.ID,
		})
	}
}

func HandlePlayerReady(gm *game.GameManager) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		vars := mux.Vars(r)
		gameID := vars["id"]
		playerID := vars["playerId"]

		var readyRequest struct {
			Ready bool `json:"ready"`
		}

		if err := json.NewDecoder(r.Body).Decode(&readyRequest); err != nil {
			http.Error(w, "Invalid request body", http.StatusBadRequest)
			return
		}

		if err := gm.SetPlayerReady(gameID, playerID, readyRequest.Ready); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}

		w.WriteHeader(http.StatusOK)
	}
}

func HandleVote(gm *game.GameManager) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		vars := mux.Vars(r)
		gameID := vars["id"]
		playerID := vars["playerId"]

		var voteRequest struct {
			TargetID string `json:"targetId"`
		}

		if err := json.NewDecoder(r.Body).Decode(&voteRequest); err != nil {
			http.Error(w, "Invalid request body", http.StatusBadRequest)
			return
		}

		if err := gm.HandleVote(gameID, playerID, voteRequest.TargetID); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}

		w.WriteHeader(http.StatusOK)
	}
}

func HandleNightAction(gm *game.GameManager) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		vars := mux.Vars(r)
		gameID := vars["id"]
		playerID := vars["playerId"]

		var actionRequest struct {
			Action  string   `json:"action"`
			Targets []string `json:"targets"`
		}

		if err := json.NewDecoder(r.Body).Decode(&actionRequest); err != nil {
			http.Error(w, "Invalid request body", http.StatusBadRequest)
			return
		}

		if err := gm.HandleNightAction(gameID, playerID, game.PlayerAction{
			Action:  actionRequest.Action,
			Targets: actionRequest.Targets,
		}); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}

		w.WriteHeader(http.StatusOK)
	}
}

func HandleListGames(gm *game.GameManager) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		games := gm.ListGames()
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(games)
	}
}
