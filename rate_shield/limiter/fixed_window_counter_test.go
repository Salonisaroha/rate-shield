package limiter

import (
	"encoding/json"
	"errors"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/salonisaroha/RateShield/models"
)

type MockRedisFixedWindowClient struct {
	mock.Mock
}

func (m *MockRedisFixedWindowClient) JSONGet(key string) (string, bool, error) {
	args := m.Called(key)
	return args.String(0), args.Bool(1), args.Error(2)
}

func (m *MockRedisFixedWindowClient) JSONSet(key string, value interface{}) error {
	args := m.Called(key, value)
	return args.Error(0)
}

func (m *MockRedisFixedWindowClient) Expire(key string, expiration time.Duration) error {
	args := m.Called(key, expiration)
	return args.Error(0)
}

func (m *MockRedisFixedWindowClient) Delete(key string) error {
	args := m.Called(key)
	return args.Error(0)
}

func makeRule(maxRequests int64, window int) *models.Rule {
	return &models.Rule{
		FixedWindowCounterRule: &models.FixedWindowCounterRule{
			MaxRequests: maxRequests,
			Window:      window,
		},
	}
}

func TestProcessRequest(t *testing.T) {
	mockRedis := new(MockRedisFixedWindowClient)
	service := NewFixedWindowService(mockRedis)

	t.Run("New window creation returns 200", func(t *testing.T) {
		mockRedis.ExpectedCalls = nil
		mockRedis.Calls = nil

		mockRedis.On("JSONGet", mock.Anything).Return("", false, nil)
		mockRedis.On("JSONSet", mock.Anything, mock.Anything).Return(nil)
		mockRedis.On("Expire", mock.Anything, mock.Anything).Return(nil)

		response := service.ProcessRequest("192.168.1.1", "/test", makeRule(10, 60))

		assert.Equal(t, 200, response.HTTPStatusCode)
		assert.Equal(t, int64(9), response.RateLimit_Remaining)
		mockRedis.AssertExpectations(t)
	})

	t.Run("Existing window within limit returns 200", func(t *testing.T) {
		mockRedis.ExpectedCalls = nil
		mockRedis.Calls = nil

		fixedWindow := &models.FixedWindowCounter{
			MaxRequests:    10,
			CurrRequests:   5,
			Window:         60,
			CreatedAt:      time.Now().Unix() - 10, // 10s into a 60s window
			LastAccessTime: time.Now().Unix() - 1,
		}
		windowStr, _ := json.Marshal(fixedWindow)

		mockRedis.On("JSONGet", mock.Anything).Return(string(windowStr), true, nil)
		mockRedis.On("JSONSet", mock.Anything, mock.Anything).Return(nil)

		response := service.ProcessRequest("192.168.1.2", "/test", makeRule(10, 60))

		assert.Equal(t, 200, response.HTTPStatusCode)
		assert.Equal(t, int64(4), response.RateLimit_Remaining)
		mockRedis.AssertExpectations(t)
	})

	t.Run("Existing window at limit returns 429", func(t *testing.T) {
		mockRedis.ExpectedCalls = nil
		mockRedis.Calls = nil

		fixedWindow := &models.FixedWindowCounter{
			MaxRequests:    10,
			CurrRequests:   10,
			Window:         60,
			CreatedAt:      time.Now().Unix() - 10,
			LastAccessTime: time.Now().Unix() - 1,
		}
		windowStr, _ := json.Marshal(fixedWindow)

		mockRedis.On("JSONGet", mock.Anything).Return(string(windowStr), true, nil)

		response := service.ProcessRequest("192.168.1.3", "/test", makeRule(10, 60))

		assert.Equal(t, 429, response.HTTPStatusCode)
		mockRedis.AssertExpectations(t)
	})

	t.Run("Window expired (key not found) spawns new window and returns 200", func(t *testing.T) {
		mockRedis.ExpectedCalls = nil
		mockRedis.Calls = nil

		// Redis TTL expired — key not found, new window spawned
		mockRedis.On("JSONGet", mock.Anything).Return("", false, nil)
		mockRedis.On("JSONSet", mock.Anything, mock.Anything).Return(nil)
		mockRedis.On("Expire", mock.Anything, mock.Anything).Return(nil)

		response := service.ProcessRequest("192.168.1.4", "/test", makeRule(10, 60))

		assert.Equal(t, 200, response.HTTPStatusCode)
		assert.Equal(t, int64(9), response.RateLimit_Remaining)
		mockRedis.AssertExpectations(t)
	})

	t.Run("Redis error returns 500", func(t *testing.T) {
		mockRedis.ExpectedCalls = nil
		mockRedis.Calls = nil

		mockRedis.On("JSONGet", mock.Anything).Return("", false, errors.New("redis connection error"))

		response := service.ProcessRequest("192.168.1.5", "/test", makeRule(10, 60))

		assert.Equal(t, 500, response.HTTPStatusCode)
		mockRedis.AssertExpectations(t)
	})
}

func TestSpawnNewFixedWindow(t *testing.T) {
	mockRedis := new(MockRedisFixedWindowClient)
	service := NewFixedWindowService(mockRedis)

	t.Run("Successful new window creation", func(t *testing.T) {
		mockRedis.ExpectedCalls = nil
		mockRedis.Calls = nil

		mockRedis.On("JSONSet", mock.Anything, mock.Anything).Return(nil)
		mockRedis.On("Expire", mock.Anything, mock.Anything).Return(nil)

		fixedWindow, err := service.spawnNewFixedWindow("192.168.1.6", "/test", makeRule(10, 60))

		assert.NoError(t, err)
		assert.NotNil(t, fixedWindow)
		assert.Equal(t, "/test", fixedWindow.Endpoint)
		assert.Equal(t, "192.168.1.6", fixedWindow.ClientIP)
		assert.Equal(t, int64(10), fixedWindow.MaxRequests)
		assert.Equal(t, int64(1), fixedWindow.CurrRequests)
		assert.Equal(t, 60, fixedWindow.Window)
		mockRedis.AssertExpectations(t)
	})

	t.Run("Redis JSONSet error returns error", func(t *testing.T) {
		mockRedis.ExpectedCalls = nil
		mockRedis.Calls = nil

		expectedError := errors.New("redis JSONSet error")
		mockRedis.On("JSONSet", mock.Anything, mock.Anything).Return(expectedError)

		fixedWindow, err := service.spawnNewFixedWindow("192.168.1.7", "/test", makeRule(10, 60))

		assert.Error(t, err)
		assert.Nil(t, fixedWindow)
		assert.Equal(t, expectedError, err)
		mockRedis.AssertExpectations(t)
	})

	t.Run("Redis Expire error returns error", func(t *testing.T) {
		mockRedis.ExpectedCalls = nil
		mockRedis.Calls = nil

		mockRedis.On("JSONSet", mock.Anything, mock.Anything).Return(nil)
		expectedError := errors.New("redis Expire error")
		mockRedis.On("Expire", mock.Anything, mock.Anything).Return(expectedError)

		fixedWindow, err := service.spawnNewFixedWindow("192.168.1.8", "/test", makeRule(10, 60))

		assert.Error(t, err)
		assert.Nil(t, fixedWindow)
		assert.Equal(t, expectedError, err)
		mockRedis.AssertExpectations(t)
	})
}
