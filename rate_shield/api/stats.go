package api

import (
	"net/http"

	redisClient "github.com/salonisaroha/RateShield/redis"
	"github.com/salonisaroha/RateShield/utils"
)

type StatsAPIHandler struct {
	rulesClient redisClient.RedisRuleClient
}

func NewStatsAPIHandler(client redisClient.RedisRuleClient) StatsAPIHandler {
	return StatsAPIHandler{rulesClient: client}
}

func (h StatsAPIHandler) GetStats(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		utils.MethodNotAllowedError(w)
		return
	}

	keys, _, err := h.rulesClient.GetAllRuleKeys("user:")
	totalRules := 0
	if err == nil {
		totalRules = len(keys)
	}

	utils.SuccessResponse(map[string]int{"total_rules": totalRules}, w)
}
