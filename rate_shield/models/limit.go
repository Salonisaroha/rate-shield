package models

type RateLimitResponse struct {
	RateLimit_Limit     int64
	RateLimit_Remaining int64
	RateLimit_Window    int
	Success             bool
	HTTPStatusCode      int
}
