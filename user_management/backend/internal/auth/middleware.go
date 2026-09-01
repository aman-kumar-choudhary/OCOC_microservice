package auth

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/coreos/go-oidc/v3/oidc"
)

type contextKey string

const ClaimsKey contextKey = "claims"

// JWTMiddleware validates Bearer tokens using Keycloak OIDC JWKS.
func JWTMiddleware(issuerURL string) func(http.Handler) http.Handler {
	provider, err := oidc.NewProvider(context.Background(), issuerURL)
	if err != nil {
		log.Printf("[WARN] OIDC provider not available (%v) — JWT middleware in passthrough mode", err)
		return func(next http.Handler) http.Handler { return next }
	}

	verifier := provider.Verifier(&oidc.Config{SkipClientIDCheck: true})

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			rawToken := extractBearer(r)
			if rawToken == "" {
				writeUnauthorized(w, "missing or malformed Authorization header")
				return
			}

			ctx := r.Context()
			idToken, err := verifier.Verify(ctx, rawToken)
			if err != nil {
				writeUnauthorized(w, "invalid token")
				return
			}
			if time.Now().After(idToken.Expiry) {
				writeUnauthorized(w, "token expired")
				return
			}

			claims, err := ExtractClaims(rawToken)
			if err != nil {
				writeUnauthorized(w, "failed to extract claims")
				return
			}

			ctx = context.WithValue(ctx, ClaimsKey, claims)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// RequireRole returns middleware that enforces at least one of the given roles.
func RequireRole(roles ...string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			claims := ClaimsFromContext(r.Context())
			if claims == nil {
				writeUnauthorized(w, "unauthenticated")
				return
			}
			if !claims.HasAnyRole(roles...) {
				writeForbidden(w, "insufficient role")
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

// RequirePermission returns middleware that checks for a specific permission string in roles.
// Since we use Keycloak realm roles, permissions are coarsely mapped to roles here.
// Fine-grained permission checks happen inside handlers via ClaimsFromContext.
func RequirePermission(perm string) func(http.Handler) http.Handler {
	permToRoles := map[string][]string{
		"user:create":     {"SUPER_ADMIN", "ADMIN", "USER_MANAGER"},
		"user:read":       {"SUPER_ADMIN", "ADMIN", "USER_MANAGER", "SECURITY_ADMIN", "VIEWER"},
		"user:update":     {"SUPER_ADMIN", "ADMIN", "USER_MANAGER"},
		"user:suspend":    {"SUPER_ADMIN", "ADMIN"},
		"user:deactivate": {"SUPER_ADMIN", "ADMIN"},
		"user:import":     {"SUPER_ADMIN", "ADMIN", "USER_MANAGER"},
		"user:export":     {"SUPER_ADMIN", "ADMIN", "USER_MANAGER", "VIEWER"},
		"rfid:assign":     {"SUPER_ADMIN", "ADMIN", "USER_MANAGER", "SECURITY_ADMIN"},
		"rfid:replace":    {"SUPER_ADMIN", "ADMIN", "SECURITY_ADMIN"},
		"rfid:revoke":     {"SUPER_ADMIN", "ADMIN", "SECURITY_ADMIN"},
		"rfid:read":       {"SUPER_ADMIN", "ADMIN", "USER_MANAGER", "SECURITY_ADMIN", "VIEWER"},
		"role:assign":     {"SUPER_ADMIN", "ADMIN"},
		"role:manage":     {"SUPER_ADMIN"},
		"audit:read":      {"SUPER_ADMIN", "ADMIN", "SECURITY_ADMIN", "VIEWER"},
	}
	roles := permToRoles[perm]
	if len(roles) == 0 {
		roles = []string{"SUPER_ADMIN"}
	}
	return RequireRole(roles...)
}

// ClaimsFromContext extracts claims from a request context.
func ClaimsFromContext(ctx context.Context) *Claims {
	v := ctx.Value(ClaimsKey)
	if v == nil {
		return nil
	}
	c, _ := v.(*Claims)
	return c
}

func extractBearer(r *http.Request) string {
	h := r.Header.Get("Authorization")
	if strings.HasPrefix(h, "Bearer ") {
		return strings.TrimPrefix(h, "Bearer ")
	}
	return ""
}

func writeUnauthorized(w http.ResponseWriter, msg string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusUnauthorized)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": false,
		"error": map[string]string{
			"code":    "UNAUTHORIZED",
			"message": msg,
		},
	})
}

func writeForbidden(w http.ResponseWriter, msg string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusForbidden)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": false,
		"error": map[string]string{
			"code":    "FORBIDDEN",
			"message": msg,
		},
	})
}
