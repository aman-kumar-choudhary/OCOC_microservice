# OCOC User Management Microservice

A small microservice for user management used in the OCOC platform. This repository contains a Go backend and a Vite + TypeScript frontend, along with Docker compose and infrastructure helpers.

## Repository structure

- `backend/` — Go service, API entrypoint: `cmd/api/main.go`, internal packages under `internal/` (auth, user, rfid, role, audit, dashboard, infrastructure).
- `frontend/` — Vite + TypeScript UI for auth, dashboard and user pages.
- `migrations/` — SQL migrations (e.g. `001_initial_schema.sql`).
- `scripts/` — helper scripts (e.g. `setup-keycloak.sh`).
- `docker-compose.yml` — local development stack (Postgres, Redis, Keycloak, services).

## Prerequisites

- Go 1.20+ (or the version required by `go.mod`)
- Node.js 18+ and npm/yarn (for frontend)
- Docker & Docker Compose (for local stack)

## Quick start (recommended)

1. Copy or configure environment variables as required by the services (DB, Keycloak, Redis). See `docker-compose.yml`.
2. Start the local stack with Docker Compose:

```bash
docker-compose up --build
```

This will bring up the database, Keycloak (for auth), Redis, and services defined in the compose file.

## Backend (development)

From the repository root:

```bash
cd backend
go run ./cmd/api
```

Run backend tests:

```bash
cd backend
go test ./internal/...
```

## Frontend (development)

```bash
cd frontend
npm install
npm run dev
```

The frontend uses Vite; open the URL printed in the terminal (usually `http://localhost:5173`).

## Database migrations

Migrations are in the `migrations/` folder. Apply them using your preferred tool (e.g., `psql`, `migrate` CLI, or via whatever migration runner you use in CI).

## Keycloak

Keycloak setup helpers are in `scripts/setup-keycloak.sh` — run or adapt it to configure realms, clients and roles required by the service.

## Notes

- Environment-specific configuration (secrets, DB credentials) is not checked into source — provide them via environment variables or Docker Compose overrides.
- For production deployment, ensure secure Keycloak, DB backups, secrets management, and HTTPS termination.

## Contributing

Contributions are welcome — open issues or PRs with small, focused changes.

## License

Add your license here (e.g., MIT). If you want, I can add a `LICENSE` file.



## How to run this project

-  keyclock command :  bin/kc.sh start-dev --http-port=8180
-  user management frontend command : npm install && npm run dev
-  user management backend command : go run ./cmd/api/main.go
-  facerecognition command : uvicorn app.main:app
