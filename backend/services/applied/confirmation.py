"""Confirmation service: receipt upload + save_confirmation.

Owner task: T3d.

Receipt upload mirrors the existing repo pattern at
``backend/main.py:657`` (``upload_app_additional_doc``): multipart
``UploadFile`` -> SHA-256 hash -> persist asset row. The MIME allow-list
is enforced strictly per the PRD: ``image/png``, ``image/jpeg``,
``application/pdf``.

``save_confirmation`` initializes ``sla_tracker_json`` via
``derivations.compute_sla`` and refreshes the substage cache (D5).
"""
from __future__ import annotations

import hashlib
import json
import os
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from sqlalchemy.orm import Session

from models.applied_models import (  # type: ignore[import-not-found]
    ConfirmationRecordIn,
)
from services.applied import derivations  # type: ignore[import-not-found]
from services.database_service import (  # type: ignore[import-not-found]
    Application,
    AppliedAsset,
    DatabaseService,
)


_ALLOWED_MIME = frozenset({"image/png", "image/jpeg", "application/pdf"})


def _uploads_dir() -> Path:
    """Mirror the convention in ``main.py:458``.

    Resolved each call so test runs can override via the environment.
    """
    base = os.environ.get("DOCUMENTS_STORAGE_PATH", ".")
    return Path(base) / "uploads"


def _safe_filename(name: str) -> str:
    """Reject path traversal; allow only the basename."""
    return Path(name).name or "upload.bin"


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _load_json(blob: Any) -> dict[str, Any] | None:
    if blob is None:
        return None
    if isinstance(blob, dict):
        return blob
    if not isinstance(blob, str) or not blob.strip():
        return None
    try:
        parsed = json.loads(blob)
    except (ValueError, json.JSONDecodeError):
        return None
    return parsed if isinstance(parsed, dict) else None


def upload_receipt(
    session: Session,
    app_id: int,
    file: Any,
    user_id: int,
) -> dict[str, Any]:
    """Validate MIME, compute SHA-256, persist into ``applied_assets``."""
    app = session.get(Application, app_id)
    if app is None:
        raise ValueError("application not found")
    if app.user_id is not None and app.user_id != user_id:
        raise PermissionError("not your application")

    content_type = getattr(file, "content_type", None)
    if content_type not in _ALLOWED_MIME:
        raise ValueError(f"unsupported mime type: {content_type!r}")

    # Drain bytes once; FastAPI's UploadFile.file is a SpooledTemporaryFile.
    stream = getattr(file, "file", None)
    if stream is None:
        raise ValueError("upload has no readable stream")
    stream.seek(0)
    content = stream.read()
    if not content:
        raise ValueError("upload is empty")

    file_hash = "sha256:" + hashlib.sha256(content).hexdigest()
    bucket = _uploads_dir() / "applied_receipts"
    bucket.mkdir(parents=True, exist_ok=True)
    safe = _safe_filename(getattr(file, "filename", "receipt.bin"))
    saved_at = int(time.time())
    save_path = bucket / f"{saved_at}_{safe}"
    with save_path.open("wb") as out:
        # Rewind stream for shutil-style copy when caller passed a fresh stream
        # We already have ``content`` in memory; write that to avoid a second read.
        out.write(content)

    asset = AppliedAsset(
        application_id=app.id,
        asset_type="receipt",
        file_path=str(save_path),
        mime_type=content_type,
        original_filename=safe,
        file_hash=file_hash,
        uploaded_at=_now_iso(),
        created_by_user_id=user_id,
    )
    session.add(asset)
    session.flush()

    return {
        "id": asset.id,
        "application_id": asset.application_id,
        "asset_type": asset.asset_type,
        "mime_type": asset.mime_type,
        "original_filename": asset.original_filename,
        "uploaded_at": asset.uploaded_at,
        "file_hash": asset.file_hash,
    }


def save_confirmation(
    session: Session,
    app_id: int,
    payload: Any,
    user_id: int,
) -> dict[str, Any]:
    """Persist confirmation_record_json + (re)initialize SLA tracker."""
    validated = ConfirmationRecordIn.model_validate(payload)

    app = session.get(Application, app_id)
    if app is None:
        raise ValueError("application not found")
    if app.user_id is not None and app.user_id != user_id:
        raise PermissionError("not your application")

    receipt_mime: str | None = None
    receipt_uploaded_at: str | None = None
    if validated.receipt_asset_id is not None:
        asset = session.get(AppliedAsset, validated.receipt_asset_id)
        if asset is None:
            raise ValueError(f"receipt_asset_id={validated.receipt_asset_id} not found")
        if asset.application_id != app.id:
            raise ValueError("receipt belongs to a different application")
        receipt_mime = asset.mime_type
        receipt_uploaded_at = asset.uploaded_at

    record_payload = {
        "confirmation_number": validated.confirmation_number,
        "confirmed_at": validated.confirmed_at.astimezone(timezone.utc).isoformat(),
        "source_type": validated.source_type,
        "receipt_asset_id": validated.receipt_asset_id,
        "receipt_mime_type": receipt_mime,
        "receipt_uploaded_at": receipt_uploaded_at,
    }
    app.confirmation_record_json = json.dumps(record_payload)

    # Refresh SLA cache (compute_sla returns None when no baseline; with
    # confirmation just saved, the confirmed_at baseline guarantees a value).
    fresh_sla = derivations.compute_sla(app)
    if fresh_sla is not None:
        app.sla_tracker_json = json.dumps(fresh_sla)

    db = DatabaseService()
    db._log_event(app.id, "confirmation_saved", "Confirmation record saved", session=session)  # noqa: SLF001

    new_substage = derivations.recompute_substage_cache(session, app.id)

    return {
        "ok": True,
        "applied_substage": new_substage or "confirmed",
        "confirmation_record": _load_json(app.confirmation_record_json),
        "sla_tracker": fresh_sla,
    }
