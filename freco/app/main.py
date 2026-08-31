import json
import logging
import time

import numpy as np
from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import ValidationError
from starlette.concurrency import run_in_threadpool

from app.config import settings
from app.ml.model_manager import ModelManager
from app.ml.face_detector import MultipleFacesDetectedError, NoFaceDetectedError
from app.ml.pipeline import FacePipeline, LivenessRejected
from app.ml.runtime import get_inference_runtime
from app.schemas import EmbeddingExtractionResponse, MatchResponse, StoredEmbeddings
from app.utils.image_utils import InvalidImageError, decode_uploaded_image

logger = logging.getLogger(__name__)
logging.basicConfig(
    level=logging.INFO,
    format='{"time":"%(asctime)s", "level":"%(levelname)s", "message":"%(message)s"}',
)


async def lifespan(app: FastAPI):
    started = time.perf_counter()
    runtime = get_inference_runtime()
    model_manager = ModelManager()
    app.state.model_manager = model_manager
    app.state.pipeline = FacePipeline(model_manager)
    logger.info(
        "freco_ready - device: %s - active models: %s - startup: %sms",
        runtime.device,
        model_manager.status()["active"],
        round((time.perf_counter() - started) * 1000, 2),
    )
    yield
    app.state.pipeline = None
    app.state.model_manager = None


app = FastAPI(title="freco", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


async def read_image(upload: UploadFile) -> np.ndarray:
    """Read one multipart image upload into the OpenCV BGR format."""
    try:
        return decode_uploaded_image(await upload.read())
    except InvalidImageError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc
    finally:
        await upload.close()


def face_error(exc: Exception, *, image_name: str = "image") -> HTTPException:
    if isinstance(exc, NoFaceDetectedError):
        return HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, f"No face detected in {image_name}")
    if isinstance(exc, MultipleFacesDetectedError):
        return HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            f"Expected exactly one face in {image_name}, found {exc.count}",
        )
    raise exc


def parse_candidate_embeddings(raw_embeddings: str) -> dict[str, list[np.ndarray]]:
    """Validate and normalize anonymous ArcFace vectors by color variant."""
    try:
        payload = json.loads(raw_embeddings)
        candidates = StoredEmbeddings.model_validate(payload)
    except (json.JSONDecodeError, ValidationError) as exc:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "candidate_embeddings must be a JSON object containing color and/or grayscale 512-dimensional vectors",
        ) from exc

    if not candidates.root:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "At least one candidate embedding is required")
    invalid_variants = set(candidates.root) - {"color", "grayscale"}
    if invalid_variants:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            f"Unsupported embedding variant(s): {', '.join(sorted(invalid_variants))}",
        )

    normalized: dict[str, list[np.ndarray]] = {}
    count = 0
    for variant, value in candidates.root.items():
        embeddings = value if value and isinstance(value[0], list) else [value]
        normalized[variant] = []
        for index, embedding in enumerate(embeddings):
            count += 1
            vector = np.asarray(embedding, dtype=np.float32)
            norm = np.linalg.norm(vector)
            if not np.isfinite(vector).all() or not np.isfinite(norm) or norm == 0:
                raise HTTPException(
                    status.HTTP_422_UNPROCESSABLE_ENTITY,
                    f"{variant} candidate embedding at index {index} is invalid",
                )
            normalized[variant].append(vector / norm)
    if count > settings.MAX_CANDIDATE_EMBEDDINGS:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            f"candidate_embeddings cannot contain more than {settings.MAX_CANDIDATE_EMBEDDINGS} vectors",
        )
    if count == 0:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "At least one candidate embedding is required")
    return normalized


def candidate_count(candidates: dict[str, list[np.ndarray]]) -> int:
    return sum(len(vectors) for vectors in candidates.values())


@app.get("/health")
async def health():
    return {"status": "healthy"}

@app.post("/api/v1/auth/get_image", response_model=EmbeddingExtractionResponse)
@app.post("/get_image", response_model=EmbeddingExtractionResponse)
async def get_image_embeddings(request: Request, image: UploadFile = File(...)):
    """Detect, align, and return normalized color/grayscale ArcFace vectors."""
    started = time.perf_counter()
    image_bgr = await read_image(image)
    try:
        embeddings, timings, models = await run_in_threadpool(
            request.app.state.pipeline.extract_embeddings, image_bgr
        )
    except (NoFaceDetectedError, MultipleFacesDetectedError) as exc:
        raise face_error(exc) from exc

    return EmbeddingExtractionResponse(
        embeddings={name: vector.astype(float).tolist() for name, vector in embeddings.items()},
        models={name: models[name] for name in ("detection", "recognition")},
        latency_ms=round((time.perf_counter() - started) * 1000, 2),
        step_latencies_ms=timings,
    )


@app.post("/match", response_model=MatchResponse)
@app.post("/api/v1/auth/match", response_model=MatchResponse)
async def match(
    request: Request,
    image: UploadFile = File(...),
    candidate_embeddings: str = Form(...),
):
    """Liveness-check an image and compare it against caller-supplied vectors."""
    started = time.perf_counter()
    image_bgr = await read_image(image)
    candidates = parse_candidate_embeddings(candidate_embeddings)

    try:
        similarity_score, best_match_variant, best_match_index, liveness_score, timings, models = await run_in_threadpool(
            request.app.state.pipeline.match_against_embeddings, image_bgr, candidates
        )
    except (NoFaceDetectedError, MultipleFacesDetectedError) as exc:
        raise face_error(exc) from exc
    except ValueError as exc:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, str(exc)) from exc
    except LivenessRejected as exc:
        return MatchResponse(
            matched=False,
            similarity_score=0.0,
            best_match_variant=None,
            best_match_index=None,
            candidate_count=candidate_count(candidates),
            liveness_score=exc.score,
            models={"detection": "SCRFD", "liveness": "MiniFASNet"},
            latency_ms=round((time.perf_counter() - started) * 1000, 2),
            step_latencies_ms=exc.timings or {},
            reason="spoof_detected",
            message="Spoof detected -- liveness check failed.",
        )

    matched = similarity_score >= settings.COSINE_SIMILARITY_THRESHOLD
    return MatchResponse(
        matched=matched,
        similarity_score=round(similarity_score, 4),
        best_match_variant=best_match_variant,
        best_match_index=best_match_index,
        candidate_count=candidate_count(candidates),
        liveness_score=liveness_score,
        models=models,
        latency_ms=round((time.perf_counter() - started) * 1000, 2),
        step_latencies_ms=timings,
        reason="authenticated" if matched else "similarity_below_threshold",
        message="Match successful" if matched else "Face mismatch",
    )




@router.get("/{student_id}/image")
async def student_image(student_id: str):
    from fastapi.responses import FileResponse
    from pathlib import Path
    directory = Path(__import__("app.config", fromlist=["settings"]).settings.STUDENT_IMAGE_DIR)
    candidates = sorted(path for path in directory.glob(f"{student_id}_*.jpg") if not path.name.endswith("_gray.jpg"))
    if not candidates:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Student image not found")
    return FileResponse(candidates[0], media_type="image/jpeg", headers={"Cache-Control": "no-cache, no-store, must-revalidate", "Pragma": "no-cache", "Expires": "0"})


@router.get("/{student_id}", response_model=StudentDetailResponse)
async def get_student(student_id: str, db: AsyncSession = Depends(get_db_session)):
    student = (await db.execute(select(Student).where(Student.student_id == student_id))).scalar_one_or_none()
    if student is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Student not found")
    return StudentDetailResponse(student_id=student.student_id, name=student.name, roll_number=student.roll_number, email=student.email)


@router.put("/{student_id}/face", response_model=StudentFaceUpdateResponse)
async def update_student_face(student_id: str, payload: StudentFaceUpdateRequest, request: Request, db: AsyncSession = Depends(get_db_session)):
    started = time.perf_counter()
    student = (await db.execute(select(Student).where(Student.student_id == student_id))).scalar_one_or_none()
    if student is None: raise HTTPException(status.HTTP_404_NOT_FOUND, "Student not found")
    raw_images = payload.face_images or ({"center": payload.image_base64} if payload.image_base64 else None)
    if not raw_images: raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Supply image_base64 or face_images")
    required_poses = {"center", "right", "left", "chin_up", "head_down"}
    if set(raw_images) != required_poses:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Face replacement requires five new poses: center, right, left, chin_up, head_down")
    try:
        images = {pose: decode_base64_image(raw) for pose, raw in raw_images.items()}
    except InvalidImageError as exc: raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc
    try:
        # A replacement is a full five-pose enrollment, not an authentication
        # attempt.  The authentication visibility/liveness gate is frontal-only
        # and rejects legitimate left/right/chin poses by design. Keep update
        # validation identical to initial registration so these captures can be
        # safely replaced as one set.
        processed = {pose: await run_in_threadpool(request.app.state.pipeline.process_for_registration, image) for pose, image in images.items()}
    except (NoFaceDetectedError, MultipleFacesDetectedError) as exc:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, str(exc)) from exc
    model = next(iter(processed.values())).models["recognition"]
    store = get_vector_store(model)
    old_embeddings = store.embeddings_for_student(student_id)
    replacement = ImageReplacement(student_id, images)
    try:
        replacement.prepare()
        embeddings = {f"{pose}_{variant}": vector for pose, result in processed.items() for variant, vector in result.embeddings.items()}
        store.replace_embeddings(student_id, embeddings)
        student.embedding_quality_score = sum(result.quality_score for result in processed.values()) / len(processed)
        replacement.commit()
        await db.commit()
        replacement.finalize()
    except Exception as exc:
        await db.rollback()
        replacement.rollback()
        if old_embeddings: store.replace_embeddings(student_id, old_embeddings)
        else: store.remove(student_id)
        logger.exception("student_face_update_failed", extra={"event": "student_face_update_failed", "student_id": student_id})
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, "Could not update student face; previous enrollment was restored") from exc
    similarity = max((score for vector in embeddings.values() for sid, score in store.search(vector, 1) if sid == student_id), default=None)
    return StudentFaceUpdateResponse(success=True, student_id=student_id, embedding_updated=True, image_updated=True,
        similarity_check=round(similarity, 4) if similarity is not None else None, latency_ms=round((time.perf_counter()-started)*1000, 2))

