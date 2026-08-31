package main

import (
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"os"
	"strings"
	"time"

	"github.com/lib/pq"
)

type RepositorySet struct {
	Templates     TemplateRepository
	Notifications NotificationRepository
	Deliveries    DeliveryRepository
	Attempts      DeliveryAttemptRepository
	Preferences   PreferenceRepository
	Events        NotificationEventRepository
	Recipients    RecipientRepository
	Dedup         DeduplicationRepository
}

func OpenPostgresFromEnv() (*sql.DB, error) {
	dsn := envString("DATABASE_URL", "")
	if dsn == "" {
		return nil, fmt.Errorf("DATABASE_URL is required")
	}
	db, err := sql.Open("postgres", dsn)
	if err != nil {
		return nil, err
	}
	db.SetMaxOpenConns(envInt("DATABASE_MAX_OPEN_CONNS", 10))
	db.SetMaxIdleConns(envInt("DATABASE_MAX_IDLE_CONNS", 5))
	db.SetConnMaxLifetime(time.Duration(envInt("DATABASE_CONN_MAX_LIFETIME_SECONDS", 300)) * time.Second)
	if err := db.Ping(); err != nil {
		db.Close()
		return nil, err
	}
	return db, nil
}

func ApplyDatabaseSchema(db *sql.DB, path string) error {
	schema, err := os.ReadFile(path)
	if err != nil {
		return err
	}
	_, err = db.Exec(string(schema))
	return err
}

func EnsureDatabaseSchema(db *sql.DB, path string) error {
	legacy, err := hasLegacySchema(db)
	if err != nil {
		return err
	}
	if legacy {
		empty, err := knownTablesAreEmpty(db)
		if err != nil {
			return err
		}
		if !empty {
			return fmt.Errorf("database has an old schema with existing data; migrate it manually before starting the API")
		}
		log.Printf("old empty PostgreSQL schema detected; recreating notification tables")
		if err := dropKnownTables(db); err != nil {
			return err
		}
	}
	return ApplyDatabaseSchema(db, path)
}

func hasLegacySchema(db *sql.DB) (bool, error) {
	var exists bool
	if err := db.QueryRow(`SELECT to_regclass('public.templates') IS NOT NULL`).Scan(&exists); err != nil {
		return false, err
	}
	if !exists {
		return false, nil
	}

	var idType string
	if err := db.QueryRow(`
		SELECT data_type
		FROM information_schema.columns
		WHERE table_schema = 'public' AND table_name = 'templates' AND column_name = 'id'`).Scan(&idType); err != nil {
		return false, err
	}
	var hasBody bool
	if err := db.QueryRow(`
		SELECT EXISTS (
			SELECT 1
			FROM information_schema.columns
			WHERE table_schema = 'public' AND table_name = 'templates' AND column_name = 'body'
		)`).Scan(&hasBody); err != nil {
		return false, err
	}
	return idType != "text" || !hasBody, nil
}

func knownTablesAreEmpty(db *sql.DB) (bool, error) {
	for _, table := range knownSchemaTables() {
		var exists bool
		if err := db.QueryRow(`SELECT to_regclass($1) IS NOT NULL`, "public."+table).Scan(&exists); err != nil {
			return false, err
		}
		if !exists {
			continue
		}
		var count int
		if err := db.QueryRow(fmt.Sprintf(`SELECT count(*) FROM %s`, pq.QuoteIdentifier(table))).Scan(&count); err != nil {
			return false, err
		}
		if count > 0 {
			return false, nil
		}
	}
	return true, nil
}

func dropKnownTables(db *sql.DB) error {
	tx, err := db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	for _, table := range knownSchemaTables() {
		if _, err := tx.Exec(fmt.Sprintf(`DROP TABLE IF EXISTS %s CASCADE`, pq.QuoteIdentifier(table))); err != nil {
			return err
		}
	}
	return tx.Commit()
}

func knownSchemaTables() []string {
	return []string{
		"notification_deduplication",
		"broadcast_recipients",
		"broadcast_channels",
		"broadcasts",
		"delivery_attempts",
		"notification_deliveries",
		"notifications",
		"notification_events",
		"notification_preferences",
		"recipient_channels",
		"recipients",
		"template_versions",
		"templates",
	}
}

func NewPostgresRepositories(db *sql.DB) RepositorySet {
	return RepositorySet{
		Templates:     PostgresTemplateRepository{db: db},
		Notifications: PostgresNotificationRepository{db: db},
		Deliveries:    PostgresDeliveryRepository{db: db},
		Attempts:      PostgresDeliveryAttemptRepository{db: db},
		Preferences:   PostgresPreferenceRepository{db: db},
		Events:        PostgresNotificationEventRepository{db: db},
		Recipients:    PostgresRecipientRepository{db: db},
		Dedup:         PostgresDeduplicationRepository{db: db},
	}
}

type PostgresRecipientRepository struct {
	db *sql.DB
}

func (r PostgresRecipientRepository) Save(rec Recipient) {
	if rec.UserID == "" {
		return
	}
	_, err := r.db.Exec(`
		INSERT INTO recipients (id, external_user_id, recipient_type, updated_at)
		VALUES ($1, $1, 'other', $2)
		ON CONFLICT (id) DO UPDATE SET updated_at = EXCLUDED.updated_at`,
		rec.UserID, time.Now())
	if err != nil {
		log.Printf("postgres recipient save failed user_id=%s error=%v", rec.UserID, err)
		return
	}
	for _, ch := range rec.Channels {
		destination := rec.Email
		if ch == whatsAppChannelName {
			destination = rec.Phone
		}
		if destination == "" {
			continue
		}
		_, err := r.db.Exec(`
			INSERT INTO recipient_channels (recipient_id, channel, destination, verified, updated_at)
			VALUES ($1, $2, $3, true, $4)
			ON CONFLICT (recipient_id, channel, destination) DO UPDATE
			SET verified = EXCLUDED.verified, updated_at = EXCLUDED.updated_at`,
			rec.UserID, ch, destination, time.Now())
		if err != nil {
			log.Printf("postgres recipient channel save failed user_id=%s channel=%s error=%v", rec.UserID, ch, err)
		}
	}
}

type PostgresTemplateRepository struct {
	db *sql.DB
}

func (r PostgresTemplateRepository) Create(t Template) error {
	if t.CreatedAt.IsZero() {
		t.CreatedAt = time.Now()
	}
	if t.UpdatedAt.IsZero() {
		t.UpdatedAt = t.CreatedAt
	}
	_, err := r.db.Exec(`
		INSERT INTO templates (id, template_key, event_type, name, subject, body, allowed_channels, enabled, created_at, updated_at)
		VALUES ($1, $1, $2, $3, $4, $5, $6, $7, $8, $9)`,
		t.ID, t.EventType, t.Name, t.Subject, t.Body, pq.Array(t.AllowedChannels), t.Enabled, t.CreatedAt, t.UpdatedAt)
	if err != nil {
		return err
	}
	return r.saveTemplateVersions(t)
}

func (r PostgresTemplateRepository) List() []Template {
	rows, err := r.db.Query(`
		SELECT id, name, event_type, COALESCE(subject, ''), body, allowed_channels, enabled, created_at, updated_at
		FROM templates
		ORDER BY created_at, id`)
	if err != nil {
		log.Printf("postgres template list failed error=%v", err)
		return nil
	}
	defer rows.Close()
	var out []Template
	for rows.Next() {
		if t, ok := scanTemplate(rows); ok {
			out = append(out, t)
		}
	}
	return out
}

func (r PostgresTemplateRepository) Get(id string) (Template, bool) {
	row := r.db.QueryRow(`
		SELECT id, name, event_type, COALESCE(subject, ''), body, allowed_channels, enabled, created_at, updated_at
		FROM templates
		WHERE id = $1`, id)
	return scanTemplate(row)
}

func (r PostgresTemplateRepository) GetByEventType(eventType string) (Template, bool) {
	row := r.db.QueryRow(`
		SELECT id, name, event_type, COALESCE(subject, ''), body, allowed_channels, enabled, created_at, updated_at
		FROM templates
		WHERE event_type = $1
		ORDER BY updated_at DESC
		LIMIT 1`, eventType)
	return scanTemplate(row)
}

func (r PostgresTemplateRepository) Update(id string, t Template) error {
	result, err := r.db.Exec(`
		UPDATE templates
		SET event_type = $2, name = $3, subject = $4, body = $5, allowed_channels = $6, enabled = $7, updated_at = $8
		WHERE id = $1`,
		id, t.EventType, t.Name, t.Subject, t.Body, pq.Array(t.AllowedChannels), t.Enabled, t.UpdatedAt)
	if err != nil {
		return err
	}
	affected, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if affected == 0 {
		return fmt.Errorf("template %q not found", id)
	}
	return r.saveTemplateVersions(t)
}

func (r PostgresTemplateRepository) Delete(id string) bool {
	result, err := r.db.Exec(`DELETE FROM templates WHERE id = $1`, id)
	if err != nil {
		log.Printf("postgres template delete failed id=%s error=%v", id, err)
		return false
	}
	affected, err := result.RowsAffected()
	return err == nil && affected > 0
}

func (r PostgresTemplateRepository) saveTemplateVersions(t Template) error {
	for _, ch := range t.AllowedChannels {
		versionID := fmt.Sprintf("%s:%s:v1", t.ID, ch)
		if _, err := r.db.Exec(`
			INSERT INTO template_versions (id, template_id, channel, version, subject, body, variables, active, updated_at)
			VALUES ($1, $2, $3, 1, $4, $5, '[]'::jsonb, $6, $7)
			ON CONFLICT (template_id, channel, version) DO UPDATE
			SET subject = EXCLUDED.subject, body = EXCLUDED.body, active = EXCLUDED.active, updated_at = EXCLUDED.updated_at`,
			versionID, t.ID, ch, t.Subject, t.Body, t.Enabled, t.UpdatedAt); err != nil {
			return err
		}
	}
	_, err := r.db.Exec(`
		UPDATE template_versions
		SET active = false, updated_at = $2
		WHERE template_id = $1 AND NOT (channel = ANY($3))`,
		t.ID, t.UpdatedAt, pq.Array(t.AllowedChannels))
	return err
}

type templateScanner interface {
	Scan(dest ...any) error
}

func scanTemplate(row templateScanner) (Template, bool) {
	var t Template
	err := row.Scan(&t.ID, &t.Name, &t.EventType, &t.Subject, &t.Body, pq.Array(&t.AllowedChannels), &t.Enabled, &t.CreatedAt, &t.UpdatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return Template{}, false
	}
	if err != nil {
		log.Printf("postgres template scan failed error=%v", err)
		return Template{}, false
	}
	return t, true
}

type PostgresNotificationEventRepository struct {
	db *sql.DB
}

func (r PostgresNotificationEventRepository) Save(e NotificationEventRecord) {
	payload := strings.TrimSpace(e.Payload)
	if payload == "" {
		payload = "{}"
	}
	if e.CreatedAt.IsZero() {
		e.CreatedAt = time.Now()
	}
	processedAt := nullableTime(e.ProcessedAt)
	_, err := r.db.Exec(`
		INSERT INTO notification_events (id, event_id, event_type, source, payload, status, created_at, processed_at)
		VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8)
		ON CONFLICT (event_id) DO UPDATE
		SET event_type = EXCLUDED.event_type, source = EXCLUDED.source, payload = EXCLUDED.payload, status = EXCLUDED.status, processed_at = EXCLUDED.processed_at`,
		e.ID, e.EventID, e.EventType, e.Source, payload, e.Status, e.CreatedAt, processedAt)
	if err != nil {
		log.Printf("postgres event save failed event_id=%s error=%v", e.EventID, err)
	}
}

func (r PostgresNotificationEventRepository) GetByEventID(eventID string) (NotificationEventRecord, bool) {
	var e NotificationEventRecord
	var payload []byte
	var processedAt sql.NullTime
	err := r.db.QueryRow(`
		SELECT id, event_id, event_type, COALESCE(source, ''), payload, status, created_at, processed_at
		FROM notification_events
		WHERE event_id = $1`, eventID).
		Scan(&e.ID, &e.EventID, &e.EventType, &e.Source, &payload, &e.Status, &e.CreatedAt, &processedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return NotificationEventRecord{}, false
	}
	if err != nil {
		log.Printf("postgres event get failed event_id=%s error=%v", eventID, err)
		return NotificationEventRecord{}, false
	}
	e.Payload = string(payload)
	if processedAt.Valid {
		e.ProcessedAt = processedAt.Time
	}
	return e, true
}

type PostgresNotificationRepository struct {
	db *sql.DB
}

func (r PostgresNotificationRepository) Save(n NotificationRecord) {
	response, err := json.Marshal(n.Response)
	if err != nil {
		log.Printf("postgres notification response marshal failed id=%s error=%v", n.ID, err)
		response = []byte("{}")
	}
	if n.CreatedAt.IsZero() {
		n.CreatedAt = time.Now()
	}
	if n.UpdatedAt.IsZero() {
		n.UpdatedAt = n.CreatedAt
	}
	_, err = r.db.Exec(`
		INSERT INTO notifications (id, sender_id, subject, message, status, duplicate, response, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9)
		ON CONFLICT (id) DO UPDATE
		SET sender_id = EXCLUDED.sender_id, subject = EXCLUDED.subject, message = EXCLUDED.message,
			status = EXCLUDED.status, duplicate = EXCLUDED.duplicate, response = EXCLUDED.response,
			updated_at = EXCLUDED.updated_at`,
		n.ID, n.SenderID, n.Subject, n.Message, string(n.Status), n.Duplicate, string(response), n.CreatedAt, n.UpdatedAt)
	if err != nil {
		log.Printf("postgres notification save failed id=%s error=%v", n.ID, err)
	}
}

func (r PostgresNotificationRepository) Get(id string) (NotificationRecord, bool) {
	var n NotificationRecord
	var status string
	var response []byte
	err := r.db.QueryRow(`
		SELECT id, sender_id, COALESCE(subject, ''), message, status, duplicate, response, created_at, updated_at
		FROM notifications
		WHERE id = $1`, id).
		Scan(&n.ID, &n.SenderID, &n.Subject, &n.Message, &status, &n.Duplicate, &response, &n.CreatedAt, &n.UpdatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return NotificationRecord{}, false
	}
	if err != nil {
		log.Printf("postgres notification get failed id=%s error=%v", id, err)
		return NotificationRecord{}, false
	}
	n.Status = NotificationStatus(status)
	if err := json.Unmarshal(response, &n.Response); err != nil {
		log.Printf("postgres notification response unmarshal failed id=%s error=%v", id, err)
	}
	return n, true
}

type PostgresDeliveryRepository struct {
	db *sql.DB
}

func (r PostgresDeliveryRepository) Save(d DeliveryResult) {
	if d.CreatedAt.IsZero() {
		d.CreatedAt = time.Now()
	}
	if d.UpdatedAt.IsZero() {
		d.UpdatedAt = d.CreatedAt
	}
	_, err := r.db.Exec(`
		INSERT INTO notification_deliveries (
			id, notification_id, user_id, channel, provider, destination, status, retry_count,
			error_message, next_retry_at, created_at, updated_at
		)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
		ON CONFLICT (id) DO UPDATE
		SET user_id = EXCLUDED.user_id, channel = EXCLUDED.channel, provider = EXCLUDED.provider,
			destination = EXCLUDED.destination, status = EXCLUDED.status, retry_count = EXCLUDED.retry_count,
			error_message = EXCLUDED.error_message, next_retry_at = EXCLUDED.next_retry_at,
			updated_at = EXCLUDED.updated_at`,
		d.DeliveryID, d.NotificationID, d.UserID, d.Channel, d.Provider, d.Receiver, string(d.Status),
		d.AttemptCount, nullableString(d.Error), d.NextRetryAt, d.CreatedAt, d.UpdatedAt)
	if err != nil {
		log.Printf("postgres delivery save failed id=%s error=%v", d.DeliveryID, err)
	}
}

func (r PostgresDeliveryRepository) Get(id string) (DeliveryResult, bool) {
	row := r.db.QueryRow(`
		SELECT id, notification_id, user_id, channel, provider, destination, status, retry_count,
			COALESCE(error_message, ''), next_retry_at, created_at, updated_at
		FROM notification_deliveries
		WHERE id = $1`, id)
	return scanDelivery(row)
}

func (r PostgresDeliveryRepository) ListByNotification(notificationID string) []DeliveryResult {
	rows, err := r.db.Query(`
		SELECT id, notification_id, user_id, channel, provider, destination, status, retry_count,
			COALESCE(error_message, ''), next_retry_at, created_at, updated_at
		FROM notification_deliveries
		WHERE notification_id = $1
		ORDER BY created_at, id`, notificationID)
	if err != nil {
		log.Printf("postgres delivery list failed notification_id=%s error=%v", notificationID, err)
		return nil
	}
	defer rows.Close()
	var out []DeliveryResult
	for rows.Next() {
		if d, ok := scanDelivery(rows); ok {
			out = append(out, d)
		}
	}
	return out
}

type deliveryScanner interface {
	Scan(dest ...any) error
}

func scanDelivery(row deliveryScanner) (DeliveryResult, bool) {
	var d DeliveryResult
	var status string
	var nextRetry sql.NullTime
	err := row.Scan(&d.DeliveryID, &d.NotificationID, &d.UserID, &d.Channel, &d.Provider, &d.Receiver,
		&status, &d.AttemptCount, &d.Error, &nextRetry, &d.CreatedAt, &d.UpdatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return DeliveryResult{}, false
	}
	if err != nil {
		log.Printf("postgres delivery scan failed error=%v", err)
		return DeliveryResult{}, false
	}
	d.Status = DeliveryStatus(status)
	if nextRetry.Valid {
		d.NextRetryAt = &nextRetry.Time
	}
	return d, true
}

type PostgresDeliveryAttemptRepository struct {
	db *sql.DB
}

func (r PostgresDeliveryAttemptRepository) Save(a DeliveryAttemptRecord) {
	if a.AttemptedAt.IsZero() {
		a.AttemptedAt = time.Now()
	}
	_, err := r.db.Exec(`
		INSERT INTO delivery_attempts (delivery_id, attempt_number, provider, status, response_code, error_message, attempted_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		ON CONFLICT (delivery_id, attempt_number) DO UPDATE
		SET provider = EXCLUDED.provider, status = EXCLUDED.status, response_code = EXCLUDED.response_code,
			error_message = EXCLUDED.error_message, attempted_at = EXCLUDED.attempted_at`,
		a.DeliveryID, a.AttemptNumber, a.Provider, a.Status, nullableString(a.ResponseCode), nullableString(a.ErrorMessage), a.AttemptedAt)
	if err != nil {
		log.Printf("postgres delivery attempt save failed delivery_id=%s attempt=%d error=%v", a.DeliveryID, a.AttemptNumber, err)
	}
}

func (r PostgresDeliveryAttemptRepository) ListByDelivery(deliveryID string) []DeliveryAttemptRecord {
	rows, err := r.db.Query(`
		SELECT delivery_id, attempt_number, provider, status, COALESCE(response_code, ''), COALESCE(error_message, ''), attempted_at
		FROM delivery_attempts
		WHERE delivery_id = $1
		ORDER BY attempt_number`, deliveryID)
	if err != nil {
		log.Printf("postgres delivery attempts list failed delivery_id=%s error=%v", deliveryID, err)
		return nil
	}
	defer rows.Close()
	var out []DeliveryAttemptRecord
	for rows.Next() {
		var a DeliveryAttemptRecord
		if err := rows.Scan(&a.DeliveryID, &a.AttemptNumber, &a.Provider, &a.Status, &a.ResponseCode, &a.ErrorMessage, &a.AttemptedAt); err != nil {
			log.Printf("postgres delivery attempt scan failed delivery_id=%s error=%v", deliveryID, err)
			continue
		}
		out = append(out, a)
	}
	return out
}

type PostgresPreferenceRepository struct {
	db *sql.DB
}

func (r PostgresPreferenceRepository) Get(userID string) NotificationPreference {
	p := NotificationPreference{UserID: userID, EmailEnabled: true, WhatsAppEnabled: true}
	err := r.db.QueryRow(`
		SELECT email_enabled, whatsapp_enabled
		FROM notification_preferences
		WHERE recipient_id = $1`, userID).
		Scan(&p.EmailEnabled, &p.WhatsAppEnabled)
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		log.Printf("postgres preference get failed user_id=%s error=%v", userID, err)
	}
	return p
}

func (r PostgresPreferenceRepository) Put(p NotificationPreference) {
	if p.UserID == "" {
		return
	}
	_, err := r.db.Exec(`
		INSERT INTO recipients (id, external_user_id, recipient_type, updated_at)
		VALUES ($1, $1, 'other', $2)
		ON CONFLICT (id) DO UPDATE SET updated_at = EXCLUDED.updated_at`,
		p.UserID, time.Now())
	if err != nil {
		log.Printf("postgres preference recipient save failed user_id=%s error=%v", p.UserID, err)
		return
	}
	_, err = r.db.Exec(`
		INSERT INTO notification_preferences (recipient_id, email_enabled, whatsapp_enabled, updated_at)
		VALUES ($1, $2, $3, $4)
		ON CONFLICT (recipient_id) DO UPDATE
		SET email_enabled = EXCLUDED.email_enabled, whatsapp_enabled = EXCLUDED.whatsapp_enabled, updated_at = EXCLUDED.updated_at`,
		p.UserID, p.EmailEnabled, p.WhatsAppEnabled, time.Now())
	if err != nil {
		log.Printf("postgres preference put failed user_id=%s error=%v", p.UserID, err)
	}
}

type PostgresDeduplicationRepository struct {
	db *sql.DB
}

func (r PostgresDeduplicationRepository) CheckAndStore(key, notificationID string, window time.Duration) (string, bool) {
	now := time.Now()
	var existing string
	err := r.db.QueryRow(`
		SELECT notification_id
		FROM notification_deduplication
		WHERE dedup_key = $1 AND expires_at > $2`, key, now).Scan(&existing)
	if err == nil {
		return existing, true
	}
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		log.Printf("postgres dedup check failed key=%s error=%v", key, err)
	}
	_, _ = r.db.Exec(`DELETE FROM notification_deduplication WHERE dedup_key = $1 OR expires_at <= $2`, key, now)
	_, err = r.db.Exec(`
		INSERT INTO notification_deduplication (dedup_key, notification_id, expires_at)
		VALUES ($1, $2, $3)
		ON CONFLICT (dedup_key) DO UPDATE
		SET notification_id = EXCLUDED.notification_id, expires_at = EXCLUDED.expires_at, created_at = now()`,
		key, notificationID, now.Add(window))
	if err != nil {
		log.Printf("postgres dedup store failed key=%s notification_id=%s error=%v", key, notificationID, err)
	}
	return "", false
}

func nullableString(value string) sql.NullString {
	return sql.NullString{String: value, Valid: value != ""}
}

func nullableTime(value time.Time) sql.NullTime {
	return sql.NullTime{Time: value, Valid: !value.IsZero()}
}
