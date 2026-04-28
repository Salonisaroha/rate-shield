package api

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"

	"github.com/salonisaroha/RateShield/limiter"
	"github.com/salonisaroha/RateShield/models"
)

// --- Rate limit rules ---


var ipRateLimitRules = map[string]models.Rule{
	"/auth/register": {
		Strategy:    "FIXED WINDOW COUNTER",
		APIEndpoint: "/auth/register",
		HTTPMethod:  "POST",
		FixedWindowCounterRule: &models.FixedWindowCounterRule{
			MaxRequests: 5,
			Window:      60, 
		},
	},
	"/auth/login": {
		Strategy:    "FIXED WINDOW COUNTER",
		APIEndpoint: "/auth/login",
		HTTPMethod:  "POST",
		FixedWindowCounterRule: &models.FixedWindowCounterRule{
			MaxRequests: 5,
			Window:      60, 
		},
	},
	"/auth/google": {
		Strategy:    "FIXED WINDOW COUNTER",
		APIEndpoint: "/auth/google",
		HTTPMethod:  "GET",
		FixedWindowCounterRule: &models.FixedWindowCounterRule{
			MaxRequests: 10,
			Window:      60, 
		},
	},
}

// emailRateLimitRules: keyed by endpoint, identifier = email from request body
var emailRateLimitRules = map[string]models.Rule{
	"/auth/verify-otp": {
		Strategy:    "FIXED WINDOW COUNTER",
		APIEndpoint: "/auth/verify-otp",
		HTTPMethod:  "POST",
		FixedWindowCounterRule: &models.FixedWindowCounterRule{
			MaxRequests: 5,
			Window:      600, 
		},
	},
	"/auth/resend-otp": {
		Strategy:    "FIXED WINDOW COUNTER",
		APIEndpoint: "/auth/resend-otp",
		HTTPMethod:  "POST",
		FixedWindowCounterRule: &models.FixedWindowCounterRule{
			MaxRequests: 3,
			Window:      600, 
		},
	},
}

// --- Shared response helper ---

func writeTooManyRequests(w http.ResponseWriter, window int) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Retry-After", fmt.Sprintf("%d", window))
	w.WriteHeader(http.StatusTooManyRequests)
	w.Write([]byte(fmt.Sprintf(
		`{"status":"fail","message":"Too many requests. Please try again in %d seconds."}`,
		window,
	)))
}

func writeRateLimiterError(w http.ResponseWriter) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusInternalServerError)
	w.Write([]byte(`{"status":"fail","message":"Rate limiter error."}`))
}



func ipRateLimitMiddleware(endpoint string, fw *limiter.FixedWindowService, next http.HandlerFunc) http.HandlerFunc {
	rule, ok := ipRateLimitRules[endpoint]
	if !ok {
		return next
	}

	return func(w http.ResponseWriter, r *http.Request) {
		ip := extractIPAddress(r)
		resp := fw.ProcessRequest(ip, endpoint, &rule)

		if !resp.Success {
			if resp.HTTPStatusCode == 429 {
				writeTooManyRequests(w, rule.FixedWindowCounterRule.Window)
			} else {
				writeRateLimiterError(w)
			}
			return
		}

		next(w, r)
	}
}

// --- Email-based middleware ---
// Used for: /auth/verify-otp, /auth/resend-otp
// Identifier: email address from request body
// The body is read, parsed for email, then restored so the actual handler can read it again.

func emailRateLimitMiddleware(endpoint string, fw *limiter.FixedWindowService, next http.HandlerFunc) http.HandlerFunc {
	rule, ok := emailRateLimitRules[endpoint]
	if !ok {
		return next
	}

	return func(w http.ResponseWriter, r *http.Request) {
		// Read body
		bodyBytes, err := io.ReadAll(r.Body)
		if err != nil {
			writeRateLimiterError(w)
			return
		}
		// Restore body so the actual handler can read it
		r.Body = io.NopCloser(bytes.NewBuffer(bodyBytes))

		// Extract email from body
		var payload struct {
			Email string `json:"email"`
		}
		if err := json.Unmarshal(bodyBytes, &payload); err != nil || payload.Email == "" {
			
			next(w, r)
			return
		}

		
		resp := fw.ProcessRequest(payload.Email, endpoint, &rule)

		if !resp.Success {
			if resp.HTTPStatusCode == 429 {
				writeTooManyRequests(w, rule.FixedWindowCounterRule.Window)
			} else {
				writeRateLimiterError(w)
			}
			return
		}

		next(w, r)
	}
}
