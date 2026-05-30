# Integration Prompt — Job Details Mobile

Paste the prompt below into Claude Code (with this `handoff_mobile/` folder somewhere it can read, and your `JobApplicationAutomator/` repo as the working directory).

---

## Prompt

I'm adding a mobile/phone variant of the **Job Details** screen (`frontend/src/pages/ApplicationDetail.jsx`). The design lives in `handoff_mobile/` — open `Job Details Mobile.html` to see the prototype, read `README.md` for the design-decision rationale before you write any code.

### Repo context (don't make me repeat this — verify by reading)

- Stack: **Vite + React 19**, no styling framework actively used (Tailwind 4 is installed but the existing detail page uses CSS variables + inline styles).
- Theme: `:root[data-theme="light"|"dark"]` on `<html>`. Token names: `--primary` (#256af4), `--bg`, `--bg-card`, `--border-color`, `--border-color-card`, `--text-primary`, `--text-secondary`, `--text-muted`, `--primary-glow`, etc. — see `frontend/src/index.css`.
- The desktop screen is `frontend/src/pages/ApplicationDetail.jsx` (~2277 lines). It already has `@media (max-width: 768px)` blocks but they only tweak desktop layout — **there is no real mobile experience yet**.
- Existing components you must reuse:
  - `frontend/src/components/InterestStars.jsx`
  - `frontend/src/components/PipelineProgressBar.jsx` (exports `STAGE_TO_STATUS`)
  - `frontend/src/components/VerticalPipelineRail.jsx`
  - `frontend/src/pages/ApplicationLifecycle.jsx` (exports `computeStageProgress`)
  - `frontend/src/components/CompanyResearchViews.jsx` and any other primitives already in `components/`
- Stage data + commit handlers live in `ApplicationDetail.jsx` and `ApplicationLifecycle.jsx`. **Read them first** — do not invent a parallel state model.

### Scope

Port **only** these two files from the design spec, adapted to our conventions:
- `handoff_mobile/variation-a-mobile.jsx` → new `frontend/src/pages/ApplicationDetailMobile.jsx` (or co-located components)
- `handoff_mobile/mobile.css` → either appended to `frontend/src/index.css` under a clearly-marked `/* === Job Details Mobile === */` block, or as a new `ApplicationDetailMobile.css` import. Match whichever the rest of the codebase prefers (look at `Dashboard.css`, `ProcessVisualization.css`).

**Do not port** any of these — they're prototype scaffolding only: `app.jsx`, `mobile-app.jsx`, `design-canvas.jsx`, `tweaks-panel.jsx`, `ios-frame.jsx`, `Job Details Mobile.html`, the `shared.jsx` mock data.

### Token mapping (prototype → real)

The prototype uses CSS variables that don't all exist in our codebase. Map them as you port:

| Prototype | Use in our app |
|---|---|
| `--bg` | `--bg` if defined else fall back to `--bg-card` 1-level darker (check `index.css` lines 1-100 for what's there) |
| `--bg-card` | `--bg-card` ✓ |
| `--bg-hover` | inline `rgba(255,255,255,0.04)` dark / `rgba(15,23,42,0.04)` light |
| `--line` | `--border-color` |
| `--line-strong` | `--border-color-input` |
| `--txt` | `--text-primary` |
| `--txt-2` | `--text-secondary` |
| `--txt-mute` | `--text-secondary` |
| `--txt-dim` | `--text-muted` |
| `--primary`, `--primary-soft`, `--primary-edge` | `--primary`, `rgba(var(--primary-rgb), 0.10)`, `rgba(var(--primary-rgb), 0.25)` |
| `--success`, `--success-soft` | use existing if defined; else `#10b981` and `rgba(16,185,129,0.12)` |
| `--warn`, `--warn-soft` | `#d97706` and `rgba(217,119,6,0.12)` |
| `--danger`, `--danger-soft` | `#dc2626` and `rgba(220,38,38,0.12)` |
| `--shadow-card` | reuse whatever card-shadow var exists, or `0 1px 2px rgba(0,0,0,0.04)` |

Check `frontend/src/index.css` :root and `:root[data-theme="light"]` for what's already defined before adding new tokens. If something's missing, add it to both theme blocks rather than hardcoding values.

### Steps

1. **Read first, write second:**
   - `handoff_mobile/README.md` (the "Design decisions worth preserving" section is the contract).
   - `handoff_mobile/variation-a-mobile.jsx` and `handoff_mobile/mobile.css` end-to-end.
   - `frontend/src/pages/ApplicationDetail.jsx` (skim — focus on how state is loaded, the data shape of an application record, where pipeline-stage mutations happen).
   - `frontend/src/pages/ApplicationLifecycle.jsx` (where `computeStageProgress` and substage logic live).
   - `frontend/src/index.css` :root tokens.

2. **Decide the routing pattern.** I want this to be a conditional render in `ApplicationDetail.jsx` based on viewport width — when `window.innerWidth <= 768`, render `<ApplicationDetailMobile />` instead of the desktop tree. Use a small `useIsMobile()` hook with a 768px breakpoint + a resize listener. (Don't split into a separate route — the URL should be unchanged.)

3. **Build `ApplicationDetailMobile.jsx`.** Translate the prototype 1:1 in structure. The component should accept the same props/context the desktop view uses and read the *same* application record / pipeline state. The internal sub-components from the prototype (`NextHint`, `StagePreviewCard`, `ConfirmModal`, the substage content blocks) can stay co-located in the file or split — your call.

4. **Wire to real state, not mocks:**
   - `currentStageIdx` ← derive from the application record's actual stage field (look at how `ApplicationLifecycle.jsx` does it; reuse `computeStageProgress` if it fits).
   - `previewIdx` ← local component state, initialized to `currentStageIdx`. Pure UI.
   - The substage content blocks (`AnalysisContentMobile`, `ReviewedContentMobile`, etc.) should pull from the same data sources the desktop substages use — don't duplicate the prototype's hardcoded values.
   - The 3 docs cards bind to the application's actual document state (resume / cover letter / etc.).

5. **Wire the three commit paths to real mutations:**
   - **Forward (sticky bottom CTA):** call the same handler the desktop "Generate Application" button calls.
   - **Rollback (past-stage preview → confirm modal → mutate):** must go through `ConfirmModal`. Dispatches a stage-set mutation with whatever your "set application stage" API expects. Preserve any history/audit logging the desktop flow does.
   - **End state (sheet → end-state button → confirm modal → mutate):** same pattern, terminal stage. Make sure the kanban / dashboard reflects the new status afterwards.

6. **Bottom sheet + confirm modal — accessibility:**
   - Sheet: focus trap, Esc closes, backdrop tap closes, `aria-modal="true"`.
   - Confirm modal: focus trap, Esc cancels, `role="dialog"` + `aria-modal="true"`, focus the Cancel button on open (not the destructive button).
   - Progress dots are `<button role="tab">` inside a `role="tablist"` — preserve.
   - Substage tabs: keyboard arrow navigation between pills (don't break it with the click-drag handler).

7. **Theme.** Read the active theme from `document.documentElement.getAttribute('data-theme')` or subscribe via `MutationObserver` if needed. The mobile shell doesn't set the theme itself; it inherits.

8. **Tests** (Vitest / whatever you use):
   - Tapping a stage dot updates `previewIdx` but does NOT call any stage-mutation API.
   - Rollback button only renders when previewing a past stage.
   - Rollback and end-state both render `ConfirmModal` before mutating.
   - Forward CTA mutates immediately (no confirm).
   - The 768px breakpoint actually swaps the rendered component.

### Things explicitly out of scope

- Don't touch the desktop view — mobile sits beside it.
- Don't introduce a new dependency (no `framer-motion`, no `react-modal`, no headlessui). The prototype is dependency-free; keep it that way.
- Don't generalize `ConfirmModal` into a global modal yet. Keep it scoped to this feature.
- Don't add icons or copy that aren't in the spec. The top bar is Back / breadcrumb / overflow — nothing else.
- Don't change the desktop `<VerticalPipelineRail>` to share with mobile. They diverge enough that sharing would couple them awkwardly; the small duplication is fine.

### When you're done

Reply with:
1. The diff (or list of changed files).
2. A screenshot of the mobile view at 402×874 in the dev server, dark mode.
3. Any spec deviations + rationale.
4. Any reused-component gotchas (e.g. if `InterestStars` needed a `size` prop you had to add).
