package api

import (
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"github.com/salonisaroha/RateShield/models"
	"github.com/salonisaroha/RateShield/service"
	"github.com/salonisaroha/RateShield/utils"
)

type RulesAPIHandler struct {
	rulesSvc service.RulesService
}

func NewRulesAPIHandler(svc service.RulesService) RulesAPIHandler {
	return RulesAPIHandler{
		rulesSvc: svc,
	}
}

// extractIPAddress extracts the client IP address from the request
func extractIPAddress(r *http.Request) string {
	// Check for X-Forwarded-For header (common with proxies/load balancers)
	xff := r.Header.Get("X-Forwarded-For")
	if xff != "" {
		// X-Forwarded-For can contain multiple IPs, take the first one
		ips := strings.Split(xff, ",")
		if len(ips) > 0 {
			return strings.TrimSpace(ips[0])
		}
	}

	// Check for X-Real-IP header
	realIP := r.Header.Get("X-Real-IP")
	if realIP != "" {
		return realIP
	}

	// Fall back to RemoteAddr
	// RemoteAddr includes port, so we need to strip it
	ip := r.RemoteAddr
	if idx := strings.LastIndex(ip, ":"); idx != -1 {
		ip = ip[:idx]
	}
	return ip
}

// extractEmailFromJWT parses the JWT from Authorization header and returns the email (sub claim)
func extractEmailFromJWT(r *http.Request) (string, error) {
	authHeader := r.Header.Get("Authorization")
	if !strings.HasPrefix(authHeader, "Bearer ") {
		return "", fmt.Errorf("missing token")
	}
	tokenStr := strings.TrimPrefix(authHeader, "Bearer ")
	claims, err := parseJWT(tokenStr)
	if err != nil {
		return "", err
	}
	email, ok := claims["sub"].(string)
	if !ok || email == "" {
		return "", fmt.Errorf("invalid token claims")
	}
	return email, nil
}

func (h RulesAPIHandler) ListAllRules(w http.ResponseWriter, r *http.Request) {
	email, err := extractEmailFromJWT(r)
	if err != nil {
		utils.JSONError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	page := r.URL.Query().Get("page")
	items := r.URL.Query().Get("items")

	if page != "" && items != "" {
		pageInt, pageIntErr := strconv.Atoi(page)
		itemsInt, itemsIntErr := strconv.Atoi(items)
		if pageIntErr != nil || itemsIntErr != nil {
			utils.BadRequestError(w)
			return
		}
		rules, err := h.rulesSvc.GetPaginatedRules(pageInt, itemsInt, email)
		if err != nil {
			utils.InternalError(w, err.Error())
			return
		}
		utils.SuccessResponse(rules, w)
	} else {
		rules, err := h.rulesSvc.GetAllRules(email)
		if err != nil {
			utils.InternalError(w, err.Error())
			return
		}
		utils.SuccessResponse(rules, w)
	}
}

func (h RulesAPIHandler) SearchRules(w http.ResponseWriter, r *http.Request) {
	email, err := extractEmailFromJWT(r)
	if err != nil {
		utils.JSONError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}
	searchText := r.URL.Query().Get("endpoint")
	if len(searchText) == 0 {
		utils.BadRequestError(w)
		return
	}
	rules, err := h.rulesSvc.SearchRule(searchText, email)
	if err != nil {
		utils.InternalError(w, err.Error())
		return
	}
	utils.SuccessResponse(rules, w)
}

func (h RulesAPIHandler) CreateOrUpdateRule(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusNoContent)
		return
	}
	if r.Method != http.MethodPost {
		utils.MethodNotAllowedError(w)
		return
	}

	email, err := extractEmailFromJWT(r)
	if err != nil {
		utils.JSONError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	updateReq, err := utils.ParseAPIBody[models.Rule](r)
	if err != nil {
		utils.BadRequestError(w)
		return
	}

	actor := email
	ipAddress := extractIPAddress(r)
	userAgent := r.UserAgent()

	if err := h.rulesSvc.CreateOrUpdateRule(updateReq, actor, ipAddress, userAgent, email); err != nil {
		utils.InternalError(w, err.Error())
		return
	}
	utils.SuccessResponse("Rule Created Successfully", w)
}

func (h RulesAPIHandler) DeleteRule(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		utils.MethodNotAllowedError(w)
		return
	}

	email, err := extractEmailFromJWT(r)
	if err != nil {
		utils.JSONError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	deleteReq, err := utils.ParseAPIBody[models.DeleteRuleDTO](r)
	if err != nil {
		utils.BadRequestError(w)
		return
	}

	actor := email
	ipAddress := extractIPAddress(r)
	userAgent := r.UserAgent()

	if err := h.rulesSvc.DeleteRule(deleteReq.RuleKey, actor, ipAddress, userAgent, email); err != nil {
		utils.InternalError(w, err.Error())
		return
	}
	utils.SuccessResponse("Rule Deleted Successfully", w)
}
