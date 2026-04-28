"""Shared pytest setup.

Each test module gets its own throwaway sqlite DB and isolated env.
We import service apps through the FastAPI TestClient inside a `with`
block so the lifespan handler runs.
"""

from __future__ import annotations

import os
import sys
import uuid
from pathlib import Path

import pytest


# Make `services/` importable as packages (auth.main, catalog.main, etc.)
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "services"))


@pytest.fixture(autouse=True)
def _isolated_env(tmp_path, monkeypatch):
    """Force every test to use a fresh sqlite DB and known secrets."""
    db_file = tmp_path / f"test-{uuid.uuid4().hex}.db"
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{db_file}")
    monkeypatch.setenv("JWT_SECRET", "test-secret-32bytes-or-more-please-ok")
    monkeypatch.setenv("JWT_VERIFIER", "local")
    monkeypatch.setenv("INTERNAL_API_KEY", "test-internal-key")
    monkeypatch.setenv("REDIS_URL", "redis://localhost:6379/15")
    monkeypatch.setenv("LOCAL_QUEUE_PATH", str(tmp_path / "q"))
    monkeypatch.setenv("LOCAL_MAIL_DIR", str(tmp_path / "mail"))
    yield
