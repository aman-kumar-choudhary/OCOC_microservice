from __future__ import annotations

import logging
import time
from typing import Any, Callable, Dict, List, Optional
import uuid
import asyncpg
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
    "access.rule.read": ["SUPER_ADMIN", "ADMIN", "SECURITY_ADMIN", "VIEWER", "GUARD"],
    "access.rule.manage": ["SUPER_ADMIN", "ADMIN", "SECURITY_ADMIN"],
    "access.grant.temporary": ["SUPER_ADMIN", "ADMIN", "SECURITY_ADMIN"],
    "access.grant.manage": ["SUPER_ADMIN", "ADMIN"],
    "access.user.search": ["SUPER_ADMIN", "ADMIN", "SECURITY_ADMIN"],
    "access.user.detail": ["SUPER_ADMIN", "ADMIN", "SECURITY_ADMIN"],
    "access.audit.read": ["SUPER_ADMIN", "ADMIN", "SECURITY_ADMIN"],
    "access.occupancy.view": ["SUPER_ADMIN", "ADMIN", "SECURITY_ADMIN", "VIEWER"],
    "gate.review.manual": ["SUPER_ADMIN", "ADMIN", "SECURITY_ADMIN", "GUARD"],
    "guard.console.read": ["SUPER_ADMIN", "ADMIN", "SECURITY_ADMIN", "GUARD"],
}

ADMIN_ROLES = ("SUPER_ADMIN", "ADMIN")


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

    # Local-only fallback keeps first-run development usable.  A deployed API
    # must never authorize roles from an unverified token.
    if payload is None:
        if settings.ENVIRONMENT.lower() not in {"development", "dev", "test"}:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail={"code": "INVALID_TOKEN", "message": "token signature could not be validated"},
            )
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


async def resolve_warden_hostel_scope(
    conn: asyncpg.Connection, claims: Claims, requested_hostel_id: Optional[uuid.UUID] = None,
) -> Optional[List[uuid.UUID]]:
    """Return a WARDEN's allowed hostels, or ``None`` for administrative access.

    Scope is always derived from the validated token subject and PostgreSQL;
    callers must never supply a user id to this function.
    """
    if claims.has_any_role(*ADMIN_ROLES):
        return None
    if not claims.has_any_role("WARDEN"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail={"code": "FORBIDDEN", "message": "warden role required"})

    user_id = await conn.fetchval("SELECT id FROM users WHERE keycloak_user_id = $1", claims.sub)
    if user_id is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail={"code": "FORBIDDEN", "message": "no local user record for token subject"})
    hostel_ids = list(await conn.fetchval("SELECT COALESCE(array_agg(hostel_id), ARRAY[]::uuid[]) FROM warden_hostels WHERE user_id = $1", user_id))
    if requested_hostel_id is not None and requested_hostel_id not in hostel_ids:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail={"code": "HOSTEL_SCOPE_FORBIDDEN", "message": "hostel is not assigned to this warden"})
    return hostel_ids


async def resolve_user_location_scope(
    conn: asyncpg.Connection,
    claims: Claims,
    required_level: str = "VIEW",
    requested_location_id: Optional[uuid.UUID] = None,
) -> Optional[List[uuid.UUID]]:
    """Return allowed location IDs for the current user, or None for admins."""
    if claims.has_any_role(*ADMIN_ROLES):
        return None  # admins see everything

    user_id = await conn.fetchval("SELECT id FROM users WHERE keycloak_user_id = $1", claims.sub)
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "FORBIDDEN", "message": "no local user record for token subject"},
        )

    level_order = {"VIEW": 0, "ENTRY": 1, "MANAGE": 2, "ADMIN": 3}
    min_level = level_order.get(required_level, 0)

    rows = await conn.fetch(
        """
        SELECT location_id, access_level FROM user_location_access
        WHERE user_id = $1 AND status = 'active'
          AND (valid_until IS NULL OR valid_until >= now())
    """,
        user_id,
    )

    allowed = [r["location_id"] for r in rows if level_order.get(r["access_level"], 0) >= min_level]

    # Also include warden_hostels if user is a WARDEN
    if claims.has_any_role("WARDEN"):
        warden_hostel_ids = await conn.fetchval(
            "SELECT COALESCE(array_agg(hostel_id), ARRAY[]::uuid[]) FROM warden_hostels WHERE user_id = $1",
            user_id,
        )
        if warden_hostel_ids:
            allowed = list(set(allowed + list(warden_hostel_ids)))

    # Expand via hierarchy (children of allowed locations)
    if allowed:
        children = await conn.fetch(
            """
            WITH RECURSIVE tree AS (
                SELECT id FROM locations WHERE id = ANY($1::uuid[])
                UNION ALL
                SELECT l.id FROM locations l JOIN tree t ON l.parent_id = t.id
            ) SELECT id FROM tree
        """,
            allowed,
        )
        allowed = list(set(r["id"] for r in children))

    if requested_location_id and requested_location_id not in allowed:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "code": "LOCATION_SCOPE_FORBIDDEN",
                "message": "location not in authorized scope",
            },
        )

    return allowed
