package rfid

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/ococ/user-management/internal/auth"
)

// Handler exposes RFID endpoints.
type Handler struct {
	svc *Service
}

// NewHandler creates a new RFID handler.
func NewHandler(svc *Service) *Handler {
	return &Handler{svc: svc}
}

// List handles GET /api/v1/rfid
func (h *Handler) List(w http.ResponseWriter, r *http.Request) {
	f := ListFilter{
		Status: r.URL.Query().Get("status"),
		UserID: r.URL.Query().Get("user_id"),
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

// GetByUID handles GET /api/v1/rfid/:uid
func (h *Handler) GetByUID(w http.ResponseWriter, r *http.Request) {
	uid := chi.URLParam(r, "uid")
	card, err := h.svc.GetByUID(r.Context(), uid)
	if err != nil {
		writeError(w, http.StatusNotFound, "CARD_NOT_FOUND", err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"success": true, "data": card})
}

// Validate handles POST /api/v1/rfid/validate
func (h *Handler) Validate(w http.ResponseWriter, r *http.Request) {
	var req ValidateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "INVALID_REQUEST", "invalid JSON body")
		return
	}
	valid, reason := h.svc.ValidateUID(r.Context(), req.UID)
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"success": true,
		"data":    map[string]interface{}{"valid": valid, "reason": reason},
	})
}

// Assign handles POST /api/v1/rfid/assign
func (h *Handler) Assign(w http.ResponseWriter, r *http.Request) {
	var req AssignRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "INVALID_REQUEST", "invalid JSON body")
		return
	}

	actorID := actorFromContext(r)
	card, err := h.svc.Assign(r.Context(), actorID, req)
	if err != nil {
		code := "ASSIGN_FAILED"
		status := http.StatusInternalServerError
		if containsAny(err.Error(), "already", "duplicate") {
			code = "RFID_ALREADY_ASSIGNED"
			status = http.StatusConflict
		}
		writeError(w, status, code, err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, map[string]interface{}{"success": true, "data": card})
}

// Replace handles POST /api/v1/rfid/replace
func (h *Handler) Replace(w http.ResponseWriter, r *http.Request) {
	var req ReplaceRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "INVALID_REQUEST", "invalid JSON body")
		return
	}

	actorID := actorFromContext(r)
	card, err := h.svc.Replace(r.Context(), actorID, req)
	if err != nil {
		code := "REPLACE_FAILED"
		status := http.StatusInternalServerError
		if containsAny(err.Error(), "already", "duplicate") {
			code = "RFID_ALREADY_ASSIGNED"
			status = http.StatusConflict
		}
		writeError(w, status, code, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"success": true, "data": card})
}

// Activate handles PATCH /api/v1/rfid/:id/activate
func (h *Handler) Activate(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "INVALID_ID", "invalid card ID")
		return
	}
	if err := h.svc.Activate(r.Context(), actorFromContext(r), id); err != nil {
		writeError(w, http.StatusInternalServerError, "ACTIVATE_FAILED", err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"success": true})
}

// Deactivate handles PATCH /api/v1/rfid/:id/deactivate
func (h *Handler) Deactivate(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "INVALID_ID", "invalid card ID")
		return
	}
	if err := h.svc.Deactivate(r.Context(), actorFromContext(r), id); err != nil {
		writeError(w, http.StatusInternalServerError, "DEACTIVATE_FAILED", err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"success": true})
}

// Revoke handles PATCH /api/v1/rfid/:id/revoke
func (h *Handler) Revoke(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "INVALID_ID", "invalid card ID")
		return
	}
	var req RevokeRequest
	_ = json.NewDecoder(r.Body).Decode(&req)

	if err := h.svc.Revoke(r.Context(), actorFromContext(r), id, req.Reason); err != nil {
		writeError(w, http.StatusInternalServerError, "REVOKE_FAILED", err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"success": true})
}

// Scan handles POST /api/v1/rfid/scan — triggers a reader scan.
func (h *Handler) Scan(w http.ResponseWriter, r *http.Request) {
	result, err := h.svc.Scan(r.Context())
	if err != nil {
		writeError(w, http.StatusServiceUnavailable, "SCAN_FAILED", err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"success": true, "data": result})
}

// ReaderStatus handles GET /api/v1/rfid/reader/status
func (h *Handler) ReaderStatus(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"success": true,
		"data":    map[string]string{"status": string(h.svc.GetReaderStatus())},
	})
}

// ── helpers ───────────────────────────────────────────────────────────────────

func actorFromContext(r *http.Request) string {
	claims := auth.ClaimsFromContext(r.Context())
	if claims != nil {
		return claims.Sub
	}
	return ""
}

func containsAny(s string, subs ...string) bool {
	for _, sub := range subs {
		if len(s) > 0 && len(sub) > 0 {
			for i := 0; i <= len(s)-len(sub); i++ {
				if s[i:i+len(sub)] == sub {
					return true
				}
			}
		}
	}
	return false
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
