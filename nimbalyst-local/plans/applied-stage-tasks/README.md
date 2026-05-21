# Applied Stage — Task Packets

Per-task briefs for the Applied stage initiative. Each packet is the **complete prompt** a downstream coding agent receives. The parent plan is at `../applied-stage.md` (see §13 for the normalized graph).

## Dispatch order

### Phase A — Foundations (strictly sequential)

| Order | Packet | After | Status |
|---|---|---|---|
| 1 | [T1 — Schema + SQLAlchemy model deltas](T1-schema-migrations.md) | — | ready, awaiting user review before dispatch |
| 2 | [T2 — Pydantic contracts](T2-pydantic-models.md) | T1 merged | staged |
| 3 | [T3.0 — Service package skeleton](T3.0-service-skeleton.md) | T2 merged | staged |
| 4 | [T4.0 — Router scaffolding + main.py mount](T4.0-router-wireup.md) | T3.0 merged | staged |

### Phase A2 — Service modules (one agent per file; priority-ordered dispatch)

T4.0 has merged. Dispatch in priority order; T3a–T3e first, then T3f/g/h.

| Priority | Packet | Owns | Depends on | Unlocks |
|---|---|---|---|---|
| 1 | [T3a — Derivations (pure)](T3a-derivations.md) | `services/applied/derivations.py` | T1, T2, T3.0 | T3b, T3c, T3d, T3e, T3h, T8, T13a |
| 2 | [T3b — State assembly](T3b-state.md) | `services/applied/state.py` | T3a | T5, T12 |
| 3 | [T3c — Submission service](T3c-submission.md) | `services/applied/submission.py` | T3a | T6 |
| 4 | [T3d — Confirmation + receipt](T3d-confirmation.md) | `services/applied/confirmation.py` | T3a | T7a, T7b, T16 |
| 5 | [T3e — Follow-up plan + send-log](T3e-follow-up.md) | `services/applied/follow_up.py` | T3a | T9a, T9b, T14, T17 |
| 6 | [T3f — Templates (deterministic v1)](T3f-templates.md) | `services/applied/templates.py` | T3.0 (no T3a dep) | T10, T17 |
| 7 | [T3g — Contact upsert](T3g-contact.md) | `services/applied/contact.py` | T3.0 (no T3a dep) | T11, T17 |
| 8 | [T3h — Transition to Interviewing](T3h-transition.md) | `services/applied/transition.py` | T3a | T13b, T18 |

### Phase B — Endpoints (cap 4–6 concurrent per user guidance; packets pending)

After T4.0 merges and the respective T3* lands: T5, T6, T7a, T7b, T8, T9a, T9b, T10, T11, T12, T13a, T13b.

### Phase C — Automation (packet pending)

T14 after T3a + T3e merge.

### Phase D — Frontend (packets pending)

T15.0 first (single-writer refactor on `ApplicationLifecycle.jsx`), then T15–T18 in parallel.

### Phase E — Tests (packets pending)

T19a–T19f, each parallel after its dep.

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
