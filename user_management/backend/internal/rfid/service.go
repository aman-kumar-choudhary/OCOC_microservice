package rfid

import (
	"context"
	"database/sql"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
)

// AuditLogger is implemented by the audit package.
type AuditLogger interface {
	Log(ctx context.Context, actorID, operation, entityType, entityID string, before, after interface{}, ip string) error
}

// Service handles RFID business logic.
type Service struct {
	repo   Repository
	audit  AuditLogger
	reader Reader
	db     *sql.DB
}

// NewService creates an RFID service.
func NewService(repo Repository, audit AuditLogger, reader Reader, db *sql.DB) *Service {
	return &Service{repo: repo, audit: audit, reader: reader, db: db}
}

// ValidateUID checks if a UID is valid and not already in use.
func (s *Service) ValidateUID(ctx context.Context, uid string) (bool, string) {
	uid = strings.ToUpper(strings.TrimSpace(uid))
	if uid == "" {
		return false, "UID is required"
	}
	exists, err := s.repo.UIDExists(ctx, uid)
	if err != nil {
		return false, "database error"
	}
	if exists {
		return false, "RFID UID already registered"
	}
	return true, ""
}

// Assign assigns a new RFID UID to a user inside a transaction.
func (s *Service) Assign(ctx context.Context, actorID string, req AssignRequest) (*Card, error) {
	userID, err := uuid.Parse(req.UserID)
	if err != nil {
		return nil, fmt.Errorf("invalid user_id")
	}
	uid := strings.ToUpper(strings.TrimSpace(req.UID))
	if uid == "" {
		return nil, fmt.Errorf("uid is required")
	}

	// Check duplicate.
	if exists, _ := s.repo.UIDExists(ctx, uid); exists {
		return nil, fmt.Errorf("RFID_ALREADY_ASSIGNED: UID %s is already registered", uid)
	}

	now := time.Now()
	card := &Card{
		ID:        uuid.New(),
		UID:       uid,
		Status:    CardStatusActive,
		IssuedAt:  &now,
		CreatedAt: now,
		UpdatedAt: now,
	}

	err = withTx(ctx, s.db, func(tx *sql.Tx) error {
		if err := s.repo.Create(ctx, tx, card); err != nil {
			return err
		}
		return s.repo.Assign(ctx, tx, &Assignment{
			UserID:     userID,
			RFIDCardID: card.ID,
			AssignedAt: now,
			IsPrimary:  true,
		})
	})
	if err != nil {
		return nil, err
	}

	_ = s.audit.Log(ctx, actorID, "ASSIGN_RFID", "rfid_card", card.ID.String(), nil, card, "")
	return card, nil
}

// Replace atomically replaces a user's RFID card.
// This is a critical atomic operation: old card is revoked only if new card is successfully created.
func (s *Service) Replace(ctx context.Context, actorID string, req ReplaceRequest) (*Card, error) {
	userID, err := uuid.Parse(req.UserID)
	if err != nil {
		return nil, fmt.Errorf("invalid user_id")
	}
	newUID := strings.ToUpper(strings.TrimSpace(req.NewUID))
	if newUID == "" {
		return nil, fmt.Errorf("new_uid is required")
	}

	// Check new UID is not already in use.
	if exists, _ := s.repo.UIDExists(ctx, newUID); exists {
		return nil, fmt.Errorf("RFID_ALREADY_ASSIGNED: UID %s is already registered", newUID)
	}

	now := time.Now()
	newCard := &Card{
		ID:        uuid.New(),
		UID:       newUID,
		Status:    CardStatusActive,
		IssuedAt:  &now,
		CreatedAt: now,
		UpdatedAt: now,
	}

	var oldCard *Card

	// ── atomic transaction ────────────────────────────────────────────────────
	err = withTx(ctx, s.db, func(tx *sql.Tx) error {
		// 1. Get current card.
		old, err := s.repo.GetActiveCardForUser(ctx, userID)
		if err != nil {
			return err
		}

		// 2. Mark old card as replaced/lost/stolen.
		oldStatus := CardStatusReplaced
		if req.Reason == "lost" {
			oldStatus = CardStatusLost
		} else if req.Reason == "stolen" {
			oldStatus = CardStatusStolen
		}
		if old != nil {
			oldCard = old
			if err := s.repo.UpdateStatus(ctx, tx, old.ID, oldStatus, req.Reason); err != nil {
				return fmt.Errorf("revoke old card: %w", err)
			}
			// Unassign old card from user.
			if err := s.repo.Unassign(ctx, tx, userID, old.ID); err != nil {
				return fmt.Errorf("unassign old card: %w", err)
			}
		}

		// 3. Create new card.
		if err := s.repo.Create(ctx, tx, newCard); err != nil {
			return fmt.Errorf("create new card: %w", err)
		}

		// 4. Assign new card to user.
		if err := s.repo.Assign(ctx, tx, &Assignment{
			UserID:     userID,
			RFIDCardID: newCard.ID,
			AssignedAt: now,
			IsPrimary:  true,
		}); err != nil {
			return fmt.Errorf("assign new card: %w", err)
		}

		return nil
		// If any step fails, ALL steps roll back — no partial state.
	})
	if err != nil {
		return nil, err
	}

	_ = s.audit.Log(ctx, actorID, "REPLACE_RFID", "rfid_card", newCard.ID.String(),
		map[string]interface{}{"old_card": oldCard},
		map[string]interface{}{"new_card": newCard},
		"")
	return newCard, nil
}

// Revoke revokes a specific RFID card.
func (s *Service) Revoke(ctx context.Context, actorID string, cardID uuid.UUID, reason string) error {
	before, err := s.repo.GetByID(ctx, cardID)
	if err != nil || before == nil {
		return fmt.Errorf("card not found")
	}

	if err := s.repo.UpdateStatus(ctx, nil, cardID, CardStatusRevoked, reason); err != nil {
		return err
	}
	_ = s.audit.Log(ctx, actorID, "REVOKE_RFID", "rfid_card", cardID.String(), before, nil, "")
	return nil
}

// Activate activates an inactive card.
func (s *Service) Activate(ctx context.Context, actorID string, cardID uuid.UUID) error {
	return s.repo.UpdateStatus(ctx, nil, cardID, CardStatusActive, "")
}

// Deactivate deactivates a card without revoking it.
func (s *Service) Deactivate(ctx context.Context, actorID string, cardID uuid.UUID) error {
	return s.repo.UpdateStatus(ctx, nil, cardID, CardStatusInactive, "")
}

// List returns a paginated RFID directory.
func (s *Service) List(ctx context.Context, f ListFilter) (*ListResult, error) {
	return s.repo.List(ctx, f)
}

// GetByUID retrieves a card by its UID.
func (s *Service) GetByUID(ctx context.Context, uid string) (*Card, error) {
	c, err := s.repo.GetByUID(ctx, uid)
	if err != nil {
		return nil, err
	}
	if c == nil {
		return nil, fmt.Errorf("card not found")
	}
	return c, nil
}

// GetByID retrieves a card by ID.
func (s *Service) GetByID(ctx context.Context, id uuid.UUID) (*Card, error) {
	c, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if c == nil {
		return nil, fmt.Errorf("card not found")
	}
	return c, nil
}

// RevokeAllForUser revokes all RFID cards for a user (used on suspend/deactivate).
func (s *Service) RevokeAllForUser(ctx context.Context, tx *sql.Tx, userID uuid.UUID) error {
	return s.repo.RevokeAllForUser(ctx, tx, userID)
}

// Scan triggers the RFID reader to scan a card.
func (s *Service) Scan(ctx context.Context) (*ScanResult, error) {
	if err := s.reader.StartScan(ctx); err != nil {
		return nil, fmt.Errorf("start scan: %w", err)
	}
	defer s.reader.StopScan()
	return s.reader.ReadCard(ctx)
}

// GetReaderStatus returns the current RFID reader status.
func (s *Service) GetReaderStatus() ReaderStatus {
	return s.reader.GetStatus()
}

// Stats returns RFID statistics.
func (s *Service) Stats(ctx context.Context) (total, active, revoked int, err error) {
	return s.repo.GetStats(ctx)
}

func withTx(ctx context.Context, db *sql.DB, fn func(*sql.Tx) error) error {
	tx, err := db.BeginTx(ctx, &sql.TxOptions{Isolation: sql.LevelSerializable})
	if err != nil {
		return fmt.Errorf("begin tx: %w", err)
	}
	if err := fn(tx); err != nil {
		_ = tx.Rollback()
		return err
	}
	return tx.Commit()
}
