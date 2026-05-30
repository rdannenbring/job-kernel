# Handoff: Kanban / Pipeline Board Redesign

Self-contained spec for replacing the existing kanban view in `frontend/src/pages/Dashboard.jsx` with the new **Focus-stage** board design.

## Read this in order
1. **`CLAUDE_CODE_PROMPT.md`** — paste this verbatim into Claude Code. It contains the implementation instructions.
2. **`SPEC.md`** — the design contract (states, tokens, behaviors). Reference doc.
3. **`prototype/Kanban Board.html`** — open in a browser to see the design live. Drag the canvas to pan; click an artboard to focus.

## Status of these files
The files in `prototype/` are **design references**, not production code to copy directly. They are React-via-Babel prototypes that render in a single HTML page so the design could be reviewed and tweaked. The implementation task is to **recreate this design inside the existing `Dashboard.jsx` kanban view** — keep the live data layer, the existing DnD wiring, the existing filters/sort/search state, and the existing CSS variable system (`--primary`, `--text-primary`, etc., as defined in `frontend/src/index.css`).

## Fidelity
**High-fidelity.** Colors, type, spacing, density, drop-target tints, drag preview, confirm modal, undo toast, multi-select bar, empty states, and theme parity are all final. Apply them pixel-equivalent inside the codebase's existing token system.

## What is the chosen direction?
The **Focus-stage + spines** layout (Layout C in the prototype). One pipeline stage is the wide "focus" column with rich cards; the other stages collapse to narrow vertical spines with mini-thumbnails. Click a spine to refocus.

- **Default focus on load:** `Inbox` (the new pre-pipeline triage column for fresh extension captures).
- **End-states** (Rejected/Declined/Withdrawn) live as a single muted spine at the right edge. Clicking it opens an end-state focus column with tabs for the three terminal stages, in-place where the spine lives.

Layouts A (Classic columns + end-state shelf) and B (Population-weighted columns + drawer) are included in the prototype for context only; they are not the direction selected. Do not ship them.
