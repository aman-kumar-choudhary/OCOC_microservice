package user

import (
	"context"
	"database/sql"
	"testing"
	"github.com/google/uuid"
)

type mockRepo struct {
	Repository
	user *User
}

func (m *mockRepo) GetByID(ctx context.Context, id uuid.UUID) (*User, error) {
	return m.user, nil
}

func (m *mockRepo) UpdateStatus(ctx context.Context, tx *sql.Tx, id uuid.UUID, status UserStatus) error {
	m.user.Status = status
	return nil
}

type mockAudit struct{}

func (m *mockAudit) Log(ctx context.Context, actorID, op, entity, entityID string, before, after interface{}, ip string) error {
	return nil
}

type mockRFID struct {
	lastSyncActive bool
	syncCount      int
}

func (m *mockRFID) SyncUserCardStatus(ctx context.Context, tx *sql.Tx, userID uuid.UUID, active bool) error {
	m.lastSyncActive = active
	m.syncCount++
	return nil
}

// mockDB provides a dummy *sql.DB for testing service tx wrapper without a real connection.
// We avoid calling actual DB methods by skipping tx wrapping in a completely isolated test,
// but since `changeStatus` calls `withTx(ctx, s.db)`, this would fail.
// So we override withTx package variable for tests.

func TestService_ChangeStatus_RFID_Sync(t *testing.T) {
	originalWithTx := withTx
	defer func() { withTx = originalWithTx }()

	// Mock withTx to just execute the function without a real sql.Tx
	withTx = func(ctx context.Context, db *sql.DB, fn func(*sql.Tx) error) error {
		return fn(nil)
	}

	uid := uuid.New()
	mockR := &mockRepo{user: &User{ID: uid, Status: StatusActive}}
	mockRfid := &mockRFID{}

	svc := NewService(mockR, nil, nil, &mockAudit{}, mockRfid, nil)

	ctx := context.Background()

	// 1. Active -> Suspended
	err := svc.changeStatus(ctx, "admin", uid, StatusSuspended, "SUSPEND", "127.0.0.1")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if mockRfid.syncCount != 1 {
		t.Errorf("expected 1 rfid sync, got %d", mockRfid.syncCount)
	}
	if mockRfid.lastSyncActive != false {
		t.Errorf("expected rfid sync active=false for suspended user")
	}

	// 2. Suspended -> Active
	err = svc.changeStatus(ctx, "admin", uid, StatusActive, "ACTIVATE", "127.0.0.1")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if mockRfid.syncCount != 2 {
		t.Errorf("expected 2 rfid syncs, got %d", mockRfid.syncCount)
	}
	if mockRfid.lastSyncActive != true {
		t.Errorf("expected rfid sync active=true for active user")
	}

	// 3. Active -> Deactivated
	err = svc.changeStatus(ctx, "admin", uid, StatusDeactivated, "DEACTIVATE", "127.0.0.1")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if mockRfid.syncCount != 3 {
		t.Errorf("expected 3 rfid syncs, got %d", mockRfid.syncCount)
	}
	if mockRfid.lastSyncActive != false {
		t.Errorf("expected rfid sync active=false for deactivated user")
	}
}
