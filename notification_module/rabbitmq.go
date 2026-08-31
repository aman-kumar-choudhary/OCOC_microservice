//go:build rabbitmq

package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"sync"
	"time"

	amqp "github.com/rabbitmq/amqp091-go"
)

const (
	defaultRabbitMQURL      = "amqp://guest:guest@localhost:5672/"
	defaultRabbitMQExchange = "notification.exchange"
	defaultEmailQueue       = "email.queue"
	defaultWhatsAppQueue    = "whatsapp.queue"
	defaultEmailDLQ         = "email.dlq"
	defaultWhatsAppDLQ      = "whatsapp.dlq"
	emailRoutingKey         = "notification.email"
	whatsAppRoutingKey      = "notification.whatsapp"
)

type RabbitMQConfig struct {
	URL                 string
	Exchange            string
	EmailQueue          string
	WhatsAppQueue       string
	EmailDLQ            string
	WhatsAppDLQ         string
	EmailWorkerPrefetch int
	WhatsAppPrefetch    int
	ReconnectDelay      time.Duration
	PublishTimeout      time.Duration
}

func RabbitMQConfigFromEnv() RabbitMQConfig {
	return RabbitMQConfig{
		URL:                 envString("RABBITMQ_URL", defaultRabbitMQURL),
		Exchange:            envString("RABBITMQ_EXCHANGE", defaultRabbitMQExchange),
		EmailQueue:          envString("EMAIL_QUEUE", defaultEmailQueue),
		WhatsAppQueue:       envString("WHATSAPP_QUEUE", defaultWhatsAppQueue),
		EmailDLQ:            envString("EMAIL_DLQ", defaultEmailDLQ),
		WhatsAppDLQ:         envString("WHATSAPP_DLQ", defaultWhatsAppDLQ),
		EmailWorkerPrefetch: envInt("EMAIL_WORKER_CONCURRENCY", defaultMaxConcurrency),
		WhatsAppPrefetch:    envInt("WHATSAPP_WORKER_CONCURRENCY", defaultMaxConcurrency),
		ReconnectDelay:      time.Duration(envInt("RABBITMQ_RECONNECT_DELAY_SECONDS", 5)) * time.Second,
		PublishTimeout:      time.Duration(envInt("RABBITMQ_PUBLISH_TIMEOUT_SECONDS", 5)) * time.Second,
	}
}

type RabbitMQDeliveryBroker struct {
	cfg     RabbitMQConfig
	conn    *amqp.Connection
	pubCh   *amqp.Channel
	pubMu   sync.Mutex
	closeMu sync.Mutex
	closed  bool
}

func NewRabbitMQDeliveryBroker(cfg RabbitMQConfig) (*RabbitMQDeliveryBroker, error) {
	if cfg.URL == "" {
		cfg.URL = defaultRabbitMQURL
	}
	if cfg.Exchange == "" {
		cfg.Exchange = defaultRabbitMQExchange
	}
	if cfg.EmailQueue == "" {
		cfg.EmailQueue = defaultEmailQueue
	}
	if cfg.WhatsAppQueue == "" {
		cfg.WhatsAppQueue = defaultWhatsAppQueue
	}
	if cfg.EmailDLQ == "" {
		cfg.EmailDLQ = defaultEmailDLQ
	}
	if cfg.WhatsAppDLQ == "" {
		cfg.WhatsAppDLQ = defaultWhatsAppDLQ
	}
	if cfg.PublishTimeout <= 0 {
		cfg.PublishTimeout = 5 * time.Second
	}

	conn, err := amqp.Dial(cfg.URL)
	if err != nil {
		return nil, fmt.Errorf("rabbitmq connection failure: %w", err)
	}
	ch, err := conn.Channel()
	if err != nil {
		_ = conn.Close()
		return nil, fmt.Errorf("rabbitmq channel creation failure: %w", err)
	}
	b := &RabbitMQDeliveryBroker{cfg: cfg, conn: conn, pubCh: ch}
	if err := b.declareTopology(ch); err != nil {
		_ = ch.Close()
		_ = conn.Close()
		return nil, err
	}
	log.Printf("RabbitMQ connected exchange=%s email_queue=%s whatsapp_queue=%s", cfg.Exchange, cfg.EmailQueue, cfg.WhatsAppQueue)
	return b, nil
}

func (b *RabbitMQDeliveryBroker) declareTopology(ch *amqp.Channel) error {
	if err := ch.ExchangeDeclare(b.cfg.Exchange, "topic", true, false, false, false, nil); err != nil {
		return fmt.Errorf("declare rabbitmq exchange: %w", err)
	}
	if err := declareDLQ(ch, b.cfg.EmailDLQ); err != nil {
		return err
	}
	if err := declareDLQ(ch, b.cfg.WhatsAppDLQ); err != nil {
		return err
	}
	if err := b.declareQueue(ch, b.cfg.EmailQueue, b.cfg.EmailDLQ, emailRoutingKey); err != nil {
		return err
	}
	if err := b.declareQueue(ch, b.cfg.WhatsAppQueue, b.cfg.WhatsAppDLQ, whatsAppRoutingKey); err != nil {
		return err
	}
	return nil
}

func declareDLQ(ch *amqp.Channel, name string) error {
	_, err := ch.QueueDeclare(name, true, false, false, false, nil)
	if err != nil {
		return fmt.Errorf("declare rabbitmq dlq %s: %w", name, err)
	}
	return nil
}

func (b *RabbitMQDeliveryBroker) declareQueue(ch *amqp.Channel, queueName, dlqName, routingKey string) error {
	args := amqp.Table{
		"x-dead-letter-exchange":    "",
		"x-dead-letter-routing-key": dlqName,
	}
	if _, err := ch.QueueDeclare(queueName, true, false, false, false, args); err != nil {
		return fmt.Errorf("declare rabbitmq queue %s: %w", queueName, err)
	}
	if err := ch.QueueBind(queueName, routingKey, b.cfg.Exchange, false, nil); err != nil {
		return fmt.Errorf("bind rabbitmq queue %s: %w", queueName, err)
	}
	return nil
}

func (b *RabbitMQDeliveryBroker) Publish(msg DeliveryMessage) error {
	return b.publish(msg, routingKeyForChannel(msg.Channel))
}

func (b *RabbitMQDeliveryBroker) PublishRetry(msg DeliveryMessage) error {
	return b.publish(msg, routingKeyForChannel(msg.Channel))
}

func (b *RabbitMQDeliveryBroker) PublishDLQ(msg DeliveryMessage) error {
	queueName, err := b.dlqForChannel(msg.Channel)
	if err != nil {
		return err
	}
	body, err := json.Marshal(msg)
	if err != nil {
		return fmt.Errorf("marshal dlq delivery message: %w", err)
	}
	ctx, cancel := context.WithTimeout(context.Background(), b.cfg.PublishTimeout)
	defer cancel()
	b.pubMu.Lock()
	defer b.pubMu.Unlock()
	if err := b.pubCh.PublishWithContext(ctx, "", queueName, false, false, amqp.Publishing{
		ContentType:  "application/json",
		DeliveryMode: amqp.Persistent,
		MessageId:    msg.DeliveryID,
		Timestamp:    time.Now(),
		Body:         body,
	}); err != nil {
		return fmt.Errorf("publish rabbitmq dlq message: %w", err)
	}
	log.Printf("Notification moved to DLQ delivery_id=%s channel=%s", msg.DeliveryID, msg.Channel)
	return nil
}

func (b *RabbitMQDeliveryBroker) publish(msg DeliveryMessage, routingKey string) error {
	if routingKey == "" {
		return fmt.Errorf("routing key for channel %q is not configured", msg.Channel)
	}
	body, err := json.Marshal(msg)
	if err != nil {
		return fmt.Errorf("marshal delivery message: %w", err)
	}
	ctx, cancel := context.WithTimeout(context.Background(), b.cfg.PublishTimeout)
	defer cancel()

	b.pubMu.Lock()
	defer b.pubMu.Unlock()
	if err := b.pubCh.PublishWithContext(ctx, b.cfg.Exchange, routingKey, false, false, amqp.Publishing{
		ContentType:  "application/json",
		DeliveryMode: amqp.Persistent,
		MessageId:    msg.DeliveryID,
		Timestamp:    time.Now(),
		Body:         body,
	}); err != nil {
		return fmt.Errorf("publish rabbitmq message: %w", err)
	}
	log.Printf("RabbitMQ message published delivery_id=%s notification_id=%s channel=%s routing_key=%s", msg.DeliveryID, msg.NotificationID, msg.Channel, routingKey)
	return nil
}

func (b *RabbitMQDeliveryBroker) Consume(channel string) (<-chan BrokerDelivery, error) {
	queueName, err := b.queueForChannel(channel)
	if err != nil {
		return nil, err
	}
	consumerCh, err := b.conn.Channel()
	if err != nil {
		return nil, fmt.Errorf("rabbitmq consumer channel creation failure: %w", err)
	}
	prefetch := b.prefetchForChannel(channel)
	if prefetch <= 0 {
		prefetch = 1
	}
	if err := consumerCh.Qos(prefetch, 0, false); err != nil {
		_ = consumerCh.Close()
		return nil, fmt.Errorf("rabbitmq qos setup failure: %w", err)
	}
	deliveries, err := consumerCh.Consume(queueName, "", false, false, false, false, nil)
	if err != nil {
		_ = consumerCh.Close()
		return nil, fmt.Errorf("rabbitmq consume failure: %w", err)
	}
	out := make(chan BrokerDelivery)
	go func() {
		defer close(out)
		defer consumerCh.Close()
		for d := range deliveries {
			var msg DeliveryMessage
			if err := json.Unmarshal(d.Body, &msg); err != nil {
				log.Printf("RabbitMQ message decode failed queue=%s error=%v", queueName, err)
				_ = d.Nack(false, false)
				continue
			}
			delivery := d
			out <- BrokerDelivery{
				Message: msg,
				Ack: func() error {
					return delivery.Ack(false)
				},
				Nack: func(requeue bool) error {
					return delivery.Nack(false, requeue)
				},
			}
		}
	}()
	return out, nil
}

func (b *RabbitMQDeliveryBroker) Close() error {
	b.closeMu.Lock()
	defer b.closeMu.Unlock()
	if b.closed {
		return nil
	}
	b.closed = true
	var err error
	if b.pubCh != nil {
		err = b.pubCh.Close()
	}
	if b.conn != nil {
		if closeErr := b.conn.Close(); err == nil {
			err = closeErr
		}
	}
	return err
}

func (b *RabbitMQDeliveryBroker) queueForChannel(channel string) (string, error) {
	switch channel {
	case "email":
		return b.cfg.EmailQueue, nil
	case "whatsapp":
		return b.cfg.WhatsAppQueue, nil
	default:
		return "", fmt.Errorf("queue for channel %q is not configured", channel)
	}
}

func (b *RabbitMQDeliveryBroker) dlqForChannel(channel string) (string, error) {
	switch channel {
	case "email":
		return b.cfg.EmailDLQ, nil
	case "whatsapp":
		return b.cfg.WhatsAppDLQ, nil
	default:
		return "", fmt.Errorf("dlq for channel %q is not configured", channel)
	}
}

func (b *RabbitMQDeliveryBroker) prefetchForChannel(channel string) int {
	switch channel {
	case "email":
		return b.cfg.EmailWorkerPrefetch
	case "whatsapp":
		return b.cfg.WhatsAppPrefetch
	default:
		return 1
	}
}

func routingKeyForChannel(channel string) string {
	switch channel {
	case "email":
		return emailRoutingKey
	case "whatsapp":
		return whatsAppRoutingKey
	default:
		return ""
	}
}
