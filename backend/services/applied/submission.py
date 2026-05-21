"""Submission service: save_submission + snapshot lock.

Owner task: T3c. Do not implement bodies here unless you are that task.

Decision references:
- D3: snapshot is immutable after first save. Re-save attempts that
  include a ``snapshot`` payload must be rejected with a clear error.
- D5: after a successful write, call
  ``derivations.recompute_substage_cache`` to refresh the cached
  substage.

Imports allowed: stdlib, ``sqlalchemy.orm.Session``,
``backend.services.database_service`` (ORM classes + ``_log_event``),
``backend.services.applied.derivations``,
``backend.models.applied_models``.
"""
from __future__ import annotations

from typing import Any

from sqlalchemy.orm import Session


def save_submission(
    session: Session,
    app_id: int,
    payload: Any,
    user_id: int,
) -> dict[str, Any]:
    """Persist ``submission_record_json`` and, if it does not already
    exist, ``submission_snapshot_json``. Emits ``submission_logged``
    plus ``submission_snapshot_locked`` and per-note
    ``submission_friction_logged`` events as applicable.

    Returns the ``SubmissionOut`` shape: ``{"ok": True, "applied_substage": str,
    "submission_record": {...}, "submission_snapshot": {...}}``.
    """
    raise NotImplementedError("T3c owns this function")
