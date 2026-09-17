from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock
import pytest
from app.core.database import get_db
from app.main import app


@pytest.fixture(autouse=True)
def override_db_dependency():
    """Mock the get_db dependency by default in unit tests if no live DB is available."""
    mock_conn = MagicMock()
    # Configure common asyncpg methods as AsyncMocks
    mock_conn.fetchval = AsyncMock(return_value=None)
    mock_conn.fetchrow = AsyncMock(return_value=None)
    mock_conn.fetch = AsyncMock(return_value=[])
    mock_conn.execute = AsyncMock(return_value="OK")
    
    # Mock transaction context manager
    mock_tx = MagicMock()
    mock_tx.__aenter__ = AsyncMock(return_value=mock_tx)
    mock_tx.__aexit__ = AsyncMock(return_value=None)
    mock_conn.transaction = MagicMock(return_value=mock_tx)

    async def _mock_get_db():
        yield mock_conn

    app.dependency_overrides[get_db] = _mock_get_db
    yield mock_conn
    app.dependency_overrides.pop(get_db, None)
