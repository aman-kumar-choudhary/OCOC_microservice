package auth

import (
	"encoding/base64"
	"fmt"
	"testing"
	"time"
)

func TestExtractClaims(t *testing.T) {
	jsonPayload := `{"sub":"12345","email":"test@ococ.campus.edu","preferred_username":"testuser","realm_access":{"roles":["SUPER_ADMIN","ADMIN"]},"exp":1700000000}`
	encodedPayload := base64.RawURLEncoding.EncodeToString([]byte(jsonPayload))
	token := fmt.Sprintf("eyJhbGciOiJub25lIn0.%s.", encodedPayload)

	claims, err := ExtractClaims(token)
	if err != nil {
		t.Fatalf("unexpected error extracting claims: %v", err)
	}

	if claims.Sub != "12345" {
		t.Errorf("expected Sub 12345, got %s", claims.Sub)
	}
	if claims.Email != "test@ococ.campus.edu" {
		t.Errorf("expected Email test@ococ.campus.edu, got %s", claims.Email)
	}
	if !claims.HasRole("SUPER_ADMIN") {
		t.Errorf("expected role SUPER_ADMIN to be present")
	}
	if !claims.HasAnyRole("ADMIN", "VIEWER") {
		t.Errorf("expected HasAnyRole to return true for ADMIN")
	}
	if claims.HasRole("STUDENT") {
		t.Errorf("did not expect STUDENT role")
	}
}

func TestGenerateOTP(t *testing.T) {
	otp1, err := GenerateOTP()
	if err != nil {
		t.Fatalf("failed to generate OTP: %v", err)
	}
	if len(otp1) != 6 {
		t.Errorf("expected 6-digit OTP, got length %d (%s)", len(otp1), otp1)
	}

	for _, c := range otp1 {
		if c < '0' || c > '9' {
			t.Errorf("expected digits only, got char %c", c)
		}
	}
}

func TestClaimsRoleMatching(t *testing.T) {
	claims := &Claims{
		Roles:     []string{"USER_MANAGER", "VIEWER"},
		ExpiresAt: time.Now().Add(1 * time.Hour),
	}

	if !claims.HasRole("USER_MANAGER") {
		t.Errorf("expected USER_MANAGER role")
	}
	if claims.HasRole("SUPER_ADMIN") {
		t.Errorf("unexpected SUPER_ADMIN role")
	}
}
