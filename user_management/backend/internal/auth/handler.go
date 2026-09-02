package auth

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/ococ/user-management/internal/infrastructure/keycloak"
)

// Handler exposes auth endpoints.
type Handler struct {
	svc *Service
}

// NewHandler creates a new auth handler.
func NewHandler(svc *Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) Login(w http.ResponseWriter, r *http.Request) {
	var req LoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "INVALID_REQUEST", "invalid JSON body")
		return
	}

	resp, err := h.svc.Login(r.Context(), req)
	if err != nil {
		if errors.Is(err, keycloak.ErrInvalidCredentials) {
			writeError(w, http.StatusUnauthorized, "INVALID_CREDENTIALS", "invalid username or password")
			return
		}
		if errors.Is(err, keycloak.ErrAccountSetupRequired) {
			writeError(w, http.StatusForbidden, "ACCOUNT_SETUP_REQUIRED", "complete the required Keycloak account action before signing in")
			return
		}
		writeError(w, http.StatusInternalServerError, "LOGIN_FAILED", "login failed")
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"success": true,
		"data":    resp,
	})
}

func (h *Handler) Logout(w http.ResponseWriter, r *http.Request) {
	var req LogoutRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "INVALID_REQUEST", "invalid JSON body")
		return
	}

	if err := h.svc.Logout(r.Context(), req); err != nil {
		writeError(w, http.StatusInternalServerError, "LOGOUT_FAILED", "logout failed")
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{"success": true, "message": "logged out"})
}

func (h *Handler) RefreshToken(w http.ResponseWriter, r *http.Request) {
	var req RefreshRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "INVALID_REQUEST", "invalid JSON body")
		return
	}

	resp, err := h.svc.RefreshToken(r.Context(), req)
	if err != nil {
		writeError(w, http.StatusUnauthorized, "REFRESH_FAILED", "token refresh failed")
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{"success": true, "data": resp})
}

func (h *Handler) ForgotPassword(w http.ResponseWriter, r *http.Request) {
	var req ForgotPasswordRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "INVALID_REQUEST", "invalid JSON body")
		return
	}

	// Always return 200 to prevent email enumeration.
	_ = h.svc.ForgotPassword(r.Context(), req)
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"success": true,
		"message": "If that email is registered, you will receive an OTP shortly",
	})
}

func (h *Handler) VerifyOTP(w http.ResponseWriter, r *http.Request) {
	var req VerifyOTPRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "INVALID_REQUEST", "invalid JSON body")
		return
	}

	resp, err := h.svc.VerifyOTP(r.Context(), req)
	if err != nil {
		writeError(w, http.StatusBadRequest, "INVALID_OTP", err.Error())
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{"success": true, "data": resp})
}

func (h *Handler) ResetPassword(w http.ResponseWriter, r *http.Request) {
	var req ResetPasswordRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "INVALID_REQUEST", "invalid JSON body")
		return
	}

	if err := h.svc.ResetPassword(r.Context(), req); err != nil {
		writeError(w, http.StatusBadRequest, "RESET_FAILED", err.Error())
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{"success": true, "message": "password reset successfully"})
}

// ── helpers ───────────────────────────────────────────────────────────────────

func writeJSON(w http.ResponseWriter, status int, v interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v)
}

func writeError(w http.ResponseWriter, status int, code, message string) {
	writeJSON(w, status, map[string]interface{}{
		"success": false,
		"error": map[string]string{
			"code":    code,
			"message": message,
		},
	})
}
