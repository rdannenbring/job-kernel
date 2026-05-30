# JobKernel — List View redesign · Claude Code handoff

You are updating the **List view** on the Dashboard of the JobKernel app to a new design called **Pulse**. The current List view (in `frontend/src/pages/Dashboard.jsx`, search for `viewMode === 'list'`, ~line 968) is a stack of horizontal cards. You're replacing the content of that branch — not touching Kanban, not touching Table.

## Source of truth

Everything you need is in `handoff_list_view/design_reference/`. Treat these as the **definitive design**, not as code to copy verbatim — they were authored as a Babel-in-browser prototype. Your job is to port the design into the production stack (Vite + React + Tailwind + the existing tokens in `frontend/src/index.css`, `App.css`, and the `glass-panel` / `var(--primary)` / `var(--bg-card)` / `var(--border-color)` system already in use).

Files to read end-to-end before writing code:

| File | What's in it |
|---|---|
| `Job List.html` | Entry point — open in a browser to see the full design canvas. |
| `list-pulse.jsx` | **Pulse layout** — the chosen direction. Contains `ListPulse`, `PulseRow`, `PulseExpand`, `DayBand`, group-by logic, the group-by popover menu. |
| `list-shared.jsx` | Shared list primitives: `ListToolbar`, `ListHead`, `ListRow`, `ListCheckbox`, `ScoreCell`, `ScoreMini`, `StageCell`, `PipelineStrip`, `DocsCondensed`, `DocsTextForward`, `StarsInline`, `HintCell`, `QuickActions`, `SalaryCell`, `ViewSwitch`. **`L_COLUMNS` is the canonical column model.** |
| `list-states.jsx` | All interaction-state artboards: `StateHover`, `StateSelection` + `BulkBar`, `StateStagePopover`, `StateConfirmModal`, `StateColumnManager`, `StateStickyLoading`, `StateEmpty`, `StateLoading`, `StateError`, `StateShortcuts`. |
| `list.css` | All list-specific styles. Built on the existing token system — **no new tokens were introduced**. |
| `styles.css` | The existing JobKernel design tokens this design depends on (primary, slate scale, success/warn/danger soft pairs, line variants, radii, shadow-pop). Most are already in the production app — confirm before adding. |
| `shared.jsx` | Reusable primitives the prototype borrows (`Icon`, `CompanyLogo`, `InterestStars`, `StatusPill`, `DocsCluster`, `AppShell`). **The production app already has equivalents** — see "Component mapping" below. |
| `kanban-data.jsx` | Mock dataset shape — useful only as a reference for what fields each row needs. |
| `list-classic.jsx`, `list-grouped.jsx` | Earlier alternates. **Do not port these.** Kept only for context if you need to lift small moves. |

## Mapping to the existing codebase

The new design integrates with what's already there. Use the production primitives wherever they exist:

| Prototype primitive | Use this in production |
|---|---|
| `<Icon name="..." size=14 />` | `<span className="material-symbols-outlined" />` (the app's existing pattern) |
| `K_STAGES`, `STAGES`, stage IDs `saved`/`generated`/... | `KANBAN_COLUMNS`, `TERMINAL_COLUMNS`, `STAGE_ICONS`, `SUBSTAGE_COUNTS` from `frontend/src/components/Kanban/stages.js` |
| `K_END_STAGES` | `TERMINAL_COLUMNS` |
| `K_SCORE_TINT(score)` | `getScoreTint(score)` from `Kanban/stages.js` |
| `app.co`, `app.role` | `app.company`, `app.job_title` |
| `app.score` | `app.match_score` |
| `app.stars` | `app.interest_level` (string: 'High'/'Medium'/'Low'/'None' → 3/2/1/0 — see `InterestStars.jsx`) |
| `app.stage` (lowercase id) | derived via `deriveStage(app)` (returns title-cased label — lowercase it for comparisons) |
| `app.sub` (number 0..stage.subCount) | derive from `app.substage_progress` or `app.pipeline_substage` — see existing kanban Card.jsx for how it's computed today |
| `app.hint` | derive from stage — there's already a "next action" string elsewhere; if not, derive from `(stage, substage, last_activity_at)` |
| `app.docs` `{resume, cover, ctx}` with values `ok`/`attention`/`missing` | derive from `app.resume_changes_summary`, `app.cover_letter`, `app.company_research_summary` — `ok` if present, `missing` if absent, `attention` if stale > 7 days |
| `app.posted` ("3d", "2w") | format `lastActivityDate(app)` or `app.date_saved` as relative time |
| `app.salary` | `app.salary` (string) — preserve "Not Listed" → "—" treatment |
| `app.loc` | `app.location` |
| `app.init` (2-letter initial) | `app.company.slice(0,2).toUpperCase()` — keep `app.company_logo` as the preferred display (the current List view's logo handling is good — keep it) |
| `<InterestStars value={n} onChange />` (prototype) | the existing `<InterestStars level={...} />` in `frontend/src/components/InterestStars.jsx` — extend it to support inline-edit if it doesn't already |
| `AppShell` wrapper | not needed — the new List sits inside Dashboard.jsx's existing layout (header + toolbar are already rendered by Dashboard above the view-switcher branch) |

**Important — do not duplicate the toolbar.** The Dashboard.jsx file already renders a toolbar above the view switcher (search, filters, sort) for non-Kanban modes. **Reuse that bar.** The Pulse mock's `ListToolbar` is a *visual reference for what controls exist* (search, preset chips, Group-by, Columns, Density, Add job). Port any controls that are missing from Dashboard.jsx's existing toolbar into the existing toolbar — don't render two bars.

## What to build

### 1. Replace the `viewMode === 'list'` branch in `Dashboard.jsx`

Today's list is a stacked card list (`processedApps.map(app => <div className="glass-card ...">)`). Replace the inner JSX with the Pulse layout.

### 2. Create new files under `frontend/src/components/List/`

```
components/List/
├── index.jsx              # <ListView apps={...} onViewApp onUpdate /> — entry point
├── ListView.jsx           # Pulse layout — flat list + grouped renderer
├── ListRow.jsx            # The Pulse row (company · pipeline strip · score · salary · stars · docs · hint · quick actions)
├── ListHeader.jsx         # Sticky column header w/ sort affordance
├── PipelineStrip.jsx      # The horizontal mini-stepper used in the Stage cell
├── ScoreMini.jsx          # Compact ring score badge
├── DocsCluster.jsx        # Condensed icon trio + text-forward variant (use existing DocsCluster if present)
├── GroupByMenu.jsx        # Dropdown menu — 7 modes (Urgency / Stage / Interest / Location / Next action / Source / Flat)
├── GroupBand.jsx          # Sticky group-header band (count, median score, collapse chevron)
├── PulseExpand.jsx        # Inline expand-in-place panel — compressed Job Details preview (3 cards)
├── BulkBar.jsx            # Sticky bottom bar shown when ≥1 row selected
├── StageEditPopover.jsx   # Inline stage popover (reuses confirm-modal logic from Kanban)
├── ColumnManager.jsx      # Show/hide + drag-reorder column popover
├── ShortcutsCheatsheet.jsx# `?` overlay
├── EmptyState.jsx
├── LoadingState.jsx       # Skeleton rows
├── ErrorState.jsx
├── useListState.js        # Hook: selection, sort, density, grouping, columns, focused row, expanded row
├── useGrouping.js         # Hook: groupBy mode → buckets builder for all 7 modes
├── useKeyboardNav.js      # j/k/Enter/x/e/// shortcuts wiring
├── columns.js             # Canonical column model (port from L_COLUMNS in list-shared.jsx)
└── List.css               # List-specific styles (port from handoff list.css, scoped under .jk-list)
```

Match the existing convention (kebab-style class names, Material Symbols, `var(--primary)` etc.). Tailwind utility classes are fine for layout glue but the bulk of styling should live in `List.css` mirroring `Kanban.kanban.css`.

### 3. Spec — what the List does

**Default state**
- Flat list, no grouping, sorted by score desc.
- Two-line density default (52px rows). Density toggle in the toolbar: 1-line / 2-line / Roomy.
- Closed applications (Rejected/Declined/Withdrawn) dimmed inline at 0.55 opacity. A "Closed" preset chip in the toolbar can isolate them; a "Hide closed" toggle removes them entirely.

**Columns** (in order, all sortable except Docs / Next action / Select)

1. Select (checkbox · locked first column · 36px)
2. Company + role (logo + name; role under company name in 2-line mode · 260–280px)
3. Stage — **renders as a horizontal pipeline strip**, not a chip. 6 segments (one per active stage), filled up to current. Substage progress (`4/5`) appears as a label. Terminal stages render as a red full bar with the terminal label.
4. Score — `<ScoreMini />` (28px ring) + "vs avg ±N" delta in 2-line mode
5. Salary — chip (reuse `salary-chip` from styles.css)
6. Interest — 3 inline stars, click-to-edit, no navigation
7. Docs — condensed (3 small icon dots, color-coded ok/attention/missing) in compact density; text-forward (`3 ok · 2 todo`) in comfy+ density
8. Location
9. Added (relative time)
10. Next action — one-line hint with bolt icon (urgent in `inbox`/`saved`/`generated` stages), then quick-action buttons appear here on hover

Users can show/hide / reorder columns via the Column Manager popover. **Company column is locked.**

**Group-by — 7 modes**

The group-by dropdown sits in the toolbar. Modes:

- **No grouping** (default)
- **Urgency** — *Overdue · Today · This week · Awaiting response · Closed*. Band coloring: Overdue red, Today blue, Awaiting neutral, Closed muted. Bucket assignment derived from `(stage, last_activity_at, due_date)`:
  - Overdue = follow-up sent >5 days ago without reply, OR stage = `applied` with no activity in >7 days
  - Today = stage in `{inbox, saved, generated}` with substage incomplete (= user's move)
  - This week = stage in `{inbox, saved, generated}` not in Today
  - Awaiting = stage in `{applied, interviewing, decision}` and not Overdue
  - Closed = terminal stages
- **Stage** — one band per active stage + collapsed-by-default Rejected/Declined/Withdrawn bands. Hide the Stage *column* when grouped by stage (redundant).
- **Interest** — High / Medium / Low / None
- **Location** — alphabetical, "Remote" + "Hybrid" pinned to top
- **Next action** — Generate · Apply · Follow up · Schedule interview · Negotiate · Decide
- **Source** — Where the job came from (`app.source` or the URL hostname)

Each group band shows: collapse chevron · stage/group color dot · group name · count · median score · `+N need action` (when applicable) · "Add" button (active-stage groups only). Group state (collapsed/expanded) persists per user, per-mode.

**Row interactions**

- Click anywhere on the row body → navigate to `ApplicationDetail` via `onViewApp(app)`.
- Hover → reveal quick-actions at the end of the Next-action cell: open · change stage · archive · more.
- Click a chevron (Pulse row tail) → expand inline showing the compressed Job Details preview (`PulseExpand` — 3 cards: Compatibility, Saved-phase progress, Next action with CTAs).
- Click the stage cell's pipeline strip → opens the StageEditPopover anchored to that cell.
- Click a star → inline edit interest level — no navigation.
- Backward / terminal stage moves route through the **same confirm modal** as Kanban (reuse `components/Kanban/ConfirmModal.jsx`).

**Selection + bulk**

- Checkbox column; header checkbox = select-all-visible (indeterminate when partial).
- Sticky bottom bar (BulkBar) appears when ≥1 selected. Actions: Move stage · Add tag · Snooze · Archive · Export · Delete (danger). Selection persists across sort and across pagination boundary; cleared by close button.
- Bulk Move stage → confirm modal lists what will move and where, with rollback warning if any selected app is moving backward.

**Sort**

- Header click toggles asc/desc; arrow visible on hover and pinned when sorted.
- Sort state persists per-user (localStorage acceptable as a first cut; sync to backend later).

**Virtualization**

- Use `@tanstack/react-virtual` or equivalent. Sticky header stays mounted; group-band headers stay sticky inside the scroll container too (CSS `position: sticky; top: 36px;`).
- Footer shows "Loading 32 of 80" while fetching more. Skeleton rows appear at the bottom of the viewport.

**Keyboard shortcuts**

- `j`/`k` — next/previous row (focus ring on row)
- `Enter` — open focused row
- `x` — toggle select on focused row
- `e` — open inline edit (stage popover) for focused row
- `/` — focus search (in toolbar)
- `g` then `a`/`n`/`i`/`r` — jump to preset filter (Active / Needs action / Interviewing / Closed)
- `?` — show cheatsheet overlay
- `Cmd/Ctrl+A` — select all visible
- All shortcuts disabled while typing in an input.

**Empty / loading / error**

- Empty: a centered illustration + filter context ("You're filtering by 'Needs my action'…") + Clear filters + Add job CTAs.
- Loading: 9 skeleton rows with shimmer, opacity gradient top-to-bottom.
- Error: cloud_off icon, "Couldn't load — local changes saved, sync on reconnect", Retry + Work offline buttons.

**Light + dark theme**

- Inherit from the existing `[data-theme="dark"]` system. No new tokens. Verify every state in both themes.

**Saved filter presets**

- Ship 5 defaults: *Needs my action · Active · Awaiting response · High-score remote · Closed*.
- Users can save the current filter+sort as a preset; pin/unpin; rename; delete. Persist preset list per-user (localStorage first cut → backend in a follow-up).

### 4. Out of scope this PR

- Mobile list view (separate workstream).
- Saved-presets backend (localStorage only).
- Source field plumbing beyond URL-hostname fallback if `app.source` is missing.
- Replacing the existing Table view (`viewMode === 'table'`) — leave it alone.

## How to verify

1. Run the frontend (`npm run dev` in `frontend/`).
2. On the Dashboard, switch to **List** view. The Pulse layout should render with real data.
3. Verify in this order:
   - Rows render with pipeline strips reflecting actual stages.
   - Sorting by every column works and persists across reload.
   - Group-by — open the dropdown, switch through all 7 modes. Bands render with correct counts and median scores. Collapse/expand persists.
   - Selection — select one row → bulk bar appears. Select all → indeterminate state on header checkbox if rows partially selected.
   - Click a row → navigates to Job Details.
   - Click the inline-expand chevron → row expands with the 3-card preview.
   - Click a star → updates interest level via the existing onUpdate API.
   - Click a pipeline strip / stage cell → popover opens. Pick a non-current stage → confirm modal (for backward / terminal) or immediate change (for forward).
   - Toggle dark mode — every state looks correct.
   - Resize narrow (1024px) — columns truncate gracefully; quick actions still hover-revealable.
   - 80+ application count — scroll smoothly, sticky header + group bands stay pinned, skeleton rows appear at the bottom.

## Workstyle

- **Read first.** Open all files in `handoff_list_view/design_reference/` before writing any code. Open `Dashboard.jsx`, `Kanban/index.jsx`, `Kanban/ConfirmModal.jsx`, `Kanban/Card.jsx`, `InterestStars.jsx`, `Kanban/stages.js`, and `index.css` before touching anything.
- Match the existing code style: function components, `var(--*)` tokens, Material Symbols, kebab class names in CSS, Tailwind for layout glue. Keep imports sorted the way the rest of the app does it.
- Build incrementally — get the bare row + sticky header + sort working before grouping, before selection, before keyboard nav, before virtualization. Commit at each step.
- If a field doesn't exist on the app object (e.g. `due_date` for the Urgency bucketing), add a TODO comment and derive a sensible fallback from what's there. Don't invent backend fields.
- The Kanban view's BulkBar, ConfirmModal, FilterBar, and EmptyState already exist — **reuse them**. Lift them into a shared `components/common/` folder if needed.
- Ask before adding new dependencies. `@tanstack/react-virtual` is the only addition I'm pre-approving.

End state: the List view in Dashboard.jsx renders `<ListView apps={processedApps} onViewApp={onViewApp} onUpdate={onUpdate} />` and every behavior above works.
