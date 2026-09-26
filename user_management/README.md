# OCOC User Management Microservice

A microservice for user identity and access management in the OCOC platform. This repository contains a modern **Python (FastAPI)** backend and a **Vite + React (JSX)** frontend, along with Docker compose and infrastructure helpers.

## Repository structure

- `backend/` — Python FastAPI service, entrypoint: `app/main.py`, structured into `app/routers/`, `app/services/`, `app/core/`, and `app/schemas/`.
- `frontend/` — Vite + React (JSX) UI for auth, dashboard, onboarding wizard, and user directory.
- `migrations/` — SQL migrations (e.g. `001_initial_schema.sql`).
- `scripts/` — helper scripts (e.g. `setup-keycloak.sh`).
- `docker-compose.yml` — local development stack (Postgres, Redis, Keycloak, services).

## Prerequisites

- Python 3.9+ (Python 3.11 recommended)
- Node.js 18+ and npm (for frontend)
- Docker & Docker Compose (for local stack)

## Quick start (recommended)

1. Copy or configure environment variables as required by the services (DB, Keycloak, Redis). See `docker-compose.yml`.
2. Start the local stack with Docker Compose:

```bash
docker-compose up --build
```

This will bring up the database, Keycloak (for auth), Redis, and services defined in the compose file.

## Backend (development)

From the `backend` directory:

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8080 --reload
```

Run backend tests:

```bash
pytest -v tests/
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

Keycloak setup helper is available in `scripts/setup_keycloak.py` (cross-platform) or `scripts/setup-keycloak.sh` (bash):

```bash
# Cross-platform (Windows, Linux, macOS):
python scripts/setup_keycloak.py

# Or via bash:
bash scripts/setup-keycloak.sh
```

## Notes

- Environment-specific configuration (secrets, DB credentials) is not checked into source — provide them via environment variables or Docker Compose overrides.
- For production deployment, ensure secure Keycloak, DB backups, secrets management, and HTTPS termination.

## Contributing

Contributions are welcome — open issues or PRs with small, focused changes.

## License

Add your license here (e.g., MIT). If you want, I can add a `LICENSE` file.



## How to run this project

- Keycloak start command: `bin/kc.sh start-dev --http-port=8180` (or `.\bin\kc.bat start-dev --http-port=8180` on Windows)
- Keycloak realm & roles setup: `python scripts/setup_keycloak.py`
- User management backend: `uvicorn app.main:app --host 0.0.0.0 --port 8080 --reload`
- User management frontend: `npm install && npm run dev`
- Face recognition: `uvicorn app.main:app`

