package rfid

import (
	"time"

	"github.com/google/uuid"
)

// CardStatus enumerates RFID card states.
type CardStatus string

const (
	CardStatusActive   CardStatus = "active"
	CardStatusInactive CardStatus = "inactive"
	CardStatusLost     CardStatus = "lost"
	CardStatusStolen   CardStatus = "stolen"
	CardStatusReplaced CardStatus = "replaced"
	CardStatusRevoked  CardStatus = "revoked"
)

// Card represents a physical RFID card.
type Card struct {
	ID            uuid.UUID  `json:"id"`
	UID           string     `json:"uid"`
	Status        CardStatus `json:"status"`
	IssuedAt      *time.Time `json:"issued_at,omitempty"`
	RevokedAt     *time.Time `json:"revoked_at,omitempty"`
	RevokedReason string     `json:"revoked_reason,omitempty"`
	CreatedAt     time.Time  `json:"created_at"`
	UpdatedAt     time.Time  `json:"updated_at"`
	// Joined fields
	UserID    *uuid.UUID `json:"user_id,omitempty"`
	UserEmail string     `json:"user_email,omitempty"`
}

// Assignment links a card to a user.
type Assignment struct {
	UserID       uuid.UUID  `json:"user_id"`
	RFIDCardID   uuid.UUID  `json:"rfid_card_id"`
	AssignedAt   time.Time  `json:"assigned_at"`
	UnassignedAt *time.Time `json:"unassigned_at,omitempty"`
	IsPrimary    bool       `json:"is_primary"`
}

// ValidateRequest checks if a UID is available.
type ValidateRequest struct {
	UID string `json:"uid"`
}

// AssignRequest assigns a card to a user.
type AssignRequest struct {
	UserID string `json:"user_id"`
	UID    string `json:"uid"`
}

// ReplaceRequest replaces a user's current card atomically.
type ReplaceRequest struct {
	UserID string `json:"user_id"`
	NewUID string `json:"new_uid"`
	Reason string `json:"reason"` // lost, stolen, damaged
}

// RevokeRequest revokes a specific card.
type RevokeRequest struct {
	Reason string `json:"reason"`
}

// ReaderStatus is the RFID enrollment reader state.
type ReaderStatus string

const (
	ReaderIdle       ReaderStatus = "IDLE"
	ReaderScanning   ReaderStatus = "SCANNING"
	ReaderProcessing ReaderStatus = "PROCESSING"
	ReaderError      ReaderStatus = "ERROR"
)

// ScanResult is emitted when a card is read.
type ScanResult struct {
	UID    string `json:"uid"`
	Status string `json:"status"`
	Error  string `json:"error,omitempty"`
}

// ListFilter for RFID directory queries.
type ListFilter struct {
	Status string
	UserID string
	Page   int
	Limit  int
}

// ListResult is a paginated RFID list.
type ListResult struct {
	Cards      []Card `json:"cards"`
	Total      int    `json:"total"`
	Page       int    `json:"page"`
	Limit      int    `json:"limit"`
	TotalPages int    `json:"total_pages"`
}
