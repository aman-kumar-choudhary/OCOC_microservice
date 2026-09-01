package auth

import (
	"context"
	"crypto/rand"
	"database/sql"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"log"
	"net/smtp"
	"os"
	"strings"
	"time"

	"github.com/ococ/user-management/internal/infrastructure/keycloak"
)

const otpTTL = 10 * time.Minute
const resetTokenTTL = 15 * time.Minute

// UserLookup allows auth service to check if an email exists.
type UserLookup interface {
	GetKeycloakIDByEmail(ctx context.Context, email string) (keycloakID string, found bool, err error)
}

// Service handles authentication business logic.
type Service struct {
	kc         *keycloak.Client
	otpStore   OTPStore
	resetStore OTPStore // reuse interface for reset tokens
	userLookup UserLookup
	db         *sql.DB
}

// NewService creates a new auth service.
func NewService(kc *keycloak.Client, otpStore OTPStore, resetStore OTPStore, ul UserLookup, db *sql.DB) *Service {
	return &Service{
		kc:         kc,
		otpStore:   otpStore,
		resetStore: resetStore,
		userLookup: ul,
		db:         db,
	}
}

// Login authenticates via Keycloak and returns tokens.
func (s *Service) Login(ctx context.Context, req LoginRequest) (*LoginResponse, error) {
	if req.Username == "" || req.Password == "" {
		return nil, fmt.Errorf("username and password are required")
	}
	tr, err := s.kc.UserLogin(ctx, req.Username, req.Password)
	if err != nil {
		return nil, err
	}
	return &LoginResponse{
		AccessToken:      tr.AccessToken,
		RefreshToken:     tr.RefreshToken,
		ExpiresIn:        tr.ExpiresIn,
		RefreshExpiresIn: tr.RefreshExpiresIn,
		TokenType:        tr.TokenType,
	}, nil
}

// Logout revokes the refresh token from Keycloak.
func (s *Service) Logout(ctx context.Context, req LogoutRequest) error {
	if req.RefreshToken == "" {
		return fmt.Errorf("refresh_token is required")
	}
	return s.kc.Logout(ctx, req.RefreshToken)
}

// RefreshToken rotates tokens using the Keycloak refresh endpoint.
func (s *Service) RefreshToken(ctx context.Context, req RefreshRequest) (*LoginResponse, error) {
	if req.RefreshToken == "" {
		return nil, fmt.Errorf("refresh_token is required")
	}
	tr, err := s.kc.RefreshToken(ctx, req.RefreshToken)
	if err != nil {
		return nil, err
	}
	return &LoginResponse{
		AccessToken:      tr.AccessToken,
		RefreshToken:     tr.RefreshToken,
		ExpiresIn:        tr.ExpiresIn,
		RefreshExpiresIn: tr.RefreshExpiresIn,
		TokenType:        tr.TokenType,
	}, nil
}

// ForgotPassword validates the email, generates an OTP, and sends it.
func (s *Service) ForgotPassword(ctx context.Context, req ForgotPasswordRequest) error {
	if req.Email == "" {
		return fmt.Errorf("email is required")
	}

	_, found, err := s.userLookup.GetKeycloakIDByEmail(ctx, req.Email)
	if err != nil {
		return fmt.Errorf("lookup user: %w", err)
	}
	if !found {
		// Return no error to prevent email enumeration attacks.
		return nil
	}

	otp, err := GenerateOTP()
	if err != nil {
		return err
	}

	if err := s.otpStore.SetOTP(ctx, req.Email, otp, otpTTL); err != nil {
		return fmt.Errorf("store otp: %w", err)
	}

	if err := sendOTPEmail(req.Email, otp); err != nil {
		// In dev mode, log OTP to console (never in production).
		if os.Getenv("ENVIRONMENT") != "production" {
			log.Printf("[DEV] OTP for %s: %s (expires in 10m)", req.Email, otp)
		} else {
			log.Printf("[ERROR] Failed to send OTP email to %s: %v", req.Email, err)
		}
	}
	return nil
}

// VerifyOTP validates the OTP and issues a short-lived reset token.
func (s *Service) VerifyOTP(ctx context.Context, req VerifyOTPRequest) (*VerifyOTPResponse, error) {
	if req.Email == "" || req.OTP == "" {
		return nil, fmt.Errorf("email and otp are required")
	}

	stored, err := s.otpStore.GetOTP(ctx, req.Email)
	if err != nil {
		return nil, fmt.Errorf("get otp: %w", err)
	}
	if stored == "" {
		return nil, fmt.Errorf("OTP expired or not found")
	}
	if stored != req.OTP {
		return nil, fmt.Errorf("invalid OTP")
	}

	// Invalidate OTP immediately after successful verification.
	_ = s.otpStore.DeleteOTP(ctx, req.Email)

	// Issue a short-lived reset token stored in Redis.
	resetToken, err := generateSecureToken()
	if err != nil {
		return nil, err
	}
	resetKey := "reset:" + req.Email
	if err := s.resetStore.SetOTP(ctx, resetKey, resetToken, resetTokenTTL); err != nil {
		return nil, fmt.Errorf("store reset token: %w", err)
	}

	return &VerifyOTPResponse{ResetToken: resetToken}, nil
}

// ResetPassword verifies the reset token and resets the Keycloak password.
func (s *Service) ResetPassword(ctx context.Context, req ResetPasswordRequest) error {
	if req.Email == "" || req.ResetToken == "" || req.NewPassword == "" {
		return fmt.Errorf("email, reset_token, and new_password are required")
	}
	if len(req.NewPassword) < 8 {
		return fmt.Errorf("password must be at least 8 characters")
	}

	resetKey := "reset:" + req.Email
	stored, err := s.resetStore.GetOTP(ctx, resetKey)
	if err != nil {
		return fmt.Errorf("get reset token: %w", err)
	}
	if stored == "" || stored != req.ResetToken {
		return fmt.Errorf("invalid or expired reset token")
	}

	keycloakID, found, err := s.userLookup.GetKeycloakIDByEmail(ctx, req.Email)
	if err != nil || !found {
		return fmt.Errorf("user not found")
	}

	if err := s.kc.ResetPassword(ctx, keycloakID, req.NewPassword, false); err != nil {
		return fmt.Errorf("keycloak reset password: %w", err)
	}

	// Invalidate reset token.
	_ = s.resetStore.DeleteOTP(ctx, resetKey)
	return nil
}

// ExtractClaims parses Keycloak JWT claims from a raw token string (without full verification).
// Full verification is done by the middleware using OIDC JWKS.
func ExtractClaims(rawToken string) (*Claims, error) {
	parts := strings.Split(rawToken, ".")
	if len(parts) != 3 {
		return nil, fmt.Errorf("invalid JWT format")
	}
	payload, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		return nil, fmt.Errorf("decode JWT payload: %w", err)
	}

	var raw map[string]json.RawMessage
	if err := json.Unmarshal(payload, &raw); err != nil {
		return nil, err
	}

	var claims Claims

	if v, ok := raw["sub"]; ok {
		json.Unmarshal(v, &claims.Sub)
	}
	if v, ok := raw["email"]; ok {
		json.Unmarshal(v, &claims.Email)
	}
	if v, ok := raw["preferred_username"]; ok {
		json.Unmarshal(v, &claims.PreferredUsername)
	}
	if v, ok := raw["realm_access"]; ok {
		json.Unmarshal(v, &claims.RealmAccess)
	}
	var exp int64
	if v, ok := raw["exp"]; ok {
		json.Unmarshal(v, &exp)
	}
	claims.ExpiresAt = time.Unix(exp, 0)
	claims.Roles = claims.RealmAccess.Roles
	return &claims, nil
}

// HasRole checks if a Claims object contains a specific role.
func (c *Claims) HasRole(role string) bool {
	for _, r := range c.Roles {
		if r == role {
			return true
		}
	}
	return false
}

// HasAnyRole checks if a Claims object contains any of the given roles.
func (c *Claims) HasAnyRole(roles ...string) bool {
	for _, r := range roles {
		if c.HasRole(r) {
			return true
		}
	}
	return false
}

func sendOTPEmail(to, otp string) error {
	host := os.Getenv("SMTP_HOST")
	port := os.Getenv("SMTP_PORT")
	username := os.Getenv("SMTP_USERNAME")
	password := os.Getenv("SMTP_PASSWORD")
	from := os.Getenv("SMTP_FROM")

	if host == "" || username == "" {
		return fmt.Errorf("SMTP not configured")
	}
	if port == "" {
		port = "587"
	}

	subject := "OCOC Password Reset OTP"
	body := fmt.Sprintf("Your OCOC password reset OTP is: %s\n\nThis OTP expires in 10 minutes.\n\nIf you did not request this, please ignore this email.", otp)
	msg := fmt.Sprintf("From: %s\r\nTo: %s\r\nSubject: %s\r\n\r\n%s", from, to, subject, body)

	auth := smtp.PlainAuth("", username, password, host)
	return smtp.SendMail(host+":"+port, auth, from, []string{to}, []byte(msg))
}

func generateSecureToken() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return base64.URLEncoding.EncodeToString(b), nil
}
