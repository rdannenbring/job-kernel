# JobKernel — List View handoff package

This folder is everything Claude Code needs to update the JobKernel Dashboard List view to the new **Pulse** design.

## What to do

1. Open `PROMPT.md`. That's the instruction document — paste it into Claude Code at the start of the session.
2. Make sure the local repo (`JobApplicationAutomator/`) is mounted in the Claude Code session so it can edit `frontend/src/pages/Dashboard.jsx` and create new files under `frontend/src/components/List/`.
3. Make sure this `handoff_list_view/` folder is also accessible — the prompt references files in `handoff_list_view/design_reference/`.

## Contents

```
handoff_list_view/
├── PROMPT.md                          ← The prompt for Claude Code (paste this in)
├── README.md                          ← This file
├── design_reference/                  ← The full Pulse design as an HTML prototype
│   ├── Job List.html                  ← Open in a browser to see the design canvas
│   ├── list-pulse.jsx                 ← THE Pulse layout — primary reference
│   ├── list-shared.jsx                ← Shared list primitives + L_COLUMNS column model
│   ├── list-states.jsx                ← Every interaction state (hover · select · popover · modal · etc.)
│   ├── list.css                       ← All list-specific styles
│   ├── styles.css                     ← Existing JobKernel tokens this design depends on
│   ├── shared.jsx                     ← Existing shared primitives (Icon · ScoreRing · etc.)
│   ├── kanban-data.jsx                ← Mock dataset — shows the row data shape
│   ├── list-classic.jsx               ← (Earlier alternate — do not port)
│   └── list-grouped.jsx               ← (Earlier alternate — do not port)
└── screenshots/
    └── 01-pulse-overview.png          ← Quick visual reference
```

## TL;DR for the engineer

- The chosen layout is **Pulse** (`list-pulse.jsx`).
- The Stage column is replaced with a **horizontal pipeline strip** per row.
- **Grouping is OFF by default**; users opt in via a dropdown with **7 modes**: Urgency · Stage · Interest · Location · Next action · Source · No grouping.
- Rows expand inline to show a 3-card compressed Job Details preview.
- Selection → sticky bulk bar; Backward/terminal stage moves → reuse the existing Kanban `ConfirmModal`.
- Light + dark theme parity from day one. No new design tokens.

See `PROMPT.md` for the full spec.
