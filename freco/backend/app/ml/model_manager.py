from __future__ import annotations
import os
import threading
from dataclasses import dataclass

from app.config import settings
from app.ml.face_detector import FaceDetector
from app.ml.face_recognizer import FaceRecognizer
from app.ml.liveness import LivenessDetector
from app.ml.model_metrics import ModelMetrics
from app.ml.model_registry import get_face_model_registry
DETECTION_MODELS = ("SCRFD",)
LIVENESS_MODELS = ("MiniFASNet",)
RECOGNITION_MODELS = ("ArcFace",)
@dataclass(frozen=True)
class ActiveModels:
    detection: str
    liveness: str
    recognition: str
    detector: FaceDetector
    liveness_detector: LivenessDetector
    recognizer: FaceRecognizer


class ModelUnavailableError(RuntimeError):
    pass


class ModelManager:
    """Caches model objects and provides ActiveModels snapshots with lazy loading."""

    def __init__(self, lazy: bool = True):
        self._lock = threading.RLock()
        self.metrics = ModelMetrics()
        self._initialized = False
        self._cache = {}
        self._active = {"detection": "SCRFD", "liveness": "MiniFASNet", "recognition": "ArcFace"}
        if not lazy:
            self._ensure_loaded()

    def is_loaded(self) -> bool:
        with self._lock:
            return self._initialized

    def _ensure_loaded(self) -> None:
        if self._initialized:
            return
        with self._lock:
            if self._initialized:
                return
            with self.metrics.measure_load("SCRFD + ArcFace (InsightFace pack)", stage="shared", shared=True):
                registry = get_face_model_registry()
            self.metrics.set_device(registry.runtime.device)
            
            self._cache = {
                ("detection", "SCRFD"): FaceDetector(registry),
                ("recognition", "ArcFace"): FaceRecognizer(registry),
            }
            with self.metrics.measure_load("MiniFASNet", stage="liveness"):
                self._cache[("liveness", "MiniFASNet")] = LivenessDetector()
            self._initialized = True

    def status(self) -> dict[str, object]:
        self._ensure_loaded()
        with self._lock:
            return {
                "active": dict(self._active),
                "available": {
                    "detection": [{"name": "SCRFD", "available": True}],
                    "liveness": [{"name": "MiniFASNet", "available": True}],
                    "recognition": [{"name": "ArcFace", "available": True}],
                },
            }

    def quick_status(self) -> dict[str, object]:
        with self._lock:
            return {
                "initialized": self._initialized,
                "device": self.metrics.device if self._initialized else None,
                "active": dict(self._active) if self._initialized else None,
            }

    def performance_status(self) -> list[dict[str, object]]:
        self._ensure_loaded()
        with self._lock:
            return self.metrics.status(dict(self._active), self._telemetry_information())

    def performance_summary(self) -> dict[str, float | int | None]:
        return self.metrics.summary()

    def resource_status(self) -> list[dict[str, object]]:
        self._ensure_loaded()
        with self._lock:
            return self.metrics.resource_status(dict(self._active))

    def _telemetry_information(self) -> dict[str, dict[str, object]]:
        details: dict[str, dict[str, object]] = {
            "SCRFD + ArcFace (InsightFace pack)": {
                "model_type": "InsightFace Antelope model pack",
                "purpose": "Shared face detection and embedding models",
                "framework": "InsightFace / ONNX Runtime",
                "device": self.metrics.device,
                "models_included": "SCRFD, ArcFace",
            }
        }
        definitions = {
            "SCRFD": ("detection", "SCRFD", "SCRFD face detector", "Face detection"),
            "ArcFace": ("recognition", "ArcFace", "ArcFace embedding network", "Face recognition / embedding"),
            "MiniFASNet": ("liveness", "MiniFASNet", "MiniFASNet", "Passive liveness / anti-spoofing"),
        }
        for name, (stage, cache_name, model_type, purpose) in definitions.items():
            model = self._cache.get((stage, cache_name))
            if model is None:
                continue
            info = {"model_type": model_type, "purpose": purpose, "device": self.metrics.device}
            if name == "MiniFASNet":
                info.update(model.telemetry_info())
            else:
                session_model = getattr(model, "_detector", None)
                if session_model is None:
                    session_model = getattr(model, "_rec_model", None)
                session = getattr(session_model, "session", None)
                if session is not None:
                    info["framework"] = "InsightFace / ONNX Runtime"
                    info["input_dimensions"] = _session_shape(session.get_inputs()[0].shape)
                    info["output_dimensions"] = _session_shape(session.get_outputs()[0].shape)
            details[name] = info
        return details

    def snapshot(self) -> ActiveModels:
        self._ensure_loaded()
        with self._lock:
            return ActiveModels(
                detection=self._active["detection"], liveness=self._active["liveness"], recognition=self._active["recognition"],
                detector=self._cache[("detection", "SCRFD")],
                liveness_detector=self._cache[("liveness", "MiniFASNet")],
                recognizer=self._cache[("recognition", "ArcFace")],
            )


def _session_shape(shape: object) -> str:
    return " × ".join(str(value) for value in shape) if isinstance(shape, (list, tuple)) else str(shape)
