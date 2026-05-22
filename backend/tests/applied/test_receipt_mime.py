"""T19d: MIME allow-list + receipt persistence tests.

Verifies the strict PNG/JPEG/PDF allow-list, SHA-256 hash generation,
disk persistence, and cross-application linkage rejection in
save_confirmation.
"""
from __future__ import annotations

import os
from datetime import datetime, timezone
from io import BytesIO

import pytest

from services.applied.confirmation import save_confirmation, upload_receipt
from services.database_service import AppliedAsset
from tests.applied.conftest import make_app


class _FakeUpload:
    """Minimal duck-typed UploadFile: ``filename``, ``content_type``, ``.file``."""

    def __init__(self, filename: str, content_type: str, content: bytes):
        self.filename = filename
        self.content_type = content_type
        self.file = BytesIO(content)


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# ─── Allow-list ─────────────────────────────────────────────────────────────


@pytest.mark.parametrize(
    "ct,filename,content",
    [
        ("application/pdf", "a.pdf", b"%PDF-1.7\nfake-pdf-body"),
        ("image/png", "a.png", b"\x89PNG\r\n\x1a\nfake-png-body"),
        ("image/jpeg", "a.jpg", b"\xff\xd8\xff\xe0fake-jpeg-body"),
    ],
)
def test_allowed_mimes_persist(session, ct, filename, content):
    app = make_app(session)
    out = upload_receipt(session, app.id, _FakeUpload(filename, ct, content), user_id=99)
    assert out["mime_type"] == ct
    assert out["original_filename"] == filename
    assert out["file_hash"].startswith("sha256:")
    assert len(out["file_hash"]) == len("sha256:") + 64  # hex digest = 64 chars

    # Row landed in applied_assets with the same hash + correct foreign key
    asset = session.get(AppliedAsset, out["id"])
    assert asset is not None
    assert asset.application_id == app.id
    assert asset.file_hash == out["file_hash"]
    # The persisted file path should exist on disk.
    assert os.path.exists(asset.file_path)


# ─── Rejections ─────────────────────────────────────────────────────────────


@pytest.mark.parametrize(
    "ct,filename",
    [
        ("application/x-msdownload", "evil.exe"),
        ("image/gif", "anim.gif"),
        ("text/html", "page.html"),
        ("application/zip", "bundle.zip"),
    ],
)
def test_rejected_mimes(session, ct, filename):
    app = make_app(session)
    with pytest.raises(ValueError, match="unsupported mime"):
        upload_receipt(
            session, app.id, _FakeUpload(filename, ct, b"some bytes"), user_id=99
        )


def test_missing_content_type_rejected(session):
    app = make_app(session)
    with pytest.raises(ValueError, match="unsupported mime"):
        upload_receipt(
            session, app.id, _FakeUpload("a.bin", None, b"some bytes"), user_id=99
        )


def test_empty_file_rejected(session):
    app = make_app(session)
    with pytest.raises(ValueError, match="empty"):
        upload_receipt(
            session, app.id, _FakeUpload("a.pdf", "application/pdf", b""), user_id=99
        )


# ─── Ownership / not-found ──────────────────────────────────────────────────


def test_unknown_app_raises_value_error(session):
    with pytest.raises(ValueError, match="not found"):
        upload_receipt(
            session,
            999_999,
            _FakeUpload("a.pdf", "application/pdf", b"%PDF-1.7"),
            user_id=99,
        )


def test_wrong_user_rejected(session):
    app = make_app(session)
    with pytest.raises(PermissionError):
        upload_receipt(
            session, app.id, _FakeUpload("a.pdf", "application/pdf", b"%PDF-1.7"), user_id=12345
        )


# ─── Cross-application linkage check in save_confirmation ───────────────────


def test_save_confirmation_rejects_cross_app_receipt(session):
    app_a = make_app(session)
    app_b = make_app(session, job_title="[TEST] Other App")
    asset = upload_receipt(
        session, app_a.id, _FakeUpload("a.pdf", "application/pdf", b"%PDF-1.7"), user_id=99
    )
    # Linking app_a's receipt to app_b must be rejected.
    with pytest.raises(ValueError, match="different application"):
        save_confirmation(
            session,
            app_b.id,
            {"confirmed_at": _now_iso(), "receipt_asset_id": asset["id"]},
            user_id=99,
        )


def test_save_confirmation_links_same_app_receipt(session):
    app = make_app(
        session,
        submission_record_json=f'{{"applied_at":"{_now_iso()}","channel":"direct"}}',
    )
    asset = upload_receipt(
        session, app.id, _FakeUpload("a.pdf", "application/pdf", b"%PDF-1.7"), user_id=99
    )
    out = save_confirmation(
        session,
        app.id,
        {"confirmed_at": _now_iso(), "receipt_asset_id": asset["id"]},
        user_id=99,
    )
    assert out["applied_substage"] == "confirmed"
    assert out["confirmation_record"]["receipt_asset_id"] == asset["id"]
    assert out["sla_tracker"] is not None  # confirmation baseline is fresh


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
