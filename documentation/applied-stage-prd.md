# Applied Stage PRD

## Overview

This document defines the product requirements, backend behavior, API contracts, data model, and delivery plan for the **Applied** stage in the job application workflow. The existing product already exposes Applied substage UI for `submitted`, `confirmed`, `follow_up_due`, and `follow_up_sent`, and the workflow mapping for the Applied stage lists the primary CTA as “Mark follow-up plan” with secondary CTAs “Add receipt, log contact.” [cite:5]

The goal of this PRD is to convert the current screen-driven Applied experience into a fully implemented workflow backed by structured data, deterministic state transitions, immutable audit history, and explicit service contracts. The design assumes an existing FastAPI + SQLAlchemy + SQLite stack and an existing application domain with contacts and event logging already present in the codebase, as described in the reviewed orchestration output. [cite:30]

## Product goals

- Track what was submitted for a given application, including metadata and a historical snapshot of submitted documents.
- Capture proof that an application was received or confirmed.
- Help the user decide when to follow up and provide ready-to-use follow-up drafts.
- Record all Applied-stage actions in an activity timeline.
- Recommend when the application is ready to move from Applied to Interviewing.
- Avoid duplicate sources of truth by extending existing contact and event models where possible. [cite:26][cite:30]

## Scope

### In scope

- Applied substage state machine.
- Submission record and immutable submission snapshot.
- Confirmation record (screenshot, email receipt, etc.) and receipt proof upload (screenshot,captured with chrome extension while applying, etc.).
- SLA and elapsed-time tracking.
- Follow-up planning and sent follow-up tracking.
- Contact association for Applied-stage workflows.
- Activity log and next-step recommendations.
- Backend APIs and persistence.
- Frontend integration points for the existing Applied screens.

## Users and jobs

### Primary user

- A job seeker tracking applications across multiple companies who needs clear post-application follow-up guidance.

### Core jobs to be done

- Record exactly what was submitted.
- Prove that the application was received.
- Know when to follow up.
- Reuse good follow-up wording quickly.
- Preserve a trustworthy audit trail.
- Advance to Interviewing only when the available evidence supports it.

## Stage model

The Applied stage consists of four substages already represented in the UI: `submitted`, `confirmed`, `follow_up_due`, and `follow_up_sent`. The backend must treat these as deterministic workflow substages rather than visual-only flags. [cite:5]

### Source-of-truth rules

| Concern | Canonical source | Notes |
| --- | --- | --- |
| Pipeline stage | `applications.pipeline_stage` | Existing top-level lifecycle field. |
| Applied current substage | `applications.applied_substage` | Derived and persisted for efficient reads. |
| Submission details | `applications.submission_record_json` | Application-scoped JSON document. |
| Submission snapshot | `applications.submission_snapshot_json` | Immutable application-scoped JSON document. |
| Confirmation details | `applications.confirmation_record_json` | Application-scoped JSON document. |
| Follow-up plan | `applications.follow_up_plan_json` | Application-scoped JSON document. |
| SLA tracker cache | `applications.sla_tracker_json` | Cached computed state; may be recomputed. |
| Contacts | `application_contacts` | Canonical contact source; no independent contact JSON owner. |
| Activity timeline | `application_events` | Append-only event log for Applied actions. |
| Receipt / proof files | `applied_assets` | Dedicated immutable artifact table. |

Using JSON for application-scoped 1:1 documents is a pragmatic fit for a SQLite + SQLAlchemy app, while queryable records such as contacts, assets, and events should remain in dedicated tables for filtering and timeline use. [cite:22][cite:25][cite:34]

## Functional requirements

### 1. Submitted

The system must allow the user to save a submission record containing:

- `applied_at`
- `channel`
- `portal_type`
- `portal_name`
- `referral_status`
- optional notes
- zero or more friction notes

The system must create an immutable snapshot of the submitted assets at the time of submission, including:

- resume asset reference
- cover letter asset reference
- optional portfolio asset reference
- submitted version label
- historical lock flag

If a submission record exists, the application becomes eligible for the `submitted` substage.

### 2. Confirmed

The system must allow the user to save confirmation evidence containing:

- confirmation number
- confirmed timestamp
- source type
- optional linked receipt/proof asset

The system must support proof uploads for `image/png`, `image/jpeg`, and `application/pdf` and store immutable metadata for those assets. Once valid confirmation data exists, the application becomes eligible for the `confirmed` substage.

### 3. Follow-up Due

The system must allow a follow-up plan containing:

- due date
- status
- recommended template type
- last contact timestamp
- derived overdue days

The system must identify when the follow-up becomes due or overdue and generate corresponding notifications through the existing notification system. A follow-up plan may be auto-created using recommended rules based on the submission or confirmation date. [cite:30]

### 4. Follow-up Sent

The system must allow the user to record that a follow-up was sent, including optional metadata such as:

- sent timestamp
- template used
- delivery channel
- message excerpt

Once follow-up outreach is logged, the system marks the plan completed, records a timeline event, and makes the application eligible for the `follow_up_sent` substage.

### 5. Activity log

Every major Applied-stage action must create an append-only event so the timeline can be reconstructed reliably. Event logs are a strong fit for audit trails and workflow history because they preserve what happened and when instead of only storing the latest state. [cite:26][cite:35]

Required event types:

- `submission_logged`
- `submission_snapshot_locked`
- `submission_friction_logged`
- `confirmation_saved`
- `receipt_uploaded`
- `follow_up_plan_saved`
- `follow_up_overdue`
- `follow_up_sent`
- `contact_linked`
- `moved_to_interviewing`
- `application_archived`

### 6. Readiness for Interviewing

The system must compute readiness for the “Move to Interviewing” action using business signals such as:

- follow-up sent
- contact exists
- elapsed waiting window met
- no unresolved blockers

The UI may present readiness recommendations, but the backend owns the eligibility rules.

## Non-functional requirements

- All new timestamps must be stored in UTC ISO-8601 format.
- Background jobs must be idempotent to prevent duplicate notifications or repeated state mutations.
- APIs must be backward-compatible with existing non-Applied flows.
- File validation must reject unsupported MIME types.
- Timeline and state APIs must be deterministic and safe to recompute.
- The system should prefer extending existing abstractions over introducing parallel models. [cite:29][cite:30]

## State machine

### Substages

- `submitted`
- `confirmed`
- `follow_up_due`
- `follow_up_sent`

### Derived priority

If multiple conditions are true at once, the current Applied substage is derived using this priority order:

1. `follow_up_sent`
2. `follow_up_due`
3. `confirmed`
4. `submitted`

### Eligibility rules

| Substage | Entry condition |
| --- | --- |
| `submitted` | `submission_record_json` exists and is valid. |
| `confirmed` | `confirmation_record_json` exists and is valid. |
| `follow_up_due` | `follow_up_plan_json.due_at` is past or current and no sent follow-up is recorded. |
| `follow_up_sent` | a `follow_up_sent` event exists or the plan status is `completed`. |

### Transition rules

- The system may persist `applied_substage` for read efficiency.
- The system must also support recomputing the substage from data.
- Manual transitions that conflict with data-derived truth must be blocked unless a privileged override mode is introduced later.
- Direct arbitrary field mutation is discouraged; workflow transitions should be driven by explicit business actions rather than generic status updates. Modeling workflow transitions as actions is more explicit and safer than treating them as free-form field edits. [cite:27][cite:30]

## Data model

### Applications table changes

Add the following columns to `applications`:

| Column | Type | Nullable | Description |
| --- | --- | --- | --- |
| `applied_substage` | `String(64)` | Yes | Current Applied substage cache. |
| `submission_record_json` | `Text` | Yes | Submission record JSON document. |
| `submission_snapshot_json` | `Text` | Yes | Immutable submitted asset snapshot. |
| `confirmation_record_json` | `Text` | Yes | Confirmation details JSON document. |
| `follow_up_plan_json` | `Text` | Yes | Follow-up plan JSON document. |
| `sla_tracker_json` | `Text` | Yes | Cached SLA status and milestones. |

### JSON document shapes

#### `submission_record_json`

```json
{
  "applied_at": "2026-05-20T13:42:00Z",
  "channel": "direct",
  "portal_type": "ats",
  "portal_name": "Greenhouse",
  "referral_status": "none",
  "submitted_by": "user",
  "notes": "Applied through company careers page.",
  "friction_notes": [
    {
      "id": "uuid",
      "issue_type": "ux_dark_pattern",
      "description": "Forced account creation after easy apply redirect.",
      "created_at": "2026-05-20T13:50:00Z"
    }
  ]
}
```

#### `submission_snapshot_json`

```json
{
  "resume_asset_id": 101,
  "cover_letter_asset_id": 102,
  "portfolio_asset_id": 103,
  "submitted_version_label": "2026-05-20-primary",
  "historical_lock": true,
  "captured_at": "2026-05-20T13:42:00Z"
}
```

#### `confirmation_record_json`

```json
{
  "confirmation_number": "APP-8829-XJ",
  "confirmed_at": "2026-05-21T09:15:00Z",
  "source_type": "ats",
  "receipt_asset_id": 990,
  "receipt_mime_type": "application/pdf",
  "receipt_uploaded_at": "2026-05-21T09:16:00Z"
}
```

#### `follow_up_plan_json`

```json
{
  "due_at": "2026-05-28T09:15:00Z",
  "status": "scheduled",
  "recommended_template_id": "gentle_nudge",
  "last_contact_at": null,
  "days_since_last_contact": null,
  "overdue_days": 0,
  "completed_at": null
}
```

#### `sla_tracker_json`

```json
{
  "baseline_date": "2026-05-21T09:15:00Z",
  "days_elapsed": 0,
  "milestones": [
    {"days": 7, "label": "standard_window", "reached": false, "reached_at": null},
    {"days": 14, "label": "aging_alert", "reached": false, "reached_at": null},
    {"days": 21, "label": "escalation_threshold", "reached": false, "reached_at": null}
  ],
  "current_state": "within_window",
  "alert_level": "none",
  "next_recommended_action": "wait"
}
```

### Application events table changes

Extend `application_events`:

| Column | Type | Nullable | Description |
| --- | --- | --- | --- |
| `actor` | `String(32)` | Yes | `user`, `agent`, or `system`. |
| `title` | `String(255)` | Yes | Human-readable title for timeline display. |
| `metadata_json` | `Text` | Yes | Structured event payload. |
| `related_asset_id` | `Integer` | Yes | Associated proof or snapshot asset. |
| `substage` | `String(64)` | Yes | Applied substage associated with the event. |

The event table should remain append-only for Applied actions so that timeline data stays trustworthy and historically accurate. [cite:26][cite:35]

### New `applied_assets` table

```sql
CREATE TABLE applied_assets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  application_id INTEGER NOT NULL,
  asset_type VARCHAR(64) NOT NULL,
  file_path VARCHAR(1024) NOT NULL,
  mime_type VARCHAR(128) NOT NULL,
  original_filename VARCHAR(255) NOT NULL,
  file_hash VARCHAR(128) NOT NULL,
  uploaded_at VARCHAR(64) NOT NULL,
  created_by_user_id INTEGER NULL,
  FOREIGN KEY(application_id) REFERENCES applications(id)
);
```

### Suggested SQLAlchemy model sketch

```python
class AppliedAsset(Base):
    __tablename__ = "applied_assets"

    id = Column(Integer, primary_key=True)
    application_id = Column(Integer, ForeignKey("applications.id"), nullable=False, index=True)
    asset_type = Column(String(64), nullable=False)
    file_path = Column(String(1024), nullable=False)
    mime_type = Column(String(128), nullable=False)
    original_filename = Column(String(255), nullable=False)
    file_hash = Column(String(128), nullable=False)
    uploaded_at = Column(String(64), nullable=False)
    created_by_user_id = Column(Integer, nullable=True)
```

## API design

Action-oriented workflow APIs are preferred for state-changing operations because they communicate business intent more clearly than generic status mutation endpoints. [cite:27][cite:30]

### Base path

`/api/applications/{application_id}/applied`

### Authentication

- All endpoints require authenticated user context.
- The authenticated user must own the application or have admin access.

### Errors

All endpoints return standard JSON errors:

```json
{
  "error": {
    "code": "validation_error",
    "message": "due_at must be in the future",
    "details": {"field": "due_at"}
  }
}
```

### 1. Get Applied state

`GET /api/applications/{application_id}/applied`

#### Response

```json
{
  "application_id": 42,
  "pipeline_stage": "applied",
  "applied_substage": "confirmed",
  "submission_record": {...},
  "submission_snapshot": {...},
  "confirmation_record": {...},
  "follow_up_plan": {...},
  "sla_tracker": {...},
  "contacts": [...],
  "completion": {
    "percentage": 50,
    "substages": [
      {"id": "submitted", "complete": true},
      {"id": "confirmed", "complete": true},
      {"id": "follow_up_due", "complete": false},
      {"id": "follow_up_sent", "complete": false}
    ]
  }
}
```

### 2. Save submission record

`PUT /api/applications/{application_id}/applied/submission`

#### Request

```json
{
  "applied_at": "2026-05-20T13:42:00Z",
  "channel": "direct",
  "portal_type": "ats",
  "portal_name": "Greenhouse",
  "referral_status": "none",
  "submitted_by": "user",
  "notes": "Applied through careers page.",
  "friction_notes": [
    {
      "issue_type": "ux_dark_pattern",
      "description": "Forced re-entry of work history."
    }
  ],
  "snapshot": {
    "resume_asset_id": 101,
    "cover_letter_asset_id": 102,
    "portfolio_asset_id": 103,
    "submitted_version_label": "2026-05-20-primary"
  }
}
```

#### Rules

- Creates or updates `submission_record_json`.
- Creates `submission_snapshot_json` only if one does not already exist.
- Rejects attempts to overwrite a locked snapshot.
- Creates `submission_logged` and `submission_snapshot_locked` events as applicable.
- Sets or reconciles `applied_substage` to at least `submitted`.

#### Success response

```json
{
  "ok": true,
  "applied_substage": "submitted",
  "submission_record": {...},
  "submission_snapshot": {...}
}
```

### 3. Upload confirmation receipt

`POST /api/applications/{application_id}/applied/confirmation/receipt`

#### Request

Multipart form upload:

- `file`: required
- `asset_type`: optional, defaults to `receipt`

#### Rules

- Accept only PNG, JPEG, and PDF.
- Compute SHA-256 hash.
- Persist immutable asset metadata in `applied_assets`.
- Return the new asset record.

#### Success response

```json
{
  "id": 990,
  "application_id": 42,
  "asset_type": "receipt",
  "mime_type": "application/pdf",
  "original_filename": "confirmation.pdf",
  "uploaded_at": "2026-05-21T09:16:00Z",
  "file_hash": "sha256:abc123"
}
```

### 4. Save confirmation record

`PUT /api/applications/{application_id}/applied/confirmation`

#### Request

```json
{
  "confirmation_number": "APP-8829-XJ",
  "confirmed_at": "2026-05-21T09:15:00Z",
  "source_type": "ats",
  "receipt_asset_id": 990
}
```

#### Rules

- Validates that `receipt_asset_id`, if present, belongs to the same application.
- Saves `confirmation_record_json`.
- Initializes or refreshes `sla_tracker_json`.
- Emits `confirmation_saved` event.
- Recomputes substage.

#### Success response

```json
{
  "ok": true,
  "applied_substage": "confirmed",
  "confirmation_record": {...},
  "sla_tracker": {...}
}
```

### 5. Save follow-up plan

`PUT /api/applications/{application_id}/applied/follow-up-plan`

#### Request

```json
{
  "due_at": "2026-05-28T09:15:00Z",
  "recommended_template_id": "gentle_nudge",
  "last_contact_at": null
}
```

#### Rules

- Creates or updates the follow-up plan.
- For new plans, `due_at` must be present.
- If `due_at` is omitted and auto-planning is enabled, derive from confirmation date plus 7 days, otherwise submission date plus 5 days.
- Emits `follow_up_plan_saved` event.
- Recomputes substage.

#### Success response

```json
{
  "ok": true,
  "applied_substage": "confirmed",
  "follow_up_plan": {...}
}
```

### 6. Mark follow-up sent

`POST /api/applications/{application_id}/applied/follow-up/send-log`

#### Request

```json
{
  "sent_at": "2026-05-29T14:00:00Z",
  "channel": "email",
  "template_id": "gentle_nudge",
  "message_excerpt": "Following up on my application for the Senior Lead Software Architect role."
}
```

#### Rules

- Marks the follow-up plan as completed.
- Sets `completed_at` in `follow_up_plan_json`.
- Emits `follow_up_sent` event.
- Recomputes `applied_substage` to `follow_up_sent`.

#### Success response

```json
{
  "ok": true,
  "applied_substage": "follow_up_sent",
  "follow_up_plan": {...}
}
```

### 7. List follow-up templates

`GET /api/applications/{application_id}/applied/follow-up/templates`

#### Response

```json
{
  "templates": [
    {
      "id": "gentle_nudge",
      "label": "Gentle Nudge",
      "description": "Best for 3-5 days after last contact.",
      "body": "Hi Elena, I hope your week is going well..."
    },
    {
      "id": "detailed_check_in",
      "label": "Detailed Check-In",
      "description": "Best for 7+ days or after a milestone.",
      "body": "Dear Elena, following up on our previous conversation..."
    }
  ]
}
```

Templates may start as deterministic server-side drafts and later evolve into AI-personalized variants. Starting with deterministic templates keeps latency and reliability predictable. [cite:30]

### 8. Link or update contact

`PUT /api/applications/{application_id}/applied/contact`

This endpoint should reuse `application_contacts` rather than inventing a separate canonical Applied contact store.

#### Request

```json
{
  "name": "Elena Vance",
  "title": "Senior Talent Acquisition",
  "email": "elena@example.com",
  "company": "Lumon Industries",
  "linkedin_url": "https://www.linkedin.com/in/example",
  "is_hiring_manager": false,
  "source": "manual"
}
```

#### Success response

```json
{
  "ok": true,
  "contact": {
    "id": 555,
    "name": "Elena Vance",
    "title": "Senior Talent Acquisition",
    "email": "elena@example.com",
    "company": "Lumon Industries",
    "linkedin_url": "https://www.linkedin.com/in/example",
    "is_hiring_manager": false,
    "source": "manual"
  }
}
```

### 9. Get SLA status

`GET /api/applications/{application_id}/applied/sla`

#### Response

```json
{
  "baseline_date": "2026-05-21T09:15:00Z",
  "days_elapsed": 8,
  "milestones": [
    {"days": 7, "label": "standard_window", "reached": true, "reached_at": "2026-05-28T09:15:00Z"},
    {"days": 14, "label": "aging_alert", "reached": false, "reached_at": null},
    {"days": 21, "label": "escalation_threshold", "reached": false, "reached_at": null}
  ],
  "current_state": "awaiting_response",
  "alert_level": "low",
  "next_recommended_action": "prepare_follow_up"
}
```

### 10. Get activity log

`GET /api/applications/{application_id}/applied/activity-log?limit=50&offset=0`

#### Response

```json
{
  "items": [
    {
      "id": 8001,
      "event_type": "follow_up_sent",
      "actor": "user",
      "title": "Follow-up Sent",
      "substage": "follow_up_sent",
      "timestamp": "2026-05-29T14:00:00Z",
      "metadata": {
        "channel": "email",
        "template_id": "gentle_nudge"
      }
    }
  ],
  "total": 1,
  "limit": 50,
  "offset": 0
}
```

### 11. Get next-step recommendation

`GET /api/applications/{application_id}/applied/next-steps`

#### Response

```json
{
  "can_transition": false,
  "readiness_score": 67,
  "reasons_met": ["contact_exists", "follow_up_sent"],
  "blockers": ["response_window_not_met"],
  "recommended_action": "wait_for_response"
}
```

### 12. Move to Interviewing

`POST /api/applications/{application_id}/applied/transition-to-interviewing`

#### Rules

- Validates readiness rules.
- On success, updates `pipeline_stage` to `interviewing`.
- Emits `moved_to_interviewing` event.

#### Success response

```json
{
  "ok": true,
  "pipeline_stage": "interviewing"
}
```

## Pydantic contract sketch

```python
class FrictionNoteIn(BaseModel):
    issue_type: str
    description: str

class SubmissionSnapshotIn(BaseModel):
    resume_asset_id: int | None = None
    cover_letter_asset_id: int | None = None
    portfolio_asset_id: int | None = None
    submitted_version_label: str | None = None

class SubmissionRecordIn(BaseModel):
    applied_at: datetime
    channel: str
    portal_type: str | None = None
    portal_name: str | None = None
    referral_status: str | None = None
    submitted_by: str | None = None
    notes: str | None = None
    friction_notes: list[FrictionNoteIn] = []
    snapshot: SubmissionSnapshotIn | None = None

class ConfirmationRecordIn(BaseModel):
    confirmation_number: str | None = None
    confirmed_at: datetime
    source_type: str | None = None
    receipt_asset_id: int | None = None

class FollowUpPlanIn(BaseModel):
    due_at: datetime | None = None
    recommended_template_id: str | None = None
    last_contact_at: datetime | None = None

class FollowUpSentIn(BaseModel):
    sent_at: datetime
    channel: str | None = None
    template_id: str | None = None
    message_excerpt: str | None = None

class AppliedContactIn(BaseModel):
    name: str
    title: str | None = None
    email: EmailStr | None = None
    company: str | None = None
    linkedin_url: AnyUrl | None = None
    is_hiring_manager: bool = False
    source: str | None = None
```

## Service-layer behavior

### `determine_applied_substage(application)`

Pseudo-rules:

```python
def determine_applied_substage(app):
    if follow_up_sent_exists(app):
        return "follow_up_sent"
    if follow_up_due_now(app):
        return "follow_up_due"
    if confirmation_exists(app):
        return "confirmed"
    if submission_exists(app):
        return "submitted"
    return None
```

### `compute_sla_status(application)`

- Baseline date = `confirmation_record.confirmed_at` if present.
- Fallback baseline = `submission_record.applied_at` if confirmation does not exist.
- Milestones = 7, 14, and 21 days elapsed.
- Outputs a current state, alert level, and next recommendation.

### `compute_applied_completion(application)`

Suggested completion weights:

| Signal | Weight |
| --- | --- |
| Submission recorded | 25 |
| Confirmation recorded | 25 |
| Follow-up plan created | 25 |
| Follow-up sent | 25 |

This should be configurable later if product wants different semantics.

## Background jobs

Background jobs should update cached derived state and create notifications, but they should not create duplicate side effects when rerun. Idempotent background processing is important for systems that poll or recompute workflow status repeatedly. [cite:29][cite:32]

### Overdue follow-up job

Run on a schedule, for example every 10 minutes:

- Find applications in `pipeline_stage = 'applied'` with a follow-up plan whose `due_at <= now` and whose status is not `completed`.
- Recompute overdue days.
- Mark plan status as `overdue` if needed.
- Emit `follow_up_overdue` event only once per overdue boundary.
- Create a notification through the existing notification system.
- Recompute `applied_substage`.

### SLA milestone job

Run on a schedule, for example every 10 minutes:

- Recompute SLA milestone reach status.
- Update cached `sla_tracker_json`.
- Emit milestone notifications only once per threshold.

## Validation rules

- `submission_snapshot_json` cannot be overwritten after creation unless an admin override mode is introduced later.
- `receipt_asset_id` must belong to the same application.
- `due_at` must be a valid UTC timestamp.
- `follow_up_sent.sent_at` cannot be earlier than `submission_record.applied_at`.
- Unsupported MIME types must be rejected.
- `pipeline_stage` must be `applied` for all Applied-stage mutation endpoints.

## Acceptance criteria

### Backend

- Applied APIs persist and return structured state.
- Applied substage is deterministic and recomputable.
- Submission snapshots are immutable after first save.
- Confirmation proof upload works for PNG, JPEG, and PDF.
- Timeline events are queryable and append-only.
- Follow-up overdue and SLA milestones can be recomputed safely.
- Contact linkage reuses existing contact infrastructure.

### Frontend integration

- Submitted screen reads and writes submission data and snapshot state.
- Confirmed screen reads and writes confirmation details and receipt uploads.
- Follow-up Due screen reads and writes scheduling, overdue, and templates.
- Follow-up Sent screen reads activity log, completion, and next-step guidance.
- “Move to Interviewing” honors backend validation.

## Delivery plan

### Phase 1

- Add schema changes.
- Add Pydantic models.
- Add read endpoint and submission endpoint.
- Add event enrichment support.

### Phase 2

- Add receipt upload and confirmation endpoint.
- Add SLA computation endpoint.
- Add follow-up plan and send-log endpoints.

### Phase 3

- Add activity log, next-steps, and transition-to-interviewing endpoints.
- Add background jobs and notifications.
- Wire frontend to the new APIs.

## Risks and decisions

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Duplicate sources of truth for contact data | High | Keep `application_contacts` canonical. |
| JSON fields become hard to query later | Medium | Restrict JSON to application-scoped 1:1 documents. [cite:25][cite:34] |
| Naive timestamps break SLA logic | High | Normalize all new timestamps to UTC. |
| Polling jobs emit duplicate alerts | High | Make jobs idempotent and store event-based thresholds. [cite:29][cite:32] |
| Generic status mutation creates invalid workflow states | Medium | Prefer action-oriented endpoints. [cite:27][cite:30] |

## Open questions

- Should follow-up template bodies remain deterministic text for v1, with AI personalization added later?
- Should admin users be allowed to override immutable snapshots or backdate entries?
- Should overdue follow-up status be purely derived or also persisted for query efficiency?
- Should a future refactor extract Applied UI logic into dedicated frontend components before full integration?
