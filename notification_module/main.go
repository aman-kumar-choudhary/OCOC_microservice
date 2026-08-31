package main

import (
	"bufio"
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"
)

// loadEnv reads a simple KEY=VALUE .env file and sets process env vars.
// No external dependency needed for this local dev project.
func loadEnv(path string) {
	file, err := os.Open(path)
	if err != nil {
		log.Printf("Warning: could not open %s (%v). Using system environment variables only.", path, err)
		return
	}
	defer file.Close()

	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		parts := strings.SplitN(line, "=", 2)
		if len(parts) != 2 {
			continue
		}
		key := strings.TrimSpace(parts[0])
		value := normalizeEnvValue(parts[1])
		if _, exists := os.LookupEnv(key); !exists {
			os.Setenv(key, value)
		}
	}
}

func writeJSON(w http.ResponseWriter, status int, payload interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(payload)
}

func statusFromError(err *AppError) int {
	if err == nil {
		return http.StatusOK
	}
	switch err.Kind {
	case ErrorValidation, ErrorTemplate:
		return http.StatusBadRequest
	case ErrorAuthorization:
		return http.StatusForbidden
	case ErrorNotFound:
		return http.StatusNotFound
	case ErrorDuplicate:
		return http.StatusConflict
	case ErrorRateLimit:
		return http.StatusTooManyRequests
	default:
		return http.StatusInternalServerError
	}
}

func requirePermission(r *http.Request, permission string) *AppError {
	if r.Header.Get("X-User-Role") == "admin" {
		return nil
	}
	return appError(ErrorAuthorization, "permission %s requires X-User-Role: admin", permission)
}

func healthHandler(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, HealthResponse{Status: "ok"})
}

// sendNotificationHandler decodes the request, upgrades legacy
// channel/receiver payloads into a recipients list, validates it, and hands
// it to the NotificationService, which resolves it into individual
// deliveries and dispatches them. The service - not this handler - owns
// how many deliveries come out of one request.
func sendNotificationHandler(svc *NotificationService) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			writeJSON(w, http.StatusMethodNotAllowed, ErrorResponse{
				Success: false,
				Message: "Failed to send notification",
				Error:   "only POST method is allowed on this endpoint",
			})
			return
		}

		var req NotificationRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSON(w, http.StatusBadRequest, ErrorResponse{
				Success: false,
				Message: "Failed to send notification",
				Error:   "invalid JSON body: " + err.Error(),
			})
			return
		}

		normalizeRequest(&req)

		if err := validateRequest(req); err != nil {
			writeJSON(w, http.StatusBadRequest, ErrorResponse{
				Success: false,
				Message: "Failed to send notification",
				Error:   err.Error(),
			})
			return
		}

		resp, appErr := svc.ProcessNotificationWithError(req)
		if appErr != nil && appErr.Kind != ErrorDuplicate {
			writeJSON(w, statusFromError(appErr), ErrorResponse{Success: false, Message: "Failed to send notification", Error: appErr.Message})
			return
		}

		httpStatus := http.StatusOK
		if resp.Status == NotificationFailed {
			httpStatus = http.StatusInternalServerError
		}
		if resp.Status == NotificationQueued {
			httpStatus = http.StatusAccepted
		}
		if appErr != nil {
			httpStatus = statusFromError(appErr)
		}
		writeJSON(w, httpStatus, resp)
	}
}

func broadcastHandler(svc *NotificationService) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			writeJSON(w, http.StatusMethodNotAllowed, ErrorResponse{Success: false, Message: "Failed to broadcast", Error: "only POST method is allowed on this endpoint"})
			return
		}
		if err := requirePermission(r, "notification.broadcast"); err != nil {
			writeJSON(w, statusFromError(err), ErrorResponse{Success: false, Message: "Failed to broadcast", Error: err.Message})
			return
		}
		var req BroadcastRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSON(w, http.StatusBadRequest, ErrorResponse{Success: false, Message: "Failed to broadcast", Error: "invalid JSON body: " + err.Error()})
			return
		}
		notificationReq := NotificationRequest{
			SenderID: req.SenderID, Subject: req.Subject, Message: req.Message,
			EventID: req.EventID, IdempotencyKey: req.IdempotencyKey,
			Channels: req.Channels, Recipients: req.Recipients,
		}
		if err := validateRequest(notificationReq); err != nil {
			writeJSON(w, http.StatusBadRequest, ErrorResponse{Success: false, Message: "Failed to broadcast", Error: err.Error()})
			return
		}
		resp, appErr := svc.ProcessNotificationWithError(notificationReq)
		if appErr != nil && appErr.Kind != ErrorDuplicate {
			writeJSON(w, statusFromError(appErr), ErrorResponse{Success: false, Message: "Failed to broadcast", Error: appErr.Message})
			return
		}
		status := http.StatusOK
		if resp.Status == NotificationQueued {
			status = http.StatusAccepted
		}
		if appErr != nil {
			status = statusFromError(appErr)
		}
		writeJSON(w, status, resp)
	}
}

func templateCollectionHandler(svc *NotificationService) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodPost:
			if err := requirePermission(r, "notification.templates.manage"); err != nil {
				writeJSON(w, statusFromError(err), ErrorResponse{Success: false, Message: "Failed to create template", Error: err.Message})
				return
			}
			var req TemplateRequest
			if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
				writeJSON(w, http.StatusBadRequest, ErrorResponse{Success: false, Message: "Failed to create template", Error: "invalid JSON body: " + err.Error()})
				return
			}
			tmpl, err := templateFromRequest(req, nil)
			if err != nil {
				writeJSON(w, http.StatusBadRequest, ErrorResponse{Success: false, Message: "Failed to create template", Error: err.Error()})
				return
			}
			if err := svc.templates.Create(tmpl); err != nil {
				writeJSON(w, http.StatusConflict, ErrorResponse{Success: false, Message: "Failed to create template", Error: err.Error()})
				return
			}
			writeJSON(w, http.StatusCreated, tmpl)
		case http.MethodGet:
			writeJSON(w, http.StatusOK, svc.templates.List())
		default:
			writeJSON(w, http.StatusMethodNotAllowed, ErrorResponse{Success: false, Message: "Failed to handle templates", Error: "method not allowed"})
		}
	}
}

func templateItemHandler(svc *NotificationService) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := strings.TrimPrefix(r.URL.Path, "/api/v1/notification-templates/")
		if id == "" || strings.Contains(id, "/") {
			writeJSON(w, http.StatusNotFound, ErrorResponse{Success: false, Message: "Template not found", Error: "invalid template id"})
			return
		}
		switch r.Method {
		case http.MethodGet:
			tmpl, ok := svc.templates.Get(id)
			if !ok {
				writeJSON(w, http.StatusNotFound, ErrorResponse{Success: false, Message: "Template not found", Error: "template not found"})
				return
			}
			writeJSON(w, http.StatusOK, tmpl)
		case http.MethodPut:
			if err := requirePermission(r, "notification.templates.manage"); err != nil {
				writeJSON(w, statusFromError(err), ErrorResponse{Success: false, Message: "Failed to update template", Error: err.Message})
				return
			}
			existing, ok := svc.templates.Get(id)
			if !ok {
				writeJSON(w, http.StatusNotFound, ErrorResponse{Success: false, Message: "Template not found", Error: "template not found"})
				return
			}
			var req TemplateRequest
			if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
				writeJSON(w, http.StatusBadRequest, ErrorResponse{Success: false, Message: "Failed to update template", Error: "invalid JSON body: " + err.Error()})
				return
			}
			tmpl, err := templateFromRequest(req, &existing)
			if err != nil {
				writeJSON(w, http.StatusBadRequest, ErrorResponse{Success: false, Message: "Failed to update template", Error: err.Error()})
				return
			}
			if err := svc.templates.Update(id, tmpl); err != nil {
				writeJSON(w, http.StatusNotFound, ErrorResponse{Success: false, Message: "Failed to update template", Error: err.Error()})
				return
			}
			writeJSON(w, http.StatusOK, tmpl)
		case http.MethodDelete:
			if err := requirePermission(r, "notification.templates.manage"); err != nil {
				writeJSON(w, statusFromError(err), ErrorResponse{Success: false, Message: "Failed to delete template", Error: err.Message})
				return
			}
			if !svc.templates.Delete(id) {
				writeJSON(w, http.StatusNotFound, ErrorResponse{Success: false, Message: "Template not found", Error: "template not found"})
				return
			}
			writeJSON(w, http.StatusOK, map[string]bool{"deleted": true})
		default:
			writeJSON(w, http.StatusMethodNotAllowed, ErrorResponse{Success: false, Message: "Failed to handle template", Error: "method not allowed"})
		}
	}
}

func trackingHandler(svc *NotificationService) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		path := strings.TrimPrefix(r.URL.Path, "/api/v1/")
		parts := strings.Split(path, "/")
		if len(parts) >= 2 && parts[0] == "deliveries" {
			d, ok := svc.deliveries.Get(parts[1])
			if !ok {
				writeJSON(w, http.StatusNotFound, ErrorResponse{Success: false, Message: "Delivery not found", Error: "delivery not found"})
				return
			}
			writeJSON(w, http.StatusOK, d)
			return
		}
		if len(parts) >= 2 && parts[0] == "notifications" {
			if len(parts) == 3 && parts[2] == "deliveries" {
				writeJSON(w, http.StatusOK, svc.deliveries.ListByNotification(parts[1]))
				return
			}
			n, ok := svc.notifications.Get(parts[1])
			if !ok {
				writeJSON(w, http.StatusNotFound, ErrorResponse{Success: false, Message: "Notification not found", Error: "notification not found"})
				return
			}
			writeJSON(w, http.StatusOK, n)
			return
		}
		writeJSON(w, http.StatusNotFound, ErrorResponse{Success: false, Message: "Not found", Error: "route not found"})
	}
}

func preferenceHandler(svc *NotificationService) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		prefix := "/api/v1/users/"
		suffix := "/notification-preferences"
		userID := strings.TrimSuffix(strings.TrimPrefix(r.URL.Path, prefix), suffix)
		if userID == "" || strings.Contains(userID, "/") {
			writeJSON(w, http.StatusNotFound, ErrorResponse{Success: false, Message: "Preferences not found", Error: "invalid user id"})
			return
		}
		switch r.Method {
		case http.MethodGet:
			writeJSON(w, http.StatusOK, svc.preferences.Get(userID))
		case http.MethodPut:
			var pref NotificationPreference
			if err := json.NewDecoder(r.Body).Decode(&pref); err != nil {
				writeJSON(w, http.StatusBadRequest, ErrorResponse{Success: false, Message: "Failed to update preferences", Error: "invalid JSON body: " + err.Error()})
				return
			}
			pref.UserID = userID
			svc.preferences.Put(pref)
			writeJSON(w, http.StatusOK, pref)
		default:
			writeJSON(w, http.StatusMethodNotAllowed, ErrorResponse{Success: false, Message: "Failed to handle preferences", Error: "method not allowed"})
		}
	}
}

func main() {
	loadEnv(".env")
	logFile, err := configureFileLogging()
	if err != nil {
		log.Fatalf("log file setup failure: %v", err)
	}
	defer logFile.Close()

	log.Printf("WhatsApp configuration %s", WhatsAppProviderSummaryFromEnv())

	channels := map[string]NotificationChannel{
		"email":    EmailChannel{},
		"whatsapp": WhatsAppChannel{},
	}

	var repos RepositorySet
	db, err := OpenPostgresFromEnv()
	if err != nil {
		log.Fatalf("PostgreSQL connection failure: %v", err)
	}
	defer db.Close()
	if err := EnsureDatabaseSchema(db, "DATABASE_SCHEMA.sql"); err != nil {
		log.Fatalf("PostgreSQL schema setup failure: %v", err)
	}
	repos = NewPostgresRepositories(db)
	log.Printf("PostgreSQL persistence enabled")

	var svc *NotificationService
	if envBool("RABBITMQ_ENABLED", false) {
		broker, err := NewRabbitMQDeliveryBroker(RabbitMQConfigFromEnv())
		if err != nil {
			log.Fatalf("RabbitMQ connection failure: %v", err)
		}
		svc = NewNotificationServiceWithRepositories(channels, broker, repos)
	} else {
		svc = NewNotificationServiceWithRepositories(channels, NewInMemoryDeliveryBroker(envInt("QUEUE_BUFFER_SIZE", 100)), repos)
	}
	defer svc.broker.Close()

	mux := http.NewServeMux()
	mux.HandleFunc("/health", healthHandler)
	mux.HandleFunc("/api/v1/notification-templates", templateCollectionHandler(svc))
	mux.HandleFunc("/api/v1/notification-templates/", templateItemHandler(svc))
	mux.HandleFunc("/api/v1/notifications/broadcast", broadcastHandler(svc))
	mux.HandleFunc("/api/v1/notifications/send", sendNotificationHandler(svc))
	mux.HandleFunc("/api/v1/notifications/", trackingHandler(svc))
	mux.HandleFunc("/api/v1/deliveries/", trackingHandler(svc))
	mux.HandleFunc("/api/v1/users/", preferenceHandler(svc))

	addr := envString("SERVER_ADDR", "localhost:8000")
	server := &http.Server{Addr: addr, Handler: mux}
	go func() {
		fmt.Printf("Notification server running at http://%s\n", addr)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("server failed: %v", err)
		}
	}()

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, os.Interrupt, syscall.SIGTERM)
	<-stop

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := server.Shutdown(ctx); err != nil {
		log.Printf("server shutdown failed: %v", err)
	}
}
