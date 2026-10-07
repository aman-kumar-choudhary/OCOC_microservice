from __future__ import annotations
import asyncio
from datetime import date, datetime
from decimal import Decimal
import fnmatch
import inspect
import json
import logging
import time
from typing import Any, Callable, Dict, List, Optional, Set, Tuple
import uuid
try:
    import redis.asyncio as aioredis
except ImportError:
    aioredis = None
from app.config import settings

logger = logging.getLogger("ococ.redis")


class CustomJSONEncoder(json.JSONEncoder):
    """Custom JSON encoder handling UUID, datetime, date, Decimal, and Pydantic models."""

    def default(self, obj: Any) -> Any:
        if isinstance(obj, uuid.UUID):
            return str(obj)
        if isinstance(obj, (datetime, date)):
            return obj.isoformat()
        if isinstance(obj, Decimal):
            return float(obj)
        if hasattr(obj, "model_dump"):
            try:
                return obj.model_dump(mode="json")
            except TypeError:
                return obj.model_dump()
        if hasattr(obj, "dict"):
            return obj.dict()
        if isinstance(obj, set):
            return list(obj)
        return super().default(obj)


class RedisClient:
    """Production-grade Redis client with cache-aside helpers, in-memory fallback,

    and resilience against Redis connection outages.
    """

    def __init__(self) -> None:
        self.redis: Optional[aioredis.Redis] = None
        # In-memory fallback if Redis is unreachable (for OTP and temporary tokens)
        self._memory_store: Dict[str, Tuple[str, float]] = {}
        # Stampede lock dictionary to avoid simultaneous cache stampedes in a single process
        self._locks: Dict[str, asyncio.Lock] = {}
        self._locks_guard = asyncio.Lock()

    async def connect(self) -> None:
        if aioredis is None:
            logger.warning("redis package not installed; RedisClient using in-memory fallback")
            self.redis = None
            return

        try:
            self.redis = aioredis.from_url(
                settings.REDIS_URL,
                password=settings.REDIS_PASSWORD or None,
                decode_responses=True,
                socket_timeout=2.0,
                socket_connect_timeout=3.0,
                retry_on_timeout=True,
            )
            await self.redis.ping()
            logger.info("Redis connected successfully (%s)", settings.REDIS_URL)
        except Exception as err:
            logger.warning(
                "Redis connection failed (%s); continuing with database-direct fallback",
                err,
            )
            self.redis = None

    async def close(self) -> None:
        if self.redis is not None:
            try:
                await self.redis.close()
                logger.info("Redis connection closed")
            except Exception as e:
                logger.warning("Error closing Redis connection: %s", e)
            finally:
                self.redis = None

    @property
    def is_available(self) -> bool:
        return self.redis is not None

    # ── Generic Cache-Aside Operations ──────────────────────────────────────────

    async def get(self, key: str) -> Optional[Any]:
        """Fetch and deserialize JSON from Redis. Returns None on cache miss or Redis error."""
        if self.redis is None:
            # Fallback to local memory store if Redis is not connected
            if key in self._memory_store:
                raw, expiry = self._memory_store[key]
                if time.time() < expiry:
                    try:
                        return json.loads(raw)
                    except Exception:
                        pass
                else:
                    self._memory_store.pop(key, None)
            return None
        try:
            raw = await self.redis.get(key)
            if raw is None:
                return None
            return json.loads(raw)
        except Exception as e:
            logger.warning("Redis GET failed for key %s: %s (falling back to memory/db)", key, e)
            if key in self._memory_store:
                raw, expiry = self._memory_store[key]
                if time.time() < expiry:
                    try:
                        return json.loads(raw)
                    except Exception:
                        pass
                else:
                    self._memory_store.pop(key, None)
            return None

    async def set(self, key: str, value: Any, ex: Optional[int] = None) -> bool:
        """Serialize and store value as JSON in Redis. Returns True on success, False otherwise."""
        try:
            payload = json.dumps(value, cls=CustomJSONEncoder)
        except Exception as e:
            logger.warning("Failed to serialize cache value for %s: %s", key, e)
            return False

        if self.redis is None:
            expiry = time.time() + (ex if ex and ex > 0 else 300)
            self._memory_store[key] = (payload, expiry)
            return True

        try:
            if ex is not None and ex > 0:
                await self.redis.set(key, payload, ex=ex)
            else:
                await self.redis.set(key, payload)
            return True
        except Exception as e:
            logger.warning("Redis SET failed for key %s: %s (saving to memory fallback)", key, e)
            expiry = time.time() + (ex if ex and ex > 0 else 300)
            self._memory_store[key] = (payload, expiry)
            return True

    async def delete(self, *keys: str) -> int:
        """Delete one or more keys from Redis and in-memory store."""
        deleted_count = 0
        for k in keys:
            if self._memory_store.pop(k, None) is not None:
                deleted_count += 1

        if self.redis is None or not keys:
            return deleted_count

        try:
            valid_keys = [k for k in keys if k]
            if not valid_keys:
                return deleted_count
            redis_deleted = await self.redis.delete(*valid_keys)
            return max(deleted_count, redis_deleted)
        except Exception as e:
            logger.warning("Redis DELETE failed for keys %s: %s", keys, e)
            return deleted_count

    async def delete_pattern(self, pattern: str) -> int:
        """Scan and delete keys matching pattern using non-blocking SCAN iterator."""
        mem_keys = [k for k in list(self._memory_store.keys()) if fnmatch.fnmatch(k, pattern)]
        for k in mem_keys:
            self._memory_store.pop(k, None)

        if self.redis is None:
            return len(mem_keys)

        deleted_count = 0
        try:
            cursor = 0
            while True:
                cursor, keys = await self.redis.scan(cursor=cursor, match=pattern, count=100)
                if keys:
                    deleted = await self.redis.delete(*keys)
                    deleted_count += deleted
                if cursor == 0:
                    break
            if deleted_count > 0:
                logger.debug("Redis scan & deleted %d keys matching %s", deleted_count, pattern)
            return max(deleted_count, len(mem_keys))
        except Exception as e:
            logger.warning("Redis DELETE_PATTERN failed for pattern %s: %s", pattern, e)
            return len(mem_keys)

    # ── Stampede Prevention Helper ──────────────────────────────────────────────

    async def get_or_set(
        self,
        key: str,
        fetcher: Callable[[], Any],
        ex: int = 300,
    ) -> Any:
        """Cache-aside pattern with single-flight mutex per key to prevent thundering herds."""
        # 1. Fast path: check cache
        cached = await self.get(key)
        if cached is not None:
            return cached

        # 2. Acquire key-specific lock to prevent dogpiling the database
        async with self._locks_guard:
            if key not in self._locks:
                self._locks[key] = asyncio.Lock()
            lock = self._locks[key]

        async with lock:
            # Re-check cache inside lock (double-checked locking)
            cached = await self.get(key)
            if cached is not None:
                return cached

            # Execute fetcher (coroutine or callable)
            if inspect.iscoroutinefunction(fetcher):
                result = await fetcher()
            elif callable(fetcher):
                res = fetcher()
                result = await res if asyncio.iscoroutine(res) else res
            else:
                result = fetcher

            if result is not None:
                await self.set(key, result, ex=ex)

            return result

    # ── Domain-Specific Invalidation Helpers ────────────────────────────────────

    async def invalidate_user_cache(
        self,
        user_id: str | uuid.UUID,
        email: Optional[str] = None,
        keycloak_sub: Optional[str] = None,
    ) -> None:
        """Evict all cached entries related to a specific user."""
        uid_str = str(user_id)
        keys_to_delete = [
            f"user:{uid_str}",
            f"user:me:{uid_str}",
            f"user:roles:{uid_str}",
            f"user:permissions:{uid_str}",
            f"user:locations:{uid_str}",
            f"user:locations:{uid_str}:VIEW",
            f"user:locations:{uid_str}:ENTRY",
            f"user:locations:{uid_str}:MANAGE",
            f"user:locations:{uid_str}:ADMIN",
            f"user:warden_scope:{uid_str}",
        ]
        if email:
            keys_to_delete.append(f"user:email:{email.lower()}")
            keys_to_delete.append(f"user:me:{email.lower()}")
        if keycloak_sub:
            keys_to_delete.append(f"user:me:{keycloak_sub}")

        await self.delete(*keys_to_delete)
        # Also clean up any wildcard location scope entries
        await self.delete_pattern(f"user:locations:{uid_str}*")
        # Invalidate dashboard overview since user counts/status may have changed
        await self.delete("dashboard:overview")
        logger.debug("Invalidated user cache for user %s", uid_str)

    async def invalidate_reference_caches(self) -> None:
        """Evict cached reference datasets (departments, hostels, locations)."""
        await self.delete(
            "reference:departments",
            "reference:hostels",
            "reference:locations",
            "access:locations",
            "access:devices",
        )
        logger.debug("Invalidated reference data caches")

    async def invalidate_role_caches(self) -> None:
        """Evict cached roles and all user roles/permissions."""
        await self.delete("roles:all")
        await self.delete_pattern("user:roles:*")
        await self.delete_pattern("user:permissions:*")
        await self.delete_pattern("user:me:*")
        logger.debug("Invalidated role caches")

    async def invalidate_rfid_caches(self, uid: Optional[str] = None) -> None:
        """Evict cached RFID records and user lookups."""
        if uid:
            clean_uid = uid.strip().replace(":", "").replace("-", "").upper()
            await self.delete(f"rfid:card:{clean_uid}", f"rfid:user:{clean_uid}")
        else:
            await self.delete_pattern("rfid:card:*")
            await self.delete_pattern("rfid:user:*")
        await self.delete("dashboard:overview")
        logger.debug("Invalidated RFID caches (uid=%s)", uid)

    async def invalidate_access_rules(self) -> None:
        """Evict cached access rules and rule statistics."""
        await self.delete("access:rules", "access:rule_stats")
        logger.debug("Invalidated access rule caches")

    # ── Legacy OTP and Password Reset Token Methods ─────────────────────────────

    async def set_otp(self, email: str, otp: str, ttl_seconds: int = 600) -> None:
        key = f"otp:{email.lower()}"
        if self.redis is not None:
            try:
                await self.redis.set(key, otp, ex=ttl_seconds)
                return
            except Exception as e:
                logger.error("Redis set_otp failed: %s", e)
        self._memory_store[key] = (otp, time.time() + ttl_seconds)

    async def get_otp(self, email: str) -> Optional[str]:
        key = f"otp:{email.lower()}"
        if self.redis is not None:
            try:
                return await self.redis.get(key)
            except Exception as e:
                logger.error("Redis get_otp failed: %s", e)
        if key in self._memory_store:
            val, expiry = self._memory_store[key]
            if time.time() < expiry:
                return val
            del self._memory_store[key]
        return None

    async def delete_otp(self, email: str) -> None:
        key = f"otp:{email.lower()}"
        if self.redis is not None:
            try:
                await self.redis.delete(key)
                return
            except Exception as e:
                logger.error("Redis delete_otp failed: %s", e)
        self._memory_store.pop(key, None)

    async def set_reset_token(self, token: str, email: str, ttl_seconds: int = 900) -> None:
        key = f"reset:{token}"
        if self.redis is not None:
            try:
                await self.redis.set(key, email.lower(), ex=ttl_seconds)
                return
            except Exception as e:
                logger.error("Redis set_reset_token failed: %s", e)
        self._memory_store[key] = (email.lower(), time.time() + ttl_seconds)

    async def get_reset_token(self, token: str) -> Optional[str]:
        key = f"reset:{token}"
        if self.redis is not None:
            try:
                return await self.redis.get(key)
            except Exception as e:
                logger.error("Redis get_reset_token failed: %s", e)
        if key in self._memory_store:
            val, expiry = self._memory_store[key]
            if time.time() < expiry:
                return val
            del self._memory_store[key]
        return None

    async def delete_reset_token(self, token: str) -> None:
        key = f"reset:{token}"
        if self.redis is not None:
            try:
                await self.redis.delete(key)
                return
            except Exception as e:
                logger.error("Redis delete_reset_token failed: %s", e)
        self._memory_store.pop(key, None)


redis_client = RedisClient()

