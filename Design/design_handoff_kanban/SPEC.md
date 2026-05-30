# Kanban / Pipeline Board — Specification

## Stage model

Same as today, with one addition: `Inbox`.

```js
const KANBAN_COLUMNS = [
  'Inbox',         // NEW — pre-pipeline triage for fresh extension captures
  'Saved',
  'Generated',
  'Applied',
  'Interviewing',
  'Decision',
  'Accepted',
];

const TERMINAL_COLUMNS = ['Rejected', 'Declined', 'Withdrawn'];
```

- `Inbox` is the leftmost stage. Applications captured via the browser extension land here unanalyzed. Moving Inbox → Saved is the user's first triage step.
- Terminal stages are NOT in the main column list. They live in a single "End states" spine at the right edge.

### Substages per stage

(Reuse the existing substage model; this list is the visual count for the substage progress dots/bar.)

```js
const SUBSTAGE_COUNTS = {
  Inbox:        0,
  Saved:        5,  // Analysis · Reviewed · Network · Research · Prioritize
  Generated:    4,  // Resume · Cover Letter · Tailoring · QA
  Applied:      4,  // Submitted · Confirmation · ATS Pass · Recruiter Reach
  Interviewing: 5,  // Screen · Tech 1 · Tech 2 · Onsite · Debrief
  Decision:     5,  // Offer Pending · Negotiation · References · Background · Sign
  Accepted:     5,  // Offer Signed · Start Date · Onboarding · Equipment · Day 1
};
```

The card needs `sub_stage_index` (0-based) on each app. If the data layer already exposes this, use it. If not, fall back to 0 and add a TODO.

---

## Layout — Focus + Spines

The board is a single horizontal flex row inside the dashboard content area.

```
┌── Page header (Pipeline · stat strip) ────────────────────────────────┐
├── Filter bar (search · filter chips · sort · density toggle) ─────────┤
├── Focus row ──────────────────────────────────────────────────────────┤
│ [ FOCUS COLUMN (wide, flex: 1) ] [spine][spine][spine]…[end-spine]    │
│                                                                       │
│   ── OR, if focus is Inbox: ──                                        │
│ [ INBOX FOCUS (amber) ] [Saved spine][Gen spine]…[end-spine]          │
│                                                                       │
│   ── OR, if focus is end-states: ──                                   │
│ [Inbox spine][Saved spine]…[Accepted spine] [ END-STATE FOCUS (muted)]│
└───────────────────────────────────────────────────────────────────────┘
```

### Spines (collapsed columns)
- Width `88–96px`, full-height.
- Top: stage icon (Material Symbols), large count number, vertical writing-mode stage label.
- Body: stacked mini-thumbnails of cards in the stage. Each thumbnail shows company name, score number with score-color dot, and stars if `> 0`.
- Show first 8 thumbnails, then `+N` overflow indicator.
- Hover: subtle highlight; cursor pointer.
- Click anywhere on a spine → that stage becomes the focus.

### Focus column
- `flex: 1, min-width: 0`, fills remaining horizontal space.
- Header: stage icon (filled, primary-tinted), stage label (h3), application count subtitle, helper text on the right ("Drag cards to spines to move stage" etc.).
- Body: CSS grid `repeat(auto-fill, minmax(280px, 1fr))` with `10px` gap. Each cell renders the card.
- Empty state: full-bleed empty card (see below).

### Inbox focus (special)
Same shape as a regular focus column, but with these overrides:
- 3px amber top border, amber-tinted icon background, amber sub-label pill "TRIAGE".
- Helper text: "Run analysis, then move to Saved".
- Subtitle reads "N new captures · awaiting triage" instead of "N applications · focused stage".

### End-states focus
Renders at the right edge (where the end-states spine normally lives, NOT at the left). Same shape as a regular focus column but:
- Dashed border, slate top-rule (`3px` solid `--text-faint` equivalent), diagonal hatch background.
- Header label: "End states" with sub-label pill "CLOSED".
- Header right: tabs for `Rejected | Declined | Withdrawn`, each with a count pip. Active tab = filled with `--error` background. Plus a small `×` close button that returns focus to Inbox.
- The body grid shows only the apps in the active tab's terminal stage.

### End-states spine
Visible when no end-state is focused. Same shape as a regular spine but:
- Dashed border, slate top-rule, diagonal hatch background.
- Three stacked tiles (one per terminal stage) inside the body, each clickable to refocus to that specific terminal stage.

---

## Cards

Use the **Standard** variant for normal density (matches comfy density on the prototype).

```
┌──────────────────────────────────────────┐
│ [logo] COMPANY            [score chip]   │ ← row 1
│                                          │
│ Senior Lead Software Architect           │ ← title (2-line clamp)
│                                          │
│ 💵 $240k–$310k · ★★★                    │ ← salary + interest stars
│                                          │
│ ● ● ● ◐ ○  3/5    [docs dots]            │ ← substage progress + docs status
│                                          │
│ ───────────────────────────────────       │
│ ⚡ Ready to generate                      │ ← next-action hint footer
└──────────────────────────────────────────┘
```

### Card states
- Default — `--bg-card` background, `--border-color-card` border, `12px` padding.
- Hover — border darkens, 1px lift (`translateY(-1px)`), shadow appears, cursor grab.
- Dragging — `rotate(-1deg) scale(1.02)`, pop shadow, cursor grabbing, z-index lifted. The dragged card stays visible in its source position at reduced opacity OR is hidden — either is fine; the existing code hides it, keep that.
- Selected (multi-select) — `2px` `--primary` ring on the outside (not replacing the border).

### Card pieces

**Logo** — `28×28`, `7px` radius, fallback to company initial in 11px 800-weight on `--bg` background.

**Company line** — `11px`, `700`, `--text-secondary` (muted), uppercase, `0.04em` letter-spacing, single-line truncate.

**Score chip** (right edge of row 1) — small pill:
- Score ≥ 85 → green chip (`--success` family)
- 70–84 → blue chip (`--primary` family)
- < 70 → amber chip (`--warning` family)
- `2px 7px` padding, pill radius, `11px` 800-weight, tabular numerals.

**Title** — `13px`, `700`, `--text-primary`, `line-height: 1.3`, `-webkit-line-clamp: 2`.

**Meta row** — `11px`, `600`, `--text-muted`:
- Salary in `--success` color, 11px 700, with a 11px `payments` icon. If `salary === '—' || 'Not Listed'` → render "Not listed" in `--text-dim` 600-weight (un-tinted).
- `·` separator in `--text-faint`.
- Interest stars: 3 stars, `11px`, amber filled / faint outline.

**Substage progress dot row** — for the current stage:
- N dots (N = substage count for the stage).
- First `sub_stage_index` dots filled (`--primary`).
- The dot at `sub_stage_index` itself has a glow ring (`box-shadow: 0 0 0 2px primary-soft`).
- Remaining dots empty (`--line-strong`).
- Followed by tiny `N/M` label in 10px 700 mute.

**Docs row** — three squares (`14×14`, `4px` radius) for resume / cover letter / context:
- State `ok` → green tint (`--success-soft` bg, `--success` icon)
- State `attention` → amber tint
- State `missing` → red tint
- Material Symbols glyphs at `9px`: `description`, `mail`, `folder`.

**Next-action hint footer** — top dashed border, `6px` padding-top, 6px gap:
- Filled `bolt` icon in `--primary`, `11px`.
- 11px 600 `--text-muted` hint text, single-line truncate.

Hint comes from the existing data (`next_action` or similar field). If the app doesn't have one, hide the footer.

---

## Filter / sort bar

Sits between the page header and the focus row.

- **Search input** — `240px` wide, with `search` icon left, `⌘K` shortcut hint right. Placeholder: `Search N applications…`.
- **Filter chips** — `Company`, `Score · 70+`, `Interest`, `Last 30 days`, `Source`. Active chips get the `--primary-soft` bg / `--primary` border treatment with an inline `×`. "+ Add filter" chip in dashed style at the end.
- **Filtered count** (right side, only when filters narrow results): `<n> of <total> · clear`.
- **Sort dropdown** — default value: **`Last activity`**. Other options: Score, Posted date, Company, Interest. Renders as a small button with a `swap_vert` icon.
- **Density toggle** — 3-segment toggle: `density_small` (compact) / `density_medium` (comfy, default) / `density_large` (cozy). Persists to localStorage.

---

## Interactions

### Drag-and-drop

Use the existing HTML5 DnD wiring in Dashboard.jsx — `onDragStart`, `onDragEnd`, `onDragOver`, `onDrop`, `onCardDragOver`, `onDragLeave`. Wire it onto:
- Each spine (entire spine is a drop target)
- The focus column body (grid is the drop target)
- The end-states focus column (each tab + the body)

#### Drop-target tints
- **Forward move** (current stage index < target stage index) — `--primary` ring + soft gradient bg.
- **Back-move** (target stage index < current stage index) — `--warning` ring + soft amber gradient bg.
- **Into a terminal stage** — `--error` ring + soft red gradient bg.

Stage index for ordering: `KANBAN_COLUMNS.indexOf(stage)`. Terminal stages are always "danger" regardless of source.

#### Commit semantics
- **Forward** — commit immediately via `onUpdate(app.id, { status: targetStage, kanban_order: index })`. No prompt.
- **Back-move** — commit optimistically AND show a toast with Undo (5s countdown). If Undo clicked within 5s, revert. Toast text: `Moved <Company> · <Role> back to <Stage>`. See `KToast` in `prototype/kanban-primitives.jsx` for visual.
- **Into a terminal stage** — show a modal confirm. Title: `Mark this application as <Stage>?`. Body explains it leaves active pipeline. Cancel + danger-primary "Yes, mark as <Stage>". See `KConfirmModal` in `prototype/kanban-primitives.jsx`.

### Click card
Open job details via the existing `onViewApp(app)` handler.

### Multi-select
- `⌘/Ctrl + click` toggles a card's selection.
- When ≥ 1 selected, render the dark pill action bar at `bottom: 24px, left: 50%`:
  `<N> selected · <stage> ┃ Move to… ┃ Tag ┃ Mark rejected ┃ ×`
- "Move to…" opens a small menu of stages.
- "Mark rejected" triggers the same confirm modal as terminal drag, but with the selected count in the body summary.
- `Esc` clears selection.

### Keyboard
- `←/→` cycles focus between stages (focus spine ↔ adjacent stage's spine; focused stage's column maps to itself).
- `Enter` on a focused card opens it (same as click).
- `Space` on a focused card toggles selection.
- `Esc` closes any open modal / drawer and clears selection.

---

## Empty states (per column)

When a focused stage has no applications, render a centered empty card inside the focus grid (spanning all columns):

| Stage         | Title                       | Body                                                                          | CTA                  |
|---            |---                          |---                                                                            |---                   |
| Inbox         | No new captures             | Use the browser extension to scrape jobs directly into your inbox.            | Install extension →  |
| Saved         | Nothing saved yet           | Drop interesting jobs here from your inbox to start research.                 | —                    |
| Generated     | No materials drafted        | Move a saved job here to generate tailored resume + cover letter.             | —                    |
| Applied       | No applications sent        | Once you submit, drag the card here to start tracking responses.              | —                    |
| Interviewing  | No active interviews        | Cards arrive here when recruiters reach out or you book a screen.             | —                    |
| Decision      | No offers in flight         | Cards land here when an offer comes in or final-round happens.                | —                    |
| Accepted      | Nothing accepted yet        | When you sign, the role moves here for onboarding tracking.                   | —                    |

Spines never show empty states — a `0` count in the header is enough.

---

## Tokens used (mapped to existing `frontend/src/index.css`)

The prototype uses `--primary, --bg-card, --border-color-card, --text-primary, --text-secondary, --text-muted, --success, --warning, --error`, plus radii and shadows. All of these already exist in `frontend/src/index.css` — reuse them as-is. **Do not introduce new tokens.**

Variables referenced in `prototype/styles.css` like `--primary-soft`, `--warn-soft`, `--danger-soft`, `--line`, `--line-strong`, `--text-dim`, `--text-faint` map onto:

| Prototype name      | Use in app code                                                |
|---                  |---                                                             |
| `--primary-soft`    | `rgba(var(--primary-rgb), 0.10)` or `bg-primary/10`            |
| `--primary-edge`    | `rgba(var(--primary-rgb), 0.30)` or `border-primary/30`        |
| `--warn-soft`       | `rgba(245, 158, 11, 0.10)` (warning amber w/ low alpha)        |
| `--danger-soft`     | `rgba(239, 68, 68, 0.10)`                                      |
| `--success-soft`    | `rgba(16, 185, 129, 0.12)`                                     |
| `--line`            | `var(--border-color)`                                          |
| `--line-strong`     | `var(--border-color-input)`                                    |
| `--line-soft`       | `var(--border-color)` at half opacity                          |
| `--text-dim`        | `var(--text-muted)` at lower contrast                          |
| `--text-faint`      | `rgba(148, 163, 184, 0.4)`                                     |

Font stack stays **Inter** (already loaded). Don't introduce Manrope from the prototype.

---

## Theme parity

The dashboard supports light + dark via the existing toggle (whatever drives `[data-theme="dark"]` or the dark class on `<html>`). Both themes must work. The new column treatments (Inbox amber, end-states hatch+dashed) have dark-mode equivalents in `prototype/kanban.css` — adapt them to the codebase's existing dark-mode variables.

---

## Out of scope for this pass
- Mobile board (`ApplicationDetailMobile.jsx` is unaffected — that is the mobile job-detail screen, not a mobile board).
- Backend changes (no new fields, no API changes). If `Inbox` doesn't yet exist as a `status` value, decide between adding it to the enum or treating "newly captured with no analysis" as a derived state — but defer that decision to the implementer.
- Analytics page integration.

---

## Files in `prototype/`

| File                     | What it is                                                                       |
|---                       |---                                                                               |
| `Kanban Board.html`      | Entry point. Open in a browser to see all three layouts on a canvas.             |
| `kanban-layouts.jsx`     | The three layout components — only `KanbanFocus` is the chosen direction.        |
| `kanban-primitives.jsx`  | Card variants, column head, filter bar, page head, modal, toast, bulk bar, empty.|
| `kanban-data.jsx`        | Mock data + stage definitions. **Replace with the live data layer.**             |
| `kanban.css`             | All kanban-specific styles. Port to the codebase's CSS approach.                 |
| `styles.css`             | Tokens / primitives from the existing Job Details work. Read for token names.    |
| `shared.jsx`             | Shared primitives (`Icon`, `ScoreRing`, `InterestStars`). Look for equivalents.  |
| `kanban-app.jsx`         | Canvas / Tweaks composition — **scaffolding only, do not ship**.                 |
| `design-canvas.jsx`      | Pan/zoom canvas chrome — **scaffolding only, do not ship**.                      |
| `tweaks-panel.jsx`       | Tweaks panel chrome — **scaffolding only, do not ship**.                         |
