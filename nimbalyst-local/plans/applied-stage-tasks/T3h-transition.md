---
task: T3h
title: Transition to Interviewing
plan: ../applied-stage.md
phase: A2
priority: 8
owner: backend
single_writer: backend/services/applied/transition.py
estimated_loc: ~70
status: ready
dispatchable: after T3a merged
depends_on: [T1, T2, T3.0, T3a]
unlocks: [T13b, T18]
---

# T3h — Transition to Interviewing

## 1. Purpose

Implement `transition_to_interviewing`. Gates on `derivations.compute_next_steps(...).can_transition`. On success, sets `pipeline_stage = 'interviewing'` and emits `moved_to_interviewing`. Does not refresh the substage cache (the row is leaving Applied).

## 2. Single-writer scope

Only `backend/services/applied/transition.py`.

## 3. Exact deliverables

Implement `transition_to_interviewing(session, app_id, user_id) -> dict[str, Any]`.

Steps:

1. Load app + ownership check.
2. Require `app.pipeline_stage == 'applied'`; else raise `ValueError("application is not in Applied stage")`.
3. Compute readiness via `derivations.compute_next_steps(app, contacts=app.contacts)`. If `can_transition is False`, raise `PermissionError("readiness checks not met: " + ", ".join(blockers))` — route layer maps to 422 with structured `blockers`.
4. Set `app.pipeline_stage = 'interviewing'` and flush.
5. Emit `moved_to_interviewing` event with `metadata_json` capturing `{"readiness_score": N, "reasons_met": [...]}`.
6. Return `{"ok": True, "pipeline_stage": "interviewing"}`.

## 4. Do NOT touch

- Do not refresh `applied_substage` after transition. The row is no longer in the Applied stage.
- Do not bypass readiness checks even for "admin" users — v1 has no override path.
- Do not modify any column other than `pipeline_stage`.
- Do not commit.

## 5. Verification

```bash
backend/.venv/bin/ruff check backend/services/applied/transition.py
backend/.venv/bin/mypy --strict --no-incremental backend/services/applied/transition.py

TMPDB=$(mktemp -u --suffix=.db)
DATABASE_URL="sqlite:///$TMPDB" backend/.venv/bin/python <<'PY'
from datetime import datetime, timedelta, timezone
from services.database_service import DatabaseService, Application, ApplicationContact, ApplicationEvent
from backend.services.applied.transition import transition_to_interviewing

db = DatabaseService(); s = db.Session()
now = datetime.now(timezone.utc)

# Row that should fail readiness (no follow-up, no contact)
app1 = Application(job_title='x', company='y', user_id=42, pipeline_stage='applied',
                   submission_record_json='{"applied_at":"%s","channel":"direct"}' % now.isoformat())
s.add(app1); s.flush()
try:
    transition_to_interviewing(s, app1.id, 42)
    raise AssertionError("readiness gate not enforced")
except PermissionError:
    print("readiness gate: OK")

# Row that should pass
old = (now - timedelta(days=10)).isoformat()
app2 = Application(job_title='x2', company='y2', user_id=42, pipeline_stage='applied',
                   submission_record_json='{"applied_at":"%s","channel":"direct"}' % old,
                   confirmation_record_json='{"confirmed_at":"%s"}' % old,
                   follow_up_plan_json='{"due_at":"%s","status":"completed","completed_at":"%s"}' % (old, now.isoformat()),
                   applied_substage='follow_up_sent')
s.add(app2); s.flush()
s.add(ApplicationContact(application_id=app2.id, name="E", role="Recruiter", email="e@x.com"))
s.flush()

out = transition_to_interviewing(s, app2.id, 42)
assert out["pipeline_stage"] == "interviewing"
assert app2.pipeline_stage == "interviewing"

# moved_to_interviewing event present
evs = s.query(ApplicationEvent).filter_by(application_id=app2.id, event_type='moved_to_interviewing').all()
assert len(evs) == 1
print("transition happy path + event: OK")
PY
rm -f "$TMPDB"
```

## 6. Definition of Done

- One file changed. ruff + mypy + readiness-reject + happy-path + event-emit smoke all pass.
