# Notification System API

Base URL: `http://localhost:8000`

Local-development data is currently stored in memory and resets on restart. The production requirement is PostgreSQL persistence, RabbitMQ queues, SMTP/SES email delivery, and official Meta WhatsApp Cloud API delivery.

For live WhatsApp template tests with Meta's sample template, configure `WHATSAPP_PROVIDER=meta`, `WHATSAPP_MESSAGE_TYPE=template`, `WHATSAPP_TEMPLATE_NAME=hello_world`, `WHATSAPP_TEMPLATE_LANGUAGE=en_US`, and `WHATSAPP_TEMPLATE_INCLUDE_MESSAGE=false`.

## Auth

Most endpoints are open for local testing. These actions require:

```http
X-User-Role: admin
```

- `POST /api/v1/notifications/broadcast`
- `POST /api/v1/notification-templates`
- `PUT /api/v1/notification-templates/{id}`
- `DELETE /api/v1/notification-templates/{id}`

## Health

`GET /health`

```json
{ "status": "ok" }
```

## Send Notification

`POST /api/v1/notifications/send`

```json
{
  "sender_id": "admin_001",
  "subject": "Meeting Reminder",
  "message": "Meeting at 10 AM.",
  "event_id": "optional-dedup-key",
  "recipients": [
    {
      "user_id": "user_001",
      "email": "user@example.com",
      "phone": "919876543210",
      "channels": ["email", "whatsapp"]
    }
  ]
}
```

Template-based:

```json
{
  "sender_id": "admin_001",
  "template_id": "leave_approved",
  "event_type": "leave.approved",
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

Legacy shape is still accepted:

```json
{
  "sender_id": "user_001",
  "channel": "email",
  "receiver": "person@example.com",
  "subject": "Test",
  "message": "Hello"
}
```

## Broadcast

`POST /api/v1/notifications/broadcast`

Requires `X-User-Role: admin`.

```json
{
  "sender_id": "admin_001",
  "message": "Campus will remain closed tomorrow.",
  "channels": ["email", "whatsapp"],
  "recipients": [
    { "user_id": "student_001", "email": "student1@example.com", "phone": "919876543210" },
    { "user_id": "student_002", "email": "student2@example.com", "phone": "919876543211" }
  ]
}
```

## Send Response

Asynchronous success returns `202 Accepted`:

```json
{
  "success": true,
  "notification_id": "NTF-001",
  "message": "Notification queued for processing",
  "status": "queued",
  "total_recipients": 1,
  "total_deliveries": 2,
  "successful_deliveries": 0,
  "failed_deliveries": 0,
  "results": [
    {
      "delivery_id": "DEL-001",
      "notification_id": "NTF-001",
      "user_id": "user_001",
      "channel": "email",
      "provider": "smtp",
      "receiver": "user@example.com",
      "status": "queued",
      "attempt_count": 0
    }
  ]
}
```

## Tracking

- `GET /api/v1/notifications/{id}`
- `GET /api/v1/notifications/{id}/deliveries`
- `GET /api/v1/deliveries/{id}`

Delivery lifecycle values: `pending`, `queued`, `sending`, `sent`, `delivered`, `retrying`, `failed`.

## Templates

- `POST /api/v1/notification-templates`
- `GET /api/v1/notification-templates`
- `GET /api/v1/notification-templates/{id}`
- `PUT /api/v1/notification-templates/{id}`
- `DELETE /api/v1/notification-templates/{id}`

Create/update body:

```json
{
  "id": "leave_approved",
  "name": "Leave Approved",
  "event_type": "leave.approved",
  "subject": "Leave Approved",
  "body": "Dear {{parent_name}}, {{student_name}} leave approved.",
  "allowed_channels": ["email", "whatsapp"],
  "enabled": true
}
```

## Preferences

- `GET /api/v1/users/{id}/notification-preferences`
- `PUT /api/v1/users/{id}/notification-preferences`

```json
{
  "email_enabled": true,
  "whatsapp_enabled": false
}
```

Missing preferences default to both channels enabled.

## Error Statuses

- `400` invalid request or template variable error
- `403` missing local admin permission
- `404` notification/template/delivery not found
- `409` duplicate event/idempotency key
- `429` rate limit exceeded
- `500` internal/provider failure

Error response:

```json
{
  "success": false,
  "message": "Failed to send notification",
  "error": "missing template variable \"parent_name\""
}
```

## Provider Notes

Email uses authenticated SMTP with STARTTLS:

- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USERNAME`
- `SMTP_APP_PASSWORD`
- `SMTP_FROM`

WhatsApp supports the official Meta WhatsApp Cloud API:

- `WHATSAPP_PROVIDER=meta`
- `WHATSAPP_CLOUD_API_TOKEN`
- `WHATSAPP_PHONE_NUMBER_ID`
- `WHATSAPP_GRAPH_API_VERSION`

For local tests, `WHATSAPP_PROVIDER=mock` avoids external calls. `WHATSAPP_PROVIDER=http` posts simple JSON to `WHATSAPP_API_URL` for adapter development.

Production persistence must use PostgreSQL through `DATABASE_URL`.

## Queue Processing

The service publishes delivery messages to channel-specific queues:

- `email` -> Email worker -> SMTP / SES
- `whatsapp` -> WhatsApp worker -> Meta WhatsApp Cloud API

RabbitMQ topology:

- Exchange: `notification.exchange` topic exchange
- Routing keys: `notification.email`, `notification.whatsapp`
- Queues: `email.queue`, `whatsapp.queue`
- DLQs: `email.dlq`, `whatsapp.dlq`

Local development uses an in-memory broker with retry and DLQ hooks unless RabbitMQ is enabled. To run RabbitMQ locally:

```bash
docker compose up -d rabbitmq
go get github.com/rabbitmq/amqp091-go
RABBITMQ_ENABLED=true go run -tags rabbitmq .
```

By default, `POST /api/v1/notifications/send` returns `202 Accepted` as soon as deliveries are queued. Set `NOTIFICATION_ASYNC=false` only for local compatibility scenarios that need synchronous service results.

Workers ACK only after provider processing and delivery status persistence. Temporary failures are retried up to `MAX_RETRIES` with `RETRY_DELAY` or `RETRY_DELAY_SECONDS`; exhausted messages are marked `failed` and moved to the DLQ.
