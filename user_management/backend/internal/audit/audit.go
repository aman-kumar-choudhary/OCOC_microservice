package audit

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
)

// Log is an immutable audit event record.
type Log struct {
	ID          uuid.UUID       `json:"id"`
	ActorID     string          `json:"actor_id,omitempty"`
	Operation   string          `json:"operation"`
	EntityType  string          `json:"entity_type"`
	EntityID    string          `json:"entity_id"`
	BeforeState json.RawMessage `json:"before_state,omitempty"`
	AfterState  json.RawMessage `json:"after_state,omitempty"`
	IPAddress   string          `json:"ip_address,omitempty"`
	UserAgent   string          `json:"user_agent,omitempty"`
	CreatedAt   time.Time       `json:"created_at"`
}

// ListFilter for audit log queries.
type ListFilter struct {
	ActorID    string
	Operation  string
	EntityType string
	EntityID   string
	Page       int
	Limit      int
}

// ListResult is a paginated audit log response.
type ListResult struct {
	Logs       []Log `json:"logs"`
	Total      int   `json:"total"`
	Page       int   `json:"page"`
	Limit      int   `json:"limit"`
	TotalPages int   `json:"total_pages"`
}

// Repository defines audit storage (append-only).
type Repository interface {
	Insert(ctx context.Context, log *Log) error
	GetByID(ctx context.Context, id uuid.UUID) (*Log, error)
	List(ctx context.Context, f ListFilter) (*ListResult, error)
}

// PostgresRepository implements Repository.
type PostgresRepository struct {
	db *sql.DB
}

// NewPostgresRepository creates a PostgreSQL audit repository.
func NewPostgresRepository(db *sql.DB) Repository {
	return &PostgresRepository{db: db}
}

func (r *PostgresRepository) Insert(ctx context.Context, l *Log) error {
	before, _ := json.Marshal(l.BeforeState)
	after, _ := json.Marshal(l.AfterState)
	_, err := r.db.ExecContext(ctx, `
		INSERT INTO audit_logs (id, actor_id, operation, entity_type, entity_id, before_state, after_state, ip_address, user_agent, created_at)
		VALUES ($1, NULLIF($2,'')::uuid, $3, $4, $5, $6::jsonb, $7::jsonb, NULLIF($8,''), NULLIF($9,''), $10)`,
		l.ID, l.ActorID, l.Operation, l.EntityType, l.EntityID,
		nullJSON(before), nullJSON(after),
		l.IPAddress, l.UserAgent, l.CreatedAt)
	return err
}

func (r *PostgresRepository) GetByID(ctx context.Context, id uuid.UUID) (*Log, error) {
	l := &Log{}
	var actorID sql.NullString
	var ip, ua sql.NullString
	var before, after []byte
	err := r.db.QueryRowContext(ctx, `
		SELECT id, COALESCE(actor_id::text,''), operation, entity_type, entity_id,
			before_state, after_state, COALESCE(ip_address,''), COALESCE(user_agent,''), created_at
		FROM audit_logs WHERE id=$1`, id).
		Scan(&l.ID, &actorID, &l.Operation, &l.EntityType, &l.EntityID,
			&before, &after, &ip, &ua, &l.CreatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	l.ActorID = actorID.String
	l.IPAddress = ip.String
	l.UserAgent = ua.String
	l.BeforeState = json.RawMessage(before)
	l.AfterState = json.RawMessage(after)
	return l, nil
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

	if f.ActorID != "" {
		conds = append(conds, fmt.Sprintf("actor_id=$%d", n))
		args = append(args, f.ActorID)
		n++
	}
	if f.Operation != "" {
		conds = append(conds, fmt.Sprintf("operation=$%d", n))
		args = append(args, f.Operation)
		n++
	}
	if f.EntityType != "" {
		conds = append(conds, fmt.Sprintf("entity_type=$%d", n))
		args = append(args, f.EntityType)
		n++
	}
	if f.EntityID != "" {
		conds = append(conds, fmt.Sprintf("entity_id=$%d", n))
		args = append(args, f.EntityID)
		n++
	}

	where := ""
	if len(conds) > 0 {
		where = "WHERE " + strings.Join(conds, " AND ")
	}

	var total int
	if err := r.db.QueryRowContext(ctx, "SELECT COUNT(*) FROM audit_logs "+where, args...).Scan(&total); err != nil {
		return nil, err
	}

	args = append(args, f.Limit, offset)
	q := fmt.Sprintf(`
		SELECT id, COALESCE(actor_id::text,''), operation, entity_type, entity_id,
			COALESCE(before_state,'null'::jsonb), COALESCE(after_state,'null'::jsonb),
			COALESCE(ip_address,''), COALESCE(user_agent,''), created_at
		FROM audit_logs %s ORDER BY created_at DESC LIMIT $%d OFFSET $%d`,
		where, len(args)-1, len(args))

	rows, err := r.db.QueryContext(ctx, q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var logs []Log
	for rows.Next() {
		var l Log
		var before, after []byte
		if err := rows.Scan(&l.ID, &l.ActorID, &l.Operation, &l.EntityType, &l.EntityID,
			&before, &after, &l.IPAddress, &l.UserAgent, &l.CreatedAt); err != nil {
			continue
		}
		l.BeforeState = json.RawMessage(before)
		l.AfterState = json.RawMessage(after)
		logs = append(logs, l)
	}

	totalPages := (total + f.Limit - 1) / f.Limit
	return &ListResult{Logs: logs, Total: total, Page: f.Page, Limit: f.Limit, TotalPages: totalPages}, nil
}

// Service provides audit logging.
type Service struct {
	repo Repository
}

// NewService creates an audit service.
func NewService(repo Repository) *Service {
	return &Service{repo: repo}
}

// Log records an audit event. Errors are non-fatal and logged internally.
func (s *Service) Log(ctx context.Context, actorID, operation, entityType, entityID string, before, after interface{}, ip string) error {
	beforeJSON, _ := json.Marshal(before)
	afterJSON, _ := json.Marshal(after)
	l := &Log{
		ID:          uuid.New(),
		ActorID:     actorID,
		Operation:   operation,
		EntityType:  entityType,
		EntityID:    entityID,
		BeforeState: json.RawMessage(beforeJSON),
		AfterState:  json.RawMessage(afterJSON),
		IPAddress:   ip,
		CreatedAt:   time.Now(),
	}
	return s.repo.Insert(ctx, l)
}

// List returns paginated audit logs.
func (s *Service) List(ctx context.Context, f ListFilter) (*ListResult, error) {
	return s.repo.List(ctx, f)
}

// GetByID returns a single audit log entry.
func (s *Service) GetByID(ctx context.Context, id uuid.UUID) (*Log, error) {
	return s.repo.GetByID(ctx, id)
}

func nullJSON(b []byte) interface{} {
	if len(b) == 0 || string(b) == "null" {
		return nil
	}
	return string(b)
}
