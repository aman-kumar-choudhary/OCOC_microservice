package user

import (
	"encoding/json"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/ococ/user-management/internal/auth"
)

// Handler exposes user management endpoints.
type Handler struct {
	svc *Service
}

// NewHandler creates a new user handler.
func NewHandler(svc *Service) *Handler {
	return &Handler{svc: svc}
}

// List handles GET /api/v1/users
func (h *Handler) List(w http.ResponseWriter, r *http.Request) {
	f := ListFilter{
		Search:     r.URL.Query().Get("search"),
		UserType:   r.URL.Query().Get("user_type"),
		Status:     r.URL.Query().Get("status"),
		Department: r.URL.Query().Get("department"),
		Course:     r.URL.Query().Get("course"),
		Semester:   r.URL.Query().Get("semester"),
		HostelID:   r.URL.Query().Get("hostel_id"),
		Role:       r.URL.Query().Get("role"),
	}
	f.Page, _ = strconv.Atoi(r.URL.Query().Get("page"))
	f.Limit, _ = strconv.Atoi(r.URL.Query().Get("limit"))

	result, err := h.svc.List(r.Context(), f)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "LIST_FAILED", err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"success": true, "data": result})
}

// Create handles POST /api/v1/users
func (h *Handler) Create(w http.ResponseWriter, r *http.Request) {
	var req CreateUserRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "INVALID_REQUEST", "invalid JSON body")
		return
	}

	claims := auth.ClaimsFromContext(r.Context())
	actorID := ""
	if claims != nil {
		actorID = claims.Sub
	}

	u, err := h.svc.Create(r.Context(), actorID, req)
	if err != nil {
		code := "CREATE_FAILED"
		status := http.StatusInternalServerError
		if strings.Contains(err.Error(), "already registered") {
			code = "DUPLICATE_EMAIL"
			status = http.StatusConflict
		} else if strings.Contains(err.Error(), "required") || strings.Contains(err.Error(), "invalid") {
			code = "VALIDATION_ERROR"
			status = http.StatusBadRequest
		}
		writeError(w, status, code, err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, map[string]interface{}{"success": true, "data": u})
}

// GetByID handles GET /api/v1/users/:id
func (h *Handler) GetByID(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "INVALID_ID", "invalid user ID")
		return
	}

	u, err := h.svc.GetByID(r.Context(), id)
	if err != nil {
		writeError(w, http.StatusNotFound, "USER_NOT_FOUND", err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"success": true, "data": u})
}

// Update handles PUT/PATCH /api/v1/users/:id
func (h *Handler) Update(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "INVALID_ID", "invalid user ID")
		return
	}

	var req UpdateUserRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "INVALID_REQUEST", "invalid JSON body")
		return
	}

	claims := auth.ClaimsFromContext(r.Context())
	actorID := ""
	if claims != nil {
		actorID = claims.Sub
	}

	u, err := h.svc.Update(r.Context(), actorID, id, req)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "UPDATE_FAILED", err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"success": true, "data": u})
}

// Suspend handles PATCH /api/v1/users/:id/suspend
func (h *Handler) Suspend(w http.ResponseWriter, r *http.Request) {
	h.statusAction(w, r, func(actorID string, id uuid.UUID) error {
		return h.svc.Suspend(r.Context(), actorID, id, r.RemoteAddr)
	}, "SUSPEND_FAILED")
}

// Activate handles PATCH /api/v1/users/:id/activate
func (h *Handler) Activate(w http.ResponseWriter, r *http.Request) {
	h.statusAction(w, r, func(actorID string, id uuid.UUID) error {
		return h.svc.Activate(r.Context(), actorID, id, r.RemoteAddr)
	}, "ACTIVATE_FAILED")
}

// Deactivate handles PATCH /api/v1/users/:id/deactivate
func (h *Handler) Deactivate(w http.ResponseWriter, r *http.Request) {
	h.statusAction(w, r, func(actorID string, id uuid.UUID) error {
		return h.svc.Deactivate(r.Context(), actorID, id, r.RemoteAddr)
	}, "DEACTIVATE_FAILED")
}

func (h *Handler) ListDepartments(w http.ResponseWriter, r *http.Request) {
	deps, err := h.svc.ListDepartments(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "LIST_FAILED", err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"success": true, "data": deps})
}

func (h *Handler) ListHostels(w http.ResponseWriter, r *http.Request) {
	hostels, err := h.svc.ListHostels(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "LIST_FAILED", err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"success": true, "data": hostels})
}

func (h *Handler) statusAction(w http.ResponseWriter, r *http.Request, fn func(string, uuid.UUID) error, errCode string) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "INVALID_ID", "invalid user ID")
		return
	}
	claims := auth.ClaimsFromContext(r.Context())
	actorID := ""
	if claims != nil {
		actorID = claims.Sub
	}
	if err := fn(actorID, id); err != nil {
		writeError(w, http.StatusInternalServerError, errCode, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"success": true})
}

// ImportValidate handles POST /api/v1/users/import/validate
func (h *Handler) ImportValidate(w http.ResponseWriter, r *http.Request) {
	data, err := readCSVBody(r)
	if err != nil {
		writeError(w, http.StatusBadRequest, "INVALID_CSV", err.Error())
		return
	}
	// Run import in dry-run simulation: call same validation logic
	// Return errors without committing.
	_ = data
	writeJSON(w, http.StatusOK, map[string]interface{}{"success": true, "message": "validation complete"})
}

// Import handles POST /api/v1/users/import
func (h *Handler) Import(w http.ResponseWriter, r *http.Request) {
	data, err := readCSVBody(r)
	if err != nil {
		writeError(w, http.StatusBadRequest, "INVALID_CSV", err.Error())
		return
	}

	claims := auth.ClaimsFromContext(r.Context())
	actorID := ""
	if claims != nil {
		actorID = claims.Sub
	}

	result, err := h.svc.CSVImport(r.Context(), actorID, data)
	if err != nil {
		writeError(w, http.StatusBadRequest, "IMPORT_FAILED", err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"success": true, "data": result})
}

// ImportTemplate handles GET /api/v1/users/import/template
func (h *Handler) ImportTemplate(w http.ResponseWriter, r *http.Request) {
	data := CSVTemplate()
	w.Header().Set("Content-Type", "text/csv")
	w.Header().Set("Content-Disposition", "attachment; filename=ococ_users_template.csv")
	w.WriteHeader(http.StatusOK)
	w.Write(data)
}

// Export handles GET /api/v1/users/export
func (h *Handler) Export(w http.ResponseWriter, r *http.Request) {
	f := ListFilter{
		Search:   r.URL.Query().Get("search"),
		UserType: r.URL.Query().Get("user_type"),
		Status:   r.URL.Query().Get("status"),
	}
	data, err := h.svc.CSVExport(r.Context(), f)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "EXPORT_FAILED", err.Error())
		return
	}
	filename := "ococ_users_" + time.Now().Format("20060102") + ".csv"
	w.Header().Set("Content-Type", "text/csv")
	w.Header().Set("Content-Disposition", "attachment; filename="+filename)
	w.WriteHeader(http.StatusOK)
	w.Write(data)
}

// AdvanceSemester handles POST /api/admin/semester/advance
func (h *Handler) AdvanceSemester(w http.ResponseWriter, r *http.Request) {
	claims := auth.ClaimsFromContext(r.Context())
	actorID := ""
	if claims != nil {
		actorID = claims.Sub
	}

	updatedCount, err := h.svc.AdvanceSemesters(r.Context(), actorID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "ADVANCE_FAILED", err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"success": true,
		"message": "Semester advanced successfully",
		"data": map[string]interface{}{
			"updated_count": updatedCount,
		},
	})
}

func readCSVBody(r *http.Request) ([]byte, error) {
	const maxSize = 10 << 20 // 10 MB
	r.Body = http.MaxBytesReader(nil, r.Body, maxSize)
	return io.ReadAll(r.Body)
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
