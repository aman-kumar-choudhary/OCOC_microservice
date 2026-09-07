package dashboard

import (
	"context"
	"database/sql"
	"encoding/json"
	"net/http"
	"time"
)

// Overview represents top-level user and RFID counts.
type Overview struct {
	TotalUsers      int `json:"total_users"`
	ActiveUsers     int `json:"active_users"`
	SuspendedUsers  int `json:"suspended_users"`
	DeactivatedUsers int `json:"deactivated_users"`
	Students        int `json:"students"`
	Faculty         int `json:"faculty"`
	Workers         int `json:"workers"`
	Visitors        int `json:"visitors"`
	RFIDIssued      int `json:"rfid_issued"`
	RFIDActive      int `json:"rfid_active"`
	RFIDRevoked     int `json:"rfid_revoked"`
}

// TrendPoint is a data point for time-series analytics.
type TrendPoint struct {
	Date  string `json:"date"`
	Count int    `json:"count"`
}

// Analytics holds dashboard analytics data.
type Analytics struct {
	OnboardingTrend []TrendPoint `json:"onboarding_trend"`
	CardIssuance    []TrendPoint `json:"card_issuance_trend"`
}

// Service provides dashboard data.
type Service struct {
	db *sql.DB
}

// NewService creates a dashboard service.
func NewService(db *sql.DB) *Service {
	return &Service{db: db}
}

// GetOverview returns user and RFID summary counts.
func (s *Service) GetOverview(ctx context.Context) (*Overview, error) {
	o := &Overview{}
	err := s.db.QueryRowContext(ctx, `
		SELECT
			COUNT(*),
			COUNT(*) FILTER (WHERE status='active'),
			COUNT(*) FILTER (WHERE status='suspended'),
			COUNT(*) FILTER (WHERE status='deactivated'),
			COUNT(*) FILTER (WHERE user_type='student'),
			COUNT(*) FILTER (WHERE user_type='faculty'),
			COUNT(*) FILTER (WHERE user_type='worker'),
			COUNT(*) FILTER (WHERE user_type='visitor')
		FROM users`).
		Scan(&o.TotalUsers, &o.ActiveUsers, &o.SuspendedUsers, &o.DeactivatedUsers,
			&o.Students, &o.Faculty, &o.Workers, &o.Visitors)
	if err != nil {
		return nil, err
	}

	s.db.QueryRowContext(ctx, `
		SELECT
			COUNT(*),
			COUNT(*) FILTER (WHERE status='active'),
			COUNT(*) FILTER (WHERE status IN ('revoked','lost','stolen','replaced'))
		FROM rfid_cards`).
		Scan(&o.RFIDIssued, &o.RFIDActive, &o.RFIDRevoked)

	return o, nil
}

// GetAnalytics returns time-series analytics between start and end (inclusive).
func (s *Service) GetAnalytics(ctx context.Context, start, end time.Time) (*Analytics, error) {
	a := &Analytics{}

	// Onboarding trend: users created per day in the requested window.
	rows, err := s.db.QueryContext(ctx, `
		SELECT date_trunc('day', created_at)::date AS d, COUNT(*)
		FROM users
		WHERE created_at >= $1 AND created_at < $2
		GROUP BY d ORDER BY d`, start, end)
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var tp TrendPoint
			var d time.Time
			if rows.Scan(&d, &tp.Count) == nil {
				tp.Date = d.Format("2006-01-02")
				a.OnboardingTrend = append(a.OnboardingTrend, tp)
			}
		}
	}

	// RFID issuance trend: cards created per day in the requested window.
	rows2, err2 := s.db.QueryContext(ctx, `
		SELECT date_trunc('day', created_at)::date AS d, COUNT(*)
		FROM rfid_cards
		WHERE created_at >= $1 AND created_at < $2
		GROUP BY d ORDER BY d`, start, end)
	if err2 == nil {
		defer rows2.Close()
		for rows2.Next() {
			var tp TrendPoint
			var d time.Time
			if rows2.Scan(&d, &tp.Count) == nil {
				tp.Date = d.Format("2006-01-02")
				a.CardIssuance = append(a.CardIssuance, tp)
			}
		}
	}

	return a, nil
}

// Handler exposes dashboard endpoints.
type Handler struct {
	svc *Service
}

// NewHandler creates a dashboard handler.
func NewHandler(svc *Service) *Handler {
	return &Handler{svc: svc}
}

// Overview handles GET /api/v1/dashboard/overview
func (h *Handler) Overview(w http.ResponseWriter, r *http.Request) {
	data, err := h.svc.GetOverview(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "OVERVIEW_FAILED", err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"success": true, "data": data})
}

// Analytics handles GET /api/v1/dashboard/analytics
// Accepts optional ?from=YYYY-MM-DD and ?to=YYYY-MM-DD query params.
// Defaults to the last 30 days when absent or unparseable.
func (h *Handler) Analytics(w http.ResponseWriter, r *http.Request) {
	const layout = "2006-01-02"
	now := time.Now().UTC()

	// Default window: last 30 days → tomorrow (so today is fully included).
	defaultStart := now.AddDate(0, 0, -30).Truncate(24 * time.Hour)
	defaultEnd   := now.AddDate(0, 0, 1).Truncate(24 * time.Hour)

	start, end := defaultStart, defaultEnd

	if v := r.URL.Query().Get("from"); v != "" {
		if t, err := time.ParseInLocation(layout, v, time.UTC); err == nil {
			start = t
		}
	}
	if v := r.URL.Query().Get("to"); v != "" {
		if t, err := time.ParseInLocation(layout, v, time.UTC); err == nil {
			// Add one day so the "to" date is inclusive.
			end = t.AddDate(0, 0, 1)
		}
	}

	data, err := h.svc.GetAnalytics(r.Context(), start, end)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "ANALYTICS_FAILED", err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"success": true, "data": data})
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
