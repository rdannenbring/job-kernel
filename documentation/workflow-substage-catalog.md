# Workflow Sub-stage Catalog

**Supersedes:** `documentation/Top-levelstage-Usefulsub-stages.csv.xlsx` and `documentation/Stage-PrimaryCTA-SecondaryCTAs.csv.xlsx`. Both are binary blobs that cannot be reviewed or diffed in git; their content is ported here. Treat this file as canonical and the spreadsheets as archived.

**Governed by:** [`product-direction.md`](product-direction.md). Every entry below is **optional** — see §2 of that doc: nothing blocks stage advancement by default.

**Code source of truth:** `STAGE_SUBSTAGE_DEFS` at `frontend/src/pages/ApplicationLifecycle.jsx:235-245`, assembled from the nine `*_SUBSTAGES` arrays at `frontend/src/pages/ApplicationLifecycle.jsx:138-210`. Ids and labels below are copied verbatim from there.

---

## 1. How to read this catalog

Every sub-stage is `optional`. There is no `required` column because there is no required sub-stage. Completion is **depth captured**, not work owed.

**Implementation status** column:

| Status | Meaning |
|---|---|
| `built` | Backend persistence + API + wired UI. Data survives outside `substage_progress`. |
| `frontend-only` | UI writes a boolean into `applications.substage_progress` via `PUT /api/applications/{id}`. No dedicated backend model. Handlers: `ApplicationLifecycle.jsx:1524` (Saved) and `ApplicationLifecycle.jsx:3117` (Applied/Generated panels). |
| `derived` | Not user-toggled; computed from other data at `ApplicationLifecycle.jsx:247-262`. |
| `mockup` | Static UI only — no handler, no persistence. Checkboxes render with `defaultChecked` and no `onChange` (e.g. `ApplicationLifecycle.jsx:3861-3873`). |

Only the four **Applied** sub-stages are `built`. Everything from Interviewing onward is a mockup.

---

## 2. Sub-stage catalog (47 entries)

### Saved — 5 sub-stages

| Id | Label | Optional | Status | Notes |
|---|---|---|---|---|
| `parsed` | Job Analysis (parsed) | optional | `derived` | Hardcoded true for the Saved stage at `ApplicationLifecycle.jsx:250`. |
| `reviewed` | Reviewed | optional | `frontend-only` | Written at `ApplicationLifecycle.jsx:1595`. |
| `network` | Network Contacts | optional | `frontend-only` | Auto-set when contacts exist (`ApplicationLifecycle.jsx:1263-1266`); contacts themselves persist in `application_contacts`. |
| `company` | Company Research | optional | `frontend-only` | Set after a company-research fetch populates `applications.company_research` (`ApplicationLifecycle.jsx:2412-2416`). |
| `prioritized` | Prioritized | optional | `frontend-only` | Written alongside `applications.prioritization_ranking` at `ApplicationLifecycle.jsx:1495-1498`. |

### Generated — 4 sub-stages

| Id | Label | Optional | Status | Notes |
|---|---|---|---|---|
| `resume` | Resume | optional | `derived` | True when `applications.tailored_resume_path` is set (`ApplicationLifecycle.jsx:252`). |
| `cover_letter` | Cover Letter | optional | `derived` | True when `applications.cover_letter_path` is set (`ApplicationLifecycle.jsx:253`). |
| `answers` | Answers | optional | `frontend-only` | Boolean into `substage_progress`. |
| `prep` | Prep Artifacts | optional | `frontend-only` | Boolean into `substage_progress`. |

### Applied — 4 sub-stages *(the only fully built set)*

| Id | Label | Optional | Status | Backing |
|---|---|---|---|---|
| `submitted` | Submitted | optional | `built` | `applications.submission_record_json` + `submission_snapshot_json`; `GET/PUT …/applied/submission`. |
| `confirmed` | Confirmed | optional | `built` | `applications.confirmation_record_json` + `applied_assets`; `PUT …/applied/confirmation`, `POST …/applied/confirmation/receipt`. |
| `follow_up_due` | Follow-up Due | optional | `built` | `applications.follow_up_plan_json` + `sla_tracker_json`; `PUT …/applied/follow-up-plan`, `GET …/applied/sla`. |
| `follow_up_sent` | Follow-up Sent | optional | `built` | `application_events` (`follow_up_sent`); `POST …/applied/follow-up/send-log`. |

See `documentation/applied-stage-prd.md` for the full contracts. The `applied → interviewing` readiness computation lives here and is **advisory by default** — see `product-direction.md` §3.

### Interviewing — 5 sub-stages

| Id | Label | Optional | Status |
|---|---|---|---|
| `recruiter_screen` | Recruiter Screen | optional | `mockup` |
| `hiring_manager` | Hiring Manager | optional | `mockup` |
| `technical` | Technical | optional | `mockup` |
| `panel` | Panel | optional | `mockup` |
| `final_round` | Final Round | optional | `mockup` |

### Decision — 5 sub-stages

| Id | Label | Optional | Status |
|---|---|---|---|
| `awaiting_decision` | Awaiting Decision | optional | `mockup` |
| `references` | References | optional | `mockup` |
| `verbal_offer` | Verbal Offer | optional | `mockup` |
| `written_offer_pending` | Written Offer Pending | optional | `mockup` |
| `likely_reject` | Likely Reject | optional | `mockup` |

### Accepted — 5 sub-stages

| Id | Label | Optional | Status |
|---|---|---|---|
| `offer_received` | Offer Received | optional | `mockup` |
| `offer_reviewed` | Offer Reviewed | optional | `mockup` |
| `formal_acceptance` | Formal Acceptance | optional | `mockup` |
| `close_pipelines` | Close Pipelines | optional | `mockup` |
| `pre_onboarding` | Pre-onboarding | optional | `mockup` |

### Rejected — 6 sub-stages

| Id | Label | Optional | Status |
|---|---|---|---|
| `rejection_received` | Rejection Received | optional | `mockup` |
| `rejection_classified` | Rejection Classified | optional | `mockup` |
| `optional_response` | Optional Response | optional | `mockup` |
| `reflection_recorded` | Reflection Recorded | optional | `mockup` |
| `close_active_tasks` | Close Active Tasks | optional | `mockup` |
| `archived` | Archived | optional | `mockup` |

### Declined — 6 sub-stages

| Id | Label | Optional | Status |
|---|---|---|---|
| `offer_review` | Offer Review | optional | `mockup` |
| `reason_selection` | Reason Selection | optional | `mockup` |
| `response_preparation` | Response Preparation | optional | `mockup` |
| `communication_sent` | Communication Sent | optional | `mockup` |
| `preference_learning` | Preference Learning | optional | `mockup` |
| `archived_summary` | Archived Summary | optional | `mockup` |

### Withdrawn — 7 sub-stages

| Id | Label | Optional | Status |
|---|---|---|---|
| `decision_made` | Decision Made | optional | `mockup` |
| `reason_selected` | Reason Selected | optional | `mockup` |
| `contact_path` | Contact Path | optional | `mockup` |
| `withdrawal_sent` | Withdrawal Sent | optional | `mockup` |
| `close_active_tasks` | Close Active Tasks | optional | `mockup` |
| `preference_learning` | Preference Learning | optional | `mockup` |
| `archived` | Archived | optional | `mockup` |

**Totals:** 5 + 4 + 4 + 5 + 5 + 5 + 6 + 6 + 7 = **47**. Built: 4. Derived: 3. Frontend-only: 6. Mockup: 34.

---

## 3. Suggested actions per stage

Ported from `Stage-PrimaryCTA-SecondaryCTAs.csv.xlsx`. The spreadsheet's "Primary CTA" column is re-framed as a **suggested next action** — the action most users want next, surfaced prominently. It is not prescribed, it is never the only path forward, and it must never be hidden because prerequisite data is missing (`product-direction.md` §5).

| Stage | Suggested next action | Other actions |
|---|---|---|
| Saved | Generate application assets. | Edit details, set priority, archive. |
| Generated | Approve and mark ready. | Regenerate, edit, export. |
| Applied | Mark follow-up plan. | Add receipt, log contact. |
| Interviewing | Open prep workspace. | Schedule round, add notes, send thank-you. |
| Decision | Send follow-up or log signal. | Prepare negotiation, close as outcome. |
| Accepted | Start onboarding checklist. | Compare offer, close other pipelines. |
| Rejected | Log lessons learned. | Set reapply reminder, archive. |
| Declined | Send polite decline/withdrawal. | Record reason, update preferences. |

The source spreadsheet has **no row for Withdrawn**, even though the sub-stage taxonomy defines seven Withdrawn sub-stages. Treat Withdrawn's suggested action as undefined until someone specs it; do not invent one in code.

The "Next action" card described in `Design/design_handoff_job_details/README.md:296` renders from this table. Its copy should read as a suggestion, not an instruction.

---

## 4. Known drift

The sub-stage taxonomy is duplicated in four places, and the copies have **diverged**:

| Location | Symbol | Coverage | Divergence |
|---|---|---|---|
| `frontend/src/pages/ApplicationLifecycle.jsx:138-245` | `STAGE_SUBSTAGE_DEFS` | All 9 stages, 47 entries | Canonical. |
| `frontend/src/components/VerticalPipelineRail.jsx:19-60` | `STAGE_SUBSTAGES` | 6 stages, 28 entries — **omits rejected / declined / withdrawn** | Labels differ: `parsed` = "Job Analysis", `prioritized` = "Prioritize". Icons differ for `reviewed`, `company`, `prioritized`. |
| `frontend/src/pages/ApplicationDetailMobile.jsx:37-78` | `MOBILE_SUBSTAGES` | 6 stages, 28 entries — same omission | Labels abbreviated for mobile: `network` = "Network", `company` = "Research", `hiring_manager` = "Hiring Mgr", `formal_acceptance` = "Accepted", etc. |
| `frontend/src/components/Kanban/stages.js:13-24` | `SUBSTAGE_COUNTS` | Counts only, keyed by **capitalized** stage name | Reports `Rejected: 0, Declined: 0, Withdrawn: 0` — contradicts the canonical 6 / 6 / 7. |

Consolidating these into a single shared module is a **flagged follow-up, not part of this pass**. Until then, treat `ApplicationLifecycle.jsx` as canonical and expect the other three to disagree on wording, coverage, and counts.
