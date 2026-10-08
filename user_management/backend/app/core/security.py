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
from app.core.redis_client import redis_client

logger = logging.getLogger(__name__)

security_scheme = HTTPBearer(auto_error=False)

# Cached JWKS keys from Keycloak
_jwks_cache: Dict[str, Any] = {}
_jwks_cache_expiry: float = 0

PERM_TO_ROLES: Dict[str, List[str]] = {
    "user:create": ["SUPER_ADMIN", "ADMIN", "USER_MANAGER"],
    "user:read": ["SUPER_ADMIN", "ADMIN", "USER_MANAGER", "SECURITY_ADMIN", "WARDEN", "VIEWER"],
    "user:update": ["SUPER_ADMIN", "ADMIN", "USER_MANAGER", "WARDEN"],
    "user:suspend": ["SUPER_ADMIN", "ADMIN", "WARDEN"],
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
    "access.rule.read": ["SUPER_ADMIN", "ADMIN", "SECURITY_ADMIN", "VIEWER", "GUARD", "SECURITY_GUARD"],
    "access.rule.manage": ["SUPER_ADMIN", "ADMIN", "SECURITY_ADMIN"],
    "access.grant.temporary": ["SUPER_ADMIN", "ADMIN", "SECURITY_ADMIN"],
    "access.grant.manage": ["SUPER_ADMIN", "ADMIN", "SECURITY_ADMIN"],
    "access.user.search": ["SUPER_ADMIN", "ADMIN", "SECURITY_ADMIN"],
    "access.user.detail": ["SUPER_ADMIN", "ADMIN", "SECURITY_ADMIN"],
    "access.audit.read": ["SUPER_ADMIN", "ADMIN", "SECURITY_ADMIN"],
    "access.occupancy.view": ["SUPER_ADMIN", "ADMIN", "SECURITY_ADMIN", "VIEWER"],
    "gate.review.manual": ["SUPER_ADMIN", "ADMIN", "SECURITY_ADMIN", "GUARD", "SECURITY_GUARD"],
    "guard.console.read": ["SUPER_ADMIN", "ADMIN", "SECURITY_ADMIN", "GUARD", "SECURITY_GUARD"],
    "leave.request.submit": ["SUPER_ADMIN", "STUDENT"],
    "leave.approve.warden": ["SUPER_ADMIN", "WARDEN"],
    "leave.approve.chancellor": ["SUPER_ADMIN", "CHANCELLOR"],
    "leave.approve.medical": ["SUPER_ADMIN", "MEDICAL_OFFICER"],
    "leave.delegate": ["SUPER_ADMIN", "WARDEN", "CHANCELLOR", "MEDICAL_OFFICER"],
    "leave.workflow.manage": ["SUPER_ADMIN"],
    "leave.balance.manage": ["SUPER_ADMIN", "ADMIN"],
    "leave.audit.view": ["SUPER_ADMIN", "ADMIN", "SECURITY_ADMIN"],
    "face:log": ["SUPER_ADMIN", "ADMIN", "SECURITY_ADMIN", "GUARD", "SECURITY_GUARD"],
    "face:read": ["SUPER_ADMIN", "ADMIN", "SECURITY_ADMIN", "GUARD", "SECURITY_GUARD", "VIEWER"],
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


async def decode_token_claims(raw_token: str) -> Claims:
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
                    leeway=60,
                )
        except jwt.ExpiredSignatureError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail={"code": "TOKEN_EXPIRED", "message": "token expired"},
            )
        except Exception as e:
            logger.debug("JWKS validation failed: %s; falling back to unverified decode in dev", e)

    # In development / dev / test, fallback gracefully if JWKS signature check fails
    if payload is None:
        allow_unverified = getattr(settings, "ALLOW_UNVERIFIED_JWT_DEV", False)
        is_dev = settings.ENVIRONMENT.lower() in {"development", "dev", "test"}
        if not allow_unverified and not is_dev:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail={"code": "INVALID_TOKEN", "message": "token signature could not be validated"},
            )
        try:
            logger.warning("SECURITY ALERT: Decoding unverified JWT token because dev mode is active")
            payload = jwt.decode(raw_token, options={"verify_signature": False, "verify_aud": False})
            exp = payload.get("exp")
            if exp and time.time() > (exp + 60):
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail={"code": "TOKEN_EXPIRED", "message": "token expired"},
                )
        except HTTPException:
            raise
        except Exception:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail={"code": "INVALID_TOKEN", "message": "invalid token"},
            )

    sub = payload.get("sub", "")
    email = payload.get("email", "")
    preferred_username = payload.get("preferred_username", "")
    realm_access = payload.get("realm_access", {})
    roles_list = list(realm_access.get("roles", [])) if isinstance(realm_access, dict) else []

    # Also capture client roles from resource_access (e.g. user-management client)
    resource_access = payload.get("resource_access", {})
    if isinstance(resource_access, dict):
        for client_obj in resource_access.values():
            if isinstance(client_obj, dict):
                for r in client_obj.get("roles", []):
                    if r not in roles_list:
                        roles_list.append(r)

    # Supplement roles from database user_roles if available
    try:
        from app.core.database import get_db_pool
        db_pool = get_db_pool()
        if db_pool and sub:
            async with db_pool.acquire() as conn:
                db_roles = await conn.fetch("""
                    SELECT r.name FROM user_roles ur
                    JOIN roles r ON r.id = ur.role_id
                    JOIN users u ON u.id = ur.user_id
                    WHERE u.keycloak_user_id = $1 OR u.id::text = $1
                """, str(sub))
                for r in db_roles:
                    r_name = r["name"].strip()
                    if r_name and r_name not in roles_list:
                        roles_list.append(r_name)
    except Exception as e:
        logger.debug("Could not augment roles from DB: %s", e)

    return Claims(
        sub=sub,
        email=email,
        preferred_username=preferred_username,
        roles=roles_list,
        raw_token=raw_token,
    )


async def get_current_claims(
    auth: Optional[HTTPAuthorizationCredentials] = Security(security_scheme),
) -> Claims:
    if auth is None or not auth.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "UNAUTHORIZED", "message": "missing or malformed Authorization header"},
        )

    return await decode_token_claims(auth.credentials)


async def ensure_local_user(conn: asyncpg.Connection, claims: Claims) -> uuid.UUID:
    """Ensure a local users record exists and is linked to the authenticated Keycloak token.
    
    If the user already exists in PostgreSQL, links keycloak_user_id and returns their UUID.
    If the user does not exist, auto-provisions a local record with appropriate roles and profile.
    """
    if not claims or not claims.sub:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "UNAUTHORIZED", "message": "Missing authentication claims"},
        )

    # 1. Search by keycloak_user_id
    user_row = await conn.fetchrow(
        "SELECT id, user_type, email, keycloak_user_id FROM users WHERE keycloak_user_id = $1 LIMIT 1",
        str(claims.sub),
    )

    # 2. Search by UUID if claims.sub is a valid UUID matching users.id
    if not user_row:
        try:
            cand_uuid = uuid.UUID(str(claims.sub))
            user_row = await conn.fetchrow(
                "SELECT id, user_type, email, keycloak_user_id FROM users WHERE id = $1 LIMIT 1",
                cand_uuid,
            )
        except Exception:
            pass

    # 3. Search by email or preferred_username
    if not user_row:
        search_emails = []
        if claims.email:
            search_emails.append(claims.email.lower().strip())
        if claims.preferred_username:
            uname = claims.preferred_username.lower().strip()
            if "@" in uname:
                search_emails.append(uname)
            else:
                search_emails.append(f"{uname}@ococ.campus.edu")

        if search_emails:
            user_row = await conn.fetchrow(
                "SELECT id, user_type, email, keycloak_user_id FROM users WHERE LOWER(email) = ANY($1::text[]) LIMIT 1",
                search_emails,
            )

    if user_row:
        user_id = user_row["id"]
        # Update keycloak_user_id if not set or mismatched
        if str(user_row["keycloak_user_id"] or "") != str(claims.sub):
            await conn.execute(
                "UPDATE users SET keycloak_user_id = $1, updated_at = now() WHERE id = $2",
                str(claims.sub),
                user_id,
            )
        # Synchronize roles from claims to user_roles
        if claims.roles:
            valid_roles = [r.strip().upper() for r in claims.roles if not r.startswith("default-") and r != "uma_authorization"]
            if valid_roles:
                db_role_rows = await conn.fetch("SELECT id, name FROM roles WHERE UPPER(name) = ANY($1::text[])", valid_roles)
                for r_row in db_role_rows:
                    await conn.execute(
                        "INSERT INTO user_roles (user_id, role_id, assigned_at) VALUES ($1, $2, now()) ON CONFLICT (user_id, role_id) DO NOTHING",
                        user_id,
                        r_row["id"],
                    )
        return user_id

    # 4. Auto-provision local user record
    try:
        user_id = uuid.UUID(str(claims.sub))
    except Exception:
        user_id = uuid.uuid4()

    # Deduce user_type
    user_type = "student"
    if claims.has_any_role("SUPER_ADMIN", "ADMIN", "USER_MANAGER"):
        user_type = "faculty"
    elif claims.has_any_role("SECURITY_ADMIN", "GUARD", "SECURITY_GUARD", "WORKER"):
        user_type = "worker"
    elif claims.has_any_role("FACULTY", "CHANCELLOR", "MEDICAL_OFFICER"):
        user_type = "faculty"

    user_email = (claims.email or f"{claims.preferred_username or 'user'}@ococ.campus.edu").lower().strip()
    full_name = claims.preferred_username or "Campus User"

    async with conn.transaction():
        await conn.execute(
            """
            INSERT INTO users (id, keycloak_user_id, email, user_type, status, created_at, updated_at)
            VALUES ($1, $2, $3, $4, 'active', now(), now())
            ON CONFLICT (id) DO UPDATE SET keycloak_user_id = EXCLUDED.keycloak_user_id, updated_at = now()
            ON CONFLICT (email) DO UPDATE SET keycloak_user_id = EXCLUDED.keycloak_user_id, updated_at = now()
            """,
            user_id,
            str(claims.sub),
            user_email,
            user_type,
        )

        if user_type == "faculty":
            await conn.execute(
                """
                INSERT INTO faculty_profiles (user_id, full_name, employee_id, designation, updated_at)
                VALUES ($1, $2, $3, $4, now())
                ON CONFLICT (user_id) DO NOTHING
                """,
                user_id,
                full_name,
                f"EMP-{str(user_id)[:8].upper()}",
                "Administrator" if claims.has_any_role("SUPER_ADMIN", "ADMIN") else "Faculty Member",
            )
        elif user_type == "worker":
            await conn.execute(
                """
                INSERT INTO worker_profiles (user_id, full_name, employee_id, designation, updated_at)
                VALUES ($1, $2, $3, $4, now())
                ON CONFLICT (user_id) DO NOTHING
                """,
                user_id,
                full_name,
                f"WRK-{str(user_id)[:8].upper()}",
                "Security Officer" if claims.has_any_role("GUARD", "SECURITY_GUARD", "SECURITY_ADMIN") else "Campus Operations",
            )
        else:
            await conn.execute(
                """
                INSERT INTO student_profiles (user_id, full_name, roll_number, updated_at)
                VALUES ($1, $2, $3, now())
                ON CONFLICT (user_id) DO NOTHING
                """,
                user_id,
                full_name,
                f"STU-{str(user_id)[:8].upper()}",
            )

        if claims.roles:
            valid_roles = [r.strip().upper() for r in claims.roles if not r.startswith("default-") and r != "uma_authorization"]
            if valid_roles:
                db_role_rows = await conn.fetch("SELECT id, name FROM roles WHERE UPPER(name) = ANY($1::text[])", valid_roles)
                for r_row in db_role_rows:
                    await conn.execute(
                        "INSERT INTO user_roles (user_id, role_id, assigned_at) VALUES ($1, $2, now()) ON CONFLICT (user_id, role_id) DO NOTHING",
                        user_id,
                        r_row["id"],
                    )

    logger.info("Auto-provisioned local user record for Keycloak subject %s (email: %s)", claims.sub, user_email)
    return user_id


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
    if claims.has_any_role("SUPER_ADMIN"):
        return None
    if not claims.has_any_role("WARDEN"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail={"code": "FORBIDDEN", "message": "warden role required"})

    cache_key = f"user:warden_scope:{claims.sub}"
    cached_scope = await redis_client.get(cache_key)
    if cached_scope is not None and isinstance(cached_scope, list):
        hostel_ids = [uuid.UUID(h) for h in cached_scope]
        if requested_hostel_id is not None and requested_hostel_id not in hostel_ids:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail={"code": "HOSTEL_SCOPE_FORBIDDEN", "message": "hostel is not assigned to this warden"})
        return hostel_ids

    user_id = await ensure_local_user(conn, claims)
    hostel_ids = list(await conn.fetchval("""
        SELECT COALESCE(array_agg(DISTINCT h_id), ARRAY[]::uuid[]) FROM (
            SELECT hostel_id AS h_id FROM warden_hostels WHERE user_id = $1 AND hostel_id IS NOT NULL
            UNION
            SELECT hostel_id AS h_id FROM warden_profiles WHERE user_id = $1 AND hostel_id IS NOT NULL
        ) sub
    """, user_id))

    # Cache the resolved warden scope in Redis (TTL: 300s)
    await redis_client.set(cache_key, [str(h) for h in hostel_ids], ex=300)

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

    cache_key = f"user:locations:{claims.sub}:{required_level}"
    cached_scope = await redis_client.get(cache_key)
    if cached_scope is not None and isinstance(cached_scope, list):
        allowed = [uuid.UUID(l) for l in cached_scope]
        if requested_location_id and requested_location_id not in allowed:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "code": "LOCATION_SCOPE_FORBIDDEN",
                    "message": "location not in authorized scope",
                },
            )
        return allowed

    user_id = await ensure_local_user(conn, claims)

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

    # Cache expanded locations in Redis (TTL: 300s)
    await redis_client.set(cache_key, [str(l) for l in allowed], ex=300)

    if requested_location_id and requested_location_id not in allowed:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "code": "LOCATION_SCOPE_FORBIDDEN",
                "message": "location not in authorized scope",
            },
        )

    return allowed
