from __future__ import annotations

import logging
import time
from typing import Dict, Optional, Tuple
import redis.asyncio as aioredis
from app.config import settings

logger = logging.getLogger(__name__)


class RedisClient:
    def __init__(self) -> None:
        self.redis: Optional[aioredis.Redis] = None
        # In-memory fallback if Redis is unreachable
        self._memory_store: Dict[str, Tuple[str, float]] = {}

    async def connect(self) -> None:
        try:
            self.redis = aioredis.from_url(
                settings.REDIS_URL,
                password=settings.REDIS_PASSWORD or None,
                decode_responses=True,
            )
            await self.redis.ping()
            logger.info("Redis connected")
        except Exception as err:
            logger.warning("Redis connection failed (%s); continuing with in-memory fallback", err)
            self.redis = None

    async def close(self) -> None:
        if self.redis is not None:
            await self.redis.close()
            logger.info("Redis connection closed")

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
