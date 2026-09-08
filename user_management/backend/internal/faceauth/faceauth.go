package faceauth

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/google/uuid"
	"github.com/ococ/user-management/internal/auth"
)

// LogEntry is a face authentication event.
type LogEntry struct {
	ID                 uuid.UUID  `json:"id"`
	PersonExternalID   string     `json:"person_external_id"`
	PersonName         string     `json:"person_name,omitempty"`
	Result             string     `json:"result"` // success|failed|liveness_failed|unknown
	SimilarityScore    *float64   `json:"similarity_score,omitempty"`
	LivenessScore      *float64   `json:"liveness_score,omitempty"`
	Reason             string     `json:"reason,omitempty"`
	AuthType           string     `json:"auth_type"` // single|mass
	IPAddress          string     `json:"ip_address,omitempty"`
	CreatedAt          time.Time  `json:"created_at"`
}

// LogRequest is the payload sent from the frontend after a face match.
type LogRequest struct {
	PersonExternalID string   `json:"person_external_id"`
	PersonName       string   `json:"person_name,omitempty"`
	Result           string   `json:"result"`
	SimilarityScore  *float64 `json:"similarity_score,omitempty"`
	LivenessScore    *float64 `json:"liveness_score,omitempty"`
	Reason           string   `json:"reason,omitempty"`
	AuthType         string   `json:"auth_type"`
}

// ListResult is the paginated response.
type ListResult struct {
	Logs       []LogEntry `json:"logs"`
	Total      int        `json:"total"`
	Page       int        `json:"page"`
	Limit      int        `json:"limit"`
	TotalPages int        `json:"total_pages"`
}

// Service stores and queries face auth events.
type Service struct {
	db    *sql.DB
	audit AuditLogger
}

// AuditLogger keeps this package independent from the audit implementation.
type AuditLogger interface {
	Log(ctx context.Context, actorID, operation, entityType, entityID string, before, after interface{}, ip string) error
}

// NewService creates a face auth service.
func NewService(db *sql.DB, audit AuditLogger) *Service {
	return &Service{db: db, audit: audit}
}

// Log stores a face auth event.
func (s *Service) Log(ctx context.Context, req LogRequest, ip string) (*LogEntry, error) {
	if req.Result == "" {
		return nil, fmt.Errorf("result is required")
	}
	if _, ok := map[string]bool{"success": true, "failed": true, "liveness_failed": true, "unknown": true}[req.Result]; !ok {
		return nil, fmt.Errorf("invalid result")
	}
	if req.AuthType == "" {
		req.AuthType = "single"
	}
	if req.AuthType != "single" && req.AuthType != "mass" {
		return nil, fmt.Errorf("invalid auth_type")
	}
	entry := &LogEntry{
		ID:               uuid.New(),
		PersonExternalID: req.PersonExternalID,
		PersonName:       req.PersonName,
		Result:           req.Result,
		SimilarityScore:  req.SimilarityScore,
		LivenessScore:    req.LivenessScore,
		Reason:           req.Reason,
		AuthType:         req.AuthType,
		IPAddress:        ip,
		CreatedAt:        time.Now(),
	}
	_, err := s.db.ExecContext(ctx, `
		INSERT INTO face_auth_logs
			(id, person_external_id, person_name, result, similarity_score, liveness_score, reason, auth_type, ip_address, created_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
		entry.ID, nullStr(entry.PersonExternalID), nullStr(entry.PersonName),
		entry.Result, entry.SimilarityScore, entry.LivenessScore,
		nullStr(entry.Reason), entry.AuthType, nullStr(entry.IPAddress), entry.CreatedAt)
	if err != nil {
		return nil, fmt.Errorf("insert face auth log: %w", err)
	}
	if s.audit != nil {
		op := "FACE_AUTH_FAILED"
		if entry.Result == "success" { op = "FACE_AUTH_SUCCESS" }
		if entry.Result == "liveness_failed" { op = "FACE_AUTH_LIVENESS_FAILED" }
		_ = s.audit.Log(ctx, "", op, "face_auth", entry.ID.String(), nil, entry, ip)
	}
	return entry, nil
}

// List returns paginated face auth logs with optional filters.
func (s *Service) List(ctx context.Context, result, authType, personID, from, to string, page, limit int) (*ListResult, error) {
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 200 {
		limit = 50
	}
	offset := (page - 1) * limit

	conds := []string{}
	args := []interface{}{}
	n := 1
	if result != "" {
		conds = append(conds, fmt.Sprintf("result=$%d", n))
		args = append(args, result)
		n++
	}
	if authType != "" {
		conds = append(conds, fmt.Sprintf("auth_type=$%d", n))
		args = append(args, authType)
		n++
	}
	if personID != "" {
		conds = append(conds, fmt.Sprintf("person_external_id=$%d", n))
		args = append(args, personID)
		n++
	}
	if from != "" {
		conds = append(conds, fmt.Sprintf("created_at>=$%d", n))
		args = append(args, from)
		n++
	}
	if to != "" {
		conds = append(conds, fmt.Sprintf("created_at<=$%d", n))
		args = append(args, to)
		n++
	}

	where := ""
	if len(conds) > 0 {
		where = "WHERE "
		for i, c := range conds {
			if i > 0 {
				where += " AND "
			}
			where += c
		}
	}

	var total int
	if err := s.db.QueryRowContext(ctx, "SELECT COUNT(*) FROM face_auth_logs "+where, args...).Scan(&total); err != nil {
		return nil, fmt.Errorf("count face auth logs: %w", err)
	}

	args = append(args, limit, offset)
	q := fmt.Sprintf(`SELECT id, person_external_id, person_name, result, similarity_score, liveness_score, reason, auth_type, ip_address, created_at
		FROM face_auth_logs %s ORDER BY created_at DESC LIMIT $%d OFFSET $%d`,
		where, n, n+1)

	rows, err := s.db.QueryContext(ctx, q, args...)
	if err != nil {
		return nil, fmt.Errorf("list face auth logs: %w", err)
	}
	defer rows.Close()

	var logs []LogEntry
	for rows.Next() {
		var e LogEntry
		var peid, pname, reason, ip sql.NullString
		var sim, liv sql.NullFloat64
		if err := rows.Scan(&e.ID, &peid, &pname, &e.Result, &sim, &liv, &reason, &e.AuthType, &ip, &e.CreatedAt); err != nil {
			continue
		}
		e.PersonExternalID = peid.String
		e.PersonName = pname.String
		e.Reason = reason.String
		e.IPAddress = ip.String
		if sim.Valid {
			v := sim.Float64
			e.SimilarityScore = &v
		}
		if liv.Valid {
			v := liv.Float64
			e.LivenessScore = &v
		}
		logs = append(logs, e)
	}

	totalPages := (total + limit - 1) / limit
	return &ListResult{Logs: logs, Total: total, Page: page, Limit: limit, TotalPages: totalPages}, nil
}

// Handler exposes face auth log endpoints.
type Handler struct {
	svc *Service
}

// NewHandler creates a face auth handler.
func NewHandler(svc *Service) *Handler {
	return &Handler{svc: svc}
}

// CreateLog handles POST /api/v1/face-auth/log
func (h *Handler) CreateLog(w http.ResponseWriter, r *http.Request) {
	var req LogRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "INVALID_REQUEST", "invalid JSON body")
		return
	}
	claims := auth.ClaimsFromContext(r.Context())
	_ = claims // logged but not required

	entry, err := h.svc.Log(r.Context(), req, r.RemoteAddr)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "LOG_FAILED", err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, map[string]interface{}{"success": true, "data": entry})
}

// ListLogs handles GET /api/v1/face-auth/logs
func (h *Handler) ListLogs(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	page, _ := strconv.Atoi(q.Get("page"))
	limit, _ := strconv.Atoi(q.Get("limit"))
	result, err := h.svc.List(r.Context(),
		q.Get("result"), q.Get("auth_type"), q.Get("person_id"),
		q.Get("from"), q.Get("to"), page, limit)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "LIST_FAILED", err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"success": true, "data": result})
}

func nullStr(s string) sql.NullString { return sql.NullString{String: s, Valid: s != ""} }

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
