# OCOC Microservices Documentation

> Complete architecture and workflow documentation for the OCOC campus identity and attendance platform.

## Table of Contents

- [System Overview](#system-overview)
- [Technology Stack](#technology-stack)
- [Microservices Architecture](#microservices-architecture)
- [User Management Service](./user-management.md)
- [Freco Face Recognition Service](./freco-face-recognition.md)
- [Notification Module](./notification-module.md)
- [Frontend Application](./frontend.md)
- [CI/CD Pipeline](./cicd-pipeline.md)
- [Running the Application](#running-the-application)

---

## System Overview

The OCOC platform is a **campus identity and attendance system** built as three independent microservices with an identity provider (Keycloak). The system handles user management, face recognition, and notifications.

### Key Capabilities

- **User Management**: CRUD operations, role-based access control, RFID card management
- **Face Recognition**: Enrollment, single/mass recognition, liveness detection, attendance
- **Notifications**: Email and WhatsApp delivery with templates
- **Audit Trail**: Immutable logging of all state changes
- **Dashboard**: Analytics, trends, and statistics

---

## Technology Stack

| Component | Technology |
|-----------|-----------|
| **User Management Backend** | Go 1.22, Chi router, PostgreSQL, Redis, Keycloak |
| **User Management Frontend** | Vue 3, TypeScript, Vite, Pinia, Axios |
| **Freco (Face Recognition)** | Python, FastAPI, ONNX Runtime (GPU/CUDA), SQLAlchemy, pgvector |
| **Notification Module** | Go, PostgreSQL, RabbitMQ (optional), SMTP, WhatsApp Cloud API |
| **Identity Provider** | Keycloak 24/26 (OIDC/OAuth2) |
| **Database** | PostgreSQL 16 + pgvector |
| **Cache/Session** | Redis 7 |
| **Deployment** | Docker, Kubernetes (k3s), GitHub Actions CI/CD |

---

## Microservices Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        OCOC Platform                                │
│                                                                     │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────────┐      │
│  │   Frontend   │    │   Keycloak   │    │   PostgreSQL     │      │
│  │  (Vue 3)     │    │   (OIDC)     │    │   (ococ_users)   │      │
│  │  Port 5173   │    │   Port 8180  │    │   Port 5432/5433 │      │
│  └──────┬───────┘    └──────┬───────┘    └────────┬─────────┘      │
│         │                   │                     │                 │
│         ▼                   ▼                     ▼                 │
│  ┌──────────────────────────────────────────────────────────┐      │
│  │              User Management Backend (Go)                 │      │
│  │                      Port 8080                            │      │
│  └──────────────────────────────────────────────────────────┘      │
│           │                                                         │
│           ▼                                                         │
│  ┌──────────────────────────────────────────────────────────┐      │
│  │         Freco Face Recognition Service (Python)           │      │
│  │                      Port 8000                            │      │
│  └──────────────────────────────────────────────────────────┘      │
│           │                                                         │
│           ▼                                                         │
│  ┌──────────────────────────────────────────────────────────┐      │
│  │          Notification Module (Go) Port 8000               │      │
│  └──────────────────────────────────────────────────────────┘      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Running the Application

### Quick Start

```bash
# 1. Start infrastructure (PostgreSQL, Redis, Keycloak)
cd user_management
docker-compose up --build

# 2. Start User Management Backend
cd backend
go run ./cmd/api/main.go

# 3. Start Frontend
cd frontend
npm install && npm run dev

# 4. Start Freco
cd freco/backend
uvicorn app.main:app --reload

# 5. Start Notification Module
cd notification_module
go run .
```

### Access Points

| Service | URL |
|---------|-----|
| Frontend | http://localhost:5173 |
| User Management API | http://localhost:8080 |
| Freco API | http://localhost:8000 |
| Keycloak | http://localhost:8180 |
| PostgreSQL | localhost:5432 (or 5433 in Docker) |
| Redis | localhost:6379 |

---

## Key Design Decisions

1. **Shared Database**: Both user_management and freco share `ococ_users` database but own different tables
2. **Stateless Freco**: Freco has no identity knowledge - only processes vectors
3. **Keycloak for Auth**: Centralized identity management with OIDC/OAuth2
4. **pgvector for Face Search**: HNSW index for fast approximate nearest-neighbor cosine search
5. **Audit Trail**: Immutable log of all state changes
6. **RFID Integration**: WebSocket-based reader with simulation mode
7. **GPU Acceleration**: ONNX Runtime with CUDA for inference
8. **Anti-Spoofing**: Passive liveness detection (MiniFASNet) - fail closed
9. **Graceful Degradation**: Redis optional, service continues without it
