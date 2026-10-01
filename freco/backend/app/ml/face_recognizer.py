import os

import cv2
import numpy as np

from app.config import settings
from app.ml.model_registry import FaceModelRegistry, get_face_model_registry


def l2_normalize(v: np.ndarray) -> np.ndarray:
    norm = np.linalg.norm(v)
    if not np.isfinite(v).all() or not np.isfinite(norm) or norm == 0:
        raise ValueError("ArcFace produced an invalid embedding")
    return v / norm

class FaceRecognizer:
    def __init__(self, registry: FaceModelRegistry | None = None):
        self._registry = registry or get_face_model_registry()
        self._rec_model = self._registry.recognizer

    def get_embedding(self, aligned_face_bgr: np.ndarray) -> np.ndarray:
        embedding = self._rec_model.get_feat(aligned_face_bgr)
        embedding = np.asarray(
            embedding,
            dtype=np.float32
        ).flatten()

        return l2_normalize(embedding)
