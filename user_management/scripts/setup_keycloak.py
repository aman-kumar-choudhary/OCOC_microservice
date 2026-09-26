#!/usr/bin/env python3
"""
Keycloak Setup Script for OCOC User Management Microservice.
This script provisions the realm, client, roles, and initial test admin user.
Cross-platform compatible (Windows, macOS, Linux).
"""

import os
import sys
from pathlib import Path

try:
    import requests
except ImportError:
    print("Error: 'requests' package not found. Please run: pip install requests")
    sys.exit(1)


def load_dotenv(dotenv_path: Path) -> dict:
    env_vars = {}
    if dotenv_path.exists():
        with open(dotenv_path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    key, val = line.split("=", 1)
                    env_vars[key.strip()] = val.strip().strip("\"'")
    return env_vars


def main():
    script_dir = Path(__file__).resolve().parent
    project_root = script_dir.parent
    backend_env = load_dotenv(project_root / "backend" / ".env")

    keycloak_url = os.getenv("KEYCLOAK_URL", backend_env.get("KEYCLOAK_URL", "http://localhost:8180")).rstrip("/")
    admin_user = os.getenv("KEYCLOAK_ADMIN_USER", backend_env.get("KEYCLOAK_ADMIN_USER", "admin"))
    desired_admin_pass = os.getenv("KEYCLOAK_ADMIN_PASSWORD", backend_env.get("KEYCLOAK_ADMIN_PASSWORD", "Admin12345"))
    realm_name = os.getenv("KEYCLOAK_REALM", backend_env.get("KEYCLOAK_REALM", "ococ"))
    client_id = os.getenv("KEYCLOAK_CLIENT_ID", backend_env.get("KEYCLOAK_CLIENT_ID", "user-management"))
    client_secret = os.getenv(
        "KEYCLOAK_CLIENT_SECRET",
        backend_env.get("KEYCLOAK_CLIENT_SECRET", "FABJ8UO0dTUSZm65lIS2r9hpWqErDaaktJR3CVqt8S0TaJF0Wg5rXN8YIhaSXXFinP0heTG51PW9rhJ1KPmfLM")
    )

    print(f"==> Connecting to Keycloak at {keycloak_url}...")

    # 1. Obtain Admin Token (try desired password, then fallback to 'admin')
    passwords_to_try = [desired_admin_pass, "admin", "Admin12345", "root"]
    # Preserve order but remove duplicates
    seen = set()
    passwords_to_try = [p for p in passwords_to_try if not (p in seen or seen.add(p))]

    token = None
    working_pass = None
    for p in passwords_to_try:
        try:
            resp = requests.post(
                f"{keycloak_url}/realms/master/protocol/openid-connect/token",
                data={
                    "grant_type": "password",
                    "client_id": "admin-cli",
                    "username": admin_user,
                    "password": p,
                },
                timeout=10,
            )
            if resp.status_code == 200:
                token = resp.json().get("access_token")
                working_pass = p
                break
        except requests.exceptions.RequestException as e:
            print(f"Error: Unable to connect to Keycloak: {e}")
            print("Please ensure Keycloak is running.")
            sys.exit(1)

    if not token:
        print(f"Failed to authenticate with Keycloak at {keycloak_url} as '{admin_user}'.")
        print("Checked passwords:", passwords_to_try)
        sys.exit(1)

    print(f"==> Authenticated as '{admin_user}'. Master Admin Token acquired.")

    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }

    # If the working password was not the desired one in backend/.env, update Keycloak's admin password
    if working_pass != desired_admin_pass:
        print(f"==> Syncing Keycloak master admin password to match backend configuration ('{desired_admin_pass}')...")
        user_res = requests.get(
            f"{keycloak_url}/admin/realms/master/users",
            params={"username": admin_user},
            headers=headers,
            timeout=10,
        )
        if user_res.status_code == 200 and user_res.json():
            master_user_id = user_res.json()[0]["id"]
            pwd_res = requests.put(
                f"{keycloak_url}/admin/realms/master/users/{master_user_id}/reset-password",
                json={"type": "password", "value": desired_admin_pass, "temporary": False},
                headers=headers,
                timeout=10,
            )
            if pwd_res.status_code == 204:
                print("    Master admin password synced successfully.")
            else:
                print(f"    Warning: Could not sync master admin password ({pwd_res.status_code}): {pwd_res.text}")

    # 2. Check / Create Realm
    realm_resp = requests.get(f"{keycloak_url}/admin/realms/{realm_name}", headers=headers, timeout=10)
    if realm_resp.status_code == 200:
        print(f"==> Realm '{realm_name}' already exists.")
    else:
        print(f"==> Creating realm '{realm_name}'...")
        create_realm_resp = requests.post(
            f"{keycloak_url}/admin/realms",
            json={"realm": realm_name, "enabled": True},
            headers=headers,
            timeout=10,
        )
        if create_realm_resp.status_code in (201, 204):
            print(f"    Realm '{realm_name}' created.")
        else:
            print(f"Error creating realm: {create_realm_resp.status_code} - {create_realm_resp.text}")
            sys.exit(1)

    # 3. Check / Create Client
    clients_resp = requests.get(
        f"{keycloak_url}/admin/realms/{realm_name}/clients",
        params={"clientId": client_id},
        headers=headers,
        timeout=10,
    )
    clients = clients_resp.json() if clients_resp.status_code == 200 else []
    client_internal_id = None

    client_payload = {
        "clientId": client_id,
        "secret": client_secret,
        "enabled": True,
        "publicClient": False,
        "directAccessGrantsEnabled": True,
        "standardFlowEnabled": True,
        "serviceAccountsEnabled": True,
        "redirectUris": ["http://localhost:5173/*", "http://localhost:3000/*"],
        "webOrigins": ["http://localhost:5173", "http://localhost:3000", "+"],
    }

    if clients:
        client_internal_id = clients[0]["id"]
        print(f"==> Client '{client_id}' already exists (ID: {client_internal_id}). Updating configuration...")
        update_resp = requests.put(
            f"{keycloak_url}/admin/realms/{realm_name}/clients/{client_internal_id}",
            json={**clients[0], **client_payload},
            headers=headers,
            timeout=10,
        )
        if update_resp.status_code in (200, 204):
            print(f"    Client '{client_id}' updated.")
        else:
            print(f"    Notice: Client update returned {update_resp.status_code}")
    else:
        print(f"==> Creating client '{client_id}'...")
        create_client_resp = requests.post(
            f"{keycloak_url}/admin/realms/{realm_name}/clients",
            json=client_payload,
            headers=headers,
            timeout=10,
        )
        if create_client_resp.status_code in (201, 204):
            # Fetch newly created client id
            fetch_res = requests.get(
                f"{keycloak_url}/admin/realms/{realm_name}/clients",
                params={"clientId": client_id},
                headers=headers,
                timeout=10,
            )
            client_internal_id = fetch_res.json()[0]["id"]
            print(f"    Client '{client_id}' created (ID: {client_internal_id}).")
        else:
            print(f"Error creating client: {create_client_resp.status_code} - {create_client_resp.text}")
            sys.exit(1)

    # 4. Create Realm Roles
    roles = [
        "SUPER_ADMIN",
        "ADMIN",
        "USER_MANAGER",
        "GUARD",
        "WARDEN",
        "SECURITY_ADMIN",
        "VIEWER",
        "STUDENT",
        "FACULTY",
        "SECURITY_GUARD",
        "STAFF",
        "WORKER",
        "VISITOR",
    ]
    for role_name in roles:
        role_chk = requests.get(
            f"{keycloak_url}/admin/realms/{realm_name}/roles/{role_name}",
            headers=headers,
            timeout=10,
        )
        if role_chk.status_code == 200:
            print(f"==> Role '{role_name}' exists.")
        else:
            print(f"==> Creating role '{role_name}'...")
            role_create_resp = requests.post(
                f"{keycloak_url}/admin/realms/{realm_name}/roles",
                json={"name": role_name, "description": f"OCOC Role {role_name}"},
                headers=headers,
                timeout=10,
            )
            if role_create_resp.status_code in (201, 204):
                print(f"    Role '{role_name}' created.")
            else:
                print(f"    Warning: role {role_name} creation returned {role_create_resp.status_code}")

    # 5. Create Development Test User (admin_test)
    test_user = "admin_test"
    test_pass = "TestPass123!"
    test_email = "admin_test@ococ.campus.edu"

    user_chk = requests.get(
        f"{keycloak_url}/admin/realms/{realm_name}/users",
        params={"username": test_user},
        headers=headers,
        timeout=10,
    )
    users = user_chk.json() if user_chk.status_code == 200 else []
    test_user_id = None

    if users:
        test_user_id = users[0]["id"]
        print(f"==> Test user '{test_user}' already exists (ID: {test_user_id}).")
    else:
        print(f"==> Creating test user '{test_user}'...")
        user_create_resp = requests.post(
            f"{keycloak_url}/admin/realms/{realm_name}/users",
            json={
                "username": test_user,
                "email": test_email,
                "enabled": True,
                "firstName": "System",
                "lastName": "Admin",
                "credentials": [{"type": "password", "value": test_pass, "temporary": False}],
            },
            headers=headers,
            timeout=10,
        )
        if user_create_resp.status_code in (201, 204):
            # Fetch newly created user id
            fetch_res = requests.get(
                f"{keycloak_url}/admin/realms/{realm_name}/users",
                params={"username": test_user},
                headers=headers,
                timeout=10,
            )
            test_user_id = fetch_res.json()[0]["id"]
            print(f"    Test user '{test_user}' created (ID: {test_user_id}).")
        else:
            print(f"Error creating test user: {user_create_resp.status_code} - {user_create_resp.text}")
            sys.exit(1)

    # 6. Assign SUPER_ADMIN role to admin_test
    if test_user_id:
        super_admin_role_resp = requests.get(
            f"{keycloak_url}/admin/realms/{realm_name}/roles/SUPER_ADMIN",
            headers=headers,
            timeout=10,
        )
        if super_admin_role_resp.status_code == 200:
            role_obj = super_admin_role_resp.json()
            assign_resp = requests.post(
                f"{keycloak_url}/admin/realms/{realm_name}/users/{test_user_id}/role-mappings/realm",
                json=[role_obj],
                headers=headers,
                timeout=10,
            )
            if assign_resp.status_code in (200, 204):
                print(f"==> Assigned SUPER_ADMIN role to '{test_user}'.")

    print("\n" + "=" * 50)
    print(" Keycloak setup completed successfully!")
    print("=" * 50)
    print(f" Realm:            {realm_name}")
    print(f" Client ID:        {client_id}")
    print(f" Client Secret:    {client_secret}")
    print(f" Master Admin:     {admin_user} / {desired_admin_pass}")
    print(f" Test User:        {test_user}")
    print(f" Test Password:    {test_pass}")
    print(f" Test Email:       {test_email}")
    print(f" User ID:          {test_user_id}")
    print("=" * 50 + "\n")


if __name__ == "__main__":
    main()
