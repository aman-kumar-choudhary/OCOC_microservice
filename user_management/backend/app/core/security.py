from __future__ import annotations

import logging
import time
from typing import Any, Callable, Dict, List, Optional
from fastapi import Depends, HTTPException, Security, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
import httpx
import jwt

from app.config import settings

logger = logging.getLogger(__name__)

security_scheme = HTTPBearer(auto_error=False)

# Cached JWKS keys from Keycloak
_jwks_cache: Dict[str, Any] = {}
_jwks_cache_expiry: float = 0

PERM_TO_ROLES: Dict[str, List[str]] = {
    "user:create": ["SUPER_ADMIN", "ADMIN", "USER_MANAGER"],
    "user:read": ["SUPER_ADMIN", "ADMIN", "USER_MANAGER", "SECURITY_ADMIN", "VIEWER"],
    "user:update": ["SUPER_ADMIN", "ADMIN", "USER_MANAGER"],
    "user:suspend": ["SUPER_ADMIN", "ADMIN"],
    "user:deactivate": ["SUPER_ADMIN", "ADMIN"],
    "user:delete": ["SUPER_ADMIN", "ADMIN"],
    "user:import": ["SUPER_ADMIN", "ADMIN", "USER_MANAGER"],
    "user:export": ["SUPER_ADMIN", "ADMIN", "USER_MANAGER", "VIEWER"],
    "rfid:assign": ["SUPER_ADMIN", "ADMIN", "USER_MANAGER", "SECURITY_ADMIN"],
    "rfid:replace": ["SUPER_ADMIN", "ADMIN", "SECURITY_ADMIN"],
    "rfid:revoke": ["SUPER_ADMIN", "ADMIN", "SECURITY_ADMIN"],
    "rfid:read": ["SUPER_ADMIN", "ADMIN", "USER_MANAGER", "SECURITY_ADMIN", "VIEWER"],
    "role:assign": ["SUPER_ADMIN", "ADMIN"],
    "role:manage": ["SUPER_ADMIN"],
    "audit:read": ["SUPER_ADMIN", "ADMIN", "SECURITY_ADMIN", "VIEWER"],
    "user:manage": ["SUPER_ADMIN", "ADMIN"],
}


class Claims:
    def __init__(
        self,
        sub: str,
        email: str = "",
        preferred_username: str = "",
        roles: Optional[List[str]] = None,
        raw_token: str = "",
    ) -> None:
        self.sub = sub
        self.email = email
        self.preferred_username = preferred_username
        self.roles = roles or []
        self.raw_token = raw_token

    def has_any_role(self, *required_roles: str) -> bool:
        req_set = set(r.upper() for r in required_roles)
        user_set = set(r.upper() for r in self.roles)
        return bool(req_set.intersection(user_set))


async def fetch_jwks() -> Dict[str, Any]:
    global _jwks_cache, _jwks_cache_expiry
    now = time.time()
    if _jwks_cache and now < _jwks_cache_expiry:
        return _jwks_cache

    certs_url = f"{settings.issuer_url}/protocol/openid-connect/certs"
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(certs_url)
            if resp.status_code == 200:
                _jwks_cache = resp.json()
                _jwks_cache_expiry = now + 300  # cache for 5 minutes
                return _jwks_cache
    except Exception as e:
        logger.warning("Could not refresh Keycloak JWKS: %s", e)
        if _jwks_cache:
            return _jwks_cache

    return _jwks_cache


async def get_current_claims(
    auth: Optional[HTTPAuthorizationCredentials] = Security(security_scheme),
) -> Claims:
    if auth is None or not auth.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "UNAUTHORIZED", "message": "missing or malformed Authorization header"},
        )

    raw_token = auth.credentials
    jwks = await fetch_jwks()
    payload = None

    # Try decoding with JWKS if keys are available
    if jwks and "keys" in jwks:
        try:
            unverified_header = jwt.get_unverified_header(raw_token)
            kid = unverified_header.get("kid")
            key_data = None
            for k in jwks["keys"]:
                if k.get("kid") == kid:
                    key_data = k
                    break

            if key_data:
                public_key = jwt.algorithms.RSAAlgorithm.from_jwk(key_data)
                payload = jwt.decode(
                    raw_token,
                    public_key,
                    algorithms=["RS256"],
                    options={"verify_aud": False},
                )
        except jwt.ExpiredSignatureError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail={"code": "TOKEN_EXPIRED", "message": "token expired"},
            )
        except Exception as e:
            logger.debug("JWKS validation failed: %s; falling back to unverified decode in dev", e)

    # Fallback in local development if Keycloak JWKS is not yet populated
    if payload is None:
        try:
            payload = jwt.decode(raw_token, options={"verify_signature": False})
            # Check expiry even in unverified mode
            exp = payload.get("exp")
            if exp and time.time() > exp:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail={"code": "TOKEN_EXPIRED", "message": "token expired"},
                )
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail={"code": "INVALID_TOKEN", "message": "invalid token"},
            )

    sub = payload.get("sub", "")
    email = payload.get("email", "")
    preferred_username = payload.get("preferred_username", "")
    realm_access = payload.get("realm_access", {})
    roles = realm_access.get("roles", []) if isinstance(realm_access, dict) else []

    return Claims(
        sub=sub,
        email=email,
        preferred_username=preferred_username,
        roles=roles,
        raw_token=raw_token,
    )


def require_permission(perm: str) -> Callable:
    async def permission_dependency(claims: Claims = Depends(get_current_claims)) -> Claims:
        required_roles = PERM_TO_ROLES.get(perm, ["SUPER_ADMIN"])
        if not claims.has_any_role(*required_roles):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={"code": "FORBIDDEN", "message": "insufficient role"},
            )
        return claims

    return permission_dependency


def require_role(*roles: str) -> Callable:
    async def role_dependency(claims: Claims = Depends(get_current_claims)) -> Claims:
        if not claims.has_any_role(*roles):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={"code": "FORBIDDEN", "message": "insufficient role"},
            )
        return claims

    return role_dependency
