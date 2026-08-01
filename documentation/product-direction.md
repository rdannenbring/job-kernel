# JobKernel — Product Direction

**Status:** governing document. Every other spec in `documentation/`, `nimbalyst-local/plans/`, and `Design/` defers to this one. Where an older doc conflicts with this page, this page wins.
**Last updated:** 2026-07-26

---

## 1. Positioning

JobKernel is a **high-throughput application workbench**.

The user's scarce resource is **time-per-application**, not rigor-per-application. A job seeker sending 15 applications a week does not lose the search by under-documenting one of them; they lose it by grinding to a halt on ceremony. The product's job is to help them **customize, track, and get through as many applications as possible**, and to keep an accurate record of what happened without making the record-keeping a prerequisite for progress.

This is a correction. JobKernel was originally specced as a guided, evidence-gated workflow — 47 sub-stages, a prescribed primary CTA per stage, and a hard readiness gate on `applied → interviewing`. Those features are **not being removed**. They are being demoted from *requirements* to *optional enrichment*.

| Old framing | New framing |
|---|---|
| The pipeline is a checklist the user owes | The pipeline is a record of what the user did |
| Depth is required to advance | Depth is available if the user wants it |
| The backend decides when you may move on | The backend computes signals; the user decides |
| One prescribed CTA per stage | One *suggested* next action per stage |

---

## 2. Core principle

> **Nothing blocks stage advancement by default.**

Every sub-stage, checklist item, progress ring, readiness signal, and next-action hint is optional enrichment. A user must always be able to move an application to any stage — including recording an application they submitted without ever generating documents in JobKernel, and including moving an application backwards.

Concretely, this means:

- No endpoint returns a 4xx purely because an optional sub-stage is incomplete, unless the user has explicitly opted in (§3).
- No primary CTA is hidden because prerequisite data is missing. Show the button; show a non-blocking hint next to it.
- Signals are still computed and still stored. Demoting a gate never means deleting its logic.

---

## 3. Guided mode (opt-in enforcement)

Users who *want* the discipline can turn it on. Guided mode is **off by default**, configured per user in **Settings → Workflow**, and stored alongside `ui_config` in the `configs.settings` JSON blob (`backend/services/database_service.py:268-275` — one row per user, no schema migration needed to add keys).

```json
"workflow_config": {
  "guided_mode": false,
  "stage_gates": {
    "saved": false, "generated": false, "applied": true,
    "interviewing": false, "decision": false, "accepted": false
  }
}
```

Semantics:

- `guided_mode` is the master switch. When it is `false`, **no** stage gate is enforced regardless of `stage_gates`.
- `stage_gates.<stage>` selects which stages enforce their readiness rules once the master is on. This is the master-toggle-reveals-sub-toggles pattern already used at `frontend/src/pages/Admin.jsx:443-475`.
- Resolution **fails open**: a missing key, a malformed blob, or a stage name not present in `stage_gates` all resolve to *not gated*. This matches the "default-to-enabled unless explicitly false" convention at `frontend/src/context/NotificationContext.jsx:41-44`.

### The gating contract

Any code that could block a user reads the preference; it never hardcodes enforcement.

1. **Services compute, they do not decide.** A readiness function returns signals. If it can also raise, that behavior must be behind an explicit `enforce: bool = False` parameter that defaults to permissive.
2. **Routes own pref-reading.** The route resolves `is_stage_gated(user_id, stage)` and passes it to the service. This keeps services pure and testable.
3. **The frontend is told whether a gate is live.** Readiness responses carry an `enforced` flag so components can render *disabled + blocking* or *enabled + advisory* without a second config round-trip.
4. **Signals survive demotion.** When a gate is off, the readiness payload still returns its full blocker list — the UI just renders it as suggestions. Events still log `readiness_score`. The data is useful; it just isn't a barrier.

---

## 4. Vocabulary

The philosophy of the old direction does not live in a single feature flag. It lives in domain nouns that leaked into the API and the UI. The names stay where they are already shipped (renaming a field is a breaking change, not worth it in this pass), but the **reading** is corrected — and new surfaces should use the right-hand column.

| Term in code | Read it as | Do not read it as |
|---|---|---|
| `blockers` | **Suggestions** — things that would strengthen this application | Things preventing you from continuing |
| `can_transition` | **Recommended** — the signals line up | Permitted |
| `readiness_score` | A summary signal, useful for sorting and retrospectives | A grade, or a threshold to clear |
| Completion % / `3/5` counts | **Depth captured** — how much of the optional record you filled in | Work owed |
| "Next action" card | The **suggested** next action | The prescribed next action |

UI copy rules:

- Do not tell the user they are blocked when they are not. Use "Suggested first: …", not "Blocked by: …", whenever `enforced` is false.
- Do not use the words **coach** or **coaching** as product vocabulary anywhere in the app, docs, or design handoffs. The opt-in behavior is called **guided mode**.
- An empty checklist is a neutral state, not a failure state. Empty-state copy should not imply the user is behind.

---

## 5. Design-review rule

> **A new feature must not introduce a hard gate without a corresponding Settings toggle, defaulted off.**

Applies to review of any PR, spec, or design handoff. A "hard gate" is anything that prevents the user from recording something that actually happened:

- a non-2xx response driven by optional workflow data
- a `disabled` primary action
- a CTA that is conditionally hidden (hiding is a gate with worse discoverability)
- a required field on a form whose purpose is record-keeping

If a proposal includes one of these, the reviewer asks for one of: (a) remove it, (b) make it a non-blocking hint, or (c) put it behind a `workflow_config.stage_gates` entry and default it to `false`.

---

## 6. Scope boundaries

Retained and re-specced as optional (**not** cut): the full 47-entry sub-stage taxonomy, the per-stage suggested-action model, the Applied readiness computation, progress rings and completion counts. See `documentation/workflow-substage-catalog.md` for the catalog and per-sub-stage implementation status.

Not part of this direction change (deliberately deferred, not rejected): a dedicated fast-apply flow, bulk-operation expansion, a throughput dashboard, consolidating the four duplicated sub-stage taxonomies, and building out the ~43 sub-stage panels that are currently static mockups.

---

## 7. Related documents

| Document | Relationship |
|---|---|
| `documentation/workflow-substage-catalog.md` | The retained taxonomy + suggested actions, with build status per sub-stage |
| `documentation/applied-stage-prd.md` | Shipped. Its readiness language is amended by §3 of this doc |
| `nimbalyst-local/plans/applied-stage.md` | Completed orchestration plan; historical. Its "do not bypass readiness checks" instructions are superseded by §3 |
| `Design/design_handoff_job_details/` | Historical design records. The "Next action" card they describe is a *suggestion* surface per §4 |
| `documentation/job_discovery_implementation_plan.md` | Independent feature; its Settings work lands in the same Settings structure |
