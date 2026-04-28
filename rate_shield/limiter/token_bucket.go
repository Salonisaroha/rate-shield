package limiter

import (
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/rs/zerolog/log"
	"github.com/salonisaroha/RateShield/models"
	redisClient "github.com/salonisaroha/RateShield/redis"
	"github.com/salonisaroha/RateShield/service"
	"github.com/salonisaroha/RateShield/utils"
)

const (
	BucketExpireTime = time.Second * 60
)

type TokenBucketService struct {
	redisClient          redisClient.RedisRateLimiterClient
	errorNotificationSVC service.ErrorNotificationSVC
}

func NewTokenBucketService(client redisClient.RedisRateLimiterClient, errorNotificationSVC service.ErrorNotificationSVC) TokenBucketService {
	return TokenBucketService{
		redisClient:          client,
		errorNotificationSVC: errorNotificationSVC,
	}
}

func (t *TokenBucketService) addTokensToBucket(key string) {
	bucket, found, err := t.getBucket(key)
	if err != nil {
		t.sendGetBucketErrorNotification(key, err)
		return
	}

	if !found {
		return
	}

	// How many seconds have passed since last refill
	refilledAgo := time.Since(bucket.LastRefill).Seconds()

	if refilledAgo >= float64(bucket.RetentionTime) {
		// Remove bucket from redis
		err := t.redisClient.Delete(key)
		if err != nil {
			t.sendDeleteBucketErrorNotification(key, bucket, err)
		}

		return
	}

	if bucket.AvailableTokens < bucket.Capacity {
		tokensToAdd := bucket.Capacity - bucket.AvailableTokens

		if tokensToAdd > 0 {
			bucket.AvailableTokens += min(bucket.TokenAddRate, tokensToAdd)
			bucket.LastRefill = time.Now()

			if err := t.redisClient.JSONSet(key, bucket); err != nil {
				t.sendSetBucketErrorNotification(key, bucket, err)
			}
		}
	}
}

func (t *TokenBucketService) createBucket(ip, endpoint string, capacity, tokenAddRate int, retentionTime int16) (*models.Bucket, error) {
	if err := utils.ValidateCreateBucketReq(ip, endpoint, capacity, tokenAddRate); err != nil {
		return nil, err
	}

	b := &models.Bucket{
		ClientIP:        ip,
		CreatedAt:       time.Now().Unix(),
		Capacity:        capacity,
		AvailableTokens: capacity,
		Endpoint:        endpoint,
		TokenAddRate:    tokenAddRate,
		LastRefill:      time.Now(),
		RetentionTime:   retentionTime,
	}

	err := t.saveBucket(b, true)
	if err != nil {
		return nil, err
	}

	return b, nil
}

func (t *TokenBucketService) createBucketFromRule(ip, endpoint string, rule *models.Rule) (*models.Bucket, error) {
	b, err := t.createBucket(ip, endpoint, int(rule.TokenBucketRule.BucketCapacity), int(rule.TokenBucketRule.TokenAddRate), rule.TokenBucketRule.RetentionTime)
	if err != nil {
		return nil, err
	}
	return b, nil
}

func parseKey(key string) (string, string, error) {
	parts := strings.Split(key, ":")
	if len(parts) != 2 {
		return "", "", errors.New("invalid token bucket key")
	}

	return parts[0], parts[1], nil
}

func (t *TokenBucketService) spawnNewBucket(key string, rule *models.Rule) (*models.Bucket, error) {
	ip, endpoint, err := parseKey(key)
	if err != nil {
		return nil, err
	}

	return t.createBucketFromRule(ip, endpoint, rule)
}

func (t *TokenBucketService) getBucket(key string) (*models.Bucket, bool, error) {
	key = "token_bucket_" + key
	data, found, err := t.redisClient.JSONGet(key)
	if err != nil {
		log.Error().Err(err).Msg("Error fetching bucket from Redis")
		return nil, false, err
	}

	if !found {
		return nil, false, nil
	}

	tokenBucket, err := utils.Unmarshal[models.Bucket]([]byte(data))
	if err != nil {
		return nil, false, err
	}

	return &tokenBucket, true, nil
}


func (t *TokenBucketService) processRequest(key string, rule *models.Rule) *models.RateLimitResponse {
	bucket, found, err := t.getBucket(key)
	if err != nil {
		log.Error().Err(err).Msg("error while getting bucket " + key)
		return utils.BuildRateLimitErrorResponse(500)
	}

	if !found {
		b, err := t.spawnNewBucket(key, rule)
		if err != nil {
			return utils.BuildRateLimitErrorResponse(500)
		}
		// First request: bucket created with full capacity, consume 1 token now
		b.AvailableTokens--
		if err := t.saveBucket(b, false); err != nil {
			return utils.BuildRateLimitErrorResponse(500)
		}
		return &models.RateLimitResponse{
			RateLimit_Limit:     int64(b.Capacity),
			RateLimit_Remaining: int64(b.AvailableTokens),
			Success:             true,
			HTTPStatusCode:      http.StatusOK,
		}
	}

	// Refill tokens based on elapsed time since last refill
	elapsed := time.Since(bucket.LastRefill).Seconds()
	if elapsed >= 1 && bucket.AvailableTokens < bucket.Capacity {
		tokensToAdd := int(elapsed) * bucket.TokenAddRate
		bucket.AvailableTokens = min(bucket.Capacity, bucket.AvailableTokens+tokensToAdd)
		bucket.LastRefill = time.Now()
	}

	if bucket.AvailableTokens <= 0 {
		return utils.BuildRateLimitErrorResponse(429)
	}

	bucket.AvailableTokens--

	if err := t.saveBucket(bucket, false); err != nil {
		return utils.BuildRateLimitErrorResponse(500)
	}

	return &models.RateLimitResponse{
		RateLimit_Limit:     int64(bucket.Capacity),
		RateLimit_Remaining: int64(bucket.AvailableTokens),
		Success:             true,
		HTTPStatusCode:      http.StatusOK,
	}
}

func (t *TokenBucketService) saveBucket(bucket *models.Bucket, isNewBucket bool) error {
	key := "token_bucket_" + bucket.ClientIP + ":" + bucket.Endpoint
	if err := t.redisClient.JSONSet(key, bucket); err != nil {
		log.Error().Err(err).Msg("Error saving new bucket to Redis")
		return err
	}

	if isNewBucket {
		expiration := time.Duration(bucket.RetentionTime) * time.Second
		if err := t.redisClient.Expire(key, expiration); err != nil {
			log.Error().Err(err).Msg("Failed to set TTL on bucket key")
			return err
		}
	}

	return nil
}

func (t *TokenBucketService) sendGetBucketErrorNotification(key string, err error) {
	customError := fmt.Sprintf("Unable to get bucket with key: %s got error: %s", key, err.Error())
	t.errorNotificationSVC.SendErrorNotification(customError, time.Now(), "Nil", "Nil", models.Rule{})
	log.Error().Err(err).Msg("Error fetching bucket")
}

func (t *TokenBucketService) sendSetBucketErrorNotification(key string, bucket *models.Bucket, err error) {
	customError := fmt.Sprintf("Unable save bucket with key: %s and data: %+v got error: %s", key, bucket, err.Error())
	t.errorNotificationSVC.SendErrorNotification(customError, time.Now(), "Nil", "Nil", models.Rule{})
	log.Error().Err(err).Msg("Error saving updated bucket to Redis")
}

func (t *TokenBucketService) sendDeleteBucketErrorNotification(key string, bucket *models.Bucket, err error) {
	customError := fmt.Sprintf("Unable save bucket with key: %s and data: %+v got error: %s", key, bucket, err.Error())
	t.errorNotificationSVC.SendErrorNotification(customError, time.Now(), "Nil", "Nil", models.Rule{})
	log.Error().Err(err).Msg("Error saving updated bucket to Redis")
}
