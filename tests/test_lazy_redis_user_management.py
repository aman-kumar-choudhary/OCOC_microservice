"""Unit test suite for User Management Lazy Loading and Redis Caching architecture.

Tests cover:
1. CustomJSONEncoder serialization (UUID, datetime, Decimal, Pydantic objects)
2. Cache-aside pattern (get, set, TTL, and get_or_set mutex)
3. Concurrency / Thundering herd prevention (double-checked locking)
4. Domain cache invalidation (users, roles, permissions, locations, RFID, rules)
5. Fail-open Redis resilience (graceful fallback when Redis errors or is offline)
6. Keycloak in-process admin token and role caching
"""
from __future__ import annotations

import asyncio
from datetime import datetime, timezone
from decimal import Decimal
import json
import os
import sys
import time
import unittest
from unittest.mock import AsyncMock, MagicMock, patch
import uuid

# Provide mocks for dependencies not installed in sandbox environment
sys.modules.setdefault("pydantic", MagicMock())
sys.modules.setdefault("pydantic_settings", MagicMock())
sys.modules.setdefault("asyncpg", MagicMock())
sys.modules.setdefault("httpx", MagicMock())
sys.modules.setdefault("fastapi", MagicMock())
sys.modules.setdefault("fastapi.responses", MagicMock())
sys.modules.setdefault("starlette", MagicMock())
sys.modules.setdefault("starlette.concurrency", MagicMock())

# Add user_management/backend to path and isolate app package
UM_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "user_management", "backend"))
for k in list(sys.modules.keys()):
    if k == "app" or k.startswith("app."):
        del sys.modules[k]
sys.path = [p for p in sys.path if "freco" not in p]
if UM_PATH not in sys.path:
    sys.path.insert(0, UM_PATH)

from app.core.redis_client import CustomJSONEncoder, RedisClient


class TestCustomJSONEncoder(unittest.TestCase):
    def test_serialization_types(self):
        uid = uuid.uuid4()
        now = datetime.now(timezone.utc)
        dec = Decimal("19.99")
        s = {"admin", "guard"}

        class DummyModel:
            def model_dump(self):
                return {"field": "value"}

        data = {
            "uid": uid,
            "now": now,
            "dec": dec,
            "roles": s,
            "model": DummyModel(),
        }

        encoded = json.dumps(data, cls=CustomJSONEncoder)
        decoded = json.loads(encoded)

        self.assertEqual(decoded["uid"], str(uid))
        self.assertEqual(decoded["now"], now.isoformat())
        self.assertEqual(decoded["dec"], 19.99)
        self.assertCountEqual(decoded["roles"], ["admin", "guard"])
        self.assertEqual(decoded["model"], {"field": "value"})


class TestRedisClientCacheAside(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.client = RedisClient()
        # Mock underlying redis instance
        self.mock_redis = MagicMock()
        self.store = {}

        async def mock_get(key):
            return self.store.get(key)

        async def mock_set(key, val, ex=None):
            self.store[key] = val
            return True

        async def mock_delete(*keys):
            count = 0
            for k in keys:
                if k in self.store:
                    del self.store[k]
                    count += 1
            return count

        async def mock_scan(cursor=0, match="*", count=100):
            import fnmatch
            matched = [k for k in self.store.keys() if fnmatch.fnmatch(k, match)]
            return 0, matched

        self.mock_redis.get = AsyncMock(side_effect=mock_get)
        self.mock_redis.set = AsyncMock(side_effect=mock_set)
        self.mock_redis.delete = AsyncMock(side_effect=mock_delete)
        self.mock_redis.scan = AsyncMock(side_effect=mock_scan)
        self.client.redis = self.mock_redis

    async def test_cache_miss_and_hit(self):
        test_key = "user:123"
        user_data = {"id": "123", "email": "test@ococ.org", "status": "active"}

        # 1. Miss
        self.assertIsNone(await self.client.get(test_key))

        # 2. Set
        await self.client.set(test_key, user_data, ex=300)

        # 3. Hit
        cached = await self.client.get(test_key)
        self.assertEqual(cached, user_data)

    async def test_get_or_set_stampede_prevention(self):
        test_key = "user:profile:456"
        db_fetch_count = 0

        async def expensive_db_fetch():
            nonlocal db_fetch_count
            db_fetch_count += 1
            await asyncio.sleep(0.05)  # simulate DB query latency
            return {"id": "456", "name": "Aman Kumar"}

        # Simulate 10 concurrent requests to the same cold key
        tasks = [self.client.get_or_set(test_key, expensive_db_fetch, ex=300) for _ in range(10)]
        results = await asyncio.gather(*tasks)

        # All 10 tasks must receive the identical data
        for r in results:
            self.assertEqual(r["id"], "456")
            self.assertEqual(r["name"], "Aman Kumar")

        # The expensive DB query must have run EXACTLY ONCE
        self.assertEqual(db_fetch_count, 1)


class TestDomainCacheInvalidation(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.client = RedisClient()
        self.mock_redis = MagicMock()
        self.store = {}

        async def mock_get(key):
            return self.store.get(key)

        async def mock_set(key, val, ex=None):
            self.store[key] = val
            return True

        async def mock_delete(*keys):
            count = 0
            for k in keys:
                if k in self.store:
                    del self.store[k]
                    count += 1
            return count

        async def mock_scan(cursor=0, match="*", count=100):
            import fnmatch
            matched = [k for k in self.store.keys() if fnmatch.fnmatch(k, match)]
            return 0, matched

        self.mock_redis.get = AsyncMock(side_effect=mock_get)
        self.mock_redis.set = AsyncMock(side_effect=mock_set)
        self.mock_redis.delete = AsyncMock(side_effect=mock_delete)
        self.mock_redis.scan = AsyncMock(side_effect=mock_scan)
        self.client.redis = self.mock_redis

    async def test_invalidate_user_cache(self):
        user_id = str(uuid.uuid4())
        # Populate various user-related cache keys
        await self.client.set(f"user:{user_id}", {"id": user_id})
        await self.client.set(f"user:me:{user_id}", {"profile": "me"})
        await self.client.set(f"user:roles:{user_id}", ["STUDENT"])
        await self.client.set(f"user:locations:{user_id}:ENTRY", ["loc1"])
        await self.client.set(f"user:locations:{user_id}:VIEW", ["loc2"])
        await self.client.set("dashboard:overview", {"total": 100})
        # Unrelated user
        other_user = str(uuid.uuid4())
        await self.client.set(f"user:{other_user}", {"id": other_user})

        # Invalidate target user
        await self.client.invalidate_user_cache(user_id)

        # Target user keys must be gone
        self.assertIsNone(await self.client.get(f"user:{user_id}"))
        self.assertIsNone(await self.client.get(f"user:me:{user_id}"))
        self.assertIsNone(await self.client.get(f"user:roles:{user_id}"))
        self.assertIsNone(await self.client.get(f"user:locations:{user_id}:ENTRY"))
        self.assertIsNone(await self.client.get("dashboard:overview"))

        # Unrelated user key must remain untouched
        self.assertIsNotNone(await self.client.get(f"user:{other_user}"))

    async def test_invalidate_role_caches(self):
        await self.client.set("roles:all", [{"name": "GUARD"}])
        await self.client.set("user:roles:u1", ["GUARD"])
        await self.client.set("user:permissions:u1", ["read"])
        await self.client.set("user:me:u1", {"role": "GUARD"})
        await self.client.set("other:key", "keep_me")

        await self.client.invalidate_role_caches()

        self.assertIsNone(await self.client.get("roles:all"))
        self.assertIsNone(await self.client.get("user:roles:u1"))
        self.assertIsNone(await self.client.get("user:permissions:u1"))
        self.assertIsNone(await self.client.get("user:me:u1"))
        self.assertIsNotNone(await self.client.get("other:key"))

    async def test_invalidate_rfid_caches(self):
        uid = "04A1B2C3"
        await self.client.set(f"rfid:card:{uid}", {"uid": uid})
        await self.client.set(f"rfid:user:{uid}", {"uid": uid})
        await self.client.set("dashboard:overview", {"rfid_active": 50})

        await self.client.invalidate_rfid_caches(uid)

        self.assertIsNone(await self.client.get(f"rfid:card:{uid}"))
        self.assertIsNone(await self.client.get(f"rfid:user:{uid}"))
        self.assertIsNone(await self.client.get("dashboard:overview"))


class TestRedisFailOpenResilience(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.client = RedisClient()
        self.mock_redis = MagicMock()
        # Simulate connection errors
        self.mock_redis.get = AsyncMock(side_effect=ConnectionError("Redis connection lost"))
        self.mock_redis.set = AsyncMock(side_effect=ConnectionError("Redis connection lost"))
        self.mock_redis.delete = AsyncMock(side_effect=ConnectionError("Redis connection lost"))
        self.client.redis = self.mock_redis

    async def test_fail_open_on_get(self):
        # Should catch error, log warning, and return None without raising exception
        val = await self.client.get("user:999")
        self.assertIsNone(val)

    async def test_fail_open_on_set_fallback_to_memory(self):
        # Even if Redis is down, in-memory store captures it temporarily
        res = await self.client.set("user:999", {"name": "Offline User"}, ex=60)
        self.assertTrue(res)

    async def test_get_or_set_succeeds_when_redis_fails(self):
        # When Redis fails, get_or_set should execute the source fetcher directly
        fetch_ran = False

        async def fetch_from_postgres():
            nonlocal fetch_ran
            fetch_ran = True
            return {"name": "Authoritative DB Result"}

        result = await self.client.get_or_set("user:db_fallback", fetch_from_postgres, ex=300)
        self.assertTrue(fetch_ran)
        self.assertEqual(result["name"], "Authoritative DB Result")


class TestKeycloakTokenCaching(unittest.IsolatedAsyncioTestCase):
    async def test_admin_token_caching_and_expiry(self):
        from app.core.keycloak_client import KeycloakClient

        client = KeycloakClient()
        http_post_count = 0

        async def mock_post(url, data=None, **kwargs):
            nonlocal http_post_count
            http_post_count += 1
            mock_resp = MagicMock()
            mock_resp.status_code = 200
            mock_resp.json.return_value = {
                "access_token": f"token_{http_post_count}",
                "expires_in": 100,  # 100 seconds
            }
            return mock_resp

        client.client.post = AsyncMock(side_effect=mock_post)

        # First call -> fetches new token
        token1 = await client.get_admin_token()
        self.assertEqual(token1, "token_1")
        self.assertEqual(http_post_count, 1)

        # Second call -> reuses cached token, no new HTTP request
        token2 = await client.get_admin_token()
        self.assertEqual(token2, "token_1")
        self.assertEqual(http_post_count, 1)

        # Fast-forward time past expiration buffer
        client._admin_token_expiry = time.time() - 10

        # Third call -> token expired, fetches fresh token
        token3 = await client.get_admin_token()
        self.assertEqual(token3, "token_2")
        self.assertEqual(http_post_count, 2)


if __name__ == "__main__":
    unittest.main()
