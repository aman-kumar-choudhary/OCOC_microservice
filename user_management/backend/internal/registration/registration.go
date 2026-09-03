package registration

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"
	_ "github.com/lib/pq"
)

// RegistrationRequest is the public registration payload.
type RegistrationRequest struct {
	Role              string `json:"role"`               // student|faculty|worker|visitor
	FullName          string `json:"full_name"`
	Email             string `json:"email"`
	Phone             string `json:"phone"`
	RollNumber        string `json:"roll_number,omitempty"`        // student
	EmployeeID        string `json:"employee_id,omitempty"`        // faculty / worker
	Department        string `json:"department,omitempty"`          // student / faculty
	Hostel            string `json:"hostel,omitempty"`              // student
	EmergencyContact  string `json:"emergency_contact,omitempty"`
	GuardianContact   string `json:"guardian_contact,omitempty"`    // student
	GovIDType         string `json:"gov_id_type,omitempty"`         // visitor
	GovIDNumber       string `json:"gov_id_number,omitempty"`       // visitor
	VisitPurpose      string `json:"visit_purpose,omitempty"`       // visitor
	HostContact       string `json:"host_contact,omitempty"`        // visitor
	VisitStart        string `json:"visit_start,omitempty"`         // visitor (ISO date)
	VisitDurationDays int    `json:"visit_duration_days,omitempty"` // visitor
	WorkerType        string `json:"worker_type,omitempty"`         // worker: maintenance, security, gardening, etc.
}

// RegisteredUser is returned in the admin listing.
type RegisteredUser struct {
	ID          string `json:"id"`
	Role        string `json:"role"`
	FullName    string `json:"full_name"`
	Email       string `json:"email"`
	Phone       string `json:"phone"`
	Status      string `json:"status"`
	CreatedAt   string `json:"created_at"`
	// Extra fields depending on role
	RollNumber        string `json:"roll_number,omitempty"`
	EmployeeID        string `json:"employee_id,omitempty"`
	Department        string `json:"department,omitempty"`
	Hostel            string `json:"hostel,omitempty"`
	EmergencyContact  string `json:"emergency_contact,omitempty"`
	GuardianContact   string `json:"guardian_contact,omitempty"`
	GovIDType         string `json:"gov_id_type,omitempty"`
	GovIDNumber       string `json:"gov_id_number,omitempty"`
	VisitPurpose      string `json:"visit_purpose,omitempty"`
	HostContact       string `json:"host_contact,omitempty"`
}

// RegistrationListResult is the paginated result for listing registrations.
type RegistrationListResult struct {
	Users      []RegisteredUser `json:"users"`
	Total      int              `json:"total"`
	Page       int              `json:"page"`
	Limit      int              `json:"limit"`
	TotalPages int              `json:"total_pages"`
}

// RegistrationStats holds counts per role.
type RegistrationStats struct {
	Total    int `json:"total"`
	Students int `json:"students"`
	Faculty  int `json:"faculty"`
	Workers  int `json:"workers"`
	Visitors int `json:"visitors"`
}

// Service handles registration business logic.
type Service struct {
	db *sql.DB
}

// NewService creates a registration service.
func NewService(db *sql.DB) *Service {
	return &Service{db: db}
}

var emailRegex = regexp.MustCompile(`^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$`)
var phoneRegex = regexp.MustCompile(`^[0-9]{10,15}$`)

// Register validates and stores a new registration.
func (s *Service) Register(ctx context.Context, req RegistrationRequest) (*RegisteredUser, error) {
	// Normalize
	req.Role = strings.ToLower(strings.TrimSpace(req.Role))
	req.Email = strings.ToLower(strings.TrimSpace(req.Email))
	req.FullName = strings.TrimSpace(req.FullName)
	req.Phone = strings.TrimSpace(req.Phone)

	// Common validations
	if req.Role == "" {
		return nil, fmt.Errorf("role is required")
	}
	validRoles := map[string]bool{"student": true, "faculty": true, "worker": true, "visitor": true}
	if !validRoles[req.Role] {
		return nil, fmt.Errorf("invalid role: must be student, faculty, worker, or visitor")
	}
	if req.FullName == "" {
		return nil, fmt.Errorf("full_name is required")
	}
	if req.Email == "" {
		return nil, fmt.Errorf("email is required")
	}
	if !emailRegex.MatchString(req.Email) {
		return nil, fmt.Errorf("invalid email format")
	}
	if req.Phone == "" {
		return nil, fmt.Errorf("phone is required")
	}
	if !phoneRegex.MatchString(req.Phone) {
		return nil, fmt.Errorf("invalid phone number: must be 10-15 digits")
	}

	// Check email uniqueness
	var exists bool
	if err := s.db.QueryRowContext(ctx, `SELECT EXISTS(SELECT 1 FROM users WHERE email=$1)`, req.Email).Scan(&exists); err != nil {
		return nil, fmt.Errorf("database error: %w", err)
	}
	if exists {
		return nil, fmt.Errorf("email is already registered")
	}

	// Role-specific validations
	switch req.Role {
	case "student":
		if req.RollNumber == "" {
			return nil, fmt.Errorf("roll_number is required for students")
		}
		if req.Department == "" {
			return nil, fmt.Errorf("department is required for students")
		}
	case "faculty":
		if req.EmployeeID == "" {
			return nil, fmt.Errorf("employee_id is required for faculty")
		}
		if req.Department == "" {
			return nil, fmt.Errorf("department is required for faculty")
		}
	case "worker":
		if req.EmployeeID == "" {
			return nil, fmt.Errorf("employee_id is required for workers")
		}
	case "visitor":
		if req.GovIDType == "" {
			return nil, fmt.Errorf("gov_id_type is required for visitors")
		}
		if req.GovIDNumber == "" {
			return nil, fmt.Errorf("gov_id_number is required for visitors")
		}
		if req.VisitPurpose == "" {
			return nil, fmt.Errorf("visit_purpose is required for visitors")
		}
		if req.HostContact == "" {
			return nil, fmt.Errorf("host_contact is required for visitors")
		}
	}

	// Insert into DB within a transaction
	now := time.Now()
	userID := uuid.New()

	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, fmt.Errorf("begin transaction: %w", err)
	}

	// Insert into users table (keycloak_user_id is NULL for registrations)
	_, err = tx.ExecContext(ctx,
		`INSERT INTO users (id, user_type, status, email, phone, created_at, updated_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
		userID, req.Role, "active", req.Email, req.Phone, now, now)
	if err != nil {
		_ = tx.Rollback()
		if strings.Contains(err.Error(), "users_email_key") || strings.Contains(err.Error(), "duplicate") {
			return nil, fmt.Errorf("email is already registered")
		}
		return nil, fmt.Errorf("create user: %w", err)
	}

	// Parse visit_start for visitors
	var visitStart sql.NullTime
	if req.Role == "visitor" && req.VisitStart != "" {
		t, parseErr := time.Parse("2006-01-02", req.VisitStart)
		if parseErr == nil {
			visitStart = sql.NullTime{Time: t, Valid: true}
		}
	}

	// Insert into user_profiles table
	_, err = tx.ExecContext(ctx,
		`INSERT INTO user_profiles (
			user_id, full_name, roll_number, employee_id,
			emergency_contact, guardian_contact,
			gov_id_type, gov_id_number, visit_purpose, host_contact,
			visit_start, visit_duration_days, updated_at
		) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
		userID,
		req.FullName,
		nullStr(req.RollNumber),
		nullStr(req.EmployeeID),
		nullStr(req.EmergencyContact),
		nullStr(req.GuardianContact),
		nullStr(req.GovIDType),
		nullStr(req.GovIDNumber),
		nullStr(req.VisitPurpose),
		nullStr(req.HostContact),
		visitStart,
		nullInt(req.VisitDurationDays),
		now,
	)
	if err != nil {
		_ = tx.Rollback()
		return nil, fmt.Errorf("create profile: %w", err)
	}

	if err := tx.Commit(); err != nil {
		return nil, fmt.Errorf("commit transaction: %w", err)
	}

	return &RegisteredUser{
		ID:        userID.String(),
		Role:      req.Role,
		FullName:  req.FullName,
		Email:     req.Email,
		Phone:     req.Phone,
		Status:    "active",
		CreatedAt: now.Format(time.RFC3339),
	}, nil
}

// ListByRole returns a paginated list of registered users, optionally filtered by role.
func (s *Service) ListByRole(ctx context.Context, role string, page, limit int) (*RegistrationListResult, error) {
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 100 {
		limit = 20
	}
	offset := (page - 1) * limit

	var countQuery, listQuery string
	var args []interface{}

	if role != "" {
		countQuery = `SELECT COUNT(*) FROM users u WHERE u.user_type=$1`
		args = []interface{}{role}

		listQuery = `
			SELECT u.id, u.user_type, u.status, u.email, u.phone, u.created_at,
			       p.full_name, p.roll_number, p.employee_id,
			       p.emergency_contact, p.guardian_contact,
			       p.gov_id_type, p.gov_id_number, p.visit_purpose, p.host_contact
			FROM users u
			LEFT JOIN user_profiles p ON p.user_id = u.id
			WHERE u.user_type=$1
			ORDER BY u.created_at DESC
			LIMIT $2 OFFSET $3`
	} else {
		countQuery = `SELECT COUNT(*) FROM users u`
		args = []interface{}{}

		listQuery = `
			SELECT u.id, u.user_type, u.status, u.email, u.phone, u.created_at,
			       p.full_name, p.roll_number, p.employee_id,
			       p.emergency_contact, p.guardian_contact,
			       p.gov_id_type, p.gov_id_number, p.visit_purpose, p.host_contact
			FROM users u
			LEFT JOIN user_profiles p ON p.user_id = u.id
			ORDER BY u.created_at DESC
			LIMIT $1 OFFSET $2`
	}

	var total int
	if err := s.db.QueryRowContext(ctx, countQuery, args...).Scan(&total); err != nil {
		return nil, fmt.Errorf("count registrations: %w", err)
	}

	if role != "" {
		args = append(args, limit, offset)
	} else {
		args = append(args, limit, offset)
	}

	rows, err := s.db.QueryContext(ctx, listQuery, args...)
	if err != nil {
		return nil, fmt.Errorf("list registrations: %w", err)
	}
	defer rows.Close()

	var users []RegisteredUser
	for rows.Next() {
		var ru RegisteredUser
		var phone, fullName, roll, emp, emerg, guard, govType, govNum, purpose, host sql.NullString
		var createdAt time.Time

		if err := rows.Scan(
			&ru.ID, &ru.Role, &ru.Status, &ru.Email, &phone, &createdAt,
			&fullName, &roll, &emp,
			&emerg, &guard,
			&govType, &govNum, &purpose, &host,
		); err != nil {
			continue
		}
		ru.Phone = phone.String
		ru.FullName = fullName.String
		ru.RollNumber = roll.String
		ru.EmployeeID = emp.String
		ru.EmergencyContact = emerg.String
		ru.GuardianContact = guard.String
		ru.GovIDType = govType.String
		ru.GovIDNumber = govNum.String
		ru.VisitPurpose = purpose.String
		ru.HostContact = host.String
		ru.CreatedAt = createdAt.Format(time.RFC3339)
		users = append(users, ru)
	}

	totalPages := (total + limit - 1) / limit
	return &RegistrationListResult{
		Users:      users,
		Total:      total,
		Page:       page,
		Limit:      limit,
		TotalPages: totalPages,
	}, nil
}

// GetStats returns registration counts by role.
func (s *Service) GetStats(ctx context.Context) (*RegistrationStats, error) {
	stats := &RegistrationStats{}
	err := s.db.QueryRowContext(ctx, `
		SELECT
			COUNT(*),
			COUNT(*) FILTER (WHERE user_type='student'),
			COUNT(*) FILTER (WHERE user_type='faculty'),
			COUNT(*) FILTER (WHERE user_type='worker'),
			COUNT(*) FILTER (WHERE user_type='visitor')
		FROM users`).Scan(&stats.Total, &stats.Students, &stats.Faculty, &stats.Workers, &stats.Visitors)
	if err != nil {
		return nil, fmt.Errorf("registration stats: %w", err)
	}
	return stats, nil
}

// ── Handler ───────────────────────────────────────────────────────────────────

// Handler exposes registration endpoints.
type Handler struct {
	svc *Service
}

// NewHandler creates a new registration handler.
func NewHandler(svc *Service) *Handler {
	return &Handler{svc: svc}
}

// Register handles POST /api/v1/register (public)
func (h *Handler) Register(w http.ResponseWriter, r *http.Request) {
	var req RegistrationRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "INVALID_REQUEST", "invalid JSON body")
		return
	}

	result, err := h.svc.Register(r.Context(), req)
	if err != nil {
		code := "REGISTRATION_FAILED"
		status := http.StatusInternalServerError
		msg := err.Error()
		if strings.Contains(msg, "required") || strings.Contains(msg, "invalid") {
			code = "VALIDATION_ERROR"
			status = http.StatusBadRequest
		} else if strings.Contains(msg, "already registered") {
			code = "DUPLICATE_EMAIL"
			status = http.StatusConflict
		}
		writeError(w, status, code, msg)
		return
	}
	writeJSON(w, http.StatusCreated, map[string]interface{}{"success": true, "data": result})
}

// ListRegistrations handles GET /api/v1/registrations (admin, protected)
func (h *Handler) ListRegistrations(w http.ResponseWriter, r *http.Request) {
	role := r.URL.Query().Get("role")
	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))

	result, err := h.svc.ListByRole(r.Context(), role, page, limit)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "LIST_FAILED", err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"success": true, "data": result})
}

// RegistrationStats handles GET /api/v1/registrations/stats (admin, protected)
func (h *Handler) RegistrationStats(w http.ResponseWriter, r *http.Request) {
	stats, err := h.svc.GetStats(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "STATS_FAILED", err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"success": true, "data": stats})
}

// ── Helpers ───────────────────────────────────────────────────────────────────

func writeJSON(w http.ResponseWriter, status int, v interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v)
}

func writeError(w http.ResponseWriter, status int, code, message string) {
	writeJSON(w, status, map[string]interface{}{
		"success": false,
		"error":   map[string]string{"code": code, "message": message},
	})
}

func nullStr(s string) sql.NullString {
	return sql.NullString{String: s, Valid: s != ""}
}

func nullInt(n int) sql.NullInt32 {
	return sql.NullInt32{Int32: int32(n), Valid: n > 0}
}
