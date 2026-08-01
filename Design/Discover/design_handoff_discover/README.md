# Handoff: Discover — Job Search & Listings

## Overview

**Discover** is JobKernel's job-search surface. The user runs a query across connected
external listing APIs (Adzuna · JSearch · TheMuse · RemoteOK), refines with filters, scans
results that are each **scored against their Profile**, and pulls the good ones into their
tracked pipeline. This handoff redesigns the existing Discover page so it feels like a
first-class JobKernel surface — a sibling to Pulse (list view), Job Details, and Profile.

The redesign keeps the current three-panel shell (saved-search rail · results · detail pane)
and the current behavior (Process Now / Save / Dismiss, saved searches, sources bar). It
upgrades information hierarchy, makes match-scoring the differentiator, adds source
transparency + graceful partial-failure handling, and ships strong empty/loading/zero states.

---

## About the design files

The files in this bundle are **design references created in HTML/CSS + React-via-Babel**.
They are prototypes that show the intended **look, layout, and behavior** — they are **not**
production code to copy verbatim. The Babel-in-browser setup, the `design-canvas.jsx`
(pan/zoom canvas), and `tweaks-panel.jsx` (the live knobs panel) exist **only to present the
design**; none of that should ship.

Your task: **recreate these designs inside JobKernel's existing React/Vite codebase**, using
its established component patterns, its real CSS-variable design tokens, and its real data
layer. JobKernel already has most of the primitives used here (see "Reuse what already
exists" below) — wire the new Discover-specific surfaces on top of them rather than
rebuilding the design system.

If a primitive named below doesn't yet exist in the codebase, build it to match the spec in
this README, drawing exact values from the design tokens section.

---

## Fidelity

**High-fidelity.** Final colors, typography, spacing, radii, and interaction states are all
specified. Recreate the UI faithfully using the codebase's existing libraries and tokens.
The mock job data (`search-data.jsx`) is illustrative — replace it with the real API/feed
data; do not ship the mock arrays.

---

## How to read the prototype

Open `Job Search Redesign.html`. It renders a **design canvas** with six labelled sections
(pan with space-drag, zoom with the controls, or open any artboard fullscreen). Each section
documents one facet of the feature:

| Section | What it shows |
|---|---|
| ① Discover — the direction | The full 3-column surface, live (driven by the Tweaks panel) |
| ② Layout variations | A: list + slide-in pane · B: split master/detail · C: grouped by match band |
| ③ Result row anatomy | The result row in 3 densities + deduped / saved / dismissed states |
| ④ Detail & preview | The slide-in detail pane + the inline row-expand alternate |
| ⑤ Filters & match threshold | Filter chip bar + the match-score threshold popover |
| ⑥ States | streaming · partial-source failure · saving→tracked · zero · no-query · no-sources |

The **Tweaks panel** (toolbar) toggles theme (light/dark), featured layout variant, density,
result state, match threshold, and pane behavior. These are presentation aids — the **real**
controls that should ship are: theme (already global in the app), density, the filter set,
and the match threshold filter.

### Recommended direction
The user selected **Variation A — list with an on-demand slide-in detail pane** as the
primary layout, with **drag-to-resize** on the pane. Variations B (split) and C (grouped) are
documented as alternates; build A first.

---

## Layout & shell

The Discover route lives inside the existing JobKernel app chrome: the **60px icon nav**
(left) + **48px topbar**. Discover is a **top-level destination** (its own nav item, the
`travel_explore` icon, active state). The topbar shows the breadcrumb `Dashboard / Discover`
and right-aligned: a List/Split view switch, a density button, and an Alerts button.

Below the topbar, the surface is a **CSS grid** that collapses gracefully down to ~1200px:

```
┌─────────┬───────────────────────────────┬──────────────┐
│  RAIL   │            MAIN               │  DETAIL PANE  │
│ 232px   │         minmax(0,1fr)         │  396px (def.) │
│ saved   │  query bar                    │  resizable    │
│ searches│  sources health strip         │  320–620px    │
│         │  filter chip bar              │  (slide-in)   │
│         │  ── results (scroll) ──       │               │
│         │  ResultRow …                  │               │
│         │  profile nudge                │               │
│ run all │                               │               │
└─────────┴───────────────────────────────┴──────────────┘
```

- **Grid templates** (`.dsc`):
  - rail + results: `232px minmax(0, 1fr)`
  - rail + results + pane: `232px minmax(0, 1fr) <paneW>px` (paneW default **396**)
  - split variant: pane default **440**, always docked
  - no rail (≤1200px collapse): drop the `232px` track first, then the pane becomes an
    overlay/drawer rather than a third column.
- Each of the three columns scrolls independently (`min-height: 0` on the grid children;
  `overflow-y: auto` on the rail list, the results region, and the pane body).
- **Responsive ≤1200px:** collapse the saved-search rail into a popover/drawer triggered from
  the toolbar; the detail pane becomes a right-hand overlay drawer instead of a grid column.
  (Mobile is a separate workstream — but these choices translate.)

---

## Screens / views (components)

### 1. Saved-search rail (`.dsc-rail`, left, 232px)

- **Header:** label "SAVED SEARCHES" (10px/800/uppercase/0.1em, `--txt-mute`) + a 24px square
  "new search" button (`+`, `--r-sm`, hover → primary).
- **List of saved-search items** (`.dsc-saved`): a 3-column grid `18px 1fr auto`, 9px gap,
  9–10px padding, `--r-md`. Each item:
  - **Icon** (16px, `--txt-dim`; primary + filled when active).
  - **Main:** name (13px/700, `--txt`), then a wrapped row of **mini chips** (`.dsc-mini`,
    10px/700 pills, `--bg` fill, `--line` border) previewing the query at a glance —
    keywords (search icon), location (location_on icon), and work-model. Below: "Last run Xh
    ago" (10px, `--txt-dim`). The "All results" item instead shows "{count} listings across
    all sources."
  - **Right:** a **fresh-count badge** (`.dsc-fresh`, primary pill, white text) when there are
    new matches since last run, and an **alerts bell** (`notifications_active` filled + amber
    when on; `notifications_off` + faint when off).
  - **Active state:** `--primary-soft` bg, `--primary-edge` border, name + icon in `--primary`.
- **Footer:** full-width "Run all now" button (`.dsc-runall`, bolt icon).

### 2. Query bar (`.dsc-query`, top of main)

Flex row, 8px gap, 14/20/10px padding, `--bg`:
- **Keywords field** (`.dsc-field.kw`, flex:1): search icon + input, placeholder "Keywords —
  role, skill, company".
- **Location field** (`.dsc-field.loc`, 220px): location_on icon + input, placeholder
  "Location (optional)".
- **Work-model selector** (`.dsc-model`): pill button "Any ▾" (home_work icon) → Any / Remote
  / Hybrid / Onsite.
- **Search button** (`.btn.btn-primary`, 38px tall).
- Fields are 38px tall, `--bg-input`, `--line` border, `--r-md`; **focus** → `--primary`
  border + `0 0 0 3px var(--primary-soft)` ring.

### 3. Sources health strip (`.dsc-sources`)

Inline flex row: label "SOURCES" + one **source pill** (`.dsc-src`) per connected integration:
- 7px status dot — green `ok`, amber `degraded`/`limit`, red `down` (down pills also get a
  dashed border + muted text).
- Source name + a count segment (`.dsc-src-n`, divided by a left border). When a source is
  `down`/`limit` the count slot shows the error message ("Upstream 503 — retrying", "Rate-
  limited · partial") in amber/red.
- Far right: a "Manage in Profile" link (settings icon) → Profile › Integrations.

### 4. Filter chip bar (`.dsc-filters`)

Bordered top+bottom, `--bg`. Flex-wrap row of pill controls:
- "More filters" trigger (tune icon) → opens an advanced-filters popover (role, seniority,
  date posted, salary band, source multi-select). *(The advanced popover body is described in
  behavior; build it as a standard `.popover`.)*
- A vertical divider, then **active filter chips** (`.dsc-filter.has-value`): e.g. "Senior+",
  "$180k+", each with an `×` to clear; inactive ones (e.g. "Past 7 days", "All sources") are
  quiet.
- **Match-score threshold filter** (`.dsc-filter` + the `speed` icon): label "Match ≥ {n}"
  **plus the "Affects matching" chip** (see below). Clicking opens the **threshold popover**
  (`.thresh-pop`): a gradient track (amber→primary→success) with a draggable knob, a
  0/Stretch/Good/Strong/100 scale, an explanatory note ("Scores come from your Profile. A
  stronger profile raises every result's score."), and a "Hide results below threshold"
  toggle with a count of hidden results.
- Right side: result count (`.dsc-result-count`, check icon + "{n} results") and a **sort**
  control (`.dsc-sort`): Best match (default) / Newest / Salary.

### 5. Result row (`.dres`) — **the centerpiece; a Pulse-row sibling**

A 3-column grid `52px minmax(0,1fr) auto`, 14px gap, 14/20px padding, bottom hairline
(`--line-soft`). Anatomy left→right:

- **Score ring** (`.dres-score`): the existing `ScoreRing` component, 46px (comfy) / 38px
  (compact). Ring color by band: ≥80 success, ≥60 warn, else danger (matches the existing
  ScoreRing thresholds).
- **Body** (`.dres-body`, two lines):
  - **Line 1:** 30px company logo tile (`.dres-logo`, initials placeholder) · **title**
    (14px/700, `--txt`, ellipsis) · "· {company}" (12px/600, `--txt-mute`).
  - **Line 2** (`.dres-line2`, wrap, 8–12px gap): **work-model badge** · location (location_on
    icon + text) · **salary chip** (existing `salary-chip`; "Salary not listed" → `.is-unlisted`
    dashed variant) · **source badge** · **match band chip** (green "Strong match" ≥85 /
    blue "Good match" ≥70 / amber "Stretch", with the `auto_awesome` icon).
  - **Excerpt** (`.dres-excerpt`): 2-line clamp, 12px, `--txt-mute`. Hidden in compact density.
- **Right cluster** (`.dres-right`): posted-age (e.g. "2h") + actions:
  - Default: **Process** (primary, bolt — = Save to pipeline **and** kick off analysis) ·
    **Save** (secondary, bookmark_add) · **Dismiss** (ghost `×`, hover → danger).
  - Already-saved: a green "In pipeline" tag (no action buttons).
  - Dismissed: whole row at 0.5 opacity + a "Restore" button.

**Densities:** compact (9px pad, no excerpt, smaller ring/logo) · comfy (default) · relaxed
(18px pad).

### 6. Work-model badge (`.wm-badge`)

10px/800/uppercase pill: Remote → green-soft, Hybrid → primary-soft, Onsite → quiet/`--bg`.

### 7. Source badge & de-duplication (`.src-badge`, `.src-chiclet`, `.src-stack`)

- **Single source:** a chiclet (15px rounded square, brand color, 2-letter abbr) + the source
  name.
- **Deduped (same posting from multiple sources):** **merge into one row.** Stack up to 3
  chiclets (`.src-stack`, overlapping −6px, 2px card-colored ring) + "{N} sources" label;
  tooltip lists them. The detail pane shows the full provenance.
- **`// TODO: backend`** — the merge rule is not implemented here. Proposed: key on
  *(normalized title + normalized company + normalized location)* with fuzzy matching; keep
  the highest-quality/most-complete listing as the canonical record and attach the others as
  alternate sources. Confirm with backend.
- **Source brand colors:** Adzuna `#00a3a1` · JSearch `#6d5ae6` · TheMuse `#d6443c` ·
  RemoteOK `#2a2a2a` (`#4a4a4a` in dark). These are the **only** non-token raw colors in the
  design (brand identifiers, not UI chrome) — keep them as a small source-brand map.

### 8. Detail pane (`.dpane`, right, slide-in)

Header / scroll body / sticky footer:
- **Header** (`.dpane-top`): 44px logo · title (17px/800) + company · close button. Then a
  meta row: work-model badge · location · salary chip · "Posted Xh ago" chip.
- **Body** (`.dpane-body`, scrolls):
  - **"Why this matches you"** (`WhyMatch`) — **the differentiator.** A `ScoreRing` (56px) +
    band label + a "vs your avg ({S_PROFILE.avg})" delta chip; then **five dimension bars**
    (Core role / Experience / Education / Culture / ATS keywords, each `/20`, bar color by
    strength); then two notes — a green "what fits" (thumb_up) and an amber "the gap" (error);
    then a **primary nudge** ("Add X to your Profile skills to raise this match · Edit
    Profile →"). The section header carries the **"Affects matching" chip**.
  - **Listing source** (`.dpane-prov`): stacked chiclets + "Found on N sources — …" + an
    "Original" link to the source listing.
  - **Job description** (`.dpane-desc`): the listing body. *(In the prototype this is the
    excerpt + representative filler — render the real description HTML when wired.)*
- **Footer** (`.dpane-foot`, sticky): primary **"Save to pipeline"** (bolt) · "Open" · a
  dismiss icon button.
- **Resize:** a drag handle on the pane's **left edge** (`.dpane-resize`) — hover reveals a
  grip; drag to resize, **clamped 320–620px**. (In the prototype the drag math divides by the
  canvas zoom scale; in the real app, where there's no zoom transform, a plain
  `clientX`-delta resize against a width state is sufficient. Persist the chosen width per
  user.)

### 9. Inline row-expand (alternate to the pane)

The same WhyMatch + listing content can render **in place** below a row (`.dres-expand`,
2-col grid) instead of opening the pane — offered as an alternate interaction. Build the
slide-in pane first.

### 10. States (section ⑥)

- **Streaming / loading** (`.dsc-stream` banner + `.dsc-ghost` shimmer rows): results arrive
  **per source**. The banner shows each source with a spinner→check as it responds and a
  running "N results so far". Show 2–3 ghost rows while the first source is pending.
- **Partial-source failure:** one source `down` ≠ no results. Amber banner: "JSearch is down
  — showing 63 results from 3 of 4 sources. RemoteOK is rate-limited (partial)." + a "Retry
  JSearch" button. The sources strip reflects the same states.
- **Saving → tracked** (`.dsc-saving-row`): when the user saves/processes a result, the row
  morphs in place to a success state (green bg, "Saved to pipeline · Inbox", "Now tracked —
  running analysis…", "View in pipeline").
- **Zero results** (`StateZero`): query ran, nothing matched. Search-off icon, a headline
  naming the query + location, sub-copy, and **recovery chips** (Clear location · Lower match
  to ≥50 · Include Remote · Reset all filters) + a tip pointing to a broader saved search.
- **No query yet / first run** (`StateEmpty`): a guidance hero + three **method cards**
  (`.dsc-method`, lifted from Profile's `p-method`): Run a search (primary) · Open a saved
  search · Run all sources; plus recent-search chips.
- **No sources connected** (`StateNoSources`): warn-toned hero + 4 provider cards
  (disconnected) + a primary **"Manage integrations in Profile"** CTA → Profile › Integrations.
  (The connect flow itself already exists; just link to it.)

### 11. Profile nudge (`.dsc-profile-nudge`)

A footer banner under the results: "These scores reflect your Profile (82% complete). Adding
target compensation and 3 more skills could surface ~18 stronger matches." + "Improve
Profile" CTA. Reinforces that **improving the Profile improves results**.

---

## Interactions & behavior

- **Run search:** keywords + location + work-model + active filters → query all *connected*
  sources. Stream results in as each responds (don't block on the slowest). Update the sources
  strip live.
- **Sort:** Best match (default, by score desc) · Newest (posted date) · Salary.
- **Match threshold:** a filter floor (0–100). Results below it are hidden (with a count of
  how many). Default **70**.
- **Row click:** opens/updates the detail pane (slide-in variant) or expands inline (alternate).
- **Process Now:** saves the job into the pipeline (Inbox/Saved stage) **and** triggers the
  Job-Analysis step — the row shows the saving→tracked confirmation. Become a tracked
  application (the same entity Pulse/Job Details operate on).
- **Save:** adds to pipeline without auto-running analysis.
- **Dismiss:** hides the result (greyed, restorable; respect a "Show dismissed jobs" toggle).
- **Saved searches:** clicking one loads its query+filters and shows its results. The bell
  toggles **alerts** (notify on new matches). "New search" clears the form. "Run all now"
  re-runs every saved search.
- **Dedup:** merged rows show stacked sources; clicking still opens one canonical detail.
- **Partial failure:** show what succeeded; offer per-source retry; never blank the page
  because one source failed.
- **Transitions:** pane slide-in, ghost shimmer (`skl-shimmer`, 1.4s linear), spinner
  (`spin`, 0.9s linear), the status `dot.is-pulse` animation. Respect
  `prefers-reduced-motion`.
- **Theme:** full light/dark parity via the existing `data-theme` token system — every value
  below already has a dark variant.

---

## State management

Per the Discover view:
- `query`: `{ keywords, location, workModel }`
- `filters`: `{ role, seniority, datePosted, salaryMin, sources[], matchThreshold }`
- `sort`: `'match' | 'date' | 'salary'`
- `sources`: list of `{ id, label, state: 'ok'|'degraded'|'limit'|'down', count, latency, error? }`
  (drives the health strip; updated as each responds)
- `results`: listing records (see data shape below); derived `visible` = filtered by threshold
  + filters, sorted, **de-duplicated**.
- `activeId`: the result open in the detail pane (null = closed).
- `paneWidth`: persisted px width of the detail pane (320–620).
- `density`: `'compact'|'comfy'|'relaxed'` (persisted).
- `savedSearches`: `[{ id, name, keywords, location, workModel, threshold, alerts, lastRun, freshCount }]`
- `viewState`: `'results'|'streaming'|'partial'|'zero'|'empty'|'nosources'` (derived from
  query + source health + result count).

**Listing record shape** (mock in `search-data.jsx` → replace with API/feed):
```
{ id, title, company, companyInitials, logo?, location, workModel: 'Remote'|'Hybrid'|'Onsite',
  salary | 'Not Listed', source: <sourceId>, alsoSources: [<sourceId>...], posted,
  score (0–100), matchDimensions: [{name, score/20}], whyTop, whyGap,
  state: 'new'|'saved'|'dismissed', descriptionHtml }
```
`score` and `matchDimensions` come from the **Profile match algorithm** — the same engine
that powers Job Details' compatibility score. Anything new here vs. today's backend is flagged
`// TODO: backend` in the data file (the merge rule and the `also`/dedup field are the main
ones).

---

## Reuse what already exists

JobKernel already ships these — **reuse, don't rebuild.** (In the prototype they live in
`shared.jsx` / `styles.css` / `list.css`.)

| Need | Existing primitive |
|---|---|
| Match score ring | `ScoreRing` (and `ScoreMini` for tight spots) |
| Material icons | `Icon` (Material Symbols Outlined) |
| Salary chip | `.salary-chip` (+ `.is-unlisted`) |
| Status / band chips | `.chip` + `.chip-blue/-green/-amber/-red` |
| Buttons | `.btn` + `.btn-primary/-sm/-ghost/-danger/-icon` |
| Popovers | `.popover` + `.popover-item/-label/-divider` |
| Confirm modals | `.modal-card` / `.modal-bd` |
| Sticky band group headers | `.pulse-day` (used for the match-band grouping) |
| Row hover quick-actions, density model | from the Pulse list view (`list.css`) |
| "Affects matching" chip | `.match-chip` / `MatchChip` (from Profile) |
| Empty-state vocabulary | Profile's `p-method` cards, dropzone, ghost chips, guidance hero |
| App chrome | 60px icon nav + 48px topbar |

The only **new** CSS is `search.css` (the rail, query bar, sources strip, filter bar, result
row, detail pane, and Discover state surfaces). It adds **no new tokens** — everything derives
from `styles.css`.

---

## Design tokens

All values come from the existing JobKernel token set (`styles.css`, `:root` + `[data-theme="dark"]`).
**Do not introduce new raw colors** beyond the source-brand map.

### Color (light → dark)
- **Primary:** `--primary #256af4`; `--primary-soft rgba(37,106,244,.08)`→`.14`;
  `--primary-edge rgba(37,106,244,.18)`→`.35`
- **Surfaces:** `--bg #f1f5f9`→`#0a0f18` · `--bg-card #fff`→`#131c2b` ·
  `--bg-input #fff`→`#1a1f2e` · `--bg-hover #f8fafc`→`#1a2236` · `--bg-panel #e8edf3`→`#0b1220`
- **Lines:** `--line #e2e8f0`→`rgba(255,255,255,.07)` · `--line-soft #eef2f7`→`.04` ·
  `--line-strong #cbd5e1`→`.14`
- **Text:** `--txt #0f172a`→`#f1f5f9` · `--txt-2 #334155`→`#e2e8f0` ·
  `--txt-mute #64748b`→`#94a3b8` · `--txt-dim #94a3b8`→`#64748b` · `--txt-faint #cbd5e1`→`#475569`
- **Semantic:** `--success #059669`→`#10b981` (+ `--success-soft`) · `--warn #d97706`→`#f59e0b`
  (+ `--warn-soft`) · `--danger #dc2626`→`#ef4444` (+ `--danger-soft`) · `--info #3b82f6`
- **Source brand (only non-token colors):** Adzuna `#00a3a1` · JSearch `#6d5ae6` · TheMuse
  `#d6443c` · RemoteOK `#2a2a2a`/`#4a4a4a`(dark)

### Typography
- **Family:** Manrope (400/500/600/700/800/900), system-ui fallback. Base 14px.
- **Scale used:** pane title 17/800 · result title 14/700 · body/excerpt 12–13 · meta
  11–12/600–700 · labels 10/800 uppercase 0.1em · mini chips 10/700 · band/source 10/800.
- Tabular numerals (`font-variant-numeric: tabular-nums`) for scores, counts, salary, dates.

### Radius
`--r-sm 6 · --r-md 10 · --r-lg 14 · --r-xl 20 · --r-pill 999`

### Shadow
`--shadow-card` (resting) · `--shadow-pop` (popovers/modals) · `--shadow-blue` (primary buttons)

### Spacing
Row padding 14/20px (comfy), 9/20 (compact), 18/20 (relaxed). Grid columns: rail 232, pane
396 (split 440, range 320–620). Gaps 8–14px. Field height 38px.

---

## Assets

- **Icons:** Material Symbols Outlined (already used app-wide). Names used: `travel_explore`,
  `search`, `location_on`, `home_work`, `tune`, `speed`, `sort`, `bolt`, `bookmark_add`,
  `bookmark`, `bookmark_added`, `close`, `undo`, `check_circle`, `auto_awesome`, `payments`,
  `hub`, `schedule`, `notifications_active`/`_off`, `cloud_off`, `search_off`, `warning`,
  `progress_activity`, `refresh`, `open_in_new`, `insights`, `thumb_up`, `error`,
  `tips_and_updates`, `drag_indicator`, `settings`, `history`, `arrow_forward`/`_upward`.
- **Company logos:** real logos when available; otherwise an initials tile placeholder
  (`.dres-logo` / `.dpane-logo`). No hand-drawn SVG imagery.
- **No images** are bundled.

---

## Files in this bundle

**Design (recreate in the app — do not ship):**
- `Job Search Redesign.html` — entry; loads the canvas + all modules.
- `search.css` — **the only new stylesheet**; all Discover-specific surfaces.
- `search-data.jsx` — mock listings, sources, saved searches, score dimensions (replace with real data).
- `search-shared.jsx` — primitives: `SourceBadge`, `SourcesBar`, `SavedRail`, `QueryBar`,
  `FilterBar`/`ThresholdPopover`, `ResultRow`, `WhyMatch`, `DetailPane` (incl. resize), `ProfileNudge`, `MatchChip`.
- `search-discover.jsx` — the 3-column `Discover` surface, the 3 layout variants, streaming/partial banners, ghost rows.
- `search-states.jsx` — takeover states (empty / no-sources / zero).
- `search-app.jsx` — canvas + Tweaks wiring (presentation only — **discard**).

**Existing design-system context (already in the app — reference, don't duplicate):**
- `styles.css` — canonical tokens + buttons/chips/cards/popover/modal/score-ring/pipeline.
- `list.css` — Pulse list vocabulary (rows, densities, bands, toolbar, popovers, skeletons).
- `shared.jsx` — `Icon`, `ScoreRing`, `CompanyLogo`, `StatusPill`, `InterestStars`, app shell.

**Presentation-only scaffolding (never ship):**
- `design-canvas.jsx`, `tweaks-panel.jsx`.

---

## Build order (suggested)

1. Route + app-chrome integration (nav item, breadcrumb, topbar actions).
2. The 3-column grid shell + independent scroll regions + ≤1200px collapse.
3. `ResultRow` (reusing `ScoreRing`, `salary-chip`, chips) — the centerpiece. Get all three
   densities + saved/dismissed/deduped states right.
4. Query bar + sources health strip + filter chip bar + threshold popover.
5. Saved-search rail.
6. Detail pane (`WhyMatch` + provenance + description + footer) + drag-to-resize + slide-in.
7. States: streaming/partial/saving/zero/empty/no-sources.
8. Wire real data + the match-score engine; resolve the `// TODO: backend` dedup rule.
9. Layout variants B (split) and C (grouped) if/when prioritized.
