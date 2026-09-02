package user

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/csv"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/ococ/user-management/internal/infrastructure/keycloak"
	"github.com/ococ/user-management/internal/infrastructure/redis"
)

// AuditLogger is implemented by the audit package to avoid circular imports.
type AuditLogger interface {
	Log(ctx context.Context, actorID, operation, entityType, entityID string, before, after interface{}, ip string) error
}

// RFIDRevoker allows user service to revoke RFID on suspend/deactivate.
type RFIDRevoker interface {
	RevokeAllForUser(ctx context.Context, tx *sql.Tx, userID uuid.UUID) error
}

// Service handles user business logic.
type Service struct {
	repo  Repository
	kc    *keycloak.Client
	redis *redis.Client
	audit AuditLogger
	rfid  RFIDRevoker
	db    *sql.DB
}

// NewService creates a user service.
func NewService(repo Repository, kc *keycloak.Client, rc *redis.Client, audit AuditLogger, rfid RFIDRevoker, db *sql.DB) *Service {
	return &Service{repo: repo, kc: kc, redis: rc, audit: audit, rfid: rfid, db: db}
}

// Create creates a new user, syncing with Keycloak in a transaction.
func (s *Service) Create(ctx context.Context, actorID string, req CreateUserRequest) (*User, error) {
	if err := validateCreateRequest(req); err != nil {
		return nil, err
	}

	// Check email uniqueness.
	if exists, _ := s.repo.ExistsByEmail(ctx, req.Email); exists {
		return nil, fmt.Errorf("email already registered")
	}
	if req.Phone != "" {
		if exists, _ := s.repo.ExistsByPhone(ctx, req.Phone); exists {
			return nil, fmt.Errorf("phone number already registered")
		}
	}

	now := time.Now()
	u := &User{
		ID:        uuid.New(),
		UserType:  req.UserType,
		Status:    StatusActive,
		Email:     req.Email,
		Phone:     req.Phone,
		CreatedAt: now,
		UpdatedAt: now,
	}

	p := profileFromRequest(u.ID, req.Profile, now)

	var kcID string
	// Pass 1: Perform DB creation
	err := withTx(ctx, s.db, func(tx *sql.Tx) error {
		if err := s.repo.Create(ctx, tx, u); err != nil {
			return err
		}
		return s.repo.CreateProfile(ctx, tx, p)
	})
	if err != nil {
		return nil, err
	}

	// Pass 2: Sync to Keycloak
	parts := strings.SplitN(req.Profile.FullName, " ", 2)
	firstName, lastName := parts[0], ""
	if len(parts) > 1 {
		lastName = parts[1]
	}
	kcID, err = s.kc.CreateUser(ctx, keycloak.KeycloakUser{
		Username:  req.Email,
		Email:     req.Email,
		FirstName: firstName,
		LastName:  lastName,
		Enabled:   true,
		Credentials: []keycloak.KCCredential{{
			// Login uses the OAuth password grant, which cannot complete Keycloak's
			// UPDATE_PASSWORD required action. A temporary password would therefore
			// make every newly provisioned account unable to log in.
			Type: "password", Value: req.Password, Temporary: false,
		}},
		Attributes: map[string][]string{
			"user_type": {string(req.UserType)},
			"user_id":   {u.ID.String()},
		},
	})
	if err != nil {
		// Rollback DB creation if Keycloak fails
		_ = withTx(ctx, s.db, func(tx *sql.Tx) error {
			return s.repo.UpdateStatus(ctx, tx, u.ID, StatusDeactivated)
		})
		return nil, fmt.Errorf("keycloak sync: %w", err)
	}

	// Pass 3: Update DB with Keycloak User ID
	err = withTx(ctx, s.db, func(tx *sql.Tx) error {
		return s.repo.UpdateKeycloakID(ctx, tx, u.ID, kcID)
	})
	if err != nil {
		// Compensation: disable user in Keycloak if updating keycloak_user_id in DB fails
		_ = s.kc.DisableUser(ctx, kcID)
		return nil, fmt.Errorf("failed to link Keycloak ID: %w", err)
	}

	u.KeycloakUserID = kcID
	u.Profile = p

	_ = s.audit.Log(ctx, actorID, "CREATE_USER", "user", u.ID.String(), nil, u, "")
	return u, nil
}

// GetByID retrieves a user by ID.
func (s *Service) GetByID(ctx context.Context, id uuid.UUID) (*User, error) {
	u, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if u == nil {
		return nil, fmt.Errorf("user not found")
	}
	return u, nil
}

// Update updates a user's profile.
func (s *Service) Update(ctx context.Context, actorID string, id uuid.UUID, req UpdateUserRequest) (*User, error) {
	before, err := s.repo.GetByID(ctx, id)
	if err != nil || before == nil {
		return nil, fmt.Errorf("user not found")
	}

	now := time.Now()
	before.Phone = orString(req.Phone, before.Phone)
	before.UpdatedAt = now

	var p *Profile
	if req.Profile != nil {
		existing := before.Profile
		if existing == nil {
			existing = &Profile{UserID: id}
		}
		applyProfileRequest(existing, *req.Profile, now)
		p = existing
	}

	err = withTx(ctx, s.db, func(tx *sql.Tx) error {
		if err := s.repo.Update(ctx, tx, before); err != nil {
			return err
		}
		if p != nil {
			return s.repo.UpdateProfile(ctx, tx, p)
		}
		return nil
	})
	if err != nil {
		return nil, err
	}

	after, _ := s.repo.GetByID(ctx, id)
	_ = s.audit.Log(ctx, actorID, "UPDATE_USER", "user", id.String(), before, after, "")
	return after, nil
}

// List returns a paginated, filtered user list.
func (s *Service) List(ctx context.Context, f ListFilter) (*ListResult, error) {
	return s.repo.List(ctx, f)
}

// Suspend suspends a user — revokes RFID access and invalidates Keycloak sessions.
func (s *Service) Suspend(ctx context.Context, actorID string, id uuid.UUID, ip string) error {
	return s.changeStatus(ctx, actorID, id, StatusSuspended, "SUSPEND_USER", ip)
}

// Activate re-activates a suspended user.
func (s *Service) Activate(ctx context.Context, actorID string, id uuid.UUID, ip string) error {
	return s.changeStatus(ctx, actorID, id, StatusActive, "ACTIVATE_USER", ip)
}

// Deactivate permanently deactivates a user.
func (s *Service) Deactivate(ctx context.Context, actorID string, id uuid.UUID, ip string) error {
	return s.changeStatus(ctx, actorID, id, StatusDeactivated, "DEACTIVATE_USER", ip)
}

func (s *Service) changeStatus(ctx context.Context, actorID string, id uuid.UUID, newStatus UserStatus, op, ip string) error {
	before, err := s.repo.GetByID(ctx, id)
	if err != nil || before == nil {
		return fmt.Errorf("user not found")
	}

	err = withTx(ctx, s.db, func(tx *sql.Tx) error {
		if err := s.repo.UpdateStatus(ctx, tx, id, newStatus); err != nil {
			return err
		}
		if newStatus == StatusSuspended || newStatus == StatusDeactivated {
			if s.rfid != nil {
				if err := s.rfid.RevokeAllForUser(ctx, tx, id); err != nil {
					return err
				}
			}
		}
		return nil
	})
	if err != nil {
		return err
	}

	// Post-transaction: invalidate Keycloak sessions and Redis cache.
	if before.KeycloakUserID != "" {
		if newStatus == StatusSuspended || newStatus == StatusDeactivated {
			_ = s.kc.DisableUser(ctx, before.KeycloakUserID)
			_ = s.kc.LogoutAllSessions(ctx, before.KeycloakUserID)
		} else if newStatus == StatusActive {
			_ = s.kc.EnableUser(ctx, before.KeycloakUserID)
		}
	}
	if s.redis != nil {
		_ = s.redis.InvalidatePermissions(ctx, id.String())
	}

	after := *before
	after.Status = newStatus
	_ = s.audit.Log(ctx, actorID, op, "user", id.String(), before, &after, ip)
	return nil
}

// Stats returns user count statistics.
func (s *Service) Stats(ctx context.Context) (*Stats, error) {
	return s.repo.Stats(ctx)
}

// GetKeycloakIDByEmail looks up a user's Keycloak ID by email (used by auth service).
func (s *Service) GetKeycloakIDByEmail(ctx context.Context, email string) (string, bool, error) {
	return s.repo.GetKeycloakIDByEmail(ctx, email)
}

// BulkImportResult summarises a CSV import operation.
type BulkImportResult struct {
	TotalRows   int        `json:"total_rows"`
	ValidRows   int        `json:"valid_rows"`
	InvalidRows int        `json:"invalid_rows"`
	CreatedRows int        `json:"created_rows"`
	FailedRows  int        `json:"failed_rows"`
	Errors      []RowError `json:"errors"`
}

// RowError describes a validation error on a specific CSV row.
type RowError struct {
	Row   int    `json:"row"`
	Field string `json:"field"`
	Error string `json:"error"`
}

// CSVImport validates and imports users from CSV bytes.
func (s *Service) CSVImport(ctx context.Context, actorID string, data []byte) (*BulkImportResult, error) {
	r := csv.NewReader(bytes.NewReader(data))
	records, err := r.ReadAll()
	if err != nil {
		return nil, fmt.Errorf("parse CSV: %w", err)
	}
	if len(records) < 2 {
		return &BulkImportResult{}, nil
	}

	result := &BulkImportResult{TotalRows: len(records) - 1}
	var validRequests []CreateUserRequest

	// Pass 1: validate all rows — collect errors without committing.
	for i, row := range records[1:] {
		rowNum := i + 2
		if len(row) < 5 {
			result.InvalidRows++
			result.Errors = append(result.Errors, RowError{Row: rowNum, Field: "row", Error: "insufficient columns"})
			continue
		}
		req := CreateUserRequest{
			Email:    strings.TrimSpace(row[0]),
			Phone:    strings.TrimSpace(row[1]),
			UserType: UserType(strings.ToLower(strings.TrimSpace(row[2]))),
			Password: "Welcome@123!", // temporary password
			Profile: ProfileRequest{
				FullName:   strings.TrimSpace(row[3]),
				RollNumber: strings.TrimSpace(row[4]),
			},
		}
		if len(row) > 5 {
			req.Profile.EmployeeID = strings.TrimSpace(row[5])
		}

		var rowErrors []RowError
		if req.Email == "" {
			rowErrors = append(rowErrors, RowError{Row: rowNum, Field: "email", Error: "required"})
		}
		if !strings.Contains(req.Email, "@") {
			rowErrors = append(rowErrors, RowError{Row: rowNum, Field: "email", Error: "invalid format"})
		}
		if req.Profile.FullName == "" {
			rowErrors = append(rowErrors, RowError{Row: rowNum, Field: "full_name", Error: "required"})
		}
		validType := req.UserType == UserTypeStudent || req.UserType == UserTypeFaculty || req.UserType == UserTypeWorker
		if !validType {
			rowErrors = append(rowErrors, RowError{Row: rowNum, Field: "user_type", Error: "must be student, faculty, or worker"})
		}
		if exists, _ := s.repo.ExistsByEmail(ctx, req.Email); exists {
			rowErrors = append(rowErrors, RowError{Row: rowNum, Field: "email", Error: "already registered"})
		}

		if len(rowErrors) > 0 {
			result.InvalidRows++
			result.Errors = append(result.Errors, rowErrors...)
			continue
		}
		result.ValidRows++
		validRequests = append(validRequests, req)
	}

	// Pass 2: import valid rows in batches.
	for _, req := range validRequests {
		if _, err := s.Create(ctx, actorID, req); err != nil {
			result.FailedRows++
			result.Errors = append(result.Errors, RowError{Row: 0, Field: "email", Error: req.Email + ": " + err.Error()})
		} else {
			result.CreatedRows++
		}
	}

	_ = s.audit.Log(ctx, actorID, "IMPORT_USERS", "bulk_import", "csv", nil, result, "")
	return result, nil
}

// CSVExport exports users matching a filter as CSV bytes.
func (s *Service) CSVExport(ctx context.Context, f ListFilter) ([]byte, error) {
	f.Limit = 10000
	result, err := s.repo.List(ctx, f)
	if err != nil {
		return nil, err
	}

	var buf bytes.Buffer
	w := csv.NewWriter(&buf)
	_ = w.Write([]string{"id", "email", "phone", "user_type", "status", "created_at"})
	for _, u := range result.Users {
		_ = w.Write([]string{
			u.ID.String(),
			u.Email,
			u.Phone,
			string(u.UserType),
			string(u.Status),
			u.CreatedAt.Format(time.RFC3339),
		})
	}
	w.Flush()
	return buf.Bytes(), nil
}

// CSVTemplate returns a blank CSV template for import.
func CSVTemplate() []byte {
	var buf bytes.Buffer
	w := csv.NewWriter(&buf)
	_ = w.Write([]string{"email", "phone", "user_type", "full_name", "roll_number", "employee_id"})
	_ = w.Write([]string{"student@campus.edu", "9876543210", "student", "Student Name", "CS2024001", ""})
	_ = w.Write([]string{"faculty@campus.edu", "9876543211", "faculty", "Faculty Name", "", "FAC001"})
	w.Flush()
	return buf.Bytes()
}

// ── helpers ───────────────────────────────────────────────────────────────────

func validateCreateRequest(req CreateUserRequest) error {
	if req.Email == "" {
		return fmt.Errorf("email is required")
	}
	if !strings.Contains(req.Email, "@") {
		return fmt.Errorf("invalid email format")
	}
	if req.UserType == "" {
		return fmt.Errorf("user_type is required")
	}
	if req.Profile.FullName == "" {
		return fmt.Errorf("full_name is required")
	}
	switch req.UserType {
	case UserTypeStudent, UserTypeFaculty, UserTypeWorker, UserTypeVisitor:
	default:
		return fmt.Errorf("invalid user_type: must be student, faculty, worker, or visitor")
	}
	return nil
}

func profileFromRequest(userID uuid.UUID, pr ProfileRequest, now time.Time) *Profile {
	return &Profile{
		UserID:            userID,
		FullName:          pr.FullName,
		RollNumber:        pr.RollNumber,
		EmployeeID:        pr.EmployeeID,
		DepartmentID:      pr.DepartmentID,
		HostelID:          pr.HostelID,
		EmergencyContact:  pr.EmergencyContact,
		GuardianContact:   pr.GuardianContact,
		PhotoReference:    pr.PhotoReference,
		GovIDType:         pr.GovIDType,
		GovIDNumber:       pr.GovIDNumber,
		VisitPurpose:      pr.VisitPurpose,
		HostContact:       pr.HostContact,
		VisitStart:        pr.VisitStart,
		VisitDurationDays: pr.VisitDurationDays,
		UpdatedAt:         now,
	}
}

func applyProfileRequest(p *Profile, pr ProfileRequest, now time.Time) {
	if pr.FullName != "" {
		p.FullName = pr.FullName
	}
	if pr.RollNumber != "" {
		p.RollNumber = pr.RollNumber
	}
	if pr.EmployeeID != "" {
		p.EmployeeID = pr.EmployeeID
	}
	if pr.DepartmentID != nil {
		p.DepartmentID = pr.DepartmentID
	}
	if pr.HostelID != nil {
		p.HostelID = pr.HostelID
	}
	if pr.EmergencyContact != "" {
		p.EmergencyContact = pr.EmergencyContact
	}
	if pr.GuardianContact != "" {
		p.GuardianContact = pr.GuardianContact
	}
	if pr.PhotoReference != "" {
		p.PhotoReference = pr.PhotoReference
	}
	p.UpdatedAt = now
}

func orString(a, b string) string {
	if a != "" {
		return a
	}
	return b
}

func withTx(ctx context.Context, db *sql.DB, fn func(*sql.Tx) error) error {
	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("begin tx: %w", err)
	}
	if err := fn(tx); err != nil {
		_ = tx.Rollback()
		return err
	}
	return tx.Commit()
}
