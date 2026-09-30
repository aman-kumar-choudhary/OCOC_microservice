"""Compatibility entry point for ``uvicorn main:app`` from this directory.

The application implementation lives in ``app.main``; Docker and deployment
commands can continue to use that canonical module path.
"""

from app.main import app

__all__ = ["app"]
