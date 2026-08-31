package main

import (
	"fmt"
	"sync"
)

const (
	emailChannelName    = "email"
	whatsAppChannelName = "whatsapp"
)

type BrokerDelivery struct {
	Message DeliveryMessage
	Ack     func() error
	Nack    func(requeue bool) error
}

// DeliveryBroker is the RabbitMQ boundary used by the notification service.
// The in-memory implementation keeps local development and unit tests
// dependency-light; a RabbitMQ implementation only needs to satisfy this
// interface.
type DeliveryBroker interface {
	Publish(DeliveryMessage) error
	Consume(channel string) (<-chan BrokerDelivery, error)
	PublishRetry(DeliveryMessage) error
	PublishDLQ(DeliveryMessage) error
	Close() error
}

type InMemoryDeliveryBroker struct {
	mu     sync.RWMutex
	queues map[string]chan DeliveryMessage

	retryMu sync.Mutex
	retry   []DeliveryMessage
	dlq     []DeliveryMessage
}

func NewInMemoryDeliveryBroker(buffer int) *InMemoryDeliveryBroker {
	if buffer <= 0 {
		buffer = 100
	}
	return &InMemoryDeliveryBroker{
		queues: map[string]chan DeliveryMessage{
			emailChannelName:    make(chan DeliveryMessage, buffer),
			whatsAppChannelName: make(chan DeliveryMessage, buffer),
		},
	}
}

func (b *InMemoryDeliveryBroker) Publish(msg DeliveryMessage) error {
	b.mu.RLock()
	q, ok := b.queues[msg.Channel]
	b.mu.RUnlock()
	if !ok {
		return fmt.Errorf("queue for channel %q is not configured", msg.Channel)
	}
	q <- msg
	return nil
}

func (b *InMemoryDeliveryBroker) Consume(channel string) (<-chan BrokerDelivery, error) {
	b.mu.RLock()
	q, ok := b.queues[channel]
	b.mu.RUnlock()
	if !ok {
		return nil, fmt.Errorf("queue for channel %q is not configured", channel)
	}
	out := make(chan BrokerDelivery)
	go func() {
		for msg := range q {
			out <- BrokerDelivery{
				Message: msg,
				Ack:     func() error { return nil },
				Nack:    func(bool) error { return nil },
			}
		}
		close(out)
	}()
	return out, nil
}

func (b *InMemoryDeliveryBroker) PublishRetry(msg DeliveryMessage) error {
	b.retryMu.Lock()
	b.retry = append(b.retry, msg)
	b.retryMu.Unlock()
	return b.Publish(msg)
}

func (b *InMemoryDeliveryBroker) PublishDLQ(msg DeliveryMessage) error {
	b.retryMu.Lock()
	defer b.retryMu.Unlock()
	b.dlq = append(b.dlq, msg)
	return nil
}

func (b *InMemoryDeliveryBroker) Close() error {
	b.mu.Lock()
	defer b.mu.Unlock()
	for name, q := range b.queues {
		close(q)
		delete(b.queues, name)
	}
	return nil
}
