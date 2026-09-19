# User Management Service (Go Backend)

## Overview

The User Management service is the core backend of the OCOC platform, handling authentication, user CRUD operations, RFID card management, role-based access control, and audit logging.

**Location**: `user_management/backend/`

**Entry Point**: `cmd/api/main.go`

---

## Application Startup Flow

1. **Load environment variables** from `.env` file
2. **Connect to PostgreSQL** using `database.OpenFromEnv()` (connection pooling with configurable limits)
3. **Run database migrations** from `migrations/` folder (tracked in `schema_migrations` table)
4. **Connect to Redis** (optional - continues without it)
5. **Initialize Keycloak client** from environment variables
6. **Wire up repositories** (User, RFID, Role, Audit)
7. **Wire up services** with dependency injection
8. **Register HTTP routes** on Chi router
9. **Start HTTP server** on `0.0.0.0:8080` with graceful shutdown

---

## Database Schema

The database `ococ_users` is shared between user_management and freco. Key tables:

| Table | Purpose |
|-------|---------|
| `users` | Core user identity (id, keycloak_user_id, user_type, status, email, phone) |
| `student_profiles` | Extended profile for students |
| `faculty_profiles` | Extended profile for faculty |
| `worker_profiles` | Extended profile for workers |
| `visitor_profiles` | Extended profile for visitors |
| `rfid_cards` | RFID card registry |
| `user_rfid_cards` | User-to-card assignments |
| `roles` / `permissions` / `role_permissions` | RBAC tables |
| `user_roles` | User-role assignments |
| `audit_logs` | Immutable audit trail |
| `departments` / `hostels` | Reference data |
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
│ (Vue)   │     │ Backend (Go) │     │ (OIDC)    │
└───┬─────┘     └──────┬───────┘     └─────┬─────┘
    │                   │                   │
    │  POST /auth/login │                   │
    │  {username, pwd}  │                   │
    │──────────────────>│                   │
    │                   │  UserLogin()      │
    │                   │  (ROPC grant)     │
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
    │  GET /api/v1/     │                   │
    │  Authorization:   │                   │
    │  Bearer <token>   │                   │
    │──────────────────>│                   │
    │                   │  JWKS Verify      │
    │                   │  (OIDC provider)  │
    │                   │──────────────────>│
    │                   │                   │
    │                   │  Claims + Roles   │

---

## Authorization Model

Permission-to-role mapping:

| Permission | Roles |
|------------|-------|
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

### RFID

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| POST | `/api/v1/rfid/assign` | rfid:assign | Assign RFID card |
| POST | `/api/v1/rfid/replace` | rfid:replace | Replace RFID card |
| POST | `/api/v1/rfid/revoke` | rfid:revoke | Revoke RFID card |

### Other

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| GET | `/api/v1/dashboard/overview` | Auth | Dashboard stats |
| GET | `/api/v1/dashboard/analytics` | Auth | Time-series analytics |
| POST | `/api/v1/onboarding` | user:create | Full onboarding workflow |
| POST | `/api/v1/face-auth/log` | user:read | Log face auth event |
| GET | `/api/v1/face-auth/logs` | audit:read | List face auth logs |
| GET | `/api/v1/audit` | audit:read | Audit trail |

---

## User Creation Workflow (3-Phase)

```
Phase 1: DB Transaction
  ├─ Validate email uniqueness
  ├─ INSERT INTO users
  └─ INSERT INTO {type}_profiles

Phase 2: Keycloak Sync
  ├─ Create Keycloak user with credentials
  ├─ Set attributes (user_type, user_id)
  └─ On failure → rollback DB to deactivated

Phase 3: Update DB
  └─ Store keycloak_user_id in users table
```

---

## RFID Card Lifecycle

```
┌───────────┐    ┌───────────┐    ┌───────────┐    ┌───────────┐
│ Inactive  │───>│  Active   │───>│  Revoked  │    │  Lost     │
│ (created) │    │ (assigned)│    │           │    │  Stolen   │
└───────────┘    └───────────┘    └───────────┘    │  Replaced │
                    │         │                     └───────────┘
                    │         │                         │
                    ▼         ▼                         ▼
              Assign()   Revoke()                  Replace()
              Replace()  Deactivate()              (atomic)
```

### RFID Operations

- **Assign**: Create card → Link to user (one primary per user)
- **Replace**: Atomic - create new → revoke old → assign new
- **Revoke**: Mark card as revoked with reason
- **Sync**: User status change syncs to RFID card status

---

## Audit Logging

Every state-changing operation creates an immutable `audit_logs` entry:

- `actor_id` - Who performed the action
- `operation` - What was done (e.g., `CREATE_USER`, `ASSIGN_RFID`)
- `entity_type` / `entity_id` - What was affected
- `before_state` / `after_state` - JSONB snapshots
- `ip_address` - Source IP

---

## Environment Variables

```
# Server
SERVER_ADDR=0.0.0.0:8080
ENVIRONMENT=development

# PostgreSQL
DATABASE_URL=postgres://ococ:root@localhost:5432/ococ_users
DATABASE_MAX_OPEN_CONNS=25
DATABASE_MAX_IDLE_CONNS=10
DATABASE_CONN_MAX_LIFETIME_SECONDS=300

# Redis
REDIS_URL=redis://localhost:6379/0
REDIS_PASSWORD=
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
MAX_CSV_SIZE_MB=10
MAX_CSV_ROWS=5000
```

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

### Roles

- `SUPER_ADMIN` - Full access
- `ADMIN` - Administrative access
- `USER_MANAGER` - User management
- `SECURITY_ADMIN` - Security operations
- `VIEWER` - Read-only access
