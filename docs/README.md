# OCOC Microservices — Documentation Hub

> **OCOC (Our Campus, Our Community)** — A comprehensive Campus Identity and Access Management (IAM) platform.

---

## 📚 Documentation Index

| Document | Description | Lines |
|----------|-------------|-------|
| [**ARCHITECTURE.md**](./ARCHITECTURE.md) | 🏗️ **Start here.** System-wide architecture, component interactions, data flows, tech stack, security model, and deployment topology. | 211 |
| [**FRECO.md**](./FRECO.md) | 🤖 Face Recognition microservice — ML pipeline (SCRFD → ArcFace → MiniFASNet), REST/WebSocket APIs, pgvector embeddings, GPU deployment. | 184 |
| [**USER_MANAGEMENT_BACKEND.md**](./USER_MANAGEMENT_BACKEND.md) | ⚙️ Central FastAPI backend — Authentication, RBAC, Access Control, RFID, Hostel Management, Leave Workflows, Audit Trails. | 268 |
| [**USER_MANAGEMENT_FRONTEND.md**](./USER_MANAGEMENT_FRONTEND.md) | 🖥️ React + Vite SPA — Role-based dashboards, biometric capture UI, onboarding wizard, real-time monitoring views. | 144 |
| [**DATABASE_SCHEMA.md**](./DATABASE_SCHEMA.md) | 🗄️ PostgreSQL + pgvector schema — 30+ tables, 21 migrations, ER diagrams, seed scripts. | 132 |

---

## 🚀 Quick Start Reading Order

1. **[ARCHITECTURE.md](./ARCHITECTURE.md)** — Understand the big picture first
2. **[DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md)** — Learn the data model
3. **[USER_MANAGEMENT_BACKEND.md](./USER_MANAGEMENT_BACKEND.md)** — Dive into backend APIs and business logic
4. **[FRECO.md](./FRECO.md)** — Understand the biometric engine
5. **[USER_MANAGEMENT_FRONTEND.md](./USER_MANAGEMENT_FRONTEND.md)** — Explore the user interface

---

## 🏛️ System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    OCOC Platform                            │
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │   Frontend    │  │   Backend    │  │   FRECO (GPU)    │  │
│  │  React+Vite   │──│   FastAPI    │──│   Face Recog.    │  │
│  │  Port 5173    │  │  Port 8080   │  │   Port 8000      │  │
│  └──────────────┘  └──────┬───────┘  └────────┬─────────┘  │
│                           │                    │            │
│         ┌─────────────────┼────────────────────┘            │
│         │                 │                                 │
│  ┌──────┴───────┐  ┌─────┴──────┐  ┌──────────────────┐   │
│  │  PostgreSQL   │  │   Redis    │  │    Keycloak       │   │
│  │  + pgvector   │  │  Cache/PS  │  │   Identity IdP    │   │
│  └──────────────┘  └────────────┘  └──────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔑 Key Concepts

- **RBAC**: 13 Keycloak roles (`SUPER_ADMIN`, `ADMIN`, `USER_MANAGER`, `GUARD`, `WARDEN`, `SECURITY_ADMIN`, `VIEWER`, `STUDENT`, `FACULTY`, `SECURITY_GUARD`, `STAFF`, `WORKER`, `VISITOR`) + 2 workflow roles (`CHANCELLOR`, `MEDICAL_OFFICER`) enforced at Keycloak + API + UI levels
- **2-Factor Physical Auth**: RFID card scan + Face recognition for gate access
- **Anti-Spoofing**: MiniFASNet liveness detection prevents photo/video attacks
- **Real-Time**: WebSocket streaming for live dashboards and RFID events
- **Leave Workflow**: State-machine-based approval pipeline with automatic gate permissions

---

*Generated on 2026-10-01 from deep codebase analysis.*
