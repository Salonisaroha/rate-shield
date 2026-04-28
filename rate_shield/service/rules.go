package service

import (
	"errors"
	"strings"

	"github.com/rs/zerolog/log"
	"github.com/salonisaroha/RateShield/models"
	redisClient "github.com/salonisaroha/RateShield/redis"
)

const (
	redisChannel = "rules-update"
)

type RulesService interface {
	GetAllRules(userEmail string) ([]models.Rule, error)
	GetPaginatedRules(page, items int, userEmail string) (models.PaginatedRules, error)
	GetRule(key string) (*models.Rule, bool, error)
	SearchRule(searchText string, userEmail string) ([]models.Rule, error)
	CreateOrUpdateRule(rule models.Rule, actor, ipAddress, userAgent string, userEmail string) error
	DeleteRule(endpoint, actor, ipAddress, userAgent string, userEmail string) error
	CacheRulesLocally() *map[string]*models.Rule
	ListenToRulesUpdate(updatesChannel chan string)
}

type RulesServiceRedis struct {
	redisClient redisClient.RedisRuleClient
	auditSvc    AuditService
}

func NewRedisRulesService(client redisClient.RedisRuleClient, auditSvc AuditService) RulesServiceRedis {
	return RulesServiceRedis{
		redisClient: client,
		auditSvc:    auditSvc,
	}
}

// userRuleKey returns a per-user namespaced Redis key: "user:<email>:<endpoint>"
func userRuleKey(userEmail, endpoint string) string {
	return "user:" + userEmail + ":" + endpoint
}

// userRulePrefix returns the scan prefix for a user's rules
func userRulePrefix(userEmail string) string {
	return "user:" + userEmail + ":"
}

func (s RulesServiceRedis) GetRule(key string) (*models.Rule, bool, error) {
	return s.redisClient.GetRule(key)
}

func (s RulesServiceRedis) GetAllRules(userEmail string) ([]models.Rule, error) {
	keys, _, err := s.redisClient.GetAllRuleKeys(userRulePrefix(userEmail))
	if err != nil {
		log.Err(err).Msg("unable to get all rule keys from redis")
	}

	rules := []models.Rule{}
	for _, key := range keys {
		rule, found, err := s.redisClient.GetRule(key)
		if err != nil {
			log.Err(err).Msgf("unable to get rule from redis for key: %s", key)
			continue
		}
		if !found {
			continue
		}
		rules = append(rules, *rule)
	}
	return rules, nil
}

func (s RulesServiceRedis) SearchRule(searchText string, userEmail string) ([]models.Rule, error) {
	rules, err := s.GetAllRules(userEmail)
	if err != nil {
		return nil, err
	}
	searchedRules := []models.Rule{}
	for _, rule := range rules {
		if strings.Contains(rule.APIEndpoint, searchText) {
			searchedRules = append(searchedRules, rule)
		}
	}
	return searchedRules, nil
}

func (s RulesServiceRedis) CreateOrUpdateRule(rule models.Rule, actor, ipAddress, userAgent string, userEmail string) error {
	redisKey := userRuleKey(userEmail, rule.APIEndpoint)

	existingRule, found, err := s.redisClient.GetRule(redisKey)
	var action string
	var oldRule *models.Rule
	if found && err == nil {
		action = models.AuditActionUpdate
		oldRule = existingRule
	} else {
		action = models.AuditActionCreate
		oldRule = nil
	}

	if err := s.redisClient.SetRule(redisKey, rule); err != nil {
		log.Err(err).Msg("unable to create or update rule")
		return err
	}

	if s.auditSvc != nil {
		if auditErr := s.auditSvc.LogRuleChange(actor, action, rule.APIEndpoint, oldRule, &rule, ipAddress, userAgent); auditErr != nil {
			log.Warn().Err(auditErr).Msg("failed to log audit event")
		}
	}
	return s.redisClient.PublishMessage(redisChannel, "UpdateRules")
}

func (s RulesServiceRedis) DeleteRule(endpoint, actor, ipAddress, userAgent string, userEmail string) error {
	redisKey := userRuleKey(userEmail, endpoint)

	existingRule, found, err := s.redisClient.GetRule(redisKey)
	if !found || err != nil {
		log.Warn().Str("endpoint", endpoint).Msg("rule not found for deletion")
	}

	if err := s.redisClient.DeleteRule(redisKey); err != nil {
		log.Err(err).Msg("unable to delete rule")
		return err
	}

	if s.auditSvc != nil && existingRule != nil {
		if auditErr := s.auditSvc.LogRuleChange(actor, models.AuditActionDelete, endpoint, existingRule, nil, ipAddress, userAgent); auditErr != nil {
			log.Warn().Err(auditErr).Msg("failed to log audit event")
		}
	}
	return s.redisClient.PublishMessage(redisChannel, "UpdateRules")
}

func (s RulesServiceRedis) CacheRulesLocally() *map[string]*models.Rule {
	// CacheRulesLocally is used by the rate limiter engine which works across all users.
	// It scans all user-namespaced rule keys and caches them by their full Redis key.
	keys, _, err := s.redisClient.GetAllRuleKeys("user:")
	if err != nil {
		log.Err(err).Msg("Unable to cache all rules locally")
	}

	cachedRules := make(map[string]*models.Rule)
	for _, key := range keys {
		rule, found, err := s.redisClient.GetRule(key)
		if err != nil || !found {
			continue
		}
		r := *rule
		cachedRules[key] = &r
	}

	log.Info().Msg("Rules locally cached ✅")
	return &cachedRules
}

func (s RulesServiceRedis) ListenToRulesUpdate(updatesChannel chan string) {
	s.redisClient.ListenToRulesUpdate(updatesChannel)
}

func (s RulesServiceRedis) GetPaginatedRules(page, items int, userEmail string) (models.PaginatedRules, error) {
	allRules, err := s.GetAllRules(userEmail)
	if err != nil {
		log.Err(err).Msgf("unable to get rules from redis")
		return models.PaginatedRules{}, err
	}

	if len(allRules) == 0 {
		return models.PaginatedRules{
			PageNumber:  1,
			TotalItems:  0,
			HasNextPage: false,
			Rules:       make([]models.Rule, 0),
		}, nil
	}

	start := (page - 1) * items
	stop := start + items

	if start >= len(allRules) {
		return models.PaginatedRules{}, errors.New("invalid page number")
	}

	hasNextPage := stop < len(allRules)

	if stop >= len(allRules) {
		stop = len(allRules)
	}

	paginatedSlice := allRules[start:stop]

	rules := models.PaginatedRules{
		PageNumber:  page,
		TotalItems:  stop - start,
		HasNextPage: hasNextPage,
		Rules:       paginatedSlice,
	}

	return rules, nil
}
