package main

import (
	"crypto/tls"
	"fmt"
	"net"
	"net/mail"
	"net/smtp"
	"os"
	"strings"
	"time"
)

type SMTPProvider interface {
	SendEmail(receiver, subject, message string) error
}

type DefaultSMTPProvider struct{}

func (DefaultSMTPProvider) SendEmail(receiver, subject, message string) error {
	return sendEmail(receiver, subject, message)
}

// sendEmail sends plain-text email over authenticated SMTP with STARTTLS.
// Gmail uses smtp.gmail.com:587. SMTP does not use HTTPS port 443.
func sendEmail(receiver, subject, message string) error {
	host := os.Getenv("SMTP_HOST")
	port := os.Getenv("SMTP_PORT")
	username := os.Getenv("SMTP_USERNAME")
	password := os.Getenv("SMTP_APP_PASSWORD")
	from := os.Getenv("SMTP_FROM")

	if host == "" || port == "" || username == "" || password == "" || from == "" {
		return fmt.Errorf("SMTP configuration missing - check SMTP_HOST, SMTP_PORT, SMTP_USERNAME, SMTP_APP_PASSWORD, and SMTP_FROM in .env")
	}

	fromAddress, err := mail.ParseAddress(from)
	if err != nil {
		return fmt.Errorf("invalid SMTP_FROM address: %w", err)
	}

	serverAddr := net.JoinHostPort(host, port)
	connection, err := (&net.Dialer{Timeout: 15 * time.Second}).Dial("tcp", serverAddr)
	if err != nil {
		return fmt.Errorf("SMTP connection failed: %w", err)
	}
	defer connection.Close()

	client, err := smtp.NewClient(connection, host)
	if err != nil {
		return fmt.Errorf("SMTP client setup failed: %w", err)
	}
	defer client.Quit()

	if ok, _ := client.Extension("STARTTLS"); !ok {
		return fmt.Errorf("SMTP server does not support STARTTLS")
	}
	if err := client.StartTLS(&tls.Config{ServerName: host, MinVersion: tls.VersionTLS12}); err != nil {
		return fmt.Errorf("SMTP TLS setup failed: %w", err)
	}

	if err := client.Auth(smtp.PlainAuth("", username, password, host)); err != nil {
		return fmt.Errorf("SMTP authentication failed: %w", err)
	}
	if err := client.Mail(fromAddress.Address); err != nil {
		return fmt.Errorf("SMTP sender rejected: %w", err)
	}
	if err := client.Rcpt(receiver); err != nil {
		return fmt.Errorf("SMTP recipient rejected: %w", err)
	}

	writer, err := client.Data()
	if err != nil {
		return fmt.Errorf("SMTP message setup failed: %w", err)
	}

	// Header values are cleaned to prevent injected SMTP headers.
	email := fmt.Sprintf("From: %s\r\nTo: %s\r\nSubject: %s\r\nMIME-Version: 1.0\r\nContent-Type: text/plain; charset=UTF-8\r\n\r\n%s",
		headerValue(fromAddress.String()), headerValue(receiver), headerValue(subject), message)
	if _, err := writer.Write([]byte(email)); err != nil {
		return fmt.Errorf("SMTP message write failed: %w", err)
	}
	if err := writer.Close(); err != nil {
		return fmt.Errorf("SMTP message send failed: %w", err)
	}

	return nil
}

func headerValue(value string) string {
	return strings.NewReplacer("\r", " ", "\n", " ").Replace(value)
}
