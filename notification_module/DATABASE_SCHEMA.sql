CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS recipients (
    id TEXT PRIMARY KEY,
    external_user_id TEXT NOT NULL UNIQUE,
    recipient_type TEXT NOT NULL CHECK (recipient_type IN ('student', 'parent', 'admin', 'staff', 'other')),
    name TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS recipient_channels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipient_id TEXT NOT NULL REFERENCES recipients(id) ON DELETE CASCADE,
    channel TEXT NOT NULL CHECK (channel IN ('email', 'whatsapp')),
    destination TEXT NOT NULL,
    verified BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (recipient_id, channel, destination)
);

CREATE TABLE IF NOT EXISTS notification_preferences (
    recipient_id TEXT PRIMARY KEY REFERENCES recipients(id) ON DELETE CASCADE,
    email_enabled BOOLEAN NOT NULL DEFAULT true,
    whatsapp_enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS templates (
    id TEXT PRIMARY KEY,
    template_key TEXT NOT NULL UNIQUE,
    event_type TEXT NOT NULL,
    name TEXT NOT NULL,
    subject TEXT,
    body TEXT NOT NULL DEFAULT '',
    allowed_channels TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS template_versions (
    id TEXT PRIMARY KEY,
    template_id TEXT NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
    channel TEXT NOT NULL CHECK (channel IN ('email', 'whatsapp')),
    version INT NOT NULL,
    subject TEXT,
    body TEXT NOT NULL,
    variables JSONB NOT NULL DEFAULT '[]'::jsonb,
    active BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (template_id, channel, version)
);

CREATE UNIQUE INDEX IF NOT EXISTS one_active_template_version_per_channel
    ON template_versions(template_id, channel)
    WHERE active;

CREATE TABLE IF NOT EXISTS notification_events (
    id TEXT PRIMARY KEY,
    event_id TEXT NOT NULL UNIQUE,
    event_type TEXT NOT NULL,
    source TEXT,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    status TEXT NOT NULL CHECK (status IN ('accepted', 'processing', 'completed', 'failed')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    processed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    event_id TEXT REFERENCES notification_events(id) ON DELETE SET NULL,
    recipient_id TEXT REFERENCES recipients(id),
    template_id TEXT REFERENCES templates(id),
    template_version_id TEXT REFERENCES template_versions(id),
    sender_id TEXT NOT NULL DEFAULT '',
    subject TEXT,
    message TEXT NOT NULL DEFAULT '',
    requested_channels TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    status TEXT NOT NULL CHECK (status IN ('pending', 'queued', 'completed', 'partially_completed', 'failed')),
    duplicate BOOLEAN NOT NULL DEFAULT false,
    response JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS notification_deliveries (
    id TEXT PRIMARY KEY,
    notification_id TEXT NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL DEFAULT '',
    channel TEXT NOT NULL CHECK (channel IN ('email', 'whatsapp')),
    provider TEXT NOT NULL CHECK (provider IN ('smtp', 'meta_whatsapp_cloud')),
    destination TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('pending', 'queued', 'sending', 'sent', 'delivered', 'retrying', 'failed')),
    retry_count INT NOT NULL DEFAULT 0,
    provider_message_id TEXT,
    error_code TEXT,
    error_message TEXT,
    sent_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    failed_at TIMESTAMPTZ,
    next_retry_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS delivery_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    delivery_id TEXT NOT NULL REFERENCES notification_deliveries(id) ON DELETE CASCADE,
    attempt_number INT NOT NULL,
    provider TEXT NOT NULL CHECK (provider IN ('smtp', 'meta_whatsapp_cloud')),
    status TEXT NOT NULL,
    response_code TEXT,
    error_message TEXT,
    attempted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (delivery_id, attempt_number)
);

CREATE TABLE IF NOT EXISTS broadcasts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT,
    event_type TEXT,
    status TEXT NOT NULL CHECK (status IN ('draft', 'accepted', 'queued', 'completed', 'failed')),
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS broadcast_channels (
    broadcast_id UUID NOT NULL REFERENCES broadcasts(id) ON DELETE CASCADE,
    channel TEXT NOT NULL CHECK (channel IN ('email', 'whatsapp')),
    PRIMARY KEY (broadcast_id, channel)
);

CREATE TABLE IF NOT EXISTS broadcast_recipients (
    broadcast_id UUID NOT NULL REFERENCES broadcasts(id) ON DELETE CASCADE,
    recipient_id TEXT NOT NULL REFERENCES recipients(id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK (status IN ('pending', 'queued', 'completed', 'failed')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (broadcast_id, recipient_id)
);

CREATE TABLE IF NOT EXISTS notification_deduplication (
    dedup_key TEXT PRIMARY KEY,
    notification_id TEXT NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_recipient_channels_recipient_channel ON recipient_channels(recipient_id, channel);
CREATE INDEX IF NOT EXISTS idx_templates_event_type ON templates(event_type);
CREATE INDEX IF NOT EXISTS idx_notification_events_status ON notification_events(status);
CREATE INDEX IF NOT EXISTS idx_notifications_event_recipient ON notifications(event_id, recipient_id);
CREATE INDEX IF NOT EXISTS idx_notification_deliveries_status ON notification_deliveries(status);
CREATE INDEX IF NOT EXISTS idx_delivery_attempts_delivery ON delivery_attempts(delivery_id);
CREATE INDEX IF NOT EXISTS idx_notification_deduplication_expires ON notification_deduplication(expires_at);
