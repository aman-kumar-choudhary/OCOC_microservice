package main

import "time"

// Recipient identifies one notification target and the channels they should
// receive it through. Email/phone are supplied directly in the request for
// now. They're kept as separate fields (rather than folded into `channels`)
// so that later, user_id could be resolved against a real user
// service/database to fill in email/phone instead of requiring the caller
// to supply them - nothing downstream would need to change.
type Recipient struct {
	UserID   string   `json:"user_id"`
	Email    string   `json:"email,omitempty"`
	Phone    string   `json:"phone,omitempty"`
	Channels []string `json:"channels"`
}

type Template struct {
	ID              string    `json:"id"`
	Name            string    `json:"name"`
	EventType       string    `json:"event_type"`
	Subject         string    `json:"subject"`
	Body            string    `json:"body"`
	AllowedChannels []string  `json:"allowed_channels"`
	Enabled         bool      `json:"enabled"`
	CreatedAt       time.Time `json:"created_at"`
	UpdatedAt       time.Time `json:"updated_at"`
}

type TemplateRequest struct {
	ID              string   `json:"id"`
	Name            string   `json:"name"`
	EventType       string   `json:"event_type"`
	Subject         string   `json:"subject"`
	Body            string   `json:"body"`
	AllowedChannels []string `json:"allowed_channels"`
	Enabled         *bool    `json:"enabled,omitempty"`
}

type NotificationPreference struct {
	UserID          string `json:"user_id"`
	EmailEnabled    bool   `json:"email_enabled"`
	WhatsAppEnabled bool   `json:"whatsapp_enabled"`
}

// NotificationRequest is the incoming payload for POST /api/v1/notifications/send.
//
// Deprecated: Channel/Receiver are the original single-recipient fields.
// They're still accepted for backward compatibility - normalizeRequest (in
// validate.go) converts them into a single-element Recipients list - but new
// clients should send Recipients directly.
type NotificationRequest struct {
	SenderID       string            `json:"sender_id"`
	Subject        string            `json:"subject,omitempty"` // used for email deliveries only
	Message        string            `json:"message"`
	TemplateID     string            `json:"template_id,omitempty"`
	EventType      string            `json:"event_type,omitempty"`
	EventID        string            `json:"event_id,omitempty"`
	Source         string            `json:"source,omitempty"`
	IdempotencyKey string            `json:"idempotency_key,omitempty"`
	Variables      map[string]string `json:"variables,omitempty"`
	Channels       []string          `json:"channels,omitempty"`
	Recipients     []Recipient       `json:"recipients,omitempty"`

	Channel  string `json:"channel,omitempty"`
	Receiver string `json:"receiver,omitempty"`
}

type BroadcastRequest struct {
	SenderID       string      `json:"sender_id"`
	Subject        string      `json:"subject,omitempty"`
	Message        string      `json:"message"`
	EventID        string      `json:"event_id,omitempty"`
	Source         string      `json:"source,omitempty"`
	IdempotencyKey string      `json:"idempotency_key,omitempty"`
	Channels       []string    `json:"channels"`
	Recipients     []Recipient `json:"recipients"`
}

// DeliveryStatus is the lifecycle state of a single channel delivery.
// Kept as a small enum so more states (queued, retrying, cancelled, ...)
// can be added later without changing the API shape.
type DeliveryStatus string

const (
	DeliveryPending   DeliveryStatus = "pending"
	DeliveryQueued    DeliveryStatus = "queued"
	DeliverySending   DeliveryStatus = "sending"
	DeliverySent      DeliveryStatus = "sent"
	DeliveryDelivered DeliveryStatus = "delivered"
	DeliveryRetrying  DeliveryStatus = "retrying"
	DeliveryFailed    DeliveryStatus = "failed"
)

// NotificationStatus summarizes the outcome across every delivery belonging
// to one notification.
type NotificationStatus string

const (
	NotificationAccepted           NotificationStatus = "accepted"
	NotificationQueued             NotificationStatus = "queued"
	NotificationCompleted          NotificationStatus = "completed"
	NotificationPartiallyCompleted NotificationStatus = "partially_completed"
	NotificationFailed             NotificationStatus = "failed"
)

// DeliveryResult is the outcome of one recipient+channel delivery operation.
type DeliveryResult struct {
	DeliveryID     string         `json:"delivery_id"`
	NotificationID string         `json:"notification_id,omitempty"`
	UserID         string         `json:"user_id"`
	Channel        string         `json:"channel"`
	Provider       string         `json:"provider,omitempty"`
	Receiver       string         `json:"receiver,omitempty"`
	Status         DeliveryStatus `json:"status"`
	AttemptCount   int            `json:"attempt_count"`
	Error          string         `json:"error,omitempty"`
	CreatedAt      time.Time      `json:"created_at,omitempty"`
	UpdatedAt      time.Time      `json:"updated_at,omitempty"`
	NextRetryAt    *time.Time     `json:"next_retry_at,omitempty"`
}

type NotificationEventRecord struct {
	ID          string    `json:"id"`
	EventID     string    `json:"event_id"`
	EventType   string    `json:"event_type"`
	Source      string    `json:"source,omitempty"`
	Payload     string    `json:"payload,omitempty"`
	Status      string    `json:"status"`
	CreatedAt   time.Time `json:"created_at"`
	ProcessedAt time.Time `json:"processed_at,omitempty"`
}

type DeliveryAttemptRecord struct {
	DeliveryID    string    `json:"delivery_id"`
	AttemptNumber int       `json:"attempt_number"`
	Provider      string    `json:"provider"`
	Status        string    `json:"status"`
	ResponseCode  string    `json:"response_code,omitempty"`
	ErrorMessage  string    `json:"error_message,omitempty"`
	AttemptedAt   time.Time `json:"attempted_at"`
}

type DeliveryMessage struct {
	DeliveryID     string `json:"delivery_id"`
	NotificationID string `json:"notification_id"`
	UserID         string `json:"user_id"`
	Channel        string `json:"channel"`
	Provider       string `json:"provider"`
	Receiver       string `json:"receiver"`
	Subject        string `json:"subject,omitempty"`
	Message        string `json:"message"`
	Attempt        int    `json:"attempt"`
	MaxAttempts    int    `json:"max_attempts"`
}

// NotificationResponse is returned by POST /api/v1/notifications/send once
// every delivery has been attempted. One failed delivery never suppresses
// the results of the others - success/failure is reported per delivery.
type NotificationResponse struct {
	Success              bool               `json:"success"`
	NotificationID       string             `json:"notification_id"`
	Message              string             `json:"message"`
	Status               NotificationStatus `json:"status"`
	TotalRecipients      int                `json:"total_recipients"`
	TotalDeliveries      int                `json:"total_deliveries"`
	SuccessfulDeliveries int                `json:"successful_deliveries"`
	FailedDeliveries     int                `json:"failed_deliveries"`
	Duplicate            bool               `json:"duplicate,omitempty"`
	Results              []DeliveryResult   `json:"results"`
}

type NotificationRecord struct {
	ID        string               `json:"notification_id"`
	SenderID  string               `json:"sender_id"`
	Subject   string               `json:"subject,omitempty"`
	Message   string               `json:"message"`
	Status    NotificationStatus   `json:"status"`
	Duplicate bool                 `json:"duplicate,omitempty"`
	CreatedAt time.Time            `json:"created_at"`
	UpdatedAt time.Time            `json:"updated_at"`
	Response  NotificationResponse `json:"response"`
}

// ErrorResponse is returned when the request is rejected before any
// delivery is attempted (bad JSON, failed validation, wrong HTTP method).
type ErrorResponse struct {
	Success bool   `json:"success"`
	Message string `json:"message"`
	Error   string `json:"error"`
}

// HealthResponse is returned by GET /health
type HealthResponse struct {
	Status string `json:"status"`
}
