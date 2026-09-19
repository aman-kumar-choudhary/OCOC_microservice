# Freco Face Recognition Service (Python/FastAPI)

## Overview

Freco is a **stateless** face processing service. It does NOT own identity - it only creates and compares ArcFace vectors. The calling microservice owns identity and storage.

**Location**: `freco/backend/`

**Entry Point**: `app/main.py`

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Freco Service (Port 8000)                 │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              FacePipeline                            │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────────────┐  │   │
│  │  │ Detect   │->│ Align    │->│ Embed / Match     │  │   │
│  │  │ (SCRFD)  │  │ (5-pt)   │  │ (ArcFace)        │  │   │
│  │  └──────────┘  └──────────┘  └──────────────────┘  │   │
│  │         │                              │            │   │
│  │         v                              v            │   │
│  │  ┌──────────┐              ┌──────────────────┐    │   │
│  │  │ Liveness │              │ Cosine Similarity│    │   │
│  │  │(MiniFAS) │              │ vs Candidates    │    │   │
│  │  └──────────┘              └──────────────────┘    │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              ModelManager                            │   │
│  │  • SCRFD Detector (ONNX) - Face detection + landmarks│   │
│  │  • ArcFace Recognizer (ONNX) - 512-dim embeddings   │   │
│  │  • MiniFASNet Liveness (ONNX) - Anti-spoofing       │   │
│  │  • Device: CUDA (auto-detect) or CPU                │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## ML Models

| Model | Purpose | Input | Output |
|-------|---------|-------|--------|
| **SCRFD-10G-BNKPS** | Face detection | 640×640 BGR | Bounding boxes + 5 landmarks |
| **ArcFace (antelopev2)** | Face embedding | 112×112 aligned BGR | 512-dim L2-normalized vector |
| **MiniFASNetV2 + V1SE** | Liveness detection | Expanded face crop | 3-class softmax (real/fake/?) |

---

## Face Processing Pipeline

```
Input Image (BGR)
       │
       ▼
┌──────────────┐
│ Face Detection│  SCRFD, confidence threshold: 0.6
│ (SCRFD)      │  Returns: bbox, 5 landmarks, det_score
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ Face Alignment│  Similarity transform to 112×112
│ (5-pt LMEDS) │  Using canonical ArcFace template
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ Variant      │  Configurable: color / grayscale / both
│ Generation   │  Grayscale: BGR→GRAY→BGR→align
└──────┬───────┘
       │
       ▼
┌──────────────┐

---

## API Endpoints

### Stateless Operations (no DB)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/get_image` | POST | Extract embeddings from single face |
| `/get_images` | POST | Extract embeddings from multiple faces |
| `/match` | POST | Liveness + match against candidate vectors |
| `/match/all` | POST | Match all faces in group photo |

### Database-Backed Operations

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/people` | POST | Register person with 5 enrollment images |
| `/api/v1/recognize` | POST | DB-backed single face recognition |
| `/api/v1/recognize/mass` | POST | DB-backed multi-face recognition |
| `/api/v1/attendance/sessions` | POST | Create attendance session |
| `/api/v1/attendance/sessions/{id}/mass` | POST | Mass attendance marking |

### Real-Time

| Endpoint | Type | Description |
|----------|------|-------------|
| `/api/v1/face/stream` | WebSocket | Real-time face processing |

### Health

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |

---

## Person Registration Flow

```
POST /api/v1/people
├─ external_id (UUID from user_management)
├─ name, person_type, email, rfid_uid
├─ images: exactly 5 photos
├─ poses: "center,left,right,chin_up,chin_down"
│
├─ For each image:
│   ├─ Detect single face (SCRFD)
│   ├─ Align face (5-point landmarks)
│   ├─ Generate ArcFace embedding
│   └─ Store in freco_face_embeddings (pgvector)
│
└─ Response: {id, external_id, face_embeddings_created}
```

---

## Database-Backed Recognition

The `/api/v1/recognize` endpoint performs recognition against the database:

1. Detect face → check liveness → extract embeddings
2. Query `freco_face_embeddings` using pgvector cosine similarity
3. Return matched person's external_id (= users.id)

```sql
-- Simplified recognition query
SELECT person_id, embedding <=> $1 AS distance
FROM freco_face_embeddings
WHERE variant = 'grayscale'
ORDER BY distance ASC
LIMIT 1;
```

---

## Attendance System

### Session Modes

- `face` - Single face recognition attendance
- `rfid` - RFID card tap attendance
- `mass` - Group photo attendance

### Mass Attendance Flow

1. Upload group photo
2. Detect all faces
3. For each face: liveness check → embedding → match against DB
4. Mark attendance for recognized persons
5. One record per person per session (unique constraint)

---

## WebSocket Stream

Real-time face processing via WebSocket at `/api/v1/face/stream`:

### Modes

- `registration` - Single face detection + pose estimation
- `single_recognition` - Single face + liveness
- `multi_recognition` - Multiple faces + liveness

### Message Format

```json
{
  "mode": "single_recognition",
  "frame": "data:image/jpeg;base64,..."
}
```

---

## Inference Runtime

- **ONNX Runtime** with CUDA or CPU execution
- Auto-detection: checks CUDA availability, cuDNN libraries
- All models share the same execution provider
- GPU memory and latency tracked via `ModelMetrics`

---

## Environment Variables

```
# Database
DATABASE_URL=postgresql+asyncpg://ococ:root@localhost:5432/ococ_users

# Hardware
INFERENCE_DEVICE=cuda  # auto, cuda, or cpu
DETECTION_CTX_ID=0

# Face Models
FACE_MODEL_PACK=antelopev2
RECOGNITION_MODEL_PACK=antelopev2
MODEL_ROOT=./models

# Detection
DETECTION_MIN_CONFIDENCE=0.6

# Request Limits
MAX_UPLOAD_IMAGE_MB=5
MAX_IMAGE_PIXELS=20000000
MAX_CANDIDATE_EMBEDDINGS=1000

# Image Storage Mode (color, grayscale, both)
IMAGE_STORAGE_MODE=grayscale

# Face Visibility
FACE_VISIBILITY_THRESHOLD=0.80
FACE_VISIBILITY_FRAME_MARGIN_RATIO=0.05
FACE_VISIBILITY_MIN_LANDMARK_SPREAD_RATIO=0.1

# Liveness
LIVENESS_MODEL_PATHS=models/liveness/MiniFASNetV2.onnx,models/liveness/MiniFASNetV1SE.onnx
LIVENESS_MODEL_SCALES=2.7,4.0
LIVENESS_REAL_CLASS_INDEX=1
LIVENESS_THRESHOLD=0.85

# Similarity
COSINE_SIMILARITY_THRESHOLD=0.55

# CORS
CORS_ALLOWED_ORIGINS=http://localhost:5173
```

---

## Docker Configuration

### Multi-Stage Dockerfile

1. **Builder**: Ubuntu 22.04 + Python venv
   - Install requirements
   - Download liveness models (MiniFASNet)
   - Download + extract Antelopev2 model pack
   - Strip binaries for size

2. **Runner**: nvidia/cuda:12.4.1-base
   - Minimal CUDA/cuDNN runtime libs
   - Copy venv + models
   - Run: `uvicorn app.main:app`

### Running with Docker

```bash
# Build and run locally
cd freco/backend
docker-compose up --build

# Or manually
docker build -t freco:latest .
docker run --gpus all -p 8000:8000 freco:latest
```

│ Embedding    │  ArcFace forward pass
│ Extraction   │  L2 normalization
│              │  Output: 512-dim vector per variant
└──────────────┘
```

---

## Liveness Detection

- Uses **Silent-Face Anti-Spoofing** with MiniFASNet models
- Operates on **expanded detector bounding box** (not tight crop)
- Two models fused: MiniFASNetV2 (2.7× crop) + MiniFASNetV1SE (4.0× crop)
- Fusion by **averaging logits** (not probabilities)
- Threshold: 0.85 (configurable)
- **Fail-closed**: No liveness model = authentication rejected
