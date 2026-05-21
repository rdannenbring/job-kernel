---
task: T3c
title: Applied submission service + snapshot lock
plan: ../applied-stage.md
phase: A2
priority: 3
owner: backend
single_writer: backend/services/applied/submission.py
estimated_loc: ~140
status: ready
dispatchable: after T3a merged
depends_on: [T1, T2, T3.0, T3a]
unlocks: [T6]
---

# T3c — Submission service

## 1. Purpose

Implement `save_submission`. Persists `submission_record_json`, locks `submission_snapshot_json` on first save (D3), emits the required events, refreshes the substage cache (D5).

## 2. Single-writer scope

Only `backend/services/applied/submission.py`.

## 3. Exact deliverables

Signature stays `save_submission(session: Session, app_id: int, payload: Any, user_id: int) -> dict[str, Any]`.

Steps:

1. Validate payload via `SubmissionRecordIn.model_validate(payload)`.
2. Load app + ownership check (mirror T3b's pattern: 404 vs 403 as exceptions, route layer translates).
3. Serialize the validated payload (excluding `snapshot`) into `submission_record_json` using `.model_dump_json(exclude={"snapshot"})`. Server-assigned `id` + `created_at` on `FrictionNoteOut` entries: generate UUIDs and `datetime.now(timezone.utc)` here.
4. Snapshot handling (D3):
   - If `app.submission_snapshot_json` is already set AND payload includes `snapshot`, raise `ValueError("submission snapshot is locked")` — route returns 409.
   - If snapshot not set and payload includes one, persist with `captured_at=now` and `historical_lock=true` as `submission_snapshot_json`.
   - If snapshot not set and payload omits one, leave snapshot as `None` (allowed; user can save snapshot later via re-PUT).
5. Emit events via the existing `_log_event(app_id, event_type, description, session=session)` (database_service.py:2006). Required events:
   - `submission_logged` always
   - `submission_snapshot_locked` if a snapshot was persisted in this call
   - `submission_friction_logged` once per friction note in payload
6. Call `derivations.recompute_substage_cache(session, app_id)` to refresh the cache.
7. Return dict matching `SubmissionOut`:
   ```python
   {
     "ok": True,
     "applied_substage": "submitted" | "confirmed" | ...,  # whatever recompute returned
     "submission_record": <decoded current submission_record_json>,
     "submission_snapshot": <decoded current submission_snapshot_json or None>,
   }
   ```

Do NOT commit. The caller owns the transaction.

## 4. Do NOT touch

- Do not overwrite an existing snapshot — that violates D3.
- Do not emit `submission_friction_logged` for friction notes that already have an id (those came from a prior save; only new entries trigger the event).
- Do not call `compute_sla` here — confirmation creates the SLA baseline, not submission.
- Do not call any route module.
- Do not modify other service modules.

## 5. Verification

```bash
backend/.venv/bin/ruff check backend/services/applied/submission.py
backend/.venv/bin/mypy --strict --no-incremental backend/services/applied/submission.py

TMPDB=$(mktemp -u --suffix=.db)
DATABASE_URL="sqlite:///$TMPDB" backend/.venv/bin/python <<'PY'
from datetime import datetime, timezone
from services.database_service import DatabaseService, Application
from backend.services.applied.submission import save_submission

db = DatabaseService(); s = db.Session()
app = Application(job_title='x', company='y', user_id=42, pipeline_stage='applied')
s.add(app); s.flush()

now = datetime.now(timezone.utc).isoformat()
out1 = save_submission(s, app.id, {
    "applied_at": now, "channel": "direct",
    "friction_notes": [{"issue_type": "ux", "description": "forced login"}],
    "snapshot": {"resume_asset_id": 1, "submitted_version_label": "v1"},
}, user_id=42)
assert out1["applied_substage"] == "submitted"
assert out1["submission_snapshot"] is not None

# Snapshot lock: second save with snapshot must reject
try:
    save_submission(s, app.id, {"applied_at": now, "channel": "direct",
                                 "snapshot": {"resume_asset_id": 2}}, user_id=42)
    raise AssertionError("snapshot lock not enforced")
except ValueError as e:
    assert "snapshot" in str(e).lower()
    print("snapshot lock: OK")

# Re-save without snapshot is allowed (updates record only)
out2 = save_submission(s, app.id, {"applied_at": now, "channel": "referral"}, user_id=42)
assert out2["submission_record"]["channel"] == "referral"
print("submission smoke: OK")
PY
rm -f "$TMPDB"
```

## 6. Definition of Done

- One file changed. ruff + mypy + snapshot-lock + re-save-without-snapshot smoke all pass.

## 7. After-the-fact note

T3d next.
