# Leave Management System

## Overview

Leave Management is a feature module of User Management. Its backend is implemented in `user_management/backend/app/routers/leave.py` and is mounted by the existing FastAPI application at `/api/v1/leave`. It starts and stops with the User Management backend and shares its PostgreSQL pool, Keycloak JWT validation, role authorization, and RFID decision service.

The React frontend screen is `user_management/frontend/src/views/LeaveManagement.jsx` and is accessible at `/leave` in the authenticated frontend.

**Location**: `user_management/backend/app/routers/leave.py`

---

## Architecture

```
┌────────────────────────────────────────────────────────────────────┐
│                    Leave Management Flow                           │
│                                                                    │
│  ┌──────────┐    ┌──────────────┐    ┌──────────────────────┐     │
│  │ Student  │    │  Warden /    │    │   Guard Console      │     │
│  │ Dashboard│    │  Chancellor  │    │   (Gate Decision)    │     │
│  └────┬─────┘    └──────┬───────┘    └──────────┬───────────┘     │
│       │                 │                       │                  │
│       ▼                 ▼                       ▼                  │
│  ┌─────────┐     ┌──────────┐     ┌────────────────────────┐     │
│  │ Submit  │────▶│ Approve /│────▶│ RFID Gate Permission   │     │
│  │ Request │     │ Reject   │     │ (auto-created on       │     │
│  └─────────┘     └──────────┘     │  approval)             │     │
│       │                │          └────────────────────────┘     │
│       ▼                ▼                       │                  │
│  ┌──────────────────────────────────────────────┐                 │
│  │     PostgreSQL (leave_requests, leave_rfid,   │                 │
│  │     leave_approvals, leave_notifications)     │                 │
│  └──────────────────────────────────────────────┘                 │
└────────────────────────────────────────────────────────────────────┘
```

---

## Leave Types

The system seeds five default leave types on migration:

| Leave Type | Description | Typical Workflow |
|-----------|-------------|------------------|
| **Day Pass** | Short-duration (same-day) leave | Warden approval |
| **Multi-Day** | Multi-day campus leave | Warden → Chancellor approval |
| **Emergency** | Urgent unplanned leave | Warden approval (expedited) |
| **Medical** | Health-related leave | Medical Officer → Warden approval |
| **Custom** | Institution-defined types | Configurable workflow |

---

## Approval Workflow

Leave types support **multi-stage configurable approval workflows**. Each stage is defined by a permission string (e.g., `leave.approve.warden`). When a leave request is submitted, the system creates a workflow snapshot that locks the approval chain for that request.

```
Student submits leave request
        │
        ▼
┌──────────────────┐
│ Stage 1: Warden  │  (permission: leave.approve.warden)
│ Approve / Reject │
└────────┬─────────┘
         │ (if approved)
         ▼
┌──────────────────┐
│ Stage 2: Dean /  │  (permission: leave.approve.chancellor)
│ Chancellor       │
└────────┬─────────┘
         │ (if approved)
         ▼
┌──────────────────┐
│ APPROVED         │
│ • RFID gate perm │
│ • Notification   │
│ • Guard visible  │
└──────────────────┘
```

### Workflow Configuration

Super Admins can configure the approval workflow per leave type via the frontend or API:

```
PUT /api/v1/leave/types/{type_id}/workflow
Body: { "workflow": ["leave.approve.warden", "leave.approve.chancellor"] }
```

Existing requests retain their snapshot workflow. Only new requests use the updated configuration.

---

## Permission Mapping

| Permission | Roles | Description |
|-----------|-------|-------------|
| `leave.request.submit` | SUPER_ADMIN, STUDENT | Submit and manage own leave requests |
| `leave.approve.warden` | SUPER_ADMIN, WARDEN | Approve/reject leave at warden stage |
| `leave.approve.chancellor` | SUPER_ADMIN, CHANCELLOR | Approve/reject leave at chancellor stage |
| `leave.approve.medical` | SUPER_ADMIN, MEDICAL_OFFICER | Approve/reject medical leave |
| `leave.delegate` | SUPER_ADMIN, WARDEN, CHANCELLOR, MEDICAL_OFFICER | Delegate approval authority |
| `leave.workflow.manage` | SUPER_ADMIN | Configure approval workflows |
| `leave.balance.manage` | SUPER_ADMIN, ADMIN | Set/modify leave balances |
| `leave.audit.view` | SUPER_ADMIN, ADMIN, SECURITY_ADMIN | View leave audit trail |
| `gate.review.manual` | SUPER_ADMIN, ADMIN, SECURITY_ADMIN, GUARD, SECURITY_GUARD | Manual gate review for RFID return |

---

## API Endpoints

| Method | Path | Access | Description |
|--------|------|--------|-------------|
| GET | `/api/v1/leave/types` | Authenticated | List available leave types |
| POST | `/api/v1/leave/types` | `leave.workflow.manage` | Create a new leave type |
| PATCH | `/api/v1/leave/types/{type_id}` | `leave.workflow.manage` | Update leave type details |
| PUT | `/api/v1/leave/types/{type_id}/workflow` | `leave.workflow.manage` | Configure approval workflow |
| POST | `/api/v1/leave/requests` | `leave.request.submit` | Create leave request (draft or submit) |
| PUT | `/api/v1/leave/requests/{request_id}` | `leave.request.submit` | Update draft leave request |
| GET | `/api/v1/leave/requests` | Authenticated | List own requests or role-scoped approver history |
| GET | `/api/v1/leave/requests/{request_id}` | Owner / Approver / Admin | Get leave request details |
| POST | `/api/v1/leave/requests/{request_id}/submit` | `leave.request.submit` | Submit a draft request |
| POST | `/api/v1/leave/requests/{request_id}/withdraw` | Owner | Withdraw before decision |
| GET | `/api/v1/leave/approvals/pending` | Effective approval role | List pending approval queue |
| POST | `/api/v1/leave/requests/{request_id}/approve` | Current stage permission | Approve request |
| POST | `/api/v1/leave/requests/{request_id}/reject` | Current stage permission | Reject request (comment required) |
| POST | `/api/v1/leave/requests/{request_id}/documents` | Owner / Approver | Upload supporting documents |
| GET | `/api/v1/leave/requests/{request_id}/documents` | Owner / Approver | List attached documents |
| GET | `/api/v1/leave/balances/me` | Authenticated | View own leave balances |
| PUT | `/api/v1/leave/balances` | `leave.balance.manage` | Set leave balances |
| GET | `/api/v1/leave/balances` | `leave.balance.manage` | List all balances |
| POST | `/api/v1/leave/delegations` | `leave.delegate` | Delegate approval authority |
| GET | `/api/v1/leave/audit` | `leave.audit.view` | View leave audit trail |
| POST | `/api/v1/leave/rfid/return/{card_uid}` | `gate.review.manual` | Mark RFID return at gate |

---

## Database Schema

Migration `021_leave_management.sql` creates the following tables:

| Table | Purpose |
|-------|---------|
| `leave_types` | Leave type definitions (Day Pass, Multi-Day, etc.) |
| `leave_requests` | Individual leave applications with status tracking |
| `leave_workflow_snapshots` | Frozen workflow chain at time of submission |
| `leave_approvals` | Approval/rejection records per workflow stage |
| `leave_documents` | Uploaded supporting documents |
| `leave_balances` | Per-student, per-type, per-period balance tracking |
| `leave_delegations` | Approval authority delegations |
| `leave_rfid_permissions` | Temporary RFID gate permissions created on approval |
| `leave_notifications` | Outbox records for notification worker |
| `leave_audit` | Immutable audit trail for all leave operations |

### Leave Request Status Flow

```
┌───────┐    ┌──────────────────┐    ┌──────────┐    ┌───────────┐
│ DRAFT │───▶│ PENDING_APPROVAL │───▶│ APPROVED │───▶│ COMPLETED │
└───────┘    └──────────────────┘    └──────────┘    └───────────┘
                     │                     │
                     ▼                     ▼
               ┌──────────┐         ┌──────────┐
               │ REJECTED │         │ EXPIRED  │
               └──────────┘         └──────────┘
                     │
                     ▼
               ┌───────────┐
               │ WITHDRAWN │
               └───────────┘
```

---

## Guard Integration

When a leave request is fully approved:

1. A **temporary RFID permission** is created in `leave_rfid_permissions` for the approved date range
2. The permission is honored by the existing access decision path for campus gate exits
3. The approved leave details appear on the **Guard Console** (`/guard`) in the "Gate Movement and Leave Monitor" table
4. Guards see: student name, leave type, approved dates, approver name, and gate status
5. The **one-minute background worker** expires past-end requests, revokes permissions, and writes audit/notification records

### Guard Console Leave Display

The guard sees each student's leave status with:
- **Permission type** (Day Pass, Multi-Day, etc.)
- **Valid period** (start time – end time)
- **Permission reason** (leave reason from the student's application)
- **Approved by** (name of the approving authority)
- **Current gate status** (INSIDE, OUTSIDE, ON_LEAVE, UNAUTHORIZED, LATE_RETURN)

---

## Notification Integration

Leave notifications are written to `leave_notifications` as an in-app/outbox record for the notification worker to consume. Key notification events:

| Event | Template | Recipients |
|-------|----------|------------|
| Leave submitted | `leave_submitted` | Approver(s) at first stage |
| Leave approved | `leave_approved` | Student, parent (if configured) |
| Leave rejected | `leave_rejected` | Student |
| Leave expired | `leave_expired` | Student, warden |
| Student returned | `leave_return_confirmed` | Warden |

---

## Balance System

The leave balance API tracks per-student, per-leave-type consumption against configured allowances:

```
Remaining = allowed_days - consumed_days
```

Academic-period policy (period naming, duration calculation, and deductions) remains an institution-specific configuration decision.

---

## Current Integration Boundaries

- RFID return scans should call the return endpoint from a trusted gate integration using a role token
- Hardware credentials/mTLS are not configured by the current OCOC platform
- The leave balance administration and display APIs are present
- Camera-based face verification on the guard console cross-references the student's leave dates for pass/deny recommendations
