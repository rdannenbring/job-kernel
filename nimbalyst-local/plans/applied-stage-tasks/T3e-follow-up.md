---
task: T3e
title: Follow-up plan + send-log service
plan: ../applied-stage.md
phase: A2
priority: 5
owner: backend
single_writer: backend/services/applied/follow_up.py
estimated_loc: ~150
status: ready
dispatchable: after T3a merged
depends_on: [T1, T2, T3.0, T3a]
unlocks: [T9a, T9b, T14, T17]
---

# T3e — Follow-up plan + send-log

## 1. Purpose

Implements `save_follow_up_plan` and `mark_follow_up_sent`. Owns the `follow_up_plan_json` lifecycle per D4 (cache + always-recompute-on-read).

## 2. Single-writer scope

Only `backend/services/applied/follow_up.py`.

## 3. Exact deliverables

### 3a. `save_follow_up_plan(session, app_id, payload, user_id)`

Steps:

1. Validate via `FollowUpPlanIn.model_validate(payload)`.
2. Load app + ownership check.
3. Determine `due_at`:
   - If payload provides `due_at`, use it.
   - Else default per PRD: `confirmation.confirmed_at + 7d` if confirmation exists, else `submission.applied_at + 5d`. Raise `ValueError("cannot derive due_at; no submission record")` if neither exists.
4. Build the persisted plan dict matching `FollowUpPlanOut`:
   - `status`: `"completed"` if existing plan has `completed_at` set; else `"overdue"` if `due_at <= now`; else `"scheduled"`. (Per D4, this is a cache that the sweeper and reads will recompute.)
   - `overdue_days`: `max(0, (now - due_at).days)` when overdue, else 0.
   - `days_since_last_contact`: derived from `last_contact_at` if present.
   - `completed_at`: preserve existing if already set.
5. Persist as `follow_up_plan_json`.
6. Emit `follow_up_plan_saved` event.
7. Call `derivations.recompute_substage_cache(session, app_id)`.
8. Return `{"ok": True, "applied_substage": ..., "follow_up_plan": <persisted plan>}`.

### 3b. `mark_follow_up_sent(session, app_id, payload, user_id)`

Steps:

1. Validate via `FollowUpSentIn.model_validate(payload)`.
2. Load app + ownership check.
3. Validate `payload.sent_at >= submission.applied_at`. Reject with `ValueError("sent_at cannot precede submission")` otherwise.
4. Load existing plan from `follow_up_plan_json` (must exist; reject with `ValueError("no follow-up plan to mark sent")` otherwise).
5. Update plan: `status="completed"`, `completed_at=payload.sent_at`. Persist.
6. Emit `follow_up_sent` event with metadata including channel/template_id/message_excerpt.
7. Call `derivations.recompute_substage_cache`.
8. Return `{"ok": True, "applied_substage": "follow_up_sent", "follow_up_plan": <plan>}`.

## 4. Do NOT touch

- Do not emit notifications. The sweeper job T14 owns `follow_up_overdue` notifications; sent-log events here are timeline entries only.
- Do not modify `application_events` schema or `_log_event` helper.
- Do not write `follow_up_sent` events from `save_follow_up_plan` — only `mark_follow_up_sent` emits that.
- Do not commit.

## 5. Verification

```bash
backend/.venv/bin/ruff check backend/services/applied/follow_up.py
backend/.venv/bin/mypy --strict --no-incremental backend/services/applied/follow_up.py

TMPDB=$(mktemp -u --suffix=.db)
DATABASE_URL="sqlite:///$TMPDB" backend/.venv/bin/python <<'PY'
from datetime import datetime, timedelta, timezone
from services.database_service import DatabaseService, Application
from backend.services.applied.follow_up import save_follow_up_plan, mark_follow_up_sent

db = DatabaseService(); s = db.Session()
applied_at = (datetime.now(timezone.utc) - timedelta(days=8)).isoformat()
app = Application(job_title='x', company='y', user_id=42, pipeline_stage='applied',
                  submission_record_json='{"applied_at":"%s","channel":"direct"}' % applied_at)
s.add(app); s.flush()

# Save with default due (applied_at + 5d -> already past, so overdue)
out = save_follow_up_plan(s, app.id, {}, user_id=42)
assert out["follow_up_plan"]["status"] in ("scheduled", "overdue")
assert out["follow_up_plan"]["due_at"] is not None
print("plan default due: OK")

# Send-log path
sent_at = datetime.now(timezone.utc).isoformat()
out2 = mark_follow_up_sent(s, app.id, {"sent_at": sent_at, "channel": "email"}, user_id=42)
assert out2["applied_substage"] == "follow_up_sent"
assert out2["follow_up_plan"]["status"] == "completed"
print("send-log: OK")

# sent_at before submission must reject
try:
    mark_follow_up_sent(s, app.id, {"sent_at": "2000-01-01T00:00:00+00:00"}, user_id=42)
    raise AssertionError("backward sent_at allowed")
except ValueError:
    print("backward sent_at reject: OK")
PY
rm -f "$TMPDB"
```

## 6. Definition of Done

- One file changed. ruff + mypy + plan-default + send-log + backward-sent-at-rejection smoke pass.

## 7. After-the-fact note

After T3e, the priority-1 wave is complete. Continue with T3f, T3g, T3h.
