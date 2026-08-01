---
name: Applied Stage Orchestration Plan
description: Multi-agent execution plan to back the Applied stage UI (submitted, confirmed, follow_up_due, follow_up_sent) with real persistence, action-oriented APIs, background jobs, and frontend wiring.
type: plan
trackerId: pln_mpfhya1wh5ybmc
status: complete
priority: medium
startDate: 2026-05-21
updated: 2026-07-26
progress: 100
prd: documentation/applied-stage-prd.md
---

# Applied Stage Orchestration Plan

> **COMPLETE — historical record. Do not dispatch from this document.**
>
> All decisions (D1–D7) and all tasks (T1–T19f) shipped, `b92938d` through `246d3fe`. The checklist below has been reconciled against `git log`.
>
> ⚠️ **Superseded gating instructions.** This plan was written under the earlier evidence-gated product framing. Its per-task "do not" guidance — notably *"bypass readiness checks"* (§13 T3h) and *"allow transition when `next-steps.can_transition` is false"* (§13 T13b) — described a **hard** gate. That gate is now **advisory by default** and enforced only when the user opts into guided mode. Read those lines as history, not as live requirements.
>
> **Governing doc:** [`documentation/product-direction.md`](../../documentation/product-direction.md). See also [`documentation/workflow-substage-catalog.md`](../../documentation/workflow-substage-catalog.md).

This is the orchestration plan that downstream coding agents executed. It maps the [Applied Stage PRD](../../documentation/applied-stage-prd.md) onto the JobKernel repo as it actually exists today, with task boundaries chosen to minimize file collisions between parallel agents.

> **§13 is the only execution source.**
>
> The canonical task graph, parallelization groups, confirmed decisions, and per-task execution notes live in **§13 Multi-agent execution normalization**. The **Implementation Progress** checklist below mirrors §13. Per-task agent briefs are in `nimbalyst-local/plans/applied-stage-tasks/`.
>
> §1–§6 and §10–§12 are narrative/reference (architecture findings, gap analysis, data model, rollout strategy, key file pointers). They document *understanding* of the codebase, not execution. Downstream agents should not dispatch from them. §7–§9 (v1 ordered list, v1 dep graph, open questions) have been removed; §13 supersedes them.

## Implementation Progress

Phase 0 — Decisions (blocking; see §13.3)
- [x] D1: Contact field naming (`role` vs `title`)
- [x] D2: Follow-up template content for v1
- [x] D3: Submission snapshot override policy for v1
- [x] D4: Overdue persistence (derived only vs cached on row)
- [x] D5: `applied_substage` cache write strategy (explicit recompute vs trigger)
- [x] D6: SLA endpoint behavior when no baseline exists
- [x] D7: Frontend transition-gate UX when `can_transition: false`

Phase A — Foundations
- [x] T1: Schema + SQLAlchemy model deltas (single-writer: `database_service.py`) — merged b92938d
- [x] T2: Pydantic models module (`backend/models/applied_models.py`)
- [x] T3.0: Service-package skeleton + region anchors (`backend/services/applied/`)
- [x] T3a: Derivations (pure functions) — `applied/derivations.py`
- [x] T3b: State assembly — `applied/state.py`
- [x] T3c: Submission service — `applied/submission.py`
- [x] T3d: Confirmation + receipt service — `applied/confirmation.py`
- [x] T3e: Follow-up plan + send-log service — `applied/follow_up.py`
- [x] T3f: Follow-up templates — `applied/templates.py`
- [x] T3g: Contact upsert — `applied/contact.py`
- [x] T3h: Transition-to-interviewing — `applied/transition.py`
- [x] T4.0: Router-package skeleton + `include_router` in `main.py` (`backend/routes/applied/`)

Phase B — Endpoints (one file per task)
- [x] T5: GET `/applied` — `routes/applied/state.py`
- [x] T6: PUT `/submission` — `routes/applied/submission.py`
- [x] T7a: POST `/confirmation/receipt` — `routes/applied/receipt.py`
- [x] T7b: PUT `/confirmation` — `routes/applied/confirmation.py`
- [x] T8: GET `/sla` — `routes/applied/sla.py`
- [x] T9a: PUT `/follow-up-plan` — `routes/applied/follow_up_plan.py`
- [x] T9b: POST `/follow-up/send-log` — `routes/applied/follow_up_sent.py`
- [x] T10: GET `/follow-up/templates` — `routes/applied/templates.py`
- [x] T11: PUT `/contact` — `routes/applied/contact.py`
- [x] T12: GET `/activity-log` — `routes/applied/activity_log.py`
- [x] T13a: GET `/next-steps` — `routes/applied/next_steps.py`
- [x] T13b: POST `/transition-to-interviewing` — `routes/applied/transition.py`

Phase C — Automation
- [x] T14: Sweeper job module (`backend/jobs/applied_jobs.py`) + 2-line start in `main.py`

Phase D — Frontend
- [x] T15.0: Refactor — extract substage panels into 4 sibling files (`components/Applied/*Tab.jsx`)
- [x] T15: Wire SubmittedTab to backend
- [x] T16: Wire ConfirmedTab to backend
- [x] T17: Wire FollowUpDueTab to backend
- [x] T18: Wire FollowUpSentTab + transition gate to backend

Phase E — Verification (split per concern; each in its own file)
- [x] T19a: Derivations test (`tests/applied/test_derivations.py`)
- [x] T19b: SLA computation test (`tests/applied/test_sla.py`)
- [x] T19c: Snapshot lock immutability test (`tests/applied/test_snapshot_lock.py`)
- [x] T19d: MIME allow-list test (`tests/applied/test_receipt_mime.py`)
- [x] T19e: Overdue + SLA idempotency test (`tests/applied/test_sweeper_idempotency.py`)
- [x] T19f: Next-steps readiness test (`tests/applied/test_next_steps.py`)

---

## 1. Architecture findings

| Concern | Where | Notes |
|---|---|---|
| Framework | FastAPI, no routers | All endpoints declared `@app.<verb>(...)` inline in `backend/main.py` (~3622 LOC, single file). `APIRouter` is not used today. |
| ORM | SQLAlchemy + SQLite | Engine via `create_engine(os.getenv("DATABASE_URL", "sqlite:///applications.db"))` at `backend/services/database_service.py:277`. Models in same file: `User`, `Application`, `ApplicationSubStep`, `ApplicationContact`, `ApplicationEvent`, `Notification`, etc. |
| Auth | `Depends(get_current_user_id)` | Every protected route uses `user_id: int = Depends(get_current_user_id)`. Admin uses `get_admin_user_id`. |
| Migrations | Append-only `_migrate_schema()` | `database_service.py:551` — a list of raw `ALTER TABLE` / `CREATE TABLE IF NOT EXISTS` strings executed individually inside `try/except`. New columns are appended to the bottom. **No Alembic.** SQLite limitation: can't drop/rename columns inline. |
| Event log | `application_events` exists | Columns today: `id, application_id, event_type, description, timestamp`. Helper: `DatabaseService._log_event(app_id, event_type, description, session=None)` at `database_service.py:2006`. Called from stage-change paths. |
| Contacts | `application_contacts` exists | Columns: `name, role, email, phone, linkedin_url, headline, company, how_we_know, photo_url`. Endpoints already exist at `main.py:3215–3247` (`POST /api/applications/{app_id}/contacts`, PUT, DELETE). |
| Notifications | Full system | Model at `database_service.py:249`, helper `create_notification(user_id, title, message, category, link_screen, link_app_id, link_anchor)` at `database_service.py:2032`. Endpoints `/api/notifications*` at `main.py:3547–3560`. Frontend: `frontend/src/components/NotificationCenter.jsx` and `NotificationToast.jsx`. |
| Uploads | `UploadFile = File(...)` → disk | Pattern: `UPLOADS_DIR = os.environ.get("DOCUMENTS_STORAGE_PATH", ".") + "/uploads"` at `main.py:458`. Files saved with `int(time.time())_<filename>` prefix under a bucket subdir (e.g. `uploads/app_docs/`, `uploads/profile_resumes/`). **No hashing today**, no dedicated asset table. Example: `upload_app_additional_doc` at `main.py:657`. |
| Scheduler | `threading.Thread(daemon=True)` | `run_maintenance_loop` thread started at `main.py:171` with `time.sleep(600)` cadence. No APScheduler, no Celery. |
| API client | `fetchWithAuth(${API_URL}/api/...)` | Sourced from `useAuth` context. Used everywhere in the frontend including the existing `substage_progress` PUT at `ApplicationLifecycle.jsx:3116`. |
| Applied UI today | Mock content + 1 JSON flag | `frontend/src/pages/ApplicationLifecycle.jsx:3080` (`AppliedSubStagePanel`). The only persisted data is `substage_progress` (a JSON dict on `applications.substage_progress`) toggled via the generic `PUT /api/applications/{id}`. Most visible content (resume filenames, contact, SLA dates, templates, activity log entries) is hardcoded strings. `handleMoveToInterviewing` at `:3138` calls `onStageChange('interviewing')`. |

## 2. Gaps vs PRD

Task IDs reference §13.6. See §13.2 for the dispatch graph.

| PRD requirement | Repo today | Owning task(s) |
|---|---|---|
| `applications.applied_substage` cache column | Not present | T1 |
| `applications.submission_record_json` / `submission_snapshot_json` / `confirmation_record_json` / `follow_up_plan_json` / `sla_tracker_json` | Not present (`substage_progress` Text JSON exists but is different — boolean flags) | T1 |
| `application_events.actor / title / metadata_json / related_asset_id / substage` | Only `event_type, description, timestamp` | T1 |
| `applied_assets` table | Not present | T1 |
| API exposes contact field as `title` (PRD) over DB column `role` | `role` exists; alias decision in §13.3 D1 | T1 (adds `is_hiring_manager`, `source`), T2 (Pydantic alias), T11 (endpoint) |
| Submission / confirmation / follow-up APIs | Not present | T5, T6, T7a, T7b, T8, T9a, T9b, T10, T11, T12, T13a, T13b |
| File hashing (SHA-256) on uploads | Not present | T3d (service), T7a (endpoint) |
| Idempotent overdue-follow-up + SLA milestone job | Not present | T14 |
| Follow-up templates endpoint | Not present | T3f (service), T10 (endpoint) |
| Action-oriented `transition-to-interviewing` endpoint | Frontend uses generic `PUT /api/applications/{id}` to set `pipeline_stage` | T3h (service), T13b (endpoint), T18 (frontend swap) |
| Activity-log read endpoint | `_log_event` writes but no read endpoint | T12 |

## 3. Source-of-truth matrix

| Concern | Canonical owner |
|---|---|
| Pipeline stage | `applications.pipeline_stage` (existing) |
| Applied substage cache | `applications.applied_substage` (new, written by T1; refreshed by T3a `recompute_substage_cache` per D5) |
| Submission details | `applications.submission_record_json` (new, T1) |
| Submission snapshot | `applications.submission_snapshot_json` (new, immutable after first save) |
| Confirmation details | `applications.confirmation_record_json` (new) |
| Follow-up plan | `applications.follow_up_plan_json` (new) |
| SLA cache | `applications.sla_tracker_json` (new, recomputable) |
| Contacts | `application_contacts` (extended; **not** duplicated into JSON) |
| Activity timeline | `application_events` (extended) |
| Receipt / proof artifacts | `applied_assets` (new) |
| Reminders to user | `notifications` (existing system, reused) |

**Discouraged duplication:** do not write Applied contact data back into any of the new JSON blobs. The frontend should fetch contacts from `GET /applied` (assembled server-side from `application_contacts`).

## 4. Recommended data model changes

All changes go into the existing `_migrate_schema()` migration list at `backend/services/database_service.py:551`. **Append to the end of the list**; do not edit earlier entries. SQLAlchemy model classes in the same file must also be updated so reads pick up the new columns.

### Append these to the migrations list (owned by T1)

```sql
ALTER TABLE applications ADD COLUMN applied_substage TEXT;
ALTER TABLE applications ADD COLUMN submission_record_json TEXT;
ALTER TABLE applications ADD COLUMN submission_snapshot_json TEXT;
ALTER TABLE applications ADD COLUMN confirmation_record_json TEXT;
ALTER TABLE applications ADD COLUMN follow_up_plan_json TEXT;
ALTER TABLE applications ADD COLUMN sla_tracker_json TEXT;

ALTER TABLE application_events ADD COLUMN actor TEXT;
ALTER TABLE application_events ADD COLUMN title TEXT;
ALTER TABLE application_events ADD COLUMN metadata_json TEXT;
ALTER TABLE application_events ADD COLUMN related_asset_id INTEGER;
ALTER TABLE application_events ADD COLUMN substage TEXT;

ALTER TABLE application_contacts ADD COLUMN is_hiring_manager INTEGER DEFAULT 0;
ALTER TABLE application_contacts ADD COLUMN source TEXT;
-- Reuse existing `role` column for the PRD's `title` field. See §13.3 D1.

CREATE TABLE IF NOT EXISTS applied_assets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  application_id INTEGER NOT NULL,
  asset_type TEXT NOT NULL,
  file_path TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  file_hash TEXT NOT NULL,
  uploaded_at TEXT NOT NULL,
  created_by_user_id INTEGER,
  FOREIGN KEY(application_id) REFERENCES applications(id)
);
CREATE INDEX IF NOT EXISTS idx_applied_assets_app ON applied_assets(application_id);
```

### SQLAlchemy model deltas (owned by T1)

- `Application` (database_service.py:28): add `applied_substage`, `submission_record_json`, `submission_snapshot_json`, `confirmation_record_json`, `follow_up_plan_json`, `sla_tracker_json` as `Column(Text, nullable=True)` (string for `applied_substage`).
- `ApplicationEvent` (database_service.py:140): add `actor`, `title`, `metadata_json`, `related_asset_id`, `substage`.
- `ApplicationContact` (database_service.py:125): add `is_hiring_manager` (`Boolean`), `source` (`String`).
- New `AppliedAsset(Base)` class with relationship from `Application`.

## 5. Service / API changes

### New backend modules (avoid further growth of the 3.6k-LOC `main.py`)

- `backend/models/applied_models.py` — Pydantic input/output models (T2).
- `backend/services/applied/` — package of one-module-per-concern (T3.0 scaffolds; T3a–T3h fill in). Holds all Applied business logic: substage derivation, completion %, SLA computation, snapshot lock, JSON validators, event enrichment.
- `backend/routes/applied/` — package of one-module-per-endpoint (T4.0 scaffolds + mounts; T5–T13b each own one file). The `APIRouter` carries `/api/applications/{application_id}/applied/*`.

**Rationale:** splitting into packages reduces collision risk with the giant `main.py` and enables 8-way (services) and 12-way (endpoints) parallelism. `main.py` itself only takes a 2-line `include_router` change at T4.0 and a 2-line thread start at T14.

### Endpoint inventory (action-oriented, base `/api/applications/{application_id}/applied`)

| # | Method | Path | Endpoint task | Service task |
|---|---|---|---|---|
| 1 | GET  | `/` | T5 | T3b |
| 2 | PUT  | `/submission` | T6 | T3c |
| 3 | POST | `/confirmation/receipt` (multipart) | T7a | T3d |
| 4 | PUT  | `/confirmation` | T7b | T3d |
| 5 | PUT  | `/follow-up-plan` | T9a | T3e |
| 6 | POST | `/follow-up/send-log` | T9b | T3e |
| 7 | GET  | `/follow-up/templates` | T10 | T3f |
| 8 | PUT  | `/contact` | T11 | T3g |
| 9 | GET  | `/sla` | T8 | T3a (`compute_sla`) |
| 10 | GET | `/activity-log` | T12 | T3b |
| 11 | GET | `/next-steps` | T13a | T3a (`compute_next_steps`) |
| 12 | POST | `/transition-to-interviewing` | T13b | T3h |

All routes share `Depends(get_current_user_id)` and a leading "load + ownership check" helper inside each service module.

## 6. Background jobs / automation changes (owned by T14)

Add **one** new daemon thread modeled on `run_maintenance_loop` (main.py:171). Cadence 10 min. Two responsibilities, but combined into a single loop to keep thread count and lock contention down:

- **Overdue follow-up sweeper:** scan `applications WHERE pipeline_stage = 'applied' AND follow_up_plan_json IS NOT NULL`; for each row, parse the plan, compute overdue days, and **only if the plan was not already overdue at the previous tick**, emit a `follow_up_overdue` event and call `create_notification(..., category='warning', link_screen='lifecycle', link_app_id=app.id, link_anchor='applied/follow_up_due')`. Update `follow_up_plan_json.status = 'overdue'` (per D4) and call `derivations.recompute_substage_cache` (per D5). Idempotency: only emit if no `follow_up_overdue` event already exists at the same overdue threshold.
- **SLA milestone sweeper:** recompute `sla_tracker_json` via `derivations.compute_sla`. When a milestone (`reached: false → true`) flips, emit one notification + one `metadata_json`-tagged event per (`application_id`, `milestone_label`) pair. Idempotency: only emit when the cached `reached_at` was previously null.

Per §13.6, T14 lives in `backend/jobs/applied_jobs.py` (new file) and is started alongside `run_maintenance_loop` via a 2-line addition to `main.py`.

## 7–9. (removed — see §13)

The original v1 ordered task list, dependency graph, and open-questions sections have been removed. **§13 is the canonical and only execution source**, and the seven decisions are now confirmed in §13.3. Numbering is preserved so cross-references from earlier sections still resolve.

## 10. Out of scope (do not implement)

- Sending actual outbound emails for follow-ups.
- AI-personalized follow-up template generation (deferred per PRD).
- CRM / ATS sync.
- Cross-stage workflow redesign beyond Applied.
- Migrating the existing `substage_progress` boolean flags — they remain alongside the new fields for backward compatibility during rollout, then can be removed in a later cleanup.
- Splitting `main.py` or `database_service.py` into smaller modules. We only carve out *new* code into new files; existing megafiles are not refactored.
- Renaming `application_contacts.role` to `title`.

## 11. Rollout / transition strategy for frontend

The Applied UI today reads from `app.substage_progress` JSON for completion booleans. After Phases A–C (T1 through T14) land, `GET /applied` becomes the new source of truth, but `substage_progress` keeps working as a derived/legacy field. The Phase D frontend tasks (T15.0 refactor, then T15–T18 in parallel) swap the *display* source incrementally — at no point is the UI broken because:

1. The new endpoints return data even when the new JSON columns are null (default to empty objects).
2. The frontend keeps calling the existing `PUT /api/applications/{id}` with `substage_progress` until each substage's task completes; the new endpoints are additive.
3. `handleMoveToInterviewing` (`ApplicationLifecycle.jsx:3138`) continues to work via the legacy path until T18 swaps it to `POST /transition-to-interviewing`.

## 12. Key file references

- PRD: `documentation/applied-stage-prd.md`
- Migrations: `backend/services/database_service.py:551` (`_migrate_schema`)
- Event helper: `backend/services/database_service.py:2006` (`_log_event`)
- Notification helper: `backend/services/database_service.py:2032` (`create_notification`)
- Maintenance thread (template for T14 sweeper): `backend/main.py:171`
- Upload pattern (template for T3d / T7a): `backend/main.py:657` (`upload_app_additional_doc`)
- Applied UI: `frontend/src/pages/ApplicationLifecycle.jsx:3080` (`AppliedSubStagePanel`)
- Substages list constant: `ApplicationLifecycle.jsx:150`
- Auth context: `frontend/src/App.jsx` (`useAuth`, `fetchWithAuth`)

---

## 13. Multi-agent execution normalization (canonical)

**§13 is the only execution source.** Downstream agents dispatch from §13.2 (graph), §13.3 (decisions), §13.4 (parallelization groups), §13.5 (file ownership), and §13.6 (per-task execution notes). Per-task agent briefs live in `nimbalyst-local/plans/applied-stage-tasks/`. The v1 ordered list, dep graph, and open-questions sections (former §7/§8/§9) have been removed.

### 13.1 What changed vs v1

- **T3 was too big for one PR.** It declared 13 service functions in one file. Split into a service package (`backend/services/applied/`) with one concern per module (T3.0 + T3a–T3h).
- **T5–T13 collided on `applied_routes.py`.** Each endpoint is now its own file under `backend/routes/applied/` (T4.0 scaffolds; T5–T13b each own one file). Bundled multi-endpoint tasks (T7, T9, T13) are split.
- **T15–T18 collided on `ApplicationLifecycle.jsx` (6815 LOC).** New T15.0 refactor extracts the four substage panels into `frontend/src/components/Applied/{Submitted,Confirmed,FollowUpDue,FollowUpSent}Tab.jsx` so T15–T18 become independent.
- **T19 was too coarse.** Split into 6 focused test files so failures are localized and the tests can land in parallel.
- **Open questions promoted to Phase 0 decisions** so they are surfaced *before* any blocked task is dispatched.

### 13.2 Final task graph

```
Phase 0 (decisions)
   D1 D2 D3 D4 D5 D6 D7
        │
        ▼
Phase A (foundations)
   T1 ── T2 ── T3.0 ─┬─ T3a (derivations, pure)
                     ├─ T3b (state)
                     ├─ T3c (submission)
                     ├─ T3d (confirmation+receipt)
                     ├─ T3e (follow-up plan+send)
                     ├─ T3f (templates)
                     ├─ T3g (contact)
                     └─ T3h (transition)
                                  │
                                  ▼
                                T4.0  (router skeleton + main.py include_router)
                                  │
            ┌─────────────────────┼─────────────────────────┐
            ▼                     ▼                         ▼
Phase B (endpoints, all parallel after T4.0 + their T3* dep)
   T5  (←T3b)   T6  (←T3c)   T7a (←T3d)   T7b (←T3d)
   T8  (←T3a)   T9a (←T3e)   T9b (←T3e)   T10 (←T3f)
   T11 (←T3g)   T12 (←T3b)   T13a(←T3a)   T13b(←T3h)
                                  │
                                  ▼
Phase C (automation)
   T14 (←T3a, T3e)   parallel with Phase B
                                  │
            ┌─────────────────────┴─────────────────────┐
            ▼                                           ▼
Phase D (frontend)                               Phase E (tests)
   T15.0 (refactor; sequential)                  T19a (←T3a)  parallel
       │                                          T19b (←T3a)  parallel
       ├─ T15  (←T5, T6)        parallel         T19c (←T3c)  parallel
       ├─ T16  (←T5, T7a, T7b, T8)               T19d (←T3d)  parallel
       ├─ T17  (←T5, T9a, T9b, T10, T11)         T19e (←T14)  parallel
       └─ T18  (←T5, T12, T13a, T13b)            T19f (←T3a)  parallel
```

### 13.3 Phase 0 — Blocking decisions (CONFIRMED 2026-05-21)

All seven decisions approved as recommended. Orchestrator is cleared to dispatch any task in §13.6 subject to its other dependencies.

| # | Decision | Confirmed answer | Status |
|---|---|---|---|
| D1 | DB column `application_contacts.role` vs PRD's `title` | Keep `role`; alias to `title` via Pydantic | ✅ confirmed |
| D2 | v1 follow-up template content | Ship two PRD templates verbatim (`gentle_nudge`, `detailed_check_in`) | ✅ confirmed |
| D3 | Snapshot override path | None in v1; historical lock stays hard | ✅ confirmed |
| D4 | Overdue plan status persistence | Cache in `follow_up_plan_json.status`; always recompute on read | ✅ confirmed |
| D5 | When to refresh `applied_substage` cache | Explicit recompute after every Applied write inside the service | ✅ confirmed |
| D6 | SLA endpoint when no baseline exists | Return 404; UI hides the panel | ✅ confirmed |
| D7 | Frontend transition-gate UX when `can_transition: false` | Render disabled with hover-tooltip listing `blockers` | ✅ confirmed |

**D5 scope clarification (user-supplied):** D5 is a policy decision. It only gates tasks that *write* Applied state or that *implement* the recompute helper itself: **T3a (signature of `recompute_substage_cache`), T3c, T3d, T3e, T3h**. Tasks that only *read* the current cached substage for display purposes are not gated by D5 — they simply consume whatever value the writer modules persisted.

### 13.3a Orchestration runtime guidance (user-supplied)

- **Phase A executes strictly sequentially:** T1 → T2 → T3.0 → T4.0. Each is one small PR on a different file.
- **Phase A2 fan-out:** dispatch T3a–T3h to 8 agents concurrently once T3.0 lands.
- **Phase B concurrency cap:** the graph supports 12-way parallelism, but the orchestrator will **start with 4–6 concurrent agents** during Phase B while Nimbalyst stability is validated. Scale up after the first wave merges cleanly.
- **T15.0 is a mechanical refactor.** The "zero behavior change" rule is mandatory and judged purely on visual diff. It is not an improvement pass; any code-quality cleanup belongs to a separate follow-up task.

### 13.4 Parallelization groups

**Group P-0 — Phase 0:** sequential (asynchronous human decisions). No code work in parallel here.

**Group P-A1 — Strict sequence (foundations):** `T1 → T2 → T3.0 → T4.0`. All four touch a different file each, but each later one needs the previous one's output as an import surface. Total 4 small PRs.

**Group P-A2 — Service modules (all parallel after T3.0):** `T3a, T3b, T3c, T3d, T3e, T3f, T3g, T3h`. Each owns one file under `backend/services/applied/`. 8 agents can run concurrently.

**Group P-B — Endpoints (all parallel after their T3* dep + T4.0):** `T5, T6, T7a, T7b, T8, T9a, T9b, T10, T11, T12, T13a, T13b`. Each owns one file under `backend/routes/applied/`. 12 agents can run concurrently.

**Group P-C — Automation:** `T14` is solo, runs parallel with Phase B once T3a + T3e exist.

**Group P-D1 — Frontend refactor:** `T15.0` is solo (touches `ApplicationLifecycle.jsx`).

**Group P-D2 — Frontend wiring (all parallel after T15.0):** `T15, T16, T17, T18`. Each owns one file under `frontend/src/components/Applied/`. 4 agents can run concurrently.

**Group P-E — Tests:** `T19a–T19f` parallel after their respective service module lands.

### 13.5 File-collision matrix (single-writer enforcement)

| File | Owned by | When |
|---|---|---|
| `backend/services/database_service.py` | T1 only | Phase A1 |
| `backend/models/applied_models.py` | T2 only | Phase A1 |
| `backend/services/applied/__init__.py` | T3.0 only | Phase A1 |
| `backend/services/applied/<module>.py` | one of T3a–T3h | Phase A2 |
| `backend/routes/applied/__init__.py` | T4.0 only | Phase A1 |
| `backend/routes/applied/<module>.py` | one of T5–T13b | Phase B |
| `backend/main.py` | T4.0 (add `include_router`), T14 (add thread start) — **sequence T14 after T4.0** | Phases A1 + C |
| `backend/jobs/applied_jobs.py` | T14 only | Phase C |
| `frontend/src/pages/ApplicationLifecycle.jsx` | T15.0 only | Phase D1 |
| `frontend/src/components/Applied/<Sub>Tab.jsx` | one of T15–T18 | Phase D2 |
| `backend/tests/applied/<test>.py` | one of T19a–T19f | Phase E |

**No two tasks ever write the same file.** This is the property that makes the new graph actually parallelizable.

### 13.6 Per-task execution notes

Every note below is in the form: **what the agent owns** + **what the agent must not touch** + **how it gets verified**.

#### T1 — Schema + SQLAlchemy model deltas
- **Owns:** `backend/services/database_service.py` only.
- **Do not:** reorder existing migration entries; modify any pre-existing column definition; drop any column; run a fresh DB rebuild; touch `applications.db` or any backup file; alter the existing `Notification`, `User`, or `UserProfile` classes.
- **Append-only:** add new ALTER statements at the bottom of the `migrations` list inside `_migrate_schema()`; add new model fields at the bottom of each class.
- **Verify:** `python -c "from backend.services.database_service import DatabaseService; DatabaseService()"` boots clean; `sqlite3 applications.db ".schema applications" | grep applied_substage` returns the new column.

#### T2 — Pydantic contracts
- **Owns:** new file `backend/models/applied_models.py`.
- **Do not:** import from `backend/services/applied/` (T3 not yet built); add business logic or DB I/O; use naive `datetime.now()` — all datetimes must be `datetime` with `tzinfo=UTC`.
- **Verify:** `python -c "from backend.models.applied_models import SubmissionRecordIn"` succeeds; `ruff check backend/models/applied_models.py` clean.

#### T3.0 — Service package skeleton
- **Owns:** create `backend/services/applied/__init__.py` + empty stub files `derivations.py`, `state.py`, `submission.py`, `confirmation.py`, `follow_up.py`, `templates.py`, `contact.py`, `transition.py`. Each stub file declares its public function signatures returning `raise NotImplementedError`.
- **Do not:** implement any function body; import anything from sibling stub modules.
- **Verify:** `python -c "from backend.services.applied import derivations, state, submission, confirmation, follow_up, templates, contact, transition"` succeeds.

#### T3a — Derivations (pure functions)
- **Owns:** `backend/services/applied/derivations.py`. Implements `determine_applied_substage(app_dict)`, `compute_sla(app_dict)`, `compute_completion(app_dict)`, `compute_next_steps(app_dict)`, and a `recompute_substage_cache(session, app_id)` helper used by writer modules (per D5).
- **Do not:** open a DB session, perform I/O, write to other applied modules, or import from `state.py`/`submission.py`/etc.
- **Verify:** T19a + T19b cover this module; running `pytest backend/tests/applied/test_derivations.py backend/tests/applied/test_sla.py` passes.

#### T3b — State assembly (read-only)
- **Owns:** `backend/services/applied/state.py`. Implements `get_applied_state(session, app_id, user_id)` returning the §"GET Applied state" PRD shape, assembling submission/confirmation/follow-up/SLA/contacts/completion in one DB round trip per concern.
- **Do not:** call `_log_event`; mutate any column including `applied_substage`; touch `derivations.py`.
- **Verify:** golden-snapshot test inside T19f covering a row with all JSON cols populated.

#### T3c — Submission service
- **Owns:** `backend/services/applied/submission.py`. Implements `save_submission(session, app_id, payload, user_id)`. Enforces snapshot immutability per D3.
- **Do not:** read templates; recompute SLA (that's `compute_sla` in T3a); modify contacts.
- **Verify:** T19c (snapshot lock test) passes.

#### T3d — Confirmation + receipt service
- **Owns:** `backend/services/applied/confirmation.py`. Implements `upload_receipt(...)` and `save_confirmation(...)`. SHA-256 file hashing per PRD §3.
- **Do not:** write into `submission_record_json`; bypass the MIME allow-list (`image/png`, `image/jpeg`, `application/pdf` only).
- **Verify:** T19d (MIME allow-list test) passes; a PNG/JPG/PDF upload returns a non-empty `file_hash`; receipt rows are persisted into `applied_assets`.

#### T3e — Follow-up plan + send-log service
- **Owns:** `backend/services/applied/follow_up.py`. Implements `save_follow_up_plan` and `mark_follow_up_sent`. Default `due_at` rule per PRD §5 follows D4.
- **Do not:** trigger notifications (that's T14); emit unsolicited events outside the documented set.
- **Verify:** smoke test inside T19e covers status flip from `scheduled` → `overdue` → `completed`.

#### T3f — Follow-up templates
- **Owns:** `backend/services/applied/templates.py`. Returns deterministic v1 templates per D2.
- **Do not:** call AI services; persist anything.
- **Verify:** `list_follow_up_templates()` returns the two templates with the IDs the frontend expects (`gentle_nudge`, `detailed_check_in`).

#### T3g — Contact upsert
- **Owns:** `backend/services/applied/contact.py`. Implements `upsert_contact(session, app_id, payload, user_id)` against the existing `application_contacts` table; emits `contact_linked` events.
- **Do not:** rename DB column `role` (per D1); duplicate contact data into JSON columns.
- **Verify:** unit test creates a contact, mutates it, re-reads, asserts `is_hiring_manager` and `source` round-trip; assert no `application_contacts` JSON shadow exists.

#### T3h — Transition
- **Owns:** `backend/services/applied/transition.py`. Implements `transition_to_interviewing(session, app_id, user_id)`; validates readiness rules; emits `moved_to_interviewing`.
- **Do not:** decide UX (D7 is frontend-only); bypass readiness checks.
- **Verify:** test inside T19f confirms transition is rejected when `compute_next_steps().can_transition == false`.

#### T4.0 — Router package skeleton
- **Owns:** create `backend/routes/applied/__init__.py` with `router = APIRouter(prefix="/api/applications/{application_id}/applied", tags=["applied"])`; stub files for each endpoint with a 1-line `# region: <name>` comment; add `from backend.routes.applied import router as applied_router` + `app.include_router(applied_router)` in `main.py`.
- **Do not:** implement any endpoint body; modify any existing route in `main.py`; rename any existing path.
- **Verify:** `curl http://localhost:8000/openapi.json | jq '.paths | keys[] | select(startswith("/api/applications"))'` lists the new prefix; existing endpoints still resolve.

#### T5 — GET `/applied`
- **Owns:** `backend/routes/applied/state.py`.
- **Do not:** include business logic; call DB directly (use `state.get_applied_state`).
- **Verify:** integration test issues `GET` with valid auth and asserts shape matches PRD §"Get Applied state".

#### T6 — PUT `/submission`
- **Owns:** `backend/routes/applied/submission.py`.
- **Blocked on:** D3.
- **Do not:** allow overwriting `submission_snapshot_json`; auto-create a snapshot when one already exists (must reject).
- **Verify:** integration test posts twice; second call gets HTTP 409 (or validation_error per envelope) with `field: snapshot`.

#### T7a — POST `/confirmation/receipt`
- **Owns:** `backend/routes/applied/receipt.py`.
- **Do not:** accept MIME types beyond the PRD list; skip file-hash storage.
- **Verify:** integration test uploads a PDF and reads back the `applied_assets` row.

#### T7b — PUT `/confirmation`
- **Owns:** `backend/routes/applied/confirmation.py`.
- **Do not:** accept a `receipt_asset_id` that belongs to a different application.
- **Verify:** test rejects cross-application receipt linkage with 400; happy-path sets `applied_substage='confirmed'`.

#### T8 — GET `/sla`
- **Owns:** `backend/routes/applied/sla.py`.
- **Blocked on:** D6.
- **Do not:** compute milestones inline (use `derivations.compute_sla`).
- **Verify:** test asserts 404 when no baseline; happy-path returns 7/14/21 milestones.

#### T9a — PUT `/follow-up-plan`
- **Owns:** `backend/routes/applied/follow_up_plan.py`.
- **Blocked on:** D4.
- **Do not:** emit `follow_up_sent` (that's T9b); skip the auto-`due_at` derivation.
- **Verify:** test omitting `due_at` returns plan with derived date.

#### T9b — POST `/follow-up/send-log`
- **Owns:** `backend/routes/applied/follow_up_sent.py`.
- **Blocked on:** D4.
- **Do not:** allow `sent_at` earlier than `submission_record.applied_at`.
- **Verify:** test rejects backwards `sent_at` with 400; happy-path flips `applied_substage` to `follow_up_sent`.

#### T10 — GET `/follow-up/templates`
- **Owns:** `backend/routes/applied/templates.py`.
- **Blocked on:** D2.
- **Do not:** return a different shape than the PRD example.
- **Verify:** schema test asserts both template IDs and required fields.

#### T11 — PUT `/contact`
- **Owns:** `backend/routes/applied/contact.py`.
- **Blocked on:** D1.
- **Do not:** create a parallel contact store; bypass the existing endpoints at `main.py:3215–3247` (those keep working — this is additive).
- **Verify:** test asserts the row created by the new endpoint is visible to the existing `GET .../contacts` path.

#### T12 — GET `/activity-log`
- **Owns:** `backend/routes/applied/activity_log.py`.
- **Do not:** mutate event rows; expose events from other applications.
- **Verify:** test asserts pagination via `limit`/`offset` and filters by `application_id`.

#### T13a — GET `/next-steps`
- **Owns:** `backend/routes/applied/next_steps.py`.
- **Do not:** mutate state; transition the application.
- **Verify:** test against a fixture where `follow_up_sent + contact_exists + response_window_met` asserts `can_transition: true`.

#### T13b — POST `/transition-to-interviewing`
- **Owns:** `backend/routes/applied/transition.py`.
- **Do not:** allow transition when `next-steps.can_transition` is false; touch `applied_substage` after transition (the row leaves Applied).
- **Verify:** test asserts 422 on a row that fails readiness; happy-path sets `pipeline_stage='interviewing'` and emits `moved_to_interviewing` event.

#### T14 — Sweeper job
- **Owns:** `backend/jobs/applied_jobs.py` (new file) + 2-line edit to `main.py` to import and start the daemon thread alongside `run_maintenance_loop`.
- **Blocked on:** D4, D5.
- **Do not:** modify `run_maintenance_loop`; share state across iterations; emit duplicate notifications when re-running (idempotent via existing-event check).
- **Verify:** T19e runs the sweeper twice over the same fixture and asserts exactly one `follow_up_overdue` event + one notification per threshold.

#### T15.0 — Frontend panel extraction (refactor)
- **Owns:** `frontend/src/pages/ApplicationLifecycle.jsx` (only this task touches it during Phase D). Extracts the four `case '<substage>':` blocks from `renderContent()` into:
  - `frontend/src/components/Applied/SubmittedTab.jsx`
  - `frontend/src/components/Applied/ConfirmedTab.jsx`
  - `frontend/src/components/Applied/FollowUpDueTab.jsx`
  - `frontend/src/components/Applied/FollowUpSentTab.jsx`
  Replaces the bodies with `<SubmittedTab app={app} onRefresh={...} ... />` etc. The shared helpers (`isComplete`, `updateSubStageProgress`, `getCompletedCount`, `handleMoveToInterviewing`) remain in the parent and are passed down as props or moved into a small `useAppliedState(app)` hook in `components/Applied/useAppliedState.js`.
- **Do not:** change any user-visible behavior; introduce new fetch calls; change styling; remove or rename `substage_progress` calls (still legacy-compatible).
- **Verify:** visual diff in browser — the Applied stage renders identically before/after. Existing `substage_progress` toggling still works.

#### T15 — SubmittedTab wiring
- **Owns:** `frontend/src/components/Applied/SubmittedTab.jsx`.
- **Do not:** edit `ApplicationLifecycle.jsx`; remove the historical-lock UI; introduce new API endpoints beyond T5/T6.
- **Verify:** mocked-data smoke test in browser shows real `submission_record_json` fields replacing hardcoded "Resume_v4_Designer.pdf" / "External Portal (ATS)" placeholders.

#### T16 — ConfirmedTab wiring
- **Owns:** `frontend/src/components/Applied/ConfirmedTab.jsx`.
- **Do not:** implement own MIME validation (server is canonical); allow upload to non-multipart endpoints.
- **Verify:** upload a PNG receipt in browser; toast shows success; refresh shows the receipt persisted; SLA panel reads real milestones.

#### T17 — FollowUpDueTab wiring
- **Owns:** `frontend/src/components/Applied/FollowUpDueTab.jsx`.
- **Blocked on:** D2.
- **Do not:** render templates inline as JS literals (must come from `/follow-up/templates`); use the existing `application_contacts` POST endpoint when the new `PUT /contact` is available.
- **Verify:** changing the due-date input issues `PUT /follow-up-plan`; "Mark Follow-up Sent" advances the substage.

#### T18 — FollowUpSentTab + transition gate
- **Owns:** `frontend/src/components/Applied/FollowUpSentTab.jsx`.
- **Blocked on:** D7.
- **Do not:** keep the legacy `onStageChange('interviewing')` path — replace with `POST /transition-to-interviewing`; disable the button only when `can_transition===false` (no hiding).
- **Verify:** activity log mirrors `application_events`; disabled-state tooltip lists blockers from `next-steps.blockers`.

#### T19a – T19f — Tests (one file each)
- **Own** their respective test file. **Do not** import fixtures from sibling test files (each is self-contained). **Use** the existing sqlite test pattern (no DB mocks). **Verify** by running `pytest backend/tests/applied/<file>.py` individually with a green result.

### 13.7 Blocked-task quick reference

| Task | Blocking decision(s) |
|---|---|
| T1 (contacts portion only) | D1 |
| T3a (signature of `recompute_substage_cache`) | D5 |
| T3c, T6 | D3 |
| T3d, T7a, T7b | — (no decision; PRD is unambiguous) |
| T3e, T9a, T9b, T14 | D4 |
| T3f, T10, T17 | D2 |
| T8, T16 | D6 |
| T11 | D1 |
| T13b | — |
| T18 | D7 |

If the orchestrator dispatches a task above before the corresponding decision is logged in §13.3 as `confirmed`, the picking agent must halt and post a comment requesting the decision.
