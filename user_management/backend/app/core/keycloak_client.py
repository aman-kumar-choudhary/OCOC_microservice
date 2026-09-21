from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional
import httpx

from app.config import settings

logger = logging.getLogger(__name__)


class KeycloakError(Exception):
    pass


class InvalidCredentialsError(KeycloakError):
    pass


class AccountSetupRequiredError(KeycloakError):
    pass


class KeycloakClient:
    def __init__(self) -> None:
        self.base_url = settings.KEYCLOAK_URL.rstrip("/")
        self.realm = settings.KEYCLOAK_REALM
        self.client_id = settings.KEYCLOAK_CLIENT_ID
        self.client_secret = settings.KEYCLOAK_CLIENT_SECRET
        self.admin_user = settings.KEYCLOAK_ADMIN_USER
        self.admin_pass = settings.KEYCLOAK_ADMIN_PASSWORD
        self._client: Optional[httpx.AsyncClient] = None

    @property
    def client(self) -> httpx.AsyncClient:
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(timeout=15.0)
        return self._client

    async def close(self) -> None:
        if self._client is not None and not self._client.is_closed:
            await self._client.aclose()

    @property
    def issuer(self) -> str:
        return f"{self.base_url}/realms/{self.realm}"

    async def user_login(self, username: str, password: str) -> Dict[str, Any]:
        """Authenticate user with username and password using Resource Owner Password Credentials."""
        url = f"{self.base_url}/realms/{self.realm}/protocol/openid-connect/token"
        data = {
            "grant_type": "password",
            "client_id": self.client_id,
            "username": username,
            "password": password,
        }
        if self.client_secret:
            data["client_secret"] = self.client_secret

        try:
            resp = await self.client.post(url, data=data)
        except Exception as e:
            raise KeycloakError(f"Keycloak connection error: {e}")

        if resp.status_code != 200:
            err_json = {}
            try:
                err_json = resp.json()
            except Exception:
                pass
            err_code = err_json.get("error", "")
            err_desc = err_json.get("error_description", "")

            if err_code == "invalid_grant":
                if "Account is not fully set up" in err_desc or "required action" in err_desc.lower():
                    raise AccountSetupRequiredError("Account setup required")
                raise InvalidCredentialsError("Invalid credentials")

            raise KeycloakError(f"Login failed: {err_desc or resp.text}")

        return resp.json()

    async def refresh_token(self, refresh_token: str) -> Dict[str, Any]:
        """Refresh user tokens using Keycloak token endpoint."""
        url = f"{self.base_url}/realms/{self.realm}/protocol/openid-connect/token"
        data = {
            "grant_type": "refresh_token",
            "client_id": self.client_id,
            "refresh_token": refresh_token,
        }
        if self.client_secret:
            data["client_secret"] = self.client_secret

        try:
            resp = await self.client.post(url, data=data)
        except Exception as e:
            raise KeycloakError(f"Keycloak connection error: {e}")

        if resp.status_code != 200:
            raise KeycloakError(f"Token refresh failed: {resp.text}")

        return resp.json()

    async def logout(self, refresh_token: str) -> None:
        """Revoke the user session in Keycloak."""
        url = f"{self.base_url}/realms/{self.realm}/protocol/openid-connect/logout"
        data = {
            "client_id": self.client_id,
            "refresh_token": refresh_token,
        }
        if self.client_secret:
            data["client_secret"] = self.client_secret

        try:
            resp = await self.client.post(url, data=data)
            if resp.status_code not in (200, 204):
                logger.warning("Keycloak logout response code %d: %s", resp.status_code, resp.text)
        except Exception as e:
            logger.error("Keycloak logout error: %s", e)

    async def get_admin_token(self) -> str:
        """Obtain admin bearer token using master realm credentials."""
        url = f"{self.base_url}/realms/master/protocol/openid-connect/token"
        data = {
            "grant_type": "password",
            "client_id": "admin-cli",
            "username": self.admin_user,
            "password": self.admin_pass,
        }
        resp = await self.client.post(url, data=data)
        if resp.status_code != 200:
            raise KeycloakError(f"Failed to obtain admin token: {resp.text}")
        return resp.json()["access_token"]

    async def create_user(
        self,
        username: str,
        email: str,
        first_name: str,
        last_name: str,
        password: Optional[str] = None,
        attributes: Optional[Dict[str, List[str]]] = None,
        enabled: bool = True,
    ) -> str:
        """Create a user in Keycloak and return the created Keycloak User ID."""
        token = await self.get_admin_token()
        url = f"{self.base_url}/admin/realms/{self.realm}/users"
        headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

        payload: Dict[str, Any] = {
            "username": username,
            "email": email,
            "firstName": first_name,
            "lastName": last_name,
            "enabled": enabled,
            "emailVerified": True,
        }
        if attributes:
            payload["attributes"] = attributes
        if password:
            payload["credentials"] = [
                {
                    "type": "password",
                    "value": password,
                    "temporary": False,
                }
            ]

        resp = await self.client.post(url, json=payload, headers=headers)
        if resp.status_code not in (201, 200):
            raise KeycloakError(f"Keycloak user creation failed ({resp.status_code}): {resp.text}")

        # The location header contains the user ID: .../users/{id}
        location = resp.headers.get("Location")
        if location:
            return location.rstrip("/").split("/")[-1]

        # Fallback: lookup user by email
        user_info = await self.get_user_by_email(email)
        if user_info and "id" in user_info:
            return user_info["id"]

        raise KeycloakError("Created user ID could not be determined")

    async def get_user_by_email(self, email: str) -> Optional[Dict[str, Any]]:
        token = await self.get_admin_token()
        url = f"{self.base_url}/admin/realms/{self.realm}/users"
        headers = {"Authorization": f"Bearer {token}"}
        resp = await self.client.get(url, params={"email": email, "exact": "true"}, headers=headers)
        if resp.status_code != 200:
            return None
        users = resp.json()
        if users and isinstance(users, list):
            return users[0]
        return None

    async def update_user(self, keycloak_id: str, data: Dict[str, Any]) -> None:
        token = await self.get_admin_token()
        url = f"{self.base_url}/admin/realms/{self.realm}/users/{keycloak_id}"
        headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
        resp = await self.client.put(url, json=data, headers=headers)
        if resp.status_code not in (200, 204):
            raise KeycloakError(f"Failed to update Keycloak user: {resp.text}")

    async def delete_user(self, keycloak_id: str) -> None:
        token = await self.get_admin_token()
        url = f"{self.base_url}/admin/realms/{self.realm}/users/{keycloak_id}"
        headers = {"Authorization": f"Bearer {token}"}
        resp = await self.client.delete(url, headers=headers)
        if resp.status_code not in (200, 204):
            raise KeycloakError(f"Failed to delete Keycloak user: {resp.text}")

    async def set_user_enabled(self, keycloak_id: str, enabled: bool) -> None:
        await self.update_user(keycloak_id, {"enabled": enabled})

    async def reset_password(self, keycloak_id: str, new_password: str, temporary: bool = False) -> None:
        token = await self.get_admin_token()
        url = f"{self.base_url}/admin/realms/{self.realm}/users/{keycloak_id}/reset-password"
        headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
        payload = {
            "type": "password",
            "value": new_password,
            "temporary": temporary,
        }
        resp = await self.client.put(url, json=payload, headers=headers)
        if resp.status_code not in (200, 204):
            raise KeycloakError(f"Failed to reset password: {resp.text}")

    async def get_user_roles(self, keycloak_id: str) -> List[Dict[str, Any]]:
        """Return direct realm roles assigned to a Keycloak user."""
        token = await self.get_admin_token()
        url = f"{self.base_url}/admin/realms/{self.realm}/users/{keycloak_id}/role-mappings/realm"
        resp = await self.client.get(url, headers={"Authorization": f"Bearer {token}"})
        if resp.status_code != 200:
            raise KeycloakError(f"Failed to get Keycloak user roles: {resp.text}")
        return resp.json()

    async def get_realm_role(self, role_name: str) -> Dict[str, Any]:
        token = await self.get_admin_token()
        url = f"{self.base_url}/admin/realms/{self.realm}/roles/{role_name}"
        resp = await self.client.get(url, headers={"Authorization": f"Bearer {token}"})
        if resp.status_code != 200:
            raise KeycloakError(f"Keycloak realm role {role_name!r} was not found: {resp.text}")
        return resp.json()

    async def assign_role(self, keycloak_id: str, role_name: str) -> None:
        role = await self.get_realm_role(role_name)
        token = await self.get_admin_token()
        url = f"{self.base_url}/admin/realms/{self.realm}/users/{keycloak_id}/role-mappings/realm"
        resp = await self.client.post(url, json=[role], headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"})
        if resp.status_code not in (200, 204):
            raise KeycloakError(f"Failed to assign Keycloak role {role_name!r}: {resp.text}")

    async def remove_role(self, keycloak_id: str, role_name: str) -> None:
        role = await self.get_realm_role(role_name)
        token = await self.get_admin_token()
        url = f"{self.base_url}/admin/realms/{self.realm}/users/{keycloak_id}/role-mappings/realm"
        resp = await self.client.request("DELETE", url, json=[role], headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"})
        if resp.status_code not in (200, 204):
            raise KeycloakError(f"Failed to remove Keycloak role {role_name!r}: {resp.text}")

    async def update_user_roles(self, keycloak_id: str, selected_roles: List[str], managed_roles: List[str]) -> None:
        """Synchronize only OCOC operational roles, preserving unrelated mappings."""
        current = {str(role.get("name", "")).upper() for role in await self.get_user_roles(keycloak_id)}
        selected = {role.upper() for role in selected_roles}
        managed = {role.upper() for role in managed_roles}
        for role in sorted((current & managed) - selected):
            await self.remove_role(keycloak_id, role)
        for role in sorted(selected - current):
            await self.assign_role(keycloak_id, role)


keycloak_client = KeycloakClient()
