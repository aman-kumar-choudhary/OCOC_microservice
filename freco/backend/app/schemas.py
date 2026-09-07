from datetime import datetime
from typing import Annotated, Optional
from uuid import UUID

from pydantic import BaseModel, Field, RootModel


Embedding = Annotated[list[float], Field(min_length=512, max_length=512)]
EmbeddingCollection = Embedding | list[Embedding]


class StoredEmbeddings(RootModel[dict[str, EmbeddingCollection]]):
    """Anonymous ArcFace vectors grouped by color variant."""


class EmbeddingExtractionResponse(BaseModel):
    embeddings: dict[str, Embedding]
    models: dict[str, str] = Field(default_factory=dict)
    latency_ms: float
    step_latencies_ms: dict[str, float] = Field(default_factory=dict)


class FaceEmbeddingResult(BaseModel):
    """Embedding output for one detected face, in detector order."""

    bbox: list[float] = Field(min_length=4, max_length=4)
    detection_score: float
    embeddings: dict[str, Embedding]


class MultiEmbeddingExtractionResponse(BaseModel):
    faces_detected: int
    faces: list[FaceEmbeddingResult]
    models: dict[str, str] = Field(default_factory=dict)
    latency_ms: float
    step_latencies_ms: dict[str, float] = Field(default_factory=dict)


class MatchResponse(BaseModel):
    matched: bool
    similarity_score: float
    best_match_variant: str | None = None
    best_match_index: int | None = None
    candidate_count: int
    liveness_score: float | None = None
    models: dict[str, str] = Field(default_factory=dict)
    latency_ms: float
    step_latencies_ms: dict[str, float] = Field(default_factory=dict)
    reason: str | None = None
    message: str


class MultiMatchFaceResponse(BaseModel):
    bbox: list[float] = Field(min_length=4, max_length=4)
    detection_score: float
    matched: bool
    similarity_score: float = 0.0
    best_match_variant: str | None = None
    best_match_index: int | None = None
    liveness_score: float | None = None
    reason: str


class MultiMatchResponse(BaseModel):
    faces_detected: int
    candidate_count: int
    faces: list[MultiMatchFaceResponse]
    models: dict[str, str] = Field(default_factory=dict)
    latency_ms: float
    step_latencies_ms: dict[str, float] = Field(default_factory=dict)


# ── Identity / Attendance schemas (used by app/api/identity.py) ────────────

class PersonSummary(BaseModel):
    """Summary of a registered person in FRECO."""
    id: UUID
    external_id: UUID          # = users.id in user_management
    person_type: str
    name: str
    email: Optional[str] = None
    rfid_uid: Optional[str] = None
    active: bool
    embeddings_count: int = 0


class PersonCreateResponse(BaseModel):
    """Returned after POST /api/v1/people."""
    id: UUID
    external_id: UUID
    face_embeddings_created: int


class AttendanceSessionCreate(BaseModel):
    """Payload for POST /api/v1/attendance/sessions."""
    name: str
    mode: str                            # 'face' | 'rfid' | 'mass'
    starts_at: Optional[datetime] = None
    ends_at: Optional[datetime] = None


class AttendanceSessionResponse(BaseModel):
    """Returned for attendance session read operations."""
    id: UUID
    name: str
    mode: str
    starts_at: datetime
    ends_at: Optional[datetime] = None
    attendee_count: int = 0


class AttendanceMarkResponse(BaseModel):
    """Returned after marking a single attendance event."""
    session_id: UUID
    person_id: Optional[UUID] = None
    external_id: Optional[UUID] = None  # = users.id
    status: str                         # 'recorded' | 'already_recorded' | 'unknown'
    similarity_score: Optional[float] = None


class MassFaceResult(BaseModel):
    """Result for one detected face in a mass-attendance frame."""
    bbox: list[float] = Field(min_length=4, max_length=4)
    detection_score: float = 0.0
    external_id: Optional[UUID] = None
    name: Optional[str] = None
    similarity_score: Optional[float] = None
    status: str                         # 'recorded' | 'already_recorded' | 'unknown'


class MassAttendanceResponse(BaseModel):
    """Returned after POST /api/v1/attendance/sessions/{id}/mass."""
    session_id: UUID
    faces_detected: int
    results: list[MassFaceResult]
    latency_ms: float
    step_latencies_ms: dict[str, float] = Field(default_factory=dict)


# ── Stateless Recognition schemas (used by app/api/identity.py) ────────────

class RecognitionResult(BaseModel):
    recognized: bool
    userId: Optional[UUID] = None
    name: Optional[str] = None
    role: Optional[str] = None
    similarity: Optional[float] = None
    message: Optional[str] = None


class MultiRecognitionFaceResult(BaseModel):
    faceIndex: int
    recognized: bool
    userId: Optional[UUID] = None
    name: Optional[str] = None
    role: Optional[str] = None
    similarity: Optional[float] = None
    message: Optional[str] = None


class MultiRecognitionResult(BaseModel):
    faces: list[MultiRecognitionFaceResult]
