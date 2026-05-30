# JobKernel — Job Details · Mobile Handoff

This package contains the **mobile (phone) translation** of the existing Job Details Redesign — a phone-sized companion to the desktop layout you already shipped.

It's a **design spec**, not production code: the prototype runs as a self-contained React + Babel HTML page (`Job Details Mobile.html`). The implementation should be ported into your real app stack (React/Next/RN/whatever you're using) by following the patterns in the JSX and CSS files below.

---

## What's in this folder

### Source of truth (the new work)
| File | Purpose |
|---|---|
| `variation-a-mobile.jsx` | The mobile shell + all stage-preview / rollback / confirm logic |
| `mobile.css` | All `.m-*` namespaced styles for the mobile layout (top bar, header card, pipeline strip, substage tabs, preview banner, bottom sheet, sticky CTA, confirm modal) |
| `mobile-app.jsx` | DesignCanvas wrapper showing the 5 mobile artboards (Main / Prioritize / Sheet / Preview / Rollback) |
| `Job Details Mobile.html` | Standalone preview — open this to see the full design in context |

### Existing files (for reference — already in your codebase, included so the preview runs)
| File | Purpose |
|---|---|
| `Job Details Redesign.html` | The original desktop layout you shipped |
| `variation-a.jsx` | Desktop Variation A — patterns the mobile inherits from |
| `shared.jsx` | Shared mock data + primitives (`Icon`, `ScoreRing`, `StatusPill`, `InterestStars`, `DocsCluster`, `CompanyLogo`, `STAGES`, `SAVED_SUBSTAGES`, `BRANCH_STAGES`, etc.) |
| `styles.css` | Shared design tokens (`--primary`, `--bg`, `--bg-card`, dark theme block, etc.). One small change was made here — see "styles.css change" below |
| `app.jsx`, `design-canvas.jsx`, `tweaks-panel.jsx`, `ios-frame.jsx` | Demo scaffolding — **do not port**, these only exist to make the standalone preview work |

### Other
| File | Purpose |
|---|---|
| `preview.png` | Reference screenshot of the full canvas |
| `README.md` | This file |

---

## styles.css change (important)

The desktop dark-theme rules were originally scoped to `.app[data-theme="dark"]`. In this work I broadened them to `:where(.app, .m-app)[data-theme="dark"]` so both shells share the same dark tokens.

If your production app uses a different root class than `.app`, update the selector accordingly (or apply the theme token block to whichever container wraps your view).

---

## Design decisions worth preserving

The mobile design isn't a literal shrink of the desktop. Decisions baked in here that matter for the port:

1. **Pipeline = 4 surfaces, not one rail.** The 240px desktop vertical rail becomes (a) progress dots inside a pipeline card, (b) horizontal substage pill tabs, (c) a bottom sheet for the full rail + end states, (d) a one-line "Viewing X" preview line that appears beneath the dots when previewing.

2. **Two distinct stage concepts.** `currentStageIdx` is your *actual* pipeline position (objective truth, drives the progress-dot fill). `previewIdx` is what you're *looking at* (cheap, reversible). Tapping a dot or sheet row only changes the preview. Pipeline state only mutates via deliberate, named commits.

3. **Three commit paths, all routed through the same `ConfirmModal`:**
   - **Forward** (sticky CTA, e.g. "Generate Application") — no confirm, this is the primary intended action.
   - **Backward** (rollback) — requires confirm modal. Available only when previewing a past stage.
   - **Terminal** (Rejected / Declined / Withdrawn from the sheet's end states) — requires confirm modal.

4. **Sticky bottom CTA owns the primary action.** Don't duplicate it with an inline "Next Action" card on every substage. Only Prioritize keeps the full inline card, because the decision *is* the work there. Other substages get a one-line status hint (`NextHint`).

5. **Docs are a single row of three tinted cards**, not a chips strip. Icon + name + status dot in the top-right. The card tint and dot color carry the state. Tap to act.

6. **Substage tabs are click-drag scrollable on desktop**, swipe scrollable on touch, with an edge-fade mask hint and an auto-scroll-to-active effect.

7. **Preview line sits BELOW the dots, not above.** Tapping a dot shouldn't reflow the row you just tapped.

8. **The current stage title in the pipeline head always reflects your real stage**, never the previewed one. Preview surfaces as a muted secondary line.

9. **Dark theme uses the existing token system.** No new color values — just borrowed the dark block from `styles.css`.

---

## How to verify locally before porting

Drop this whole folder anywhere and open `Job Details Mobile.html` in a browser. You'll see 5 phone frames on a DesignCanvas. Use the Tweaks panel (bottom-right) to toggle dark/light theme and focus on a single artboard.

---

## Integration prompt for Claude Code

Paste the prompt in `INTEGRATION_PROMPT.md` into Claude Code in your repo. It's already tailored to the Vite + React 19 stack and the existing `frontend/src/pages/ApplicationDetail.jsx` / `ApplicationLifecycle.jsx` files, with a token-mapping table from prototype CSS-var names to your real `--bg-card` / `--text-primary` / etc.
