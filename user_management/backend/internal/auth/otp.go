package auth

import (
	"context"
	"crypto/rand"
	"fmt"
	"math/big"
	"time"
)

// GenerateOTP generates a cryptographically secure 6-digit OTP.
func GenerateOTP() (string, error) {
	max := big.NewInt(1000000)
	n, err := rand.Int(rand.Reader, max)
	if err != nil {
		return "", fmt.Errorf("generate otp: %w", err)
	}
	return fmt.Sprintf("%06d", n.Int64()), nil
}

// OTPStore defines the interface for OTP storage.
type OTPStore interface {
	SetOTP(ctx context.Context, email, otp string, ttl time.Duration) error
	GetOTP(ctx context.Context, email string) (string, error)
	DeleteOTP(ctx context.Context, email string) error
}
