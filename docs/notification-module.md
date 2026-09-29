# Notification Module (Go)

## Overview

The Notification Module handles sending notifications through **Email** (SMTP) and **WhatsApp** (Meta Cloud API) channels. It supports templates, deduplication, rate limiting, and retry with exponential backoff.

**Location**: `notification_module/`

**Entry Point**: `main.go`

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                Notification Service                          │
│                                                             │
│  ┌──────────┐  ┌──────────┐  ┌────────────────────────┐   │
│  │ Email    │  │ WhatsApp │  │ Templates              │   │
│  │ Channel  │  │ Channel  │  │ (variable substitution)│   │
│  │ (SMTP)   │  │ (Meta API)│  │                        │   │
│  └──────────┘  └──────────┘  └────────────────────────┘   │
│                    │                                        │
│                    ▼                                        │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ NotificationService                                  │   │
│  │ • Validation • Deduplication • Rate Limiting        │   │
│  │ • Template Resolution • Channel Routing             │   │
│  │ • Retry with Exponential Backoff                    │   │
│  └─────────────────────────────────────────────────────┘   │
│                    │                                        │
│                    ▼                                        │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ DeliveryBroker                                       │   │
│  │ • InMemory (dev) • RabbitMQ (prod)                  │   │
│  │ • Queues: email.queue, whatsapp.queue               │   │
│  │ • DLQs: email.dlq, whatsapp.dlq                    │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## Features

- **Channels**: Email (SMTP), WhatsApp (Meta Cloud API)
- **Templates**: Variable substitution with `{{variable}}` syntax
- **Deduplication**: `event_id` or `idempotency_key` with time window
- **Retry**: Configurable max retries with exponential backoff
- **Status Tracking**: pending → queued → sending → sent → delivered/failed
- **Rate Limiting**: Per-process local rate limiter
- **Broadcast**: Send to multiple recipients with filtering

---

## Delivery Status Flow

```
┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐
│ pending │───>│ queued  │───>│ sending │───>│  sent   │
└─────────┘    └─────────┘    └─────────┘    └────┬────┘
                                                  │
                                                  ▼
                                            ┌───────────┐
                                            │ delivered │
                                            └───────────┘

On Failure:
┌─────────┐    ┌─────────┐    ┌─────────┐
│ sending │───>│retrying │───>│ failed  │───> DLQ
└─────────┘    └─────────┘    └─────────┘
```

---

## Channel Routing

Final delivery channels are the intersection of:

- Template/event allowed channels
- Sender/requested channels
- Recipient channels/preferences

---

## Request Format

### Send Notification

```json
{
  "sender_id": "admin_001",
  "template_id": "leave_approved",
  "event_type": "leave.approved",
  "event_id": "leave-approval-12345",
  "variables": {
    "parent_name": "Parent Name",
    "student_name": "Student Name",
    "from_date": "2026-08-20",
    "to_date": "2026-08-22"
  },
  "recipients": [
    {
      "user_id": "student_001",
      "email": "parent@example.com",
      "phone": "+919876543210",
      "channels": ["email", "whatsapp"]
    }
  ]
}
```

### Create Template

```json
{
  "id": "leave_approved",
  "name": "Leave Approved",
  "event_type": "leave.approved",
  "subject": "Leave Approved",
  "body": "Dear {{parent_name}},\n\n{{student_name}}'s leave has been approved from {{from_date}} to {{to_date}}.",
  "allowed_channels": ["email", "whatsapp"],
  "enabled": true
}
```

---

## RabbitMQ Topology (Production)

```
Exchange: notification.exchange (topic)
├── Routing Key: notification.email → email.queue → email.dlq
└── Routing Key: notification.whatsapp → whatsapp.queue → whatsapp.dlq
```

---

## Environment Variables

```
# Server
SERVER_ADDR=localhost:8000

# Database
DATABASE_URL=postgres://notification_user:notification_password@localhost:5432/notification_system

# SMTP (Email)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=...
SMTP_APP_PASSWORD=...
SMTP_FROM=...

# WhatsApp (Meta Cloud API)
WHATSAPP_PROVIDER=meta
WHATSAPP_CLOUD_API_TOKEN=...
WHATSAPP_PHONE_NUMBER_ID=...
WHATSAPP_GRAPH_API_VERSION=v25.0
WHATSAPP_MESSAGE_TYPE=template
WHATSAPP_TEMPLATE_NAME=hello_world
WHATSAPP_TEMPLATE_LANGUAGE=en_US

# Retry
MAX_RETRIES=3
RETRY_DELAY_SECONDS=5

# Deduplication
DEDUP_WINDOW_SECONDS=3600

# Rate Limiting
NOTIFICATION_RATE_LIMIT=100

# Queue
QUEUE_BUFFER_SIZE=100
RABBITMQ_ENABLED=false
```

---

## Running the Service

```bash
# Run with in-memory broker (default)
cd notification_module
go run .

# Run with RabbitMQ
go run -tags rabbitmq .

# Run tests
go test ./... -v -race
```

---

## Known Limitations

- In-memory data resets on restart until PostgreSQL repositories are wired in
- No real authentication; `X-User-Role` is local-dev authorization only
- RabbitMQ support is implemented behind the `rabbitmq` build tag
- WhatsApp mock/http adapters are for local testing only

- Available recipient contact info

Only `email` and `whatsapp` are supported. SMS, in-app, push, Telegram, Slack, and other channels are intentionally not implemented.

---

## Leave Management Notification Templates

The following templates are used by the Leave Management module. Leave notifications are written to the `leave_notifications` outbox table for the notification worker to consume.

| Template ID | Event Type | Subject | Recipients |
|------------|-----------|---------|------------|
| `leave_submitted` | `leave.submitted` | Leave Request Submitted for Approval | Approver(s) at first workflow stage |
| `leave_approved` | `leave.approved` | Leave Request Approved | Student, parent (if configured) |
| `leave_rejected` | `leave.rejected` | Leave Request Rejected | Student |
| `leave_expired` | `leave.expired` | Leave Period Has Expired | Student, assigned warden |
| `leave_return_confirmed` | `leave.return` | Student Return Confirmed | Assigned warden |

### Leave Approved Template Example

```json
{
  "id": "leave_approved",
  "name": "Leave Approved",
  "event_type": "leave.approved",
  "subject": "Leave Approved — {{student_name}}",
  "body": "Dear {{parent_name}},\n\n{{student_name}}'s leave has been approved from {{from_date}} to {{to_date}}.\n\nLeave type: {{leave_type}}\nDestination: {{destination}}\nApproved by: {{approver_name}}\n\nThe student has been granted gate exit permission for the approved period.",
  "allowed_channels": ["email", "whatsapp"],
  "enabled": true
}
```

### Integration Pattern

The Leave Management module writes notification records to `leave_notifications` as an outbox pattern:

```
Leave action (approve/reject/expire)
        │
        ▼
INSERT INTO leave_notifications
  (type, recipient_id, leave_request_id, payload, status='pending')
        │
        ▼
Notification Worker reads outbox
        │
        ▼
Resolves template + variables → sends via NotificationService
        │
        ▼
Updates leave_notifications status = 'sent' / 'failed'
```

> **Note**: Direct integration between the Leave Management module and the Notification Module HTTP API is planned but not yet implemented. Currently, leave notifications are written to the outbox table for a background worker to consume.

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |
| POST | `/api/v1/notifications/send` | Send notification |
| POST | `/api/v1/notifications/broadcast` | Broadcast to multiple recipients |
| GET | `/api/v1/notifications/{id}` | Get notification status |
| GET | `/api/v1/deliveries/{id}` | Get delivery status |
| GET | `/api/v1/notification-templates` | List templates |
| POST | `/api/v1/notification-templates` | Create template |
| GET | `/api/v1/notification-templates/{id}` | Get template |
| PUT | `/api/v1/notification-templates/{id}` | Update template |
| DELETE | `/api/v1/notification-templates/{id}` | Delete template |
| GET | `/api/v1/users/{id}/notification-preferences` | Get preferences |
| PUT | `/api/v1/users/{id}/notification-preferences` | Update preferences |
