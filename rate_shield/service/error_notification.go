package service

import (
	"fmt"
	"sync"
	"time"

	"github.com/salonisaroha/RateShield/models"
	"github.com/salonisaroha/RateShield/utils"
)

const notificationCooldown = 30 * time.Second

type notificationEntry struct {
	sentAt time.Time
}

type ErrorNotificationSVC struct {
	slackSVC            SlackService
	mu                  sync.Mutex
	notificationHistory map[string]notificationEntry
}

func NewErrorNotificationSVC(slackService SlackService) ErrorNotificationSVC {
	svc := ErrorNotificationSVC{
		slackSVC:            slackService,
		notificationHistory: make(map[string]notificationEntry),
	}
	go svc.evictExpiredEntries()
	return svc
}

// evictExpiredEntries periodically removes entries older than the cooldown to prevent unbounded growth.
func (e *ErrorNotificationSVC) evictExpiredEntries() {
	ticker := time.NewTicker(5 * time.Minute)
	defer ticker.Stop()
	for range ticker.C {
		e.mu.Lock()
		for key, entry := range e.notificationHistory {
			if time.Since(entry.sentAt) > notificationCooldown*10 {
				delete(e.notificationHistory, key)
			}
		}
		e.mu.Unlock()
	}
}

func (e *ErrorNotificationSVC) SendErrorNotification(systemError string, timestamp time.Time, ip string, endpoint string, rule models.Rule) {
	e.mu.Lock()
	defer e.mu.Unlock()

	key := ip + ":" + endpoint
	if entry, ok := e.notificationHistory[key]; ok {
		if time.Since(entry.sentAt) < notificationCooldown {
			return
		}
	}

	ruleString, _ := utils.MarshalJSON(rule)
	notificationString := fmt.Sprintf("Error: %s,\n IP: %s,\n Endpoint: %s,\n Rule: %s,\n Timestamp: %s", systemError, ip, endpoint, ruleString, timestamp)
	e.sendNotification(notificationString)
	e.notificationHistory[key] = notificationEntry{sentAt: time.Now()}
}

func (e *ErrorNotificationSVC) sendNotification(notification string) {
	e.slackSVC.SendSlackMessage(notification)
}
