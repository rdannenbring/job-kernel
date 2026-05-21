"""Submission service: save_submission + snapshot lock.

Owner task: T3c.

Decision references:
- D3: snapshot is immutable after first save. Re-save attempts that
  include a ``snapshot`` payload while one already exists are rejected.
  Re-saves without a ``snapshot`` are allowed (record-only updates).
- D5: after a successful write, ``derivations.recompute_substage_cache``
  is called to refresh ``applications.applied_substage``.
"""
from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy.orm import Session

from models.applied_models import (  # type: ignore[import-not-found]
    SubmissionRecordIn,
)
from services.applied import derivations  # type: ignore[import-not-found]
from services.database_service import (  # type: ignore[import-not-found]
    Application,
    DatabaseService,
)


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


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _merge_friction_notes(
    existing: list[dict[str, Any]],
    incoming: list[dict[str, Any]],
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    """Return (merged_list, newly_added_only).

    Notes from the incoming payload are server-assigned an ``id`` and
    ``created_at`` if not already present. Notes that came back from
    the client with an existing ``id`` are passed through unchanged
    (we trust the server's own prior writes).
    """
    merged: list[dict[str, Any]] = list(existing)
    new_only: list[dict[str, Any]] = []
    for note in incoming:
        nid = note.get("id")
        if nid is not None and any(e.get("id") == nid for e in merged):
            continue
        enriched = {
            "id": nid or str(uuid.uuid4()),
            "issue_type": note["issue_type"],
            "description": note["description"],
            "created_at": note.get("created_at") or _now_iso(),
        }
        merged.append(enriched)
        new_only.append(enriched)
    return merged, new_only


def save_submission(
    session: Session,
    app_id: int,
    payload: Any,
    user_id: int,
) -> dict[str, Any]:
    """Persist the submission record (and snapshot on first save) per D3."""
    validated = SubmissionRecordIn.model_validate(payload)

    app = session.get(Application, app_id)
    if app is None:
        raise ValueError("application not found")
    if app.user_id is not None and app.user_id != user_id:
        raise PermissionError("not your application")

    # ─── Snapshot lock (D3) ────────────────────────────────────────────
    existing_snapshot = _load_json(app.submission_snapshot_json)
    incoming_snapshot = validated.snapshot
    snapshot_was_locked_now = False
    if existing_snapshot is not None and incoming_snapshot is not None:
        raise ValueError("submission snapshot is locked")
    if existing_snapshot is None and incoming_snapshot is not None:
        snapshot_payload = {
            "resume_asset_id": incoming_snapshot.resume_asset_id,
            "cover_letter_asset_id": incoming_snapshot.cover_letter_asset_id,
            "portfolio_asset_id": incoming_snapshot.portfolio_asset_id,
            "submitted_version_label": incoming_snapshot.submitted_version_label,
            "historical_lock": True,
            "captured_at": _now_iso(),
        }
        app.submission_snapshot_json = json.dumps(snapshot_payload)
        existing_snapshot = snapshot_payload
        snapshot_was_locked_now = True

    # ─── Friction notes: server-assign ids/timestamps ──────────────────
    existing_record = _load_json(app.submission_record_json) or {}
    existing_notes = existing_record.get("friction_notes") or []
    incoming_notes_raw = [n.model_dump(mode="json") for n in validated.friction_notes]
    merged_notes, new_notes = _merge_friction_notes(existing_notes, incoming_notes_raw)

    # ─── Persist submission record ─────────────────────────────────────
    record_payload = validated.model_dump(mode="json", exclude={"snapshot", "friction_notes"})
    record_payload["friction_notes"] = merged_notes
    app.submission_record_json = json.dumps(record_payload)

    # ─── Emit events via the existing helper ───────────────────────────
    # _log_event is a method on DatabaseService; when ``session`` is
    # supplied, no self-state is touched, so a single transient instance
    # is fine for this whole write path.
    db = DatabaseService()
    db._log_event(app.id, "submission_logged", "Submission record saved", session=session)  # noqa: SLF001
    if snapshot_was_locked_now:
        db._log_event(app.id, "submission_snapshot_locked", "Submission snapshot captured", session=session)  # noqa: SLF001
    for n in new_notes:
        db._log_event(  # noqa: SLF001
            app.id,
            "submission_friction_logged",
            f"Friction note: {n['issue_type']}",
            session=session,
        )

    # ─── Refresh substage cache (D5) ───────────────────────────────────
    new_substage = derivations.recompute_substage_cache(session, app.id)

    return {
        "ok": True,
        "applied_substage": new_substage or "submitted",
        "submission_record": _load_json(app.submission_record_json),
        "submission_snapshot": existing_snapshot,
    }
