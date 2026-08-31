# freco

`freco` is a stateless FastAPI face-processing service. It does not contain student or user records, identity lookups, or database connections. The calling microservice owns identity and storage; `freco` only creates and compares ArcFace vectors.

## Operations

### `POST /get_image`

Accepts one multipart image (`image`), detects exactly one face with SCRFD, aligns it using the five landmarks, and returns normalized 512-dimensional ArcFace vectors. With the default `IMAGE_STORAGE_MODE=both`, it returns `color` and `grayscale` variants. It does not run liveness and does not persist anything.

```bash
curl -X POST http://localhost:8000/get_image \
  -F 'image=@enrollment.jpg'
```

```json
{
  "embeddings": {"color": [0.01], "grayscale": [0.02]},
  "models": {"detection": "SCRFD", "recognition": "ArcFace"},
  "latency_ms": 42.15
}
```

Store this vector in the service that owns identity data.

### `POST /match`

Accepts a live multipart image (`image`) and anonymous color/grayscale vectors in the `candidate_embeddings` multipart field. It detects one face with SCRFD, checks passive liveness using MiniFASNet, aligns the face, generates matching ArcFace variants, and returns the highest cosine similarity. It does not look up identities or write to a database.

```bash
curl -X POST http://localhost:8000/match \
  -F 'image=@live-capture.jpg' \
  -F 'candidate_embeddings={"color":[[...512 numbers...]],"grayscale":[[...512 numbers...]]}'
```

`candidate_embeddings` is a JSON object containing `color` and/or `grayscale` numeric vector array. Each vector must have exactly 512 values. The service compares only matching variants (color-to-color and grayscale-to-grayscale), normalizes the supplied vectors, and returns `best_match_variant` plus `best_match_index`, which identifies the winning entry without exposing an identity. The request limit is 1,000 vectors across both variants by default (`MAX_CANDIDATE_EMBEDDINGS`). `/api/v1/auth/match` is an alias for `/match`.

## Setup

1. Install dependencies: `pip install -r requirements.txt`
2. Add the liveness models at `models/liveness/MiniFASNetV2.onnx` and `models/liveness/MiniFASNetV1SE.onnx`.
3. Add the InsightFace `antelopev2` pack at `models/antelopev2/`.
4. Start the service: `uvicorn app.main:app --host 0.0.0.0 --port 8000`

No PostgreSQL or pgvector setup is required.
