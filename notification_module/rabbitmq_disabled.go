//go:build !rabbitmq

package main

import (
	"fmt"
	"time"
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
		URL:           envString("RABBITMQ_URL", "amqp://guest:guest@localhost:5672/"),
		Exchange:      envString("RABBITMQ_EXCHANGE", "notification.exchange"),
		EmailQueue:    envString("EMAIL_QUEUE", "email.queue"),
		WhatsAppQueue: envString("WHATSAPP_QUEUE", "whatsapp.queue"),
		EmailDLQ:      envString("EMAIL_DLQ", "email.dlq"),
		WhatsAppDLQ:   envString("WHATSAPP_DLQ", "whatsapp.dlq"),
	}
}

func NewRabbitMQDeliveryBroker(RabbitMQConfig) (*InMemoryDeliveryBroker, error) {
	return nil, fmt.Errorf("rabbitmq support is not compiled; run `go get github.com/rabbitmq/amqp091-go` and build with `-tags rabbitmq`")
}
