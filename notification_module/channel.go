package main

// NotificationChannel abstracts a single delivery channel. The notification
// service dispatches through this interface without knowing anything about
// SMTP or Meta WhatsApp Cloud API details.
type NotificationChannel interface {
	// Send delivers message (with an optional subject, used by email only)
	// to receiver. receiver is channel-specific: an email address for
	// EmailChannel, an E.164 phone number for WhatsAppChannel.
	Send(receiver, subject, message string) error
}

// EmailChannel delivers through an SMTP provider adapter.
type EmailChannel struct {
	Provider SMTPProvider
}

func (c EmailChannel) Send(receiver, subject, message string) error {
	provider := c.Provider
	if provider == nil {
		provider = DefaultSMTPProvider{}
	}
	return provider.SendEmail(receiver, subject, message)
}

// WhatsAppChannel delegates to a provider adapter. The default provider is
// mock/local unless WHATSAPP_PROVIDER is configured.
type WhatsAppChannel struct {
	Provider WhatsAppProvider
}

func (c WhatsAppChannel) Send(receiver, _ string, message string) error {
	provider := c.Provider
	if provider == nil {
		provider = NewWhatsAppProviderFromEnv()
	}
	return provider.SendMessage(receiver, message)
}
