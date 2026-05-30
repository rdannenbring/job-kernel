# Handoff — Job Details Redesign (Variation A)

## What this is

A redesign of the **Job Details** screen in JobKernel, focused on solving the original "too much vertical space before content" problem. The current screen forces the user to scroll past a large header, documents section, and sprawling pipeline before they can see the work that needs attention. This design condenses all of that into a single header card and replaces the horizontal pipeline tree with a compact vertical rail.

## About these files

The files in this bundle are **design references created in HTML/JSX as a high-fidelity prototype** — they are not production code to copy directly. The JobKernel app already has its own React + Vite codebase (`frontend/src/pages/ApplicationDetail.jsx` and `ApplicationLifecycle.jsx`); the task is to **re-implement these designs into the existing codebase**, reusing existing components (e.g. `PipelineProgressBar`, `CompanyResearchViews`, `InterestStars`, `CustomDropdown`) and design tokens defined in `frontend/src/index.css` rather than copying any of the prototype CSS verbatim.

The Manrope font, the `#256af4` primary, the slate text scale, and the existing CSS variables (`--bg-card`, `--text-primary`, etc.) in `index.css` are the source of truth.

## Fidelity

**High-fidelity.** Pixel-level decisions (spacing, type sizes, weights, border-radius, exact colors) in this prototype should be matched in the React implementation. Where the existing app's design tokens differ slightly from the prototype's hardcoded values, prefer the **existing tokens** — the prototype was built against the same palette, so substitution should be near-lossless.

Both light and dark themes are supported. The app already has theming via `:root[data-theme="light"]` / default dark.

---

## Layout overview

The Job Details screen is composed of two top-level regions inside the main content area (to the right of the existing left nav and top breadcrumb bar):

1. **Header card** (top, full width) — identity, job meta, salary, interest, documents, "View full job details" action, match score
2. **Workspace** (below header, two columns) — 240px-wide vertical Pipeline rail on the left, flexible action workspace on the right

Both regions sit inside a 24px horizontal / 16px top / 24px bottom padding wrapper around the main content area.

```
┌──── Header card (full width, ~200–240px tall) ──────────────────┐
│ [Logo]  Title       [StatusPill]                   [ScoreRing] │
│         Company · $185k–$240k · ★★★☆ Interest                  │
│         📍 Location · 💼 Type · 📅 Posted · 🔗 Visit · 🚀 Apply │
│  ──────────────────────────────────────────────────────         │
│  DOCS   [Resume — Tailor] [Cover — Missing]    [View full ▸]   │
│         [Context — OK]                                          │
└─────────────────────────────────────────────────────────────────┘

┌── Pipeline ──┐  ┌── Workspace ──────────────────────────────────┐
│ ● Saved ←    │  │ ⚡ Next action: <title>                       │
│   ✓ Analysis │  │   [Primary CTA]  [Secondary]                  │
│   ✓ Reviewed │  │                                                │
│   ✓ Network  │  │ <SubStageContent — depends on active sub> │
│   ✓ Research │  │                                                │
│   ⚪ Prioritize│  │                                                │
│ ○ Generated  │  │                                                │
│ ○ Applied    │  │                                                │
│ ○ Interview… │  │                                                │
│ ○ Decision   │  │                                                │
│ ○ Accepted   │  │                                                │
│ ───End states│  │                                                │
│ 🚫 Rejected  │  │                                                │
│ ⛔ Declined   │  │                                                │
│ ❌ Withdrawn  │  │                                                │
└──────────────┘  └────────────────────────────────────────────────┘
```

Approx target widths (assuming sidebar ~60px and content max-width ~1220px):
- Pipeline rail: **240px fixed**
- Workspace gap: **12px**
- Workspace content: **fills remaining space**

---

## Components

### 1. Header card

A single `<div class="card">` with 16–18px padding (14–16px in compact density), 14px bottom margin. Inside, three columns laid out horizontally with `align-items: flex-start`:

#### 1a. Company logo (left, fixed width)
- 52px square in comfy density, 44px in compact
- 12px border-radius
- Background: `--bg` (page background) with 1px `--line` border
- Centered initials in `var(--txt-2)`, font-weight 800, size ~28% of box
- Fallback for when real logo is missing; if a logo URL exists, replace with `<img>` sized to fit

#### 1b. Identity column (center, flex: 1, min-width: 0)

Stacked rows with 4–10px gaps:

- **Title row** (`row gap-3`)
  - `<h1>` job title, font-size 22px (18px compact), weight 800, line-height 1.2, color `--txt`
  - **StatusPill** next to title — chip with a pulsing dot + uppercase status word. Color varies by status:
    - Saved / Generated / Applied → blue chip
    - Interviewing / Decision → amber chip
    - Accepted / Offered → green chip
    - Rejected / Declined / Withdrawn → red chip
  - Padding 4px 10px, font-size 11px, weight 800, letter-spacing 0.06em, uppercase

- **Company + salary + interest row** (`row gap-3`, flex-wrap, font-size 13px, color `--txt-mute`, weight 600, marginBottom 8px)
  - Plain text "Company Name" + small `arrow_outward` icon (clickable → opens listing in new tab)
  - **Salary chip** — see *Salary chip* component below
  - **Interest cluster** — tiny "Interest" uppercase label + 3-star control. See *InterestStars*.

- **Meta row** (`MetaInline` component, font-size 13px, color `--txt-2`, gap 10px row / 16px col, flex-wrap)
  - Each meta item is an icon (14px, `--txt-dim`) + label
  - Items separated by `·` glyphs in `--txt-faint`
  - Items used in the prototype: location, job type, posted date, "Visit Listing" (link), "Direct Apply" (link). Links rendered in `--primary`, semibold, with hover underline.

- **Divider** — 12px top margin, 10px bottom margin, 1px height, `--line`. Visually separates the "what the job is" band above from the "your materials + view details" band below.

- **Docs + actions row** (`row gap-3`, flex-wrap, align-items: center)
  - Small uppercase "Docs" label
  - **DocsCluster** chips (see below)
  - **"View full job details" button** — pushed to right with `margin-left: auto`. See *View-details button*.

#### 1c. Score column (right, fixed)
- **ScoreRing** — 60px in comfy / 52px in compact. Score 0–100. Color thresholds: ≥80 green, ≥60 amber, <60 red. Track is `--line`, progress ring 4px stroke, value rendered numerically in the center, weight 800.
- Below ring: small green chip `↑ 3 vs avg` (or red chip if below avg) — links to the user's running average score.

---

### 2. Salary chip

- Two variants: `populated` and `unlisted`.
- **Populated** — green pill: `var(--success-soft)` background, `var(--success)` text, 1px `rgba(5,150,105,0.25)` border. Icon: filled `payments` (13px). Text: weight 800, tabular-nums (e.g. "$185k – $240k"). Padding 4px 11px, font-size 12px.
- **Unlisted** — outlined pill with dashed border: `var(--bg)` background, `--txt-mute` text, dashed `--line-strong` border, weight 600. Outline `payments` icon. Text: "Salary not listed".
- Dark theme uses the same conceptual treatment with brighter colors (`#34d399`, etc.)

---

### 3. InterestStars

A 3-star priority/interest control.

- 3 buttons in a row, no gap (tightest), each 18×18px hit area with `star` icon (14px) inside.
- Off state: color `var(--txt-faint)`, outline icon.
- On state: color `#f59e0b` (light) / `#fbbf24` (dark), filled icon.
- Hover: `transform: scale(1.15)` on the button.
- Hover *behavior*: shows preview of "if I clicked this, this many stars would be filled" (i.e. fills 1–N stars based on which one the mouse is over).
- Click: toggle — if the user clicks an already-filled star (value === n), set value to 0 (clear). Otherwise set value to n.
- Should be wired to the application's `interest_level` field. The existing `frontend/src/components/InterestStars.jsx` may already cover this — prefer that component if it does.
- A small uppercase "Interest" label sits to the left at 9px font, color `--txt-mute`, weight 800.

---

### 4. DocsCluster (chips variant)

Header-inline document cluster replacing the old standalone "Documents" section.

Three documents tracked: **Resume**, **Cover letter**, **Context**.

Each document has one of three states:
- **ok** — green (present and ready)
- **attention** — amber (present but needs work, e.g. "Resume is still Base, not tailored for this job")
- **missing** — red (no document yet)

Each chip is a button:
- Pill shape, 4px 4px 4px 10px padding, border-radius pill.
- Background: `--bg-card`, border 1px `--line`.
- Layout inside chip: 13px doc-type icon + name (12px, weight 600) + status badge.
- Status badge: tiny inner pill, 2px 7px padding, font-size 10px, weight 800, uppercase, letter-spacing 0.04em. Background uses `--success-soft` / `--warn-soft` / `--danger-soft`, color matches.
- Status word: "OK" / "Tailor" / "Missing".
- Status icon (9px): `check_circle` / `priority_high` / `add`.
- Hover: brighten background to `--bg-hover`, border to `--line-strong`.
- Border accents: attention chips use a faint amber border `rgba(217,119,6,0.3)`, missing chips use a faint red border `rgba(220,38,38,0.3)`.

Doc objects in the prototype:
```js
[
  { id: 'resume', name: 'Resume',       icon: 'description', state: 'attention',
    detail: 'Base only — not tailored for PRI', cta: 'Tailor now' },
  { id: 'cover',  name: 'Cover letter', icon: 'mail',        state: 'missing',
    detail: 'No cover letter yet', cta: 'Add' },
  { id: 'ctx',    name: 'Context',      icon: 'folder',      state: 'ok',
    detail: '0 additional docs (optional)', cta: 'Add' },
]
```

Clicking a chip should open the document (for `ok`) or open the tailoring/upload flow (for `attention`/`missing`). The existing app surfaces this in the Generated phase's resume editor (`components/JobMatch/ResumeEditor.jsx`) — link there for the resume CTA.

---

### 5. "View full job details" button

Primary-tinted CTA that pulls up the full job posting text (the existing `JobDescriptionContent` component in `ApplicationDetail.jsx`).

- Padding 5px 10px, font-size 12px, border-radius 8px.
- Background `var(--primary-soft)` (`rgba(37,106,244,0.08)`), border 1px `var(--primary-edge)` (`rgba(37,106,244,0.18)`), color `var(--primary)`.
- Content: `<Icon name="article" size={14} /> View full job details <Icon name="chevron_right" size={14} />`
- Hover: background → `rgba(37,106,244,0.16)`, border → `var(--primary)`. Chevron translates 2px to the right.
- Dark theme: background `rgba(37,106,244,0.18)`, color `#93b8fb`.

When clicked, should expand the job description inline (modal, drawer, or expanding panel — designer's choice; an in-place collapsible panel below the header would feel right). The existing `JobDescriptionContent` component already handles expand/collapse — wire this button to it.

---

### 6. Pipeline rail (vertical) — left column, 240px wide

A `<div class="card">` with 10px padding.

#### 6a. Header
- 4px 8px 8px padding row, "Pipeline" uppercase label (10px, weight 800, letter-spacing 0.1em, color `--txt-mute`).
- **No counter chip** on this row — the user found "4/5" here ambiguous (it read as "the pipeline is 4/5 stages done"). The per-stage completion lives on each stage row.

#### 6b. Stage rows (`.vrail` → `.vstep`)
Each pipeline stage rendered as a `.vstep`:
- Padding `10px 12px 10px 36px`, border-radius 8px, cursor pointer.
- A continuous 2px vertical line drawn via `::before` at `left: 17px`, running through all stages, color `--line`.
- For passed and current stages, that line segment becomes `--primary`.
- The first stage's line truncates at `top: 50%`; the last stage's at `bottom: 50%` — so the line only spans between nodes.
- A 14×14px round node (`.vnode`) sits absolutely positioned at `left: 11px, top: 14px`. States:
  - **Default** (future) — `--bg-card` background, 1.5px `--line-strong` border.
  - **Passed** (already completed) — solid `--primary` background, white `✓` glyph (8px, weight 900) centered via `::after`.
  - **Current** (where the application is now) — `--bg-card` background, `--primary` border, 4px `--primary-soft` outer ring (`box-shadow: 0 0 0 4px var(--primary-soft)`), inner 8×8px filled circle in `--primary` via inset `::after`.
- Stage name row (`.vname`) — 12px, weight 700, uppercase, letter-spacing 0.05em.
  - Default color `--txt-mute`, passed `--txt-2`, current `--primary`.
- Stage subtext (`.vsub`) — 11px, weight 500, color `--txt-dim`, margin-top 1px.
  - Shows "{done}/{count} · in progress" for current, "{done}/{count} · done" for passed, just "{done}/{count}" otherwise.
- Hover (not current): background `--bg`.
- Current state has `background: var(--primary-soft)`.

Stages in order:
```
Saved → Generated → Applied → Interviewing → Decision → Accepted
```

#### 6c. Sub-stage nest (under the current stage only)

Below the current stage's `.vstep`, render a `.vsubs` container:
- `margin-left: 30px`, `padding-left: 12px`, dashed left border `1.5px var(--primary-edge)`.

Each sub-stage is a `.vsub`:
- Padding `5px 10px`, border-radius 6px, font-size 12px, color `--txt-mute`.
- Icon (12px) on the left: `check_circle` if `done`, else the sub-stage's domain icon.
- Sub-stage name with text-overflow ellipsis.
- Done sub-stages: color `--txt-dim`, icon color `var(--success)`.
- Active sub-stage (the one whose content is showing in the workspace): color `--primary`, background `--primary-soft`, weight 700, icon filled.
- Hover: background `--bg`, color `--txt-2`.

Sub-stages for the **Saved** phase (defaults to active in this prototype):

| id          | label                  | icon          | done |
|-------------|------------------------|---------------|------|
| analysis    | Job Analysis (parsed)  | analytics     | true |
| reviewed    | Reviewed               | fact_check    | true |
| network     | Network Contacts       | group         | true |
| research    | Company Research       | domain        | true |
| prioritize  | Prioritize             | flag          | false (current) |

Each other top-level stage has its own sub-stage list per `documentation/Top-levelstage-Usefulsub-stages.csv.xlsx` — keep those mappings.

#### 6d. End states divider + buttons

After the main rail, a divider labelled "End states":

```
.rail-divider — 10px 4px 6px margin, flex row, 9px uppercase weight 800
                letter-spacing 0.18em, color --txt-dim. Has horizontal lines
                on either side of the centered "End states" text, both 1px,
                color --line.
```

Below the divider, render the three terminal stages as `.end-state` buttons (full-width rows):

- Padding 8px 10px, border-radius 8px, border 1px transparent, font-size 12px, weight 600, color `--txt-mute`.
- Icon (14px) + label + arrow_outward (12px) on the right, arrow color `--txt-faint`.
- Hover: background `--bg`, color `--txt`, border `--line`, arrow turns `--primary`.

End states:

| id        | label      | icon                |
|-----------|------------|---------------------|
| rejected  | Rejected   | block               |
| declined  | Declined   | do_not_disturb_on   |
| withdrawn | Withdrawn  | cancel              |

Clicking one moves the application to that terminal stage (existing app already has these stages — see `STAGE_TO_STATUS` in `PipelineProgressBar.jsx`).

---

### 7. Workspace (right column, flex: 1)

Two stacked cards with 12px gap:

#### 7a. NextAction card

A linear-gradient panel highlighting the next thing the user should do for the active sub-stage.

- Padding 14px 16px, border-radius `--r-md` (10px).
- Background: linear-gradient `180deg`, from `#f0f7ff` → `#ffffff` in light theme; in dark theme `rgba(37,106,244,0.10)` → `rgba(19,28,43,0.4)`.
- Border 1px `var(--primary-edge)`.
- Heading row: small "bolt" icon (12px filled) + "Next action" uppercase label (10px weight 800, letter-spacing 0.12em, color `--primary`).
- `<h4>` next-action title (15px, weight 700, color `--txt`, line-height 1.3).
- `<p>` body text (13px, color `--txt-mute`, line-height 1.5) — hidden in compact density.
- Buttons row, gap 8px, marginTop 4px:
  - Primary CTA: `btn-primary btn-sm` with `auto_awesome` filled icon (14px) — primary action (e.g. "Generate Application").
  - Secondary CTA: `btn-sm` with no icon (e.g. "Skip & Apply Directly").

The content depends on what the application currently needs. The prototype example for the Saved-phase Prioritize sub-stage:

> "Decide to move this to Generated. All Saved-phase research is complete (4 of 5). The next move is to commit the application — start generating a tailored resume + cover letter."

Wire this to the existing primary-CTA/secondary-CTA mapping in `documentation/Stage-PrimaryCTA-SecondaryCTAs.csv.xlsx`.

#### 7b. SubStageContent card

A standard `card` with 18px padding (14px compact). Contents vary by active sub-stage. The prototype implements 5 sub-stage content views — these are the **content surfaces from the existing app** that should be wired in:

**`analysis` — Job Analysis (parsed)**
- Header row: title "Job Analysis (parsed)", subtitle "Structured data extracted from the job posting". Right side: "Refresh Analysis" button.
- **Compatibility Score panel** (`.compat-panel`):
  - Linear-gradient background `rgba(37,106,244,0.06)` → transparent, 1px `--primary-edge` border, 16px padding.
  - Inner header: "Compatibility Score" label in primary blue, with `analytics` icon.
  - Row of: 72px ScoreRing + ("Excellent match for your profile!" 14px weight 700) + green chip "↑ 3 pts above your avg (83)".
  - 5 dimension rows: name + horizontal progress bar (6px tall, 3px radius) + score "{n}/20" with weight 700.
  - Dimensions in prototype: Core Role 17/20, Experience 19/20, Education 16/20, Culture 18/20, ATS Keywords 16/20.
  - Bar color: ≥18 green, ≥16 primary, else amber.
- Below the panel: **Job Summary** label + a 2×2 grid of `SummaryField` (label + value). Fields:
  - Location & Type — "United States · Remote"
  - Job Type & Source — "Full-time · LinkedIn"
  - Experience & Seniority — "Senior · 10+ yrs"
  - Posted · Captured — "2026-05-16 · 5/20"

**`reviewed` — Reviewed**
- Column of "flagged requirement" rows: gray-background pill on left ("Must-have" amber chip / "Nice-to-have" blue chip) + requirement text.

**`network` — Network Contacts**
- Empty state when no contacts: centered 48px gray circle with `group` icon, "No known contacts yet" title (14px weight 700), explanatory subtext, and primary CTA "Connect LinkedIn" with `link` icon.

**`research` — Company Research**
- 4 rows, each a flex row with: 28px primary-tinted square (icon centered, `--primary-soft` bg) + name (13px weight 700) + meta (11px `--txt-mute`) + green filled `check_circle` (16px) on the right.
- Sections: Company Overview, Financials & Market, Competitor Matrix, Career Matches. Pull live data from existing `CompanyResearchViews.jsx`.

**`prioritize` — Prioritize**
- Re-uses the NextAction panel pattern inline + three "signal rows" (trending_up / group / event) listing match score, contact count, and deadline status.

---

## Design tokens

The app already defines these in `frontend/src/index.css`. Use them as-is — the prototype just hardcodes the same values.

### Colors

```css
/* Brand */
--primary:        #256af4;
--primary-soft:   rgba(37, 106, 244, 0.08);   /* light */
--primary-soft:   rgba(37, 106, 244, 0.14);   /* dark */
--primary-edge:   rgba(37, 106, 244, 0.18);   /* light border */
--primary-edge:   rgba(37, 106, 244, 0.35);   /* dark border */

/* Light background */
--bg:        #f1f5f9;
--bg-card:   #ffffff;
--bg-hover:  #f8fafc;
--line:      #e2e8f0;
--line-soft: #eef2f7;
--line-strong: #cbd5e1;

/* Dark background (matches existing index.css default) */
--bg:        #0a0f18;
--bg-card:   #131c2b;
--bg-hover:  #1a2236;
--line:      rgba(255,255,255,0.07);
--line-strong: rgba(255,255,255,0.14);

/* Text — light */
--txt:       #0f172a;
--txt-2:     #334155;
--txt-mute:  #64748b;
--txt-dim:   #94a3b8;
--txt-faint: #cbd5e1;

/* Text — dark */
--txt:       #f1f5f9;
--txt-2:     #e2e8f0;
--txt-mute:  #94a3b8;
--txt-dim:   #64748b;
--txt-faint: #475569;

/* Status */
--success:      #059669 / dark #10b981
--success-soft: #d1fae5 / dark rgba(16,185,129,0.14)
--warn:         #d97706 / dark #f59e0b
--warn-soft:    #fef3c7 / dark rgba(245,158,11,0.14)
--danger:       #dc2626 / dark #ef4444
--danger-soft:  #fee2e2 / dark rgba(239,68,68,0.14)
```

### Type

- Family: **Manrope** (already loaded in the app via Google Fonts).
- Base size: **14px**.
- Title (h1): 22px / weight 800 / line-height 1.2.
- Section heading (h3): 16px / weight 800.
- Sub-stage heading (h4): 15px / weight 700.
- Body: 13px regular, 12px for dense rows.
- Architectural label: 10px / weight 800 / uppercase / letter-spacing 0.1em / color `--txt-mute`.
- Tiny label (used in compact spots): 9px / weight 800 / uppercase / letter-spacing 0.18em.

### Spacing

- Outer page padding: 16px top / 24px sides / 24px bottom.
- Header card padding: 18px (16px compact).
- Card padding: 18px.
- Row gaps inside header: 4–12px depending on hierarchy.
- Workspace gap: 12px.
- Pipeline rail width: **240px fixed**.

### Border radius

- Cards: 14px (`--r-lg`).
- Buttons / chips: 8px / 999px.
- Inner panels (NextAction, compat-panel): 10px (`--r-md`).
- Pills (status, salary, docs chips): 999px.

### Shadows

- `--shadow-card`: `0 1px 2px rgba(15, 23, 42, 0.04), 0 1px 1px rgba(15, 23, 42, 0.02)` (light theme cards)
- `--shadow-blue`: `0 8px 24px -8px rgba(37, 106, 244, 0.35)` (primary buttons)
- Dark theme uses `0 1px 2px rgba(0, 0, 0, 0.4)` for cards.

---

## Iconography

All icons are **Material Symbols Outlined** (same as the prototype). Load via `https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200`.

Icon names used in this design:

```
arrow_back, arrow_outward, arrow_upward,
add, edit, archive, delete, refresh,
analytics, fact_check, group, domain, flag,
auto_awesome, bolt, link, check, check_circle,
priority_high, payments, star,
location_on, work, event, open_in_new, rocket_launch,
description, mail, folder, article, chevron_right,
visibility, dashboard, person, notifications, settings,
block, do_not_disturb_on, cancel,
trending_up, compare_arrows, schedule
```

For filled variants, set `font-variation-settings: 'FILL' 1, 'wght' 400`.

---

## Interactions & behavior

1. **Click a top-level stage** in the vertical pipeline → sets active stage. Sub-stage nest re-renders under that stage. (Existing app already supports manual stage advancement — wire to existing handlers.)
2. **Click a sub-stage** → swaps the right-side `SubStageContent` view. Should not change the application's actual stage.
3. **Click an end-state button** (Rejected / Declined / Withdrawn) → confirm prompt, then moves the application to that terminal stage. Should immediately update the StatusPill in the header and re-render the pipeline.
4. **Click a docs chip**:
   - `ok` → opens the document.
   - `attention` (resume not tailored) → opens the Generated-phase resume tailoring flow (`ResumeEditor.jsx`).
   - `missing` → opens the upload/generate flow for that doc type.
5. **Click "View full job details"** → expands the full job description inline below the header (use existing `JobDescriptionContent` collapsible). On second click, collapses.
6. **Click interest stars** → updates `interest_level` on the application via the existing API. Hover previews the value.
7. **Click salary chip** → opens edit modal for salary range (or no-op if unlisted is final).
8. **Hover an end-state button** → reveals the arrow icon in primary blue, signalling "Move this application here."
9. **Status pill dot animation** — pulses every 2.2s using `box-shadow: 0 0 0 0` keyframes (animation defined in the prototype's `.dot.is-pulse`).

---

## State management

The screen needs (most likely from existing `useApplication` / `AuthContext` patterns):

- `application` — full job application record (id, title, company, status, stage, sub_stage, score, salary, interest_level, dates, doc references)
- `activeSubStage` — local UI state, defaults to the application's current sub-stage. Changes on sub-stage click.
- `companyResearch` — lazy-loaded, surfaces in the Research sub-stage. Existing `CompanyResearchViews` already handles this.
- `docs` — derived state: `{ resume: 'ok'|'attention'|'missing', cover: ..., context: ... }`. Resume is `attention` if the user has only their base resume attached (no tailored variant for this application).
- `isJobDescExpanded` — local UI state for the "View full job details" toggle.

---

## Responsive notes

The prototype targets a **1280×820** viewport (the app's typical desktop). At narrower widths:

- If page < 1024px wide, consider collapsing the pipeline rail to a horizontal stepper at the top of the workspace and removing the workspace column.
- Header card meta row already uses `flex-wrap: wrap` so it degrades gracefully.
- DocsCluster chips also wrap on narrow widths; the "View full job details" button drops to its own line when there isn't horizontal room.

Mobile is out of scope for this redesign — the existing app has its own mobile capture flow.

---

## Files in this handoff

- `Job Details Redesign.html` — the prototype entrypoint (load this in a browser to see the design)
- `app.jsx` — top-level React shell + tweaks panel wiring (canvas + theme/density toggles — **not** needed in production)
- `shared.jsx` — all reusable components: `Icon`, `ScoreRing`, `CompanyLogo`, `StatusPill`, `InterestStars`, `DocsCluster`, `NextAction`, `SubStageContent` and its sub-views (`AnalysisContent`, `ReviewedContent`, `NetworkContent`, `ResearchContent`, `PrioritizeContent`), `MetaInline`, `AppShell`, plus the mock data: `JOB`, `STAGES`, `BRANCH_STAGES`, `SAVED_SUBSTAGES`, `SUBSTAGE_CONTENT`, `DOCS`, `NEXT_ACTION`
- `variation-a.jsx` — Variation A composition (the design we landed on)
- `styles.css` — all CSS — token defs, light + dark themes, component styles
- `design-canvas.jsx`, `tweaks-panel.jsx` — only used by the prototype canvas; ignore for implementation
- `screenshots/` — reference renders of Variation A (dark + light themes, 924×540, scaled-down from the native 1280×820)

## Implementation notes for Claude Code

- The existing `frontend/src/pages/ApplicationDetail.jsx` (2,634 lines) and `frontend/src/pages/ApplicationLifecycle.jsx` (6,764 lines) own the current screen. Most of the existing data-fetching, status mapping, and sub-stage routing is already in place.
- The redesign is primarily a **layout/structural change**. Don't rewrite the data layer — re-arrange the existing components into the new layout.
- The existing `PipelineProgressBar.jsx` is a horizontal stepper. Adapt or replace it with a new `VerticalPipelineRail.jsx` component that takes the same `stage` prop and exposes the same `onStageChange` callback.
- `InterestStars.jsx` already exists — verify its API matches the prototype's expectations; if so, use it directly.
- All `CompanyResearchViews` components already render the Research sub-stage content — drop them into the new `ResearchContent` slot.
- The "Compatibility Score" panel needs the dimension breakdown (`Core Role`, `Experience`, etc.). Check the application response shape — if those dimensions aren't already returned by the API, that's a backend addition.
