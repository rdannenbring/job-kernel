---
task: T2
title: Pydantic input/output contracts for Applied stage
plan: ../applied-stage.md
phase: A1
owner: backend
single_writer: backend/models/applied_models.py (new file)
estimated_loc: ~180
status: ready
dispatchable: after T1 merges
depends_on: [T1]
---

# T2 — Pydantic contracts for Applied stage

## 1. Purpose

Define the input and output Pydantic models for every Applied-stage endpoint. T3 and T5–T13 import from this file; do not let them import from anywhere else.

## 2. Single-writer scope

You are the only writer of `backend/models/applied_models.py` for this initiative. Create the file; do not edit any other file.

## 3. Exact deliverables

### 3a. Create directory + module

```bash
mkdir -p backend/models
touch backend/models/__init__.py  # only create if it does not already exist
```

### 3b. Author `backend/models/applied_models.py`

Implement the models per the PRD §"Pydantic contract sketch" (`documentation/applied-stage-prd.md:734–783`) plus the response models needed by §"API design".

Required input models (from the PRD): `FrictionNoteIn`, `SubmissionSnapshotIn`, `SubmissionRecordIn`, `ConfirmationRecordIn`, `FollowUpPlanIn`, `FollowUpSentIn`, `AppliedContactIn`.

Additionally define these output models (one per response shape in the PRD):
`AppliedStateOut`, `SubmissionOut`, `ConfirmationOut`, `ReceiptAssetOut`, `FollowUpPlanOut`, `FollowUpSentOut`, `FollowUpTemplateOut`, `AppliedContactOut`, `SLATrackerOut`, `SLAMilestoneOut`, `ActivityLogItemOut`, `ActivityLogPageOut`, `NextStepsOut`, `TransitionResultOut`, `CompletionOut`, `CompletionSubstageOut`.

### 3c. Conventions to enforce

- **All datetimes are `datetime` with `tzinfo=UTC`.** Use Pydantic field validators that reject naive datetimes with a clear error message.
- **JSON field shapes mirror the PRD examples literally** — no renamed keys.
- **Contact alias for D1:** `AppliedContactIn` and `AppliedContactOut` expose the field as `title` to the API, but map to/from the DB column `role` via `Field(alias="title")` or an explicit `model_config = ConfigDict(populate_by_name=True)` pattern. The DB-side rename does NOT happen — only the API surface.
- **Friction notes:** `FrictionNoteIn` has no `id` or `created_at` (server assigns). The output variant `FrictionNoteOut` includes both.
- **Snapshot input is optional on every endpoint except the initial save:** server-side validation lives in T3c, not here.
- **Use `EmailStr` and `AnyUrl`** for `AppliedContactIn.email` and `AppliedContactIn.linkedin_url`. These exist in `pydantic` already (per `backend/requirements.txt`).

### 3d. File header

```python
"""Pydantic contracts for the Applied stage API.

All models defined here are the canonical request/response shapes for
``/api/applications/{application_id}/applied/*`` endpoints. Do not redefine
any of these in route handlers or service modules.

Datetime convention: all datetime fields are UTC-aware. Naive datetimes are
rejected with a 422.

Field aliasing (decision D1): ``AppliedContactIn.title`` aliases the DB
column ``application_contacts.role``. The DB column is intentionally not
renamed.
"""
from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, EmailStr, AnyUrl, Field, field_validator

# ...
```

## 4. Do NOT touch

- **Do not import from** `backend.services.applied` (T3 not built yet).
- **Do not** add business logic, defaults that perform computation, or DB I/O.
- **Do not** redefine any model that already exists elsewhere (e.g. there's already a `ProfileModel` in `main.py`; do not touch it).
- **Do not** use `datetime.now()` or `datetime.utcnow()` anywhere — these models are pure shape definitions; timestamps are produced by the service layer.
- **Do not** add `Optional` defaults that hide required fields. Required fields stay required.
- **Do not** create response models that combine multiple PRD shapes into one mega-model. Keep them granular per PRD.
- **Do not** add `__all__` — let `from backend.models.applied_models import X` work by explicit name.

## 5. Verification

```bash
# 5a. Module imports
python -c "
from backend.models.applied_models import (
    FrictionNoteIn, SubmissionSnapshotIn, SubmissionRecordIn,
    ConfirmationRecordIn, FollowUpPlanIn, FollowUpSentIn, AppliedContactIn,
    AppliedStateOut, SubmissionOut, ConfirmationOut, ReceiptAssetOut,
    FollowUpPlanOut, FollowUpSentOut, FollowUpTemplateOut, AppliedContactOut,
    SLATrackerOut, SLAMilestoneOut, ActivityLogItemOut, ActivityLogPageOut,
    NextStepsOut, TransitionResultOut, CompletionOut, CompletionSubstageOut,
)
print('OK')
"

# 5b. Naive datetime rejected
python -c "
from datetime import datetime
from backend.models.applied_models import SubmissionRecordIn
try:
    SubmissionRecordIn(applied_at=datetime(2026,5,21,9,15,0), channel='direct')
    print('FAIL: naive datetime accepted')
except Exception as e:
    print('OK: rejected naive datetime')
"

# 5c. Contact alias works both directions
python -c "
from backend.models.applied_models import AppliedContactIn, AppliedContactOut
c = AppliedContactIn.model_validate({'name': 'X', 'title': 'Recruiter'})
assert c.model_dump(by_alias=True)['title'] == 'Recruiter'
print('OK: title alias works')
"

# 5d. Ruff clean
ruff check backend/models/applied_models.py
```

## 6. Definition of Done

- Single new file `backend/models/applied_models.py` (+ `backend/models/__init__.py` if absent).
- All five verifications pass.
- No imports from `backend.services.applied` or `backend.routes.applied`.
- PR description lists every exported model name.

## 7. After-the-fact note

When T2 merges, dispatch T3.0 (`T3.0-service-skeleton.md`).
