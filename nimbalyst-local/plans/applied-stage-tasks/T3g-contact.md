---
task: T3g
title: Contact upsert against application_contacts
plan: ../applied-stage.md
phase: A2
priority: 7
owner: backend
single_writer: backend/services/applied/contact.py
estimated_loc: ~100
status: ready
dispatchable: after T3.0 merged (independent of T3a)
depends_on: [T1, T2, T3.0]
unlocks: [T11, T17]
---

# T3g — Contact upsert

## 1. Purpose

Implement `upsert_contact`. Inserts or updates one `application_contacts` row. Honors the D1 alias: API field `title` maps to DB column `role`.

## 2. Single-writer scope

Only `backend/services/applied/contact.py`.

## 3. Exact deliverables

Implement `upsert_contact(session, app_id, payload, user_id) -> dict[str, Any]`.

Steps:

1. Validate via `AppliedContactIn.model_validate(payload)`. The model accepts either `title` or `role` on input thanks to `populate_by_name=True`.
2. Load app + ownership check.
3. Match strategy for "this is an update vs insert":
   - If `payload` includes an `id` key AND a row exists for `(app_id, id)`, update that row.
   - Else if `email` is non-null AND a row exists for `(app_id, email)`, update that row (email is the natural key for re-linking).
   - Else insert a new row.
4. Map fields:
   - `name -> ApplicationContact.name`
   - `payload.role` (via Pydantic alias, the value from API key `title`) `-> ApplicationContact.role`
   - `email`, `company`, `is_hiring_manager`, `source` direct
   - `linkedin_url` -> `ApplicationContact.linkedin_url` (cast to str)
5. Emit `contact_linked` event on INSERT only (updates do not emit). Include `metadata_json` with the contact id and source.
6. Return dict matching `AppliedContactOut` — render `role` back to the API as `title` (i.e. include `"title": row.role` in the returned dict).

This module is the only writer of `application_contacts` for the Applied stage. Reads happen everywhere else via existing endpoints in `main.py:3215–3247` (which are not modified).

## 4. Do NOT touch

- Do not rename DB column `role` (D1).
- Do not duplicate contact data into any JSON column on `applications`.
- Do not emit events on update.
- Do not call `recompute_substage_cache` — contact linkage doesn't affect substage by itself.
- Do not modify the existing contact endpoints in `main.py`.

## 5. Verification

```bash
backend/.venv/bin/ruff check backend/services/applied/contact.py
backend/.venv/bin/mypy --strict --no-incremental backend/services/applied/contact.py

TMPDB=$(mktemp -u --suffix=.db)
DATABASE_URL="sqlite:///$TMPDB" backend/.venv/bin/python <<'PY'
from services.database_service import DatabaseService, Application, ApplicationContact
from backend.services.applied.contact import upsert_contact

db = DatabaseService(); s = db.Session()
app = Application(job_title='x', company='y', user_id=42, pipeline_stage='applied')
s.add(app); s.flush()

# Insert path: input via 'title' alias
out1 = upsert_contact(s, app.id, {"name": "Elena", "title": "Recruiter", "email": "e@x.com"}, user_id=42)
assert out1["title"] == "Recruiter"
assert out1["name"] == "Elena"
contact_id = out1["id"]

# Re-upsert by email returns same row, role updated
out2 = upsert_contact(s, app.id, {"name": "Elena", "title": "Senior Recruiter", "email": "e@x.com"}, user_id=42)
assert out2["id"] == contact_id
assert out2["title"] == "Senior Recruiter"
print("upsert by email: OK")

# Insert second contact emits one new contact_linked event
out3 = upsert_contact(s, app.id, {"name": "Mark", "title": "Hiring Manager", "email": "m@x.com", "is_hiring_manager": True}, user_id=42)
assert out3["is_hiring_manager"] is True
print("contact smoke: OK")
PY
rm -f "$TMPDB"
```

## 6. Definition of Done

- One file changed. ruff + mypy + insert + update-by-email + hiring-manager flag smoke pass.
