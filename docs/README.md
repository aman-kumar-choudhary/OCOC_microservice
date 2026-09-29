# OCOC Microservices Documentation

> Complete architecture and workflow documentation for the OCOC — One Card One Campus platform.

## Table of Contents

- [System Overview](#system-overview)
- [Role-Based Dashboards](#role-based-dashboards)
- [Technology Stack](#technology-stack)
- [Microservices Architecture](#microservices-architecture)
- [Dashboards Module (Module 11)](./dashboards.md)
- [User Management Service](./user-management.md)
- [Leave Management System](./leave-management.md)
- [Guard Console](./guard-console.md)
- [Freco Face Recognition Service](./freco-face-recognition.md)
- [Notification Module](./notification-module.md)
- [Frontend Application](./frontend.md)
- [CI/CD Pipeline](./cicd-pipeline.md)
- [Running the Application](#running-the-application)

---

## System Overview

The OCOC (One Card One Campus) platform is a **campus identity, access management, and operational governance system** built as a set of loosely-coupled microservices with an identity provider (Keycloak). The system provides a single unified digital credential for every campus stakeholder.

### Key Capabilities

- **User Management**: CRUD operations, role-based access control, RFID card management
- **Face Recognition**: Enrollment, single/mass recognition, liveness detection, attendance
- **Leave Management**: Multi-stage approval workflows, gate permission integration, balance tracking
- **Guard Console**: Camera-based face verification, leave-aware gate decisions, 2-step verification
- **Hostel Management**: RFID-based movement tracking, curfew enforcement, emergency headcount
- **Access Control**: Location-based rules, device registry, temporary grants, schedule-based policies
- **Notifications**: Email and WhatsApp delivery with templates
- **Audit Trail**: Immutable logging of all state changes
- **Dashboards**: Role-specific workspaces with configurable widgets

---

## Role-Based Dashboards

Dashboard visibility is governed by the user's effective permission set. Users can only view widgets and data for which they have the appropriate permissions. Administrators with the `dashboard.custom.manage` permission can create, customize, and share additional dashboards using a predefined widget library.

### Default Dashboard Templates

| Dashboard Template | Default Route | Default Widgets |
|--------------------|---------------|-----------------|
| **Super Administrator** | `/dashboard` | Campus Occupancy Map, Device Online/Offline Summary, Pending Approvals, Notification Statistics, Permission Audit Summary, System Health Indicators, Security Alerts |
| **Administrator** | `/access` | Zone Occupancy, Leave Approvals, Device Health, Attendance Summary, Active Security Alerts, Administrative Activities |
| **Faculty / Warden** | `/hostel` | Leave Approvals, Class Attendance, Hostel In/Out Status, Student Absence Alerts, Attendance Exceptions, Recent Student Activities |
| **Security Guard** | `/guard` | Live Gate Activity Feed, Pending Face Recognition Reviews, Campus Entry Count, Gate Access Alerts, Active Security Incidents |
| **Student** | `/dashboard` | Attendance Percentage, Active Leave/Day Pass Status, Library Loans and Due Dates, Recent RFID Access History, Notifications, Upcoming Academic Activities |
| **Librarian** | `/dashboard` | Books Issued Today, Overdue Books, Upcoming Returns, Low Availability Titles, Reservation Queue, Fine Collection Statistics |
| **Event Organizer** | `/dashboard` | Active Event Attendance, Temporary RFID Cards Issued/Returned, Venue Capacity Utilization, Visitor Entry/Exit Statistics, Outstanding Card Returns |

### Operational Roles Summary

| Role | Scope | Primary Functions |
|------|-------|-------------------|
| **Super Admin** | Campus-wide | Full unrestricted access to every module — users, onboarding, analytics, access control, hostel, guard, leave, audit, devices, RFID, face recognition |
| **Admin** | Assigned scope | Access management, device registry, leave workflow configuration, attendance summary, security alerts |
| **Warden** | Assigned hostels | Student directory, live hostel status, leave approvals, movement history, emergency headcount, curfew enforcement |
| **Guard** | Gate operations | Camera-based face verification, RFID 2-step verification, digital register, leave-aware gate monitor |
| **Student** | Personal | Identity profile, RFID card, hostel attendance status, leave application, academic activities |
| **Faculty** | Department | Identity profile, class attendance, student absence alerts, attendance exceptions |
| **Librarian** | Library | Book circulation, overdue management, reservations, fine collection |
| **Event Organizer** | Events | Event attendance, temporary RFID cards, venue capacity, visitor tracking |

### Custom Dashboard Builder

Users possessing the `dashboard.custom.manage` permission can create personalized dashboards by selecting widgets from the system's predefined widget library. The Custom Dashboard Builder supports:

- Creating multiple dashboards with names and descriptions
- Selecting and arranging widgets from the predefined library
- Resizing and repositioning widgets
- Saving, editing, and deleting dashboard layouts
- Sharing dashboards with authorized users (respects RBAC)

---

## Technology Stack

| Component | Technology |
|-----------|-----------|
| **User Management Backend** | Python 3.11+, FastAPI, PostgreSQL, Redis, Keycloak |
| **User Management Frontend** | React, Vite, Axios |
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
│                    OCOC — One Card One Campus                       │
│                                                                     │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────────┐      │
│  │   Frontend   │    │   Keycloak   │    │   PostgreSQL     │      │
│  │  (React)     │    │   (OIDC)     │    │   (ococ_users)   │      │
│  │  Port 5173   │    │   Port 8180  │    │   Port 5432/5433 │      │
│  └──────┬───────┘    └──────┬───────┘    └────────┬─────────┘      │
│         │                   │                     │                 │
│         ▼                   ▼                     ▼                 │
│  ┌──────────────────────────────────────────────────────────┐      │
│  │         User Management Backend (Python/FastAPI)          │      │
│  │              Port 8080 — All modules                      │      │
│  │  • Users  • Leave  • Access  • Hostel  • Guard  • Audit  │      │
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
uvicorn app.main:app --reload --port 8080

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
2. **Stateless Freco**: Freco has no identity knowledge — only processes vectors
3. **Keycloak for Auth**: Centralized identity management with OIDC/OAuth2
4. **pgvector for Face Search**: HNSW index for fast approximate nearest-neighbor cosine search
5. **Audit Trail**: Immutable log of all state changes
6. **RFID Integration**: WebSocket-based reader with simulation mode
7. **GPU Acceleration**: ONNX Runtime with CUDA for inference
8. **Anti-Spoofing**: Passive liveness detection (MiniFASNet) — fail closed
9. **Graceful Degradation**: Redis optional, service continues without it
10. **Role-Based Dashboards**: Each role sees only authorized widgets and data
11. **Leave-Gate Integration**: Approved leaves auto-create temporary RFID permissions for guard verification
