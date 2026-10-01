import cv2
import numpy as np
from app.config import settings

class InvalidImageError(ValueError):
    pass
def decode_uploaded_image(raw: bytes) -> np.ndarray:
    """Decode uploaded image bytes into the BGR array consumed by OpenCV."""
    max_bytes = settings.MAX_UPLOAD_IMAGE_MB * 1024 * 1024
    if not raw:
        raise InvalidImageError("Uploaded image is empty")
    if len(raw) > max_bytes:
        raise InvalidImageError(
            f"Image exceeds max allowed size of {settings.MAX_UPLOAD_IMAGE_MB} MB"
        )

    buffer = np.frombuffer(raw, dtype=np.uint8)
    img = cv2.imdecode(buffer, cv2.IMREAD_COLOR)
    if img is None:
        raise InvalidImageError("Payload is not a valid image (decode failed)")
    if img.shape[0] * img.shape[1] > settings.MAX_IMAGE_PIXELS:
        raise InvalidImageError(
            f"Image exceeds max allowed dimensions of {settings.MAX_IMAGE_PIXELS} pixels"
        )
    return img
