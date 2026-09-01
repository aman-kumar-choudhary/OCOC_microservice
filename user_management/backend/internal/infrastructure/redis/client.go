package redis

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"time"

	"github.com/redis/go-redis/v9"
)

const (
	otpPrefix         = "otp:"
	permissionsPrefix = "permissions:"
	revokedPrefix     = "revoked:"
	sessionPrefix     = "session:"
)

// Client wraps go-redis and provides domain-specific helpers.
type Client struct {
	rdb *redis.Client
}

// NewClient creates a Redis client from REDIS_URL environment variable.
func NewClient() (*Client, error) {
	addr := os.Getenv("REDIS_URL")
	if addr == "" {
		addr = "redis://localhost:6379/0"
	}
	opt, err := redis.ParseURL(addr)
	if err != nil {
		return nil, fmt.Errorf("parse redis URL: %w", err)
	}
	password := os.Getenv("REDIS_PASSWORD")
	if password != "" {
		opt.Password = password
	}
	rdb := redis.NewClient(opt)
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := rdb.Ping(ctx).Err(); err != nil {
		return nil, fmt.Errorf("ping redis: %w", err)
	}
	return &Client{rdb: rdb}, nil
}

// Close closes the Redis connection.
func (c *Client) Close() error {
	return c.rdb.Close()
}

// Ping checks Redis health.
func (c *Client) Ping(ctx context.Context) error {
	return c.rdb.Ping(ctx).Err()
}

// ── OTP ──────────────────────────────────────────────────────────────────────

// SetOTP stores a 6-digit OTP for email with TTL.
func (c *Client) SetOTP(ctx context.Context, email, otp string, ttl time.Duration) error {
	return c.rdb.Set(ctx, otpPrefix+email, otp, ttl).Err()
}

// GetOTP retrieves the OTP for an email.
func (c *Client) GetOTP(ctx context.Context, email string) (string, error) {
	val, err := c.rdb.Get(ctx, otpPrefix+email).Result()
	if err == redis.Nil {
		return "", nil
	}
	return val, err
}

// DeleteOTP removes the OTP after successful verification.
func (c *Client) DeleteOTP(ctx context.Context, email string) error {
	return c.rdb.Del(ctx, otpPrefix+email).Err()
}

// ── Permissions Cache ─────────────────────────────────────────────────────────

// SetPermissions caches user permissions as JSON.
func (c *Client) SetPermissions(ctx context.Context, userID string, perms []string, ttl time.Duration) error {
	data, err := json.Marshal(perms)
	if err != nil {
		return err
	}
	return c.rdb.Set(ctx, permissionsPrefix+userID, data, ttl).Err()
}

// GetPermissions retrieves cached permissions for a user.
func (c *Client) GetPermissions(ctx context.Context, userID string) ([]string, bool, error) {
	val, err := c.rdb.Get(ctx, permissionsPrefix+userID).Bytes()
	if err == redis.Nil {
		return nil, false, nil
	}
	if err != nil {
		return nil, false, err
	}
	var perms []string
	if err := json.Unmarshal(val, &perms); err != nil {
		return nil, false, err
	}
	return perms, true, nil
}

// InvalidatePermissions removes cached permissions (e.g., on role change or suspension).
func (c *Client) InvalidatePermissions(ctx context.Context, userID string) error {
	return c.rdb.Del(ctx, permissionsPrefix+userID).Err()
}

// ── Revocation ────────────────────────────────────────────────────────────────

// MarkRevoked marks a token/user as revoked with an expiry.
func (c *Client) MarkRevoked(ctx context.Context, key string, ttl time.Duration) error {
	return c.rdb.Set(ctx, revokedPrefix+key, "1", ttl).Err()
}

// IsRevoked checks whether a token/user is in the revocation set.
func (c *Client) IsRevoked(ctx context.Context, key string) (bool, error) {
	val, err := c.rdb.Exists(ctx, revokedPrefix+key).Result()
	if err != nil {
		return false, err
	}
	return val > 0, nil
}

// ── Session ───────────────────────────────────────────────────────────────────

// SetSession stores session metadata.
func (c *Client) SetSession(ctx context.Context, sessionID string, data interface{}, ttl time.Duration) error {
	b, err := json.Marshal(data)
	if err != nil {
		return err
	}
	return c.rdb.Set(ctx, sessionPrefix+sessionID, b, ttl).Err()
}

// DeleteSession removes a session.
func (c *Client) DeleteSession(ctx context.Context, sessionID string) error {
	return c.rdb.Del(ctx, sessionPrefix+sessionID).Err()
}
