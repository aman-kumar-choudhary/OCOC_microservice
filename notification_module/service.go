package main

import (
	"fmt"
	"log"
	"os"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"time"
)

type delivery struct {
	userID   string
	channel  string
	provider string
	receiver string
}

const (
	defaultMaxConcurrency    = 10
	defaultMaxRetries        = 3
	defaultRetryDelaySeconds = 5
	defaultDedupWindow       = 300
	defaultRateLimit         = 100
)

type RateLimiter struct {
	mu       sync.Mutex
	limit    int
	window   time.Duration
	start    time.Time
	consumed int
}

func NewRateLimiter(limit int) *RateLimiter {
	return &RateLimiter{limit: limit, window: time.Minute, start: time.Now()}
}

func (r *RateLimiter) Allow() bool {
	r.mu.Lock()
	defer r.mu.Unlock()
	if r.limit <= 0 {
		return true
	}
	now := time.Now()
	if now.Sub(r.start) >= r.window {
		r.start = now
		r.consumed = 0
	}
	if r.consumed >= r.limit {
		return false
	}
	r.consumed++
	return true
}

type NotificationService struct {
	channels       map[string]NotificationChannel
	maxConcurrency int
	maxRetries     int
	retryDelay     time.Duration
	dedupWindow    time.Duration
	rateLimiter    *RateLimiter

	templates     TemplateRepository
	notifications NotificationRepository
	deliveries    DeliveryRepository
	attempts      DeliveryAttemptRepository
	preferences   PreferenceRepository
	events        NotificationEventRepository
	recipients    RecipientRepository
	dedup         DeduplicationRepository
	broker        DeliveryBroker

	notificationSeq uint64
	deliverySeq     uint64
	eventSeq        uint64

	asyncProcessing bool
	workersStarted  sync.Once
	completionMu    sync.Mutex
	completions     map[string]chan DeliveryResult
}

func NewNotificationService(channels map[string]NotificationChannel) *NotificationService {
	return NewNotificationServiceWithRepositories(channels, NewInMemoryDeliveryBroker(envInt("QUEUE_BUFFER_SIZE", 100)), InMemoryRepositories())
}

func NewNotificationServiceWithBroker(channels map[string]NotificationChannel, broker DeliveryBroker) *NotificationService {
	if broker == nil {
		broker = NewInMemoryDeliveryBroker(envInt("QUEUE_BUFFER_SIZE", 100))
	}
	return NewNotificationServiceWithRepositories(channels, broker, InMemoryRepositories())
}

func InMemoryRepositories() RepositorySet {
	return RepositorySet{
		Templates:     NewInMemoryTemplateRepository(),
		Notifications: NewInMemoryNotificationRepository(),
		Deliveries:    NewInMemoryDeliveryRepository(),
		Attempts:      NewInMemoryDeliveryAttemptRepository(),
		Preferences:   NewInMemoryPreferenceRepository(),
		Events:        NewInMemoryNotificationEventRepository(),
		Recipients:    NewInMemoryRecipientRepository(),
		Dedup:         NewInMemoryDeduplicationRepository(),
	}
}

func NewNotificationServiceWithRepositories(channels map[string]NotificationChannel, broker DeliveryBroker, repos RepositorySet) *NotificationService {
	if broker == nil {
		broker = NewInMemoryDeliveryBroker(envInt("QUEUE_BUFFER_SIZE", 100))
	}
	repos = fillMissingRepositories(repos)
	svc := &NotificationService{
		channels:        channels,
		maxConcurrency:  envInt("MAX_CONCURRENCY", defaultMaxConcurrency),
		maxRetries:      envInt("MAX_RETRIES", defaultMaxRetries),
		retryDelay:      time.Duration(envInt("RETRY_DELAY_SECONDS", envInt("RETRY_DELAY", defaultRetryDelaySeconds))) * time.Second,
		dedupWindow:     time.Duration(envInt("DEDUP_WINDOW_SECONDS", defaultDedupWindow)) * time.Second,
		rateLimiter:     NewRateLimiter(envInt("NOTIFICATION_RATE_LIMIT", defaultRateLimit)),
		templates:       repos.Templates,
		notifications:   repos.Notifications,
		deliveries:      repos.Deliveries,
		attempts:        repos.Attempts,
		preferences:     repos.Preferences,
		events:          repos.Events,
		recipients:      repos.Recipients,
		dedup:           repos.Dedup,
		broker:          broker,
		asyncProcessing: envBool("NOTIFICATION_ASYNC", true),
		completions:     map[string]chan DeliveryResult{},
	}
	svc.startWorkers()
	return svc
}

func fillMissingRepositories(repos RepositorySet) RepositorySet {
	fallback := InMemoryRepositories()
	if repos.Templates == nil {
		repos.Templates = fallback.Templates
	}
	if repos.Notifications == nil {
		repos.Notifications = fallback.Notifications
	}
	if repos.Deliveries == nil {
		repos.Deliveries = fallback.Deliveries
	}
	if repos.Attempts == nil {
		repos.Attempts = fallback.Attempts
	}
	if repos.Preferences == nil {
		repos.Preferences = fallback.Preferences
	}
	if repos.Events == nil {
		repos.Events = fallback.Events
	}
	if repos.Recipients == nil {
		repos.Recipients = fallback.Recipients
	}
	if repos.Dedup == nil {
		repos.Dedup = fallback.Dedup
	}
	return repos
}

func envInt(key string, fallback int) int {
	raw := os.Getenv(key)
	if raw == "" {
		return fallback
	}
	value, err := strconv.Atoi(raw)
	if err != nil {
		return fallback
	}
	return value
}

func envString(key, fallback string) string {
	raw := strings.TrimSpace(os.Getenv(key))
	if raw == "" {
		return fallback
	}
	return raw
}

func envBool(key string, fallback bool) bool {
	raw := strings.TrimSpace(strings.ToLower(os.Getenv(key)))
	if raw == "" {
		return fallback
	}
	switch raw {
	case "1", "true", "yes", "y", "on":
		return true
	case "0", "false", "no", "n", "off":
		return false
	default:
		return fallback
	}
}

func (s *NotificationService) nextNotificationID() string {
	n := atomic.AddUint64(&s.notificationSeq, 1)
	return fmt.Sprintf("NTF-%03d", n)
}

func (s *NotificationService) nextDeliveryID() string {
	n := atomic.AddUint64(&s.deliverySeq, 1)
	return fmt.Sprintf("DEL-%03d", n)
}

func (s *NotificationService) nextEventRecordID() string {
	n := atomic.AddUint64(&s.eventSeq, 1)
	return fmt.Sprintf("EVT-%03d", n)
}

func (s *NotificationService) ProcessNotification(req NotificationRequest) NotificationResponse {
	resp, _ := s.ProcessNotificationWithError(req)
	return resp
}

func (s *NotificationService) ProcessNotificationWithError(req NotificationRequest) (NotificationResponse, *AppError) {
	if !s.rateLimiter.Allow() {
		return NotificationResponse{Success: false, Message: "Notification rate limit exceeded", Status: NotificationFailed}, appError(ErrorRateLimit, "notification rate limit exceeded")
	}

	notificationID := s.nextNotificationID()
	dedupKey := req.EventID
	if dedupKey == "" {
		dedupKey = req.IdempotencyKey
	}
	if dedupKey != "" {
		if existingID, duplicate := s.dedup.CheckAndStore(dedupKey, notificationID, s.dedupWindow); duplicate {
			if existing, ok := s.notifications.Get(existingID); ok {
				resp := existing.Response
				resp.Duplicate = true
				resp.Message = "Duplicate notification ignored"
				return resp, appError(ErrorDuplicate, "duplicate event %q; existing notification_id=%s", dedupKey, existingID)
			}
			return NotificationResponse{Success: false, NotificationID: existingID, Duplicate: true, Message: "Duplicate notification ignored"}, appError(ErrorDuplicate, "duplicate event %q", dedupKey)
		}
	}

	s.recordAcceptedEvent(req)

	subject, message, allowed, err := s.materializeContent(req)
	if err != nil {
		return NotificationResponse{Success: false, NotificationID: notificationID, Message: err.Message, Status: NotificationFailed}, err
	}
	req.Subject = subject
	req.Message = message

	deliveries := s.resolveDeliveries(req, allowed)
	s.saveNotificationRecord(notificationID, req, NotificationResponse{
		Success:         len(deliveries) > 0,
		NotificationID:  notificationID,
		Message:         responseMessage(NotificationQueued),
		Status:          NotificationQueued,
		TotalRecipients: len(req.Recipients),
		TotalDeliveries: len(deliveries),
	})

	results := make([]DeliveryResult, len(deliveries))
	for i, d := range deliveries {
		deliveryID := s.nextDeliveryID()
		results[i] = s.queueDelivery(notificationID, deliveryID, d, req.Subject, req.Message)
	}

	if !s.asyncProcessing {
		for i, r := range results {
			if r.Status != DeliveryQueued {
				continue
			}
			results[i] = s.waitForDelivery(r.DeliveryID)
		}
	}

	successCount, failCount := 0, 0
	for _, r := range results {
		if r.Status == DeliverySent || r.Status == DeliveryDelivered {
			successCount++
		} else if r.Status == DeliveryFailed {
			failCount++
		}
	}

	status := NotificationQueued
	switch {
	case s.asyncProcessing && len(results) > 0 && failCount == 0 && successCount == 0:
		status = NotificationQueued
	case len(results) == 0 || (successCount == 0 && failCount > 0):
		status = NotificationFailed
	case successCount > 0 && failCount > 0:
		status = NotificationPartiallyCompleted
	case successCount == len(results):
		status = NotificationCompleted
	}

	resp := NotificationResponse{
		Success:              (failCount == 0 && len(results) > 0) || status == NotificationQueued,
		NotificationID:       notificationID,
		Message:              responseMessage(status),
		Status:               status,
		TotalRecipients:      len(req.Recipients),
		TotalDeliveries:      len(results),
		SuccessfulDeliveries: successCount,
		FailedDeliveries:     failCount,
		Results:              results,
	}
	s.saveNotificationRecord(notificationID, req, resp)
	log.Printf("Notification created notification_id=%s sender_id=%s recipients=%d deliveries=%d successful=%d failed=%d",
		notificationID, req.SenderID, len(req.Recipients), len(results), successCount, failCount)
	return resp, nil
}

func (s *NotificationService) saveNotificationRecord(notificationID string, req NotificationRequest, resp NotificationResponse) {
	now := time.Now()
	createdAt := now
	if existing, ok := s.notifications.Get(notificationID); ok && !existing.CreatedAt.IsZero() {
		if resp.Status == NotificationQueued && existing.Status != NotificationQueued {
			return
		}
		createdAt = existing.CreatedAt
	}
	s.notifications.Save(NotificationRecord{
		ID: notificationID, SenderID: req.SenderID, Subject: req.Subject, Message: req.Message,
		Status: resp.Status, CreatedAt: createdAt, UpdatedAt: now, Response: resp,
	})
}

func responseMessage(status NotificationStatus) string {
	if status == NotificationQueued {
		return "Notification queued for processing"
	}
	return "Notification processing completed"
}

func (s *NotificationService) recordAcceptedEvent(req NotificationRequest) {
	if req.EventID == "" {
		return
	}
	now := time.Now()
	s.events.Save(NotificationEventRecord{
		ID:          s.nextEventRecordID(),
		EventID:     req.EventID,
		EventType:   req.EventType,
		Source:      req.Source,
		Status:      string(NotificationAccepted),
		CreatedAt:   now,
		ProcessedAt: now,
	})
}

func (s *NotificationService) materializeContent(req NotificationRequest) (string, string, []string, *AppError) {
	allowed := req.Channels
	if len(allowed) == 0 {
		allowed = []string{"email", "whatsapp"}
	}
	if req.TemplateID == "" && req.EventType == "" {
		return req.Subject, req.Message, mirrorEmailToWhatsAppChannels(allowed), nil
	}

	var tmpl Template
	var ok bool
	if req.TemplateID != "" {
		tmpl, ok = s.templates.Get(req.TemplateID)
	} else {
		tmpl, ok = s.templates.GetByEventType(req.EventType)
	}
	if !ok {
		return "", "", nil, appError(ErrorTemplate, "template not found")
	}
	if !tmpl.Enabled {
		return "", "", nil, appError(ErrorTemplate, "template %q is disabled", tmpl.ID)
	}
	subject, renderErr := renderTemplateText(tmpl.Subject, req.Variables)
	if renderErr != nil {
		return "", "", nil, appError(ErrorTemplate, renderErr.Error())
	}
	body, renderErr := renderTemplateText(tmpl.Body, req.Variables)
	if renderErr != nil {
		return "", "", nil, appError(ErrorTemplate, renderErr.Error())
	}
	if len(req.Channels) == 0 {
		allowed = tmpl.AllowedChannels
	} else {
		allowed = intersectChannels(req.Channels, tmpl.AllowedChannels)
	}
	return subject, body, mirrorEmailToWhatsAppChannels(allowed), nil
}

func (s *NotificationService) resolveDeliveries(req NotificationRequest, allowed []string) []delivery {
	var out []delivery
	for _, rec := range req.Recipients {
		requested := rec.Channels
		if len(requested) == 0 {
			requested = req.Channels
		}
		requested = mirrorEmailToWhatsAppChannels(requested)
		for _, ch := range intersectChannels(requested, allowed) {
			if !s.preferenceAllows(rec.UserID, ch) {
				continue
			}
			receiver := rec.Email
			if ch == "whatsapp" {
				receiver = rec.Phone
				if !phoneRegex.MatchString(receiver) {
					log.Printf("Skipping WhatsApp mirror delivery user_id=%s reason=missing_or_invalid_phone", rec.UserID)
					continue
				}
			}
			if receiver == "" {
				continue
			}
			out = append(out, delivery{userID: rec.UserID, channel: ch, provider: providerForChannel(ch), receiver: receiver})
		}
	}
	return out
}

func mirrorEmailToWhatsAppChannels(channels []string) []string {
	if !envBool("MIRROR_EMAIL_TO_WHATSAPP", true) {
		return channels
	}
	hasEmail := false
	hasWhatsApp := false
	for _, ch := range channels {
		switch ch {
		case "email":
			hasEmail = true
		case "whatsapp":
			hasWhatsApp = true
		}
	}
	if !hasEmail || hasWhatsApp {
		return channels
	}
	out := append([]string{}, channels...)
	return append(out, "whatsapp")
}

func (s *NotificationService) preferenceAllows(userID, channel string) bool {
	p := s.preferences.Get(userID)
	switch channel {
	case "email":
		return p.EmailEnabled
	case "whatsapp":
		return p.WhatsAppEnabled
	default:
		return false
	}
}

func providerForChannel(channel string) string {
	switch channel {
	case "email":
		return "smtp"
	case "whatsapp":
		return "meta_whatsapp_cloud"
	default:
		return channel
	}
}

func (s *NotificationService) queueDelivery(notificationID, deliveryID string, d delivery, subject, message string) DeliveryResult {
	now := time.Now()
	result := DeliveryResult{
		DeliveryID: deliveryID, NotificationID: notificationID, UserID: d.userID,
		Channel: d.channel, Provider: d.provider, Receiver: d.receiver, Status: DeliveryQueued,
		CreatedAt: now, UpdatedAt: now,
	}
	s.deliveries.Save(result)
	if !s.asyncProcessing {
		s.registerCompletion(deliveryID)
	}

	msg := DeliveryMessage{
		DeliveryID: deliveryID, NotificationID: notificationID, UserID: d.userID,
		Channel: d.channel, Provider: d.provider, Receiver: d.receiver,
		Subject: subject, Message: message, Attempt: 1, MaxAttempts: s.maxRetries,
	}
	if err := s.broker.Publish(msg); err != nil {
		result.Status = DeliveryFailed
		result.Error = err.Error()
		result.UpdatedAt = time.Now()
		s.deliveries.Save(result)
		s.completeDelivery(result)
		s.updateNotificationFromDeliveries(notificationID)
		log.Printf("RabbitMQ publish failed delivery_id=%s notification_id=%s channel=%s error=%v", deliveryID, notificationID, d.channel, err)
	} else {
		log.Printf("Notification queued delivery_id=%s notification_id=%s channel=%s", deliveryID, notificationID, d.channel)
	}
	return result
}

func (s *NotificationService) registerCompletion(deliveryID string) {
	s.completionMu.Lock()
	defer s.completionMu.Unlock()
	s.completions[deliveryID] = make(chan DeliveryResult, 1)
}

func (s *NotificationService) waitForDelivery(deliveryID string) DeliveryResult {
	s.completionMu.Lock()
	ch := s.completions[deliveryID]
	s.completionMu.Unlock()
	if ch == nil {
		if d, ok := s.deliveries.Get(deliveryID); ok {
			return d
		}
		return DeliveryResult{DeliveryID: deliveryID, Status: DeliveryFailed, Error: "delivery completion not registered"}
	}
	result := <-ch
	s.completionMu.Lock()
	delete(s.completions, deliveryID)
	s.completionMu.Unlock()
	return result
}

func (s *NotificationService) completeDelivery(result DeliveryResult) {
	s.completionMu.Lock()
	ch := s.completions[result.DeliveryID]
	s.completionMu.Unlock()
	if ch != nil {
		ch <- result
	}
}

func (s *NotificationService) startWorkers() {
	s.workersStarted.Do(func() {
		for channel := range s.channels {
			queue, err := s.broker.Consume(channel)
			if err != nil {
				log.Printf("Delivery worker not started channel=%s error=%v", channel, err)
				continue
			}
			workers := s.maxConcurrency
			if workers <= 0 {
				workers = 1
			}
			for i := 0; i < workers; i++ {
				go s.runDeliveryWorker(channel, queue)
			}
		}
	})
}

func (s *NotificationService) runDeliveryWorker(channel string, queue <-chan BrokerDelivery) {
	for delivery := range queue {
		msg := delivery.Message
		if msg.Channel != channel {
			log.Printf("Delivery worker received mismatched channel worker=%s message_channel=%s delivery_id=%s", channel, msg.Channel, msg.DeliveryID)
		}
		log.Printf("RabbitMQ message consumed delivery_id=%s notification_id=%s channel=%s attempt=%d", msg.DeliveryID, msg.NotificationID, msg.Channel, msg.Attempt)
		result := s.processDeliveryMessage(msg)
		if result.Status == DeliverySent || result.Status == DeliveryDelivered || result.Status == DeliveryFailed {
			if err := delivery.Ack(); err != nil {
				log.Printf("RabbitMQ ack failed delivery_id=%s error=%v", msg.DeliveryID, err)
			}
			s.completeDelivery(result)
			s.updateNotificationFromDeliveries(result.NotificationID)
			continue
		}
		if err := delivery.Ack(); err != nil {
			log.Printf("RabbitMQ ack failed after retry publish delivery_id=%s error=%v", msg.DeliveryID, err)
		}
	}
}

func (s *NotificationService) updateNotificationFromDeliveries(notificationID string) {
	if notificationID == "" {
		return
	}
	n, ok := s.notifications.Get(notificationID)
	if !ok {
		return
	}
	deliveries := s.deliveries.ListByNotification(notificationID)
	successCount, failCount, queuedCount := 0, 0, 0
	for _, d := range deliveries {
		switch d.Status {
		case DeliverySent, DeliveryDelivered:
			successCount++
		case DeliveryFailed:
			failCount++
		default:
			queuedCount++
		}
	}

	status := NotificationQueued
	switch {
	case len(deliveries) == 0 || (successCount == 0 && failCount > 0 && queuedCount == 0):
		status = NotificationFailed
	case queuedCount > 0:
		status = NotificationQueued
	case successCount > 0 && failCount > 0:
		status = NotificationPartiallyCompleted
	case successCount == len(deliveries):
		status = NotificationCompleted
	}

	n.Status = status
	n.UpdatedAt = time.Now()
	n.Response.Status = status
	n.Response.Message = responseMessage(status)
	n.Response.Success = (failCount == 0 && len(deliveries) > 0) || status == NotificationQueued
	n.Response.TotalDeliveries = len(deliveries)
	n.Response.SuccessfulDeliveries = successCount
	n.Response.FailedDeliveries = failCount
	n.Response.Results = deliveries
	s.notifications.Save(n)
}

func (s *NotificationService) processDeliveryMessage(msg DeliveryMessage) DeliveryResult {
	result, ok := s.deliveries.Get(msg.DeliveryID)
	if !ok {
		now := time.Now()
		result = DeliveryResult{
			DeliveryID: msg.DeliveryID, NotificationID: msg.NotificationID, UserID: msg.UserID,
			Channel: msg.Channel, Provider: msg.Provider, Receiver: msg.Receiver,
			Status: DeliveryQueued, CreatedAt: now, UpdatedAt: now,
		}
	} else if result.Status == DeliverySent || result.Status == DeliveryDelivered || result.Status == DeliveryFailed {
		log.Printf("Skipping duplicate delivery message delivery_id=%s notification_id=%s status=%s", msg.DeliveryID, msg.NotificationID, result.Status)
		return result
	}

	channel, ok := s.channels[msg.Channel]
	if !ok {
		result.Status = DeliveryFailed
		result.Error = fmt.Sprintf("no implementation registered for channel %q", msg.Channel)
		result.UpdatedAt = time.Now()
		s.deliveries.Save(result)
		return result
	}

	maxAttempts := msg.MaxAttempts
	if maxAttempts <= 0 {
		maxAttempts = s.maxRetries
	}
	for attempt := msg.Attempt; attempt <= maxAttempts; attempt++ {
		result.AttemptCount = attempt
		result.Status = DeliverySending
		result.UpdatedAt = time.Now()
		s.deliveries.Save(result)
		if err := channel.Send(msg.Receiver, msg.Subject, msg.Message); err != nil {
			result.Error = err.Error()
			s.attempts.Save(DeliveryAttemptRecord{
				DeliveryID: msg.DeliveryID, AttemptNumber: attempt, Provider: msg.Provider,
				Status: string(DeliveryFailed), ErrorMessage: err.Error(), AttemptedAt: time.Now(),
			})
			if attempt < maxAttempts {
				log.Printf("Notification send failed delivery_id=%s notification_id=%s channel=%s attempt=%d error=%v", msg.DeliveryID, msg.NotificationID, msg.Channel, attempt, err)
				delay := s.retryDelay * time.Duration(1<<(attempt-1))
				next := time.Now().Add(delay)
				result.Status = DeliveryRetrying
				result.NextRetryAt = &next
				result.UpdatedAt = time.Now()
				s.deliveries.Save(result)
				time.Sleep(delay)
				retryMsg := msg
				retryMsg.Attempt = attempt + 1
				if publishErr := s.broker.PublishRetry(retryMsg); publishErr != nil {
					result.Status = DeliveryFailed
					result.Error = publishErr.Error()
					result.NextRetryAt = nil
					result.UpdatedAt = time.Now()
					s.deliveries.Save(result)
					_ = s.broker.PublishDLQ(retryMsg)
					return result
				}
				log.Printf("Notification retry delivery_id=%s notification_id=%s channel=%s next_attempt=%d", msg.DeliveryID, msg.NotificationID, msg.Channel, retryMsg.Attempt)
				return result
			}
			result.Status = DeliveryFailed
			result.NextRetryAt = nil
			result.UpdatedAt = time.Now()
			s.deliveries.Save(result)
			_ = s.broker.PublishDLQ(msg)
			log.Printf("Notification failed delivery_id=%s notification_id=%s channel=%s attempts=%d error=%v", msg.DeliveryID, msg.NotificationID, msg.Channel, attempt, err)
			return result
		}
		s.attempts.Save(DeliveryAttemptRecord{
			DeliveryID: msg.DeliveryID, AttemptNumber: attempt, Provider: msg.Provider,
			Status: string(DeliverySent), AttemptedAt: time.Now(),
		})
		result.Status = DeliverySent
		result.Error = ""
		result.NextRetryAt = nil
		result.UpdatedAt = time.Now()
		s.deliveries.Save(result)
		log.Printf("Notification sent delivery_id=%s notification_id=%s channel=%s attempt=%d", msg.DeliveryID, msg.NotificationID, msg.Channel, attempt)
		return result
	}
	return result
}

func intersectChannels(left, right []string) []string {
	allowed := map[string]bool{}
	for _, ch := range right {
		allowed[ch] = true
	}
	out := []string{}
	seen := map[string]bool{}
	for _, ch := range left {
		if allowed[ch] && !seen[ch] {
			out = append(out, ch)
			seen[ch] = true
		}
	}
	return out
}
