package main

import (
	"bufio"
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"runtime"
	"strings"
	"syscall"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"

	"github.com/ococ/user-management/internal/audit"
	"github.com/ococ/user-management/internal/auth"
	"github.com/ococ/user-management/internal/dashboard"
	"github.com/ococ/user-management/internal/infrastructure/database"
	kclient "github.com/ococ/user-management/internal/infrastructure/keycloak"
	rclient "github.com/ococ/user-management/internal/infrastructure/redis"
	"github.com/ococ/user-management/internal/onboarding"
	"github.com/ococ/user-management/internal/registration"
	"github.com/ococ/user-management/internal/rfid"
	"github.com/ococ/user-management/internal/role"
	"github.com/ococ/user-management/internal/user"
)

func main() {
	// Get absolute project root using runtime.Caller
	_, b, _, _ := runtime.Caller(0)
	projectRoot := filepath.Join(filepath.Dir(b), "../..")

	loadEnv(filepath.Join(projectRoot, ".env"))
	log.SetFlags(log.LstdFlags | log.Lshortfile)

	// ── Infrastructure ─────────────────────────────────────────────────────
	db, err := database.OpenFromEnv()
	if err != nil {
		log.Fatalf("PostgreSQL: %v", err)
	}
	defer db.Close()
	log.Println("PostgreSQL connected")

	// Apply all numbered migrations in order.
	// Each migration is idempotent (IF NOT EXISTS / ADD COLUMN IF NOT EXISTS).
	migrations := []string{
		filepath.Join(projectRoot, "migrations/001_initial_schema.sql"),
		filepath.Join(projectRoot, "migrations/002_user_profiles_missing_columns.sql"),
		filepath.Join(projectRoot, "migrations/003_face_auth_logs.sql"),
		filepath.Join(projectRoot, "migrations/004_pgvector_and_freco.sql"),
		filepath.Join(projectRoot, "migrations/005_user_directory_indexes.sql"),
		filepath.Join(projectRoot, "migrations/006_split_profiles.sql"),
		filepath.Join(projectRoot, "migrations/007_schema_refactoring.sql"),
	}
	for _, migrationPath := range migrations {
		if err := database.RunMigration(db, migrationPath); err != nil {
			log.Printf("Migration warning [%s] (may already be applied): %v", filepath.Base(migrationPath), err)
		} else {
			log.Printf("Migration applied: %s", filepath.Base(migrationPath))
		}
	}

	redis, err := rclient.NewClient()
	if err != nil {
		log.Printf("Redis: %v (continuing without Redis)", err)
		redis = nil
	} else {
		defer redis.Close()
		log.Println("Redis connected")
	}

	kc := kclient.NewClientFromEnv()
	log.Printf("Keycloak configured: %s", kc.GetIssuer())

	// ── Repositories ───────────────────────────────────────────────────────
	userRepo := user.NewPostgresRepository(db.DB)
	rfidRepo := rfid.NewPostgresRepository(db.DB)
	roleRepo := role.NewPostgresRepository(db.DB)
	auditRepo := audit.NewPostgresRepository(db.DB)

	// ── Services ───────────────────────────────────────────────────────────
	auditSvc := audit.NewService(auditRepo)
	reader := rfid.NewReaderFromEnv()
	rfidSvc := rfid.NewService(rfidRepo, auditSvc, reader, db.DB)
	userSvc := user.NewService(userRepo, kc, redis, auditSvc, rfidSvc, db.DB)
	roleSvc := role.NewService(roleRepo)
	onboardingSvc := onboarding.NewService(userSvc, rfidSvc, auditSvc, db.DB)
	dashSvc := dashboard.NewService(db.DB)

	// ── Auth Service ───────────────────────────────────────────────────────
	var otpStore auth.OTPStore
	var resetStore auth.OTPStore
	if redis != nil {
		otpStore = redis
		resetStore = redis
	}
	authSvc := auth.NewService(kc, otpStore, resetStore, userSvc, db.DB)

	// ── Handlers ───────────────────────────────────────────────────────────
	authHandler := auth.NewHandler(authSvc)
	userHandler := user.NewHandler(userSvc)
	rfidHandler := rfid.NewHandler(rfidSvc)
	roleHandler := role.NewHandler(roleSvc)
	auditHandler := audit.NewHandler(auditSvc)
	onboardingHandler := onboarding.NewHandler(onboardingSvc)
	dashHandler := dashboard.NewHandler(dashSvc)

	// Registration (public self-registration + admin listing)
	regSvc := registration.NewService(db.DB)
	regHandler := registration.NewHandler(regSvc)

	// ── Router ─────────────────────────────────────────────────────────────
	r := chi.NewRouter()

	// Global middleware
	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(middleware.Timeout(30 * time.Second))
	r.Use(corsMiddleware)

	// Health check
	r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"status":"ok"}`))
	})

	// ── Public routes (no JWT) ─────────────────────────────────────────────
	r.Route("/api/v1/auth", func(r chi.Router) {
		r.Post("/login", authHandler.Login)
		r.Post("/forgot-password", authHandler.ForgotPassword)
		r.Post("/verify-otp", authHandler.VerifyOTP)
		r.Post("/reset-password", authHandler.ResetPassword)
	})

	// Public registration endpoint
	r.Post("/api/v1/register", regHandler.Register)

	// Reference Data
	r.Get("/api/v1/departments", userHandler.ListDepartments)
	r.Get("/api/v1/hostels", userHandler.ListHostels)

	// ── Protected routes (JWT required) ────────────────────────────────────
	issuerURL := kc.GetIssuer()
	r.Group(func(r chi.Router) {
		r.Use(auth.JWTMiddleware(issuerURL))

		// Auth (authenticated)
		r.Post("/api/v1/auth/logout", authHandler.Logout)
		r.Post("/api/v1/auth/refresh", authHandler.RefreshToken)

		// Users
		r.Route("/api/v1/users", func(r chi.Router) {
			r.With(auth.RequirePermission("user:read")).Get("/", userHandler.List)
			r.With(auth.RequirePermission("user:create")).Post("/", userHandler.Create)
			r.With(auth.RequirePermission("user:export")).Get("/export", userHandler.Export)
			r.With(auth.RequirePermission("user:import")).Get("/import/template", userHandler.ImportTemplate)
			r.With(auth.RequirePermission("user:import")).Post("/import/validate", userHandler.ImportValidate)
			r.With(auth.RequirePermission("user:import")).Post("/import", userHandler.Import)

			r.Route("/{id}", func(r chi.Router) {
				r.With(auth.RequirePermission("user:read")).Get("/", userHandler.GetByID)
				r.With(auth.RequirePermission("user:update")).Put("/", userHandler.Update)
				r.With(auth.RequirePermission("user:update")).Patch("/", userHandler.Update)
				r.With(auth.RequirePermission("user:deactivate")).Delete("/", userHandler.Deactivate)
				r.With(auth.RequirePermission("user:suspend")).Patch("/suspend", userHandler.Suspend)
				r.With(auth.RequirePermission("user:update")).Patch("/activate", userHandler.Activate)
				r.With(auth.RequirePermission("user:deactivate")).Patch("/deactivate", userHandler.Deactivate)

				// User role management
				r.With(auth.RequirePermission("role:assign")).Post("/roles", roleHandler.AssignToUser)
				r.With(auth.RequirePermission("role:assign")).Delete("/roles/{roleId}", roleHandler.RemoveFromUser)
			})
		})

		// RFID
		r.Route("/api/v1/rfid", func(r chi.Router) {
			r.With(auth.RequirePermission("rfid:read")).Get("/", rfidHandler.List)
			r.Post("/validate", rfidHandler.Validate)
			r.With(auth.RequirePermission("rfid:assign")).Post("/assign", rfidHandler.Assign)
			r.With(auth.RequirePermission("rfid:replace")).Post("/replace", rfidHandler.Replace)
			r.Post("/scan", rfidHandler.Scan)
			r.Get("/reader/status", rfidHandler.ReaderStatus)
			r.With(auth.RequirePermission("rfid:read")).Get("/{uid}", rfidHandler.GetByUID)
			r.With(auth.RequirePermission("rfid:assign")).Patch("/{id}/activate", rfidHandler.Activate)
			r.With(auth.RequirePermission("rfid:assign")).Patch("/{id}/deactivate", rfidHandler.Deactivate)
			r.With(auth.RequirePermission("rfid:revoke")).Patch("/{id}/revoke", rfidHandler.Revoke)
		})

		// Onboarding
		r.Route("/api/v1/onboarding", func(r chi.Router) {
			r.Use(auth.RequirePermission("user:create"))
			r.Post("/", onboardingHandler.Generic)
			r.Post("/student", onboardingHandler.Student)
			r.Post("/faculty", onboardingHandler.Faculty)
			r.Post("/worker", onboardingHandler.Worker)
			r.Post("/visitor", onboardingHandler.Visitor)
			r.Post("/{id}/rfid", onboardingHandler.EnrollRFID)
			r.Post("/{id}/issue-card", onboardingHandler.IssueCard)
		})

		// Roles
		r.Route("/api/v1/roles", func(r chi.Router) {
			r.Get("/", roleHandler.List)
			r.With(auth.RequirePermission("role:manage")).Post("/", roleHandler.Create)
		})

		// Dashboard
		r.Get("/api/v1/dashboard/overview", dashHandler.Overview)
		r.Get("/api/v1/dashboard/analytics", dashHandler.Analytics)

		// Registrations (admin view of registered users)
		r.Get("/api/v1/registrations", regHandler.ListRegistrations)
		r.Get("/api/v1/registrations/stats", regHandler.RegistrationStats)

		// Audit
		r.Route("/api/v1/audit", func(r chi.Router) {
			r.Use(auth.RequirePermission("audit:read"))
			r.Get("/", auditHandler.List)
			r.Get("/{id}", auditHandler.GetByID)
		})

		// Admin Utilities
		r.Route("/api/admin", func(r chi.Router) {
			r.Use(auth.RequirePermission("user:manage"))
			r.Post("/semester/advance", userHandler.AdvanceSemester)
		})
	})

	// ── Start server ───────────────────────────────────────────────────────
	addr := envString("SERVER_ADDR", "0.0.0.0:8080")
	server := &http.Server{Addr: addr, Handler: r}

	go func() {
		log.Printf("OCOC User Management API starting on %s", addr)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Server: %v", err)
		}
	}()

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, os.Interrupt, syscall.SIGTERM)
	<-stop

	log.Println("Shutting down...")
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := server.Shutdown(ctx); err != nil {
		log.Printf("Shutdown: %v", err)
	}
	log.Println("Server stopped")
}

// ── CORS ───────────────────────────────────────────────────────────────────

func corsMiddleware(next http.Handler) http.Handler {
	origins := envString("CORS_ALLOWED_ORIGINS", "http://localhost:5173")
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", origins)
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		w.Header().Set("Access-Control-Allow-Credentials", "true")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

// ── Env ────────────────────────────────────────────────────────────────────

func loadEnv(path string) {
	file, err := os.Open(path)
	if err != nil {
		log.Printf("No .env file: %v", err)
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
		value := strings.TrimSpace(parts[1])
		if _, exists := os.LookupEnv(key); !exists {
			os.Setenv(key, value)
		}
	}
	if err := scanner.Err(); err != nil {
		log.Printf("Error reading .env file: %v", err)
	}
}

func envString(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}
