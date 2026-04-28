package limiter

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
	"github.com/salonisaroha/RateShield/models"
	"github.com/salonisaroha/RateShield/utils"
)

var (
	ctx = context.Background()
)

type SlidingWindowService struct {
	redisClient *redis.Client
}

func NewSlidingWindowService(redisClient *redis.Client) SlidingWindowService {
	return SlidingWindowService{
		redisClient: redisClient,
	}
}

func (s *SlidingWindowService) processRequest(ip, endpoint string, rule *models.Rule) *models.RateLimitResponse {
	key := ip + ":" + endpoint

	now := time.Now().Unix()
	windowSize := time.Duration(rule.SlidingWindowCounterRule.WindowSize) * time.Second

	count, err := s.removeOldRequestsAndCountActiveRequests(key, now, windowSize)
	if err != nil {
		return utils.BuildRateLimitErrorResponse(500)
	}

	if count >= rule.SlidingWindowCounterRule.MaxRequests {
		return utils.BuildRateLimitErrorResponse(429)
	}

	err = s.updateWindow(key, now, windowSize)
	if err != nil {
		return utils.BuildRateLimitErrorResponse(500)
	}

	return utils.BuildRateLimitSuccessResponse(
		rule.SlidingWindowCounterRule.MaxRequests,
		rule.SlidingWindowCounterRule.MaxRequests-count-1,
		int(windowSize.Seconds()),
	)
}

func (s *SlidingWindowService) removeOldRequestsAndCountActiveRequests(key string, now int64, windowSize time.Duration) (int64, error) {
	windowStart := now - int64(windowSize.Seconds())

	pipe := s.redisClient.TxPipeline()
	// Remove entries strictly older than the window start (exclusive upper bound)
	pipe.ZRemRangeByScore(ctx, key, "0", fmt.Sprintf("(%d", windowStart))
	// Count entries within the window
	countCmd := pipe.ZCount(ctx, key, fmt.Sprintf("%d", windowStart), fmt.Sprintf("%d", now))

	_, err := pipe.Exec(ctx)
	if err != nil {
		return -1, err
	}

	count, err := countCmd.Result()
	if err != nil {
		return -1, err
	}
	return count, nil
}

func (s *SlidingWindowService) updateWindow(key string, now int64, windowSize time.Duration) error {
	pipe := s.redisClient.TxPipeline()

	pipe.ZAdd(ctx, key, redis.Z{
		Member: fmt.Sprintf("%d-%s", now, uuid.NewString()),
		Score:  float64(now),
	})

	pipe.Expire(ctx, key, windowSize)

	_, err := pipe.Exec(ctx)
	if err != nil {
		return err
	}

	return nil
}
