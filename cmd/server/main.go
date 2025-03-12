package main

import (
	"fmt"
	"log"
	"net/http"
	"onuw/api/handlers"
	"onuw/api/middleware"
	"onuw/game"

	"github.com/gorilla/mux"
)

func main() {
	gameManager := game.NewGameManager()
	router := mux.NewRouter()

	// Handle websocket connections
	router.HandleFunc("/ws/game/{id}", func(w http.ResponseWriter, r *http.Request) {
		handlers.HandleGameWebSocket(w, r, gameManager)
	})

	// Handle client logs
	router.HandleFunc("/api/logs", middleware.CORS(handlers.HandleClientLogs)).Methods("POST", "OPTIONS")

	// Game routes
	router.HandleFunc("/api/games", middleware.CORS(handlers.HandleListGames(gameManager))).Methods("GET", "OPTIONS")
	router.HandleFunc("/api/games", middleware.CORS(handlers.HandleCreateGame(gameManager))).Methods("POST", "OPTIONS")
	router.HandleFunc("/api/games/{id}/join", middleware.CORS(handlers.HandleJoinGame(gameManager))).Methods("POST", "OPTIONS")
	router.HandleFunc("/api/games/{id}/players/{playerId}/ready", middleware.CORS(handlers.HandlePlayerReady(gameManager))).Methods("POST", "OPTIONS")
	router.HandleFunc("/api/games/{id}/players/{playerId}/vote", middleware.CORS(handlers.HandleVote(gameManager))).Methods("POST", "OPTIONS")
	router.HandleFunc("/api/games/{id}/players/{playerId}/action", middleware.CORS(handlers.HandleNightAction(gameManager))).Methods("POST", "OPTIONS")

	port := 8080
	fmt.Printf("Server starting on port %d...\n", port)
	if err := http.ListenAndServe(fmt.Sprintf(":%d", port), router); err != nil {
		log.Fatal("Server failed to start:", err)
	}
}
