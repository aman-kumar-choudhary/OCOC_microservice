from __future__ import annotations

import os
from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    SERVER_ADDR: str = "0.0.0.0:8080"
    ENVIRONMENT: str = "development"
    # PostgreSQL
    DATABASE_URL: str = "postgres://ococ:root@localhost:5432/ococ_users?sslmode=disable"
    DATABASE_MAX_OPEN_CONNS: int = 25
    DATABASE_MAX_IDLE_CONNS: int = 10
    DATABASE_CONN_MAX_LIFETIME_SECONDS: int = 300

    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"
    REDIS_PASSWORD: str = ""
    OTP_TTL_SECONDS: int = 600

    # Keycloak
    KEYCLOAK_URL: str = "http://localhost:8180"
    KEYCLOAK_REALM: str = "ococ"
    KEYCLOAK_CLIENT_ID: str = "user-management"
    KEYCLOAK_CLIENT_SECRET: str = ""
    KEYCLOAK_ADMIN_USER: str = "admin"
    KEYCLOAK_ADMIN_PASSWORD: str = "admin"

    # JWT
    JWT_ISSUER: str = ""
    JWT_AUDIENCE: str = "user-management"

    # SMTP (for OTP emails)
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USERNAME: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM: str = "noreply@ococ.campus.edu"

    # RFID Reader
    RFID_READER_URL: str = "ws://localhost:9001/rfid"
    RFID_READER_SIMULATE: bool = True

    # CORS
    CORS_ALLOWED_ORIGINS: str = "http://localhost:5173,http://localhost:3000"

    # Uploads & Files
    PHOTO_UPLOAD_DIR: str = "./uploads/photos"
    MAX_UPLOAD_SIZE_MB: int = 5
    MAX_CSV_SIZE_MB: int = 10
    MAX_CSV_ROWS: int = 5000

    model_config = SettingsConfigDict(
        env_file=os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @property
    def cors_origins(self) -> List[str]:
        if not self.CORS_ALLOWED_ORIGINS:
            return ["*"]
        return [origin.strip() for origin in self.CORS_ALLOWED_ORIGINS.split(",") if origin.strip()]

    @property
    def issuer_url(self) -> str:
        if self.JWT_ISSUER:
            return self.JWT_ISSUER
        return f"{self.KEYCLOAK_URL.rstrip('/')}/realms/{self.KEYCLOAK_REALM}"


settings = Settings()
