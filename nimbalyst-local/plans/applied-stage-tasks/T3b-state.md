---
task: T3b
title: Applied state assembly (read-only)
plan: ../applied-stage.md
phase: A2
priority: 2
owner: backend
single_writer: backend/services/applied/state.py
estimated_loc: ~120
status: ready
dispatchable: after T3a merged
depends_on: [T1, T2, T3.0, T3a]
unlocks: [T5, T12]
---

# T3b — State assembly (read-only)

## 1. Purpose

Implement the single read function that powers `GET /applied`. Assembles submission, confirmation, follow-up, SLA, contacts, and completion into the `AppliedStateOut` shape from T2.

## 2. Single-writer scope

Only `backend/services/applied/state.py`. Do not modify any other file.

## 3. Exact deliverables

Implement `get_applied_state(session: Session, app_id: int, user_id: int) -> dict[str, Any]`.

Steps:

1. `app = session.get(Application, app_id)`. If `app is None` raise `ValueError("application not found")`. If `app.user_id is not None and app.user_id != user_id` raise `PermissionError("not your application")` (route layer maps to 403).
2. Decode each JSON column with a safe helper `_load_json(text) -> dict | None` (returns `None` on null/blank/bad JSON; do not crash a read because of malformed historical data).
3. Build the response dict mirroring `AppliedStateOut`:
   - `application_id`, `pipeline_stage`, `applied_substage`
   - `submission_record`: loaded from `submission_record_json`
   - `submission_snapshot`: loaded from `submission_snapshot_json`
   - `confirmation_record`: loaded from `confirmation_record_json`
   - `follow_up_plan`: loaded from `follow_up_plan_json`
   - `sla_tracker`: prefer recomputed `derivations.compute_sla(app)` if it returns non-None; fall back to cached `sla_tracker_json` if compute returns None but cache exists; else `None`
   - `contacts`: `[ {"id": c.id, "name": c.name, "title": c.role, "email": c.email, "company": c.company, "linkedin_url": c.linkedin_url, "is_hiring_manager": bool(c.is_hiring_manager), "source": c.source} for c in app.contacts ]` (the API alias for `role` is `title` per D1)
   - `completion`: `derivations.compute_completion(app)`
4. Return as a plain dict. Pydantic shaping happens at the route boundary.

This module is strictly read-only — no `_log_event`, no column writes, no `recompute_substage_cache` calls.

## 4. Do NOT touch

- Do not call `derivations.recompute_substage_cache` — reads must not mutate the cache. The cache is refreshed only by writer modules (D5).
- Do not import `backend.models.applied_models`. Pydantic validation lives at the route layer.
- Do not duplicate contact data into any JSON blob (canonical source is `application_contacts` per the source-of-truth matrix).
- Do not emit any event.
- Do not catch generic `Exception`. Only catch `json.JSONDecodeError`/`ValueError` in `_load_json`.

## 5. Verification

```bash
# 5a. ruff + mypy --strict
backend/.venv/bin/ruff check backend/services/applied/state.py
backend/.venv/bin/mypy --strict --no-incremental backend/services/applied/state.py

# 5b. Round-trip a synthetic row through state assembly
TMPDB=$(mktemp -u --suffix=.db)
DATABASE_URL="sqlite:///$TMPDB" backend/.venv/bin/python <<'PY'
from datetime import datetime, timezone
from services.database_service import DatabaseService, Application, ApplicationContact
from backend.services.applied.state import get_applied_state

db = DatabaseService()
s = db.Session()
now = datetime.now(timezone.utc).isoformat()
app = Application(job_title="x", company="y", user_id=99, pipeline_stage="applied",
                  submission_record_json='{"applied_at":"%s","channel":"direct"}' % now,
                  confirmation_record_json='{"confirmed_at":"%s"}' % now,
                  applied_substage="confirmed")
s.add(app); s.flush()
s.add(ApplicationContact(application_id=app.id, name="Elena", role="Recruiter", email="e@x.com", is_hiring_manager=False, source="manual"))
s.flush()

st = get_applied_state(s, app.id, 99)
assert st["application_id"] == app.id
assert st["applied_substage"] == "confirmed"
assert st["pipeline_stage"] == "applied"
assert st["contacts"][0]["title"] == "Recruiter"  # role -> title alias at boundary
assert st["completion"]["percentage"] >= 50
assert st["sla_tracker"] is not None  # confirmed_at gives a baseline
assert "submission_record" in st and st["submission_record"]["channel"] == "direct"
s.rollback()
print("state smoke: OK")

# Ownership check
try:
    get_applied_state(s, app.id, 12345)
    raise AssertionError("expected PermissionError")
except PermissionError:
    print("ownership check: OK")
PY
rm -f "$TMPDB"
```

## 6. Definition of Done

- One file changed: `backend/services/applied/state.py`.
- ruff + mypy --strict + the round-trip smoke + ownership check all pass.

## 7. After-the-fact note

T3c next.
