# Claude Code kickoff prompt — JobKernel "Discover" (Job Search & Listings)

Paste the block below into Claude Code from the **root of the JobKernel repo**, with this
`design_handoff_discover/` folder present. Adjust the framework/path lines if your structure
differs.

---

You are implementing a redesign of the **Discover** (Job Search & Listings) page in the
JobKernel app — a React/Vite job-application tracker with a CSS-variable design system,
light/dark themes, and Material Symbols icons.

**Read `design_handoff_discover/README.md` first, in full.** It is the source of truth for
layout, components, tokens, interactions, and state. Then open the HTML prototype it
describes (`design_handoff_discover/Job Search Redesign.html`) to see the intended look and
behavior on its design canvas.

Important framing:
- The files in `design_handoff_discover/` are **design references** (HTML + React-via-Babel
  prototypes). They are **not** code to copy verbatim. `design-canvas.jsx`, `tweaks-panel.jsx`,
  and `search-app.jsx` are presentation scaffolding — **do not ship them**.
- **Recreate the design inside this codebase** using its existing components, real CSS-variable
  tokens, router, and data layer. JobKernel already has most primitives (ScoreRing, chips,
  salary-chip, buttons, popovers, modals, the Pulse row vocabulary, the "Affects matching"
  MatchChip, Profile's empty-state cards, the 60px-nav + 48px-topbar chrome). **Reuse them.**
  The README has a "Reuse what already exists" table. The only genuinely new stylesheet is the
  Discover-specific surface CSS (see `search.css` for exact values) — and it introduces **no
  new design tokens**.
- The mock data in `search-data.jsx` is illustrative. Wire the **real** listing-source feeds
  (Adzuna · JSearch · TheMuse · RemoteOK) and the existing **Profile match-score engine** (the
  same one behind Job Details' compatibility score). Anything not yet in the backend is flagged
  `// TODO: backend` — surface those to me rather than inventing fields.

Scope for this pass:
1. Discover route inside the existing app chrome (own nav item, `Dashboard / Discover` crumb).
2. The 3-column grid shell (saved-search rail · query+sources+filters+results · detail pane),
   independent scroll regions, and graceful ≤1200px collapse (rail → drawer, pane → overlay).
3. **Result row** as the centerpiece — a sibling of the Pulse row: ScoreRing, company/role,
   work-model badge + location + salary chip + **source badge** + match-band chip, 2-line
   excerpt, Process / Save / Dismiss. Three densities + saved / dismissed / **deduped** states.
4. Query bar + **sources health strip** (per-source status + partial-failure handling) + filter
   chip bar + **match-score threshold** filter (labelled with the "Affects matching" chip,
   pointing back to Profile).
5. **Detail pane** (slide-in, drag-to-resize 320–620px) with the **"Why this matches you"**
   breakdown (5 dimensions + fit/gap notes + a Profile nudge), source provenance, the listing,
   and a primary "Save to pipeline" action.
6. **States:** streaming-per-source, partial-source failure, saving→tracked, zero results,
   no-query first-run, no-sources-connected (links to Profile › Integrations).
7. Full light/dark parity via the existing `data-theme` token system.

Defaults to honor: primary layout is **Variation A** (list + on-demand slide-in pane). Match
score is the primary sort, shows per row, and is a threshold filter. Dedup **merges** duplicate
postings into one row with stacked source badges (`// TODO: backend` for the merge rule).
Saved searches + alerts are in scope. Process Now = save to pipeline **and** run analysis.

Before writing code: inspect the repo, tell me which existing components/tokens you'll reuse
vs. what you'll build new, propose a component tree + file plan for the Discover route, and
flag every `// TODO: backend` you'll need from me. Then implement in the build order suggested
at the end of the README. Keep components small and match the codebase's existing conventions.
