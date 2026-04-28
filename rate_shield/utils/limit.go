package utils

import (
	"net/http"

	"github.com/salonisaroha/RateShield/models"
)

func BuildRateLimitErrorResponse(statusCode int) *models.RateLimitResponse {
	return &models.RateLimitResponse{
		RateLimit_Limit:     -1,
		RateLimit_Remaining: -1,
		Success:             false,
		HTTPStatusCode:      statusCode,
	}
}

func BuildRateLimitSuccessResponse(limit, remaining int64, window int) *models.RateLimitResponse {
	return &models.RateLimitResponse{
		RateLimit_Limit:     limit,
		RateLimit_Remaining: remaining,
		RateLimit_Window:    window,
		Success:             true,
		HTTPStatusCode:      http.StatusOK,
	}
}
