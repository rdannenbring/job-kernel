# Claude Code Prompt — Kanban / Pipeline Board Redesign

Paste the text below into Claude Code (in the repo root). The prompt assumes Claude Code has read access to the whole repo and to this `design_handoff_kanban/` folder.

---

## Prompt

I'm replacing the existing kanban view on the Dashboard with a new "Focus stage + spines" design. The full spec lives in `design_handoff_kanban/SPEC.md` and a working HTML prototype is at `design_handoff_kanban/prototype/Kanban Board.html`. Read both before you start.

### Goal

Replace the `viewMode === 'kanban'` block in `frontend/src/pages/Dashboard.jsx` (starts around line 942) with a new layout where:

1. **One pipeline stage is the wide focus column.** The other stages collapse to narrow vertical spines on the right.
2. **Default focus on first load is `Inbox`** — a new pre-pipeline triage column for fresh extension captures. (See "Inbox stage" below for handling this without a backend change.)
3. **End-states (Rejected/Declined/Withdrawn) are a single muted spine at the right edge** with diagonal hatching and a dashed border. Clicking it expands a focus column in-place (NOT on the far left — render it as the last child of the focus row) with tabs for the three terminal stages and a close `×` that returns focus to Inbox.

### Hard constraints

- **Do not break the existing data layer.** Keep using `apps`, `onUpdate`, `onViewApp`, `onStartNew`, `onStatusUpdate` props as-is. Keep the existing filter / sort / search state (`searchTerm`, `filterStatuses`, `filterJobTypes`, `filterLocationTypes`, `filterInterestLevels`, `filterRelocation`, `filterHasConnections`, `filterMinScore`, `sortBy`).
- **Keep the existing HTML5 DnD handlers** (`onDragStart`, `onDragEnd`, `onDragOver`, `onDrop`, `onCardDragOver`, `onDragLeave`). Re-wire them onto the spines and the focus column body. They already write `{ status, kanban_order }` via `onUpdate` — keep that contract.
- **Default sort changes to `Last activity`.** Add it as a new option if it isn't there; pick the most recent of `last_activity_at`, `updated_at`, or `date_saved` as the comparison key.
- **No new dependencies.** No drag library, no UI lib. Use React 19 + Tailwind v4 + the existing CSS variables in `frontend/src/index.css`. The card and column styles in `prototype/kanban.css` should be ported either to Tailwind utility classes (preferred — the codebase already uses them heavily inline) or to a new `Dashboard.kanban.css` co-located with `Dashboard.css`.
- **Don't introduce new design tokens.** Map prototype tokens to existing ones per the table in `SPEC.md` § "Tokens used".
- **Don't ship Manrope.** Keep Inter (already loaded). The prototype uses Manrope; ignore that font choice.
- **Don't ship the prototype's `design-canvas.jsx`, `tweaks-panel.jsx`, or `kanban-app.jsx` files** — they are scaffolding for the design tool, not the app.
- **Do not ship Layouts A (Classic columns) or B (Hierarchy). Only Layout C (Focus stage + spines).**

### Inbox stage — handling without a backend change

`Inbox` is the leftmost stage but doesn't currently exist in the backend's `status` enum. **Treat it as a derived state** for now:

```js
function deriveStage(app) {
  // If the app has no analysis yet (no match_score AND no resume_changes_summary AND
  // status is unset or "Saved"), treat it as Inbox. Otherwise use getStatusText(app).
  const isUnanalyzed =
    (app.match_score == null) &&
    !app.resume_changes_summary &&
    (!app.status || app.status === 'Saved');
  if (isUnanalyzed) return 'Inbox';
  return getStatusText(app);
}
```

When the user drags a card OUT of Inbox, write `status: 'Saved'` (or whatever the target is). When the user drags a card INTO Inbox, you can't (Inbox is a derived state). Make the Inbox spine NOT accept drops; only display the drop-not-allowed cursor. Leave a TODO for adding `Inbox` as a real backend enum value in a follow-up.

### Substage progress on cards

Cards show a substage progress dot row (or segmented bar in cozy density). The substage counts per stage are in `SPEC.md`. If `app.sub_stage_index` doesn't exist on the data model, fall back to `0` and add a TODO. Don't crash if a stage has no substages (Inbox has 0 — just hide the row).

### Drop confirms

Three behaviors, all already specced. Implement them as small components co-located with the new kanban code:

- **Forward move** — commit immediately. No prompt.
- **Back-move** — commit optimistically, show a `<KanbanUndoToast>` pinned at the bottom of the board with a 5s countdown ring and an Undo button. If Undo, revert via `onUpdate` to the previous status. See `prototype/kanban-primitives.jsx` → `KToast`.
- **Terminal stage drop** — open a `<KanbanConfirmModal>` overlay before commit. See `prototype/kanban-primitives.jsx` → `KConfirmModal`. Don't write any data until the user confirms.

### Multi-select

`⌘/Ctrl + click` toggles selection. Render a dark pill action bar at the bottom of the board when ≥ 1 card is selected. See `prototype/kanban-primitives.jsx` → `KBulkBar`. Wire the "Move to…" menu to call `onUpdate` for each selected app; "Mark rejected" opens the same `KanbanConfirmModal` with a "<N> applications" summary.

### Filter bar

Replace the existing filter bar's visual treatment to match `prototype/kanban-primitives.jsx` → `KFilterBar`. Keep the existing filter state and `processedApps` filter logic intact — only the visual chip / sort / density-toggle treatment changes. Add the **density toggle** (compact / comfy / cozy) and persist it to `localStorage` under key `kanban_density`. The density toggle drives:
- Compact → use the single-row compact card (`KCardC` in prototype), show up to 14 cards per spine thumbnail stack, no hint footer.
- Comfy (default) → standard card (`KCardA`).
- Cozy → ScoreRing-forward card (`KCardB`).

### Order of work

1. **Read** `design_handoff_kanban/SPEC.md` and `design_handoff_kanban/prototype/Kanban Board.html`. Open the HTML in a browser to see the design.
2. **Plan a refactor** of `Dashboard.jsx` — the file is 1293 lines and the kanban block is mid-file. Extract the new kanban view into a new `frontend/src/components/Kanban/` folder:
   - `Kanban/index.jsx` — top-level export. Receives the same props the existing kanban needs (`apps`, `onUpdate`, `onViewApp`, filter state).
   - `Kanban/FocusColumn.jsx` — the wide focus column (active stages + Inbox).
   - `Kanban/EndStateFocus.jsx` — the end-states variant of the focus column with tabs.
   - `Kanban/Spine.jsx` — one stage spine (collapsed column).
   - `Kanban/EndStateSpine.jsx` — the muted end-states spine at the right edge.
   - `Kanban/Card.jsx` — the standard, score-forward, and compact card variants. Density picks which.
   - `Kanban/FilterBar.jsx` — filter chips + sort + density toggle.
   - `Kanban/ConfirmModal.jsx` — terminal-drop confirm.
   - `Kanban/UndoToast.jsx` — back-move toast with countdown.
   - `Kanban/BulkBar.jsx` — multi-select action bar.
   - `Kanban/EmptyState.jsx` — per-stage empty state.
   - `Kanban/stages.js` — `KANBAN_COLUMNS`, `TERMINAL_COLUMNS`, `SUBSTAGE_COUNTS`, helpers like `stageIndex`, `isTerminal`, `isBack`, `isForward`, `deriveStage`.
   - `Kanban/Kanban.module.css` (or just Tailwind — your call; pick whichever fits the repo better).
3. **Replace** the `viewMode === 'kanban' && <div ref={boardRef}>…</div>` block in `Dashboard.jsx` with `<Kanban apps={processedApps} onUpdate={onUpdate} onViewApp={onViewApp} sortBy={sortBy} setSortBy={setSortBy} />`. Keep the wrapper that handles pan-on-mousedown — but only enable panning on empty space, not over the focus column body.
4. **Re-wire** the DnD onto spines and the focus body. The dropped-into stage is the spine's stage (or the focus column's stage). Run the existing back-move / forward / terminal classification BEFORE calling `onUpdate`; route to toast / modal accordingly.
5. **Test paths**:
   - Drag a card from Applied focus to the Saved spine → toast appears, Undo reverts.
   - Drag a card from Applied focus to the Interviewing spine → no prompt, immediate commit.
   - Drag a card to the end-states spine → modal opens, on confirm card moves to Rejected (default for ambiguous drops).
   - Click the end-states spine → end-state focus column appears IN THE RIGHTMOST POSITION (not the far left), Rejected tab active by default, `×` returns to Inbox.
   - Default board on load = Inbox focused; cards in Inbox are derived per `deriveStage`.
   - Cmd+click 3 cards → bulk bar appears.
   - Toggle density compact/comfy/cozy → card shape and spine thumbnail count change; setting persists across reload.
   - Light + dark theme both render cleanly (the existing toggle drives `[data-theme]` on the html element).
6. **Don't regress** the list view (`viewMode === 'list'`) — leave that block intact.

### What to NOT do

- Don't migrate the list view, the analytics integration, the mobile capture flow, or the job detail screen.
- Don't add Inbox as a backend enum or change `KANBAN_COLUMNS` on the backend.
- Don't add bulk-move animations beyond what's specified.
- Don't add a virtualized scroll. The spines cap at 8 thumbnails + overflow indicator; the focus grid can paginate or use native scroll past 50 cards.

### Done criteria

- `viewMode === 'kanban'` renders the new design end-to-end with live data.
- All three drop-confirm behaviors work and write the right data.
- Filter / sort / search / density all work and persist.
- No console errors, no React key warnings, no Tailwind purge misses.
- Light + dark both pass a visual eyeball test against the prototype.
- `pnpm test` (or `npm test`) passes.

Start by reading `SPEC.md` end-to-end, then propose a file-by-file plan before writing any code. Wait for my approval on the plan before making changes.
