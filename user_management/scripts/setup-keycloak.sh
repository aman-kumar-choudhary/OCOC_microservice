#!/usr/bin/env bash
set -e

KEYCLOAK_URL="${KEYCLOAK_URL:-http://localhost:8180}"
ADMIN_USER="${KEYCLOAK_ADMIN_USER:-admin}"
ADMIN_PASS="${KEYCLOAK_ADMIN_PASSWORD:-admin}"
REALM_NAME="${KEYCLOAK_REALM:-ococ}"
CLIENT_ID="${KEYCLOAK_CLIENT_ID:-user-management}"
CLIENT_SECRET="${KEYCLOAK_CLIENT_SECRET:-hexIfuCmp74tlfr2hOWJwtNABbbyhTZKLT797VnXig87mRANFdTz9BhRrznBw1tKs6UKciWS53aj1qITGbWHj7}"

echo "==> Obtaining Keycloak Master Admin Token..."
TOKEN=$(curl -s -X POST "${KEYCLOAK_URL}/realms/master/protocol/openid-connect/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=password" \
  -d "client_id=admin-cli" \
  -d "username=${ADMIN_USER}" \
  -d "password=${ADMIN_PASS}" | jq -r '.access_token')

if [ "$TOKEN" == "null" ] || [ -z "$TOKEN" ]; then
  echo "Failed to authenticate with Keycloak at ${KEYCLOAK_URL}"
  exit 1
fi
echo "==> Master Admin Token acquired."

# 1. Create Realm if not exists
REALM_CHECK=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer ${TOKEN}" "${KEYCLOAK_URL}/admin/realms/${REALM_NAME}")
if [ "$REALM_CHECK" -ne 200 ]; then
  echo "==> Creating realm ${REALM_NAME}..."
  curl -s -X POST "${KEYCLOAK_URL}/admin/realms" \
    -H "Authorization: Bearer ${TOKEN}" \
    -H "Content-Type: application/json" \
    -d "{\"realm\": \"${REALM_NAME}\", \"enabled\": true}"
else
  echo "==> Realm ${REALM_NAME} already exists."
fi

# 2. Create Client if not exists
CLIENT_ID_KEYCLOAK=$(curl -s -H "Authorization: Bearer ${TOKEN}" "${KEYCLOAK_URL}/admin/realms/${REALM_NAME}/clients?clientId=${CLIENT_ID}" | jq -r '.[0].id')

if [ "$CLIENT_ID_KEYCLOAK" == "null" ] || [ -z "$CLIENT_ID_KEYCLOAK" ]; then
  echo "==> Creating client ${CLIENT_ID}..."
  curl -s -X POST "${KEYCLOAK_URL}/admin/realms/${REALM_NAME}/clients" \
    -H "Authorization: Bearer ${TOKEN}" \
    -H "Content-Type: application/json" \
    -d "{
      \"clientId\": \"${CLIENT_ID}\",
      \"secret\": \"${CLIENT_SECRET}\",
      \"enabled\": true,
      \"publicClient\": false,
      \"directAccessGrantsEnabled\": true,
      \"standardFlowEnabled\": true,
      \"serviceAccountsEnabled\": true,
      \"redirectUris\": [\"http://localhost:5173/*\", \"http://localhost:3000/*\"],
      \"webOrigins\": [\"http://localhost:5173\", \"http://localhost:3000\", \"+\"]
    }"
  CLIENT_ID_KEYCLOAK=$(curl -s -H "Authorization: Bearer ${TOKEN}" "${KEYCLOAK_URL}/admin/realms/${REALM_NAME}/clients?clientId=${CLIENT_ID}" | jq -r '.[0].id')
else
  echo "==> Client ${CLIENT_ID} exists (id: ${CLIENT_ID_KEYCLOAK})."
fi

# 3. Create Realm Roles
# Keep this in sync with backend/app/services/role_service.py.  Access
# Management synchronizes these as *realm* roles, not client roles.
ROLES=("SUPER_ADMIN" "ADMIN" "USER_MANAGER" "GUARD" "WARDEN" "SECURITY_ADMIN" "VIEWER" "STUDENT" "FACULTY" "SECURITY_GUARD" "STAFF" "WORKER" "VISITOR")
for r in "${ROLES[@]}"; do
  ROLE_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer ${TOKEN}" "${KEYCLOAK_URL}/admin/realms/${REALM_NAME}/roles/${r}")
  if [ "$ROLE_STATUS" -ne 200 ]; then
    echo "==> Creating role ${r}..."
    curl -s -X POST "${KEYCLOAK_URL}/admin/realms/${REALM_NAME}/roles" \
      -H "Authorization: Bearer ${TOKEN}" \
      -H "Content-Type: application/json" \
      -d "{\"name\": \"${r}\", \"description\": \"OCOC Role ${r}\"}"
  else
    echo "==> Role ${r} exists."
  fi
done

# 4. Create Development Test User (admin_test)
TEST_USER="admin_test"
TEST_PASS="TestPass123!"
TEST_EMAIL="admin_test@ococ.campus.edu"

USER_SEARCH=$(curl -s -H "Authorization: Bearer ${TOKEN}" "${KEYCLOAK_URL}/admin/realms/${REALM_NAME}/users?username=${TEST_USER}")
TEST_USER_ID=$(echo "$USER_SEARCH" | jq -r '.[0].id // empty')

if [ -z "$TEST_USER_ID" ]; then
  echo "==> Creating test user ${TEST_USER}..."
  curl -s -X POST "${KEYCLOAK_URL}/admin/realms/${REALM_NAME}/users" \
    -H "Authorization: Bearer ${TOKEN}" \
    -H "Content-Type: application/json" \
    -d "{
      \"username\": \"${TEST_USER}\",
      \"email\": \"${TEST_EMAIL}\",
      \"enabled\": true,
      \"firstName\": \"System\",
      \"lastName\": \"Admin\",
      \"credentials\": [{\"type\": \"password\", \"value\": \"${TEST_PASS}\", \"temporary\": false}]
    }"
  TEST_USER_ID=$(curl -s -H "Authorization: Bearer ${TOKEN}" "${KEYCLOAK_URL}/admin/realms/${REALM_NAME}/users?username=${TEST_USER}" | jq -r '.[0].id')
else
  echo "==> Test user ${TEST_USER} already exists (id: ${TEST_USER_ID})."
fi

# Assign SUPER_ADMIN role to admin_test user
ROLE_OBJ=$(curl -s -H "Authorization: Bearer ${TOKEN}" "${KEYCLOAK_URL}/admin/realms/${REALM_NAME}/roles/SUPER_ADMIN")
curl -s -X POST "${KEYCLOAK_URL}/admin/realms/${REALM_NAME}/users/${TEST_USER_ID}/role-mappings/realm" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d "[${ROLE_OBJ}]"

echo "==> Keycloak setup complete!"
echo "    Test User: ${TEST_USER}"
echo "    Password:  ${TEST_PASS}"
echo "    Email:     ${TEST_EMAIL}"
echo "    Keycloak User ID: ${TEST_USER_ID}"
