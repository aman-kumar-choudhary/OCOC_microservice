package rfid

import (
	"context"
	"database/sql"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
)

// Repository defines RFID storage operations.
type Repository interface {
	Create(ctx context.Context, tx *sql.Tx, card *Card) error
	GetByID(ctx context.Context, id uuid.UUID) (*Card, error)
	GetByUID(ctx context.Context, uid string) (*Card, error)
	UpdateStatus(ctx context.Context, tx *sql.Tx, id uuid.UUID, status CardStatus, reason string) error
	List(ctx context.Context, f ListFilter) (*ListResult, error)
	Assign(ctx context.Context, tx *sql.Tx, a *Assignment) error
	Unassign(ctx context.Context, tx *sql.Tx, userID, cardID uuid.UUID) error
	GetActiveCardForUser(ctx context.Context, userID uuid.UUID) (*Card, error)
	SyncUserCardStatus(ctx context.Context, tx *sql.Tx, userID uuid.UUID, active bool) error
	UIDExists(ctx context.Context, uid string) (bool, error)
	GetStats(ctx context.Context) (total, active, revoked int, err error)
}

// PostgresRepository implements Repository.
type PostgresRepository struct {
	db *sql.DB
}

// NewPostgresRepository creates a PostgreSQL RFID repository.
func NewPostgresRepository(db *sql.DB) Repository {
	return &PostgresRepository{db: db}
}

func (r *PostgresRepository) Create(ctx context.Context, tx *sql.Tx, card *Card) error {
	exec := execFn(tx, r.db)
	_, err := exec(ctx, `
		INSERT INTO rfid_cards (id, uid, status, issued_at, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6)`,
		card.ID, card.UID, string(card.Status), nullTime(card.IssuedAt), card.CreatedAt, card.UpdatedAt)
	if err != nil {
		if strings.Contains(err.Error(), "rfid_cards_uid_key") || strings.Contains(err.Error(), "duplicate key") {
			return fmt.Errorf("RFID UID already registered: %s", card.UID)
		}
		return err
	}
	return nil
}

func (r *PostgresRepository) GetByID(ctx context.Context, id uuid.UUID) (*Card, error) {
	return r.scanCard(r.db.QueryRowContext(ctx, `
		SELECT id, uid, status, issued_at, revoked_at, COALESCE(revoked_reason,''), created_at, updated_at, NULL AS user_id, NULL AS email
		FROM rfid_cards WHERE id=$1`, id))
}

func (r *PostgresRepository) GetByUID(ctx context.Context, uid string) (*Card, error) {
	return r.scanCard(r.db.QueryRowContext(ctx, `
		SELECT id, uid, status, issued_at, revoked_at, COALESCE(revoked_reason,''), created_at, updated_at, NULL AS user_id, NULL AS email
		FROM rfid_cards WHERE uid=$1`, uid))
}

func (r *PostgresRepository) UpdateStatus(ctx context.Context, tx *sql.Tx, id uuid.UUID, status CardStatus, reason string) error {
	exec := execFn(tx, r.db)
	now := time.Now()
	var revokedAt interface{}
	if status == CardStatusRevoked || status == CardStatusLost || status == CardStatusStolen || status == CardStatusReplaced {
		revokedAt = now
	}
	_, err := exec(ctx, `
		UPDATE rfid_cards SET status=$2, revoked_at=$3, revoked_reason=NULLIF($4,''), updated_at=$5 WHERE id=$1`,
		id, string(status), revokedAt, reason, now)
	return err
}

func (r *PostgresRepository) List(ctx context.Context, f ListFilter) (*ListResult, error) {
	if f.Page < 1 {
		f.Page = 1
	}
	if f.Limit < 1 || f.Limit > 200 {
		f.Limit = 20
	}
	offset := (f.Page - 1) * f.Limit

	var conds []string
	var args []interface{}
	n := 1
	if f.Status != "" {
		conds = append(conds, fmt.Sprintf("rc.status=$%d", n))
		args = append(args, f.Status)
		n++
	}
	where := ""
	if len(conds) > 0 {
		where = "WHERE " + strings.Join(conds, " AND ")
	}

	var total int
	if err := r.db.QueryRowContext(ctx, "SELECT COUNT(*) FROM rfid_cards rc "+where, args...).Scan(&total); err != nil {
		return nil, err
	}

	args = append(args, f.Limit, offset)
	q := fmt.Sprintf(`
		SELECT rc.id, rc.uid, rc.status, rc.issued_at, rc.revoked_at, COALESCE(rc.revoked_reason,''), rc.created_at, rc.updated_at,
		       urc.user_id, u.email
		FROM rfid_cards rc 
		LEFT JOIN user_rfid_cards urc ON urc.rfid_card_id = rc.id AND urc.unassigned_at IS NULL
		LEFT JOIN users u ON u.id = urc.user_id
		%s ORDER BY rc.created_at DESC LIMIT $%d OFFSET $%d`,
		where, len(args)-1, len(args))

	rows, err := r.db.QueryContext(ctx, q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var cards []Card
	for rows.Next() {
		c, err := r.scanCardRow(rows)
		if err == nil {
			cards = append(cards, *c)
		}
	}

	totalPages := (total + f.Limit - 1) / f.Limit
	return &ListResult{Cards: cards, Total: total, Page: f.Page, Limit: f.Limit, TotalPages: totalPages}, nil
}

func (r *PostgresRepository) Assign(ctx context.Context, tx *sql.Tx, a *Assignment) error {
	exec := execFn(tx, r.db)
	_, err := exec(ctx, `
		INSERT INTO user_rfid_cards (user_id, rfid_card_id, assigned_at, is_primary)
		VALUES ($1, $2, $3, $4)`,
		a.UserID, a.RFIDCardID, a.AssignedAt, a.IsPrimary)
	return err
}

func (r *PostgresRepository) Unassign(ctx context.Context, tx *sql.Tx, userID, cardID uuid.UUID) error {
	exec := execFn(tx, r.db)
	_, err := exec(ctx, `
		UPDATE user_rfid_cards SET unassigned_at=$3
		WHERE user_id=$1 AND rfid_card_id=$2 AND unassigned_at IS NULL`,
		userID, cardID, time.Now())
	return err
}

func (r *PostgresRepository) GetActiveCardForUser(ctx context.Context, userID uuid.UUID) (*Card, error) {
	return r.scanCard(r.db.QueryRowContext(ctx, `
		SELECT rc.id, rc.uid, rc.status, rc.issued_at, rc.revoked_at, COALESCE(rc.revoked_reason,''), rc.created_at, rc.updated_at,
		       urc.user_id, u.email
		FROM rfid_cards rc
		JOIN user_rfid_cards urc ON urc.rfid_card_id=rc.id
		JOIN users u ON u.id=urc.user_id
		WHERE urc.user_id=$1 AND urc.is_primary=true AND urc.unassigned_at IS NULL
		LIMIT 1`, userID))
}

func (r *PostgresRepository) SyncUserCardStatus(ctx context.Context, tx *sql.Tx, userID uuid.UUID, active bool) error {
	exec := execFn(tx, r.db)
	now := time.Now()
	
	if active {
		_, err := exec(ctx, `
			UPDATE rfid_cards SET status='active', updated_at=$2, revoked_reason=NULL
			WHERE id IN (
				SELECT rfid_card_id FROM user_rfid_cards WHERE user_id=$1 AND unassigned_at IS NULL
			) AND status='inactive'`, userID, now)
		return err
	} else {
		_, err := exec(ctx, `
			UPDATE rfid_cards SET status='inactive', updated_at=$2, revoked_reason='user_suspended_or_deactivated'
			WHERE id IN (
				SELECT rfid_card_id FROM user_rfid_cards WHERE user_id=$1 AND unassigned_at IS NULL
			) AND status='active'`, userID, now)
		return err
	}
}

func (r *PostgresRepository) UIDExists(ctx context.Context, uid string) (bool, error) {
	var exists bool
	err := r.db.QueryRowContext(ctx, `SELECT EXISTS(SELECT 1 FROM rfid_cards WHERE uid=$1)`, uid).Scan(&exists)
	return exists, err
}

func (r *PostgresRepository) GetStats(ctx context.Context) (total, active, revoked int, err error) {
	err = r.db.QueryRowContext(ctx, `
		SELECT COUNT(*),
			COUNT(*) FILTER (WHERE status='active'),
			COUNT(*) FILTER (WHERE status IN ('revoked','lost','stolen','replaced'))
		FROM rfid_cards`).Scan(&total, &active, &revoked)
	return
}

// ── scanners ──────────────────────────────────────────────────────────────────

type rowScanner interface {
	Scan(dest ...interface{}) error
}

func (r *PostgresRepository) scanCard(row rowScanner) (*Card, error) {
	return r.scanCardRow(row)
}

func (r *PostgresRepository) scanCardRow(row rowScanner) (*Card, error) {
	c := &Card{}
	var issuedAt, revokedAt sql.NullTime
	var status string
	var userIDPtr *uuid.UUID
	var userEmail sql.NullString
	if err := row.Scan(&c.ID, &c.UID, &status, &issuedAt, &revokedAt, &c.RevokedReason, &c.CreatedAt, &c.UpdatedAt, &userIDPtr, &userEmail); err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}
	c.Status = CardStatus(status)
	if userIDPtr != nil {
		c.UserID = userIDPtr
	}
	if userEmail.Valid {
		c.UserEmail = userEmail.String
	}
	c.Status = CardStatus(status)
	if issuedAt.Valid {
		t := issuedAt.Time
		c.IssuedAt = &t
	}
	if revokedAt.Valid {
		t := revokedAt.Time
		c.RevokedAt = &t
	}
	return c, nil
}

// ── helpers ───────────────────────────────────────────────────────────────────

func execFn(tx *sql.Tx, db *sql.DB) func(ctx context.Context, q string, args ...interface{}) (sql.Result, error) {
	if tx != nil {
		return tx.ExecContext
	}
	return db.ExecContext
}

func nullTime(t *time.Time) interface{} {
	if t == nil {
		return nil
	}
	return *t
}
