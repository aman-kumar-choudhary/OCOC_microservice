package main

import (
	"bytes"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"
	"time"
)

// mockChannel is a NotificationChannel test double. It always returns
// failWith (nil for success) and records every receiver it was called with,
// so tests never need real SMTP/Twilio credentials.
type mockChannel struct {
	mu        sync.Mutex
	failWith  error
	failures  int
	transient bool
	calls     []string
	messages  []string
}

func (m *mockChannel) Send(receiver, _ string, message string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.calls = append(m.calls, receiver)
	m.messages = append(m.messages, message)
	if m.failures > 0 {
		m.failures--
		return m.failWith
	}
	if m.transient {
		return nil
	}
	return m.failWith
}

func (m *mockChannel) callCount() int {
	m.mu.Lock()
	defer m.mu.Unlock()
	return len(m.calls)
}

func newTestService(emailErr, whatsappErr error) (*NotificationService, *mockChannel, *mockChannel) {
	email := &mockChannel{failWith: emailErr}
	whatsapp := &mockChannel{failWith: whatsappErr}
	svc := NewNotificationService(map[string]NotificationChannel{
		"email":    email,
		"whatsapp": whatsapp,
	})
	svc.retryDelay = 0
	svc.asyncProcessing = false
	return svc, email, whatsapp
}

func countByStatus(results []DeliveryResult, status DeliveryStatus) int {
	n := 0
	for _, r := range results {
		if r.Status == status {
			n++
		}
	}
	return n
}

// Scenario 1: one sender -> one receiver -> one channel.
func TestScenario1_SingleReceiverSingleChannel(t *testing.T) {
	svc, email, _ := newTestService(nil, nil)

	req := NotificationRequest{
		SenderID: "admin",
		Message:  "hello",
		Recipients: []Recipient{
			{UserID: "user_a", Email: "usera@example.com", Channels: []string{"email"}},
		},
	}

	resp := svc.ProcessNotification(req)

	if resp.TotalDeliveries != 1 || resp.SuccessfulDeliveries != 1 || resp.FailedDeliveries != 0 {
		t.Fatalf("unexpected response: %+v", resp)
	}
	if resp.Status != NotificationCompleted {
		t.Errorf("expected status completed, got %s", resp.Status)
	}
	if email.callCount() != 1 {
		t.Errorf("expected 1 email call, got %d", email.callCount())
	}
}

// Scenario 2: one sender -> multiple receivers (mixed channels).
func TestScenario2_MultipleReceivers(t *testing.T) {
	svc, email, whatsapp := newTestService(nil, nil)

	req := NotificationRequest{
		SenderID: "admin",
		Message:  "hello",
		Recipients: []Recipient{
			{UserID: "user_a", Email: "a@example.com", Channels: []string{"email"}},
			{UserID: "user_b", Email: "b@example.com", Channels: []string{"email"}},
			{UserID: "user_c", Phone: "+919876543210", Channels: []string{"whatsapp"}},
		},
	}

	resp := svc.ProcessNotification(req)

	if resp.TotalDeliveries != 3 || resp.SuccessfulDeliveries != 3 {
		t.Fatalf("unexpected response: %+v", resp)
	}
	if email.callCount() != 2 {
		t.Errorf("expected 2 email calls, got %d", email.callCount())
	}
	if whatsapp.callCount() != 1 {
		t.Errorf("expected 1 whatsapp call, got %d", whatsapp.callCount())
	}
}

// Scenario 3: one receiver -> two channels (both attempted independently).
func TestScenario3_OneReceiverTwoChannels(t *testing.T) {
	svc, email, whatsapp := newTestService(nil, nil)

	req := NotificationRequest{
		SenderID: "admin",
		Message:  "hello",
		Recipients: []Recipient{
			{UserID: "user_a", Email: "a@example.com", Phone: "+919876543210", Channels: []string{"email", "whatsapp"}},
		},
	}

	resp := svc.ProcessNotification(req)

	if resp.TotalRecipients != 1 || resp.TotalDeliveries != 2 || resp.SuccessfulDeliveries != 2 {
		t.Fatalf("unexpected response: %+v", resp)
	}
	if email.callCount() != 1 || whatsapp.callCount() != 1 {
		t.Errorf("expected 1 call each, got email=%d whatsapp=%d", email.callCount(), whatsapp.callCount())
	}
}

// Scenario 4: multiple recipients with different channel combinations.
func TestScenario4_MultipleReceiversDifferentChannels(t *testing.T) {
	svc, email, whatsapp := newTestService(nil, nil)

	req := NotificationRequest{
		SenderID: "admin_001",
		Message:  "meeting reminder",
		Recipients: []Recipient{
			{UserID: "user_101", Email: "u101@example.com", Phone: "+919876543210", Channels: []string{"email", "whatsapp"}},
			{UserID: "user_102", Email: "u102@example.com", Channels: []string{"email"}},
			{UserID: "user_103", Phone: "+919876543211", Channels: []string{"whatsapp"}},
			{UserID: "user_104", Email: "u104@example.com", Phone: "+919876543212", Channels: []string{"email", "whatsapp"}},
		},
	}

	resp := svc.ProcessNotification(req)

	if resp.TotalRecipients != 4 {
		t.Errorf("expected 4 recipients, got %d", resp.TotalRecipients)
	}
	if resp.TotalDeliveries != 6 {
		t.Errorf("expected 6 deliveries, got %d", resp.TotalDeliveries)
	}
	if resp.SuccessfulDeliveries != 6 {
		t.Errorf("expected 6 successful deliveries, got %d", resp.SuccessfulDeliveries)
	}
	if email.callCount() != 3 {
		t.Errorf("expected 3 email calls, got %d", email.callCount())
	}
	if whatsapp.callCount() != 3 {
		t.Errorf("expected 3 whatsapp calls, got %d", whatsapp.callCount())
	}
}

// Scenario 5: sender dynamically selects recipients + channels + content,
// exercised through the full validate -> process pipeline.
func TestScenario5_DynamicSenderRecipientsChannels(t *testing.T) {
	svc, _, _ := newTestService(nil, nil)

	req := NotificationRequest{
		SenderID: "admin_001",
		Subject:  "Meeting Reminder",
		Message:  "Your meeting is scheduled for 10 AM.",
		Recipients: []Recipient{
			{UserID: "user_001", Email: "u1@example.com", Phone: "+919876543210", Channels: []string{"email", "whatsapp"}},
			{UserID: "user_002", Email: "u2@example.com", Channels: []string{"email"}},
			{UserID: "user_003", Phone: "+919876543211", Channels: []string{"whatsapp"}},
		},
	}

	if err := validateRequest(req); err != nil {
		t.Fatalf("expected request to be valid, got error: %v", err)
	}

	resp := svc.ProcessNotification(req)
	if resp.TotalDeliveries != 4 {
		t.Fatalf("expected 4 deliveries, got %d", resp.TotalDeliveries)
	}
}

// Partial failure: one channel failing must not cancel or hide the success
// of another delivery, and the notification status must reflect the mix.
func TestPartialFailure(t *testing.T) {
	svc, _, _ := newTestService(nil, errors.New("provider error"))

	req := NotificationRequest{
		SenderID: "admin",
		Message:  "hello",
		Recipients: []Recipient{
			{UserID: "user_a", Email: "a@example.com", Phone: "+919876543210", Channels: []string{"email", "whatsapp"}},
			{UserID: "user_b", Email: "b@example.com", Channels: []string{"email"}},
			{UserID: "user_c", Phone: "+919876543211", Channels: []string{"whatsapp"}},
		},
	}

	resp := svc.ProcessNotification(req)

	if resp.Status != NotificationPartiallyCompleted {
		t.Errorf("expected partially_completed, got %s", resp.Status)
	}
	if resp.Success {
		t.Errorf("expected success=false when any delivery fails")
	}
	if got := countByStatus(resp.Results, DeliverySent); got != 2 {
		t.Errorf("expected 2 sent deliveries, got %d", got)
	}
	if got := countByStatus(resp.Results, DeliveryFailed); got != 2 {
		t.Errorf("expected 2 failed deliveries, got %d", got)
	}
}

// All deliveries failing should report status "failed", not partial.
func TestAllFail(t *testing.T) {
	svc, _, _ := newTestService(errors.New("smtp down"), errors.New("twilio down"))

	req := NotificationRequest{
		SenderID: "admin",
		Message:  "hello",
		Recipients: []Recipient{
			{UserID: "user_a", Email: "a@example.com", Channels: []string{"email"}},
			{UserID: "user_b", Phone: "+919876543210", Channels: []string{"whatsapp"}},
		},
	}

	resp := svc.ProcessNotification(req)

	if resp.Status != NotificationFailed {
		t.Errorf("expected failed, got %s", resp.Status)
	}
	if resp.SuccessfulDeliveries != 0 || resp.FailedDeliveries != 2 {
		t.Errorf("unexpected counts: %+v", resp)
	}
}

// Legacy single channel/receiver requests should still work end-to-end.
func TestBackwardCompatibility_LegacyShape(t *testing.T) {
	svc, email, _ := newTestService(nil, nil)

	req := NotificationRequest{
		SenderID: "user_001",
		Channel:  "email",
		Receiver: "person1@gmail.com",
		Subject:  "Test",
		Message:  "hello",
	}

	normalizeRequest(&req)
	if err := validateRequest(req); err != nil {
		t.Fatalf("expected legacy request to validate, got: %v", err)
	}
	if len(req.Recipients) != 1 || req.Recipients[0].Email != "person1@gmail.com" {
		t.Fatalf("normalizeRequest did not produce expected recipient: %+v", req.Recipients)
	}

	resp := svc.ProcessNotification(req)
	if resp.TotalDeliveries != 1 || resp.SuccessfulDeliveries != 1 {
		t.Fatalf("unexpected response: %+v", resp)
	}
	if email.callCount() != 1 {
		t.Errorf("expected 1 email call, got %d", email.callCount())
	}
}

func TestValidation(t *testing.T) {
	valid := func() NotificationRequest {
		return NotificationRequest{
			SenderID: "admin",
			Message:  "hi",
			Recipients: []Recipient{
				{UserID: "u1", Email: "u1@example.com", Channels: []string{"email"}},
			},
		}
	}

	cases := []struct {
		name    string
		mutate  func(*NotificationRequest)
		wantErr bool
	}{
		{"valid request", func(r *NotificationRequest) {}, false},
		{"empty sender", func(r *NotificationRequest) { r.SenderID = "" }, true},
		{"empty message", func(r *NotificationRequest) { r.Message = "" }, true},
		{"empty recipients", func(r *NotificationRequest) { r.Recipients = nil }, true},
		{"empty user_id", func(r *NotificationRequest) { r.Recipients[0].UserID = "" }, true},
		{"empty channels", func(r *NotificationRequest) { r.Recipients[0].Channels = nil }, true},
		{"invalid channel", func(r *NotificationRequest) { r.Recipients[0].Channels = []string{"sms"} }, true},
		{"invalid email", func(r *NotificationRequest) { r.Recipients[0].Email = "not-an-email" }, true},
		{"invalid phone", func(r *NotificationRequest) {
			r.Recipients[0].Channels = []string{"whatsapp"}
			r.Recipients[0].Phone = "12345"
		}, true},
		{"duplicate channels", func(r *NotificationRequest) {
			r.Recipients[0].Channels = []string{"email", "email"}
		}, true},
		{"duplicate recipients", func(r *NotificationRequest) {
			r.Recipients = append(r.Recipients, r.Recipients[0])
		}, true},
		{"valid whatsapp", func(r *NotificationRequest) {
			r.Recipients[0].Channels = []string{"whatsapp"}
			r.Recipients[0].Phone = "+919876543210"
		}, false},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			req := valid()
			tc.mutate(&req)
			err := validateRequest(req)
			if tc.wantErr && err == nil {
				t.Errorf("expected an error, got nil")
			}
			if !tc.wantErr && err != nil {
				t.Errorf("expected no error, got: %v", err)
			}
		})
	}
}

func TestTemplateRenderingAndEventSelection(t *testing.T) {
	svc, email, _ := newTestService(nil, nil)
	tmpl := Template{
		ID: "leave_approved", Name: "Leave Approved", EventType: "leave.approved",
		Subject:         "Leave Approved",
		Body:            "Dear {{parent_name}}, {{student_name}} leave is approved.",
		AllowedChannels: []string{"email"}, Enabled: true,
	}
	if err := svc.templates.Create(tmpl); err != nil {
		t.Fatal(err)
	}
	req := NotificationRequest{
		SenderID: "admin", EventType: "leave.approved",
		Variables:  map[string]string{"parent_name": "Parent", "student_name": "Student"},
		Recipients: []Recipient{{UserID: "u1", Email: "u1@example.com", Channels: []string{"email"}}},
	}
	if err := validateRequest(req); err != nil {
		t.Fatal(err)
	}
	resp, appErr := svc.ProcessNotificationWithError(req)
	if appErr != nil {
		t.Fatalf("unexpected error: %v", appErr)
	}
	if resp.SuccessfulDeliveries != 1 || email.callCount() != 1 {
		t.Fatalf("expected one rendered email delivery, resp=%+v calls=%d", resp, email.callCount())
	}
	if email.messages[0] != "Dear Parent, Student leave is approved." {
		t.Fatalf("unexpected rendered body: %q", email.messages[0])
	}
}

func TestEmailTemplateMirrorsToWhatsAppWithSameRenderedMessage(t *testing.T) {
	svc, email, whatsapp := newTestService(nil, nil)
	tmpl := Template{
		ID: "leave_approved", Name: "Leave Approved", EventType: "leave.approved",
		Subject:         "Leave Approved",
		Body:            "Dear {{parent_name}}, {{student_name}} leave is approved.",
		AllowedChannels: []string{"email"}, Enabled: true,
	}
	if err := svc.templates.Create(tmpl); err != nil {
		t.Fatal(err)
	}

	resp, appErr := svc.ProcessNotificationWithError(NotificationRequest{
		SenderID:  "admin",
		EventType: "leave.approved",
		Variables: map[string]string{
			"parent_name":  "Parent",
			"student_name": "Student",
		},
		Recipients: []Recipient{{
			UserID:   "u1",
			Email:    "u1@example.com",
			Phone:    "+919876543210",
			Channels: []string{"email"},
		}},
	})
	if appErr != nil {
		t.Fatalf("unexpected error: %v", appErr)
	}
	if resp.TotalDeliveries != 2 || email.callCount() != 1 || whatsapp.callCount() != 1 {
		t.Fatalf("expected email and whatsapp deliveries, resp=%+v email=%d whatsapp=%d", resp, email.callCount(), whatsapp.callCount())
	}
	want := "Dear Parent, Student leave is approved."
	if email.messages[0] != want || whatsapp.messages[0] != want {
		t.Fatalf("expected same rendered message, email=%q whatsapp=%q", email.messages[0], whatsapp.messages[0])
	}
}

func TestEmailMirrorSkipsWhatsAppWhenPhoneMissing(t *testing.T) {
	svc, email, whatsapp := newTestService(nil, nil)

	resp := svc.ProcessNotification(NotificationRequest{
		SenderID: "admin",
		Subject:  "Leave Approved",
		Message:  "Your leave is approved.",
		Recipients: []Recipient{{
			UserID:   "u1",
			Email:    "u1@example.com",
			Channels: []string{"email"},
		}},
	})

	if resp.TotalDeliveries != 1 || email.callCount() != 1 || whatsapp.callCount() != 0 {
		t.Fatalf("expected only email delivery without phone, resp=%+v email=%d whatsapp=%d", resp, email.callCount(), whatsapp.callCount())
	}
}

func TestMissingTemplateVariable(t *testing.T) {
	svc, email, _ := newTestService(nil, nil)
	_ = svc.templates.Create(Template{ID: "t1", Name: "T", EventType: "e", Body: "Hi {{name}}", AllowedChannels: []string{"email"}, Enabled: true})
	req := NotificationRequest{
		SenderID: "admin", TemplateID: "t1",
		Recipients: []Recipient{{UserID: "u1", Email: "u1@example.com", Channels: []string{"email"}}},
	}
	_, appErr := svc.ProcessNotificationWithError(req)
	if appErr == nil || appErr.Kind != ErrorTemplate {
		t.Fatalf("expected template error, got %v", appErr)
	}
	if email.callCount() != 0 {
		t.Fatalf("expected no provider call on template error")
	}
}

func TestRecipientPreferencesDisableChannel(t *testing.T) {
	svc, email, whatsapp := newTestService(nil, nil)
	svc.preferences.Put(NotificationPreference{UserID: "u1", EmailEnabled: true, WhatsAppEnabled: false})
	resp := svc.ProcessNotification(NotificationRequest{
		SenderID: "admin", Message: "hello",
		Recipients: []Recipient{{UserID: "u1", Email: "u1@example.com", Phone: "+919876543210", Channels: []string{"email", "whatsapp"}}},
	})
	if resp.TotalDeliveries != 1 || email.callCount() != 1 || whatsapp.callCount() != 0 {
		t.Fatalf("preference routing failed: resp=%+v email=%d whatsapp=%d", resp, email.callCount(), whatsapp.callCount())
	}
}

func TestRetryOnProviderFailure(t *testing.T) {
	email := &mockChannel{failWith: errors.New("temporary"), failures: 2, transient: true}
	svc := NewNotificationService(map[string]NotificationChannel{"email": email})
	svc.retryDelay = 0
	svc.maxRetries = 3
	svc.asyncProcessing = false
	resp := svc.ProcessNotification(NotificationRequest{
		SenderID: "admin", Message: "hello",
		Recipients: []Recipient{{UserID: "u1", Email: "u1@example.com", Channels: []string{"email"}}},
	})
	if !resp.Success || email.callCount() != 3 || resp.Results[0].AttemptCount != 3 {
		t.Fatalf("expected retry then success, resp=%+v calls=%d", resp, email.callCount())
	}
	attempts := svc.attempts.ListByDelivery(resp.Results[0].DeliveryID)
	if len(attempts) != 3 {
		t.Fatalf("expected 3 persisted delivery attempts, got %d", len(attempts))
	}
	if attempts[0].Status != string(DeliveryFailed) || attempts[2].Status != string(DeliverySent) {
		t.Fatalf("unexpected attempt status history: %+v", attempts)
	}
}

func TestAsyncProcessingQueuesDeliveries(t *testing.T) {
	svc, _, _ := newTestService(nil, nil)
	svc.asyncProcessing = true

	resp := svc.ProcessNotification(NotificationRequest{
		SenderID: "admin", Message: "hello",
		Recipients: []Recipient{{UserID: "u1", Email: "u1@example.com", Channels: []string{"email"}}},
	})

	if !resp.Success || resp.Status != NotificationQueued || resp.Results[0].Status != DeliveryQueued {
		t.Fatalf("expected accepted queued response, got %+v", resp)
	}
	if _, ok := svc.deliveries.Get(resp.Results[0].DeliveryID); !ok {
		t.Fatalf("queued delivery was not stored")
	}
	deadline := time.Now().Add(time.Second)
	for time.Now().Before(deadline) {
		if n, ok := svc.notifications.Get(resp.NotificationID); ok && n.Status == NotificationCompleted {
			return
		}
		time.Sleep(time.Millisecond)
	}
	n, _ := svc.notifications.Get(resp.NotificationID)
	t.Fatalf("expected async notification to roll up to completed, got %+v", n)
}

func TestDeduplicationReturnsExistingNotification(t *testing.T) {
	svc, email, _ := newTestService(nil, nil)
	req := NotificationRequest{
		SenderID: "admin", Message: "hello", EventID: "event-1",
		Recipients: []Recipient{{UserID: "u1", Email: "u1@example.com", Channels: []string{"email"}}},
	}
	first, err := svc.ProcessNotificationWithError(req)
	if err != nil {
		t.Fatal(err)
	}
	second, dupErr := svc.ProcessNotificationWithError(req)
	if dupErr == nil || dupErr.Kind != ErrorDuplicate {
		t.Fatalf("expected duplicate error, got %v", dupErr)
	}
	if first.NotificationID != second.NotificationID || !second.Duplicate || email.callCount() != 1 {
		t.Fatalf("dedup failed first=%+v second=%+v calls=%d", first, second, email.callCount())
	}
}

func TestRateLimiting(t *testing.T) {
	svc, _, _ := newTestService(nil, nil)
	svc.rateLimiter = NewRateLimiter(1)
	req := NotificationRequest{
		SenderID: "admin", Message: "hello",
		Recipients: []Recipient{{UserID: "u1", Email: "u1@example.com", Channels: []string{"email"}}},
	}
	if _, err := svc.ProcessNotificationWithError(req); err != nil {
		t.Fatal(err)
	}
	if _, err := svc.ProcessNotificationWithError(req); err == nil || err.Kind != ErrorRateLimit {
		t.Fatalf("expected rate limit error, got %v", err)
	}
}

func TestTrackingRepositories(t *testing.T) {
	svc, _, _ := newTestService(nil, nil)
	resp := svc.ProcessNotification(NotificationRequest{
		SenderID: "admin", Message: "hello",
		Recipients: []Recipient{{UserID: "u1", Email: "u1@example.com", Channels: []string{"email"}}},
	})
	if _, ok := svc.notifications.Get(resp.NotificationID); !ok {
		t.Fatalf("notification was not stored")
	}
	if _, ok := svc.deliveries.Get(resp.Results[0].DeliveryID); !ok {
		t.Fatalf("delivery was not stored")
	}
	if got := svc.deliveries.ListByNotification(resp.NotificationID); len(got) != 1 {
		t.Fatalf("expected one delivery, got %d", len(got))
	}
}

func TestTemplateCRUDAndAuthorizationHandlers(t *testing.T) {
	svc, _, _ := newTestService(nil, nil)
	body := bytes.NewBufferString(`{"id":"t1","name":"T","event_type":"e","subject":"S","body":"B","allowed_channels":["email"]}`)
	req := httptest.NewRequest(http.MethodPost, "/api/v1/notification-templates", body)
	rec := httptest.NewRecorder()
	templateCollectionHandler(svc).ServeHTTP(rec, req)
	if rec.Code != http.StatusForbidden {
		t.Fatalf("expected forbidden without admin, got %d", rec.Code)
	}

	body = bytes.NewBufferString(`{"id":"t1","name":"T","event_type":"e","subject":"S","body":"B","allowed_channels":["email"]}`)
	req = httptest.NewRequest(http.MethodPost, "/api/v1/notification-templates", body)
	req.Header.Set("X-User-Role", "admin")
	rec = httptest.NewRecorder()
	templateCollectionHandler(svc).ServeHTTP(rec, req)
	if rec.Code != http.StatusCreated {
		t.Fatalf("expected created, got %d body=%s", rec.Code, rec.Body.String())
	}
	getReq := httptest.NewRequest(http.MethodGet, "/api/v1/notification-templates/t1", nil)
	getRec := httptest.NewRecorder()
	templateItemHandler(svc).ServeHTTP(getRec, getReq)
	if getRec.Code != http.StatusOK {
		t.Fatalf("expected get ok, got %d", getRec.Code)
	}
	var tmpl Template
	if err := json.NewDecoder(getRec.Body).Decode(&tmpl); err != nil || tmpl.ID != "t1" {
		t.Fatalf("unexpected template response: %+v err=%v", tmpl, err)
	}
}

func TestBroadcastAuthorization(t *testing.T) {
	svc, _, _ := newTestService(nil, nil)
	req := httptest.NewRequest(http.MethodPost, "/api/v1/notifications/broadcast", bytes.NewBufferString(`{}`))
	rec := httptest.NewRecorder()
	broadcastHandler(svc).ServeHTTP(rec, req)
	if rec.Code != http.StatusForbidden {
		t.Fatalf("expected forbidden, got %d", rec.Code)
	}
}

func TestSendNotificationHandlerReturnsAcceptedQueued(t *testing.T) {
	email := &mockChannel{}
	svc := NewNotificationService(map[string]NotificationChannel{"email": email})
	svc.retryDelay = 0
	svc.asyncProcessing = true

	body := bytes.NewBufferString(`{
		"sender_id":"admin",
		"message":"hello",
		"recipients":[{"user_id":"u1","email":"u1@example.com","channels":["email"]}]
	}`)
	req := httptest.NewRequest(http.MethodPost, "/api/v1/notifications/send", body)
	rec := httptest.NewRecorder()

	sendNotificationHandler(svc).ServeHTTP(rec, req)

	if rec.Code != http.StatusAccepted {
		t.Fatalf("expected 202 Accepted, got %d body=%s", rec.Code, rec.Body.String())
	}
	var resp NotificationResponse
	if err := json.NewDecoder(rec.Body).Decode(&resp); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if resp.Status != NotificationQueued || resp.TotalDeliveries != 1 {
		t.Fatalf("expected queued response with one delivery, got %+v", resp)
	}
	if _, ok := svc.notifications.Get(resp.NotificationID); !ok {
		t.Fatalf("notification was not persisted")
	}
}

func TestMetaWhatsAppCloudProviderSendsGraphPayload(t *testing.T) {
	var gotAuth string
	var gotPayload map[string]interface{}
	client := &http.Client{Transport: roundTripFunc(func(r *http.Request) (*http.Response, error) {
		if r.Method != http.MethodPost {
			t.Errorf("expected POST, got %s", r.Method)
		}
		gotAuth = r.Header.Get("Authorization")
		body, err := io.ReadAll(r.Body)
		if err != nil {
			t.Fatalf("read body: %v", err)
		}
		if err := json.Unmarshal(body, &gotPayload); err != nil {
			t.Fatalf("unmarshal body: %v", err)
		}
		return &http.Response{
			StatusCode: http.StatusOK,
			Body:       io.NopCloser(bytes.NewBufferString(`{"messages":[{"id":"wamid.test"}]}`)),
			Header:     make(http.Header),
		}, nil
	})}

	provider := MetaWhatsAppCloudProvider{
		APIURL:        "https://graph.facebook.test/v20.0/1234567890/messages",
		Token:         "test-token",
		PhoneNumberID: "1234567890",
		APIVersion:    "v20.0",
		Client:        client,
	}
	if err := provider.SendMessage("+919876543210", "hello from meta"); err != nil {
		t.Fatalf("SendMessage returned error: %v", err)
	}

	if gotAuth != "Bearer test-token" {
		t.Fatalf("unexpected auth header: %q", gotAuth)
	}
	if gotPayload["messaging_product"] != "whatsapp" || gotPayload["to"] != "+919876543210" || gotPayload["type"] != "text" {
		t.Fatalf("unexpected payload: %+v", gotPayload)
	}
	text, ok := gotPayload["text"].(map[string]interface{})
	if !ok || text["body"] != "hello from meta" || text["preview_url"] != false {
		t.Fatalf("unexpected text payload: %+v", gotPayload["text"])
	}
}

func TestMetaWhatsAppCloudProviderSendsTemplatePayload(t *testing.T) {
	var gotPayload map[string]interface{}
	client := &http.Client{Transport: roundTripFunc(func(r *http.Request) (*http.Response, error) {
		body, err := io.ReadAll(r.Body)
		if err != nil {
			t.Fatalf("read body: %v", err)
		}
		if err := json.Unmarshal(body, &gotPayload); err != nil {
			t.Fatalf("unmarshal body: %v", err)
		}
		return &http.Response{
			StatusCode: http.StatusOK,
			Body:       io.NopCloser(bytes.NewBufferString(`{"messages":[{"id":"wamid.test"}]}`)),
			Header:     make(http.Header),
		}, nil
	})}

	provider := MetaWhatsAppCloudProvider{
		APIURL:        "https://graph.facebook.test/v25.0/1234567890/messages",
		Token:         "test-token",
		PhoneNumberID: "1234567890",
		APIVersion:    "v25.0",
		MessageType:   "template",
		TemplateName:  "hello_world",
		LanguageCode:  "en_US",
		Client:        client,
	}
	if err := provider.SendMessage("+919876543210", "ignored for template"); err != nil {
		t.Fatalf("SendMessage returned error: %v", err)
	}

	if gotPayload["messaging_product"] != "whatsapp" || gotPayload["to"] != "+919876543210" || gotPayload["type"] != "template" {
		t.Fatalf("unexpected payload: %+v", gotPayload)
	}
	template, ok := gotPayload["template"].(map[string]interface{})
	if !ok || template["name"] != "hello_world" {
		t.Fatalf("unexpected template payload: %+v", gotPayload["template"])
	}
	language, ok := template["language"].(map[string]interface{})
	if !ok || language["code"] != "en_US" {
		t.Fatalf("unexpected template language payload: %+v", template["language"])
	}
}

func TestWhatsAppProviderFromEnvAcceptsMetaAliases(t *testing.T) {
	t.Setenv("WHATSAPP_PROVIDER", "meta")
	t.Setenv("TOKEN", "test-token")
	t.Setenv("PHONE_NUMBER_ID", "1234567890")
	t.Setenv("GRAPH_API_VERSION", "v25.0")
	t.Setenv("WHATSAPP_MESSAGE_TYPE", "template")
	t.Setenv("WHATSAPP_TEMPLATE_NAME", "hello_world")

	provider, ok := NewWhatsAppProviderFromEnv().(MetaWhatsAppCloudProvider)
	if !ok {
		t.Fatalf("expected MetaWhatsAppCloudProvider")
	}
	if provider.Token != "test-token" || provider.PhoneNumberID != "1234567890" || provider.APIVersion != "v25.0" {
		t.Fatalf("unexpected provider config: %+v", provider)
	}
	if provider.MessageType != "template" || provider.TemplateName != "hello_world" {
		t.Fatalf("unexpected template config: %+v", provider)
	}
}

func TestWhatsAppProviderFromEnvTrimsQuotedValues(t *testing.T) {
	t.Setenv("WHATSAPP_PROVIDER", "meta")
	t.Setenv("WHATSAPP_CLOUD_API_TOKEN", `" test-token "`)
	t.Setenv("WHATSAPP_PHONE_NUMBER_ID", `" 1234567890 "`)
	t.Setenv("WHATSAPP_GRAPH_API_VERSION", `" v25.0 "`)
	t.Setenv("WHATSAPP_MESSAGE_TYPE", `" template "`)
	t.Setenv("WHATSAPP_TEMPLATE_NAME", `" hello_world "`)

	provider, ok := NewWhatsAppProviderFromEnv().(MetaWhatsAppCloudProvider)
	if !ok {
		t.Fatalf("expected MetaWhatsAppCloudProvider")
	}
	if provider.Token != "test-token" || provider.PhoneNumberID != "1234567890" {
		t.Fatalf("expected trimmed token and phone_number_id, got token=%q phone_number_id=%q", provider.Token, provider.PhoneNumberID)
	}
	if provider.APIVersion != "v25.0" || provider.MessageType != "template" || provider.TemplateName != "hello_world" {
		t.Fatalf("expected trimmed provider settings, got %+v", provider)
	}
}

type roundTripFunc func(*http.Request) (*http.Response, error)

func (f roundTripFunc) RoundTrip(r *http.Request) (*http.Response, error) {
	return f(r)
}
