package audit

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

// Handler exposes audit log endpoints (read-only).
type Handler struct {
	svc *Service
}

// NewHandler creates a new audit handler.
func NewHandler(svc *Service) *Handler {
	return &Handler{svc: svc}
}

// List handles GET /api/v1/audit
func (h *Handler) List(w http.ResponseWriter, r *http.Request) {
	f := ListFilter{
		ActorID:    r.URL.Query().Get("actor_id"),
		Operation:  r.URL.Query().Get("operation"),
		EntityType: r.URL.Query().Get("entity_type"),
		EntityID:   r.URL.Query().Get("entity_id"),
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

// GetByID handles GET /api/v1/audit/:id
func (h *Handler) GetByID(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "INVALID_ID", "invalid audit log ID")
		return
	}
	l, err := h.svc.GetByID(r.Context(), id)
	if err != nil || l == nil {
		writeError(w, http.StatusNotFound, "NOT_FOUND", "audit log not found")
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"success": true, "data": l})
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
