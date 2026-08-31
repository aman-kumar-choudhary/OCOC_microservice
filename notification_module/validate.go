package main

import (
	"fmt"
	"regexp"
)

// Basic email format check
var emailRegex = regexp.MustCompile(`^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$`)

// Basic international WhatsApp number check, e.g. +919876543210 or 919876543210.
var phoneRegex = regexp.MustCompile(`^\+?[1-9]\d{7,14}$`)

// allowedChannels is the set of channels this project can actually deliver
// through. Anything else (sms, telegram, ...) is rejected until a real
// implementation exists for it.
var allowedChannels = map[string]bool{
	"email":    true,
	"whatsapp": true,
}

// normalizeRequest upgrades the legacy single channel/receiver request shape
// into a one-element Recipients list, so validateRequest and the
// notification service only ever have to deal with one representation.
//
// If Recipients was already supplied, this is a no-op - new-style requests
// take priority and legacy fields are ignored.
func normalizeRequest(req *NotificationRequest) {
	if len(req.Recipients) > 0 {
		return
	}
	if req.Channel == "" && req.Receiver == "" {
		return
	}

	recipient := Recipient{
		// The legacy shape has no concept of user_id, so the receiver value
		// itself is used to identify the recipient in results/logs.
		UserID:   req.Receiver,
		Channels: []string{req.Channel},
	}
	switch req.Channel {
	case "email":
		recipient.Email = req.Receiver
	case "whatsapp":
		recipient.Phone = req.Receiver
	}

	req.Recipients = []Recipient{recipient}
}

// validateRequest checks required fields and format rules against the
// (already-normalized) recipients list. Nothing here is hardcoded to a
// specific user - it only validates whatever came in the request.
func validateRequest(req NotificationRequest) error {
	if req.SenderID == "" {
		return fmt.Errorf("sender_id is required")
	}
	if req.Message == "" && req.TemplateID == "" && req.EventType == "" {
		return fmt.Errorf("message is required")
	}
	if len(req.Recipients) == 0 {
		return fmt.Errorf("recipients must contain at least one recipient")
	}
	if err := validateChannels("channels", req.Channels); err != nil {
		return err
	}

	seenUsers := make(map[string]bool, len(req.Recipients))
	for i, rec := range req.Recipients {
		if rec.UserID == "" {
			return fmt.Errorf("recipients[%d]: user_id is required", i)
		}
		if seenUsers[rec.UserID] {
			return fmt.Errorf("recipients[%d]: duplicate user_id %q", i, rec.UserID)
		}
		seenUsers[rec.UserID] = true

		if len(rec.Channels) == 0 && len(req.Channels) == 0 {
			return fmt.Errorf("recipients[%d] (%s): channels must contain at least one channel", i, rec.UserID)
		}

		channels := rec.Channels
		if len(channels) == 0 {
			channels = req.Channels
		}
		if err := validateChannels(fmt.Sprintf("recipients[%d] (%s)", i, rec.UserID), channels); err != nil {
			return err
		}
		seenChannels := make(map[string]bool, len(channels))
		for _, ch := range channels {
			if seenChannels[ch] {
				return fmt.Errorf("recipients[%d] (%s): duplicate channel %q", i, rec.UserID, ch)
			}
			seenChannels[ch] = true

			switch ch {
			case "email":
				if !emailRegex.MatchString(rec.Email) {
					return fmt.Errorf("recipients[%d] (%s): a valid email address is required for the email channel", i, rec.UserID)
				}
			case "whatsapp":
				if !phoneRegex.MatchString(rec.Phone) {
					return fmt.Errorf("recipients[%d] (%s): a valid international phone number is required for the whatsapp channel, e.g. +919876543210 or 919876543210", i, rec.UserID)
				}
			}
		}
	}

	return nil
}

func validateChannels(label string, channels []string) error {
	for _, ch := range channels {
		if !allowedChannels[ch] {
			return fmt.Errorf("%s: channel %q is not supported (allowed: email, whatsapp)", label, ch)
		}
	}
	return nil
}
