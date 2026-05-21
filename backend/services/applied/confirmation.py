"""Confirmation service: receipt upload + save_confirmation.

Owner task: T3d. Do not implement bodies here unless you are that task.

Receipt upload follows the existing repo pattern in
``backend/main.py:657`` (``upload_app_additional_doc``): multipart
``UploadFile`` -> SHA-256 hash -> persist asset row. MIME allow-list is
``image/png``, ``image/jpeg``, ``application/pdf``; reject any other type.

Confirmation save initializes ``sla_tracker_json`` via
``derivations.compute_sla`` and refreshes the substage cache (D5).

Imports allowed: stdlib, ``hashlib``, ``sqlalchemy.orm.Session``,
``backend.services.database_service`` (ORM + ``_log_event``),
``backend.services.applied.derivations``,
``backend.models.applied_models``. ``UploadFile`` is type-only at
this layer; the route handler unwraps the file object before calling.
"""
from __future__ import annotations

from typing import Any

from sqlalchemy.orm import Session


def upload_receipt(
    session: Session,
    app_id: int,
    file: Any,
    user_id: int,
) -> dict[str, Any]:
    """Validate MIME, compute SHA-256, persist into ``applied_assets``,
    return the new asset row as ``ReceiptAssetOut``.
    """
    raise NotImplementedError("T3d owns this function")


def save_confirmation(
    session: Session,
    app_id: int,
    payload: Any,
    user_id: int,
) -> dict[str, Any]:
    """Persist ``confirmation_record_json``. Validates that any provided
    ``receipt_asset_id`` belongs to the same application. Initializes
    or refreshes ``sla_tracker_json``. Emits ``confirmation_saved``.
    """
    raise NotImplementedError("T3d owns this function")
