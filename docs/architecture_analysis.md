# OCOC Microservices — Complete Architecture & Workflow Specification

> **Derived from:** Actual codebase implementation at `/home/aman/web_world/OCOC/OCOC_microservices/`
> **Analysis date:** 2026-09-09
> **Scope:** User Management (Go), FRECO Face Recognition (Python), Notification Module (Go), Frontend (Vue 3), Infrastructure (PostgreSQL, Redis, Keycloak)

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Service Inventory & Technology Stack](#2-service-inventory--technology-stack)
3. [High-Level Architecture Diagram](#3-high-level-architecture-diagram)
4. [Database Architecture](#4-database-architecture)
5. [Authentication & Authorization Pipeline](#5-authentication--authorization-pipeline)
6. [User Management Service — Internal Architecture](#6-user-management-service--internal-architecture)
7. [FRECO Face Recognition Service — Internal Architecture](#7-freco-face-recognition-service--internal-architecture)
8. [Onboarding Workflow (End-to-End)](#8-onboarding-workflow-end-to-end)
9. [Face Recognition Pipeline (Camera → Identity)](#9-face-recognition-pipeline-camera--identity)
10. [RFID Card Lifecycle](#10-rfid-card-lifecycle)
11. [Registration (Public Self-Registration)](#11-registration-public-self-registration)
12. [Notification Module Architecture](#12-notification-module-architecture)
13. [Inter-Service Communication Map](#13-inter-service-communication-map)
14. [Frontend Architecture](#14-frontend-architecture)
15. [Docker / Container Architecture](#15-docker--container-architecture)
16. [Audit & Observability](#16-audit--observability)
17. [Error Handling Patterns](#17-error-handling-patterns)
18. [Configuration & Environment Management](#18-configuration--environment-management)
19. [What the Architecture Appears Intended to Do](#19-what-the-architecture-appears-intended-to-do)
20. [Architectural Problems & Technical Debt](#20-architectural-problems--technical-debt)

---

## 1. System Overview

The OCOC system is a **campus identity and access management platform** built as a set of loosely-coupled microservices. Its primary purpose is to:

- **Onboard** students, faculty, workers, and visitors with persona-specific profiles
- **Issue and manage RFID cards** as physical access tokens
- **Enroll and verify identities** via ArcFace face recognition with passive liveness detection
- **Record attendance** via face recognition (single and mass) or RFID scan
- **Authenticate administrators** through Keycloak OIDC with JWT-based RBAC
- **Audit** all security-sensitive operations with immutable append-only logs
- **Send notifications** via Email, WhatsApp, and RabbitMQ queues

### System Boundary

```
┌─────────────────────────────────────────────────────────────────┐
│                        OCOC Platform                            │
│                                                                 │
│  ┌──────────┐   ┌──────────────┐   ┌──────────────────────┐    │
│  │ Frontend │   │  User Mgmt   │   │   FRECO (FreCo)      │    │
│  │ (Vue 3)  │──▶│  (Go/Chi)    │   │  (Python/FastAPI)    │    │
│  │ :5173    │   │  :8080       │   │  :8000               │    │
│  └──────────┘   └──────┬───────┘   └─────────┬────────────┘    │
│       │                │                      │                 │
│       │         ┌──────▼───────┐       ┌──────▼──────┐          │
│       │         │  Keycloak    │       │  pgvector   │          │
│       │         │  :8180       │       │  HNSW index │          │
│       │         └──────────────┘       └─────────────┘          │
│       │                │                      │                 │
│       │         ┌──────▼──────────────────────▼──────┐          │
│       │         │    PostgreSQL (ococ_users)          │          │
│       │         │    pgvector/pgvector:pg16           │          │
│       │         └────────────────────────────────────┘          │
│       │                                                         │
│       │         ┌──────────────┐   ┌──────────────────┐         │
│       └────────▶│    Redis     │   │  Notification    │         │
│                 │    :6379     │   │  Module (Go)     │         │
│                 └──────────────┘   └──────────────────┘         │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Service Inventory & Technology Stack

| Service | Language | Framework | Port | Entry Point |
|---|---|---|---|---|
| **User Management** | Go 1.22+ | `go-chi/chi/v5` | `:8080` | [`cmd/api/main.go`](file:///home/aman/web_world/OCOC/OCOC_microservices/user_management/backend/cmd/api/main.go) |
| **FRECO** | Python 3.11+ | FastAPI + Uvicorn | `:8000` | [`app/main.py`](file:///home/aman/web_world/OCOC/OCOC_microservices/freco/backend/app/main.py) |
| **Frontend** | TypeScript | Vue 3 + Vite + Pinia | `:5173` | [`src/router/index.ts`](file:///home/aman/web_world/OCOC/OCOC_microservices/user_management/frontend/src/router/index.ts) |
| **Notification** | Go | `net/http` (stdlib) | configurable | [`main.go`](file:///home/aman/web_world/OCOC/OCOC_microservices/notification_module/main.go) |
| **Keycloak** | Java | Keycloak 24.0 | `:8180` | Docker image |
| **PostgreSQL** | — | pgvector/pgvector:pg16 | `:5432`/`:5433` | Docker image |
| **Redis** | — | Redis 7 Alpine | `:6379` | Docker image |

### Key Libraries

| Domain | User Management | FRECO |
|---|---|---|
| **Database** | `database/sql` + `lib/pq` | SQLAlchemy async + `asyncpg` |
| **Vector Search** | — (data owned by FRECO) | `pgvector.sqlalchemy` Vector(512) |
| **Auth** | `go-oidc` v3 (OIDC verification) | None (stateless API) |
| **HTTP** | `go-chi/chi/v5` router | FastAPI + Starlette |
| **ML Models** | — | InsightFace (SCRFD+ArcFace), MiniFASNet ONNX |
| **Caching** | `go-redis/v9` | None |

---

## 3. High-Level Architecture Diagram

```mermaid
graph TB
    subgraph Clients
        Browser["Browser / Admin UI<br/>(Vue 3 + Vite)"]
        Camera["Camera Device<br/>(WebSocket stream)"]
        RFIDReader["RFID Reader<br/>(WebSocket / Simulated)"]
    end

    subgraph "User Management Service (Go :8080)"
        UM_API["REST API<br/>/api/v1/*"]
        UM_Auth["JWT Middleware<br/>(go-oidc)"]
        UM_User["User Module"]
        UM_Onboard["Onboarding Module"]
        UM_Reg["Registration Module"]
        UM_RFID["RFID Module"]
        UM_Face["FaceAuth Log Module"]
        UM_Audit["Audit Module"]
        UM_Role["Role Module"]
        UM_Dash["Dashboard Module"]
    end

    subgraph "FRECO Service (Python :8000)"
        FR_API["REST + WS API<br/>/api/v1/* + /match"]
        FR_Pipeline["FacePipeline<br/>(Stateless)"]
        FR_Identity["Identity Router<br/>(DB-backed recognition)"]
        FR_Stream["WebSocket Stream<br/>/api/v1/face/stream"]
        FR_Models["Model Manager<br/>(SCRFD + ArcFace + MiniFASNet)"]
    end

    subgraph Infrastructure
        PG["PostgreSQL 16<br/>+ pgvector 0.8.6<br/>(ococ_users DB)"]
        Redis["Redis 7"]
        KC["Keycloak 24<br/>(OIDC Provider)"]
    end

    Browser -->|"HTTP /api/v1/*"| UM_API
    Browser -->|"HTTP /api/v1/* + WS"| FR_API
    Camera -->|"WebSocket"| FR_Stream
    RFIDReader -->|"WebSocket"| UM_RFID

    UM_API --> UM_Auth
    UM_Auth --> UM_User & UM_Onboard & UM_Reg & UM_RFID & UM_Face & UM_Audit & UM_Role & UM_Dash

    UM_User -->|"CRUD + Keycloak sync"| PG
    UM_User -->|"Admin REST API"| KC
    UM_Onboard -->|"delegates"| UM_User
    UM_Onboard -->|"delegates"| UM_RFID
    UM_RFID -->|"SQL"| PG
    UM_Audit -->|"append-only"| PG
    UM_Role -->|"SQL"| PG
    UM_Dash -->|"aggregate queries"| PG
    UM_Reg -->|"SQL (no Keycloak)"| PG
    UM_Face -->|"SQL"| PG

    UM_Auth -->|"OIDC verification"| KC
    UM_Auth -->|"permissions cache"| Redis
    UM_User -->|"OTP + revocation"| Redis

    FR_Pipeline --> FR_Models
    FR_Identity -->|"cosine_distance pgvector"| PG
    FR_API --> FR_Pipeline & FR_Identity

    style PG fill:#336791,color:#fff
    style Redis fill:#DC382D,color:#fff
    style KC fill:#4D4D4D,color:#fff
```

---

## 4. Database Architecture

### 4.1 Shared Database Pattern

Both `user_management` and `freco` connect to the **same PostgreSQL database** (`ococ_users`). This is a **shared-database** architecture, not separate databases per service.

- **User Management** connects via `database/sql` + `lib/pq` (synchronous driver): `postgres://ococ:root@localhost:5432/ococ_users`
- **FRECO** connects via `asyncpg` (async driver): `postgresql+asyncpg://ococ:root@localhost:5432/ococ_users`

### 4.2 Schema Ownership

```mermaid
erDiagram
    users ||--o{ student_profiles : "1:1 by user_type"
    users ||--o{ faculty_profiles : "1:1 by user_type"
    users ||--o{ worker_profiles : "1:1 by user_type"
    users ||--o{ visitor_profiles : "1:1 by user_type"
    users ||--o{ user_rfid_cards : assigns
    users ||--o{ user_roles : has
    users }o--|| freco_people : "external_id FK"

    rfid_cards ||--o{ user_rfid_cards : assigned_to

    roles ||--o{ role_permissions : grants
    roles ||--o{ user_roles : assigned
    permissions ||--o{ role_permissions : granted_by

    departments ||--o{ student_profiles : belongs_to
    departments ||--o{ faculty_profiles : belongs_to
    hostels ||--o{ student_profiles : resides_in

    freco_people ||--o{ freco_face_embeddings : has
    freco_people ||--o{ freco_attendance_records : marked_in
    freco_attendance_sessions ||--o{ freco_attendance_records : contains

    audit_logs {
        uuid id PK
        uuid actor_id
        text operation
        jsonb before_state
        jsonb after_state
    }

    face_auth_logs {
        uuid id PK
        text result
        float similarity_score
        float liveness_score
    }
```

| Table | Owner Service | Migration |
|---|---|---|
| `users`, `user_profiles`, `student_profiles`, `faculty_profiles`, `worker_profiles`, `visitor_profiles` | User Management | [001](file:///home/aman/web_world/OCOC/OCOC_microservices/user_management/backend/migrations/001_initial_schema.sql), [006](file:///home/aman/web_world/OCOC/OCOC_microservices/user_management/backend/migrations/006_split_profiles.sql) |
| `rfid_cards`, `user_rfid_cards` | User Management | [001](file:///home/aman/web_world/OCOC/OCOC_microservices/user_management/backend/migrations/001_initial_schema.sql) |
| `roles`, `permissions`, `role_permissions`, `user_roles` | User Management | [001](file:///home/aman/web_world/OCOC/OCOC_microservices/user_management/backend/migrations/001_initial_schema.sql) |
| `audit_logs` | User Management | [001](file:///home/aman/web_world/OCOC/OCOC_microservices/user_management/backend/migrations/001_initial_schema.sql) |
| `departments`, `hostels` | User Management (seed data) | [001](file:///home/aman/web_world/OCOC/OCOC_microservices/user_management/backend/migrations/001_initial_schema.sql) |
| `face_auth_logs` | User Management | (implicit) |
| `freco_people`, `freco_face_embeddings` | FRECO (via SQLAlchemy + migration 004) | [004](file:///home/aman/web_world/OCOC/OCOC_microservices/user_management/backend/migrations/004_pgvector_and_freco.sql) |
| `freco_attendance_sessions`, `freco_attendance_records` | FRECO | [004](file:///home/aman/web_world/OCOC/OCOC_microservices/user_management/backend/migrations/004_pgvector_and_freco.sql) |
| `schema_migrations` | User Management (migration tracker) | auto-created |

### 4.3 Migration System

User Management runs a custom file-based migration system at startup ([`postgres.go`](file:///home/aman/web_world/OCOC/OCOC_microservices/user_management/backend/internal/infrastructure/database/postgres.go#L49-L72)):

```
schema_migrations table (version TEXT PK, name TEXT, applied_at TIMESTAMPTZ)
Migration files: /migrations/NNN_name.sql (glob: [0-9][0-9][0-9]_*.sql)
Each migration + its tracking record are committed in a single transaction.
```

FRECO has a fallback `Base.metadata.create_all` in its lifespan but the authoritative tables are created by migration `004`.

### 4.4 Vector Index

```sql
-- HNSW cosine index on 512-dim ArcFace embeddings
CREATE INDEX idx_freco_embeddings_hnsw_cosine
    ON freco_face_embeddings
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);
```

FRECO queries use `FaceEmbedding.embedding.cosine_distance()` for nearest-neighbour search, which leverages this HNSW index.

---

## 5. Authentication & Authorization Pipeline

### 5.1 Login Flow

```mermaid
sequenceDiagram
    participant B as Browser
    participant UM as User Management
    participant KC as Keycloak
    participant R as Redis

    B->>UM: POST /api/v1/auth/login {username, password}
    UM->>KC: POST /realms/ococ/protocol/openid-connect/token<br/>(password grant)
    KC-->>UM: {access_token, refresh_token}
    UM-->>B: {access_token, refresh_token}
    Note over B: Stores tokens in localStorage

    B->>UM: GET /api/v1/users<br/>Authorization: Bearer <jwt>
    UM->>UM: JWTMiddleware validates via go-oidc JWKS
    UM->>R: GET permissions:<user_id> (cache check)
    alt Cache miss
        UM->>UM: Load from DB → role_permissions
        UM->>R: SET permissions:<user_id> (cache)
    end
    UM-->>B: 200 OK + data
```

### 5.2 JWT Middleware Implementation

The middleware at [`auth/middleware.go`](file:///home/aman/web_world/OCOC/OCOC_microservices/user_management/backend/internal/auth/middleware.go) performs:

1. **Token extraction** from `Authorization: Bearer` header
2. **OIDC verification** using `go-oidc` verifier with JWKS from Keycloak
3. **Claims parsing** into `Claims{Sub, Email, PreferredUsername, RealmAccess{Roles}}`
4. **Context injection** of claims for downstream handlers

### 5.3 Keycloak Integration Points

The Keycloak client ([`keycloak/client.go`](file:///home/aman/web_world/OCOC/OCOC_microservices/user_management/backend/internal/infrastructure/keycloak/client.go)) provides:

| Method | Purpose | When Called |
|---|---|---|
| `UserLogin` | Password grant → tokens | User login |
| `RefreshToken` | Refresh grant → new tokens | Token refresh |
| `Logout` | Revoke refresh token | User logout |
| `CreateUser` | Admin API → create user | User creation (onboarding) |
| `UpdateUser` | Admin API → update attrs | Profile update |
| `DisableUser` | Set `enabled=false` | User suspension/deactivation |
| `EnableUser` | Set `enabled=true` | User reactivation |
| `LogoutAllSessions` | Invalidate all sessions | User suspension |
| `ResetPassword` | Admin password reset | Password reset flow |
| `AssignRealmRole` | Map realm role | Role assignment |

### 5.4 Redis Caching Layer

[`redis/client.go`](file:///home/aman/web_world/OCOC/OCOC_microservices/user_management/backend/internal/infrastructure/redis/client.go) provides four namespaced key families:

| Prefix | Purpose | TTL |
|---|---|---|
| `otp:<email>` | 6-digit OTP for password reset | Configurable (default 600s) |
| `permissions:<user_id>` | Cached permissions JSON array | Per-call TTL |
| `revoked:<key>` | Token/user revocation flag | Per-call TTL |
| `session:<session_id>` | Session metadata (JSON) | Per-call TTL |

### 5.5 OTP / Password Reset Flow

```mermaid
sequenceDiagram
    participant B as Browser
    participant UM as User Management
    participant R as Redis
    participant SMTP as Gmail SMTP
    participant KC as Keycloak

    B->>UM: POST /api/v1/auth/forgot-password {email}
    UM->>UM: Generate 6-digit OTP
    UM->>R: SET otp:<email> = OTP (TTL=600s)
    UM->>SMTP: Send OTP email
    UM-->>B: "OTP sent"

    B->>UM: POST /api/v1/auth/verify-otp {email, otp}
    UM->>R: GET otp:<email>
    R-->>UM: stored OTP
    UM->>UM: Compare → match
    UM->>R: DELETE otp:<email>
    UM-->>B: "OTP verified"

    B->>UM: POST /api/v1/auth/reset-password {email, new_password}
    UM->>KC: PUT /admin/realms/ococ/users/<id>/reset-password
    KC-->>UM: 204 No Content
    UM-->>B: "Password reset"
```

---

## 6. User Management Service — Internal Architecture

### 6.1 Layered Architecture

```
cmd/api/main.go (bootstrap + DI + routing)
    │
    ├── internal/auth/         → JWT middleware, OIDC verification, OTP handler
    ├── internal/user/         → User CRUD, profile management, Keycloak sync
    ├── internal/onboarding/   → Multi-step onboarding orchestrator
    ├── internal/registration/ → Public self-registration (no auth required)
    ├── internal/rfid/         → RFID card lifecycle + reader integration
    ├── internal/faceauth/     → Face auth event logging
    ├── internal/audit/        → Immutable audit trail
    ├── internal/role/         → RBAC role/permission management
    ├── internal/dashboard/    → Analytics aggregation queries
    └── internal/infrastructure/
        ├── database/          → PostgreSQL connection + migration runner
        ├── keycloak/          → Keycloak Admin REST API client
        └── redis/             → Redis caching + OTP + revocation
```

### 6.2 Dependency Injection

Manual DI is performed in [`main.go`](file:///home/aman/web_world/OCOC/OCOC_microservices/user_management/backend/cmd/api/main.go). The initialization order is:

```go
// 1. Infrastructure
db := database.OpenFromEnv()           // PostgreSQL
database.RunMigrations(ctx, db, dir)   // Apply SQL migrations
redis := redis.NewClient()             // Redis
kc := keycloak.NewClientFromEnv()      // Keycloak admin client

// 2. Repositories
auditRepo := audit.NewPostgresRepository(db.DB)
roleRepo  := role.NewPostgresRepository(db.DB)
userRepo  := user.NewPostgresRepository(db.DB)
rfidRepo  := rfid.NewPostgresRepository(db.DB)

// 3. Services (cross-wired via interfaces)
auditSvc  := audit.NewService(auditRepo)
roleSvc   := role.NewService(roleRepo)
rfidSvc   := rfid.NewService(rfidRepo, auditSvc, rfid.NewReaderFromEnv(), db.DB)
userSvc   := user.NewService(userRepo, kc, auditSvc, rfidSvc, redis, db.DB)
onboardSvc := onboarding.NewService(userSvc, rfidSvc, auditSvc, db.DB)
regSvc    := registration.NewService(db.DB, auditSvc)
faceSvc   := faceauth.NewService(db.DB, auditSvc)
dashSvc   := dashboard.NewService(db.DB)

// 4. Handlers
// Each module's NewHandler(svc) creates HTTP handlers
```

### 6.3 User Module Detail

**Model** ([`user/model.go`](file:///home/aman/web_world/OCOC/OCOC_microservices/user_management/backend/internal/user/model.go)):

```
User {ID, KeycloakUserID, UserType, Status, Email, Phone, ActiveRFID, Profile, CreatedAt, UpdatedAt}
Profile {FullName, RollNumber, EmployeeID, DepartmentID, Department, School, Course, Semester,
         Designation, HostelFlag, HostelID, EmergencyContact, GuardianContact, PhotoReference,
         GovIDType, GovIDNumber, VisitPurpose, HostContact, VisitStart, VisitDurationDays}
UserType: student | faculty | worker | visitor
Status: active | suspended | deactivated
```

**Service** ([`user/service.go`](file:///home/aman/web_world/OCOC/OCOC_microservices/user_management/backend/internal/user/service.go)) — Key operations:

| Operation | DB | Keycloak | Redis | RFID | Audit |
|---|---|---|---|---|---|
| `Create` | INSERT user + profile | `CreateUser` + `AssignRealmRole` | — | — | ✓ |
| `Update` | UPDATE profile | `UpdateUser` (email/name sync) | — | — | ✓ |
| `Suspend` | SET status='suspended' | `DisableUser` + `LogoutAllSessions` | `InvalidatePermissions` | `SyncUserCardStatus(false)` | ✓ |
| `Activate` | SET status='active' | `EnableUser` | `InvalidatePermissions` | `SyncUserCardStatus(true)` | ✓ |
| `Delete` (soft) | SET status='deactivated' | `DisableUser` + `LogoutAllSessions` | `InvalidatePermissions` | `SyncUserCardStatus(false)` | ✓ |

> [!IMPORTANT]
> **Compensation Pattern:** Status changes use `withTx` for the DB mutation, then perform **synchronous compensation** to Keycloak and Redis. If the Keycloak call fails, the DB transaction has already committed — there is no distributed rollback.

**Repository** ([`user/repository.go`](file:///home/aman/web_world/OCOC/OCOC_microservices/user_management/backend/internal/user/repository.go)) — Uses `LEFT JOIN` across all four profile tables to load any user regardless of type:

```sql
SELECT u.*, sp.*, fp.*, wp.*, vp.*
FROM users u
LEFT JOIN student_profiles sp ON sp.user_id = u.id AND u.user_type = 'student'
LEFT JOIN faculty_profiles fp ON fp.user_id = u.id AND u.user_type = 'faculty'
LEFT JOIN worker_profiles wp ON wp.user_id = u.id AND u.user_type = 'worker'
LEFT JOIN visitor_profiles vp ON vp.user_id = u.id AND u.user_type = 'visitor'
```

### 6.4 Transaction Management

The system uses **serializable isolation** for critical mutations:

```go
func (db *DB) WithTx(ctx context.Context, fn func(*sql.Tx) error) error {
    tx, _ := db.BeginTx(ctx, &sql.TxOptions{Isolation: sql.LevelSerializable})
    if err := fn(tx); err != nil {
        _ = tx.Rollback()
        return err
    }
    return tx.Commit()
}
```

The RFID module has its own identical `withTx` helper for card operations.

---

## 7. FRECO Face Recognition Service — Internal Architecture

### 7.1 Layered Architecture

```
app/main.py (FastAPI app, lifespan, stateless endpoints)
    │
    ├── app/api/
    │   ├── identity.py    → DB-backed person registry + attendance
    │   └── stream.py      → WebSocket real-time face stream
    │
    ├── app/ml/
    │   ├── model_manager.py   → Thread-safe model cache + snapshots
    │   ├── pipeline.py        → FacePipeline (detect → align → embed → match)
    │   ├── face_detector.py   → SCRFD wrapper (InsightFace)
    │   ├── face_recognizer.py → ArcFace embedding extractor
    │   ├── face_align.py      → 5-point ArcFace alignment
    │   ├── liveness.py        → MiniFASNet ONNX ensemble (passive anti-spoof)
    │   ├── face_visibility.py → Face quality/visibility checks
    │   ├── pose_estimator.py  → Head pose from landmarks
    │   ├── model_registry.py  → InsightFace model pack loader
    │   ├── model_metrics.py   → Inference telemetry
    │   └── runtime.py         → CUDA/CPU detection + ONNX providers
    │
    ├── app/models.py     → SQLAlchemy ORM (Person, FaceEmbedding, Attendance)
    ├── app/schemas.py    → Pydantic request/response models
    ├── app/db.py         → Async SQLAlchemy engine + session maker
    ├── app/config.py     → Pydantic Settings (env-driven)
    └── app/utils/
        └── image_utils.py → Image decode + validation
```

### 7.2 Model Manager

[`ModelManager`](file:///home/aman/web_world/OCOC/OCOC_microservices/freco/backend/app/ml/model_manager.py) is a **thread-safe model cache** that loads models once at startup:

| Model | Framework | Purpose | Input | Output |
|---|---|---|---|---|
| **SCRFD** | InsightFace / ONNX Runtime | Face detection + 5-point landmarks | BGR image | bboxes + keypoints |
| **ArcFace** | InsightFace / ONNX Runtime | 512-dim face embedding | 112×112 aligned face | L2-normalized vector |
| **MiniFASNet** (V2 + V1SE) | ONNX Runtime | Passive liveness (anti-spoof) | Expanded face crop | 3-class logits |

The `snapshot()` method returns an immutable `ActiveModels` dataclass, ensuring no lock contention during inference.

### 7.3 FacePipeline

[`FacePipeline`](file:///home/aman/web_world/OCOC/OCOC_microservices/freco/backend/app/ml/pipeline.py) is **stateless** and provides four core operations:

```
extract_embeddings(image)           → Single face → color + grayscale embeddings
match_against_embeddings(image, candidates) → Liveness → embed → cosine match
extract_embeddings_for_all_faces(image)     → All faces → embeddings (for mass)
match_all_against_embeddings(image, cands)  → All faces → liveness + match each
```

**Pipeline stages for `match_against_embeddings`:**

```
Image → SCRFD detect_single → Liveness check → ArcFace align (color+gray)
      → ArcFace embed → Cosine dot product vs candidates → Best match
```

### 7.4 Liveness Detection

[`LivenessDetector`](file:///home/aman/web_world/OCOC/OCOC_microservices/freco/backend/app/ml/liveness.py) fuses two MiniFASNet models:

- **MiniFASNetV2** with 2.7× expanded crop
- **MiniFASNetV1SE** with 4.0× expanded crop

Fusion method: **Average logits → softmax → argmax + threshold check**

```python
fused_probabilities = softmax(mean(logits_v2, logits_v1se))
is_live = argmax(fused) == real_class_index AND fused[real_class_index] >= 0.85
```

> [!NOTE]
> The crop is deliberately *expanded* beyond the detector bounding box to preserve background artifacts that reveal printed photos and display replays.

### 7.5 API Endpoints

**Stateless endpoints** (no DB, caller supplies embeddings):

| Method | Path | Purpose |
|---|---|---|
| POST | `/get_image`, `/api/v1/auth/get_image` | Extract embeddings from single face |
| POST | `/get_mass_images`, `/api/v1/auth/get_mass_images` | Extract embeddings from all faces |
| POST | `/match`, `/api/v1/auth/match` | Liveness + match vs caller-supplied vectors |
| POST | `/mass_match/all`, `/api/v1/auth/mass_match/all` | Liveness + match all faces |

**DB-backed endpoints** (pgvector search):

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/v1/people` | Register person + 5 pose enrollment images |
| GET | `/api/v1/people` | List registered people |
| POST | `/api/v1/recognize` | Single face → pgvector nearest neighbour |
| POST | `/api/v1/recognize/mass` | Multi-face → pgvector search per face |
| POST | `/api/v1/attendance/sessions` | Create attendance session |
| GET | `/api/v1/attendance/sessions` | List sessions with counts |
| POST | `/api/v1/attendance/sessions/{id}/rfid` | Mark RFID attendance |
| POST | `/api/v1/attendance/sessions/{id}/mass` | Mass face attendance |

**WebSocket endpoint:**

| Protocol | Path | Purpose |
|---|---|---|
| WS | `/api/v1/face/stream` | Real-time face detection + pose + liveness for camera UI |

---

## 8. Onboarding Workflow (End-to-End)

The onboarding flow spans **both services** and the **frontend**:

```mermaid
sequenceDiagram
    participant Admin as Admin UI
    participant UM as User Management
    participant KC as Keycloak
    participant PG as PostgreSQL
    participant FR as FRECO
    participant RFID as RFID Reader

    Note over Admin: Step 1-2: Fill persona form
    Admin->>UM: POST /api/v1/onboarding/student {user data}

    Note over UM: Step 3: Create user + profile
    UM->>PG: INSERT users + student_profiles (tx)
    UM->>KC: CreateUser (Keycloak)
    KC-->>UM: keycloak_user_id
    UM->>PG: UPDATE users SET keycloak_user_id
    UM->>KC: AssignRealmRole("student")
    UM->>KC: ResetPassword (temporary)
    UM-->>Admin: {user, message: "proceed to RFID"}

    Note over Admin: Step 4: Face enrollment
    Admin->>FR: WebSocket /api/v1/face/stream (registration mode)
    loop 5 poses (center, left, right, chin_up, chin_down)
        FR-->>Admin: face_detected + pose estimation
        Admin->>Admin: Capture high-quality image
    end
    Admin->>FR: POST /api/v1/people {external_id=user.id, images×5, poses}
    FR->>FR: SCRFD detect → ArcFace align → embed (color+gray per pose)
    FR->>PG: INSERT freco_people + freco_face_embeddings (10 vectors)
    FR-->>Admin: {face_embeddings_created: 10}

    Note over Admin: Step 5: RFID enrollment
    Admin->>UM: POST /api/v1/rfid/scan
    UM->>RFID: StartScan → ReadCard
    RFID-->>UM: {uid: "A1B2C3D4"}
    Admin->>UM: POST /api/v1/onboarding/{user_id}/rfid {uid}
    UM->>PG: INSERT rfid_cards + user_rfid_cards (tx, serializable)
    UM-->>Admin: {card: ...}

    Note over Admin: Step 6: Issue card
    Admin->>UM: POST /api/v1/onboarding/{user_id}/issue-card
    UM->>PG: Audit log: CARD_ISSUED
    UM-->>Admin: {card_issued: true}
```

### Onboarding Module Detail

[`onboarding/onboarding.go`](file:///home/aman/web_world/OCOC/OCOC_microservices/user_management/backend/internal/onboarding/onboarding.go) orchestrates:

1. **Persona validation** — role-specific required fields enforced
2. **User creation** — delegates to `userSvc.Create()` (which handles Keycloak sync)
3. **RFID enrollment** — delegates to `rfidSvc.Assign()` (atomic in serializable tx)
4. **Card issuance** — audit-only step, marks process complete

Persona-specific routes: `POST /api/v1/onboarding/{student|faculty|worker|visitor}`

---

## 9. Face Recognition Pipeline (Camera → Identity)

### 9.1 WebSocket Stream (Real-Time Guidance)

```mermaid
sequenceDiagram
    participant Camera as Browser Camera
    participant WS as FRECO WebSocket
    participant FD as SCRFD Detector
    participant LV as MiniFASNet
    participant PE as Pose Estimator

    Camera->>WS: {mode: "single_recognition", frame: <base64>}
    WS->>FD: detect_single(image_bgr)
    FD-->>WS: DetectedFace(bbox, landmarks, score)
    WS->>PE: estimate_pose(landmarks)
    PE-->>WS: {yaw, pitch, roll, label}
    WS->>LV: predict(image, bbox)
    LV-->>WS: (is_live, score)
    WS-->>Camera: {status: "face_detected", faces: [{bbox, pose, is_live, liveness_score}]}
```

### 9.2 Single Face Recognition (DB-Backed)

```mermaid
sequenceDiagram
    participant UI as Frontend
    participant FR as FRECO /api/v1/recognize
    participant FP as FacePipeline
    participant PG as PostgreSQL (pgvector)

    UI->>FR: POST /api/v1/recognize (image file)
    FR->>FP: detect_single → liveness check
    alt Spoof detected
        FR-->>UI: {recognized: false, message: "Liveness check failed"}
    end
    FR->>FP: extract_embeddings(image)
    FP-->>FR: {color: vec512, grayscale: vec512}
    FR->>PG: SELECT person, cosine_distance(embedding, vec)<br/>FROM freco_face_embeddings<br/>WHERE active=true AND variant='grayscale'<br/>ORDER BY distance LIMIT 1
    PG-->>FR: (person, distance)
    FR->>FR: score = 1.0 - distance
    alt score >= 0.55
        FR-->>UI: {recognized: true, userId, name, role, similarity}
    else
        FR-->>UI: {recognized: false, message: "No matching user found"}
    end
```

### 9.3 Mass Attendance (Group Photo)

The mass attendance endpoint `POST /api/v1/attendance/sessions/{id}/mass` processes a group photo:

1. **Detect all faces** in one frame
2. **For each face:** Check if already recorded in this session (avoid duplicates)
3. **For new faces:** pgvector nearest-neighbour search → record attendance
4. **Deduplication:** `UNIQUE (session_id, person_id)` constraint + application-level `recorded_person_ids` set

---

## 10. RFID Card Lifecycle

### 10.1 Card State Machine

```mermaid
stateDiagram-v2
    [*] --> active: Assign / Issue
    active --> inactive: Deactivate / User suspended
    inactive --> active: Activate / User reactivated
    active --> lost: Replace (reason: lost)
    active --> stolen: Replace (reason: stolen)
    active --> replaced: Replace (reason: other)
    active --> revoked: Revoke
    lost --> [*]
    stolen --> [*]
    replaced --> [*]
    revoked --> [*]
```

### 10.2 Atomic Card Replacement

The `Replace` operation in [`rfid/service.go`](file:///home/aman/web_world/OCOC/OCOC_microservices/user_management/backend/internal/rfid/service.go#L93-L174) is a **serializable transaction** with 4 steps:

```
BEGIN TRANSACTION ISOLATION LEVEL SERIALIZABLE;
  1. Get current active card for user
  2. Update old card status → lost/stolen/replaced + revoked_at
  3. Unassign old card (set unassigned_at)
  4. Create new card → INSERT rfid_cards
  5. Assign new card → INSERT user_rfid_cards (is_primary=true)
COMMIT;
-- If ANY step fails, ALL roll back
```

### 10.3 RFID Reader Integration

[`rfid/reader.go`](file:///home/aman/web_world/OCOC/OCOC_microservices/user_management/backend/internal/rfid/reader.go) implements the `Reader` interface with two backends:

| Backend | Selection | Status |
|---|---|---|
| `SimulatedReader` | `RFID_READER_SIMULATE=true` or no URL | Fully functional (random UIDs) |
| `WebSocketReader` | `RFID_READER_URL` set | Skeleton — TODO implementation |

---

## 11. Registration (Public Self-Registration)

[`registration/registration.go`](file:///home/aman/web_world/OCOC/OCOC_microservices/user_management/backend/internal/registration/registration.go) provides a **public, unauthenticated** registration endpoint:

```
POST /api/v1/register → No JWT required
```

Key differences from onboarding:
- **No Keycloak user** is created (keycloak_user_id = NULL)
- **No RFID card** is issued
- **No face enrollment** happens
- **Reference validation** — `department_id` and `hostel_id` must exist in lookup tables
- **Direct table insertion** — uses role-specific profile tables (`student_profiles`, etc.)

The registration module uses **separate LEFT JOIN queries** to list users across all profile types, identical to the user repository pattern.

---

## 12. Notification Module Architecture

The notification module ([`notification_module/`](file:///home/aman/web_world/OCOC/OCOC_microservices/notification_module/)) is a **standalone Go service** with:

| Component | File | Purpose |
|---|---|---|
| Entry point | `main.go` | HTTP handlers, env loading, graceful shutdown |
| Models | `models.go` | Notification, Template, Channel DTOs |
| Service | `service.go` | Business logic, template rendering, channel routing |
| Channels | `email.go`, `whatsapp.go` | SMTP and WhatsApp delivery |
| Queue | `queue.go`, `rabbitmq.go` | RabbitMQ async delivery |
| Storage | `postgres.go`, `repositories.go` | Notification persistence |
| Validation | `validate.go` | Input validation |
| Templates | `template.go` | Go template rendering |

### Delivery Channels

- **Email** — SMTP (Gmail) via `net/smtp`
- **WhatsApp** — WhatsApp Business API integration
- **RabbitMQ** — Async queue for reliable delivery (with `rabbitmq_disabled.go` fallback)

> [!NOTE]
> The notification module is **not directly integrated** with user_management in the current codebase. There is no HTTP call from user_management to the notification service. The OTP emails in user_management are sent directly via SMTP configured in the UM `.env` file, bypassing this module entirely.

---

## 13. Inter-Service Communication Map

```mermaid
graph LR
    subgraph "Frontend (Vue 3)"
        FE["SPA :5173"]
    end

    subgraph "User Management (Go)"
        UM["REST API :8080"]
    end

    subgraph "FRECO (Python)"
        FR["REST + WS API :8000"]
    end

    subgraph "Keycloak"
        KC[":8180"]
    end

    subgraph "PostgreSQL"
        PG["ococ_users :5432"]
    end

    subgraph "Redis"
        RD[":6379"]
    end

    FE -->|"axios /api/v1/*<br/>JWT auth"| UM
    FE -->|"axios direct<br/>No auth"| FR
    UM -->|"HTTP (Admin API)<br/>password grant"| KC
    UM -->|"SQL (lib/pq)"| PG
    UM -->|"go-redis/v9"| RD
    FR -->|"SQL (asyncpg)"| PG
```

### Communication Protocols

| From → To | Protocol | Auth | Purpose |
|---|---|---|---|
| Frontend → UM | HTTP REST | JWT Bearer | All admin operations |
| Frontend → FRECO | HTTP REST + WS | **None** | Face operations (CORS only) |
| UM → Keycloak | HTTP REST | Admin password grant | User lifecycle sync |
| UM → PostgreSQL | TCP (lib/pq) | Connection string | All data |
| UM → Redis | TCP (RESP) | Optional password | Cache + OTP + revocation |
| FRECO → PostgreSQL | TCP (asyncpg) | Connection string | Person registry + embeddings |
| Frontend → FRECO WS | WebSocket | **None** | Real-time face stream |

> [!WARNING]
> **FRECO has no authentication.** Any client that can reach port 8000 can register people, extract embeddings, and perform recognition. CORS is the only boundary, and `allow_credentials=False` means browser cookies aren't sent but direct HTTP calls work unrestricted.

---

## 14. Frontend Architecture

### 14.1 Technology Stack

| Layer | Technology |
|---|---|
| Framework | Vue 3 (Composition API) |
| Build | Vite |
| State | Pinia (`useAuthStore`) |
| Router | Vue Router 4 |
| HTTP | Axios (two instances: `api` for UM, `freco` for FRECO) |
| UI | TailwindCSS + Lucide icons |
| JWT | `jwt-decode` (client-side parsing) |

### 14.2 Routing Table

| Path | View | Auth | Notes |
|---|---|---|---|
| `/login` | Login.vue | Public | Keycloak password login |
| `/forgot-password` | ForgotPassword.vue | Public | OTP-based reset |
| `/dashboard` | Dashboard.vue | ✓ | Overview + analytics |
| `/users` | Users.vue | ✓ `user:read` | User CRUD + status management |
| `/onboarding` | Onboarding.vue | ✓ `user:create` | Multi-step wizard |
| `/rfid` | RFID.vue | ✓ `rfid:read` | Card management |
| `/audit` | Audit.vue | ✓ `audit:read` | Audit log viewer |
| `/analytics` | Analytics.vue | ✓ | Charts and trends |
| `/face-recognition` | FaceRecognition.vue | ✓ | Face Lab (live recognition) |
| `/face-auth-log` | FaceAuthLog.vue | ✓ | Auth event monitor |

### 14.3 Key Components

| Component | Purpose |
|---|---|
| [`FaceOvalCamera.vue`](file:///home/aman/web_world/OCOC/OCOC_microservices/user_management/frontend/src/components/FaceOvalCamera.vue) | Camera with oval guide, pose detection, auto-capture timer |
| [`UserProfileForm.vue`](file:///home/aman/web_world/OCOC/OCOC_microservices/user_management/frontend/src/components/UserProfileForm.vue) | Dynamic persona form (student/faculty/worker/visitor) |
| [`EditUserModal.vue`](file:///home/aman/web_world/OCOC/OCOC_microservices/user_management/frontend/src/components/EditUserModal.vue) | User edit dialog with all profile fields |
| [`AssignRFIDModal.vue`](file:///home/aman/web_world/OCOC/OCOC_microservices/user_management/frontend/src/components/AssignRFIDModal.vue) | RFID card assignment modal |
| [`UserStatusModal.vue`](file:///home/aman/web_world/OCOC/OCOC_microservices/user_management/frontend/src/components/UserStatusModal.vue) | Suspend/activate/deactivate confirmation |

### 14.4 Dual API Client Pattern

```typescript
// User Management API (proxied, JWT auth)
const api = axios.create({ baseURL: '/api/v1' })
api.interceptors.request.use(config => {
    config.headers.Authorization = `Bearer ${localStorage.getItem('access_token')}`
})

// FRECO API (direct, no auth)
const FRECO_BASE = import.meta.env.VITE_FRECO_URL || 'http://localhost:8000'
const freco = axios.create({ baseURL: FRECO_BASE })
```

### 14.5 Auth Guard

```typescript
router.beforeEach((to, _from, next) => {
    if (to.meta.requiresAuth && !auth.isAuthenticated) return next({ name: 'Login' })
    if (to.meta.public && auth.isAuthenticated) return next({ name: 'Dashboard' })
    // Permission check is present but commented out (SUPER_ADMIN bypass)
    next()
})
```

### 14.6 Token Refresh Interceptor

The Axios response interceptor in [`api.ts`](file:///home/aman/web_world/OCOC/OCOC_microservices/user_management/frontend/src/services/api.ts) automatically refreshes expired tokens:

```
401 response → POST /api/v1/auth/refresh → retry original request
If refresh fails → clear tokens → redirect to /login
```

---

## 15. Docker / Container Architecture

[`docker-compose.yml`](file:///home/aman/web_world/OCOC/OCOC_microservices/user_management/docker-compose.yml) defines 5 services:

```yaml
services:
  postgres:    # pgvector/pgvector:pg16 → :5433→5432
  redis:       # redis:7-alpine → :6379
  keycloak:    # keycloak:24.0 (start-dev) → :8180
  backend:     # Go backend (Dockerfile) → :8080
  frontend:    # Vue frontend (Dockerfile) → :5173→80

volumes:
  pgdata:      # Persistent PostgreSQL data
```

### Dependency Chain

```
postgres (healthcheck: pg_isready)
    ↓
keycloak (depends_on: postgres healthy)
redis (healthcheck: redis-cli ping)
    ↓
backend (depends_on: postgres healthy + redis healthy)
    ↓
frontend (depends_on: backend)
```

> [!NOTE]
> FRECO is **not included** in this docker-compose. It runs as a separate process, typically via `uvicorn app.main:app --host 0.0.0.0 --port 8000`.
> Keycloak shares the `ococ_users` database with the application — its internal tables coexist in the same database.

---

## 16. Audit & Observability

### 16.1 Audit Logging

The [`audit`](file:///home/aman/web_world/OCOC/OCOC_microservices/user_management/backend/internal/audit/audit.go) module provides an **append-only, immutable** audit trail:

```sql
audit_logs (
    id UUID, actor_id UUID, operation TEXT, entity_type TEXT, entity_id TEXT,
    before_state JSONB, after_state JSONB, ip_address TEXT, user_agent TEXT, created_at TIMESTAMPTZ
)
```

**Audit interface** — used by all modules via dependency injection:

```go
type AuditLogger interface {
    Log(ctx context.Context, actorID, operation, entityType, entityID string,
        before, after interface{}, ip string) error
}
```

### 16.2 Audited Operations

| Module | Operations Logged |
|---|---|
| User | `CREATE_USER`, `UPDATE_USER`, `SUSPEND_USER`, `ACTIVATE_USER`, `DELETE_USER` |
| Onboarding | `ONBOARDING_STARTED`, `RFID_ENROLLED`, `CARD_ISSUED` |
| RFID | `ASSIGN_RFID`, `REPLACE_RFID`, `REVOKE_RFID` |
| FaceAuth | `FACE_AUTH_SUCCESS`, `FACE_AUTH_FAILED`, `FACE_AUTH_LIVENESS_FAILED` |
| Registration | `PUBLIC_REGISTRATION` |

### 16.3 FRECO Observability

FRECO uses structured JSON logging:

```json
{"time":"...", "level":"INFO", "message":"freco_ready - device: cuda - active models: {...} - startup: 1234.56ms"}
```

The `ModelMetrics` class tracks:
- Per-model inference latency
- Pipeline step latencies
- Model load times
- Device (CPU/CUDA) status

---

## 17. Error Handling Patterns

### 17.1 User Management (Go)

Every module follows a consistent JSON error response pattern:

```json
{
    "success": false,
    "error": {
        "code": "VALIDATION_ERROR",
        "message": "email is required"
    }
}
```

Error classification is done via **string matching** on error messages:

```go
if strings.Contains(err.Error(), "required") || strings.Contains(err.Error(), "invalid") {
    code = "VALIDATION_ERROR"
    status = http.StatusBadRequest
} else if strings.Contains(err.Error(), "already") {
    code = "DUPLICATE_USER"
    status = http.StatusConflict
}
```

### 17.2 FRECO (Python)

Uses FastAPI's `HTTPException` with specific status codes:
- `400` — Invalid image or JSON
- `422` — No face, multiple faces, invalid embeddings
- `503` — Database unavailable

Custom exceptions: `NoFaceDetectedError`, `MultipleFacesDetectedError`, `LivenessRejected`, `InvalidImageError`

---

## 18. Configuration & Environment Management

### 18.1 User Management Environment

Key environment variables from [`.env`](file:///home/aman/web_world/OCOC/OCOC_microservices/user_management/backend/.env):

| Variable | Default | Purpose |
|---|---|---|
| `DATABASE_URL` | `postgres://ococ:root@localhost:5432/ococ_users` | PostgreSQL DSN |
| `REDIS_URL` | `redis://localhost:6379/0` | Redis connection |
| `KEYCLOAK_URL` | `http://localhost:8180` | Keycloak base URL |
| `KEYCLOAK_REALM` | `ococ` | OIDC realm |
| `KEYCLOAK_CLIENT_ID` | `user-management` | OIDC client |
| `RFID_READER_SIMULATE` | `true` | Use simulated reader |
| `CORS_ALLOWED_ORIGINS` | `http://localhost:5173` | Allowed CORS origins |
| `SMTP_HOST` / `SMTP_PORT` | `smtp.gmail.com:587` | OTP email delivery |

### 18.2 FRECO Environment

Key settings from [`config.py`](file:///home/aman/web_world/OCOC/OCOC_microservices/freco/backend/app/config.py):

| Variable | Default | Purpose |
|---|---|---|
| `DATABASE_URL` | `postgresql+asyncpg://ococ:root@localhost:5432/ococ_users` | Async PG DSN |
| `INFERENCE_DEVICE` | `auto` (env: `cuda`) | CPU or CUDA |
| `COSINE_SIMILARITY_THRESHOLD` | `0.55` | Match threshold |
| `LIVENESS_THRESHOLD` | `0.85` | Liveness pass threshold |
| `IMAGE_STORAGE_MODE` | `grayscale` | Embedding variants to generate |
| `FACE_MODEL_PACK` | `antelopev2` | InsightFace model pack |
| `DETECTION_MIN_CONFIDENCE` | `0.6` | Minimum face detection score |

---

## 19. What the Architecture Appears Intended to Do

Based on the codebase structure and naming conventions, the system is designed toward:

1. **Full physical access control** — RFID cards + face recognition for campus entry/exit, with attendance tracking as a secondary use case.

2. **Self-service registration** with admin approval — The public registration endpoint creates users without Keycloak accounts; admin onboarding creates the full identity (Keycloak + face + RFID).

3. **Event-driven notification system** — The notification module has RabbitMQ integration, templating, and multi-channel delivery, suggesting plans for automated alerts (e.g., "your card was revoked", "attendance recorded").

4. **Multi-deployment FRECO** — The dual endpoint structure (e.g., both `/match` and `/api/v1/auth/match`) suggests FRECO was originally standalone and later integrated into the unified API namespace.

5. **Mobile/kiosk deployment** — The WebSocket face stream with pose guidance and the FaceOvalCamera component suggest deployment on kiosk or mobile devices for self-service check-in.

---

## 20. Architectural Problems & Technical Debt

### (A) Critical Issues

> [!CAUTION]
> **1. No Authentication on FRECO.** The entire face recognition service — including person registration, embedding extraction, and identity recognition — has zero authentication. Any network-reachable client can register fake identities or perform reconnaissance.

> [!CAUTION]
> **2. Shared Database Without Ownership Boundaries.** Both services write to `ococ_users`. FRECO's `freco_people.external_id` references `users.id` but **the FK constraint exists in the SQLAlchemy model** while the migration comment says "logical link, no FK." The actual migration `004` does NOT create a FK constraint, but the SQLAlchemy model declares `ForeignKey("users.id")`, which `create_all()` would enforce. This creates a divergence between migration-managed schema and ORM-managed schema.

> [!WARNING]
> **3. No Distributed Transaction / Saga.** When `user.Service.Create()` commits the DB transaction and then fails on `kc.CreateUser()`, the user exists in the database without a Keycloak identity. There is no compensation or retry mechanism.

### (B) Moderate Issues

> [!WARNING]
> **4. String-Based Error Classification.** Error handling in Go handlers uses `strings.Contains(err.Error(), "required")` to classify errors. This is fragile — any change in error message text silently breaks the classification.

> [!WARNING]
> **5. Duplicate `withTx` Helpers.** Both `database/postgres.go` and `rfid/service.go` define independent `withTx` functions with identical logic. The RFID version doesn't use the infrastructure one.

> [!IMPORTANT]
> **6. Registration Creates Users Without Keycloak.** Public registration inserts into `users` with `keycloak_user_id = NULL` and `status = 'active'`. These users can't log in but appear in user counts and could be confused with fully onboarded users.

> [!IMPORTANT]
> **7. Permission Check Commented Out.** In the frontend router guard, the permission-based access control is commented out with a `// For simplicity` note. All authenticated users can access all routes.

### (C) Minor Issues / Tech Debt

- **Notification module is disconnected.** No service calls it; OTP emails bypass it entirely via direct SMTP.
- **WebSocket RFID reader is a skeleton.** The `WebSocketReader.ReadCard()` returns a hardcoded error.
- **No rate limiting** on any endpoint (login, registration, face recognition).
- **No request validation middleware** — each handler does its own JSON decoding and validation.
- **FRECO's `_best_person` makes multiple DB queries** (one per variant) instead of a single query with `OR` conditions.
- **Keycloak and app share the same database** (`ococ_users`), which couples their lifecycle.
- **No graceful shutdown** coordination between services.
- **`user_profiles` legacy table is kept** but the application uses split profile tables; the migration data copy uses `ON CONFLICT DO NOTHING` which may silently skip rows.
- **Face enrollment requires exactly 5 images** with specific pose names — no flexibility for fewer images or different pose sets.

---

> **End of analysis.** This document was derived entirely from tracing the actual implementation across 50+ source files. Each section references the specific source file(s) that informed the finding.
