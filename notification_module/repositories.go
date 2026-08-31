package main

import (
	"fmt"
	"sync"
	"time"
)

type TemplateRepository interface {
	Create(Template) error
	List() []Template
	Get(string) (Template, bool)
	GetByEventType(string) (Template, bool)
	Update(string, Template) error
	Delete(string) bool
}

type NotificationRepository interface {
	Save(NotificationRecord)
	Get(string) (NotificationRecord, bool)
}

type NotificationEventRepository interface {
	Save(NotificationEventRecord)
	GetByEventID(string) (NotificationEventRecord, bool)
}

type DeliveryRepository interface {
	Save(DeliveryResult)
	Get(string) (DeliveryResult, bool)
	ListByNotification(string) []DeliveryResult
}

type DeliveryAttemptRepository interface {
	Save(DeliveryAttemptRecord)
	ListByDelivery(string) []DeliveryAttemptRecord
}

type PreferenceRepository interface {
	Get(string) NotificationPreference
	Put(NotificationPreference)
}

type RecipientRepository interface {
	Save(Recipient)
}

type DeduplicationRepository interface {
	CheckAndStore(key, notificationID string, window time.Duration) (string, bool)
}

type InMemoryTemplateRepository struct {
	mu        sync.RWMutex
	byID      map[string]Template
	eventToID map[string]string
}

func NewInMemoryTemplateRepository() *InMemoryTemplateRepository {
	return &InMemoryTemplateRepository{byID: map[string]Template{}, eventToID: map[string]string{}}
}

func (r *InMemoryTemplateRepository) Create(t Template) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	if _, exists := r.byID[t.ID]; exists {
		return fmt.Errorf("template %q already exists", t.ID)
	}
	r.byID[t.ID] = t
	if t.EventType != "" {
		r.eventToID[t.EventType] = t.ID
	}
	return nil
}

func (r *InMemoryTemplateRepository) List() []Template {
	r.mu.RLock()
	defer r.mu.RUnlock()
	out := make([]Template, 0, len(r.byID))
	for _, t := range r.byID {
		out = append(out, t)
	}
	return out
}

func (r *InMemoryTemplateRepository) Get(id string) (Template, bool) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	t, ok := r.byID[id]
	return t, ok
}

func (r *InMemoryTemplateRepository) GetByEventType(eventType string) (Template, bool) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	id, ok := r.eventToID[eventType]
	if !ok {
		return Template{}, false
	}
	t, ok := r.byID[id]
	return t, ok
}

func (r *InMemoryTemplateRepository) Update(id string, t Template) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	old, exists := r.byID[id]
	if !exists {
		return fmt.Errorf("template %q not found", id)
	}
	if old.EventType != "" && old.EventType != t.EventType {
		delete(r.eventToID, old.EventType)
	}
	r.byID[id] = t
	if t.EventType != "" {
		r.eventToID[t.EventType] = id
	}
	return nil
}

func (r *InMemoryTemplateRepository) Delete(id string) bool {
	r.mu.Lock()
	defer r.mu.Unlock()
	t, ok := r.byID[id]
	if !ok {
		return false
	}
	delete(r.byID, id)
	if t.EventType != "" {
		delete(r.eventToID, t.EventType)
	}
	return true
}

type InMemoryNotificationRepository struct {
	mu   sync.RWMutex
	byID map[string]NotificationRecord
}

func NewInMemoryNotificationRepository() *InMemoryNotificationRepository {
	return &InMemoryNotificationRepository{byID: map[string]NotificationRecord{}}
}

func (r *InMemoryNotificationRepository) Save(n NotificationRecord) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.byID[n.ID] = n
}

func (r *InMemoryNotificationRepository) Get(id string) (NotificationRecord, bool) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	n, ok := r.byID[id]
	return n, ok
}

type InMemoryNotificationEventRepository struct {
	mu        sync.RWMutex
	byEventID map[string]NotificationEventRecord
}

func NewInMemoryNotificationEventRepository() *InMemoryNotificationEventRepository {
	return &InMemoryNotificationEventRepository{byEventID: map[string]NotificationEventRecord{}}
}

func (r *InMemoryNotificationEventRepository) Save(e NotificationEventRecord) {
	r.mu.Lock()
	defer r.mu.Unlock()
	if e.EventID == "" {
		return
	}
	r.byEventID[e.EventID] = e
}

func (r *InMemoryNotificationEventRepository) GetByEventID(eventID string) (NotificationEventRecord, bool) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	e, ok := r.byEventID[eventID]
	return e, ok
}

type InMemoryDeliveryRepository struct {
	mu   sync.RWMutex
	byID map[string]DeliveryResult
}

func NewInMemoryDeliveryRepository() *InMemoryDeliveryRepository {
	return &InMemoryDeliveryRepository{byID: map[string]DeliveryResult{}}
}

func (r *InMemoryDeliveryRepository) Save(d DeliveryResult) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.byID[d.DeliveryID] = d
}

func (r *InMemoryDeliveryRepository) Get(id string) (DeliveryResult, bool) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	d, ok := r.byID[id]
	return d, ok
}

func (r *InMemoryDeliveryRepository) ListByNotification(notificationID string) []DeliveryResult {
	r.mu.RLock()
	defer r.mu.RUnlock()
	out := []DeliveryResult{}
	for _, d := range r.byID {
		if d.NotificationID == notificationID {
			out = append(out, d)
		}
	}
	return out
}

type InMemoryDeliveryAttemptRepository struct {
	mu   sync.RWMutex
	byID map[string][]DeliveryAttemptRecord
}

func NewInMemoryDeliveryAttemptRepository() *InMemoryDeliveryAttemptRepository {
	return &InMemoryDeliveryAttemptRepository{byID: map[string][]DeliveryAttemptRecord{}}
}

func (r *InMemoryDeliveryAttemptRepository) Save(a DeliveryAttemptRecord) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.byID[a.DeliveryID] = append(r.byID[a.DeliveryID], a)
}

func (r *InMemoryDeliveryAttemptRepository) ListByDelivery(deliveryID string) []DeliveryAttemptRecord {
	r.mu.RLock()
	defer r.mu.RUnlock()
	out := make([]DeliveryAttemptRecord, len(r.byID[deliveryID]))
	copy(out, r.byID[deliveryID])
	return out
}

type InMemoryPreferenceRepository struct {
	mu   sync.RWMutex
	byID map[string]NotificationPreference
}

func NewInMemoryPreferenceRepository() *InMemoryPreferenceRepository {
	return &InMemoryPreferenceRepository{byID: map[string]NotificationPreference{}}
}

func (r *InMemoryPreferenceRepository) Get(userID string) NotificationPreference {
	r.mu.RLock()
	defer r.mu.RUnlock()
	if p, ok := r.byID[userID]; ok {
		return p
	}
	return NotificationPreference{UserID: userID, EmailEnabled: true, WhatsAppEnabled: true}
}

func (r *InMemoryPreferenceRepository) Put(p NotificationPreference) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.byID[p.UserID] = p
}

type InMemoryRecipientRepository struct {
	mu   sync.RWMutex
	byID map[string]Recipient
}

func NewInMemoryRecipientRepository() *InMemoryRecipientRepository {
	return &InMemoryRecipientRepository{byID: map[string]Recipient{}}
}

func (r *InMemoryRecipientRepository) Save(rec Recipient) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.byID[rec.UserID] = rec
}

type dedupRecord struct {
	notificationID string
	expiresAt      time.Time
}

type InMemoryDeduplicationRepository struct {
	mu   sync.Mutex
	byID map[string]dedupRecord
}

func NewInMemoryDeduplicationRepository() *InMemoryDeduplicationRepository {
	return &InMemoryDeduplicationRepository{byID: map[string]dedupRecord{}}
}

func (r *InMemoryDeduplicationRepository) CheckAndStore(key, notificationID string, window time.Duration) (string, bool) {
	r.mu.Lock()
	defer r.mu.Unlock()
	now := time.Now()
	if existing, ok := r.byID[key]; ok && now.Before(existing.expiresAt) {
		return existing.notificationID, true
	}
	r.byID[key] = dedupRecord{notificationID: notificationID, expiresAt: now.Add(window)}
	return "", false
}
