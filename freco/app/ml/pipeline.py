import time
from dataclasses import dataclass

import cv2
import numpy as np

from app.config import settings
from app.ml.face_align import align_face
from app.ml.model_manager import ModelManager


@dataclass
class LivenessRejected(Exception):
    score: float
    timings: dict[str, float] | None = None


class FacePipeline:
    """Stateless face processing: embedding extraction and live-vector matching only."""

    def __init__(self, model_manager: ModelManager):
        self._models = model_manager

    def extract_embeddings(
        self, image_bgr: np.ndarray
    ) -> tuple[dict[str, np.ndarray], dict[str, float], dict[str, str]]:
        """Detect one face, align it, and generate configured ArcFace variants."""
        models = self._models.snapshot()
        timings: dict[str, float] = {}

        with self._models.metrics.measure_inference(models.detection, "detection") as measurement:
            face = models.detector.detect_single(image_bgr)
        timings["detection"] = measurement.latency_ms or 0.0

        started = time.perf_counter()
        color_aligned, grayscale_aligned = self._aligned_variants(image_bgr, face.landmarks)
        timings["alignment"] = self._elapsed(started)

        started = time.perf_counter()
        embeddings = self._embeddings(
            models.recognizer, color_aligned, grayscale_aligned, models.recognition
        )
        timings["recognition"] = self._elapsed(started)
        self._models.metrics.record_pipeline_inference(timings)
        return embeddings, timings, self._model_names(models)

    def match_against_embeddings(
        self, image_bgr: np.ndarray, candidate_embeddings: dict[str, list[np.ndarray]]
    ) -> tuple[float, str, int, float, dict[str, float], dict[str, str]]:
        """Check liveness, embed one live face, then score it against external vectors."""
        models = self._models.snapshot()
        timings: dict[str, float] = {}

        with self._models.metrics.measure_inference(models.detection, "detection") as measurement:
            face = models.detector.detect_single(image_bgr)
        timings["detection"] = measurement.latency_ms or 0.0

        with self._models.metrics.measure_inference(models.liveness, "liveness") as measurement:
            is_live, liveness_score = models.liveness_detector.predict(image_bgr, face.bbox)
        timings["liveness"] = measurement.latency_ms or 0.0
        if not is_live:
            raise LivenessRejected(liveness_score, timings)

        started = time.perf_counter()
        color_aligned, grayscale_aligned = self._aligned_variants(image_bgr, face.landmarks)
        timings["alignment"] = self._elapsed(started)

        started = time.perf_counter()
        live_embeddings = self._embeddings(
            models.recognizer, color_aligned, grayscale_aligned, models.recognition
        )
        timings["recognition"] = self._elapsed(started)

        matches = [
            (float(np.dot(live_embedding, candidate)), variant, index)
            for variant, live_embedding in live_embeddings.items()
            for index, candidate in enumerate(candidate_embeddings.get(variant, []))
        ]
        if not matches:
            raise ValueError("candidate_embeddings does not include a vector compatible with IMAGE_STORAGE_MODE")
        best_score, best_variant, best_match_index = max(matches, key=lambda match: match[0])
        best_score = float(np.clip(best_score, -1.0, 1.0))

        self._models.metrics.record_pipeline_inference(timings)
        return best_score, best_variant, best_match_index, liveness_score, timings, self._model_names(models)

    @staticmethod
    def _aligned_variants(
        image_bgr: np.ndarray, landmarks: np.ndarray
    ) -> tuple[np.ndarray | None, np.ndarray | None]:
        mode = settings.IMAGE_STORAGE_MODE
        color_aligned = align_face(image_bgr, landmarks) if mode in ("color", "both") else None
        grayscale_aligned = None
        if mode in ("grayscale", "both"):
            grayscale = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2GRAY)
            grayscale_bgr = cv2.cvtColor(grayscale, cv2.COLOR_GRAY2BGR)
            grayscale_aligned = align_face(grayscale_bgr, landmarks)
        return color_aligned, grayscale_aligned

    def _embeddings(self, recognizer, color_aligned, grayscale_aligned, model_name: str) -> dict[str, np.ndarray]:
        embeddings: dict[str, np.ndarray] = {}
        for variant, aligned in (("color", color_aligned), ("grayscale", grayscale_aligned)):
            if aligned is not None:
                with self._models.metrics.measure_inference(model_name, "recognition"):
                    embeddings[variant] = recognizer.get_embedding(aligned)
        return embeddings

    @staticmethod
    def _model_names(models) -> dict[str, str]:
        return {
            "detection": models.detection,
            "liveness": models.liveness,
            "recognition": models.recognition,
        }

    @staticmethod
    def _elapsed(started: float) -> float:
        return round((time.perf_counter() - started) * 1000, 2)
