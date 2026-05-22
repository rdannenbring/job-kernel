"""Shared fixtures for the Applied-stage test suite.

Each test gets a fresh sqlite DB via a session-scoped engine plus a
function-scoped session that rolls back at teardown. Tests that need to
exercise the FastAPI app or the singleton ``database_service`` import them
inside the test (because importing ``main`` boots the daemon sweeper
thread, which we want to avoid during unit-style tests).
"""
from __future__ import annotations

import os
import tempfile
from typing import Any, Iterator

import pytest

# Use a temp DB per test session BEFORE any service import.
_TMP_DB_PATH = tempfile.mkstemp(suffix=".db", prefix="applied_tests_")[1]
os.environ["DATABASE_URL"] = f"sqlite:///{_TMP_DB_PATH}"
os.environ.setdefault("DOCUMENTS_STORAGE_PATH", tempfile.mkdtemp(prefix="applied_tests_uploads_"))

# Imports must come AFTER DATABASE_URL is set so the engine picks it up.
from services.database_service import (  # noqa: E402
    Application,
    ApplicationContact,
    ApplicationEvent,
    AppliedAsset,
    DatabaseService,
    Notification,
    User,
)


@pytest.fixture(scope="session")
def db() -> DatabaseService:
    """One DatabaseService for the whole test run (runs migrations once)."""
    return DatabaseService()


@pytest.fixture()
def session(db: DatabaseService) -> Iterator[Any]:
    """Function-scoped session with full cleanup between tests."""
    s = db.Session()
    # Ensure the user id used by helpers exists exactly once.
    if s.query(User).filter_by(id=99).first() is None:
        s.add(User(id=99, username="applied_test_user", hashed_password="x"))
        s.commit()
    try:
        yield s
    finally:
        # Clean up rows we may have created. Order matters for FKs.
        for app in s.query(Application).filter(
            Application.job_title.like("[TEST]%")
        ).all():
            s.query(ApplicationEvent).filter_by(application_id=app.id).delete()
            s.query(Notification).filter_by(link_app_id=app.id).delete()
            s.query(AppliedAsset).filter_by(application_id=app.id).delete()
            s.query(ApplicationContact).filter_by(application_id=app.id).delete()
            s.query(Application).filter_by(id=app.id).delete()
        s.commit()
        s.close()


def make_app(session, **overrides) -> Application:
    """Insert a ``[TEST]``-prefixed Application row. Helper for tests."""
    defaults = dict(
        job_title="[TEST] Sample Role",
        company="Sample Co",
        user_id=99,
        pipeline_stage="applied",
    )
    defaults.update(overrides)
    app = Application(**defaults)
    session.add(app)
    session.flush()
    return app
