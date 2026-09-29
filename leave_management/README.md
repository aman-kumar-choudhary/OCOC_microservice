# OCOC Leave Management

Leave Management is a feature module of User Management. Its backend is kept in
`user_management/backend/app/routers/leave.py` and is mounted by the existing
FastAPI application at `/api/v1/leave`; it therefore starts and stops with the
User Management backend and shares its PostgreSQL pool, Keycloak JWT validation,
role authorization, and RFID decision service. The React screen is
`user_management/frontend/src/views/LeaveManagement.jsx` and is available at
`/leave` in the authenticated User Management frontend.

## API

The API uses the User Management bearer token and its `{success,data,message}`
response envelope. OpenAPI details are available at `/docs` under
`leave_management`.

| Method | Path | Access |
| --- | --- | --- |
| GET | `/api/v1/leave/types` | Authenticated |
| POST | `/api/v1/leave/types` | `leave.workflow.manage` |
| PATCH | `/api/v1/leave/types/{type_id}` | `leave.workflow.manage` |
| PUT | `/api/v1/leave/types/{type_id}/workflow` | `leave.workflow.manage` |
| POST / PUT | `/api/v1/leave/requests[/{request_id}]` | `leave.request.submit` |
| GET | `/api/v1/leave/requests` | Own requests or role-scoped approver history |
| GET | `/api/v1/leave/requests/{request_id}` | Owner, assigned stage approver, or leave admin |
| POST | `/api/v1/leave/requests/{request_id}/submit` | `leave.request.submit` |
| POST | `/api/v1/leave/requests/{request_id}/withdraw` | Owner before decision completion |
| GET | `/api/v1/leave/approvals/pending` | Effective approval role |
| POST | `/api/v1/leave/requests/{request_id}/approve` | Current stage permission |
| POST | `/api/v1/leave/requests/{request_id}/reject` | Current stage permission; comment required |
| POST / GET | `/api/v1/leave/requests/{request_id}/documents` | Owner or assigned approver |
| PUT / GET | `/api/v1/leave/balances`, `/api/v1/leave/balances/me` | `leave.balance.manage` / Authenticated |
| POST | `/api/v1/leave/delegations` | `leave.delegate` |
| GET | `/api/v1/leave/audit` | `leave.audit.view` |
| POST | `/api/v1/leave/rfid/return/{card_uid}` | `gate.review.manual` |

Migration `021_leave_management.sql` creates request, type, workflow snapshot,
approval, document, balance, delegation, RFID, notification outbox, and immutable
audit tables. It seeds Day Pass, Multi-Day, Emergency, Medical, and Custom leave
types. Configured workflows store permissions rather than approver user IDs.

## Permission mapping

The existing Keycloak realm roles map to leave permissions in
`user_management/backend/app/core/security.py`: STUDENT, WARDEN, CHANCELLOR,
MEDICAL_OFFICER, ADMIN, and SUPER_ADMIN. Matching permission records and role
permission links are seeded into the existing RBAC tables. Deployments should
assign these realm roles to Keycloak users as needed.

## Current integration boundaries

Leave notifications are written to `leave_notifications` as an in-app/outbox
record for the notification worker to consume. Approved requests create a
temporary leave RFID permission; the existing access decision path honors that
permission for campus exits during its approved interval. The one-minute worker
expires past-end requests, revokes permissions, and writes audit/notification
records. RFID return scans should call the return endpoint from a trusted gate
integration using a role token; hardware credentials/mTLS are not configured by
the current OCOC platform.

The leave balance administration and display APIs are present. Academic-period
policy (period naming, duration calculation, and deductions) remains an
institution-specific configuration decision and is not guessed by this module.
