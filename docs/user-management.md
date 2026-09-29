# User Management Service (Python/FastAPI Backend)

## Overview

The User Management service is the core backend of the OCOC platform, handling authentication, user CRUD operations, RFID card management, role-based access control, access management, hostel operations, leave management, and audit logging.

**Location**: `user_management/backend/`

**Entry Point**: `app/main.py`

---

## Application Startup Flow

1. **Load environment variables** from `.env` file
2. **Connect to PostgreSQL** using async SQLAlchemy engine
3. **Run database migrations** from `migrations/` folder
4. **Connect to Redis** (optional — continues without it)
5. **Initialize Keycloak client** from environment variables
6. **Mount routers** for all modules (users, auth, leave, access, hostel, guard, etc.)
7. **Start HTTP server** on configurable port with graceful shutdown

---

## Database Schema

The database `ococ_users` is shared between user_management and freco. Key tables:

### Core Identity Tables

| Table | Purpose |
|-------|---------|
| `users` | Core user identity (id, keycloak_user_id, user_type, status, email, phone) |
| `student_profiles` | Extended profile for students |
| `faculty_profiles` | Extended profile for faculty |
| `worker_profiles` | Extended profile for workers |
| `visitor_profiles` | Extended profile for visitors |

### RFID & Access Tables

| Table | Purpose |
|-------|---------|
| `rfid_cards` | RFID card registry |
| `user_rfid_cards` | User-to-card assignments |
| `access_rules` | Location-based access rules |
| `access_grants` | Temporary access grants |
| `access_events` | Gate entry/exit event log |
| `access_locations` | Campus locations/zones |
| `access_devices` | Gate reader devices |

### RBAC Tables

| Table | Purpose |
|-------|---------|
| `roles` | Role definitions |
| `permissions` | Permission definitions |
| `role_permissions` | Role-to-permission mappings |
| `user_roles` | User-to-role assignments |

### Leave Management Tables

| Table | Purpose |
|-------|---------|
| `leave_types` | Leave type definitions |
| `leave_requests` | Leave applications |
| `leave_workflow_snapshots` | Frozen approval chains |
| `leave_approvals` | Approval/rejection records |
| `leave_documents` | Supporting documents |
| `leave_balances` | Per-student balance tracking |
| `leave_delegations` | Approval delegations |
| `leave_rfid_permissions` | Temporary gate permissions |
| `leave_notifications` | Notification outbox |
| `leave_audit` | Leave audit trail |

### Hostel Tables

| Table | Purpose |
|-------|---------|
| `hostels` | Hostel definitions |
| `hostel_students` | Student-hostel assignments |
| `hostel_movements` | Entry/exit movement records |
| `hostel_permissions` | Leave/pass permissions |

### Audit & Face Recognition Tables

| Table | Purpose |
|-------|---------|
| `audit_logs` | Immutable audit trail |
| `departments` | Department reference data |
| `freco_people` | Face recognition persons (linked to users via external_id) |
| `freco_face_embeddings` | 512-dim ArcFace vectors with pgvector |
| `freco_attendance_sessions` | Attendance session definitions |
| `freco_attendance_records` | Individual attendance events |
| `face_auth_logs` | Face authentication event log |

---

## Authentication Flow (Keycloak OIDC)

```
┌────────┐     ┌──────────────┐     ┌───────────┐
│ Frontend│     │ User Mgmt    │     │ Keycloak  │
│ (React) │     │ Backend (Py) │     │ (OIDC)    │
└───┬─────┘     └──────┬───────┘     └─────┬─────┘
    │                   │                   │
    │  POST /auth/login │                   │
    │  {username, pwd}  │                   │
    │──────────────────>│                   │
    │                   │  Password grant   │
    │                   │──────────────────>│
    │                   │                   │
    │                   │  TokenResponse    │
    │                   │  {access, refresh}│
    │                   │<──────────────────│
    │                   │                   │
    │  {access_token,   │                   │
    │   refresh_token}  │                   │
    │<──────────────────│                   │
    │                   │                   │
    │  GET /api/v1/*    │                   │
    │  Authorization:   │                   │
    │  Bearer <token>   │                   │
    │──────────────────>│                   │
    │                   │  JWKS Verify      │
    │                   │  (OIDC provider)  │
    │                   │──────────────────>│
    │                   │                   │
    │                   │  Claims + Roles   │
    │                   │  (realm_access)   │
    │                   │                   │
    │  Protected        │                   │
    │  Response         │                   │
    │<──────────────────│                   │
```

### Keycloak Integration Details

- Uses **Resource Owner Password Credentials (ROPC)** grant for direct login
- JWT tokens validated via **OIDC JWKS endpoint** (public key verification)
- Realm roles extracted from `realm_access.roles` claim
- Token refresh via `/api/v1/auth/refresh`
- Logout revokes refresh token in Keycloak

---

## Authorization Model

### Roles

| Role | Description | Default Dashboard |
|------|-------------|-------------------|
| `SUPER_ADMIN` | Full unrestricted access to every module | `/dashboard` |
| `ADMIN` | Access management, device registry, leave workflow config | `/access` |
| `WARDEN` | Hostel management, leave approvals for assigned hostels | `/hostel` |
| `GUARD` | Guard console, RFID, face recognition, gate operations | `/guard` |
| `SECURITY_GUARD` | Same as GUARD | `/guard` |
| `SECURITY_ADMIN` | Extended security operations | `/guard` |
| `STUDENT` | Personal workspace, leave applications | `/dashboard` |
| `FACULTY` | Personal workspace, class attendance | `/dashboard` |
| `CHANCELLOR` | Leave approval authority | `/dashboard` |
| `MEDICAL_OFFICER` | Medical leave approval authority | `/dashboard` |
| `USER_MANAGER` | User CRUD operations | `/dashboard` |
| `VIEWER` | Read-only analytics access | `/analytics` |

### Permission-to-Role Mapping

| Permission | Roles |
|-----------|-------|
| `user:create` | SUPER_ADMIN, ADMIN, USER_MANAGER |
| `user:read` | SUPER_ADMIN, ADMIN, USER_MANAGER, SECURITY_ADMIN, VIEWER |
| `user:update` | SUPER_ADMIN, ADMIN, USER_MANAGER |
| `user:suspend` | SUPER_ADMIN, ADMIN |
| `user:deactivate` | SUPER_ADMIN, ADMIN |
| `user:delete` | SUPER_ADMIN, ADMIN |
| `user:import` | SUPER_ADMIN, ADMIN, USER_MANAGER |
| `user:export` | SUPER_ADMIN, ADMIN, USER_MANAGER, VIEWER |
| `rfid:assign` | SUPER_ADMIN, ADMIN, USER_MANAGER, SECURITY_ADMIN |
| `rfid:replace` | SUPER_ADMIN, ADMIN, SECURITY_ADMIN |
| `rfid:revoke` | SUPER_ADMIN, ADMIN, SECURITY_ADMIN |
| `rfid:read` | SUPER_ADMIN, ADMIN, USER_MANAGER, SECURITY_ADMIN, VIEWER |
| `role:assign` | SUPER_ADMIN, ADMIN |
| `role:manage` | SUPER_ADMIN |
| `audit:read` | SUPER_ADMIN, ADMIN, SECURITY_ADMIN, VIEWER |
| `access.rule.read` | SUPER_ADMIN, ADMIN, SECURITY_ADMIN, VIEWER, GUARD, SECURITY_GUARD |
| `access.rule.manage` | SUPER_ADMIN, ADMIN, SECURITY_ADMIN |
| `access.grant.temporary` | SUPER_ADMIN, ADMIN, SECURITY_ADMIN |
| `access.grant.manage` | SUPER_ADMIN, ADMIN |
| `access.user.search` | SUPER_ADMIN, ADMIN, SECURITY_ADMIN |
| `access.user.detail` | SUPER_ADMIN, ADMIN, SECURITY_ADMIN |
| `access.audit.read` | SUPER_ADMIN, ADMIN, SECURITY_ADMIN |
| `access.occupancy.view` | SUPER_ADMIN, ADMIN, SECURITY_ADMIN, VIEWER |
| `gate.review.manual` | SUPER_ADMIN, ADMIN, SECURITY_ADMIN, GUARD, SECURITY_GUARD |
| `guard.console.read` | SUPER_ADMIN, ADMIN, SECURITY_ADMIN, GUARD, SECURITY_GUARD |
| `leave.request.submit` | SUPER_ADMIN, STUDENT |
| `leave.approve.warden` | SUPER_ADMIN, WARDEN |
| `leave.approve.chancellor` | SUPER_ADMIN, CHANCELLOR |
| `leave.approve.medical` | SUPER_ADMIN, MEDICAL_OFFICER |
| `leave.delegate` | SUPER_ADMIN, WARDEN, CHANCELLOR, MEDICAL_OFFICER |
| `leave.workflow.manage` | SUPER_ADMIN |
| `leave.balance.manage` | SUPER_ADMIN, ADMIN |
| `leave.audit.view` | SUPER_ADMIN, ADMIN, SECURITY_ADMIN |

---

## API Endpoints

### Authentication

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| POST | `/api/v1/auth/login` | Public | Keycloak login |
| POST | `/api/v1/auth/logout` | Auth | Revoke tokens |
| POST | `/api/v1/auth/refresh` | Public | Refresh tokens |
| POST | `/api/v1/auth/forgot-password` | Public | Send OTP email |
| POST | `/api/v1/auth/verify-otp` | Public | Verify OTP |
| POST | `/api/v1/auth/reset-password` | Public | Reset with token |

### Users

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| GET | `/api/v1/users` | user:read | List users (paginated, filterable) |
| POST | `/api/v1/users` | user:create | Create user + Keycloak sync |
| GET | `/api/v1/users/:id` | user:read | Get user details |
| PUT | `/api/v1/users/:id` | user:update | Update user |
| DELETE | `/api/v1/users/:id` | user:delete | Deactivate user |
| POST | `/api/v1/users/import` | user:import | CSV bulk import |
| GET | `/api/v1/users/export` | user:export | CSV export |
| GET | `/api/v1/users/me/profile` | Auth | Get own profile |

### RFID

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| POST | `/api/v1/rfid/assign` | rfid:assign | Assign RFID card |
| POST | `/api/v1/rfid/replace` | rfid:replace | Replace RFID card |
| POST | `/api/v1/rfid/revoke` | rfid:revoke | Revoke RFID card |

### Leave Management

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| GET | `/api/v1/leave/types` | Auth | List leave types |
| POST | `/api/v1/leave/types` | leave.workflow.manage | Create leave type |
| PUT | `/api/v1/leave/types/:id/workflow` | leave.workflow.manage | Configure workflow |
| POST | `/api/v1/leave/requests` | leave.request.submit | Create leave request |
| GET | `/api/v1/leave/requests` | Auth | List own/scoped requests |
| POST | `/api/v1/leave/requests/:id/approve` | Stage permission | Approve request |
| POST | `/api/v1/leave/requests/:id/reject` | Stage permission | Reject request |
| GET | `/api/v1/leave/approvals/pending` | Approval role | Pending approval queue |
| GET | `/api/v1/leave/balances/me` | Auth | Own leave balances |

### Access Control

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| GET | `/api/v1/access/locations` | access.rule.read | List locations |
| GET | `/api/v1/access/rules` | access.rule.read | List access rules |
| POST | `/api/v1/access/rules` | access.rule.manage | Create access rule |
| GET | `/api/v1/access/grants` | access.grant.manage | List grants |
| POST | `/api/v1/access/grants` | access.grant.temporary | Create temporary grant |
| GET | `/api/v1/access/events` | guard.console.read | List gate events |
| POST | `/api/v1/access/verify-face` | gate.review.manual | Complete 2-SV verification |
| GET | `/api/v1/access/guard/hostel-leaves` | guard.console.read | Guard student leave data |

### Hostel Management

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| GET | `/api/v1/hostel/assigned-hostels` | Auth | List warden's hostels |
| GET | `/api/v1/hostel/students` | Auth | List hostel students |
| GET | `/api/v1/hostel/live-status` | Auth | Live student status |
| GET | `/api/v1/hostel/movements` | Auth | Movement history |
| POST | `/api/v1/hostel/permissions` | Auth | Grant leave/permission |

### Dashboard & Other

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| GET | `/api/v1/dashboard/overview` | Auth | Dashboard stats |
| GET | `/api/v1/dashboard/analytics` | Auth | Time-series analytics |
| POST | `/api/v1/onboarding` | user:create | Full onboarding workflow |
| POST | `/api/v1/face-auth/log` | user:read | Log face auth event |
| GET | `/api/v1/face-auth/logs` | audit:read | List face auth logs |
| GET | `/api/v1/audit` | audit:read | Audit trail |
| WS | `/api/v1/ws/stream` | Auth | WebSocket event stream |

---

## Audit Logging

Every state-changing operation creates an immutable `audit_logs` entry:

- `actor_id` — Who performed the action
- `operation` — What was done (e.g., `CREATE_USER`, `ASSIGN_RFID`, `LEAVE_APPROVED`)
- `entity_type` / `entity_id` — What was affected
- `before_state` / `after_state` — JSONB snapshots
- `ip_address` — Source IP

### Audited Operations

| Module | Operations |
|--------|-----------|
| User | CREATE_USER, UPDATE_USER, SUSPEND_USER, ACTIVATE_USER, DELETE_USER |
| Onboarding | ONBOARDING_STARTED, RFID_ENROLLED, CARD_ISSUED |
| RFID | ASSIGN_RFID, REPLACE_RFID, REVOKE_RFID |
| FaceAuth | FACE_AUTH_SUCCESS, FACE_AUTH_FAILED, FACE_AUTH_LIVENESS_FAILED |
| Registration | PUBLIC_REGISTRATION |
| Leave | LEAVE_SUBMITTED, LEAVE_APPROVED, LEAVE_REJECTED, LEAVE_WITHDRAWN, LEAVE_EXPIRED |
| Access | ACCESS_GRANTED, ACCESS_DENIED, RULE_CREATED, GRANT_CREATED |

---

## Environment Variables

```
# Server
SERVER_ADDR=0.0.0.0:8080
ENVIRONMENT=development

# PostgreSQL
DATABASE_URL=postgres://ococ:root@localhost:5432/ococ_users

# Redis
REDIS_URL=redis://localhost:6379/0
OTP_TTL_SECONDS=600

# Keycloak
KEYCLOAK_URL=http://localhost:8180
KEYCLOAK_REALM=ococ
KEYCLOAK_CLIENT_ID=user-management
KEYCLOAK_CLIENT_SECRET=...
KEYCLOAK_ADMIN_USER=admin
KEYCLOAK_ADMIN_PASSWORD=admin

# SMTP (for OTP emails)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=...
SMTP_PASSWORD=...
SMTP_FROM=...

# RFID Reader
RFID_READER_URL=ws://localhost:9001/rfid
RFID_READER_SIMULATE=true

# CORS
CORS_ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000

# Upload
PHOTO_UPLOAD_DIR=./uploads/photos
MAX_UPLOAD_SIZE_MB=5
```
