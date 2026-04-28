package api

import (
	"fmt"
	"net/http"
	"os"
	"strconv"

	"github.com/rs/zerolog/log"
	"github.com/salonisaroha/RateShield/limiter"
	redisClient "github.com/salonisaroha/RateShield/redis"
	"github.com/salonisaroha/RateShield/service"
)

type Server struct {
	port        int
	limiter     *limiter.Limiter
	fixedWindow *limiter.FixedWindowService
}

func NewServer(l *limiter.Limiter, fw *limiter.FixedWindowService) Server {
	return Server{
		port:        getPort(),
		limiter:     l,
		fixedWindow: fw,
	}
}

func (s Server) StartServer() error {
	log.Info().Msgf("Setting Up API endpoints in port: %d ✅", s.port)
	mux := http.NewServeMux()

	// Create a single shared Redis client for all route handlers
	sharedRedisClient, err := redisClient.NewRulesClient()
	if err != nil {
		log.Fatal().Err(err).Msg("unable to setup shared redis client")
	}

	s.rulesRoutes(mux, sharedRedisClient)
	s.auditRoutes(mux, sharedRedisClient)
	s.authRoutes(mux, sharedRedisClient)
	s.registerRateLimiterRoutes(mux)
	s.setupHome(mux)

	corsMux := s.setupCORS(mux)

	server := http.Server{
		Addr:    fmt.Sprintf(":%d", s.port),
		Handler: corsMux,
	}

	log.Info().Msg("Rate Shield running on port: " + fmt.Sprintf("%d", s.port) + " ✅")

	err = server.ListenAndServe()
	if err != nil {
		log.Err(err).Msg("unable to start server")
		return err
	}
	return nil
}

func (s Server) setupCORS(h http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, ip, endpoint")
		w.Header().Set("Access-Control-Expose-Headers", "rate-limit, rate-limit-remaining, rate-limit-window")

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}

		h.ServeHTTP(w, r)
	})
}

func (s Server) rulesRoutes(mux *http.ServeMux, redisRuleClient redisClient.RedisRuleClient) {
	auditClient := redisClient.NewAuditClient(redisRuleClient.(redisClient.RedisRules).GetClient())
	auditSvc := service.NewAuditService(auditClient)
	rulesSvc := service.NewRedisRulesService(redisRuleClient, auditSvc)
	rulesHandler := NewRulesAPIHandler(rulesSvc)

	mux.HandleFunc("/rule/list", rulesHandler.ListAllRules)
	mux.HandleFunc("/rule/add", rulesHandler.CreateOrUpdateRule)
	mux.HandleFunc("/rule/delete", rulesHandler.DeleteRule)
	mux.HandleFunc("/rule/search", rulesHandler.SearchRules)
}

func (s Server) auditRoutes(mux *http.ServeMux, redisRuleClient redisClient.RedisRuleClient) {
	auditClient := redisClient.NewAuditClient(redisRuleClient.(redisClient.RedisRules).GetClient())
	auditSvc := service.NewAuditService(auditClient)
	auditHandler := NewAuditAPIHandler(auditSvc)
	mux.HandleFunc("/audit/logs", auditHandler.ListAuditLogs)
}

func (s Server) registerRateLimiterRoutes(mux *http.ServeMux) {
	rateLimiterHandler := NewRateLimitHandler(s.limiter)
	mux.HandleFunc("/check-limit", rateLimiterHandler.CheckRateLimit)
}

func (s Server) authRoutes(mux *http.ServeMux, redisRuleClient redisClient.RedisRuleClient) {
	client := redisRuleClient.(redisClient.RedisRules).GetClient()
	authHandler := NewAuthAPIHandler(client)
	// IP-based rate limiting: protects against bot signups and brute force from same IP
	mux.HandleFunc("/auth/register", ipRateLimitMiddleware("/auth/register", s.fixedWindow, authHandler.Register))
	mux.HandleFunc("/auth/login", ipRateLimitMiddleware("/auth/login", s.fixedWindow, authHandler.Login))
	mux.HandleFunc("/auth/google", ipRateLimitMiddleware("/auth/google", s.fixedWindow, authHandler.GoogleLogin))
	// Email-based rate limiting: protects OTP endpoints per target email, not per IP
	mux.HandleFunc("/auth/verify-otp", emailRateLimitMiddleware("/auth/verify-otp", s.fixedWindow, authHandler.VerifyOTP))
	mux.HandleFunc("/auth/resend-otp", emailRateLimitMiddleware("/auth/resend-otp", s.fixedWindow, authHandler.ResendOTP))
	mux.HandleFunc("/auth/validate", authHandler.ValidateToken)
	mux.HandleFunc("/auth/logout", authHandler.Logout)
	mux.HandleFunc("/auth/google/callback", authHandler.GoogleCallback)

	statsHandler := NewStatsAPIHandler(redisRuleClient)
	mux.HandleFunc("/stats", statsHandler.GetStats)
}

func (s Server) setupHome(mux *http.ServeMux) {
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/" {
			http.NotFound(w, r)
			return
		}
		w.Header().Set("Content-Type", "text/html")
		wd, wdError := os.Getwd()
		homepage, err := os.ReadFile(wd + "/static/" + "index.html")
		if err != nil || wdError != nil {
			w.Write([]byte("Rate Shield is running. Open frontend client on port 5173."))
			return
		}
		fmt.Fprint(w, string(homepage))
	})
}

func getPort() int {
	port := os.Getenv("RATE_SHIELD_PORT")
	if len(port) == 0 {
		log.Fatal().Msg("RATE_SHIELD_PORT environment variable not provided in docker run command.")
	}

	portInt, err := strconv.Atoi(port)
	if err != nil {
		log.Fatal().Msg("Invalid port number provided.")
	}

	return portInt
}
