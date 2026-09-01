package auth

import (
	"time"
)

// Claims represents the JWT claims extracted from a Keycloak-issued token.
type Claims struct {
	Sub               string            `json:"sub"`
	Email             string            `json:"email"`
	PreferredUsername string            `json:"preferred_username"`
	RealmAccess       RealmAccessClaims `json:"realm_access"`
	Roles             []string          // extracted from RealmAccess
	ExpiresAt         time.Time
}

// RealmAccessClaims holds Keycloak realm roles.
type RealmAccessClaims struct {
	Roles []string `json:"roles"`
}

// LoginRequest is the payload for POST /api/v1/auth/login.
type LoginRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

// LoginResponse is the response for a successful login.
type LoginResponse struct {
	AccessToken      string `json:"access_token"`
	RefreshToken     string `json:"refresh_token"`
	ExpiresIn        int    `json:"expires_in"`
	RefreshExpiresIn int    `json:"refresh_expires_in"`
	TokenType        string `json:"token_type"`
}

// RefreshRequest is the payload for POST /api/v1/auth/refresh.
type RefreshRequest struct {
	RefreshToken string `json:"refresh_token"`
}

// LogoutRequest is the payload for POST /api/v1/auth/logout.
type LogoutRequest struct {
	RefreshToken string `json:"refresh_token"`
}

// ForgotPasswordRequest is the payload for POST /api/v1/auth/forgot-password.
type ForgotPasswordRequest struct {
	Email string `json:"email"`
}

// VerifyOTPRequest is the payload for POST /api/v1/auth/verify-otp.
type VerifyOTPRequest struct {
	Email string `json:"email"`
	OTP   string `json:"otp"`
}

// VerifyOTPResponse includes a one-time reset token.
type VerifyOTPResponse struct {
	ResetToken string `json:"reset_token"`
}

// ResetPasswordRequest is the payload for POST /api/v1/auth/reset-password.
type ResetPasswordRequest struct {
	Email       string `json:"email"`
	ResetToken  string `json:"reset_token"`
	NewPassword string `json:"new_password"`
}
