# JobKernel — Profile screen · Claude Code build prompt

You are implementing the **Profile screen redesign** for JobKernel, an AI-powered job
application tracker. This folder is a **design handoff package**. Start here, then read
`README.md` for the full spec.

## What's in this folder

| File | What it is |
|------|-----------|
| `PROMPT.md` | This file — your kickoff brief |
| `README.md` | The full, self-sufficient implementation spec (read this end-to-end) |
| `reference/` | The HTML/JSX design prototype the spec is derived from |

## The most important thing to understand

**The files in `reference/` are design references, not production code.** They were built
as an HTML + inline-Babel-React prototype to communicate *look and behavior*. They are NOT
meant to be copied into the app verbatim. The prototype:

- renders multiple layout options side-by-side on a "design canvas" (pan/zoom shell) — you
  are only building **ONE** of them (Variation A, see below);
- mocks data with a global `window.PROFILE` object — the real app has its own user model;
- uses ad-hoc React-via-CDN — the real app has its own framework, router, and component lib.

**Your job: recreate Variation A in JobKernel's existing codebase, using its established
patterns, component library, state management, and routing.** Match the prototype
pixel-for-pixel on visuals (it is high-fidelity), but express it in the app's real stack.
If a JobKernel design-system component already exists for something here (button, chip,
modal, avatar), use that — don't reintroduce the prototype's bespoke CSS.

## Fidelity: HIGH

Colors, spacing, typography, and interaction states in the reference are final. Reproduce
them exactly. All values are enumerated in `README.md` → Design Tokens. **No new tokens** —
everything maps to existing JobKernel CSS variables (the prototype's `styles.css` mirrors
the production token set; confirm against the real app and use the real vars).

## Build exactly ONE layout: Variation A — "Anchored rail"

The prototype shows three layouts (A anchored-rail, B split-pane, C hub). **The team chose
Variation A.** Ignore B and C except as reference for shared components. Variation A is:

- a **sticky left rail** (240px) with section jump-links, the identity mini-header, and the
  profile-readiness ring;
- a **single-scroll content column** (max-width 920px, centered) holding all six sections
  stacked: Identity → Match profile → Skills → AI generation → Documents → Integrations →
  Account.

Reference source: `reference/profile-anchored.jsx` (the layout) + `reference/profile-shared.jsx`
(the primitives) + `reference/profile-states.jsx` (interaction states) + `reference/profile.css`
(profile-specific surfaces).

## Build Variation A WITH these three changes (not yet in the prototype)

These were agreed after the prototype was made. They are specced in detail in `README.md`
→ "Required changes to Variation A". Summary:

1. **Collapsible rail.** Below a 1280px viewport, collapse the 240px rail to a 60px
   icon-only strip (tooltip labels on hover). Above 1280px, full rail. Persist the
   collapsed/expanded choice.

2. **Readiness ring always in the rail.** The "Profile readiness 78%" ring currently lives
   in the scroll hero. Move it so it is **always visible in the rail** (even when collapsed,
   show the ring without the text). Keep a larger readiness summary in the hero too, but the
   rail is the source of truth the user can always see.

3. **⌘K command palette.** Add a command-palette overlay (Cmd/Ctrl-K) for random access:
   fuzzy-search every field and section ("salary", "default resume", "voice sample"),
   Enter jumps to + focuses that field's section and opens it in edit mode. This is the
   power-user path that lets the single-scroll layout compete with a split-pane on speed.

## Out of scope

- Backend wiring for settings/billing, real OAuth for integrations (mock connect states).
- A standalone Document Library route (Profile links out to it; build the link, not the route).
- Mobile layout (separate workstream — but the rail-collapse behavior should degrade sanely).
- Variations B and C.

## Suggested order of work

1. Read `README.md` fully. Inspect the real JobKernel codebase; find its design-system
   components, the user model, and the Profile route.
2. Map the prototype's tokens to the app's real CSS variables (table in README).
3. Build the rail (collapsible + readiness ring) and the section scaffold.
4. Build the six sections in order, reusing app components.
5. Layer in interaction states (section edit/save-cancel, skill-weight popover, destructive
   confirm, document upload, integration connect, empty state, score-impact preview).
6. Add the ⌘K palette last.
7. Flag every field marked `TODO: backend` in the README — those are proposed new fields on
   the user model that don't exist yet. Confirm with the team before persisting.
