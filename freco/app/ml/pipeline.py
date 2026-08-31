import time
from dataclasses import dataclass

import cv2
import numpy as np

from app.config import settings
from app.ml.face_align import align_face
from app.ml.model_manager import ModelManager
from app.ml.face_detector import DetectedFace, NoFaceDetectedError


@dataclass
class LivenessRejected(Exception):
    score: float
    timings: dict[str, float] | None = None


@dataclass
class FaceEmbedding:
    bbox: np.ndarray
    detection_score: float
    embeddings: dict[str, np.ndarray]


@dataclass
class FaceMatch:
    bbox: np.ndarray
    detection_score: float
    matched: bool
    similarity_score: float
    best_match_variant: str | None
    best_match_index: int | None
    liveness_score: float
    reason: str


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

    def extract_embeddings_for_all_faces(
        self, image_bgr: np.ndarray
    ) -> tuple[list[FaceEmbedding], dict[str, float], dict[str, str]]:
        """Embed every detected face without changing the single-face contract."""
        models = self._models.snapshot()
        timings: dict[str, float] = {}
        with self._models.metrics.measure_inference(models.detection, "detection") as measurement:
            faces = models.detector.detect(image_bgr)
        timings["detection"] = measurement.latency_ms or 0.0
        if not faces:
            raise NoFaceDetectedError("No face detected in frame")
        if len(faces) > settings.MAX_MULTI_FACES:
            raise ValueError(f"Too many faces in image; maximum is {settings.MAX_MULTI_FACES}")

        started = time.perf_counter()
        results = [self._embed_detected_face(image_bgr, face, models) for face in faces]
        timings["recognition"] = self._elapsed(started)
        self._models.metrics.record_pipeline_inference(timings)
        return results, timings, self._model_names(models)

    def match_all_against_embeddings(
        self, image_bgr: np.ndarray, candidate_embeddings: dict[str, list[np.ndarray]]
    ) -> tuple[list[FaceMatch], dict[str, float], dict[str, str]]:
        """Run liveness and recognition independently for each face in one frame."""
        models = self._models.snapshot()
        timings: dict[str, float] = {}
        with self._models.metrics.measure_inference(models.detection, "detection") as measurement:
            faces = models.detector.detect(image_bgr)
        timings["detection"] = measurement.latency_ms or 0.0
        if not faces:
            raise NoFaceDetectedError("No face detected in frame")
        if len(faces) > settings.MAX_MULTI_FACES:
            raise ValueError(f"Too many faces in image; maximum is {settings.MAX_MULTI_FACES}")

        results: list[FaceMatch] = []
        liveness_ms = 0.0
        recognition_ms = 0.0
        for face in faces:
            started = time.perf_counter()
            with self._models.metrics.measure_inference(models.liveness, "liveness"):
                is_live, liveness_score = models.liveness_detector.predict(image_bgr, face.bbox)
            liveness_ms += self._elapsed(started)
            if not is_live:
                results.append(FaceMatch(face.bbox, face.det_score, False, 0.0, None, None, liveness_score, "spoof_detected"))
                continue
            started = time.perf_counter()
            embedded = self._embed_detected_face(image_bgr, face, models)
            recognition_ms += self._elapsed(started)
            matches = [
                (float(np.dot(live_embedding, candidate)), variant, index)
                for variant, live_embedding in embedded.embeddings.items()
                for index, candidate in enumerate(candidate_embeddings.get(variant, []))
            ]
            if not matches:
                raise ValueError("candidate_embeddings does not include a vector compatible with IMAGE_STORAGE_MODE")
            score, variant, index = max(matches, key=lambda match: match[0])
            score = float(np.clip(score, -1.0, 1.0))
            results.append(FaceMatch(face.bbox, face.det_score, score >= settings.COSINE_SIMILARITY_THRESHOLD,
                                     score, variant, index, liveness_score,
                                     "authenticated" if score >= settings.COSINE_SIMILARITY_THRESHOLD else "similarity_below_threshold"))
        timings["liveness"] = round(liveness_ms, 2)
        timings["recognition"] = round(recognition_ms, 2)
        self._models.metrics.record_pipeline_inference(timings)
        return results, timings, self._model_names(models)

    def _embed_detected_face(self, image_bgr: np.ndarray, face: DetectedFace, models) -> FaceEmbedding:
        color_aligned, grayscale_aligned = self._aligned_variants(image_bgr, face.landmarks)
        embeddings = self._embeddings(models.recognizer, color_aligned, grayscale_aligned, models.recognition)
        return FaceEmbedding(face.bbox, face.det_score, embeddings)

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
