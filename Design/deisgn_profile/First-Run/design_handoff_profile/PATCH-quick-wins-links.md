# JobKernel — Profile Quick-wins checklist · link affordance · Claude Code patch

A **small, targeted change** to the first-run profile's **Quick wins** checklist. The
empty/first-run profile is already implemented; this only updates how the checklist rows
communicate that they are **navigation links** to the sections they reference.

## Why

Incomplete checklist rows jump the user to the relevant section (in edit mode) when clicked.
Relying on the pointer cursor alone is insufficient — a finger cursor only appears *after*
the user hovers, so a row gives no signal at rest that it's actionable. The rows now carry
**at-rest** link affordances, reinforced on hover.

## The change

Differentiate **done** rows (terminal, not clickable) from **to-do** rows (links), and make
the to-do affordance visible before any interaction.

### To-do rows (incomplete items) — interactive links
- hollow primary-color circle icon (`radio_button_unchecked`, `--primary`)
- full-strength label (`--txt`, **not** muted)
- impact pill in `--primary` (e.g. `+8`)
- **trailing chevron `›`** (`chevron_right`) in a muted tone — **visible at rest**; this is
  the primary "this navigates" cue
- `cursor: pointer`
- **Hover:** row background fills (`--bg-hover`), bottom border hides, label turns
  `--primary`, the chevron nudges right (`translateX(3px)`) and turns `--primary`, and the
  word **"Complete"** slides in immediately before the chevron (width/opacity transition)
- **Click:** jump to + open that section in edit mode. Compute the scroll offset and use
  `scrollTo` on the content column — **never `scrollIntoView`** (it breaks the app shell).
  Same scroll-to-section behavior as the ⌘K palette.

### Done rows (completed items) — terminal, not interactive
- filled green check (`check_circle`, `--success`)
- muted label (`--txt-mute`)
- muted/low-opacity `+N` in `--success`
- **no chevron**, `cursor: default`, no hover state

## Reference implementation

In this bundle:
- `reference/profile-shared.jsx` → `PChecklist` component (the markup: `cl-label`, `impact`,
  and the `go` group containing `label-go` + chevron icon).
- `reference/profile.css` → `.p-checklist` / `.p-checklist-item` and its `.is-todo` /
  `.is-done` variants (exact spacing, transitions, hover rules).
- `screenshots/empty-profile-light.png` / `-dark.png` → the Quick wins card in context
  (done rows on top, to-do rows with chevrons at the bottom).

## ⚠️ Naming gotcha (important)

The row label uses the class **`cl-label`**, NOT `label`. JobKernel's design system has a
global `.label` utility that forces `text-transform: uppercase` + letter-spacing (micro-caps).
Using `.label` here makes the checklist text render in all-caps. Use a scoped class name
(`cl-label` or your stack's equivalent) for the checklist label. Watch for the same
collision anywhere you add a plain text label inside a component.

## Scope

- Visual + interaction affordance only. The underlying "click jumps to section in edit mode"
  behavior is the same nav action already specced for the first-run checklist and ⌘K.
- No token changes — uses existing `--primary`, `--success`, `--txt*`, `--bg-hover`.

## Also fixed: first-run checklist should show TO-DO rows

In the first-run/empty state a brand-new user has completed nothing, so **every Quick-wins
row must render as a to-do (link) row** — header reads "0 of N done". (The prototype
previously sliced the first N mock items, which happened to be the *completed* ones, showing
zero links — wrong for a new user.) In production this is automatic: completion comes from
the user's real data, so a fresh account naturally yields all to-do rows. Just make sure the
empty state isn't seeded with pre-completed items. The `PChecklist` reference accepts a
`forceTodo` flag the prototype uses to simulate the brand-new user.
