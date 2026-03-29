package api

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"net/http"
	"time"

	"github.com/redis/go-redis/v9"
	"github.com/rs/zerolog/log"
	"github.com/salonisaroha/RateShield/utils"
	"golang.org/x/crypto/bcrypt"
)

var authCtx = context.Background()
const passwordKey = "dashboard:password"
const sessionPrefix = "dashboard:session:"
const sessionExpiry = 24 * time.Hour
type AuthAPIHandler struct {
	redisClient *redis.Client
}
func NewAuthAPIHandler(client *redis.Client) AuthAPIHandler {
	return AuthAPIHandler{redisClient: client}
}
func (h AuthAPIHandler) SetupPassword(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		utils.MethodNotAllowedError(w)
		return
	}
	type setupReq struct {
		Password string `json:"password"`
	}
	req, err := utils.ParseAPIBody[setupReq](r)
	if err != nil || len(req.Password) < 6 {
		utils.BadRequestError(w) 
		return
	}

	existing, err := h.redisClient.Get(authCtx, passwordKey).Result()
	if err == nil && existing != "" {
		utils.JSONError(w, http.StatusConflict, "Password already set.")
		return
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		utils.InternalError(w, "Failed to hash password")
		return
	}

	if err := h.redisClient.Set(authCtx, passwordKey, string(hash), 0).Err(); err != nil {
		utils.InternalError(w, "Failed to save password")
		return
	}

	log.Info().Msg("Dashboard password set successfully")
	utils.SuccessResponse("Password set successfully", w)
}

func (h AuthAPIHandler) Login(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		utils.MethodNotAllowedError(w)
		return
	}

	type loginReq struct {
		Password string `json:"password"`
	}
	req, err := utils.ParseAPIBody[loginReq](r)
	if err != nil || req.Password == "" {
		utils.BadRequestError(w)
		return
	}
	hash, err := h.redisClient.Get(authCtx, passwordKey).Result()
	if err == redis.Nil {
		utils.JSONError(w, http.StatusNotFound, "No password set. Call /auth/setup first.")
		return
	}
	if err != nil {
		utils.InternalError(w, "Failed to retrieve password")
		return
	}


	if err := bcrypt.CompareHashAndPassword([]byte(hash), []byte(req.Password)); err != nil {
		utils.JSONError(w, http.StatusUnauthorized, "Incorrect password")
		return
	}

	
	token, err := generateToken()
	if err != nil {
		utils.InternalError(w, "Failed to generate session token")
		return
	}

	sessionKey := sessionPrefix + token
	if err := h.redisClient.Set(authCtx, sessionKey, "valid", sessionExpiry).Err(); err != nil {
		utils.InternalError(w, "Failed to save session")
		return
	}
	utils.SuccessResponse(map[string]string{"token": token}, w)
}


func (h AuthAPIHandler) ValidateToken(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		utils.MethodNotAllowedError(w)
		return
	}

	type validateReq struct {
		Token string `json:"token"`
	}
	req, err := utils.ParseAPIBody[validateReq](r)
	if err != nil || req.Token == "" {
		utils.JSONError(w, http.StatusUnauthorized, "Token required")
		return
	}

	sessionKey := sessionPrefix + req.Token
	val, err := h.redisClient.Get(authCtx, sessionKey).Result()
	if err == redis.Nil || val != "valid" {
		utils.JSONError(w, http.StatusUnauthorized, "Invalid or expired session")
		return
	}
	if err != nil {
		utils.InternalError(w, "Failed to validate session")
		return
	}

	utils.SuccessResponse("valid", w)
}

func (h AuthAPIHandler) Logout(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		utils.MethodNotAllowedError(w)
		return
	}

	
	type logoutReq struct {
		Token string `json:"token"`
	}
	req, err := utils.ParseAPIBody[logoutReq](r)
	if err != nil || req.Token == "" {
		utils.BadRequestError(w)
		return
	}

	
	h.redisClient.Del(authCtx, sessionPrefix+req.Token)
	utils.SuccessResponse("Logged out successfully", w)
}


func generateToken() (string, error) {
	
	bytes := make([]byte, 32)

	
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}
	return hex.EncodeToString(bytes), nil
}
