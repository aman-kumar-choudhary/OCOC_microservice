#!/bin/bash
# Script to increase Keycloak token lifespans to 12+ hours for the 'ococ' realm

# Make sure Keycloak is running before executing this script
echo "Configuring Keycloak Realm Token Lifespans..."

cd /home/aman/web_world/OCOC/OCOC_microservices/keycloak-26.7.3/bin || exit 1

# Login to Keycloak Admin CLI
./kcadm.sh config credentials --server http://localhost:8180 --realm master --user admin --password Admin12345

# Increase SSO Session Max (43200 seconds = 12 hours)
# Increase SSO Session Idle (43200 seconds = 12 hours)
# Increase Access Token Lifespan (43200 seconds = 12 hours)
./kcadm.sh update realms/ococ \
  -s ssoSessionMaxLifespan=43200 \
  -s ssoSessionIdleTimeout=43200 \
  -s accessTokenLifespan=43200 \
  -s ssoSessionMaxLifespanRememberMe=2592000 \
  -s ssoSessionIdleTimeoutRememberMe=2592000

echo "Realm 'ococ' successfully updated to 12-hour session lifespans!"
