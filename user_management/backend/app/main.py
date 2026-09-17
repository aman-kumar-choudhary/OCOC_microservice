from __future__ import annotations

from contextlib import asynccontextmanager
import logging
import os
from fastapi import FastAPI, HTTPException, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import settings
from app.core.database import close_db, init_db, run_migrations
from app.core.keycloak_client import keycloak_client
from app.core.redis_client import redis_client
from app.routers import (
    audit,
    auth,
    dashboard,
    faceauth,
    onboarding,
    reference,
    registration,
    rfid,
    roles,
    users,
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("ococ.user_management")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting OCOC User Management Microservice (Python FastAPI)...")
    project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    migrations_dir = os.path.join(project_root, "migrations")

    # 1. Initialize PostgreSQL pool & run migrations
    try:
        await init_db()
        if os.path.isdir(migrations_dir):
            await run_migrations(migrations_dir)
    except Exception as e:
        logger.error("Database startup failed: %s", e)

    # 2. Initialize Redis
    try:
        await redis_client.connect()
    except Exception as e:
        logger.warning("Redis initialization failed: %s", e)

    yield

    # Shutdown
    logger.info("Shutting down OCOC User Management Microservice...")
    await redis_client.close()
    await keycloak_client.close()
    await close_db()
    logger.info("Shutdown complete")


app = FastAPI(
    title="OCOC User Management API",
    description="University Identity & Access Management Microservice",
    version="1.0.0",
    lifespan=lifespan,
)

# ── CORS Middleware ─────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Global Error Handlers ───────────────────────────────────────────────────
@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    detail = exc.detail
    if isinstance(detail, dict):
        code = detail.get("code", "ERROR")
        message = detail.get("message", "An error occurred")
    else:
        code = "HTTP_ERROR"
        message = str(detail)

    return JSONResponse(
        status_code=exc.status_code,
        content={"success": False, "error": {"code": code, "message": message}},
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    errors = exc.errors()
    first_msg = errors[0]["msg"] if errors else "Invalid request body"
    field = ".".join(str(x) for x in errors[0]["loc"]) if errors else ""
    message = f"{field}: {first_msg}" if field else first_msg

    return JSONResponse(
        status_code=status.HTTP_400_BAD_REQUEST,
        content={"success": False, "error": {"code": "VALIDATION_ERROR", "message": message}},
    )


@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
    logger.exception("Unhandled server error: %s", exc)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"success": False, "error": {"code": "INTERNAL_SERVER_ERROR", "message": str(exc)}},
    )


# ── Health Check ────────────────────────────────────────────────────────────
@app.get("/health", tags=["health"])
async def health():
    return {"status": "ok"}


# ── Routers ─────────────────────────────────────────────────────────────────
app.include_router(auth.router)
app.include_router(users.router)
app.include_router(rfid.router)
app.include_router(onboarding.router)
app.include_router(registration.router)
app.include_router(roles.router)
app.include_router(dashboard.router)
app.include_router(audit.router)
app.include_router(faceauth.router)
app.include_router(reference.router)
