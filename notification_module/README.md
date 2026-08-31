# Notification System

Go REST API for notifications through **Email** and **WhatsApp** only. The current code remains dependency-light for local development, while the production requirement is SMTP for Email, Meta WhatsApp Cloud API for WhatsApp, and PostgreSQL for persistence.

## Architecture

```
OCOC/Event Source
  -> API Gateway / Authentication
  -> HTTP handlers
  -> NotificationService
       -> event validation
       -> idempotency / deduplication
       -> recipient resolver
       -> template resolver
       -> preference engine
       -> dynamic channel routing
       -> template rendering
       -> DeliveryBroker (RabbitMQ boundary)
            -> email queue -> Email worker -> SMTP / SES
            -> whatsapp queue -> WhatsApp worker -> Meta WhatsApp Cloud API
       -> delivery result
            -> status repositories / PostgreSQL
            -> retry queue / DLQ
```

`NotificationService` owns orchestration and persistence. Channel implementations handle provider-specific delivery only. Local development uses `InMemoryDeliveryBroker`, which has the same publish/consume/retry/DLQ boundary expected from RabbitMQ; production should replace it with a RabbitMQ-backed `DeliveryBroker` and PostgreSQL repository implementations.

## Files

- `main.go` - HTTP server and routes
- `models.go` - API and domain models
- `validate.go` - validation and legacy request normalization
- `service.go` - orchestration, routing, retry, deduplication, rate limiting
- `queue.go` - queue/broker interface plus local in-memory email and WhatsApp queues
- `repositories.go` - repository interfaces plus current in-memory local implementations; production storage must use PostgreSQL
- `DATABASE_SCHEMA.sql` - PostgreSQL schema for recipients, templates, notifications, deliveries, attempts, and broadcasts
- `template.go` - template validation and variable substitution
- `channel.go`, `email.go`, `whatsapp.go` - provider abstractions
- `service_test.go` - unit and handler tests
- `postman_collection.json` - local Postman collection

## Run

```bash
cp .env.example .env
go run .
```

Server URL: `http://localhost:8000`

Run tests:

```bash
go test ./... -v -race
```

If your Go cache is not writable in a sandbox:

```bash
GOCACHE=/tmp/go-build go test ./... -v -race
```

Start RabbitMQ locally:

```bash
docker compose up -d rabbitmq
```

RabbitMQ management UI: `http://localhost:15672` (`guest` / `guest`).

The default build uses the in-memory broker so tests and local development work without RabbitMQ. To enable the real RabbitMQ adapter:

```bash
go get github.com/rabbitmq/amqp091-go
go run -tags rabbitmq .
```

## Configuration

`.env.example` includes:

```env
SMTP_HOST=
SMTP_PORT=587
SMTP_USERNAME=
SMTP_APP_PASSWORD=
SMTP_FROM=

DATABASE_URL=postgres://notification_user:notification_password@localhost:5432/notification_system?sslmode=disable
SERVER_ADDR=localhost:8000

WHATSAPP_PROVIDER=meta
WHATSAPP_CLOUD_API_TOKEN=
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_GRAPH_API_VERSION=v25.0
WHATSAPP_MESSAGE_TYPE=template
WHATSAPP_TEMPLATE_NAME=hello_world
WHATSAPP_TEMPLATE_LANGUAGE=en_US
WHATSAPP_TEMPLATE_INCLUDE_MESSAGE=false

# Optional local adapter settings. Use WHATSAPP_PROVIDER=http to enable these.
WHATSAPP_API_URL=
WHATSAPP_API_TOKEN=
WHATSAPP_FROM=

MAX_RETRIES=3
RETRY_DELAY_SECONDS=5
RETRY_DELAY=5
DEDUP_WINDOW_SECONDS=300
NOTIFICATION_RATE_LIMIT=100
MAX_CONCURRENCY=10
QUEUE_BUFFER_SIZE=100
NOTIFICATION_ASYNC=true

RABBITMQ_ENABLED=false
RABBITMQ_URL=amqp://guest:guest@localhost:5672/
RABBITMQ_EXCHANGE=notification.exchange
EMAIL_QUEUE=email.queue
WHATSAPP_QUEUE=whatsapp.queue
EMAIL_DLQ=email.dlq
WHATSAPP_DLQ=whatsapp.dlq
EMAIL_WORKER_CONCURRENCY=5
WHATSAPP_WORKER_CONCURRENCY=5
```

Email uses authenticated SMTP with STARTTLS. WhatsApp uses the official Meta WhatsApp Cloud API with `WHATSAPP_PROVIDER=meta`, `WHATSAPP_CLOUD_API_TOKEN`, and `WHATSAPP_PHONE_NUMBER_ID`. For Meta's sample `hello_world` template, keep `WHATSAPP_MESSAGE_TYPE=template`, `WHATSAPP_TEMPLATE_NAME=hello_world`, and `WHATSAPP_TEMPLATE_INCLUDE_MESSAGE=false`. For local development, `WHATSAPP_PROVIDER=mock` avoids external calls, and `WHATSAPP_PROVIDER=http` can still post JSON to a local adapter.

PostgreSQL is the required production persistence layer. The current repository interfaces should be backed by PostgreSQL tables for recipients, recipient channels, preferences, templates/template versions, notification events, notifications, deliveries, delivery attempts, broadcasts, broadcast channels, and broadcast recipients.

## Endpoints

- `GET /health`
- `POST /api/v1/notifications/send`
- `POST /api/v1/notifications/broadcast`
- `GET /api/v1/notifications/{id}`
- `GET /api/v1/notifications/{id}/deliveries`
- `GET /api/v1/deliveries/{id}`
- `POST /api/v1/notification-templates`
- `GET /api/v1/notification-templates`
- `GET /api/v1/notification-templates/{id}`
- `PUT /api/v1/notification-templates/{id}`
- `DELETE /api/v1/notification-templates/{id}`
- `GET /api/v1/users/{id}/notification-preferences`
- `PUT /api/v1/users/{id}/notification-preferences`

Template create/update/delete and broadcast require `X-User-Role: admin`. This is a lightweight local permission model only, not authentication.

## Send Notification

Send one notification through both email and WhatsApp:

```json
{
  "sender_id": "admin_001",
  "subject": "Meeting Reminder",
  "message": "Meeting at 10 AM.",
  "recipients": [
    {
      "user_id": "user_001",
      "email": "user@example.com",
      "phone": "+919876543210",
      "channels": ["email", "whatsapp"]
    }
  ]
}
```

Legacy `channel` + `receiver` requests are still normalized into one recipient.

Local curl example:

```bash
curl -X POST http://localhost:8000/api/v1/notifications/send \
  -H "Content-Type: application/json" \
  -d '{
    "sender_id": "admin_001",
    "subject": "Meeting Reminder",
    "message": "Meeting at 10 AM.",
    "recipients": [
      {
        "user_id": "user_001",
        "email": "user@example.com",
        "phone": "919876543210",
        "channels": ["email", "whatsapp"]
      }
    ]
  }'
```

## Templates

Create:

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

Send with template:

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

Missing variables produce a clear template validation error before any provider call.

## Routing

Final delivery channels are the intersection of:

- template/event allowed channels
- sender/requested channels
- recipient channels/preferences
- available recipient contact info

Only `email` and `whatsapp` are supported. SMS, in-app, push, Telegram, Slack, and other channels are intentionally not implemented.

## Tracking, Retry, Deduplication, Rate Limiting

Delivery statuses include `pending`, `queued`, `sending`, `sent`, `delivered`, `retrying`, and `failed`. Local providers mark accepted sends as `sent`; `delivered` is reserved for future real provider callbacks.

Provider failures retry with exponential backoff using `MAX_RETRIES` and `RETRY_DELAY` or `RETRY_DELAY_SECONDS`. Each provider attempt is persisted. Exhausted deliveries are marked `failed` and published to the broker DLQ. Validation/template errors are rejected before delivery and are not retried.

By default the API returns `202 Accepted` after deliveries are queued; clients can poll notification and delivery tracking endpoints for final status. `NOTIFICATION_ASYNC=false` is retained for service-level tests and local compatibility.

RabbitMQ topology:

- Exchange: `notification.exchange` topic exchange
- Routing keys: `notification.email`, `notification.whatsapp`
- Queues: `email.queue`, `whatsapp.queue`
- DLQs: `email.dlq`, `whatsapp.dlq`

`event_id` or `idempotency_key` enables deduplication for `DEDUP_WINDOW_SECONDS`; duplicates return the existing notification id without sending again. Production deduplication must be backed by PostgreSQL and/or Redis rather than process memory.

`NOTIFICATION_RATE_LIMIT` provides a simple per-process local rate limit. It is not distributed.

## Postman

Import `postman_collection.json`, set `base_url`, `email`, and `phone`, then run the requests. The collection covers health, send, broadcast, template CRUD, tracking, preferences, duplicate event, authorization, and validation scenarios.

## Known Limitations

- In-memory data resets on restart until PostgreSQL repositories are wired in.
- No real authentication; `X-User-Role` is local-dev authorization only.
- RabbitMQ support is implemented behind the `rabbitmq` build tag; the default build uses the in-memory broker for dependency-light local development.
- No distributed lock or production rate limiter.
- WhatsApp mock/http adapters are for local testing and adapter development; production WhatsApp delivery should use `WHATSAPP_PROVIDER=meta`.
