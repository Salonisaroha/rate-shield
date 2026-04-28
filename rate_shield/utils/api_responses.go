package utils

import (
	"encoding/json"
	"net/http"
)

func InternalError(w http.ResponseWriter, message string) {
	msg := map[string]string{
		"status":  "fail",
		"error":   "Internal Server Error",
		"message": message,
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusInternalServerError)
	bytes, _ := json.Marshal(msg)
	w.Write(bytes)
}

func BadRequestError(w http.ResponseWriter) {
	msg := map[string]string{
		"status": "fail",
		"error":  "Invalid Request Body",
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusBadRequest)
	bytes, _ := json.Marshal(msg)
	w.Write(bytes)
}

func MethodNotAllowedError(w http.ResponseWriter) {
	msg := map[string]string{
		"status": "fail",
		"error":  "Method Not Allowed",
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusMethodNotAllowed)
	bytes, _ := json.Marshal(msg)
	w.Write(bytes)
}

func SuccessResponse(data interface{}, w http.ResponseWriter) {
	msg := map[string]interface{}{
		"status": "success",
		"data":   data,
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	bytes, _ := json.Marshal(msg)
	w.Write(bytes)
}

func JSONError(w http.ResponseWriter, statusCode int, message string) {
	msg := map[string]string{
		"status":  "fail",
		"message": message,
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)
	bytes, _ := json.Marshal(msg)
	w.Write(bytes)
}
