"""Identity, RFID and mass-attendance APIs. All image inputs are multipart files."""
import json
import time
from datetime import datetime
from uuid import UUID

import numpy as np
from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError, OperationalError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from starlette.concurrency import run_in_threadpool

from app.config import settings
from app.db import get_db_session
from app.ml.face_detector import MultipleFacesDetectedError, NoFaceDetectedError
from app.models import AttendanceRecord, AttendanceSession, FaceEmbedding, Person
from app.schemas import (
    AttendanceMarkResponse, AttendanceSessionCreate, AttendanceSessionResponse,
    MassAttendanceResponse, MassFaceResult, PersonCreateResponse, PersonSummary,
    RecognitionResult, MultiRecognitionFaceResult, MultiRecognitionResult,
)
from app.utils.image_utils import InvalidImageError, decode_uploaded_image

router = APIRouter(prefix="/api/v1", tags=["identity-and-attendance"])


async def _read_upload(upload: UploadFile) -> np.ndarray:
    try:
        return decode_uploaded_image(await upload.read())
    except InvalidImageError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc
    finally:
        await upload.close()


def _db_unavailable(exc: OperationalError) -> HTTPException:
    return HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Identity database is unavailable")


def _summary(person: Person) -> PersonSummary:
    return PersonSummary(id=person.id, external_id=person.external_id, person_type=person.person_type,
                         name=person.name, email=person.email, rfid_uid=person.rfid_uid,
                         active=person.active, embeddings_count=len(person.face_embeddings))


@router.post("/people", response_model=PersonCreateResponse, status_code=status.HTTP_201_CREATED)
async def register_person(
    request: Request,
    external_id: str = Form(...), name: str = Form(...), person_type: str = Form(...),
    email: str | None = Form(None), rfid_uid: str | None = Form(None), metadata_json: str | None = Form(None),
    images: list[UploadFile] = File(...), poses: str | None = Form(None), db: AsyncSession = Depends(get_db_session),
):
    """Register a student/visitor and create ArcFace embeddings from uploaded files."""
    if person_type not in {"student", "visitor"}:
        raise HTTPException(422, "person_type must be student or visitor")
    if not images:
        raise HTTPException(422, "At least one enrollment image is required")
    if len(images) > 10:
        raise HTTPException(422, "A maximum of 10 enrollment images is allowed")
    if metadata_json:
        try: json.loads(metadata_json)
        except json.JSONDecodeError as exc: raise HTTPException(422, "metadata_json must be valid JSON") from exc
    pose_names = [p.strip() for p in poses.split(",")] if poses else ["center"] * len(images)
    if len(pose_names) != len(images):
        raise HTTPException(422, "poses must have one comma-separated value per image")
    try:
        face_images = [await _read_upload(image) for image in images]
        processed = [await run_in_threadpool(request.app.state.pipeline.extract_embeddings, image) for image in face_images]
    except (NoFaceDetectedError, MultipleFacesDetectedError) as exc:
        raise HTTPException(422, str(exc)) from exc
    person = Person(external_id=external_id, name=name, person_type=person_type, email=email,
                    rfid_uid=rfid_uid, metadata_json=metadata_json)
    for pose, (embeddings, _, models) in zip(pose_names, processed):
        for variant, vector in embeddings.items():
            person.face_embeddings.append(FaceEmbedding(variant=variant, pose=pose, model_name=models["recognition"],
                                                        embedding=vector.astype(float).tolist()))
    db.add(person)
    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(409, "external_id or RFID UID already exists") from exc
    return PersonCreateResponse(id=person.id, external_id=person.external_id, face_embeddings_created=len(person.face_embeddings))


@router.get("/people", response_model=list[PersonSummary])
async def list_people(person_type: str | None = None, limit: int = 50, offset: int = 0,
                      db: AsyncSession = Depends(get_db_session)):
    query = (select(Person).options(selectinload(Person.face_embeddings)).order_by(Person.created_at.desc())
             .limit(min(limit, 200)).offset(max(offset, 0)))
    if person_type:
        query = query.where(Person.person_type == person_type)
    try:
        people = (await db.execute(query)).scalars().unique().all()
    except OperationalError as exc: raise _db_unavailable(exc) from exc
    return [_summary(person) for person in people]


@router.post("/attendance/sessions", response_model=AttendanceSessionResponse, status_code=201)
async def create_attendance_session(payload: AttendanceSessionCreate, db: AsyncSession = Depends(get_db_session)):
    session = AttendanceSession(name=payload.name, mode=payload.mode, starts_at=payload.starts_at or datetime.now().astimezone(), ends_at=payload.ends_at)
    db.add(session)
    await db.commit()
    return AttendanceSessionResponse(id=session.id, name=session.name, mode=session.mode, starts_at=session.starts_at, ends_at=session.ends_at)


@router.get("/attendance/sessions", response_model=list[AttendanceSessionResponse])
async def list_attendance_sessions(db: AsyncSession = Depends(get_db_session)):
    rows = (await db.execute(select(AttendanceSession, func.count(AttendanceRecord.id)).outerjoin(AttendanceRecord).group_by(AttendanceSession.id).order_by(AttendanceSession.starts_at.desc()))).all()
    return [AttendanceSessionResponse(id=s.id, name=s.name, mode=s.mode, starts_at=s.starts_at, ends_at=s.ends_at, attendee_count=count) for s, count in rows]


async def _record_once(db: AsyncSession, session_id: UUID, person: Person, source: str, score: float | None) -> AttendanceMarkResponse:
    existing = (await db.execute(select(AttendanceRecord.id).where(AttendanceRecord.session_id == session_id, AttendanceRecord.person_id == person.id))).scalar_one_or_none()
    if existing is not None:
        return AttendanceMarkResponse(session_id=session_id, person_id=person.id, external_id=person.external_id, status="already_recorded", similarity_score=score)
    db.add(AttendanceRecord(session_id=session_id, person_id=person.id, source=source, similarity_score=score))
    try:
        await db.commit()
        return AttendanceMarkResponse(session_id=session_id, person_id=person.id, external_id=person.external_id, status="recorded", similarity_score=score)
    except IntegrityError:  # concurrent camera workers: unique constraint is authoritative
        await db.rollback()
        return AttendanceMarkResponse(session_id=session_id, person_id=person.id, external_id=person.external_id, status="already_recorded", similarity_score=score)


@router.post("/attendance/sessions/{session_id}/rfid", response_model=AttendanceMarkResponse)
async def mark_rfid_attendance(session_id: UUID, rfid_uid: str = Form(...), db: AsyncSession = Depends(get_db_session)):
    session = await db.get(AttendanceSession, session_id)
    if session is None: raise HTTPException(404, "Attendance session not found")
    if session.mode != "rfid": raise HTTPException(409, "This is not an RFID session")
    person = (await db.execute(select(Person).where(Person.rfid_uid == rfid_uid, Person.active.is_(True)))).scalar_one_or_none()
    if person is None: return AttendanceMarkResponse(session_id=session_id, status="unknown")
    return await _record_once(db, session_id, person, "rfid", None)


async def _best_person(
    db: AsyncSession,
    embeddings: dict[str, np.ndarray],
    *,
    only_person_ids: set[UUID] | None = None,
    exclude_person_ids: set[UUID] | None = None,
) -> tuple[Person | None, float | None]:
    """Find the best active person, optionally within or outside a known set."""
    best: tuple[Person, float] | None = None
    for variant, vector in embeddings.items():
        distance = FaceEmbedding.embedding.cosine_distance(vector.astype(float).tolist()).label("distance")
        query = select(Person, distance).join(FaceEmbedding).where(
            Person.active.is_(True), FaceEmbedding.variant == variant
        )
        if only_person_ids is not None:
            if not only_person_ids:
                return None, None
            query = query.where(Person.id.in_(only_person_ids))
        if exclude_person_ids:
            query = query.where(Person.id.not_in(exclude_person_ids))
        row = (await db.execute(query.order_by(distance).limit(1))).first()
        if row:
            person, value = row
            score = 1.0 - float(value)
            if best is None or score > best[1]: best = (person, score)
    return best if best and best[1] >= settings.COSINE_SIMILARITY_THRESHOLD else (None, best[1] if best else None)


@router.post("/attendance/sessions/{session_id}/mass", response_model=MassAttendanceResponse)
async def mark_mass_attendance(session_id: UUID, request: Request, image: UploadFile = File(...), db: AsyncSession = Depends(get_db_session)):
    session = await db.get(AttendanceSession, session_id)
    if session is None: raise HTTPException(404, "Attendance session not found")
    if session.mode != "mass": raise HTTPException(409, "This is not a mass-attendance session")
    started = time.perf_counter()
    image_bgr = await _read_upload(image)
    detections, timings, _ = await run_in_threadpool(request.app.state.pipeline.extract_embeddings_for_all_faces, image_bgr)

    # A person may appear more than once in a photo or in consecutive camera
    # frames.  Check the people already marked in this session first, then do
    # not include them in the authentication search for new faces.
    recorded_person_ids = set((await db.execute(
        select(AttendanceRecord.person_id).where(AttendanceRecord.session_id == session_id)
    )).scalars())
    results: list[MassFaceResult] = []
    for bbox, det_score, embeddings in detections:
        already_recorded, recorded_score = await _best_person(
            db, embeddings, only_person_ids=recorded_person_ids
        )
        if already_recorded is not None:
            results.append(MassFaceResult(
                bbox=bbox.astype(float).tolist(), detection_score=det_score,
                external_id=already_recorded.external_id, name=already_recorded.name,
                similarity_score=recorded_score, status="already_recorded",
            ))
            continue

        person, score = await _best_person(db, embeddings, exclude_person_ids=recorded_person_ids)
        if person is None:
            results.append(MassFaceResult(bbox=bbox.astype(float).tolist(), detection_score=det_score, similarity_score=score, status="unknown"))
            continue
        recorded = await _record_once(db, session_id, person, "mass", score)
        recorded_person_ids.add(person.id)
        results.append(MassFaceResult(bbox=bbox.astype(float).tolist(), detection_score=det_score, external_id=person.external_id, name=person.name, similarity_score=score, status=recorded.status))
    return MassAttendanceResponse(session_id=session_id, faces_detected=len(detections), results=results,
                                  latency_ms=round((time.perf_counter()-started)*1000, 2), step_latencies_ms=timings)


@router.post("/recognize", response_model=RecognitionResult)
async def recognize_face(
    request: Request, image: UploadFile = File(...), db: AsyncSession = Depends(get_db_session)
):
    """Stateless single-face recognition against the database."""
    image_bgr = await _read_upload(image)
    try:
        embeddings, _, _ = await run_in_threadpool(request.app.state.pipeline.extract_embeddings, image_bgr)
    except (NoFaceDetectedError, MultipleFacesDetectedError) as exc:
        raise HTTPException(422, str(exc)) from exc

    person, score = await _best_person(db, embeddings)
    if person:
        return RecognitionResult(
            recognized=True,
            userId=person.external_id,
            name=person.name,
            role=person.person_type,
            similarity=round(score, 4),
            message="Match successful"
        )
    return RecognitionResult(recognized=False, message="No matching user found")


@router.post("/recognize/mass", response_model=MultiRecognitionResult)
async def recognize_faces_mass(
    request: Request, image: UploadFile = File(...), db: AsyncSession = Depends(get_db_session)
):
    """Stateless multi-face recognition against the database."""
    image_bgr = await _read_upload(image)
    try:
        detections, _, _ = await run_in_threadpool(request.app.state.pipeline.extract_embeddings_for_all_faces, image_bgr)
    except NoFaceDetectedError as exc:
        raise HTTPException(422, str(exc)) from exc

    results: list[MultiRecognitionFaceResult] = []
    matched_person_ids: set[UUID] = set()

    for idx, (bbox, det_score, embeddings) in enumerate(detections):
        person, score = await _best_person(db, embeddings, exclude_person_ids=matched_person_ids)
        if person:
            matched_person_ids.add(person.id)
            results.append(MultiRecognitionFaceResult(
                faceIndex=idx,
                recognized=True,
                userId=person.external_id,
                name=person.name,
                role=person.person_type,
                similarity=round(score, 4),
                message="Match successful"
            ))
        else:
            results.append(MultiRecognitionFaceResult(
                faceIndex=idx,
                recognized=False,
                message="No matching user found"
            ))

    return MultiRecognitionResult(faces=results)
