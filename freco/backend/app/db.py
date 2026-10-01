import logging
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import declarative_base
from app.config import settings

logger = logging.getLogger(__name__)
# Fallback to default if not set (which should be set in .env)
# Using ococ_users database explicitly as requested
DATABASE_URL = getattr(settings, "DATABASE_URL", "postgresql+asyncpg://ococ:root@localhost:5432/ococ_users")
try:
    engine = create_async_engine(DATABASE_URL, echo=False)
    async_session_maker = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
except Exception as e:
    logger.error(f"Failed to initialize database connection: {e}")
    engine = None
    async_session_maker = None

Base = declarative_base()

async def get_db_session():
    """Dependency for getting async database session"""
    if async_session_maker is None:
        raise RuntimeError("Database not initialized")
    
    async with async_session_maker() as session:
        yield session
