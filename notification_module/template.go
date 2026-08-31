package main

import (
	"fmt"
	"regexp"
	"strings"
	"time"
)

var templateVariableRegex = regexp.MustCompile(`\{\{\s*([a-zA-Z0-9_]+)\s*\}\}`)

func templateFromRequest(req TemplateRequest, existing *Template) (Template, error) {
	if req.ID == "" && existing == nil {
		return Template{}, fmt.Errorf("id is required")
	}
	if req.Name == "" {
		return Template{}, fmt.Errorf("name is required")
	}
	if req.EventType == "" {
		return Template{}, fmt.Errorf("event_type is required")
	}
	if req.Body == "" {
		return Template{}, fmt.Errorf("body is required")
	}
	if len(req.AllowedChannels) == 0 {
		return Template{}, fmt.Errorf("allowed_channels must contain at least one channel")
	}
	for _, ch := range req.AllowedChannels {
		if !allowedChannels[ch] {
			return Template{}, fmt.Errorf("channel %q is not supported (allowed: email, whatsapp)", ch)
		}
	}

	now := time.Now()
	enabled := true
	createdAt := now
	id := req.ID
	if existing != nil {
		enabled = existing.Enabled
		createdAt = existing.CreatedAt
		id = existing.ID
	}
	if req.Enabled != nil {
		enabled = *req.Enabled
	}
	return Template{
		ID:              id,
		Name:            req.Name,
		EventType:       req.EventType,
		Subject:         req.Subject,
		Body:            req.Body,
		AllowedChannels: req.AllowedChannels,
		Enabled:         enabled,
		CreatedAt:       createdAt,
		UpdatedAt:       now,
	}, nil
}

func renderTemplateText(text string, variables map[string]string) (string, error) {
	missing := []string{}
	rendered := templateVariableRegex.ReplaceAllStringFunc(text, func(match string) string {
		key := strings.TrimSpace(strings.TrimSuffix(strings.TrimPrefix(match, "{{"), "}}"))
		value, ok := variables[key]
		if !ok {
			missing = append(missing, key)
			return match
		}
		return value
	})
	if len(missing) > 0 {
		return "", fmt.Errorf("missing template variable %q", missing[0])
	}
	return rendered, nil
}
