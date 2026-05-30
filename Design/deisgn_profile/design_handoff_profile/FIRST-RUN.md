# JobKernel — Profile FIRST-RUN (empty state) · Claude Code build prompt

This is an **add-on to the Profile screen redesign** (`PROMPT.md` + `README.md` in this
folder). It specs the **first-run / empty profile** — what a brand-new user sees on
`/profile` before any data exists. Build it after (or alongside) the populated Variation A.

## The single most important design decision

**The empty state is the FULL PROFILE PAGE, not a modal or an overlay.** When a new user
opens `/profile`, the entire screen *is* the empty state: the same anchored rail and the
same six sections as the populated profile, each section rendered in its own first-run
"empty" affordance. Nothing floats over anything.

Why this matters for implementation:
- **Do not** build a separate "onboarding modal" component that sits over a blank/blurred
  profile. There is no separate route, no dialog, no wizard overlay.
- The empty state and the populated state are **the same page component** at two ends of a
  spectrum. Each section decides, from the data it's handed, whether to render its populated
  body or its empty affordance. As the user fills sections in, the page fills in **in place** —
  the empty page becomes the populated page with no navigation.
- The rail, topbar, hero, and section order are identical to the populated screen. Only the
  *contents* of each region differ.

Think "Notion/Linear empty states inside a real settings page," not "a setup wizard."

## What the empty page contains (top to bottom)

See `screenshots/empty-profile-light.png` and `empty-profile-dark.png` for the full render,
and `reference/profile-empty.jsx` for exact markup.

1. **Rail (empty variant)**
   - Placeholder avatar (dashed circle + person icon), "Your name / Not set".
   - Readiness ring at a low value (e.g. **8%**) — same ring component, same rail slot as
     populated. (Per the populated spec's required change #2, the ring lives in the rail
     always.)
   - Group label changes from "Profile" to **"Finish setup"**.
   - Every section item shows a **hollow "to-do" dot** pip (instead of a score/count pip).
   - A small tip at the bottom: "Importing a resume fills most of this in one step."

2. **Guidance hero** — a soft `--primary`-tinted card: low readiness ring + "Let's build
   your profile" + one sentence explaining that JobKernel scores/tailors applications
   against the profile, so importing a resume is the fast path. This is the one element
   unique to the empty state (it's replaced by the normal identity hero once populated).

3. **Three start methods** — a 3-up row of cards:
   - **Import a resume** (marked *Fastest*, `is-primary` highlighted) — the recommended path.
   - **Connect LinkedIn** — pull headline/roles/connections.
   - **Fill in manually** — jump to the first section.

4. **Quick wins checklist** — a `PSection` titled "Quick wins" with "0 of N done", listing
   the readiness-bearing tasks and their point impact (`+15`, `+8`, …). This is dismissible
   once the profile crosses a threshold (e.g. ≥80%) and should not reappear.

5. **The six sections, each in first-run empty state** — Identity, Match profile (Career &
   compensation), Skills, AI generation, Documents, Integrations, Account. Each empty section:
   - keeps its normal `PSection` header (icon, title, sub, "Affects matching" chip where
     relevant);
   - renders an **empty zone** instead of fields: an icon, a one-line "why this matters"
     benefit, a **`+N readiness` reward chip**, **ghost skeleton chips** hinting at the
     future filled shape, and its own CTA(s) (e.g. "From resume" + "Add manually");
   - special cases: **Documents** shows a real full dropzone (drag-drop target), not a
     skeleton; **Integrations** shows the connect rows all in `Disconnected` state;
     **Account** shows the **Free** plan with an "Upgrade to Pro" CTA.

## New patterns introduced by the empty state

Two small patterns, both built only from existing tokens:

- **Readiness reward chip** (`.p-reward`) — a tiny `--success` "↑ +N readiness" marker shown
  on each empty zone and in the dropzone. It teaches *why* a section is worth filling without
  nagging copy.
- **Ghost skeleton chips** (`.p-ghost-chip`) — dashed, empty pill outlines that preview the
  shape a section will take once filled (e.g. skill chips, role chips). Purely indicative;
  not interactive.

These are specced in `reference/profile.css` (search `p-empty`, `p-method`, `p-reward`,
`p-ghost`, `is-placeholder`).

## Behavior / logic to implement

- **Per-section empty detection.** Each section renders its empty affordance when its
  backing data is absent (no name → Identity empty; no target roles/comp → Match empty;
  empty skills array → Skills empty; no docs → Documents dropzone; etc.). This is the
  mechanism that makes the page fill in place — there is no separate "is this a new user"
  global flag gating a different screen. (A global `isNew` flag may still drive whether the
  guidance hero + method cards + quick-wins checklist show; see next point.)
- **First-run extras vs. always-on.** The **guidance hero**, **three method cards**, and
  **quick-wins checklist** are first-run scaffolding. Show them while the profile is below a
  completeness threshold; fade them out (and restore the normal identity hero) once the user
  is established. The per-section empty zones, by contrast, can appear any time a section is
  genuinely empty, even for an old account.
- **Import resume / LinkedIn → bulk fill.** "Import a resume" and "Connect LinkedIn" should
  populate multiple sections at once (identity, skills, experience), then animate the
  readiness ring up (reuse the `ScoreDelta` / `score-pop` animation from the populated spec).
- **Readiness math.** The ring value and each `+N` reward come from the same completeness
  calculation. Keep the per-item impact and the ring in sync so finishing a "+15" item moves
  the ring by ~15.
- **Quick-wins "Go →"** links jump to + open the relevant section in edit mode (same
  scroll-to-section behavior as the ⌘K palette in the populated spec — compute offset, use
  `scrollTo`, never `scrollIntoView`).
- **Dismiss quick-wins** persists; don't nag a returning user who dismissed it.

## Out of scope

- Backend resume/LinkedIn parsing — mock the bulk-fill result this round.
- Real OAuth for LinkedIn/integrations — mock connect states.
- A separate onboarding route or wizard — explicitly **not** what this is.

## Files for this add-on

| File | Role |
|------|------|
| `reference/profile-empty.jsx` | **The full empty-page component — your primary reference.** |
| `reference/profile.css` | Now includes the empty/first-run surfaces (`p-empty-*`, `p-method`, `p-reward`, `p-ghost-chip`, `is-placeholder`). |
| `reference/profile-shared.jsx` | `PChecklist`, `ScoreRing`, `PBand`, section registry reused by the empty page. |
| `screenshots/empty-profile-light.png` | Full-height render, light. |
| `screenshots/empty-profile-dark.png` | Full-height render, dark. |
| `reference/Profile Redesign.html` | Prototype. Toggle **Tweaks → Completeness → empty** to see the empty state swap into Variation A *in place*, proving it's the same page. The "First-run · empty profile" canvas section shows it standalone in both themes. |

Read `README.md` (the main spec) for tokens, components, and the populated Variation A this
builds on.
