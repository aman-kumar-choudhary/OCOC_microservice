package onboarding

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/ococ/user-management/internal/auth"
	"github.com/ococ/user-management/internal/rfid"
	"github.com/ococ/user-management/internal/user"
)

// OnboardingRequest is the complete onboarding payload.
type OnboardingRequest struct {
	Persona string               `json:"persona"` // student|faculty|worker|visitor
	User    user.CreateUserRequest `json:"user"`
}

// OnboardingResult is the result of the onboarding workflow.
type OnboardingResult struct {
	User        *user.User  `json:"user"`
	RFIDCard    *rfid.Card  `json:"rfid_card,omitempty"`
	CardIssued  bool        `json:"card_issued"`
	Message     string      `json:"message"`
}

// RFIDEnrollRequest is sent to bind an RFID to an onboarded user.
type RFIDEnrollRequest struct {
	UID string `json:"uid"`
}

// AuditLogger is a cross-module dependency.
type AuditLogger interface {
	Log(ctx context.Context, actorID, operation, entityType, entityID string, before, after interface{}, ip string) error
}

// Service orchestrates the full onboarding workflow.
type Service struct {
	userSvc *user.Service
	rfidSvc *rfid.Service
	audit   AuditLogger
	db      *sql.DB
}

// NewService creates an onboarding service.
func NewService(userSvc *user.Service, rfidSvc *rfid.Service, audit AuditLogger, db *sql.DB) *Service {
	return &Service{userSvc: userSvc, rfidSvc: rfidSvc, audit: audit, db: db}
}

// Onboard runs the full persona-specific onboarding workflow.
func (s *Service) Onboard(ctx context.Context, actorID string, req OnboardingRequest) (*OnboardingResult, error) {
	req.User.UserType = user.UserType(strings.ToLower(req.Persona))
	if err := validatePersona(req.Persona, req.User); err != nil {
		return nil, err
	}

	// Step 1-5: Create user + profile + Keycloak sync.
	u, err := s.userSvc.Create(ctx, actorID, req.User)
	if err != nil {
		return nil, fmt.Errorf("user creation failed: %w", err)
	}

	_ = s.audit.Log(ctx, actorID, "ONBOARDING_STARTED", "user", u.ID.String(), nil, u, "")

	return &OnboardingResult{
		User:       u,
		CardIssued: false,
		Message:    "user created — proceed to RFID enrollment",
	}, nil
}

// EnrollRFID binds an RFID card to an onboarded user (step 6-12).
func (s *Service) EnrollRFID(ctx context.Context, actorID string, userID uuid.UUID, req RFIDEnrollRequest) (*rfid.Card, error) {
	uid := strings.ToUpper(strings.TrimSpace(req.UID))
	if uid == "" {
		return nil, fmt.Errorf("uid is required")
	}

	card, err := s.rfidSvc.Assign(ctx, actorID, rfid.AssignRequest{
		UserID: userID.String(),
		UID:    uid,
	})
	if err != nil {
		return nil, fmt.Errorf("RFID enrollment failed: %w", err)
	}

	_ = s.audit.Log(ctx, actorID, "RFID_ENROLLED", "rfid_card", card.ID.String(), nil, card, "")
	return card, nil
}

// IssueCard marks card issuance complete and generates card data.
func (s *Service) IssueCard(ctx context.Context, actorID string, userID uuid.UUID) (*OnboardingResult, error) {
	u, err := s.userSvc.GetByID(ctx, userID)
	if err != nil || u == nil {
		return nil, fmt.Errorf("user not found")
	}

	_ = s.audit.Log(ctx, actorID, "CARD_ISSUED", "user", userID.String(), nil,
		map[string]interface{}{"user_id": userID, "active_rfid": u.ActiveRFID, "issued_at": time.Now()}, "")

	return &OnboardingResult{
		User:       u,
		CardIssued: true,
		Message:    "card issued successfully",
	}, nil
}

// Handler exposes onboarding endpoints.
type Handler struct {
	svc *Service
}

// NewHandler creates a new onboarding handler.
func NewHandler(svc *Service) *Handler {
	return &Handler{svc: svc}
}

// Generic handles POST /api/v1/onboarding
func (h *Handler) Generic(w http.ResponseWriter, r *http.Request) {
	var req OnboardingRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "INVALID_REQUEST", "invalid JSON body")
		return
	}
	h.runOnboard(w, r, req)
}

// Student handles POST /api/v1/onboarding/student
func (h *Handler) Student(w http.ResponseWriter, r *http.Request) {
	var req OnboardingRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "INVALID_REQUEST", "invalid JSON body")
		return
	}
	req.Persona = "student"
	h.runOnboard(w, r, req)
}

// Faculty handles POST /api/v1/onboarding/faculty
func (h *Handler) Faculty(w http.ResponseWriter, r *http.Request) {
	var req OnboardingRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "INVALID_REQUEST", "invalid JSON body")
		return
	}
	req.Persona = "faculty"
	h.runOnboard(w, r, req)
}

// Worker handles POST /api/v1/onboarding/worker
func (h *Handler) Worker(w http.ResponseWriter, r *http.Request) {
	var req OnboardingRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "INVALID_REQUEST", "invalid JSON body")
		return
	}
	req.Persona = "worker"
	h.runOnboard(w, r, req)
}

// Visitor handles POST /api/v1/onboarding/visitor
func (h *Handler) Visitor(w http.ResponseWriter, r *http.Request) {
	var req OnboardingRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "INVALID_REQUEST", "invalid JSON body")
		return
	}
	req.Persona = "visitor"
	h.runOnboard(w, r, req)
}

// EnrollRFID handles POST /api/v1/onboarding/:id/rfid
func (h *Handler) EnrollRFID(w http.ResponseWriter, r *http.Request) {
	userID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "INVALID_ID", "invalid user ID")
		return
	}
	var req RFIDEnrollRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "INVALID_REQUEST", "invalid JSON body")
		return
	}

	actorID := actorFromContext(r)
	card, err := h.svc.EnrollRFID(r.Context(), actorID, userID, req)
	if err != nil {
		code := "ENROLL_FAILED"
		status := http.StatusInternalServerError
		if strings.Contains(err.Error(), "already") {
			code = "RFID_DUPLICATE"
			status = http.StatusConflict
		}
		writeError(w, status, code, err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, map[string]interface{}{"success": true, "data": card})
}

// IssueCard handles POST /api/v1/onboarding/:id/issue-card
func (h *Handler) IssueCard(w http.ResponseWriter, r *http.Request) {
	userID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "INVALID_ID", "invalid user ID")
		return
	}

	result, err := h.svc.IssueCard(r.Context(), actorFromContext(r), userID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "ISSUE_FAILED", err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"success": true, "data": result})
}

func (h *Handler) runOnboard(w http.ResponseWriter, r *http.Request, req OnboardingRequest) {
	actorID := actorFromContext(r)
	result, err := h.svc.Onboard(r.Context(), actorID, req)
	if err != nil {
		code := "ONBOARD_FAILED"
		status := http.StatusInternalServerError
		if strings.Contains(err.Error(), "required") || strings.Contains(err.Error(), "invalid") {
			code = "VALIDATION_ERROR"
			status = http.StatusBadRequest
		} else if strings.Contains(err.Error(), "already") {
			code = "DUPLICATE_USER"
			status = http.StatusConflict
		}
		writeError(w, status, code, err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, map[string]interface{}{"success": true, "data": result})
}

// ── validation ────────────────────────────────────────────────────────────────

func validatePersona(persona string, req user.CreateUserRequest) error {
	switch persona {
	case "student":
		if req.Profile.FullName == "" {
			return fmt.Errorf("full_name is required for students")
		}
		if req.Profile.RollNumber == "" {
			return fmt.Errorf("roll_number is required for students")
		}
	case "faculty", "worker":
		if req.Profile.FullName == "" {
			return fmt.Errorf("full_name is required")
		}
	case "visitor":
		if req.Profile.GovIDType == "" || req.Profile.GovIDNumber == "" {
			return fmt.Errorf("gov_id_type and gov_id_number are required for visitors")
		}
		if req.Profile.VisitPurpose == "" {
			return fmt.Errorf("visit_purpose is required for visitors")
		}
	default:
		return fmt.Errorf("invalid persona: must be student, faculty, worker, or visitor")
	}
	return nil
}

func actorFromContext(r *http.Request) string {
	claims := auth.ClaimsFromContext(r.Context())
	if claims != nil {
		return claims.Sub
	}
	return ""
}

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
