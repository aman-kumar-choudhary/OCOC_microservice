"""Accurate, bounded telemetry for loaded inference models."""
from __future__ import annotations

import collections
import ctypes
import logging
import subprocess
import threading
import time
from contextlib import contextmanager
from dataclasses import dataclass
from typing import Iterator

import psutil

logger = logging.getLogger(__name__)


def _gpu_memory_used_mb() -> float | None:
    """Total device VRAM in use; only used as a load-time delta."""
    try:
        output = subprocess.check_output(
            ["nvidia-smi", "--query-gpu=memory.used", "--format=csv,noheader,nounits"],
            text=True,
            timeout=1,
        ).strip()
        return round(sum(float(line.strip()) for line in output.splitlines() if line.strip()), 1)
    except Exception:
        return None


def _cuda_synchronize(device: str) -> bool:
    """Synchronize CUDA without requiring PyTorch as a production dependency."""
    if not device.startswith("cuda"):
        return False
    try:
        device_id = int(device.partition(":")[2] or 0)
        for library in ("libcudart.so", "libcudart.so.12", "libcudart.so.11.0"):
            try:
                runtime = ctypes.CDLL(library)
                runtime.cudaSetDevice(device_id)
                if runtime.cudaDeviceSynchronize() == 0:
                    return True
                return False
            except OSError:
                continue
    except Exception:
        pass
    return False


def _percentile(samples: list[float], fraction: float) -> float | None:
    """Linear-interpolated percentile for already sorted real samples."""
    if not samples:
        return None
    index = (len(samples) - 1) * fraction
    lower, upper = int(index), min(int(index) + 1, len(samples) - 1)
    return samples[lower] + (samples[upper] - samples[lower]) * (index - lower)


@dataclass
class InferenceMeasurement:
    latency_ms: float | None = None
    timestamp: float | None = None
    gpu_synchronized: bool = False


class ModelMetrics:
    """Rolling latency samples and load-resource observations for one process."""

    def __init__(self, max_samples: int = 500):
        self._lock = threading.RLock()
        self._samples: dict[str, collections.deque[dict[str, object]]] = {}
        self._cpu_samples: dict[str, collections.deque[float]] = {}
        self._pipeline_samples: collections.deque[float] = collections.deque(maxlen=max_samples)
        self._loads: dict[str, dict[str, object]] = {}
        self._max_samples = max_samples
        self._device = "cpu"
        self._process = psutil.Process()

    def set_device(self, device: str) -> None:
        self._device = device

    @property
    def device(self) -> str:
        return self._device

    @contextmanager
    def measure_load(self, name: str, *, stage: str, shared: bool = False) -> Iterator[None]:
        before_rss = psutil.Process().memory_info().rss
        before_gpu = _gpu_memory_used_mb()
        started = time.perf_counter()
        succeeded = False
        try:
            yield
            succeeded = True
        finally:
            after_rss = psutil.Process().memory_info().rss
            after_gpu = _gpu_memory_used_mb()
            details: dict[str, object] = {
                "stage": stage,
                "load_latency_ms": round((time.perf_counter() - started) * 1000, 2),
                "process_rss_delta_mb": round((after_rss - before_rss) / 1024 / 1024, 2),
                "device_vram_delta_mb": round(after_gpu - before_gpu, 2) if after_gpu is not None and before_gpu is not None else None,
                "shared_bundle": shared,
            }
            if succeeded:
                with self._lock:
                    self._loads[name] = details
                logger.info("model_loaded", extra={"event": "model_loaded", "model": name, **details})
            else:
                logger.warning("model_load_failed", extra={"event": "model_load_failed", "model": name, **details})

    @contextmanager
    def measure_inference(self, name: str, stage: str) -> Iterator[InferenceMeasurement]:
        """Record one model call: latency, CUDA-synchronized timing, and CPU utilization."""
        cpu_before = self._process.cpu_times()
        wall_started = time.perf_counter()
        measurement = InferenceMeasurement(gpu_synchronized=_cuda_synchronize(self._device))
        try:
            yield measurement
        finally:
            measurement.gpu_synchronized = _cuda_synchronize(self._device) or measurement.gpu_synchronized
            wall_elapsed = time.perf_counter() - wall_started
            measurement.latency_ms = round(wall_elapsed * 1000, 3)
            measurement.timestamp = time.time()

            cpu_after = self._process.cpu_times()
            cpu_seconds = (cpu_after.user - cpu_before.user) + (cpu_after.system - cpu_before.system)
            cpu_percent = round((cpu_seconds / wall_elapsed) * 100, 1) if wall_elapsed > 0 else 0.0

            sample = {
                "latency_ms": measurement.latency_ms,
                "timestamp": measurement.timestamp,
                "model": name,
                "stage": stage,
                "gpu_synchronized": measurement.gpu_synchronized,
            }
            with self._lock:
                self._samples.setdefault(name, collections.deque(maxlen=self._max_samples)).append(sample)
                self._cpu_samples.setdefault(name, collections.deque(maxlen=self._max_samples)).append(cpu_percent)
            logger.info("model_inference_performance", extra={"event": "model_inference_performance", **sample, "cpu_percent": cpu_percent})

    def status(self, active: dict[str, str], information: dict[str, dict[str, object]]) -> list[dict[str, object]]:
        stage_for_model = {name: stage for stage, name in active.items()}
        with self._lock:
            names = list(dict.fromkeys([*active.values(), *self._loads.keys(), *self._samples.keys()]))
            rows = []
            for name in names:
                samples = sorted(float(sample["latency_ms"]) for sample in self._samples.get(name, ()))
                load = self._loads.get(name, {})
                rows.append({
                    "name": name,
                    "stage": stage_for_model.get(name, load.get("stage", "inactive")),
                    "active": name in active.values(),
                    "inference_count": len(samples),
                    "average_latency_ms": round(sum(samples) / len(samples), 2) if samples else None,
                    "p99_latency_ms": round(_percentile(samples, .99), 2) if samples else None,
                    "min_latency_ms": round(samples[0], 2) if samples else None,
                    "max_latency_ms": round(samples[-1], 2) if samples else None,
                    "gpu_timing_synchronized": bool(self._samples.get(name)) and all(sample["gpu_synchronized"] for sample in self._samples[name]),
                    "load": load or None,
                    "information": information.get(name, {}),
                })
            return rows

    def resource_status(self, active: dict[str, str]) -> list[dict[str, object]]:
        shared_load_name = "SCRFD + ArcFace (InsightFace pack)"
        with self._lock:
            rows = []
            for stage, name in active.items():
                cpu_samples = list(self._cpu_samples.get(name, ()))
                avg_cpu = round(sum(cpu_samples) / len(cpu_samples), 1) if cpu_samples else 0.0

                load = self._loads.get(name)
                if load is None:
                    load = self._loads.get(shared_load_name, {})

                ram_mb = load.get("process_rss_delta_mb")
                gpu_mb = load.get("device_vram_delta_mb")

                rows.append({
                    "model": name,
                    "stage": stage,
                    "cpu_percent": avg_cpu,
                    "ram_mb": round(ram_mb, 1) if ram_mb is not None else None,
                    "gpu_mb": round(gpu_mb, 1) if gpu_mb is not None else None,
                })
            return rows

    def record_pipeline_inference(self, timings: dict[str, float]) -> None:
        """Keep the complete model-stage latency separate from API wall time."""
        total = sum(float(timings.get(stage, 0.0)) for stage in ("detection", "liveness", "recognition"))
        with self._lock:
            self._pipeline_samples.append(total)

    def summary(self) -> dict[str, float | int | None]:
        with self._lock:
            samples = list(self._pipeline_samples)
        return {
            "sample_count": len(samples),
            "average_model_inference_latency_ms": round(sum(samples) / len(samples), 2) if samples else None,
            "p95_model_inference_latency_ms": round(_percentile(sorted(samples), .95), 2) if samples else None,
        }
