"""Thread-safe and async-safe lazy resource manager for FRECO in-process ML models.

Models (SCRFD, ArcFace, MiniFASNet) and ONNX sessions are NOT loaded at application startup.
On the first inference/recognition request, the pipeline is initialized once, cached in process
memory, and reused for all subsequent requests within this OS worker process.
"""
from __future__ import annotations

import asyncio
import logging
import threading
import time
from typing import Optional

from app.ml.model_manager import ModelManager
from app.ml.pipeline import FacePipeline

logger = logging.getLogger(__name__)


class LazyResourceManager:
    """Manages lifecycle and lazy on-demand initialization of in-process ML resources."""

    def __init__(self) -> None:
        self._model_manager: Optional[ModelManager] = None
        self._pipeline: Optional[FacePipeline] = None
        self._thread_lock = threading.Lock()
        self._async_lock: Optional[asyncio.Lock] = None
        self._initialized = False

    def is_loaded(self) -> bool:
        """Return True if models are currently loaded in process memory."""
        return self._initialized and self._model_manager is not None and self._model_manager.is_loaded()

    def get_pipeline(self) -> FacePipeline:
        """Synchronous access to the face pipeline with double-checked thread locking."""
        if self._initialized and self._pipeline is not None:
            return self._pipeline

        with self._thread_lock:
            if self._initialized and self._pipeline is not None:
                return self._pipeline

            started = time.perf_counter()
            logger.info("Initializing FRECO FacePipeline lazily on first request...")
            mm = ModelManager(lazy=False)
            pipeline = FacePipeline(mm)
            self._model_manager = mm
            self._pipeline = pipeline
            self._initialized = True
            elapsed_ms = round((time.perf_counter() - started) * 1000, 2)
            logger.info("FRECO FacePipeline initialized successfully in %sms", elapsed_ms)
            return self._pipeline

    async def get_pipeline_async(self) -> FacePipeline:
        """Async-safe access to the face pipeline with single-flight locking."""
        if self._initialized and self._pipeline is not None:
            return self._pipeline

        if self._async_lock is None:
            self._async_lock = asyncio.Lock()

        async with self._async_lock:
            # Re-check under async lock
            if self._initialized and self._pipeline is not None:
                return self._pipeline

            # Run synchronous model loading in threadpool to avoid blocking event loop
            return await asyncio.to_thread(self.get_pipeline)

    def get_model_manager(self) -> ModelManager:
        """Return the underlying ModelManager."""
        self.get_pipeline()
        return self._model_manager

    def status(self) -> dict[str, object]:
        """Return status without necessarily triggering model loading if cold."""
        if not self._initialized or self._model_manager is None:
            return {
                "status": "lazy_unloaded",
                "message": "Models will be loaded on first inference request",
                "initialized": False,
            }
        return self._model_manager.status()

    def cleanup(self) -> None:
        """Release pipeline on worker shutdown."""
        with self._thread_lock:
            self._pipeline = None
            self._model_manager = None
            self._initialized = False
            logger.info("FRECO in-process ML resources released")


# Process-level singleton instance
resource_manager = LazyResourceManager()
