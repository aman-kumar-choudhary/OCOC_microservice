# FRECO (Face Recognition) Microservice

FReco (Face Recognition) is a standalone FastAPI microservice that provides real-time face detection, recognition, liveness/anti-spoofing verification, and identity management. It serves as the biometric engine of the OCOC campus management platform.

> [!WARNING]
> The original `README.md` in the repository may describe a stateless service. This documentation reflects the **ACTUAL** codebase, which is **STATEFUL**, featuring full PostgreSQL + `pgvector` integration for storing face embeddings and performing 1:N identity searches.

## Table of Contents

- [Architecture](#architecture)
- [Project Structure](#project-structure)
- [Core Modules Detail](#core-modules-detail)
- [API Endpoints](#api-endpoints)
- [ML Pipeline (How It Works)](#ml-pipeline-how-it-works)
- [Database Integration](#database-integration)
- [Deployment](#deployment)
- [Environment Variables](#environment-variables)
- [Integration with User Management](#integration-with-user-management)

## Architecture

FRECO operates as an independent microservice, communicating with clients via REST for enrollment and one-off recognition, and WebSockets for real-time video stream processing. It leverages PostgreSQL with the `pgvector` extension for storing and querying face embeddings.

```mermaid
flowchart TD
    Client[Client (Frontend / Edge)]
    
    subgraph FRECO[FRECO Microservice (FastAPI)]
        REST[REST API (/register, /recognize)]
        WS[WebSocket API (/stream)]
        
        Pipeline[ML Pipeline Orchestrator]
        
        Models[ONNX / InsightFace Models]
        DB_Sess[SQLAlchemy Async Sessions]
    end
    
    DB[(PostgreSQL + pgvector)]
    
    Client -- HTTP POST --> REST
    Client -- WS Frames --> WS
    
    REST --> Pipeline
    WS --> Pipeline
    
    Pipeline <--> Models
    Pipeline <--> DB_Sess
    
    DB_Sess <--> DB
```

## Project Structure

```text
freco/backend/
├── app/
│   ├── main.py              # FastAPI entry, lifespan, router registration
│   ├── config.py            # Pydantic Settings (thresholds, DB, device)
│   ├── db.py                # SQLAlchemy async engine + sessions
│   ├── models.py            # ORM: Person, FaceEmbedding (Vector(512))
│   ├── schemas.py           # Pydantic: RecognitionResult, PersonCreate
│   ├── api/
│   │   ├── identity.py      # REST: /register, /recognize, /recognize/mass
│   │   └── stream.py        # WebSocket: /stream (real-time frames)
│   ├── ml/
│   │   ├── pipeline.py      # FacePipeline orchestrator
│   │   ├── face_detector.py # SCRFD face detection
│   │   ├── face_recognizer.py # ArcFace 512D embeddings
│   │   ├── face_align.py    # Landmark-based face alignment
│   │   ├── face_visibility.py # Occlusion/visibility checks
│   │   ├── pose_estimator.py # Pitch/yaw/roll estimation
│   │   ├── liveness.py      # MiniFASNet anti-spoofing (ONNX)
│   │   ├── model_registry.py # Singleton InsightFace model loader
│   │   ├── model_manager.py # Model lifecycle management
│   │   ├── model_metrics.py # CPU/RAM/GPU telemetry
│   │   └── runtime.py       # ONNX EP resolver (CUDA fallback)
│   └── utils/
│       └── image_utils.py   # Byte-to-OpenCV array decoding
├── models/                  # Pre-trained ONNX model weights
│   ├── antelopev2/
│   │   ├── glintr100.onnx   # ArcFace recognition model
│   │   └── scrfd_10g_bnkps.onnx # SCRFD detection model
│   └── liveness/
│       ├── MiniFASNetV1SE.onnx
│       └── MiniFASNetV2.onnx
├── deploy/                  # Kubernetes manifests
├── Dockerfile               # NVIDIA CUDA multi-stage build
├── docker-compose.yml       # GPU device reservation
└── requirements.txt
```

## Core Modules Detail

### `config.py`
Uses Pydantic Settings to load configuration from `.env`. Key variables include `DATABASE_URL` (using `postgresql+asyncpg://`), `INFERENCE_DEVICE` (`auto`/`cpu`/`cuda`), `DETECTION_CTX_ID`, `FACE_MODEL_PACK` (`antelopev2`), `INSIGHTFACE_MODEL_ROOT`, `COSINE_SIMILARITY_THRESHOLD`, and `LIVENESS_THRESHOLD`.

### `db.py`
Sets up the SQLAlchemy async engine using the `asyncpg` driver. Exposes `init_db()` for creating tables on startup and a `get_db_session` dependency for yielding async sessions in FastAPI routes.

### `models.py` (ORM)
- `Person`: Contains `id`, `external_id` (links to `user_management` DB `users.id`), `name`, `person_type`.
- `FaceEmbedding`: Contains `id`, `person_id` (FK), `face_id`, `embedding` (defined as `Vector(512)` via `pgvector`), `quality_score`, `image_reference`, and `is_active`.

### `schemas.py`
Defines Pydantic models for validation:
- `PersonCreate`: Input schema for registration.
- `RecognitionResult`: Single face match result including confidence scores.
- `MultiRecognitionResult`: Array of batch recognition results.

## API Endpoints

### REST (`identity.py`)

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/register` | Enrolls a new face identity. Accepts multipart image + person metadata. Decodes image → detects face → checks liveness → extracts 512D embedding → stores in Postgres. |
| `POST` | `/recognize` | 1:N face search (single face). Accepts multipart image. Decodes → detects → liveness check → extracts embedding → performs cosine similarity search against all stored embeddings → returns best match. |
| `POST` | `/recognize/mass` | 1:N face search (multiple faces). Same as `/recognize`, but processes ALL detected faces in the image. |

### WebSocket (`stream.py`)

- **`WS /stream`**: Real-time video frame processing.
  - **Modes**: `single_recognition`, `multi_recognition`.
  - **Flow**: Client sends base64 JSON frames → server decodes → runs inference in a threadpool (non-blocking) → performs detection, pose estimation, and liveness checks → returns JSON results over the WebSocket connection.

## ML Pipeline (How It Works)

The Machine Learning pipeline is a sequential flow that processes raw images into 512-dimensional embeddings.

```mermaid
flowchart LR
    A[Image BGR] --> B[SCRFD FaceDetector]
    B -->|Bounding Boxes + Landmarks| C[FaceAligner]
    C -->|Aligned Face Crop| D[ArcFace Recognizer]
    D -->|512D Vector| E[(pgvector Search)]
```

### Anti-Spoofing
Anti-spoofing is powered by MiniFASNet ONNX models loaded natively via ONNX Runtime. The pipeline applies specific bounding box scaling before cropping and running inference. The returned liveness score is compared against the `LIVENESS_THRESHOLD`.

### Model Loading & Execution
- **`model_registry.py`**: Implements a Singleton pattern for the InsightFace `FaceAnalysis` model to avoid redundant memory usage.
- **`runtime.py`**: Dynamically resolves ONNX Execution Providers, attempting `CUDAExecutionProvider` first with a graceful fallback to `CPUExecutionProvider`.
- **`model_metrics.py`**: Actively tracks CPU, RAM, and GPU usage via `psutil` and NVML.

## Database Integration

FRECO relies on PostgreSQL integrated with the `pgvector` extension for efficient biometric storage and retrieval.
- Utilizes an HNSW vector index on the `face_embedding` column for ultra-fast approximate nearest neighbor (ANN) cosine similarity search.
- **Tables**: `freco_people` and `freco_face_embeddings` (initialized by migration `004_pgvector_and_freco.sql`).
- **Linking**: The `freco_people.external_id` field acts as a loose foreign key linking to `users.id` in the main `user_management` database.

## Deployment

- **Docker**: Utilizes a multi-stage NVIDIA CUDA base image incorporating `cuda-cudart` and `libcudnn9`.
- **Docker Compose**: Pre-configured with `docker-compose.yml` for GPU device reservation, exposing port 8000, and setting `INFERENCE_DEVICE=auto`.
- **Kubernetes**: Configured via the `/deploy` directory:
  - `configmap.yml`: Inference thresholds and general settings.
  - `deployment.yml`: GPU resource requests (limits), liveness, and readiness probes.
  - `service.yml`: Exposes port 80.
  - `namespace.yml`, `ghcr-pull-secret.yml`: Administrative and auth configs.
- **Dependencies**: Key packages include `fastapi`, `uvicorn`, `onnxruntime-gpu`, `insightface`, `SQLAlchemy`, `asyncpg`, `pgvector`, and `opencv-python-headless`.

## Environment Variables

| Variable | Purpose | Default |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql+asyncpg://...` |
| `INFERENCE_DEVICE` | ML inference device (`auto`/`cuda`/`cpu`) | `auto` |
| `DETECTION_CTX_ID` | GPU context ID | `0` |
| `FACE_MODEL_PACK` | InsightFace model pack | `antelopev2` |
| `INSIGHTFACE_MODEL_ROOT` | Path to model weights directory | `./models` |
| `COSINE_SIMILARITY_THRESHOLD`| Match confidence threshold | *(configured via .env)* |
| `LIVENESS_THRESHOLD` | Anti-spoof score threshold | *(configured via .env)* |
| `LOG_LEVEL` | Logging verbosity level | `INFO` |

## Integration with User Management

FRECO integrates seamlessly with the frontend and the central user management system:

1. **API Client**: The frontend's `frecoService.js` instantiates a dedicated Axios instance pointing to the FRECO microservice URL.
2. **Onboarding**: In `Onboarding.jsx`, multi-pose facial data is captured securely via `FaceOvalCamera` and POSTed to FRECO's `/register` endpoint.
3. **Access Control**: During gate access (`FaceRecognition.jsx`, `GuardDashboard.jsx`), live webcam frames are streamed directly via WebSocket to FRECO's `/stream` endpoint.
4. **Hook Integration**: The `useLiveFaceInference.js` React hook abstracts webcam capture, frame extraction, and blob generation, seamlessly pipelining data to the FRECO backend.
