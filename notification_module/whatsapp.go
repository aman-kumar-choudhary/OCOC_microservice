// package main

// import (
// 	"bytes"
// 	"encoding/json"
// 	"fmt"
// 	"io"
// 	"log"
// 	"net/http"
// 	"os"
// 	"strings"
// )

// type WhatsAppProvider interface {
// 	SendMessage(receiver, message string) error
// }

// type MockWhatsAppProvider struct{}

// func (MockWhatsAppProvider) SendMessage(receiver, message string) error {
// 	log.Printf("mock whatsapp accepted receiver=%s bytes=%d", receiver, len(message))
// 	return nil
// }

// type HTTPWhatsAppProvider struct {
// 	APIURL string
// 	Token  string
// 	From   string
// }

// type MetaWhatsAppCloudProvider struct {
// 	APIURL        string
// 	Token         string
// 	PhoneNumberID string
// 	APIVersion    string
// 	MessageType   string
// 	TemplateName  string
// 	LanguageCode  string
// 	Client        *http.Client
// }

// func NewWhatsAppProviderFromEnv() WhatsAppProvider {
// 	provider := strings.ToLower(firstNonEmpty(os.Getenv("WHATSAPP_PROVIDER"), inferredWhatsAppProvider()))
// 	switch provider {
// 	case "", "mock", "local":
// 		return MockWhatsAppProvider{}
// 	case "http":
// 		return HTTPWhatsAppProvider{
// 			APIURL: os.Getenv("WHATSAPP_API_URL"),
// 			Token:  os.Getenv("WHATSAPP_API_TOKEN"),
// 			From:   os.Getenv("WHATSAPP_FROM"),
// 		}
// 	case "meta", "cloud", "meta_cloud", "whatsapp_cloud":
// 		return MetaWhatsAppCloudProvider{
// 			APIURL:        firstNonEmpty(os.Getenv("WHATSAPP_CLOUD_API_URL"), os.Getenv("WHATSAPP_API_URL")),
// 			Token:         firstNonEmpty(os.Getenv("WHATSAPP_CLOUD_API_TOKEN"), os.Getenv("WHATSAPP_API_TOKEN"), os.Getenv("TOKEN")),
// 			PhoneNumberID: firstNonEmpty(os.Getenv("WHATSAPP_PHONE_NUMBER_ID"), os.Getenv("PHONE_NUMBER_ID"), os.Getenv("WHATSAPP_FROM")),
// 			APIVersion:    firstNonEmpty(os.Getenv("WHATSAPP_GRAPH_API_VERSION"), os.Getenv("GRAPH_API_VERSION"), "v25.0"),
// 			MessageType:   firstNonEmpty(os.Getenv("WHATSAPP_MESSAGE_TYPE"), "text"),
// 			TemplateName:  os.Getenv("WHATSAPP_TEMPLATE_NAME"),
// 			LanguageCode:  firstNonEmpty(os.Getenv("WHATSAPP_TEMPLATE_LANGUAGE"), "en_US"),
// 		}
// 	default:
// 		return MockWhatsAppProvider{}
// 	}
// }

// func WhatsAppProviderSummaryFromEnv() string {
// 	provider := strings.ToLower(firstNonEmpty(os.Getenv("WHATSAPP_PROVIDER"), inferredWhatsAppProvider(), "mock"))
// 	switch provider {
// 	case "meta", "cloud", "meta_cloud", "whatsapp_cloud":
// 		return fmt.Sprintf("provider=meta api_version=%s message_type=%s template=%s phone_number_id_configured=%t token_configured=%t",
// 			firstNonEmpty(os.Getenv("WHATSAPP_GRAPH_API_VERSION"), os.Getenv("GRAPH_API_VERSION"), "v25.0"),
// 			firstNonEmpty(os.Getenv("WHATSAPP_MESSAGE_TYPE"), "text"),
// 			os.Getenv("WHATSAPP_TEMPLATE_NAME"),
// 			firstNonEmpty(os.Getenv("WHATSAPP_PHONE_NUMBER_ID"), os.Getenv("PHONE_NUMBER_ID"), os.Getenv("WHATSAPP_FROM")) != "",
// 			firstNonEmpty(os.Getenv("WHATSAPP_CLOUD_API_TOKEN"), os.Getenv("WHATSAPP_API_TOKEN"), os.Getenv("TOKEN")) != "",
// 		)
// 	case "http":
// 		return fmt.Sprintf("provider=http api_url_configured=%t token_configured=%t", os.Getenv("WHATSAPP_API_URL") != "", os.Getenv("WHATSAPP_API_TOKEN") != "")
// 	default:
// 		return "provider=mock"
// 	}
// }

// func inferredWhatsAppProvider() string {
// 	if firstNonEmpty(os.Getenv("WHATSAPP_CLOUD_API_TOKEN"), os.Getenv("WHATSAPP_API_TOKEN"), os.Getenv("TOKEN")) != "" &&
// 		firstNonEmpty(os.Getenv("WHATSAPP_PHONE_NUMBER_ID"), os.Getenv("PHONE_NUMBER_ID"), os.Getenv("WHATSAPP_FROM")) != "" {
// 		return "meta"
// 	}
// 	return ""
// }

// func (p HTTPWhatsAppProvider) SendMessage(receiver, message string) error {
// 	if p.APIURL == "" {
// 		return fmt.Errorf("WhatsApp HTTP provider configuration missing - check WHATSAPP_API_URL")
// 	}
// 	payload := map[string]string{"to": receiver, "from": p.From, "message": message}
// 	body, err := json.Marshal(payload)
// 	if err != nil {
// 		return err
// 	}
// 	req, err := http.NewRequest(http.MethodPost, p.APIURL, bytes.NewReader(body))
// 	if err != nil {
// 		return err
// 	}
// 	req.Header.Set("Content-Type", "application/json")
// 	if p.Token != "" {
// 		req.Header.Set("Authorization", "Bearer "+p.Token)
// 	}

// 	resp, err := http.DefaultClient.Do(req)
// 	if err != nil {
// 		return fmt.Errorf("whatsapp provider request failed: %w", err)
// 	}
// 	defer resp.Body.Close()
// 	if resp.StatusCode >= 300 {
// 		respBody, _ := io.ReadAll(resp.Body)
// 		return fmt.Errorf("whatsapp provider error (status %d): %s", resp.StatusCode, string(respBody))
// 	}
// 	return nil
// }

// func (p MetaWhatsAppCloudProvider) SendMessage(receiver, message string) error {
// 	if p.Token == "" || p.PhoneNumberID == "" {
// 		return fmt.Errorf("Meta WhatsApp Cloud API configuration missing - check WHATSAPP_CLOUD_API_TOKEN and WHATSAPP_PHONE_NUMBER_ID")
// 	}
// 	apiURL := p.APIURL
// 	if apiURL == "" {
// 		apiURL = fmt.Sprintf("https://graph.facebook.com/%s/%s/messages", p.APIVersion, p.PhoneNumberID)
// 	}

// 	payload, err := p.payload(receiver, message)
// 	if err != nil {
// 		return err
// 	}
// 	body, err := json.Marshal(payload)
// 	if err != nil {
// 		return err
// 	}
// 	req, err := http.NewRequest(http.MethodPost, apiURL, bytes.NewReader(body))
// 	if err != nil {
// 		return err
// 	}
// 	req.Header.Set("Authorization", "Bearer "+p.Token)
// 	req.Header.Set("Content-Type", "application/json")

// 	client := p.Client
// 	if client == nil {
// 		client = http.DefaultClient
// 	}
// 	resp, err := client.Do(req)
// 	if err != nil {
// 		return fmt.Errorf("Meta WhatsApp Cloud API request failed: %w", err)
// 	}
// 	defer resp.Body.Close()
// 	if resp.StatusCode >= 300 {
// 		respBody, _ := io.ReadAll(resp.Body)
// 		return fmt.Errorf("Meta WhatsApp Cloud API error (status %d): %s", resp.StatusCode, string(respBody))
// 	}
// 	return nil
// }

// func (p MetaWhatsAppCloudProvider) payload(receiver, message string) (map[string]interface{}, error) {
// 	messageType := strings.ToLower(firstNonEmpty(p.MessageType, "text"))
// 	switch messageType {
// 	case "text":
// 		return map[string]interface{}{
// 			"messaging_product": "whatsapp",
// 			"recipient_type":    "individual",
// 			"to":                receiver,
// 			"type":              "text",
// 			"text": map[string]interface{}{
// 				"preview_url": false,
// 				"body":        message,
// 			},
// 		}, nil
// 	case "template":
// 		if p.TemplateName == "" {
// 			return nil, fmt.Errorf("Meta WhatsApp Cloud API template configuration missing - check WHATSAPP_TEMPLATE_NAME")
// 		}
// 		return map[string]interface{}{
// 			"messaging_product": "whatsapp",
// 			"recipient_type":    "individual",
// 			"to":                receiver,
// 			"type":              "template",
// 			"template": map[string]interface{}{
// 				"name": p.TemplateName,
// 				"language": map[string]interface{}{
// 					"code": firstNonEmpty(p.LanguageCode, "en_US"),
// 				},
// 			},
// 		}, nil
// 	default:
// 		return nil, fmt.Errorf("unsupported WHATSAPP_MESSAGE_TYPE %q (allowed: text, template)", p.MessageType)
// 	}
// }

// // sendWhatsApp is kept for backward compatibility with older tests/callers.
// func sendWhatsApp(receiver, message string) error {
// 	return NewWhatsAppProviderFromEnv().SendMessage(receiver, message)
// }

// func firstNonEmpty(values ...string) string {
// 	for _, value := range values {
// 		if value != "" {
// 			return value
// 		}
// 	}
// 	return ""
// }

package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"strings"
)

type WhatsAppProvider interface {
	SendMessage(receiver, message string) error
}

type MockWhatsAppProvider struct{}

func (MockWhatsAppProvider) SendMessage(receiver, message string) error {
	log.Printf("mock whatsapp accepted receiver=%s bytes=%d", receiver, len(message))
	return nil
}

type HTTPWhatsAppProvider struct {
	APIURL string
	Token  string
	From   string
}

type MetaWhatsAppCloudProvider struct {
	APIURL        string
	Token         string
	PhoneNumberID string
	APIVersion    string
	MessageType   string
	TemplateName  string
	LanguageCode  string
	// TemplateIncludeMessage, when true, sends the notification's message
	// text as the template's first body parameter ({{1}}). Only enable
	// this for templates that actually declare a body variable - Meta's
	// stock "hello_world" sample template has none, and will reject the
	// call if components are attached to it.
	TemplateIncludeMessage bool
	Client                 *http.Client
}

func NewWhatsAppProviderFromEnv() WhatsAppProvider {
	provider := strings.ToLower(firstNonEmpty(os.Getenv("WHATSAPP_PROVIDER"), inferredWhatsAppProvider()))
	switch provider {
	case "", "mock", "local":
		return MockWhatsAppProvider{}
	case "http":
		return HTTPWhatsAppProvider{
			APIURL: envValue("WHATSAPP_API_URL"),
			Token:  envValue("WHATSAPP_API_TOKEN"),
			From:   envValue("WHATSAPP_FROM"),
		}
	case "meta", "cloud", "meta_cloud", "whatsapp_cloud":
		return MetaWhatsAppCloudProvider{
			APIURL:                 firstNonEmpty(envValue("WHATSAPP_CLOUD_API_URL"), envValue("WHATSAPP_API_URL")),
			Token:                  firstNonEmpty(envValue("WHATSAPP_CLOUD_API_TOKEN"), envValue("WHATSAPP_API_TOKEN"), envValue("TOKEN")),
			PhoneNumberID:          firstNonEmpty(envValue("WHATSAPP_PHONE_NUMBER_ID"), envValue("PHONE_NUMBER_ID"), envValue("WHATSAPP_FROM")),
			APIVersion:             firstNonEmpty(envValue("WHATSAPP_GRAPH_API_VERSION"), envValue("GRAPH_API_VERSION"), "v25.0"),
			MessageType:            firstNonEmpty(envValue("WHATSAPP_MESSAGE_TYPE"), "text"),
			TemplateName:           envValue("WHATSAPP_TEMPLATE_NAME"),
			LanguageCode:           firstNonEmpty(envValue("WHATSAPP_TEMPLATE_LANGUAGE"), "en_US"),
			TemplateIncludeMessage: envBool("WHATSAPP_TEMPLATE_INCLUDE_MESSAGE", false),
		}
	default:
		return MockWhatsAppProvider{}
	}
}

func WhatsAppProviderSummaryFromEnv() string {
	provider := strings.ToLower(firstNonEmpty(os.Getenv("WHATSAPP_PROVIDER"), inferredWhatsAppProvider(), "mock"))
	switch provider {
	case "meta", "cloud", "meta_cloud", "whatsapp_cloud":
		phoneNumberID := firstNonEmpty(envValue("WHATSAPP_PHONE_NUMBER_ID"), envValue("PHONE_NUMBER_ID"), envValue("WHATSAPP_FROM"))
		return fmt.Sprintf("provider=meta api_version=%s message_type=%s template=%s template_includes_message=%t phone_number_id_configured=%t phone_number_id_numeric=%t token_configured=%t token_source=%s",
			firstNonEmpty(envValue("WHATSAPP_GRAPH_API_VERSION"), envValue("GRAPH_API_VERSION"), "v25.0"),
			firstNonEmpty(envValue("WHATSAPP_MESSAGE_TYPE"), "text"),
			envValue("WHATSAPP_TEMPLATE_NAME"),
			envBool("WHATSAPP_TEMPLATE_INCLUDE_MESSAGE", false),
			phoneNumberID != "",
			isDigits(phoneNumberID),
			firstNonEmpty(envValue("WHATSAPP_CLOUD_API_TOKEN"), envValue("WHATSAPP_API_TOKEN"), envValue("TOKEN")) != "",
			whatsAppTokenSourceFromEnv(),
		)
	case "http":
		return fmt.Sprintf("provider=http api_url_configured=%t token_configured=%t", envValue("WHATSAPP_API_URL") != "", envValue("WHATSAPP_API_TOKEN") != "")
	default:
		return "provider=mock"
	}
}

func inferredWhatsAppProvider() string {
	if firstNonEmpty(envValue("WHATSAPP_CLOUD_API_TOKEN"), envValue("WHATSAPP_API_TOKEN"), envValue("TOKEN")) != "" &&
		firstNonEmpty(envValue("WHATSAPP_PHONE_NUMBER_ID"), envValue("PHONE_NUMBER_ID"), envValue("WHATSAPP_FROM")) != "" {
		return "meta"
	}
	return ""
}

func (p HTTPWhatsAppProvider) SendMessage(receiver, message string) error {
	if p.APIURL == "" {
		return fmt.Errorf("WhatsApp HTTP provider configuration missing - check WHATSAPP_API_URL")
	}
	payload := map[string]string{"to": receiver, "from": p.From, "message": message}
	body, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	req, err := http.NewRequest(http.MethodPost, p.APIURL, bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	if p.Token != "" {
		req.Header.Set("Authorization", "Bearer "+p.Token)
	}

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return fmt.Errorf("whatsapp provider request failed: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		respBody, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("whatsapp provider error (status %d): %s", resp.StatusCode, string(respBody))
	}
	return nil
}

func (p MetaWhatsAppCloudProvider) SendMessage(receiver, message string) error {
	if p.Token == "" || p.PhoneNumberID == "" {
		return fmt.Errorf("Meta WhatsApp Cloud API configuration missing - check WHATSAPP_CLOUD_API_TOKEN and WHATSAPP_PHONE_NUMBER_ID")
	}
	apiURL := p.APIURL
	if apiURL == "" {
		apiURL = fmt.Sprintf("https://graph.facebook.com/%s/%s/messages", p.APIVersion, p.PhoneNumberID)
	}

	payload, err := p.payload(receiver, message)
	if err != nil {
		return err
	}
	body, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	req, err := http.NewRequest(http.MethodPost, apiURL, bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+p.Token)
	req.Header.Set("Content-Type", "application/json")

	client := p.Client
	if client == nil {
		client = http.DefaultClient
	}
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("Meta WhatsApp Cloud API request failed: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		respBody, _ := io.ReadAll(resp.Body)
		if resp.StatusCode == http.StatusUnauthorized {
			return fmt.Errorf("Meta WhatsApp Cloud API authentication failed (status 401): check WHATSAPP_CLOUD_API_TOKEN is a current Meta access token for phone_number_id %s, then restart the server. Response: %s", p.PhoneNumberID, string(respBody))
		}
		return fmt.Errorf("Meta WhatsApp Cloud API error (status %d): %s", resp.StatusCode, string(respBody))
	}
	return nil
}

func (p MetaWhatsAppCloudProvider) payload(receiver, message string) (map[string]interface{}, error) {
	messageType := strings.ToLower(firstNonEmpty(p.MessageType, "text"))
	switch messageType {
	case "text":
		return map[string]interface{}{
			"messaging_product": "whatsapp",
			"recipient_type":    "individual",
			"to":                receiver,
			"type":              "text",
			"text": map[string]interface{}{
				"preview_url": false,
				"body":        message,
			},
		}, nil
	case "template":
		if p.TemplateName == "" {
			return nil, fmt.Errorf("Meta WhatsApp Cloud API template configuration missing - check WHATSAPP_TEMPLATE_NAME")
		}
		template := map[string]interface{}{
			"name": p.TemplateName,
			"language": map[string]interface{}{
				"code": firstNonEmpty(p.LanguageCode, "en_US"),
			},
		}
		// Meta's stock "hello_world" sample template (and any other template
		// with no declared body variables) has no {{1}} placeholder to fill,
		// and rejects the call if "components" is attached. Only send the
		// notification text as a body parameter when explicitly opted in via
		// WHATSAPP_TEMPLATE_INCLUDE_MESSAGE=true, for templates you've
		// created with a body variable to receive it.
		if p.TemplateIncludeMessage {
			if message == "" {
				return nil, fmt.Errorf("Meta WhatsApp Cloud API template requires a non-empty message when WHATSAPP_TEMPLATE_INCLUDE_MESSAGE is enabled")
			}
			template["components"] = []map[string]interface{}{
				{
					"type": "body",
					"parameters": []map[string]interface{}{
						{"type": "text", "text": message},
					},
				},
			}
		}
		return map[string]interface{}{
			"messaging_product": "whatsapp",
			"recipient_type":    "individual",
			"to":                receiver,
			"type":              "template",
			"template":          template,
		}, nil
	default:
		return nil, fmt.Errorf("unsupported WHATSAPP_MESSAGE_TYPE %q (allowed: text, template)", p.MessageType)
	}
}

// sendWhatsApp is kept for backward compatibility with older tests/callers.
func sendWhatsApp(receiver, message string) error {
	return NewWhatsAppProviderFromEnv().SendMessage(receiver, message)
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		value = normalizeEnvValue(value)
		if value != "" {
			return value
		}
	}
	return ""
}

func envValue(key string) string {
	return normalizeEnvValue(os.Getenv(key))
}

func normalizeEnvValue(value string) string {
	value = strings.TrimSpace(value)
	value = strings.Trim(value, `"'`)
	return strings.TrimSpace(value)
}

func whatsAppTokenSourceFromEnv() string {
	for _, key := range []string{"WHATSAPP_CLOUD_API_TOKEN", "WHATSAPP_API_TOKEN", "TOKEN"} {
		if envValue(key) != "" {
			return key
		}
	}
	return "none"
}

func isDigits(value string) bool {
	if value == "" {
		return false
	}
	for _, r := range value {
		if r < '0' || r > '9' {
			return false
		}
	}
	return true
}
