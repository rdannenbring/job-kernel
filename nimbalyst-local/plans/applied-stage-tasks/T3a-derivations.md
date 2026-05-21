---
task: T3a
title: Applied derivations (pure functions)
plan: ../applied-stage.md
phase: A2
priority: 1
owner: backend
single_writer: backend/services/applied/derivations.py
estimated_loc: ~150
status: ready
dispatchable: after T3.0 merged (b92938d... 4840888)
depends_on: [T1, T2, T3.0]
unlocks: [T3b, T3c, T3d, T3e, T3h, T8, T13a]
---

# T3a — Derivations (pure functions)

## 1. Purpose

Implement the four pure derivation functions plus the one writer helper that every Applied writer module calls at the end of its write path (per D5). After this lands, every service module that depends on substage/SLA/completion/next-steps logic can import from here instead of re-deriving rules.

## 2. Single-writer scope

Only `backend/services/applied/derivations.py`. Do not edit any other file.

## 3. Exact deliverables

Replace each `NotImplementedError` body with a real implementation in `derivations.py`.

### 3a. `determine_applied_substage(app_row) -> str | None`

Priority (PRD section 'Substages', confirmed by §13.3):

1. `follow_up_sent` — when `application_events` contains a `follow_up_sent` event for this app **OR** `follow_up_plan_json.status == 'completed'`.
2. `follow_up_due` — when `follow_up_plan_json.due_at` is past-or-now and no `follow_up_sent` recorded.
3. `confirmed` — when `confirmation_record_json` exists and parses successfully.
4. `submitted` — when `submission_record_json` exists and parses successfully.
5. else `None`.

Accept `app_row` as either a SQLAlchemy `Application` instance OR a dict-like row mapper. Use `getattr` with `dict.get` fallback so callers can pass either. Do not open a session.

For the "follow-up sent event exists" check, accept an optional `events: list | None = None` parameter (default `None`) — if `None`, infer from `follow_up_plan_json.status`. The sweeper job (T14) and the activity-log endpoint (T12) will pass the actual event list when available.

### 3b. `compute_completion(app_row) -> dict[str, Any]`

Return shape (PRD section 'compute_applied_completion'):

```python
{
  "percentage": int,                        # 0..100, rounded
  "substages": [
    {"id": "submitted",        "complete": bool},
    {"id": "confirmed",        "complete": bool},
    {"id": "follow_up_due",    "complete": bool},
    {"id": "follow_up_sent",   "complete": bool},
  ],
}
```

Weights: 25/25/25/25. A substage is `complete` when its eligibility rule holds (mirror `determine_applied_substage` predicates).

### 3c. `compute_sla(app_row) -> dict[str, Any] | None`

Decision D6: return `None` if no baseline exists.

Baseline = `confirmation_record_json.confirmed_at` else `submission_record_json.applied_at`.

Milestones at 7, 14, 21 days. Output shape:

```python
{
  "baseline_date":  "2026-05-21T09:15:00Z",
  "days_elapsed":   int,
  "milestones": [
    {"days": 7,  "label": "standard_window",     "reached": bool, "reached_at": "..." | None},
    {"days": 14, "label": "aging_alert",         "reached": bool, "reached_at": "..." | None},
    {"days": 21, "label": "escalation_threshold","reached": bool, "reached_at": "..." | None},
  ],
  "current_state":            "within_window" | "awaiting_response" | "stale" | "critical",
  "alert_level":              "none" | "low" | "medium" | "high",
  "next_recommended_action":  "wait" | "prepare_follow_up" | "send_follow_up" | "escalate",
}
```

`reached_at` is `baseline_date + N days`. `current_state` / `alert_level` / `next_recommended_action` thresholds:

- `< 7d`: within_window / none / wait
- `>= 7d` and `< 14d`: awaiting_response / low / prepare_follow_up
- `>= 14d` and `< 21d`: stale / medium / send_follow_up
- `>= 21d`: critical / high / escalate

All datetimes must be parsed/emitted as UTC ISO-8601 (use `datetime.fromisoformat` with `+00:00` normalization).

### 3d. `compute_next_steps(app_row) -> dict[str, Any]`

Output shape (PRD section 'GET /applied/next-steps'):

```python
{
  "can_transition":     bool,
  "readiness_score":    int,   # 0..100
  "reasons_met":        list[str],
  "blockers":           list[str],
  "recommended_action": str,   # "wait_for_response" | "send_follow_up" | "transition_to_interviewing" | etc.
}
```

Readiness rules (per PRD section 'Readiness for Interviewing'):

- `follow_up_sent` — `applied_substage == 'follow_up_sent'`
- `contact_exists` — at least one row in `application_contacts` for this app
- `response_window_met` — `compute_sla(...)["days_elapsed"] >= 7`
- `no_unresolved_blockers` — placeholder; always true for v1

`readiness_score` = (signals met / total signals) * 100, rounded.
`can_transition` = all four signals met.
`recommended_action` = derived from which signals are missing (use a simple if-cascade keyed off blockers).

For the contact-exists check, accept an optional `contacts: list | None = None` parameter — callers in service-module contexts can pass the eagerly-loaded `app.contacts` relationship; default `None` means "treat as no contacts" so this function stays pure.

### 3e. `recompute_substage_cache(session: Session, app_id: int) -> str | None`

The only non-pure function in this module. Implementation:

1. Load the `Application` row by primary key via `session.get(Application, app_id)`.
2. Eager-load `app.events` (for the `follow_up_sent` event check) via SQLAlchemy's default lazy load, which is fine in a session.
3. Call `determine_applied_substage(app, events=app.events)`.
4. If the new value differs from `app.applied_substage`, assign and flush. Do NOT commit — the caller owns the transaction boundary.
5. Return the new substage value.

Imports: `from services.database_service import Application`. Keep this the only DB-touching function in the module so the pure helpers stay reusable in tests + the T14 sweeper.

## 4. Do NOT touch

- **Do not** modify any other module (`state.py`, `submission.py`, etc.). Their stubs stay `NotImplementedError`.
- **Do not** import `backend.routes.applied` or any route module.
- **Do not** import `backend.models.applied_models`. The pure derivations operate on raw row data and dicts, not on Pydantic models — Pydantic shaping happens at the route boundary.
- **Do not** open a database session inside `determine_applied_substage`, `compute_completion`, `compute_sla`, or `compute_next_steps`. Only `recompute_substage_cache` is allowed to use the session.
- **Do not** raise on missing fields. Treat absent JSON columns as "this substage's predicate is false" — return `None` from substage derivation, `0%` from completion, `None` from SLA, and an empty signal set from next-steps. Errors should never escape pure derivations; they only happen for genuinely malformed JSON.
- **Do not** commit or rollback the session inside `recompute_substage_cache`. The caller owns the transaction.
- **Do not** edit `backend/services/applied/__init__.py` re-exports — they already cover the module.

## 5. Verification

Run from repo root.

```bash
# 5a. ruff + mypy --strict (must stay green per Phase A baseline)
backend/.venv/bin/ruff check backend/services/applied/derivations.py
backend/.venv/bin/mypy --strict --no-incremental backend/services/applied/derivations.py

# 5b. Pure helpers behave per spec on minimal row fixtures
backend/.venv/bin/python <<'PY'
from datetime import datetime, timedelta, timezone
from backend.services.applied import derivations as d

def row(**kw):
    """Build a minimal duck-typed row exposing attribute access."""
    class _R:
        def __init__(self, **kw): self.__dict__.update(kw)
    return _R(**kw)

# Empty row -> None
assert d.determine_applied_substage(row()) is None
# Submission only
applied_at = (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()
sub = '{"applied_at":"%s","channel":"direct"}' % applied_at
assert d.determine_applied_substage(row(submission_record_json=sub)) == "submitted"
# Confirmation present -> confirmed
confirmed_at = (datetime.now(timezone.utc) - timedelta(days=8)).isoformat()
conf = '{"confirmed_at":"%s"}' % confirmed_at
assert d.determine_applied_substage(row(submission_record_json=sub, confirmation_record_json=conf)) == "confirmed"
# Follow-up plan due now -> follow_up_due
plan_due = '{"due_at":"%s","status":"scheduled"}' % (datetime.now(timezone.utc) - timedelta(minutes=1)).isoformat()
assert d.determine_applied_substage(row(submission_record_json=sub, confirmation_record_json=conf, follow_up_plan_json=plan_due)) == "follow_up_due"
# Follow-up plan completed -> follow_up_sent (via status fallback)
plan_done = '{"due_at":"%s","status":"completed"}' % (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()
assert d.determine_applied_substage(row(submission_record_json=sub, confirmation_record_json=conf, follow_up_plan_json=plan_done)) == "follow_up_sent"

# Completion math
r = row(submission_record_json=sub, confirmation_record_json=conf)
c = d.compute_completion(r)
assert c["percentage"] == 50, c
assert sum(1 for s in c["substages"] if s["complete"]) == 2

# SLA returns None without baseline
assert d.compute_sla(row()) is None
# SLA baseline = confirmed_at
s = d.compute_sla(row(confirmation_record_json=conf))
assert s is not None
assert s["days_elapsed"] >= 7
assert s["milestones"][0]["reached"] is True

# Next steps with all signals false
n = d.compute_next_steps(row())
assert n["can_transition"] is False
assert "follow_up_sent" not in n["reasons_met"]

print("derivations smoke: OK")
PY

# 5c. recompute_substage_cache uses a real session against a temp DB
TMPDB=$(mktemp -u --suffix=.db)
DATABASE_URL="sqlite:///$TMPDB" backend/.venv/bin/python <<'PY'
import os
from datetime import datetime, timedelta, timezone
from services.database_service import DatabaseService, Application
from backend.services.applied.derivations import recompute_substage_cache

db = DatabaseService()
session = db.Session()
# Need a user_id NOT NULL? Inspect column; legacy nullable per backend/services/database_service.py:32.
app = Application(job_title='x', company='y',
                  submission_record_json='{"applied_at":"%s","channel":"direct"}' % datetime.now(timezone.utc).isoformat())
session.add(app); session.flush()
sub = recompute_substage_cache(session, app.id)
assert sub == 'submitted', sub
assert app.applied_substage == 'submitted'
session.rollback()
print("recompute_substage_cache: OK")
PY
rm -f "$TMPDB"
```

Per the README convention (Note A from T1), `DATABASE_URL` is pinned explicitly so the temp DB is the one we actually inspect.

## 6. Definition of Done

- One file changed: `backend/services/applied/derivations.py`.
- All four verifications (5a ruff, 5a mypy, 5b pure-helpers smoke, 5c recompute_substage_cache integration) pass.
- No new dependencies in `backend/requirements.txt`.
- PR body includes the smoke-test stdout proving the 4 substages, 50% completion, SLA baseline pickup, and substage cache write.

## 7. After-the-fact note for orchestrator

When T3a merges, dispatch T3b next (single-writer on `state.py`, depends on T3a's derivations). The rest of Phase A2 can follow in priority order: T3c, T3d, T3e, then T3f, T3g, T3h.
