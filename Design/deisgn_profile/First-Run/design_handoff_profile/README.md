# Handoff: JobKernel Profile screen redesign (Variation A — Anchored rail)

## Overview

The Profile screen is where a JobKernel user manages **who they are to the system**:
identity, the career/compensation data that drives match scoring, the AI-generation
preferences and documents the agent writes from, integrations, and account/billing. The
current screen is one long always-editable form; this redesign replaces it with a sectioned,
read-by-default surface that groups fields by purpose, surfaces what affects the match score,
and makes the AI inputs first-class.

This redesign is a sibling to two shipped JobKernel surfaces — **Job Details** and the
**Pulse list view** — and must share their visual language (tokens, type rhythm, card
patterns, density, popover/modal vocabulary).

## About the design files

The files in `reference/` are **design references created as an HTML + React-via-CDN
prototype.** They communicate intended look and behavior. They are **not** production code
to copy directly. Your task is to **recreate Variation A in the JobKernel codebase using its
existing framework, component library, router, and state layer.** Where JobKernel already
has a component (button, chip, avatar, modal, toast), use it instead of the prototype's
bespoke CSS class.

The prototype renders several layouts on a pan/zoom "design canvas" for comparison. **Only
Variation A is being built.** The canvas shell (`design-canvas.jsx`), the tweaks panel
(`tweaks-panel.jsx`), and Variations B/C (`profile-split.jsx`, `profile-hub.jsx`) are
context only — do not port them.

## Fidelity: HIGH

Pixel-perfect. Final colors, typography, spacing, radii, shadows, and interaction states.
Reproduce exactly using JobKernel's real design tokens. All values are enumerated below.

---

## Screens / Views

There is one route — **`/profile`** — composed of a sticky rail + a single-scroll content
column. Below, each region and section is specified.

### Page shell

- **App chrome** (already exists in JobKernel): 60px icon nav rail on the far left, 48px
  topbar across the top. The Profile route sets the topbar breadcrumb to `Profile` and shows
  topbar actions: `Import from LinkedIn`, `Import resume`, and a primary `Edit profile`
  button (which becomes `Cancel` / `Save` when any section is in edit mode).
- **Profile body** sits inside the content stage (below topbar, right of nav). It is a CSS
  grid: `grid-template-columns: 240px 1fr` (rail + content). See required change #1 for the
  collapsed `60px 1fr` variant.

### Region: Left rail (sticky, 240px)

Order top→bottom:

1. **Identity mini-header** — 36px circular avatar (initials `RD` on `--primary` bg, white,
   weight 800, 13px) + name (13px/700/`--txt`) + location (11px/600/`--txt-mute`). Bottom
   border `1px var(--line-soft)`, 12px below.
2. **Readiness card** — a rounded box (`--bg`, `1px var(--line)`, `--r-md`, 12px padding,
   flex row, 12px gap): a 40px `ScoreRing` (component, see below) + `78%` (18px/800,
   tabular-nums) over the label `PROFILE READINESS` (10px/800/uppercase/0.08em/`--txt-mute`).
   **Per required change #2 this is the always-visible source of truth.**
3. **Section jump-list** — group label `PROFILE` (9px/800/uppercase/0.10em/`--txt-dim`,
   12px top padding) then items. Each item: 7×10px padding, 7px radius, 13px/600 text,
   16px leading icon. States:
   - default: `--txt-2` text, `--txt-dim` icon;
   - hover: `--bg` bg, `--txt` text;
   - active: `--primary-soft` bg, `--primary` text+icon, weight 700;
   - **score pip** (match sections): right-aligned `86` pill — active = `--primary` bg/white;
     default = `--bg` bg, `--line` border, `--txt-mute`;
   - **attention pip** (Documents): `--warn-soft` bg, `--warn` text, count `1`.
   Items: Identity, Match profile (pip 86), AI generation, Documents (attention 1),
   Integrations, Account.
4. **Footer actions** (pushed to bottom with `margin-top:auto`): `Export profile`
   (secondary btn) and `Sign out` (ghost btn, `--danger` text).

### Region: Content column (single scroll, max-width 920px, centered, 24/28px padding, 18px gap)

#### Hero (top identity card)

Card (`--bg-card`, `1px --line`, `--r-lg`, `--shadow-card`, 20×22px padding, flex row, 18px
gap):
- 88px circular avatar (`is-xl`, initials, `--primary`),
- text block: name (22px/800/-0.01em/`--txt`), headline (13px/600/`--txt-2`), meta row
  (12px/600/`--txt-mute`, 14px gap) with place / mail / work-auth / "3 links" (last in
  `--primary`),
- right aside (left border `1px --line-soft`, 18px pad): 64px `ScoreRing` + "Profile
  readiness" label + `78%` (24px/800). On score-impact preview, a green `ScoreDelta` chip
  appears here.

#### Section 1 — Identity

`PSection` card. Header: person icon in a 28px `--primary-soft` rounded tile, title
"Identity" (15px/800), sub "Name, contact, and links the agent uses to author messages.",
action `Edit` button (secondary, sm).

Body — 2-column field grid (14px row / 18px col gap), each field = stacked
label-over-value:
- Display name — `Robert Dannenbring`
- Headline — `Senior Solutions Architect · AI & Data Engineering`
- Email — `robert.dannenbring@gmail.com`
- Phone — `917-693-8433`
- Location — `Stamford, CT` · **Affects matching**
- Work auth — `US Citizen` · **Affects matching**

Then full-width Bio/summary (multi-line, `--txt-2`, 1.5 line-height), then a 3-column row of
links (LinkedIn / GitHub / Portfolio) rendered in `--primary`.

**Field label** style: 10px/800/uppercase/0.08em/`--txt-mute`. **Field value**: 13px/600/`--txt`.

#### Band — "Match profile · feeds your score"

A full-width band above the match sections (`--primary-soft` bg, `--primary-edge` border,
`--r-md`, 8×16px padding): auto_awesome icon + `MATCH PROFILE · FEEDS YOUR SCORE`
(10px/800/uppercase/0.08em/`--primary`) + right-aligned count pill `Score 86 · top quartile`.
This band pattern is lifted from Pulse's `pulse-day` group header.

#### Section 2 — Match profile (Career & compensation)

Header carries the **"Affects matching" chip** (see component). Sub: "What you're looking
for. Drives every Match Score on Pulse." Action `Edit`.

2-col grid; **every field carries a tiny "Affects matching" chip:**
- Target roles — chip row: Senior Solutions Architect, Staff Engineer, Engineering Manager,
  Principal Engineer
- Seniority — `Senior / Staff (10+ yrs)`
- Years of experience — `20 years` *(TODO: backend — new field)*
- Remote / hybrid — blue chips `Remote`, `Hybrid`
- Relocation — `Not available`
- Compensation — a `salary-chip` (`$160k – $250k USD`) + a `Negotiable` chip

#### Section 3 — Skills

Header carries the matching chip. Sub: "16 skills · weights tell the agent what to highlight
first." Actions: `Weight` (sort) + primary `Add`.

Body: a wrap of **skill chips** (see component) — each shows name + a weight badge
(`Core`/`Strong`/`Like`). Trailing dashed `Add skill` chip. Below, a legend explaining the
three weights and their score multipliers (Core 3×, Strong 2×, Like 1×).

Data (name · weight): Solutions Architecture·3, LLM Orchestration·3, Azure·3, Python·3,
C#/.NET·2, Kubernetes·2, Event-driven Design·2, Azure SQL·2, Microservices·2, Vector DBs·2,
Prompt Engineering·2, GitHub Actions·1, PowerShell·1, SQL Server·1, Docker·2, Azure DevOps·1.

#### Section 4 — AI generation

Sub: "How the agent writes resumes, cover letters, and outreach in your voice." Action `Edit`.
Three sub-blocks:
- **Tone** — two horizontal sliders: Casual↔Formal (value 0.65) and Concise↔Detailed (0.40).
  Track is `--bg` w/ `--line` border; fill + thumb use `--primary`.
- **Voice samples** (`2 / 5`) — italic quote cards (`--bg`, left 3px `--primary` border),
  each with a source footnote; trailing `Add sample` button. *(TODO: backend — new field)*
- **Things to avoid** — a tag-input of banned phrases: synergy, rockstar, 10x, guru,
  passionate, ninja. *(TODO: backend — new field)*

#### Section 5 — Documents

Sub: "Master resumes, base cover letters, and the context bank the agent pulls from."
Actions: `Upload` + primary `Open library` (links to the future Document Library route —
build the link, not the route).

Body: a responsive card grid (`repeat(auto-fill, minmax(220px,1fr))`, 12px gap). Each **doc
tile** (`--bg`, `1px --line`, `--r-md`, 14px pad, min-height 132px):
- icon tile (resume=description, cover=mail, context=folder; missing/attention=`--warn-soft`),
- name + size hint,
- footer chips: `Default` badge (`--success-soft`) when default, `Action needed`
  (`chip-amber`) when attention, last-updated, "used on N jobs".

Tiles: Master Resume (default, used 14), Long-form Resume (used 3), Base Cover Letter
(default, used 11), Architecture Case Study (used 6), Transcripts (attention — not uploaded),
plus a dashed `Add a document` empty CTA.

#### Section 6 — Integrations

Sub: "Connect the apps the agent reads from and writes to." Body: vertical stack (8px gap)
of **integration rows** (`--bg`, `1px --line`, `--r-md`, 12×14px pad):
- 36px square brand-initial tile, name + sub, a status indicator (dot + label), and an
  action button.
- States: `Connected` (`--success`), `Connecting…` (`--primary`, pulsing dot),
  `Disconnected` (`--txt-mute`, primary `Connect` button), and `Re-auth required`
  (`--danger`).

Rows: LinkedIn (connected), Gmail (connected), Google Calendar (disconnected), Greenhouse
ATS (disconnected), Browser Extension (connecting).

#### Section 7 — Account & plan

Sub: "Billing, usage, notifications, and data controls."
- **Plan strip**: `Pro` badge (`--primary` pill) + a usage meter (`142 / 500 generations`) +
  `$29/mo` + `Manage billing` button.
- A 2-col grid: Application limit `38 / 100`, Context bank `6 / 25 docs`, Email digests
  `Weekly, Sunday 7pm`, Quiet hours `9pm – 7am · America/New_York`.
- **Danger zone**: dashed `--danger` box with `Export data` + `Delete account` (danger btn).

---

## Required changes to Variation A (not yet in the prototype)

These three changes were agreed **after** the prototype was built. Implement them on top of
what `profile-anchored.jsx` shows.

### 1. Collapsible rail

- **≥1280px viewport:** full 240px rail exactly as specced.
- **<1280px viewport:** collapse to a **60px icon-only strip** — section icons only, labels
  hidden, full label shown as a hover tooltip. The identity mini-header collapses to just the
  avatar. The readiness card collapses to just the ring (no `78%`/label text — see #2).
- Add a manual collapse/expand toggle (a chevron button at the rail's top) so users above
  1280px can also collapse it. **Persist** the user's explicit choice (localStorage in the
  prototype; app's pref store in production). Auto-collapse below 1280 should not overwrite a
  user's manual expand on a per-session basis — manual choice wins until viewport forces it.
- Content column keeps `max-width:920px` centered; it simply gains width when the rail
  collapses.

### 2. Readiness ring always visible in the rail

- Today the readiness ring lives in the scroll hero only. **Add it to the rail's readiness
  card so it is visible at every scroll position**, and keep it visible (ring only, no text)
  in the collapsed rail.
- Keep the larger readiness display in the hero as well — but the rail is the always-on
  source of truth.
- When a match-affecting field is edited and saved, animate the ring + show the green
  `ScoreDelta` (see score-impact preview state) in both the rail and hero.

### 3. ⌘K command palette

- Global `Cmd/Ctrl-K` opens a centered command-palette overlay (reuse JobKernel's existing
  palette/modal if one exists; otherwise model it on the prototype's `.popover`/`.modal-card`
  vocabulary — `--bg-card`, `--shadow-pop`, `--r-lg`).
- Fuzzy-searches **every section and field** by label and synonyms — e.g. "salary",
  "comp", "pay" → Compensation; "default resume" → Documents; "voice", "tone" → AI generation.
- **Enter** on a result: scrolls the content column to that section (respect the sticky
  offset — do **not** use `scrollIntoView`; compute offset and use `scrollTo`), sets that
  section active in the rail, opens it in **edit mode**, and focuses the specific field.
- Results grouped by section; show the section icon + the field label + a tiny "Affects
  matching" chip where relevant. Keyboard: ↑/↓ to move, Enter to jump, Esc to close.
- This is the random-access power-path that lets the single-scroll layout match a split-pane
  on speed — it's the reason Variation A was chosen over B.

---

## Interactions & Behavior

(All specced visually in `reference/profile-states.jsx`.)

- **Read by default.** Sections render read-only. The topbar `Edit profile` and each
  section's `Edit` button enter **per-section edit mode** → fields become inputs, header
  actions swap to `Cancel` / `Save`. Saving a match-affecting section shows an inline notice
  ("These fields will rescore your 34 saved jobs on save.") + a `ScoreDelta`.
- **Inline skill-weight popover.** Clicking a skill chip opens a small popover (reuse
  `.popover`) with three weight buttons (Like 1× / Strong 2× / Core 3×), a "Remove skill"
  destructive item, and a live score-delta hint. This mirrors Pulse's stage-edit popover.
- **Destructive confirm modal.** Delete-account / remove-default-doc use a `.modal-card`
  centered over a blurred backdrop, with a typed `DELETE` confirmation for account deletion.
  Lifts Pulse's confirm-modal vocabulary.
- **Document upload.** Drag-drop dropzone (`is-active` highlight on dragover) → per-tile
  uploading progress bar → "just uploaded" green flash with auto-detected doc-type chip.
- **Integration connect flow.** disconnected → (click Connect) → connecting (pulsing dot) →
  connected; plus a re-auth/error variant. Mock the OAuth — no real flow this round.
- **Empty / new-user state.** When the profile is sparse: a primary "Let's get you to 100%"
  hero (with a low-value ring) + import CTAs, and a dismissible "Quick wins" checklist where
  each item shows its readiness impact (`+15`, `+8`, …). See `StateEmpty`.
- **Score-impact preview.** Editing match fields animates the readiness/match ring and shows
  a `ScoreDelta` (`score-pop` keyframe, 600ms ease-out); a "Recent edits" list shows per-edit
  deltas. See `StateScoreDelta`.
- **Transitions:** 120ms on hovers/state changes (matches app convention). Score pop 600ms.
- **No `scrollIntoView`** anywhere (it breaks the app shell) — compute offsets and use
  `scrollTo` on the stage/content element.

## State management

State the implementation needs (map to JobKernel's real store/forms):
- `railCollapsed: boolean` (persisted; auto-derived from viewport <1280 unless user override)
- `activeSection: string` (driven by scroll-spy on the content column **and** rail clicks)
- `editingSection: string | null` (only one section edits at a time; `Save`/`Cancel` clears)
- `paletteOpen: boolean`, `paletteQuery: string`, `paletteIndex: number` (⌘K)
- per-section dirty/draft state for save/cancel
- `readiness: number` + `matchScore: number`, with a derived `delta` after a save for the
  pop animation
- upload state per document (`idle | uploading{pct} | done | error`)
- integration state per provider (`connected | connecting | disconnected | reauth`)
- completeness checklist items (done/impact) for the empty state

Data fetching: load the user profile, document list, integration statuses, and
plan/usage on route enter. Saving a match section should trigger a rescore request whose
result drives the `delta` animation.

---

## Design Tokens

These mirror JobKernel's production tokens (the prototype's `styles.css`). **Confirm against
the live app and use the real CSS variables — do not hardcode hex.** Listed here so the spec
is self-sufficient.

### Color

| Token | Value | Use |
|------|-------|-----|
| `--primary` | `#256af4` | primary actions, active nav, match accents |
| `--primary-soft` | `rgba(37,106,244,0.08)` | active nav bg, match-chip bg, icon tiles |
| `--primary-edge` | `rgba(37,106,244,0.18)` | match-chip / blue-chip borders |
| `--bg` | `#f1f5f9` | app background, inset boxes, chips |
| `--bg-panel` | `#e8edf3` | — |
| `--bg-card` | `#ffffff` | cards, rail, topbar |
| `--bg-input` | `#ffffff` | inputs |
| `--bg-hover` | `#f8fafc` | hover bg |
| `--line` | `#e2e8f0` | default borders |
| `--line-soft` | `#eef2f7` | inner dividers |
| `--line-strong` | `#cbd5e1` | dashed CTAs, hover borders |
| `--txt` | `#0f172a` | primary text |
| `--txt-2` | `#334155` | secondary text, button labels |
| `--txt-mute` | `#64748b` | labels, subs |
| `--txt-dim` | `#94a3b8` | rail icons, faint meta |
| `--txt-faint` | `#cbd5e1` | disabled, chevrons |
| `--success` / `--success-soft` | `#059669` / `#d1fae5` | connected, default-doc badge |
| `--warn` / `--warn-soft` | `#d97706` / `#fef3c7` | attention pips, action-needed |
| `--danger` / `--danger-soft` | `#dc2626` / `#fee2e2` | danger zone, re-auth, delete |
| `--info` | `#3b82f6` | — |

### Radius

`--r-sm 6px` · `--r-md 10px` · `--r-lg 14px` · `--r-xl 20px` · `--r-pill 999px`

### Shadow

- `--shadow-card`: `0 1px 2px rgba(15,23,42,.04), 0 1px 1px rgba(15,23,42,.02)`
- `--shadow-pop`: `0 8px 24px -8px rgba(15,23,42,.12), 0 2px 6px rgba(15,23,42,.04)`
- `--shadow-blue`: `0 8px 24px -8px rgba(37,106,244,.35)` (primary buttons)

### Typography

- Family: **Manrope** (400/500/600/700/800), system-ui fallback. Base 14px.
- Section title 15px/800; hero name 22px/800 (-0.01em); field value 13px/600.
- Field label / micro-caps: 10px/800, uppercase, 0.08em, `--txt-mute`.
- Group label (rail): 9px/800, uppercase, 0.10em, `--txt-dim`.
- Numerics (scores, usage, salary): `font-variant-numeric: tabular-nums`.

### Spacing rhythm

Content gap 18px (comfy). Section header pad 14×20px; body pad 16/20/20px. Field grid 14px
row / 18px col. **Density variants** (optional, matches Pulse): compact (header 10×16,
body 12×16, gap 12) and relaxed (header 18×24, body 20×24, gap 24).

### New pattern established here: "Affects matching" chip

A small pill marking any field that feeds the match algorithm. **Reuses existing tokens —
NOT a new token.** `--primary-soft` bg, `--primary` text, `--primary-edge` border,
`--r-pill`, 9px/800/uppercase/0.05em, an `auto_awesome` (filled, 10px) leading icon, label
"Affects matching". A `tiny` variant (8px) sits inline next to field labels. This is the one
genuinely new visual the rest of the app doesn't have yet — establish it here and reuse it
wherever a field affects scoring.

---

## Components to reuse from JobKernel (don't rebuild)

From the prior phases' shared library (prototyped in `reference/shared.jsx`) — map each to
the real app component:

- **`Icon`** — Material Symbols Outlined wrapper (`fill` toggles FILL axis). Real app likely
  already has an icon component.
- **`ScoreRing`** — circular progress ring used for readiness + match score.
- **`StatusPill`**, **`InterestStars`**, **`CompanyLogo`**, **`DocsCluster`** — exist from
  Job Details / Pulse; reuse if relevant.
- **`.btn` / `.btn-primary` / `.btn-sm` / `.btn-ghost` / `.btn-danger`** — button system.
- **`.chip` / `.chip-blue` / `.chip-green` / `.chip-amber` / `.chip-red`** — chip system.
- **`.salary-chip`** — the compensation pill (also used on Pulse cards).
- **`.popover`**, **`.modal-card` / `.modal-bd`** — popover + modal vocabulary.
- **Dark theme** via `[data-theme="dark"]` on the app root — all surfaces here have dark
  parity in the prototype; verify against the app's dark tokens.

## Profile-specific surfaces (new in this redesign)

These are net-new CSS surfaces defined in `reference/profile.css` — recreate as components
in the app stack: `PSection` (section card), `PField` (stacked field), the match band, the
weighted **skill chip**, the **doc tile** + dropzone, the **integration row**, the tone
**slider**, **voice-sample** card, the rail itself, and the readiness card. Read
`profile.css` for exact measurements.

## Assets

- **Fonts:** Manrope (Google Fonts) + Material Symbols Outlined. App almost certainly
  already loads both.
- **Icons:** Material Symbols names used — person, auto_awesome, neurology, folder, link,
  credit_card, bolt, payments, place, mail, badge, schedule, bookmark, cloud_upload,
  description, check, check_circle, radio_button_unchecked, close, add, edit, trending_up,
  warning, delete_forever, search, logout, download, sort, history, speed, task_alt.
- **No raster images or custom SVG.** Avatars are initials on `--primary`; if a real photo
  exists, render it cover-fit in the same circle.

## TODO: backend (proposed new fields)

These fields appear in the design but may not exist on the JobKernel user model. Confirm
before persisting; don't invent silent backend behavior:

- `yearsOfExperience` (number)
- `voiceSamples` (array of `{text, source}`, cap 5) — for AI generation
- `thingsToAvoid` (array of strings) — banned phrases for AI generation
- per-skill `weight` (1/2/3) — if skills are currently flat strings
- `coverLetterStyle` / cover-letter scaffolding
- compensation: `equity`, `totalCompFloor`, `negotiable` if not already modeled
- per-document `isDefault`, `usedOnJobIds` (for the "used on N jobs" footer)
- readiness/completeness computation (drives the ring + checklist)

## Files in this bundle

| File | Role |
|------|------|
| `reference/Profile Redesign.html` | The full prototype (all variations on the design canvas). Open in a browser to interact. |
| `reference/profile-anchored.jsx` | **Variation A layout — your primary reference.** |
| `reference/profile-shared.jsx` | Profile primitives + mock `window.PROFILE` data + section registry. |
| `reference/profile-states.jsx` | All interaction-state frames (edit, popover, confirm, upload, integrations, empty, score delta). |
| `reference/profile.css` | Profile-specific CSS surfaces with exact measurements. |
| `reference/styles.css` | Base JobKernel tokens + chrome + buttons/chips/cards (mirrors production). |
| `reference/list.css` | Pulse list styles (source of the band/popover patterns). |
| `reference/shared.jsx` | Shared component library from prior phases (Icon, ScoreRing, etc.). |
| `reference/profile-split.jsx`, `profile-hub.jsx` | Variations B & C — **context only, not built.** |
| `reference/profile-anatomy.jsx` | Two field-row anatomy options — context. |
| `reference/design-canvas.jsx`, `tweaks-panel.jsx` | Prototype harness — **do not port.** |
| `screenshots/variation-a-light.png` | Full-height render of Variation A (light). |
| `screenshots/variation-a-dark.png` | Full-height render of Variation A (dark). |

> Note: the screenshots show Variation A **before** the three required changes (collapsible
> rail, readiness ring always in rail, ⌘K palette). They are the section/visual reference;
> the changes are specced in "Required changes to Variation A" above.

To preview: open `reference/Profile Redesign.html` in a browser. The Tweaks panel (toolbar)
toggles theme/density/completeness/edit-mode and jumps between sections.
