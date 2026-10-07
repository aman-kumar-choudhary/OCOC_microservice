from __future__ import annotations
import asyncio
from datetime import date, datetime
from decimal import Decimal
import inspect
import json
import logging
import time
from typing import Any, Callable, Dict, Optional, Set
import uuid

from app.config import settings

logger = logging.getLogger(__name__)


class CustomJSONEncoder(json.JSONEncoder):
    """Encodes UUIDs, datetimes, decimals, sets, and pydantic objects to JSON."""
    def default(self, obj: Any) -> Any:
        if isinstance(obj, uuid.UUID):
            return str(obj)
        if isinstance(obj, (datetime, date)):
            return obj.isoformat()
        if isinstance(obj, Decimal):
            return float(obj)
        if isinstance(obj, set):
            return list(obj)
        if hasattr(obj, "model_dump"):
            return obj.model_dump()
        if hasattr(obj, "dict"):
            return obj.dict()
        return super().default(obj)


class FrecoRedisClient:
    """Async Redis client for FRECO metadata caching and anti-stampede coordination.
    
    Provides graceful fail-open fallback so if Redis becomes unreachable,
    face recognition and attendance operations continue via PostgreSQL.
    """

    def __init__(self) -> None:
        self.redis: Any = None
        self._connected: bool = False
        self._locks: Dict[str, asyncio.Lock] = {}
        self._locks_guard: asyncio.Lock = asyncio.Lock()
        self._memory_cache: Dict[str, tuple[str, float]] = {}

    async def connect(self) -> None:
        """Establish Redis connection pool."""
        try:
            import redis.asyncio as aioredis
            self.redis = aioredis.from_url(
                settings.REDIS_URL,
                password=settings.REDIS_PASSWORD or None,
                decode_responses=True,
                socket_timeout=2.0,
                socket_connect_timeout=2.0,
            )
            await self.redis.ping()
            self._connected = True
            logger.info("FRECO Redis connected successfully at %s", settings.REDIS_URL)
        except Exception as e:
            self.redis = None
            self._connected = False
            logger.warning("FRECO Redis unavailable (%s); using graceful fallback", e)

    async def close(self) -> None:
        """Close connection pool."""
        if self.redis is not None:
            try:
                await self.redis.aclose()
            except Exception as e:
                logger.debug("Error closing Redis: %s", e)
            finally:
                self.redis = None
                self._connected = False

    async def get(self, key: str) -> Optional[Any]:
        """Fetch and deserialize JSON value. Returns None on cache miss or Redis error."""
        if self.redis is not None:
            try:
                raw = await self.redis.get(key)
                if raw is not None:
                    return json.loads(raw)
                return None
            except Exception as e:
                logger.warning("Redis GET error for %s: %s; falling back", key, e)

        # In-memory fallback check
        if key in self._memory_cache:
            val_str, expires_at = self._memory_cache[key]
            if time.time() < expires_at:
                return json.loads(val_str)
            del self._memory_cache[key]

        return None

    async def set(self, key: str, value: Any, ex: int = 300) -> bool:
        """Serialize and store JSON value with TTL."""
        serialized = json.dumps(value, cls=CustomJSONEncoder)
        if self.redis is not None:
            try:
                await self.redis.set(key, serialized, ex=ex)
                return True
            except Exception as e:
                logger.warning("Redis SET error for %s: %s; falling back", key, e)

        # In-memory fallback store
        self._memory_cache[key] = (serialized, time.time() + ex)
        return True

    async def delete(self, *keys: str) -> int:
        """Delete one or more keys from Redis and in-memory cache."""
        for k in keys:
            self._memory_cache.pop(k, None)

        if not keys or self.redis is None:
            return 0

        try:
            return await self.redis.delete(*keys)
        except Exception as e:
            logger.warning("Redis DELETE error for %s: %s", keys, e)
            return 0

    async def delete_pattern(self, pattern: str) -> int:
        """Delete keys matching pattern using non-blocking SCAN."""
        # Evict matching keys from in-memory cache
        prefix = pattern.rstrip("*")
        matching_mem = [k for k in self._memory_cache if k.startswith(prefix)]
        for k in matching_mem:
            self._memory_cache.pop(k, None)

        if self.redis is None:
            return len(matching_mem)

        deleted = 0
        try:
            cursor = 0
            while True:
                cursor, keys = await self.redis.scan(cursor=cursor, match=pattern, count=100)
                if keys:
                    deleted += await self.redis.delete(*keys)
                if cursor == 0:
                    break
        except Exception as e:
            logger.warning("Redis SCAN/DELETE error for pattern %s: %s", pattern, e)

        return deleted

    async def get_or_set(
        self,
        key: str,
        fetcher: Callable[[], Any],
        ex: int = 300,
    ) -> Any:
        """Cache-aside pattern with double-checked single-flight mutex per key."""
        cached = await self.get(key)
        if cached is not None:
            return cached

        async with self._locks_guard:
            if key not in self._locks:
                self._locks[key] = asyncio.Lock()
            lock = self._locks[key]

        async with lock:
            cached = await self.get(key)
            if cached is not None:
                return cached

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

    # ── FRECO-Specific Helpers ─────────────────────────────────────────────────

    async def invalidate_person_cache(
        self,
        external_id: str | uuid.UUID,
        rfid_uid: Optional[str] = None,
    ) -> None:
        """Evict person metadata and RFID lookups."""
        keys = [f"freco:person:{str(external_id)}"]
        if rfid_uid:
            clean_rfid = rfid_uid.strip().replace(":", "").replace("-", "").upper()
            keys.append(f"freco:rfid:{clean_rfid}")
        await self.delete(*keys)
        logger.debug("Invalidated person cache for external_id=%s", external_id)

    async def is_attendance_recorded(self, session_id: str | uuid.UUID, person_id: str | uuid.UUID) -> bool:
        """Quickly check if person attendance was already recorded in this session."""
        key = f"freco:att_recorded:{str(session_id)}:{str(person_id)}"
        return (await self.get(key)) is not None

    async def set_attendance_recorded(
        self,
        session_id: str | uuid.UUID,
        person_id: str | uuid.UUID,
        ex: int = 3600,
    ) -> None:
        """Record that this person has been registered for the session in Redis."""
        key = f"freco:att_recorded:{str(session_id)}:{str(person_id)}"
        await self.set(key, {"recorded": True, "ts": time.time()}, ex=ex)


freco_redis = FrecoRedisClient()
