# Applied Stage Orchestration Plan

This is the execution plan that subordinate Claude Code agents will run against to deliver the Applied‑stage backend and app logic described in [`applied-stage-prd.md`](./applied-stage-prd.md).

It is intentionally *plan only* — no production code is changed by this document. Task 0 (a trivial constants module) is the first execution unit downstream agents will land.

---

## 1. Architecture findings

| Area | Where it lives | Notes |
|---|---|---|
| FastAPI app | `backend/main.py` (3,622 lines, single file) | All routes are top‑level `@app.<verb>(...)` decorators. There is no router/sub‑folder split. New Applied endpoints will be added as a contiguous section in this file, mirroring the existing `# ── Notification Endpoints ──` style banner used at line 3546. |
| SQLAlchemy models | `backend/services/database_service.py:11–263` | Declarative `Base`; models: `User`, `Application`, `ApplicationSubStep`, `ApplicationContact`, `ApplicationEvent`, `Notification`, `UserProfile`, `UserExperience`, `UserEducation`, `UserApiKey`, `Config`, `LinkedinConnection`. |
| Schema migrations | `backend/services/database_service.py:551–700+` in `_migrate_schema()` | Append‑only list of SQL strings (`ALTER TABLE ... ADD COLUMN ...` and `CREATE TABLE IF NOT EXISTS ...`). Each statement is wrapped to swallow "already exists" errors. New columns/tables for the Applied stage must be appended to this list. **Not Alembic.** |
| Data layer | `backend/services/database_service.py` (`DatabaseService` class) | Wraps a `sessionmaker`. CRUD helpers like `get_application_by_id`, `update_application(app_id, payload, user_id)`, `create_notification(...)` already exist. |
| Notifications | `Notification` model at `database_service.py:249` + `DatabaseService.create_notification` at line 2032. Endpoints at `main.py:3546–3565`. Shape: `category`, `title`, `message`, `link_screen`, `link_app_id`, `link_anchor`, `is_read`. | Reuse this exact shape for follow‑up‑overdue and SLA‑milestone notifications. Frontend `NotificationCenter.jsx` already reads it. |
| Events | `ApplicationEvent` model at `database_service.py:140` — currently only `event_type`, `description`, `timestamp`. | PRD requires extending with `actor`, `title`, `metadata_json`, `related_asset_id`, `substage`. Append‑only timeline semantics already implied by the model name; no in‑place edit code paths exist today. |
| Contacts | `ApplicationContact` at `database_service.py:125`. Field names diverge from the PRD: today uses `name`, `role`, `email`, `phone`, `linkedin_url`, `headline`, `company`, `how_we_know`, `photo_url`. PRD wants `title`, `is_hiring_manager`, `source`. | **Decision:** extend (add columns) rather than rename. Map `role` ↔ `title` in the response serializer; do not break existing payloads. |
| File uploads | Pattern at `main.py:657–694` (`upload-additional-doc`): `UploadFile = File(...)` → write to `UPLOADS_DIR` (env `DOCUMENTS_STORAGE_PATH` + `/uploads`, defined at `main.py:458`). No hashing today; no MIME allowlist. | Receipt upload endpoint must add SHA‑256 hashing and a strict MIME allowlist (`image/png`, `image/jpeg`, `application/pdf`). |
| Background jobs | `run_maintenance_loop()` at `main.py:113–168`, launched as a `threading.Thread(daemon=True)` at line 171. Cadence is `time.sleep(600)` (10 min). FastAPI `BackgroundTasks` is also used for one‑shot per‑request work. **APScheduler is not installed.** | New "overdue follow‑up" and "SLA milestone" jobs must be added as additional periodic checks inside this maintenance loop (or as siblings of the same pattern). No new dependency is required. |
| Pydantic schemas | Co‑located in `main.py` (e.g., `ApplicationSaveRequest`, `substage_progress: Optional[Any] = None` at line 396). No separate `schemas/` module. | New Applied input models can live in `main.py` for consistency, **or** a new `backend/schemas/applied.py` if we want to avoid further bloat. Plan opts for a new module — see Task 2. |
| Substage state today | `applications.substage_progress` JSON column (added at `database_service.py:620`). UI in `frontend/src/pages/ApplicationLifecycle.jsx` reads/writes it as `{ submitted: bool, confirmed: bool, follow_up_due: bool, follow_up_sent: bool }`. Substages array defined at `ApplicationLifecycle.jsx:150–153`. | The flag is *user‑toggled* today, not data‑derived. The PRD upgrade keeps this column (as a write‑through cache for reads) but the **canonical** substage becomes derivable from the new JSON document columns. We must not break the existing toggle UX immediately — Task 9 reconciles. |
| Frontend API client | No central client. Components call `fetchWithAuth(\`${API_URL}/api/...\`)`. `API_URL` is read from `.env`. | New Applied endpoints under `/api/applications/{id}/applied/...` will be consumed via the same `fetchWithAuth` pattern. No new infra needed. |
| Existing `applied_substage` column | **Does not exist** anywhere in the codebase (grep confirms). | Will be added in Task 1. |
| Existing `applied_assets` table | **Does not exist.** | Will be added in Task 1. |

### Conventions to preserve
- All new SQL goes through `_migrate_schema()`'s append‑only list, never as a separate migration file.
- All new long‑running periodic work plugs into the existing daemon thread; do not introduce APScheduler unless we later need cron‑style scheduling.
- All new endpoints take `user_id: int = Depends(get_current_user_id)` and validate ownership inside the handler (see `main.py:1968` for the canonical pattern).
- JSON payloads on `Application` are stored as `Text` columns and accessed via the `safeParseJSON` helper on the frontend; the backend stores them as `json.dumps(...)` strings (see how `match_details` / `substage_progress` are handled today).
- Action‑oriented routes: PRD `POST .../follow-up/send-log` and `POST .../transition-to-interviewing` follow this; we do not add generic `PATCH .../field` writers for these workflow transitions.

---

## 2. Recommended data‑model additions

All additions go into `backend/services/database_service.py`:

### 2.1 New columns on `applications`
Append SQL strings to `_migrate_schema()` and add `Column(...)` declarations to the `Application` model:

| Column | Type | Default | Source of truth for |
|---|---|---|---|
| `applied_substage` | `String(64)` | `NULL` | Cached current Applied substage. |
| `submission_record_json` | `Text` | `NULL` | Submitted record document. |
| `submission_snapshot_json` | `Text` | `NULL` | Immutable snapshot. |
| `confirmation_record_json` | `Text` | `NULL` | Confirmation document. |
| `follow_up_plan_json` | `Text` | `NULL` | Follow‑up plan document. |
| `sla_tracker_json` | `Text` | `NULL` | Cached SLA milestones. |

### 2.2 New columns on `application_events`
Extend the existing `ApplicationEvent` model to support the timeline‑event shape the PRD requires:

| Column | Type | Default |
|---|---|---|
| `actor` | `String(32)` | `NULL` |
| `title` | `String(255)` | `NULL` |
| `metadata_json` | `Text` | `NULL` |
| `related_asset_id` | `Integer` | `NULL` |
| `substage` | `String(64)` | `NULL` |

Keep the existing `event_type`, `description`, `timestamp` for backward compatibility.

### 2.3 New columns on `application_contacts`
| Column | Type | Notes |
|---|---|---|
| `title` | `String` | New canonical field; UI may continue to read `role` for legacy. |
| `is_hiring_manager` | `Boolean` | Default `False`. |
| `source` | `String` | E.g. `manual`, `linkedin`. |

### 2.4 New table `applied_assets`
```sql
CREATE TABLE IF NOT EXISTS applied_assets (
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
Mirror in `database_service.py` as an `AppliedAsset(Base)` declarative model.

### 2.5 Event‑type constants
A new module `backend/services/applied_constants.py` (to be created in Task 0) will hold the canonical event‑type strings, substage IDs, MIME allowlist, and SLA milestones.

---

## 3. Service / API changes

### 3.1 New service module
`backend/services/applied_service.py` — pure functions, no FastAPI imports. Exports:

- `determine_applied_substage(app_row) -> str | None`
- `compute_sla_status(app_row) -> dict`
- `compute_applied_completion(app_row) -> dict`
- `is_eligible_for_interviewing(app_row) -> dict`  (returns `{can_transition, readiness_score, reasons_met, blockers, recommended_action}`)
- `emit_event(session, application_id, *, event_type, actor="user", title=None, substage=None, metadata=None, related_asset_id=None) -> None`
- `recompute_and_persist_substage(session, application_id) -> str | None`  (writes `applied_substage` cache + emits implicit substage‑transition event if changed)

The pure‑function shape keeps it testable without an HTTP layer.

### 3.2 New endpoints
All under `/api/applications/{application_id}/applied/...`. All require `get_current_user_id`. All validate `pipeline_stage == 'applied'` (with one allowed exception: `transition-to-interviewing` is the action that moves it *out* of applied; and `GET` endpoints permit any stage so the UI can render history).

| # | Method + Path | Implements PRD § |
|---|---|---|
| E1 | `GET /api/applications/{id}/applied` | §API 1: Get Applied state |
| E2 | `PUT /api/applications/{id}/applied/submission` | §API 2: Save submission record |
| E3 | `POST /api/applications/{id}/applied/confirmation/receipt` | §API 3: Upload confirmation receipt |
| E4 | `PUT /api/applications/{id}/applied/confirmation` | §API 4: Save confirmation record |
| E5 | `PUT /api/applications/{id}/applied/follow-up-plan` | §API 5: Save follow‑up plan |
| E6 | `POST /api/applications/{id}/applied/follow-up/send-log` | §API 6: Mark follow‑up sent |
| E7 | `GET /api/applications/{id}/applied/follow-up/templates` | §API 7: List follow‑up templates |
| E8 | `PUT /api/applications/{id}/applied/contact` | §API 8: Link / update contact |
| E9 | `GET /api/applications/{id}/applied/sla` | §API 9: SLA status |
| E10 | `GET /api/applications/{id}/applied/activity-log` | §API 10: Activity log (paginated) |
| E11 | `GET /api/applications/{id}/applied/next-steps` | §API 11: Next‑step recommendation |
| E12 | `POST /api/applications/{id}/applied/transition-to-interviewing` | §API 12: Move to Interviewing |

### 3.3 Pydantic models
`backend/schemas/applied.py` will hold every request/response model from PRD §"Pydantic contract sketch" — `FrictionNoteIn`, `SubmissionSnapshotIn`, `SubmissionRecordIn`, `ConfirmationRecordIn`, `FollowUpPlanIn`, `FollowUpSentIn`, `AppliedContactIn` — plus output models for `GET .../applied` and `GET .../activity-log`.

### 3.4 Follow‑up templates
Templates start as a **deterministic in‑code dict** in `backend/services/applied_service.py` (`FOLLOW_UP_TEMPLATES`). v1 is two templates: `gentle_nudge` and `detailed_check_in` (bodies copied from PRD §API 7). No DB persistence; a future task can promote them to a table.

---

## 4. Background jobs / automation

### 4.1 Overdue follow‑up job
- Lives in `backend/main.py`, sibling to `run_maintenance_loop`, named `run_applied_follow_up_loop`.
- Daemon thread, `time.sleep(600)` cadence (matches existing maintenance loop).
- For each `Application` with `pipeline_stage='applied'` and `follow_up_plan_json.due_at <= now()` whose plan status is not `completed`:
  - Recompute `overdue_days`, update `follow_up_plan_json`.
  - Set plan `status='overdue'` if first crossing.
  - Emit `follow_up_overdue` event **only once per overdue threshold day** — check the events table to avoid duplicates.
  - Create a notification with `link_screen='lifecycle'`, `link_app_id=<id>`, `link_anchor='follow_up_due'`, `category='warning'`.
  - Recompute and persist `applied_substage`.

### 4.2 SLA milestone job
- Same loop (one thread, two concerns, kept lightweight).
- For each `Application` in `applied` with a baseline date (confirmed_at, falling back to applied_at), recompute `sla_tracker_json`.
- Milestone thresholds default to `[7, 14, 21]` days — taken from `applied_constants.py`.
- When a milestone is newly reached: set its `reached_at`, emit a notification once (idempotency: store `reached_at` in the cache, do not re‑notify if it's already non‑null).

### 4.3 Idempotency rules (cross‑cutting)
- Always read‑then‑write inside the same session and rely on `follow_up_plan_json.completed_at` / milestone `reached_at` as natural idempotency markers.
- No new `Notification` row if the same `(user_id, link_app_id, title)` exists in the last 24 h (helper to add in Task 7).

---

## 5. Ordered task list (smallest safe units)

> Each task is sized so that a single Claude Code agent can land it end‑to‑end with tests in one PR.
> Tasks are **strictly ordered**; dependencies are explicit.
> Tasks marked **[P]** can be parallelized once their declared dependencies have landed.

### Task 0 — Add Applied constants module
- **Objective:** Centralize event‑type strings, substage IDs, MIME allowlist, SLA thresholds so subsequent tasks reference one source.
- **Files:** `backend/services/applied_constants.py` (new).
- **Dependencies:** none.
- **Acceptance criteria:**
  - Module exports: `APPLIED_SUBSTAGES` tuple, `EVENT_TYPES` (enum or dict), `RECEIPT_MIME_ALLOWLIST`, `SLA_MILESTONES_DAYS`, `FOLLOW_UP_TEMPLATES` *(IDs only — bodies in Task 5b)*.
  - Importing this module has no side effects.
- **Risks:** none — pure constants.

### Task 1 — Schema additions (columns + `applied_assets` table)
- **Objective:** Land all new columns and the new table via `_migrate_schema()` and add SQLAlchemy `Column` declarations / new `AppliedAsset` model.
- **Files:** `backend/services/database_service.py`.
- **Dependencies:** Task 0.
- **Acceptance criteria:**
  - Running the app against an existing populated `applications.db` does not error and adds the new columns/table.
  - `Base.metadata.create_all()` and `_migrate_schema()` are both idempotent.
  - `SELECT applied_substage, submission_record_json, ... FROM applications LIMIT 1;` returns `NULL` for legacy rows.
- **Risks:**
  - Forgetting to wrap `ALTER TABLE` calls in the existing try/except idiom → migration crash on already‑migrated dbs. Mitigation: copy the pattern used at line 551+ exactly.
  - SQLite type affinity: `Boolean` columns work but compare as `0/1`. Use `Boolean(create_constraint=False)` to match existing code.

### Task 2 — Applied Pydantic schemas
- **Objective:** Add request/response models in a new `backend/schemas/applied.py`.
- **Files:** `backend/schemas/__init__.py` (new, empty), `backend/schemas/applied.py` (new).
- **Dependencies:** Task 0.
- **Acceptance criteria:**
  - All seven input models from PRD §"Pydantic contract sketch" exist and import cleanly.
  - Output models: `AppliedStateOut`, `ActivityLogPage`, `SlaStatusOut`, `NextStepsOut`, `ContactOut`, `AppliedAssetOut`.
  - Pytest happy path: build each model with example data from the PRD JSON snippets.
- **Risks:** Datetime parsing — keep everything `datetime`, never naive; reject naive datetimes via a validator (PRD non‑functional requirement: UTC ISO‑8601).

### Task 3 — Applied service module (pure logic) [P after T0, T1]
- **Objective:** Implement the six pure functions from §3.1.
- **Files:** `backend/services/applied_service.py` (new).
- **Dependencies:** Task 0, Task 1.
- **Acceptance criteria:**
  - `determine_applied_substage` returns the PRD priority order: `follow_up_sent > follow_up_due > confirmed > submitted > None`.
  - `compute_sla_status` baseline = `confirmation.confirmed_at` if present, else `submission.applied_at`; milestones from `applied_constants.SLA_MILESTONES_DAYS`.
  - `compute_applied_completion` uses 25/25/25/25 weights.
  - `is_eligible_for_interviewing` blocks when no follow‑up sent OR no contact OR elapsed window < 7 days.
  - `emit_event` always sets `timestamp=datetime.utcnow().isoformat()`, `actor` defaults `"user"`, and writes the row through the supplied `session`.
  - 100 % unit test coverage on the four "compute" functions.
- **Risks:**
  - Subtle priority‑order bug if you check `confirmed` before `follow_up_due` — write the test for the PRD priority table first (TDD).

### Task 4 — Endpoint E1: `GET /api/applications/{id}/applied`
- **Objective:** Read endpoint that returns the full Applied state object.
- **Files:** `backend/main.py` (add endpoint section banner `# ── Applied Stage Endpoints ──` and the route).
- **Dependencies:** Tasks 2, 3.
- **Acceptance criteria:**
  - Returns the PRD §API 1 response shape, including `completion`, `contacts`, and a fresh `applied_substage` (calls `recompute_and_persist_substage` before responding).
  - 404 on missing application; 403 on wrong user.
  - Pytest: build a fixture application in each substage and assert the response shape.
- **Risks:**
  - Performance regression if every GET writes through `applied_substage`. Mitigation: only persist when value changes.

### Task 5a — Endpoint E2: submission `PUT`
- **Objective:** Persist `submission_record_json` and write a **one‑time** snapshot.
- **Files:** `backend/main.py`.
- **Dependencies:** Task 4.
- **Acceptance criteria:**
  - First call writes `submission_record_json` and `submission_snapshot_json`; emits `submission_logged` and `submission_snapshot_locked`.
  - Subsequent calls update the record but reject overwriting the snapshot with HTTP 409 ("snapshot_locked").
  - Recomputes substage to at least `submitted`.
- **Risks:**
  - Race condition on first‑write: use the existing single‑session `update_application` pattern; do not split into two transactions.

### Task 5b — Endpoint E7: follow‑up templates `GET`
- **Objective:** Return the in‑code template dict.
- **Files:** `backend/main.py`, `backend/services/applied_service.py` (add bodies to `FOLLOW_UP_TEMPLATES`).
- **Dependencies:** Task 3.
- **Acceptance criteria:** returns `{"templates":[...]}` with exactly two entries: `gentle_nudge` and `detailed_check_in`, matching PRD bodies verbatim.
- **Risks:** none.

### Task 6 — Endpoints E3, E4: receipt upload + confirmation record
- **Objective:** Implement `POST .../confirmation/receipt` (multipart upload with SHA‑256 + MIME allowlist) and `PUT .../confirmation`.
- **Files:** `backend/main.py`, `backend/services/applied_service.py` (add `save_applied_asset`).
- **Dependencies:** Task 4, Task 5a.
- **Acceptance criteria:**
  - Rejects unsupported MIME types with HTTP 415.
  - Stores file under `UPLOADS_DIR/applied/{application_id}/{sha256[:16]}.{ext}`.
  - Returns the `AppliedAsset` row.
  - `PUT .../confirmation` validates `receipt_asset_id` belongs to the same application; emits `confirmation_saved`; initializes `sla_tracker_json`; recomputes substage.
- **Risks:**
  - Path traversal via `original_filename`. Mitigation: never use the original filename for storage path; only keep it as metadata.
  - Large uploads — set `File(...)` size limit; PRD does not specify but use 10 MB default.

### Task 7 — Endpoints E5, E6: follow‑up plan save + send‑log
- **Objective:** Implement `PUT .../follow-up-plan` and `POST .../follow-up/send-log`. Add the dedup notification helper.
- **Files:** `backend/main.py`, `backend/services/applied_service.py`, `backend/services/database_service.py` (add `find_recent_notification(user_id, link_app_id, title, within_hours)`).
- **Dependencies:** Task 4.
- **Acceptance criteria:**
  - Plan creation requires `due_at`; if omitted and `enable_auto_planning=True` in the request payload, derive `due_at = confirmed_at + 7d` (fallback `applied_at + 5d`).
  - Send‑log marks plan `completed`, sets `completed_at`, emits `follow_up_sent`, recomputes substage to `follow_up_sent`.
  - `sent_at` must be ≥ `submission.applied_at`; reject with HTTP 422 otherwise.
- **Risks:**
  - The PRD success response for `PUT .../follow-up-plan` shows `"applied_substage":"confirmed"` even after saving a plan — i.e. saving a plan does *not* automatically advance the substage to `follow_up_due`; only the due‑date crossing or the overdue job does. Codify this in the service function tests.

### Task 8 — Endpoint E8: contact link / update
- **Objective:** Reuse `application_contacts` rather than inventing a parallel store.
- **Files:** `backend/main.py`, `backend/services/database_service.py` (extend existing contact CRUD; serializer maps `role` ↔ `title`).
- **Dependencies:** Task 1 (for `is_hiring_manager`, `source`, `title` columns).
- **Acceptance criteria:**
  - PUT acts as upsert (one Applied contact per application; multi‑contact remains supported for other use cases).
  - Emits `contact_linked` event.
  - Existing `POST /api/applications/{id}/contacts` endpoint (`main.py:3215`) continues to work unchanged.
- **Risks:**
  - The "primary Applied contact" is not currently identified in `application_contacts`. Decision: do **not** add an `is_primary` column; the Applied endpoint operates on the most‑recently‑updated contact. Flag this as an open question (see §6).

### Task 9 — Endpoint E9: SLA + Endpoint E10: activity log
- **Objective:** Read endpoints; SLA recomputes on read but only persists if changed; activity log paginates.
- **Files:** `backend/main.py`.
- **Dependencies:** Task 3, Task 6.
- **Acceptance criteria:**
  - SLA matches PRD §API 9 shape verbatim.
  - Activity log honors `limit` (default 50, max 200) and `offset`; returns events ordered by `timestamp DESC`.
- **Risks:**
  - Large event tables → slow scans. Add an index on `application_events(application_id, timestamp DESC)` inside Task 1's migration list.

### Task 10 — Endpoint E11: next‑steps + E12: transition‑to‑interviewing
- **Objective:** Surface readiness rules and the gated stage transition.
- **Files:** `backend/main.py`, `backend/services/applied_service.py`.
- **Dependencies:** Task 7, Task 8, Task 9.
- **Acceptance criteria:**
  - `transition-to-interviewing` calls `is_eligible_for_interviewing` and 409s on blocker.
  - On success: sets `pipeline_stage='interviewing'`, emits `moved_to_interviewing`, returns the new stage.
  - Frontend "Move to Interviewing" CTA hits this endpoint (frontend change is part of Task 13).
- **Risks:** none new.

### Task 11 — Background job: overdue follow‑up + SLA milestone
- **Objective:** Add `run_applied_follow_up_loop` daemon thread alongside `run_maintenance_loop`.
- **Files:** `backend/main.py`.
- **Dependencies:** Tasks 7, 9.
- **Acceptance criteria:**
  - One thread covers both concerns (overdue + SLA milestones) on a 10‑minute cadence.
  - Idempotent: re‑running the loop with no new state changes creates zero events and zero notifications.
  - Errors are caught and logged; the loop never dies.
- **Risks:**
  - Long‑running session leak: each loop iteration must open and close its own SQLAlchemy session. Mirror the maintenance loop's pattern exactly.

### Task 12 — Event‑emission instrumentation pass [P after T11]
- **Objective:** Audit every Applied endpoint and confirm the exact PRD event set is emitted exactly once per business action: `submission_logged`, `submission_snapshot_locked`, `submission_friction_logged`, `confirmation_saved`, `receipt_uploaded`, `follow_up_plan_saved`, `follow_up_overdue`, `follow_up_sent`, `contact_linked`, `moved_to_interviewing`, `application_archived`.
- **Files:** integration test under `backend/test_applied_events.py` (new); fix any missed call sites in `main.py`.
- **Dependencies:** Tasks 5a–11.
- **Acceptance criteria:** the test exercises every endpoint and asserts the event table reflects exactly the expected event sequence.
- **Risks:** flaky if events include wall‑clock timestamps in assertions — assert only event_type and substage, not timestamp equality.

### Task 13 — Frontend wiring (Applied screens → new API) [P after T4 lands]
- **Objective:** Replace the local‑only `substage_progress` toggles in `frontend/src/pages/ApplicationLifecycle.jsx` with calls to the new endpoints. Keep the existing visual layout.
- **Files:** `frontend/src/pages/ApplicationLifecycle.jsx`, `frontend/src/components/PipelineProgressBar.jsx` (read `applied_substage` from `GET .../applied`).
- **Dependencies:** Task 4 (E1) for reads; later Applied PUTs become available task‑by‑task.
- **Acceptance criteria:**
  - The Applied UI hydrates from `GET /api/applications/{id}/applied`.
  - "Mark submitted/confirmed/follow‑up‑due/follow‑up‑sent" buttons now call the appropriate action endpoint instead of writing to `substage_progress`.
  - `substage_progress` continues to be written **only** as a UI cache, derived from the server response — no divergent local source of truth.
- **Risks:**
  - `ApplicationLifecycle.jsx` is 460 KB; the agent must locate and modify only the Applied‑stage section (the substages array near line 150 and the click handlers near lines 3082+). Do not refactor the whole file.

### Task 14 — Docs & PR checklist
- **Objective:** Update `documentation/applied-stage-prd.md` with a "Status" footer linking implemented endpoints, and add an `AGENTS.md` note about the new event/job conventions.
- **Files:** `documentation/applied-stage-prd.md`, `AGENTS.md`.
- **Dependencies:** Tasks 4–12.

### Dependency graph (compact)

```
T0
└─ T1 ──┬─ T3 ──┬─ T4 ──┬─ T5a ──┬─ T6 ──┬─ T9 ──┐
        │       │       │        │       │       │
        │       │       │        └─ T7 ──┴─ T10 ─┤
        │       │       │                        │
        │       │       └─ T5b                   │
        │       │                                │
        │       └─ T8 ─────────────────────── T11 ─ T12 ─ T14
        │
        └─ T2 ─ T3 (see above)

T13 starts in parallel as soon as T4 lands.
```

---

## 6. Open questions / ambiguities to confirm with product

1. **Follow‑up template bodies** — PRD §Open Questions asks whether v1 stays deterministic. The plan assumes **yes, deterministic** (in‑code dict). Confirm before Task 5b.
2. **"Primary Applied contact" identity** — `application_contacts` allows multiple per application; the PRD's `PUT .../applied/contact` implies one. Two options:
   a. operate on the most‑recently‑updated contact (current plan, no schema change), or
   b. add `is_primary BOOLEAN` to `application_contacts` and require exactly one.
   Pick before Task 8.
3. **Admin override of immutable snapshot** — PRD §Open Questions explicitly defers this. The plan assumes **out of scope**; HTTP 409 on overwrite. Confirm.
4. **Overdue status: derived or persisted?** — Plan persists it in `follow_up_plan_json.status` because the overdue job already mutates that JSON for `overdue_days`. Confirm this is acceptable.
5. **Notification delivery** — only in‑app notifications via the existing system. The PRD §Out of scope already excludes outbound email; calling this out so no agent surprises us by wiring SMTP.
6. **`enable_auto_planning` flag location** — PRD says "if auto‑planning is enabled" without specifying where the toggle lives. Plan currently expects it as a per‑request boolean on `PUT .../follow-up-plan`. Confirm vs. user preference.
7. **`pipeline_stage` enforcement** — PRD requires `pipeline_stage='applied'` for Applied mutation endpoints. Today the column has no enum; values are free strings (line 81 default `'saved'`). Plan rejects mismatches with HTTP 409. Confirm there is no legacy data that uses different casing (e.g. `'Applied'`).
8. **Frontend test surface** — no Jest/Vitest config was found in the quick survey. Task 13 ships untested on the frontend unless we also stand up a test runner. Out of scope for this plan?

---

## 7. Out of scope for this plan (explicit)

- Outbound email delivery of follow‑ups.
- ATS/CRM sync.
- AI personalization of follow‑up templates.
- Analytics dashboards beyond Applied screens.
- Migrating the existing single‑file `main.py` to a router‑per‑module layout.
- Replacing the threading‑based scheduler with APScheduler.
- Cross‑stage workflow redesign outside Applied (e.g. Interviewing data model).
