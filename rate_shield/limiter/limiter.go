package limiter

import (
	"strings"
	"sync"

	"github.com/rs/zerolog/log"
	"github.com/salonisaroha/RateShield/models"
	"github.com/salonisaroha/RateShield/service"
	"github.com/salonisaroha/RateShield/utils"
)

type Limiter struct {
	tokenBucket   *TokenBucketService
	fixedWindow   *FixedWindowService
	slidingWindow *SlidingWindowService
	redisRuleSvc  service.RulesService
	cachedRules   *map[string]*models.Rule
	rulesMutex    sync.RWMutex
}

func NewRateLimiterService(
	tokenBucket *TokenBucketService, fixedWindow *FixedWindowService, slidingWindow *SlidingWindowService, redisRuleSvc service.RulesService) Limiter {

	return Limiter{
		tokenBucket:   tokenBucket,
		fixedWindow:   fixedWindow,
		redisRuleSvc:  redisRuleSvc,
		slidingWindow: slidingWindow,
		cachedRules:   nil,
		rulesMutex:    sync.RWMutex{},
	}
}

func (l *Limiter) CheckLimit(ip, endpoint string) *models.RateLimitResponse {
	key := ip + ":" + endpoint

	l.rulesMutex.RLock()
	rulesMap := *l.cachedRules
	l.rulesMutex.RUnlock()

	// Rules are cached by full Redis key "user:<email>:<endpoint>".
	// Match by splitting on the last colon to extract the stored endpoint exactly,
	// preventing suffix collisions (e.g. /api/v1 matching /api/v1/users).
	var rule *models.Rule
	var found bool
	for k, r := range rulesMap {
		idx := strings.LastIndex(k, ":")
		if idx != -1 && k[idx+1:] == endpoint {
			rule = r
			found = true
			break
		}
	}

	if found {
		switch rule.Strategy {
		case "TOKEN BUCKET":
			return l.processTokenBucketReq(key, rule)
		case "FIXED WINDOW COUNTER":
			return l.processFixedWindowReq(ip, endpoint, rule)
		case "SLIDING WINDOW COUNTER":
			return l.processSlidingWindowReq(ip, endpoint, rule)
		}
	}

	return utils.BuildRateLimitSuccessResponse(0, 0, 0)
}

func (l *Limiter) processTokenBucketReq(key string, rule *models.Rule) *models.RateLimitResponse {
	resp := l.tokenBucket.processRequest(key, rule)

	if resp.Success {
		return resp
	}

	if rule.AllowOnError && resp.HTTPStatusCode == 500 {
		return utils.BuildRateLimitSuccessResponse(0, 0, 0)
	}

	return resp
}

func (l *Limiter) processFixedWindowReq(ip, endpoint string, rule *models.Rule) *models.RateLimitResponse {
	resp := l.fixedWindow.ProcessRequest(ip, endpoint, rule)

	if resp.Success {
		return resp
	}

	if rule.AllowOnError && resp.HTTPStatusCode == 500 {
		return utils.BuildRateLimitSuccessResponse(0, 0, 0)
	}

	return resp
}

func (l *Limiter) processSlidingWindowReq(ip, endpoint string, rule *models.Rule) *models.RateLimitResponse {
	resp := l.slidingWindow.processRequest(ip, endpoint, rule)

	if resp.Success {
		return resp
	}

	if rule.AllowOnError && resp.HTTPStatusCode == 500 {
		return utils.BuildRateLimitSuccessResponse(0, 0, 0)
	}

	return resp
}

func (l *Limiter) GetRule(key string) (*models.Rule, bool, error) {
	return l.redisRuleSvc.GetRule(key)
}

func (l *Limiter) StartRateLimiter() {
	log.Info().Msg("Starting limiter service ✅")
	l.cachedRules = l.redisRuleSvc.CacheRulesLocally()
	log.Info().Msgf("Total Rules: %d", len(*l.cachedRules))
	go l.listenToRulesUpdate()
}

func (l *Limiter) listenToRulesUpdate() {
	updatesChannel := make(chan string)
	go l.redisRuleSvc.ListenToRulesUpdate(updatesChannel)

	for {
		data := <-updatesChannel

		if data == "UpdateRules" {
			l.rulesMutex.Lock()
			l.cachedRules = l.redisRuleSvc.CacheRulesLocally()
			l.rulesMutex.Unlock()

			log.Info().Msg("Rules Updated Successfully")
		}
	}
}
