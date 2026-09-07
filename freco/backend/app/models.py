import uuid
from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Integer, String, Table, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship
from pgvector.sqlalchemy import Vector

from app.db import Base

# ── Stub for the `users` table owned by the user-management service ───────────
# FRECO shares the same `ococ_users` database. The `users` table is created and
# owned by the Go user-management migrations.  We only declare a minimal stub
# here so SQLAlchemy can resolve the FK from freco_people.external_id → users.id
# without raising NoReferencedTableError at startup.
# `keep_existing=True` ensures create_all() never tries to CREATE TABLE users.
Table(
    "users",
    Base.metadata,
    Column("id", UUID(as_uuid=True), primary_key=True),
    keep_existing=True,
)


class Person(Base):
    __tablename__ = "freco_people"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    external_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    name = Column(String, nullable=False)
    person_type = Column(String, nullable=False)
    email = Column(String, nullable=True)
    rfid_uid = Column(String, unique=True, nullable=True)
    metadata_json = Column(Text, nullable=True)
    active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)

    face_embeddings = relationship("FaceEmbedding", back_populates="person", cascade="all, delete-orphan")


class FaceEmbedding(Base):
    __tablename__ = "freco_face_embeddings"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    person_id = Column(UUID(as_uuid=True), ForeignKey("freco_people.id", ondelete="CASCADE"), nullable=False)
    variant = Column(String, nullable=False)
    pose = Column(String, nullable=False)
    model_name = Column(String, nullable=False)
    embedding = Column(Vector(512), nullable=False)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)

    person = relationship("Person", back_populates="face_embeddings")


class AttendanceSession(Base):
    __tablename__ = "freco_attendance_sessions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False)
    mode = Column(String, nullable=False)   # 'face' | 'rfid' | 'mass'
    device_id = Column(String, nullable=True)
    starts_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    ends_at = Column(DateTime(timezone=True), nullable=True)
    active = Column(Boolean, default=True, nullable=False)


class AttendanceRecord(Base):
    __tablename__ = "freco_attendance_records"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id = Column(UUID(as_uuid=True), ForeignKey("freco_attendance_sessions.id", ondelete="CASCADE"), nullable=False)
    person_id = Column(UUID(as_uuid=True), ForeignKey("freco_people.id", ondelete="CASCADE"), nullable=False)
    timestamp = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    source = Column(String, nullable=False)
    similarity_score = Column(Float, nullable=False)

    __table_args__ = (
        UniqueConstraint("session_id", "person_id", name="uq_session_person"),
    )
