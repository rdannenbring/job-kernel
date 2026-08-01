# Applied Stage — Task Packets

> **COMPLETE — historical record. Nothing here is pending.**
>
> Every packet in this directory has been dispatched and merged (T1 `b92938d` → T19f `246d3fe`). The "packets pending" notes below described the state of the run in May 2026 and have been reconciled. The parent plan is at [`../applied-stage.md`](../applied-stage.md).
>
> ⚠️ The transition packets (T3h, T13b) specced the `applied → interviewing` readiness check as a **hard** gate. It is now **advisory by default**, enforced only when the user opts into guided mode. Governing doc: [`documentation/product-direction.md`](../../../documentation/product-direction.md).

Per-task briefs for the Applied stage initiative. Each packet was the **complete prompt** a downstream coding agent received. See §13 of the parent plan for the normalized graph.

## Dispatch order (as executed)

### Phase A — Foundations (strictly sequential) — all merged

| Order | Packet | After | Status |
|---|---|---|---|
| 1 | [T1 — Schema + SQLAlchemy model deltas](T1-schema-migrations.md) | — | ✅ merged `b92938d` |
| 2 | [T2 — Pydantic contracts](T2-pydantic-models.md) | T1 merged | ✅ merged `73bbb3d` |
| 3 | [T3.0 — Service package skeleton](T3.0-service-skeleton.md) | T2 merged | ✅ merged `4840888` |
| 4 | [T4.0 — Router scaffolding + main.py mount](T4.0-router-wireup.md) | T3.0 merged | ✅ merged `03ff20e` |

### Phase A2 — Service modules (one agent per file) — all merged

| Priority | Packet | Owns | Depends on | Status |
|---|---|---|---|---|
| 1 | [T3a — Derivations (pure)](T3a-derivations.md) | `services/applied/derivations.py` | T1, T2, T3.0 | ✅ `c2d5e6b` |
| 2 | [T3b — State assembly](T3b-state.md) | `services/applied/state.py` | T3a | ✅ `b4fbee8` |
| 3 | [T3c — Submission service](T3c-submission.md) | `services/applied/submission.py` | T3a | ✅ `fd617a6` |
| 4 | [T3d — Confirmation + receipt](T3d-confirmation.md) | `services/applied/confirmation.py` | T3a | ✅ `2998d98` |
| 5 | [T3e — Follow-up plan + send-log](T3e-follow-up.md) | `services/applied/follow_up.py` | T3a | ✅ `ba42818` |
| 6 | [T3f — Templates (deterministic v1)](T3f-templates.md) | `services/applied/templates.py` | T3.0 | ✅ `daf18a8` |
| 7 | [T3g — Contact upsert](T3g-contact.md) | `services/applied/contact.py` | T3.0 | ✅ `f4d6050` |
| 8 | [T3h — Transition to Interviewing](T3h-transition.md) | `services/applied/transition.py` | T3a | ✅ `59845c3` |

### Phase B — Endpoints — all merged

T5 `1ef5271`, T6 `2b661c4`, T7a `2771559`, T7b `7e0bde3`, T8 `c6e85eb`, T9a `7c1af02`, T9b `f10d49d`, T10 `231aa71`, T11 `1e5d11a`, T12 `89d61a6`, T13a `b971d66`, T13b `c24cf05`.

### Phase C — Automation — merged

T14 sweeper job — `96c9e9a`.

### Phase D — Frontend — all merged

T15.0 `458501c` (single-writer refactor on `ApplicationLifecycle.jsx`), then T15 `850457c`, T16 `17aee94`, T17 `7679603`, T18 `7325055`.

### Phase E — Tests — all merged

T19a–T19f shipped together in `246d3fe`.

## Verification conventions (lessons learned)

- **Pin DB path in §5 commands that inspect SQLite schema.** `DatabaseService` resolves `sqlite:///applications.db` against the *current working directory*, so `cd backend && python …` and `cd repo-root && python …` write to different files. Future packets that include a `PRAGMA table_info(...)` or `.schema` step must either `export DATABASE_URL=sqlite:///$(pwd)/applications.db` first or sqlite3 the explicit absolute path. (Discovered while verifying T1.)

## Packet format conventions

Every packet contains:

1. **YAML frontmatter** — task ID, single-writer file(s), depends_on, status, dispatchable gate.
2. **§1 Purpose** — one paragraph; why this task exists.
3. **§2 Single-writer scope** — exactly which file(s) the agent owns.
4. **§3 Exact deliverables** — code blocks, file paths, line numbers where relevant.
5. **§4 Do NOT touch** — the most important section. Explicit "do not"s prevent accidental scope creep.
6. **§5 Verification** — concrete shell commands the agent must run and report results from.
7. **§6 Definition of Done** — green checklist for review.
8. **§7 After-the-fact note** — what the orchestrator dispatches next.

## Why the "Do NOT touch" lists are aggressive

Downstream agents have the entire repo at their fingertips and a strong tendency to "fix" adjacent code they perceive as messy. In an orchestrated multi-agent run, that tendency causes:

- File collisions across "parallel" tasks (someone else was going to touch that file in the next task).
- Architectural drift (different agents picking different patterns for the same concern).
- Merge conflicts that cancel out the parallelism speedup.

The "Do not touch" lists are guardrails, not insults. They're how we preserve the property that lets the orchestration graph actually run in parallel.

## Reviewer checklist (per PR)

- [ ] `git diff --stat` matches the single-writer scope in §2.
- [ ] All §5 verification commands ran and pass (paste outputs in PR body).
- [ ] No imports from forbidden modules (cross-check with §4).
- [ ] No new files outside the packet's scope.
- [ ] No edits to files in §4's "Do not touch" list.
