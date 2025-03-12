package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"onuw/pkg/logger"
)

type ClientLog struct {
	Level     string      `json:"level"`
	Message   string      `json:"message"`
	Timestamp string      `json:"timestamp"`
	Data      interface{} `json:"data,omitempty"`
	Stack     string      `json:"stack,omitempty"`
}

func HandleClientLogs(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var clientLog ClientLog
	if err := json.NewDecoder(r.Body).Decode(&clientLog); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	log := logger.GetLogger()
	logMsg := fmt.Sprintf("[CLIENT] %s - %s", clientLog.Message, clientLog.Data)

	switch clientLog.Level {
	case "DEBUG":
		log.Debug("%s", logMsg)
	case "INFO":
		log.Info("%s", logMsg)
	case "WARN":
		log.Warn("%s", logMsg)
	case "ERROR":
		log.Error("%s", logMsg)
	}

	w.WriteHeader(http.StatusOK)
}
