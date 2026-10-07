"""Unit test suite for FRECO Lazy Loading and Redis Caching architecture.

Tests cover:
1. LazyResourceManager cold state at startup (no models in RAM).
2. On-demand lazy initialization on first request.
3. In-process pipeline reuse across subsequent requests.
4. Concurrency & stampede prevention (10 concurrent requests initialize model once).
5. FrecoRedisClient serialization, cache-aside get_or_set, and TTLs.
6. FRECO domain cache invalidation (person metadata and RFID lookups).
7. Attendance deduplication in Redis (is_attendance_recorded, set_attendance_recorded).
8. Fail-open Redis resilience (graceful in-memory fallback during Redis outages).
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

# Provide mocks for heavy ML/system dependencies not installed in test runner environment
sys.modules.setdefault("numpy", MagicMock())
sys.modules.setdefault("cv2", MagicMock())
sys.modules.setdefault("insightface", MagicMock())
sys.modules.setdefault("insightface.app", MagicMock())
sys.modules.setdefault("onnxruntime", MagicMock())
sys.modules.setdefault("pydantic", MagicMock())
sys.modules.setdefault("pydantic_settings", MagicMock())
sys.modules.setdefault("asyncpg", MagicMock())
sys.modules.setdefault("httpx", MagicMock())
sys.modules.setdefault("fastapi", MagicMock())
sys.modules.setdefault("fastapi.responses", MagicMock())

# Add freco/backend to path and isolate app package
FRECO_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "freco", "backend"))
for k in list(sys.modules.keys()):
    if k == "app" or k.startswith("app."):
        del sys.modules[k]
sys.path = [p for p in sys.path if "user_management" not in p]
if FRECO_PATH not in sys.path:
    sys.path.insert(0, FRECO_PATH)

from app.core.redis_client import CustomJSONEncoder, FrecoRedisClient
from app.ml.resource_manager import LazyResourceManager


class TestFrecoLazyResourceManager(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.rm = LazyResourceManager()

    def test_cold_state_at_startup(self):
        """At startup, no heavy models must be loaded in RAM."""
        self.assertFalse(self.rm.is_loaded())
        status = self.rm.status()
        self.assertEqual(status["status"], "lazy_unloaded")
        self.assertFalse(status["initialized"])
        # Checking status must NOT trigger model loading
        self.assertFalse(self.rm.is_loaded())

    def test_lazy_initialization_and_reuse_sync(self):
        """First request initializes model; second request reuses cached instance."""
        mock_pipeline = MagicMock()
        mock_mm = MagicMock()
        mock_mm.is_loaded.return_value = True

        with patch("app.ml.resource_manager.ModelManager", return_value=mock_mm) as mock_mm_cls, \
             patch("app.ml.resource_manager.FacePipeline", return_value=mock_pipeline) as mock_fp_cls:

            # 1. Cold initially
            self.assertFalse(self.rm.is_loaded())
            mock_mm_cls.assert_not_called()

            # 2. First request triggers initialization
            pipeline1 = self.rm.get_pipeline()
            self.assertIs(pipeline1, mock_pipeline)
            self.assertTrue(self.rm.is_loaded())
            self.assertEqual(mock_mm_cls.call_count, 1)

            # 3. Subsequent request reuses pipeline from process memory
            pipeline2 = self.rm.get_pipeline()
            self.assertIs(pipeline2, mock_pipeline)
            self.assertEqual(mock_mm_cls.call_count, 1)  # No redundant re-load

    async def test_lazy_initialization_and_reuse_async(self):
        """Async requests initialize model lazily and reuse process memory."""
        mock_pipeline = MagicMock()
        mock_mm = MagicMock()
        mock_mm.is_loaded.return_value = True

        with patch("app.ml.resource_manager.ModelManager", return_value=mock_mm) as mock_mm_cls, \
             patch("app.ml.resource_manager.FacePipeline", return_value=mock_pipeline):

            pipeline1 = await self.rm.get_pipeline_async()
            self.assertIs(pipeline1, mock_pipeline)
            self.assertTrue(self.rm.is_loaded())
            self.assertEqual(mock_mm_cls.call_count, 1)

            pipeline2 = await self.rm.get_pipeline_async()
            self.assertIs(pipeline2, mock_pipeline)
            self.assertEqual(mock_mm_cls.call_count, 1)

    async def test_concurrent_requests_stampede_prevention(self):
        """10 concurrent requests to cold pipeline trigger model loading exactly ONCE."""
        mock_pipeline = MagicMock()
        mock_mm = MagicMock()
        mock_mm.is_loaded.return_value = True
        init_count = 0

        def slow_model_init(*args, **kwargs):
            nonlocal init_count
            init_count += 1
            time.sleep(0.05)  # Simulate slow ONNX/InsightFace weight loading
            return mock_mm

        with patch("app.ml.resource_manager.ModelManager", side_effect=slow_model_init) as mock_mm_cls, \
             patch("app.ml.resource_manager.FacePipeline", return_value=mock_pipeline):

            # Simulate 10 simultaneous inference requests
            tasks = [self.rm.get_pipeline_async() for _ in range(10)]
            results = await asyncio.gather(*tasks)

            # All 10 requests must receive the exact same pipeline object
            for res in results:
                self.assertIs(res, mock_pipeline)

            # Heavy loading function was called EXACTLY ONCE
            self.assertEqual(init_count, 1)
            self.assertTrue(self.rm.is_loaded())

    def test_cleanup_releases_resources(self):
        """Shutdown cleanup properly unloads resources and resets state."""
        mock_pipeline = MagicMock()
        mock_mm = MagicMock()
        mock_mm.is_loaded.return_value = True

        with patch("app.ml.resource_manager.ModelManager", return_value=mock_mm), \
             patch("app.ml.resource_manager.FacePipeline", return_value=mock_pipeline):

            self.rm.get_pipeline()
            self.assertTrue(self.rm.is_loaded())

            self.rm.cleanup()
            self.assertFalse(self.rm.is_loaded())


class TestFrecoRedisClient(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.client = FrecoRedisClient()
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

    async def test_cache_aside_and_serialization(self):
        person_id = str(uuid.uuid4())
        data = {
            "id": person_id,
            "name": "Jane Doe",
            "enrolled_at": datetime.now(timezone.utc),
            "score": Decimal("0.985"),
        }

        # Cache Miss
        self.assertIsNone(await self.client.get(f"freco:person:{person_id}"))

        # Set
        await self.client.set(f"freco:person:{person_id}", data, ex=300)

        # Cache Hit
        cached = await self.client.get(f"freco:person:{person_id}")
        self.assertIsNotNone(cached)
        self.assertEqual(cached["id"], person_id)
        self.assertEqual(cached["name"], "Jane Doe")
        self.assertEqual(cached["score"], 0.985)

    async def test_attendance_deduplication(self):
        session_id = str(uuid.uuid4())
        person_id = str(uuid.uuid4())

        # Initially not recorded
        is_rec = await self.client.is_attendance_recorded(session_id, person_id)
        self.assertFalse(is_rec)

        # Mark recorded
        await self.client.set_attendance_recorded(session_id, person_id, ex=1800)

        # Now recorded
        is_rec_after = await self.client.is_attendance_recorded(session_id, person_id)
        self.assertTrue(is_rec_after)

    async def test_person_cache_invalidation(self):
        person_id = str(uuid.uuid4())
        rfid_uid = "04:A1:B2:C3"
        clean_rfid = "04A1B2C3"

        await self.client.set(f"freco:person:{person_id}", {"name": "Test Person"})
        await self.client.set(f"freco:rfid:{clean_rfid}", {"person_id": person_id})

        # Invalidate
        await self.client.invalidate_person_cache(person_id, rfid_uid=rfid_uid)

        # Both keys must be cleared
        self.assertIsNone(await self.client.get(f"freco:person:{person_id}"))
        self.assertIsNone(await self.client.get(f"freco:rfid:{clean_rfid}"))

    async def test_get_or_set_stampede_prevention(self):
        fetch_count = 0

        async def fetch_person_from_db():
            nonlocal fetch_count
            fetch_count += 1
            await asyncio.sleep(0.04)
            return {"id": "p1", "embedding_len": 512}

        tasks = [self.client.get_or_set("freco:person:p1", fetch_person_from_db, ex=300) for _ in range(10)]
        results = await asyncio.gather(*tasks)

        for res in results:
            self.assertEqual(res["id"], "p1")
            self.assertEqual(res["embedding_len"], 512)

        # DB query run only once
        self.assertEqual(fetch_count, 1)


class TestFrecoRedisFailOpenResilience(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.client = FrecoRedisClient()
        self.mock_redis = MagicMock()
        # Simulate connection error
        self.mock_redis.get = AsyncMock(side_effect=ConnectionError("Redis connection refused"))
        self.mock_redis.set = AsyncMock(side_effect=ConnectionError("Redis connection refused"))
        self.mock_redis.delete = AsyncMock(side_effect=ConnectionError("Redis connection refused"))
        self.client.redis = self.mock_redis

    async def test_fail_open_operations(self):
        # Set must fallback to memory cache and return True
        success = await self.client.set("freco:test_key", {"status": "ok"}, ex=60)
        self.assertTrue(success)

        # Get must catch error, fallback to memory cache, and return data
        val = await self.client.get("freco:test_key")
        self.assertEqual(val, {"status": "ok"})


if __name__ == "__main__":
    unittest.main()
