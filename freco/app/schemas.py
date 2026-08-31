from typing import Annotated

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
