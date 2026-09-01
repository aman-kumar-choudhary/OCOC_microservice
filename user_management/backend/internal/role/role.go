package role

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	"github.com/google/uuid"
)

// Role is a named permission template.
type Role struct {
	ID          uuid.UUID `json:"id"`
	Name        string    `json:"name"`
	Description string    `json:"description"`
	UserType    string    `json:"user_type,omitempty"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

// Repository defines role storage operations.
type Repository interface {
	Create(ctx context.Context, r *Role) error
	GetByID(ctx context.Context, id uuid.UUID) (*Role, error)
	List(ctx context.Context) ([]Role, error)
	Update(ctx context.Context, r *Role) error
	AssignToUser(ctx context.Context, tx *sql.Tx, userID, roleID uuid.UUID, assignedBy string) error
	RemoveFromUser(ctx context.Context, tx *sql.Tx, userID, roleID uuid.UUID) error
	GetUserRoles(ctx context.Context, userID uuid.UUID) ([]Role, error)
}

// PostgresRepository implements Repository.
type PostgresRepository struct {
	db *sql.DB
}

// NewPostgresRepository creates a PostgreSQL role repository.
func NewPostgresRepository(db *sql.DB) Repository {
	return &PostgresRepository{db: db}
}

func (r *PostgresRepository) Create(ctx context.Context, role *Role) error {
	_, err := r.db.ExecContext(ctx, `
		INSERT INTO roles (id, name, description, user_type, created_at, updated_at)
		VALUES ($1, $2, $3, NULLIF($4,''), $5, $6)`,
		role.ID, role.Name, role.Description, role.UserType, role.CreatedAt, role.UpdatedAt)
	return err
}

func (r *PostgresRepository) GetByID(ctx context.Context, id uuid.UUID) (*Role, error) {
	role := &Role{}
	var userType sql.NullString
	err := r.db.QueryRowContext(ctx, `
		SELECT id, name, description, COALESCE(user_type,''), created_at, updated_at
		FROM roles WHERE id=$1`, id).
		Scan(&role.ID, &role.Name, &role.Description, &userType, &role.CreatedAt, &role.UpdatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	role.UserType = userType.String
	return role, err
}

func (r *PostgresRepository) List(ctx context.Context) ([]Role, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT id, name, description, COALESCE(user_type,''), created_at, updated_at
		FROM roles ORDER BY name`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var roles []Role
	for rows.Next() {
		var role Role
		var userType sql.NullString
		if err := rows.Scan(&role.ID, &role.Name, &role.Description, &userType, &role.CreatedAt, &role.UpdatedAt); err != nil {
			continue
		}
		role.UserType = userType.String
		roles = append(roles, role)
	}
	return roles, nil
}

func (r *PostgresRepository) Update(ctx context.Context, role *Role) error {
	_, err := r.db.ExecContext(ctx, `
		UPDATE roles SET name=$2, description=$3, user_type=NULLIF($4,''), updated_at=$5 WHERE id=$1`,
		role.ID, role.Name, role.Description, role.UserType, role.UpdatedAt)
	return err
}

func (r *PostgresRepository) AssignToUser(ctx context.Context, tx *sql.Tx, userID, roleID uuid.UUID, assignedBy string) error {
	var assignedByID interface{}
	if assignedBy != "" {
		if id, err := uuid.Parse(assignedBy); err == nil {
			assignedByID = id
		}
	}
	var execFn func(ctx context.Context, query string, args ...interface{}) (sql.Result, error)
	if tx != nil {
		execFn = tx.ExecContext
	} else {
		execFn = r.db.ExecContext
	}
	_, err := execFn(ctx, `
		INSERT INTO user_roles (user_id, role_id, assigned_at, assigned_by)
		VALUES ($1, $2, $3, $4)
		ON CONFLICT (user_id, role_id) DO NOTHING`,
		userID, roleID, time.Now(), assignedByID)
	return err
}

func (r *PostgresRepository) RemoveFromUser(ctx context.Context, tx *sql.Tx, userID, roleID uuid.UUID) error {
	var execFn func(ctx context.Context, query string, args ...interface{}) (sql.Result, error)
	if tx != nil {
		execFn = tx.ExecContext
	} else {
		execFn = r.db.ExecContext
	}
	_, err := execFn(ctx, `DELETE FROM user_roles WHERE user_id=$1 AND role_id=$2`, userID, roleID)
	return err
}

func (r *PostgresRepository) GetUserRoles(ctx context.Context, userID uuid.UUID) ([]Role, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT ro.id, ro.name, ro.description, COALESCE(ro.user_type,''), ro.created_at, ro.updated_at
		FROM roles ro
		JOIN user_roles ur ON ur.role_id=ro.id
		WHERE ur.user_id=$1`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var roles []Role
	for rows.Next() {
		var role Role
		rows.Scan(&role.ID, &role.Name, &role.Description, &role.UserType, &role.CreatedAt, &role.UpdatedAt)
		roles = append(roles, role)
	}
	return roles, nil
}

// Service handles role business logic.
type Service struct {
	repo Repository
}

// NewService creates a role service.
func NewService(repo Repository) *Service {
	return &Service{repo: repo}
}

// Create creates a new role.
func (s *Service) Create(ctx context.Context, name, description, userType string) (*Role, error) {
	if name == "" {
		return nil, fmt.Errorf("role name is required")
	}
	now := time.Now()
	role := &Role{
		ID:          uuid.New(),
		Name:        name,
		Description: description,
		UserType:    userType,
		CreatedAt:   now,
		UpdatedAt:   now,
	}
	if err := s.repo.Create(ctx, role); err != nil {
		return nil, fmt.Errorf("create role: %w", err)
	}
	return role, nil
}

// List returns all roles.
func (s *Service) List(ctx context.Context) ([]Role, error) {
	return s.repo.List(ctx)
}

// Assign assigns a role to a user.
func (s *Service) Assign(ctx context.Context, userID, roleID uuid.UUID, assignedBy string) error {
	return s.repo.AssignToUser(ctx, nil, userID, roleID, assignedBy)
}

// Remove removes a role from a user.
func (s *Service) Remove(ctx context.Context, userID, roleID uuid.UUID) error {
	return s.repo.RemoveFromUser(ctx, nil, userID, roleID)
}

// GetUserRoles lists roles assigned to a user.
func (s *Service) GetUserRoles(ctx context.Context, userID uuid.UUID) ([]Role, error) {
	return s.repo.GetUserRoles(ctx, userID)
}
