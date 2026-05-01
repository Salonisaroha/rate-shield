package api

import (
	"context"
	"crypto/rand"
	"encoding/json"
	"fmt"
	"net/http"
	"net/smtp"
	"os"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/redis/go-redis/v9"
	"github.com/salonisaroha/RateShield/utils"
	"golang.org/x/crypto/bcrypt"
	"golang.org/x/oauth2"
	"golang.org/x/oauth2/google"
)

var authCtx = context.Background()
var jwtSecret []byte

func getJWTSecret() []byte {
	if jwtSecret == nil {
		secret := os.Getenv("JWT_SECRET")
		if secret == "" {
			panic("JWT_SECRET environment variable is not set")
		}
		jwtSecret = []byte(secret)
	}
	return jwtSecret
}

const (
	userPrefix    = "dashboard:user:"
	sessionPrefix = "dashboard:session:"
	otpPrefix     = "dashboard:otp:"
	sessionExpiry = 24 * time.Hour
	otpExpiry     = 10 * time.Minute
)

type AuthAPIHandler struct {
	redisClient *redis.Client
	oauthCfg    *oauth2.Config
}

type storedUser struct {
	Email        string `json:"email"`
	PasswordHash string `json:"password_hash,omitempty"`
	Provider     string `json:"provider"` 
	Verified     bool   `json:"verified"`
}

func NewAuthAPIHandler(client *redis.Client) AuthAPIHandler {
	cfg := &oauth2.Config{
		ClientID:     os.Getenv("GOOGLE_CLIENT_ID"),
		ClientSecret: os.Getenv("GOOGLE_CLIENT_SECRET"),
		RedirectURL:  os.Getenv("GOOGLE_REDIRECT_URL"),
		Scopes:       []string{"openid", "email", "profile"},
		Endpoint:     google.Endpoint,
	}
	return AuthAPIHandler{redisClient: client, oauthCfg: cfg}
}

// Register — saves user as unverified and sends OTP to email
func (h AuthAPIHandler) Register(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		utils.MethodNotAllowedError(w)
		return
	}
	type req struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}
	body, err := utils.ParseAPIBody[req](r)
	if err != nil || body.Email == "" || body.Password == "" {
		utils.BadRequestError(w)
		return
	}
	if len(body.Password) < 8 {
		utils.JSONError(w, http.StatusBadRequest, "Password must be at least 8 characters")
		return
	}

	exists, _ := h.redisClient.Exists(authCtx, userPrefix+body.Email).Result()
	if exists == 1 {
		user, err := h.getUser(body.Email)
		if err == nil && user.Verified {
			utils.JSONError(w, http.StatusConflict, "Email already registered")
			return
		}
		// Unverified — just resend OTP, do not overwrite password
		if err := h.sendOTP(body.Email); err != nil {
			utils.InternalError(w, "Failed to send OTP")
			return
		}
		utils.SuccessResponse("otp_sent", w)
		return
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(body.Password), bcrypt.DefaultCost)
	if err != nil {
		utils.InternalError(w, "Failed to hash password")
		return
	}

	user := storedUser{Email: body.Email, PasswordHash: string(hash), Provider: "local", Verified: false}
	if err := h.saveUser(user); err != nil {
		utils.InternalError(w, "Failed to save user")
		return
	}

	if err := h.sendOTP(body.Email); err != nil {
		utils.InternalError(w, "Failed to send OTP")
		return
	}

	utils.SuccessResponse("otp_sent", w)
}

// VerifyOTP — validates the OTP, marks user verified, returns JWT
func (h AuthAPIHandler) VerifyOTP(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		utils.MethodNotAllowedError(w)
		return
	}
	type req struct {
		Email string `json:"email"`
		OTP   string `json:"otp"`
	}
	body, err := utils.ParseAPIBody[req](r)
	if err != nil || body.Email == "" || body.OTP == "" {
		utils.BadRequestError(w)
		return
	}

	storedOTP, err := h.redisClient.Get(authCtx, otpPrefix+body.Email).Result()
	if err == redis.Nil {
		utils.JSONError(w, http.StatusBadRequest, "OTP expired or invalid")
		return
	}
	if err != nil {
		utils.InternalError(w, "Redis error")
		return
	}
	if storedOTP != body.OTP {
		utils.JSONError(w, http.StatusBadRequest, "Incorrect OTP")
		return
	}

	h.redisClient.Del(authCtx, otpPrefix+body.Email)

	user, err := h.getUser(body.Email)
	if err != nil {
		utils.JSONError(w, http.StatusNotFound, "User not found")
		return
	}
	if user.Verified {
		utils.JSONError(w, http.StatusBadRequest, "Email already verified")
		return
	}
	user.Verified = true
	if err := h.saveUser(*user); err != nil {
		utils.InternalError(w, "Failed to verify user")
		return
	}

	token, err := generateJWT(body.Email)
	if err != nil {
		utils.InternalError(w, "Failed to generate token")
		return
	}
	utils.SuccessResponse(map[string]string{"token": token}, w)
}

// ResendOTP — resends a fresh OTP to the email
func (h AuthAPIHandler) ResendOTP(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		utils.MethodNotAllowedError(w)
		return
	}
	type req struct {
		Email string `json:"email"`
	}
	body, err := utils.ParseAPIBody[req](r)
	if err != nil || body.Email == "" {
		utils.BadRequestError(w)
		return
	}
	user, err := h.getUser(body.Email)
	if err != nil {
		utils.JSONError(w, http.StatusNotFound, "Email not registered")
		return
	}
	if user.Verified {
		utils.JSONError(w, http.StatusBadRequest, "Email already verified")
		return
	}
	if err := h.sendOTP(body.Email); err != nil {
		utils.InternalError(w, "Failed to send OTP")
		return
	}
	utils.SuccessResponse("otp_sent", w)
}

// Login — email + password, blocks unverified users
func (h AuthAPIHandler) Login(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		utils.MethodNotAllowedError(w)
		return
	}
	type req struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}
	body, err := utils.ParseAPIBody[req](r)
	if err != nil || body.Email == "" || body.Password == "" {
		utils.BadRequestError(w)
		return
	}

	user, err := h.getUser(body.Email)
	if err != nil {
		utils.JSONError(w, http.StatusUnauthorized, "Invalid email or password")
		return
	}
	if user.Provider != "local" {
		utils.JSONError(w, http.StatusBadRequest, "This account uses Google sign-in")
		return
	}
	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(body.Password)); err != nil {
		utils.JSONError(w, http.StatusUnauthorized, "Invalid email or password")
		return
	}
	if !user.Verified {
		utils.JSONError(w, http.StatusForbidden, "email_not_verified")
		return
	}

	token, err := generateJWT(body.Email)
	if err != nil {
		utils.InternalError(w, "Failed to generate token")
		return
	}
	utils.SuccessResponse(map[string]string{"token": token}, w)
}

// GoogleLogin — redirects to Google consent screen
func (h AuthAPIHandler) GoogleLogin(w http.ResponseWriter, r *http.Request) {
	state, _ := generateRandomState()
	h.redisClient.Set(authCtx, "oauth:state:"+state, "valid", 10*time.Minute)
	url := h.oauthCfg.AuthCodeURL(state, oauth2.AccessTypeOnline)
	http.Redirect(w, r, url, http.StatusTemporaryRedirect)
}

// GoogleCallback — handles Google OAuth callback
func (h AuthAPIHandler) GoogleCallback(w http.ResponseWriter, r *http.Request) {
	state := r.URL.Query().Get("state")
	val, err := h.redisClient.Get(authCtx, "oauth:state:"+state).Result()
	if err != nil || val != "valid" {
		utils.JSONError(w, http.StatusUnauthorized, "Invalid OAuth state")
		return
	}
	h.redisClient.Del(authCtx, "oauth:state:"+state)

	code := r.URL.Query().Get("code")
	oauthToken, err := h.oauthCfg.Exchange(authCtx, code)
	if err != nil {
		utils.InternalError(w, "Failed to exchange OAuth code")
		return
	}

	client := h.oauthCfg.Client(authCtx, oauthToken)
	resp, err := client.Get("https://www.googleapis.com/oauth2/v2/userinfo")
	if err != nil {
		utils.InternalError(w, "Failed to fetch user info")
		return
	}
	defer resp.Body.Close()

	var info struct {
		Email string `json:"email"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&info); err != nil || info.Email == "" {
		utils.InternalError(w, "Failed to parse user info")
		return
	}

	exists, _ := h.redisClient.Exists(authCtx, userPrefix+info.Email).Result()
	if exists == 0 {
		user := storedUser{Email: info.Email, Provider: "google", Verified: true}
		if err := h.saveUser(user); err != nil {
			utils.InternalError(w, "Failed to register user")
			return
		}
	}

	jwtToken, err := generateJWT(info.Email)
	if err != nil {
		utils.InternalError(w, "Failed to generate token")
		return
	}

	frontendURL := os.Getenv("FRONTEND_URL")
	http.Redirect(w, r, frontendURL+"?token="+jwtToken, http.StatusTemporaryRedirect)
}

// ValidateToken — verifies JWT
func (h AuthAPIHandler) ValidateToken(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		utils.MethodNotAllowedError(w)
		return
	}
	type req struct {
		Token string `json:"token"`
	}
	body, err := utils.ParseAPIBody[req](r)
	if err != nil || body.Token == "" {
		utils.JSONError(w, http.StatusUnauthorized, "Token required")
		return
	}
	if _, err := parseJWT(body.Token); err != nil {
		utils.JSONError(w, http.StatusUnauthorized, "Invalid or expired token")
		return
	}
	utils.SuccessResponse("valid", w)
}

// Logout — stateless JWT, signal frontend to clear token
func (h AuthAPIHandler) Logout(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		utils.MethodNotAllowedError(w)
		return
	}
	utils.SuccessResponse("Logged out successfully", w)
}

// --- helpers ---

func (h AuthAPIHandler) sendOTP(email string) error {
	otp := generateOTP()
	if err := h.redisClient.Set(authCtx, otpPrefix+email, otp, otpExpiry).Err(); err != nil {
		return err
	}
	body := fmt.Sprintf(`<div style="font-family:'Segoe UI',sans-serif;max-width:480px;margin:0 auto;padding:32px;">
		<h2 style="color:#0F172A;font-size:1.1rem;margin-bottom:8px;">Verify your Rate Shield account</h2>
		<p style="color:#64748B;font-size:0.85rem;margin-bottom:20px;">Enter the OTP below to verify your email address. It expires in 10 minutes.</p>
		<div style="background:#EEF2FF;border-radius:12px;padding:20px;text-align:center;margin-bottom:20px;">
			<span style="font-size:2rem;font-weight:700;letter-spacing:0.3em;color:#4F46E5;">%s</span>
		</div>
		<p style="color:#94A3B8;font-size:0.75rem;">If you did not request this, please ignore this email.</p>
	</div>`, otp)
	return sendEmail(email, "Your Rate Shield OTP", body)
}

func (h AuthAPIHandler) saveUser(u storedUser) error {
	data, err := json.Marshal(u)
	if err != nil {
		return err
	}
	return h.redisClient.Set(authCtx, userPrefix+u.Email, string(data), 0).Err()
}

func (h AuthAPIHandler) getUser(email string) (*storedUser, error) {
	raw, err := h.redisClient.Get(authCtx, userPrefix+email).Result()
	if err != nil {
		return nil, err
	}
	var u storedUser
	if err := json.Unmarshal([]byte(raw), &u); err != nil {
		return nil, err
	}
	return &u, nil
}

func generateOTP() string {
	b := make([]byte, 3)
	rand.Read(b)
	// produce a 6-digit number from 3 random bytes
	n := (int(b[0])<<16 | int(b[1])<<8 | int(b[2])) % 1000000
	return fmt.Sprintf("%06d", n)
}

func generateRandomState() (string, error) {
	b := make([]byte, 16)
	rand.Read(b)
	return fmt.Sprintf("%x", b), nil
}

func generateJWT(email string) (string, error) {
	claims := jwt.MapClaims{
		"sub": email,
		"exp": time.Now().Add(sessionExpiry).Unix(),
		"iat": time.Now().Unix(),
	}
	return jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString(getJWTSecret())
}

func parseJWT(tokenStr string) (jwt.MapClaims, error) {
	token, err := jwt.Parse(tokenStr, func(t *jwt.Token) (interface{}, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, jwt.ErrSignatureInvalid
		}
		return getJWTSecret(), nil
	})
	if err != nil || !token.Valid {
		return nil, err
	}
	return token.Claims.(jwt.MapClaims), nil
}

func sendEmail(to, subject, body string) error {
	// Use Brevo HTTP API if API key is set (works when SMTP ports are blocked)
	if apiKey := os.Getenv("BREVO_API_KEY"); apiKey != "" {
		return sendEmailViaBrevoAPI(to, subject, body, apiKey)
	}

	host := os.Getenv("SMTP_HOST")
	port := os.Getenv("SMTP_PORT")
	user := os.Getenv("SMTP_USER")
	pass := os.Getenv("SMTP_PASS")
	sender := os.Getenv("SMTP_SENDER")
	if sender == "" {
		sender = user
	}
	auth := smtp.PlainAuth("", user, pass, host)
	msg := []byte("To: " + to + "\r\n" +
		"From: Rate Shield <" + sender + ">\r\n" +
		"Subject: " + subject + "\r\n" +
		"MIME-Version: 1.0\r\n" +
		"Content-Type: text/html; charset=UTF-8\r\n\r\n" +
		body)
	return smtp.SendMail(host+":"+port, auth, user, []string{to}, msg)
}

func sendEmailViaBrevoAPI(to, subject, body, apiKey string) error {
	sender := os.Getenv("SMTP_SENDER")
	if sender == "" {
		sender = os.Getenv("SMTP_USER")
	}

	payload := fmt.Sprintf(`{
		"sender": {"name": "Rate Shield", "email": "%s"},
		"to": [{"email": "%s"}],
		"subject": "%s",
		"htmlContent": %q
	}`, sender, to, subject, body)

	req, err := http.NewRequest("POST", "https://api.brevo.com/v3/smtp/email", strings.NewReader(payload))
	if err != nil {
		return err
	}
	req.Header.Set("api-key", apiKey)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 300 {
		return fmt.Errorf("brevo API error: status %d", resp.StatusCode)
	}
	return nil
}
