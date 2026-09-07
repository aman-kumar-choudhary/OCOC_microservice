import json
import logging
import time

import numpy as np
from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import ValidationError
from starlette.concurrency import run_in_threadpool

from app.api.identity import router as identity_router
from app.api.stream import router as stream_router
from app.config import settings
from app.db import Base, engine
from app.ml.model_manager import ModelManager
from app.ml.face_detector import MultipleFacesDetectedError, NoFaceDetectedError
from app.ml.pipeline import FacePipeline, LivenessRejected
from app.ml.runtime import get_inference_runtime
from app.schemas import (
    EmbeddingExtractionResponse, FaceEmbeddingResult, MatchResponse,
    MultiEmbeddingExtractionResponse, MultiMatchFaceResponse, MultiMatchResponse,
    StoredEmbeddings,
)
from app.utils.image_utils import InvalidImageError, decode_uploaded_image

logger = logging.getLogger(__name__)
logging.basicConfig(
    level=logging.INFO,
    format='{"time":"%(asctime)s", "level":"%(levelname)s", "message":"%(message)s"}',
)


async def lifespan(app: FastAPI):
    # Ensure FRECO tables exist (migration 004 is authoritative; this is a fallback).
    if engine is not None:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        logger.info("freco_db_tables_ensured")

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

# Mount identity / attendance router (POST /api/v1/people, attendance sessions, etc.)
app.include_router(identity_router)

# Mount streaming router
app.include_router(stream_router, prefix="/api/v1/face", tags=["stream"])

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


@app.post("/get_mass_images", response_model=MultiEmbeddingExtractionResponse)
@app.post("/api/v1/auth/get_mass_images", response_model=MultiEmbeddingExtractionResponse)
async def get_all_image_embeddings(request: Request, image: UploadFile = File(...)):
    """Detect and embed every face in a group photo; no data is stored."""
    started = time.perf_counter()
    image_bgr = await read_image(image)
    try:
        faces, timings, models = await run_in_threadpool(
            request.app.state.pipeline.extract_embeddings_for_all_faces, image_bgr
        )
    except NoFaceDetectedError as exc:
        raise face_error(exc) from exc
    except ValueError as exc:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, str(exc)) from exc
    return MultiEmbeddingExtractionResponse(
        faces_detected=len(faces),
        faces=[FaceEmbeddingResult(
            bbox=face.bbox.astype(float).tolist(), detection_score=face.detection_score,
            embeddings={name: vector.astype(float).tolist() for name, vector in face.embeddings.items()},
        ) for face in faces],
        models={name: models[name] for name in ("detection", "recognition")},
        latency_ms=round((time.perf_counter() - started) * 1000, 2), step_latencies_ms=timings,
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


@app.post("/mass_match/all", response_model=MultiMatchResponse)
@app.post("/api/v1/auth/mass_match/all", response_model=MultiMatchResponse)
async def match_all(
    request: Request, image: UploadFile = File(...), candidate_embeddings: str = Form(...),
):
    """Recognize every face in a group photo against caller-owned embeddings."""
    started = time.perf_counter()
    image_bgr = await read_image(image)
    candidates = parse_candidate_embeddings(candidate_embeddings)
    try:
        faces, timings, models = await run_in_threadpool(
            request.app.state.pipeline.match_all_against_embeddings, image_bgr, candidates
        )
    except NoFaceDetectedError as exc:
        raise face_error(exc) from exc
    except ValueError as exc:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, str(exc)) from exc
    return MultiMatchResponse(
        faces_detected=len(faces), candidate_count=candidate_count(candidates),
        faces=[MultiMatchFaceResponse(
            bbox=face.bbox.astype(float).tolist(), detection_score=face.detection_score,
            matched=face.matched, similarity_score=round(face.similarity_score, 4),
            best_match_variant=face.best_match_variant, best_match_index=face.best_match_index,
            liveness_score=face.liveness_score, reason=face.reason,
        ) for face in faces],
        models=models, latency_ms=round((time.perf_counter() - started) * 1000, 2),
        step_latencies_ms=timings,
    )
