package keycloak

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"
)

// These errors allow HTTP handlers to distinguish an invalid password from an
// account that must finish an interactive Keycloak action first.
var (
	ErrInvalidCredentials   = errors.New("invalid credentials")
	ErrAccountSetupRequired = errors.New("account setup required")
)

// Client is the Keycloak Admin REST API client.
type Client struct {
	baseURL      string
	realm        string
	clientID     string
	clientSecret string
	adminUser    string
	adminPass    string
	httpClient   *http.Client
}

// NewClientFromEnv creates a Keycloak client from environment variables.
func NewClientFromEnv() *Client {
	return &Client{
		baseURL:      envString("KEYCLOAK_URL", "http://localhost:8180"),
		realm:        envString("KEYCLOAK_REALM", "ococ"),
		clientID:     envString("KEYCLOAK_CLIENT_ID", "user-management"),
		clientSecret: envString("KEYCLOAK_CLIENT_SECRET", ""),
		adminUser:    envString("KEYCLOAK_ADMIN_USER", "admin"),
		adminPass:    envString("KEYCLOAK_ADMIN_PASSWORD", "admin"),
		httpClient:   &http.Client{Timeout: 15 * time.Second},
	}
}

// KeycloakUser represents a Keycloak user object for create/update.
type KeycloakUser struct {
	ID          string              `json:"id,omitempty"`
	Username    string              `json:"username"`
	Email       string              `json:"email"`
	FirstName   string              `json:"firstName,omitempty"`
	LastName    string              `json:"lastName,omitempty"`
	Enabled     bool                `json:"enabled"`
	Attributes  map[string][]string `json:"attributes,omitempty"`
	Credentials []KCCredential      `json:"credentials,omitempty"`
}

// KCCredential is a Keycloak credential for password reset.
type KCCredential struct {
	Type      string `json:"type"`
	Value     string `json:"value"`
	Temporary bool   `json:"temporary"`
}

// TokenResponse is returned by the Keycloak token endpoint.
type TokenResponse struct {
	AccessToken      string `json:"access_token"`
	RefreshToken     string `json:"refresh_token"`
	ExpiresIn        int    `json:"expires_in"`
	RefreshExpiresIn int    `json:"refresh_expires_in"`
	TokenType        string `json:"token_type"`
}

type tokenErrorResponse struct {
	Error            string `json:"error"`
	ErrorDescription string `json:"error_description"`
}

// adminToken obtains an admin access token via Resource Owner Password Credentials.
func (c *Client) adminToken(ctx context.Context) (string, error) {
	data := url.Values{}
	data.Set("grant_type", "password")
	data.Set("client_id", "admin-cli")
	data.Set("username", c.adminUser)
	data.Set("password", c.adminPass)

	endpoint := fmt.Sprintf("%s/realms/master/protocol/openid-connect/token", c.baseURL)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint,
		strings.NewReader(data.Encode()))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("keycloak admin token: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("keycloak admin token %d: %s", resp.StatusCode, body)
	}

	var tr TokenResponse
	if err := json.NewDecoder(resp.Body).Decode(&tr); err != nil {
		return "", err
	}
	return tr.AccessToken, nil
}

// UserLogin authenticates a user via the Keycloak token endpoint (password grant).
func (c *Client) UserLogin(ctx context.Context, username, password string) (*TokenResponse, error) {
	data := url.Values{}
	data.Set("grant_type", "password")
	data.Set("client_id", c.clientID)
	data.Set("client_secret", c.clientSecret)
	data.Set("username", username)
	data.Set("password", password)
	data.Set("scope", "openid profile email")

	endpoint := fmt.Sprintf("%s/realms/%s/protocol/openid-connect/token", c.baseURL, c.realm)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint,
		strings.NewReader(data.Encode()))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("keycloak login: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		var tokenErr tokenErrorResponse
		if json.Unmarshal(body, &tokenErr) == nil {
			if strings.EqualFold(tokenErr.ErrorDescription, "Account is not fully set up") {
				return nil, fmt.Errorf("%w: %s", ErrAccountSetupRequired, tokenErr.ErrorDescription)
			}
		}
		if resp.StatusCode == http.StatusUnauthorized {
			return nil, ErrInvalidCredentials
		}
		return nil, fmt.Errorf("keycloak login %d: %s", resp.StatusCode, body)
	}

	var tr TokenResponse
	if err := json.NewDecoder(resp.Body).Decode(&tr); err != nil {
		return nil, err
	}
	return &tr, nil
}

// RefreshToken refreshes an access token.
func (c *Client) RefreshToken(ctx context.Context, refreshToken string) (*TokenResponse, error) {
	data := url.Values{}
	data.Set("grant_type", "refresh_token")
	data.Set("client_id", c.clientID)
	data.Set("client_secret", c.clientSecret)
	data.Set("refresh_token", refreshToken)

	endpoint := fmt.Sprintf("%s/realms/%s/protocol/openid-connect/token", c.baseURL, c.realm)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint,
		strings.NewReader(data.Encode()))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("refresh token %d: %s", resp.StatusCode, body)
	}

	var tr TokenResponse
	if err := json.NewDecoder(resp.Body).Decode(&tr); err != nil {
		return nil, err
	}
	return &tr, nil
}

// Logout revokes a refresh token.
func (c *Client) Logout(ctx context.Context, refreshToken string) error {
	data := url.Values{}
	data.Set("client_id", c.clientID)
	data.Set("client_secret", c.clientSecret)
	data.Set("refresh_token", refreshToken)

	endpoint := fmt.Sprintf("%s/realms/%s/protocol/openid-connect/logout", c.baseURL, c.realm)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint,
		strings.NewReader(data.Encode()))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	return nil
}

// CreateUser creates a user in Keycloak and returns the Keycloak user ID.
func (c *Client) CreateUser(ctx context.Context, user KeycloakUser) (string, error) {
	token, err := c.adminToken(ctx)
	if err != nil {
		return "", fmt.Errorf("admin token: %w", err)
	}

	body, err := json.Marshal(user)
	if err != nil {
		return "", err
	}

	endpoint := fmt.Sprintf("%s/admin/realms/%s/users", c.baseURL, c.realm)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(body))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+token)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("keycloak create user: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusConflict {
		return "", fmt.Errorf("user already exists in Keycloak")
	}
	if resp.StatusCode != http.StatusCreated {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("keycloak create user %d: %s", resp.StatusCode, bodyBytes)
	}

	// Keycloak returns the user ID in the Location header.
	location := resp.Header.Get("Location")
	parts := strings.Split(location, "/")
	if len(parts) == 0 {
		return "", fmt.Errorf("missing Location header from Keycloak")
	}
	return parts[len(parts)-1], nil
}

// UpdateUser updates a Keycloak user's attributes.
func (c *Client) UpdateUser(ctx context.Context, keycloakID string, user KeycloakUser) error {
	token, err := c.adminToken(ctx)
	if err != nil {
		return err
	}

	body, err := json.Marshal(user)
	if err != nil {
		return err
	}

	endpoint := fmt.Sprintf("%s/admin/realms/%s/users/%s", c.baseURL, c.realm, keycloakID)
	req, err := http.NewRequestWithContext(ctx, http.MethodPut, endpoint, bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+token)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusNoContent {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("keycloak update user %d: %s", resp.StatusCode, bodyBytes)
	}
	return nil
}

// DisableUser sets a Keycloak user's enabled=false to block authentication.
func (c *Client) DisableUser(ctx context.Context, keycloakID string) error {
	return c.UpdateUser(ctx, keycloakID, KeycloakUser{Enabled: false})
}

// EnableUser re-enables a Keycloak user.
func (c *Client) EnableUser(ctx context.Context, keycloakID string) error {
	return c.UpdateUser(ctx, keycloakID, KeycloakUser{Enabled: true})
}

// LogoutAllSessions invalidates all sessions for a Keycloak user.
func (c *Client) LogoutAllSessions(ctx context.Context, keycloakID string) error {
	token, err := c.adminToken(ctx)
	if err != nil {
		return err
	}

	endpoint := fmt.Sprintf("%s/admin/realms/%s/users/%s/logout", c.baseURL, c.realm, keycloakID)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, nil)
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+token)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	return nil
}

// ResetPassword triggers a Keycloak admin password reset for a user.
func (c *Client) ResetPassword(ctx context.Context, keycloakID, newPassword string, temporary bool) error {
	token, err := c.adminToken(ctx)
	if err != nil {
		return err
	}

	cred := KCCredential{
		Type:      "password",
		Value:     newPassword,
		Temporary: temporary,
	}
	body, err := json.Marshal(cred)
	if err != nil {
		return err
	}

	endpoint := fmt.Sprintf("%s/admin/realms/%s/users/%s/reset-password", c.baseURL, c.realm, keycloakID)
	req, err := http.NewRequestWithContext(ctx, http.MethodPut, endpoint, bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+token)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusNoContent {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("reset password %d: %s", resp.StatusCode, bodyBytes)
	}
	return nil
}

// AssignRealmRole assigns a realm role to a Keycloak user.
func (c *Client) AssignRealmRole(ctx context.Context, keycloakID, roleName string) error {
	token, err := c.adminToken(ctx)
	if err != nil {
		return err
	}

	// Fetch the role representation first.
	roleEndpoint := fmt.Sprintf("%s/admin/realms/%s/roles/%s", c.baseURL, c.realm, roleName)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, roleEndpoint, nil)
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+token)

	roleResp, err := c.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer roleResp.Body.Close()
	if roleResp.StatusCode == http.StatusNotFound {
		return nil // role doesn't exist in Keycloak — skip silently
	}
	if roleResp.StatusCode != http.StatusOK {
		return fmt.Errorf("get realm role %d", roleResp.StatusCode)
	}

	var roleObj map[string]interface{}
	if err := json.NewDecoder(roleResp.Body).Decode(&roleObj); err != nil {
		return err
	}

	// Assign the role.
	roles := []map[string]interface{}{roleObj}
	body, _ := json.Marshal(roles)

	assignEndpoint := fmt.Sprintf("%s/admin/realms/%s/users/%s/role-mappings/realm", c.baseURL, c.realm, keycloakID)
	req2, err := http.NewRequestWithContext(ctx, http.MethodPost, assignEndpoint, bytes.NewReader(body))
	if err != nil {
		return err
	}
	req2.Header.Set("Content-Type", "application/json")
	req2.Header.Set("Authorization", "Bearer "+token)

	resp2, err := c.httpClient.Do(req2)
	if err != nil {
		return err
	}
	defer resp2.Body.Close()
	return nil
}

// GetJWKSURL returns the OIDC JWKS endpoint for JWT validation.
func (c *Client) GetJWKSURL() string {
	return fmt.Sprintf("%s/realms/%s/protocol/openid-connect/certs", c.baseURL, c.realm)
}

// GetIssuer returns the token issuer URL.
func (c *Client) GetIssuer() string {
	return fmt.Sprintf("%s/realms/%s", c.baseURL, c.realm)
}

func envString(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}
