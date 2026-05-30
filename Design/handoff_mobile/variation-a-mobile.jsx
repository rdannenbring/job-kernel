/* global React */
/* eslint-disable no-undef */

// ─── Variation A — Mobile ──────────────────────────────────────
// Phone translation of the desktop "Header card + Vertical pipeline" pattern.
//
// What changes for phone:
//   • Top app bar replaces the side nav (back / breadcrumb / overflow).
//   • Header card densifies — meta becomes a 2-col grid; docs become
//     horizontal-scrolling chips (no truncation).
//   • The 240px vertical rail collapses into a "stage strip" card —
//     a progress-dot row + the active stage's substages as horizontal
//     pill tabs. The FULL pipeline (with end states pinned at bottom)
//     lives in a bottom sheet you open from "All stages".
//   • Next Action becomes its own banner card above the substage content.
//   • A sticky bottom CTA bar surfaces the primary action without
//     hunting through the scroll.

function VariationAMobile({
  theme = 'dark', view = 'main', initialSub = 'analysis',
  // Demo overrides — let artboards showcase preview / rollback states
  // that aren't reachable from the default "currentStageIdx = 0" mock.
  mockCurrent, initialPreview, initialConfirm,
}) {
  // view: 'main' | 'sheet' | 'prioritize'
  //
  // Stage state is split into two:
  //   currentStageIdx — where the user *actually is* in the pipeline.
  //     Only changes via deliberate commit actions (sticky CTA, rollback
  //     confirm, end-state confirm). Drives the progress-dot fill.
  //   previewIdx — which stage's content the user is *looking at*.
  //     Cheap to change (tap any dot or sheet row). Read-only.
  // When the two diverge, a preview banner appears with a Back button and,
  // for past-stage previews, a "Move pipeline back" rollback action.
  const [currentStageIdx, setCurrentStageIdx] = React.useState(mockCurrent ?? 0);
  const [previewIdx, setPreviewIdx] = React.useState(initialPreview ?? mockCurrent ?? 0);
  const [activeSub, setActiveSub] = React.useState(view === 'prioritize' ? 'prioritize' : initialSub);
  const [interest, setInterest] = React.useState(2);
  const [sheetOpen, setSheetOpen] = React.useState(view === 'sheet');
  const [confirm, setConfirm] = React.useState(null); // { title, body, primary, onConfirm, destructive }

  const isPreviewing = previewIdx !== currentStageIdx;
  const isPastPreview = previewIdx < currentStageIdx;
  const currentStage = window.STAGES[currentStageIdx];
  const previewStage = window.STAGES[previewIdx];

  const askRollback = () => setConfirm({
    title: 'Move pipeline back?',
    body: `This moves the application from ${currentStage.label} back to ${previewStage.label}. Progress in later stages will be preserved, but ${currentStage.label}'s active state will reset.`,
    primary: `Move back to ${previewStage.label}`,
    destructive: true,
    onConfirm: () => { setCurrentStageIdx(previewIdx); setConfirm(null); },
  });
  const askEndState = (branch) => setConfirm({
    title: `Mark as ${branch.label}?`,
    body: `Move this application to ${branch.label}. This is a terminal state — the pipeline will close and no further actions will be taken.`,
    primary: `Mark as ${branch.label}`,
    destructive: true,
    onConfirm: () => { setConfirm(null); setSheetOpen(false); /* demo: no-op */ },
  });

  // Demo: open the confirm modal on mount if requested (artboard 05).
  React.useEffect(() => {
    if (initialConfirm === 'rollback') askRollback();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Refs for the horizontally-scrolling substage tab strip — used to
  // scroll the active pill into view whenever it changes (also fires on
  // initial mount so the Prioritize-default artboard lands with the
  // right-most tab visible without a manual swipe).
  const substageScrollRef = React.useRef(null);
  const substageTabRefs = React.useRef({});
  React.useEffect(() => {
    const tab = substageTabRefs.current[activeSub];
    const scroller = substageScrollRef.current;
    if (!tab || !scroller) return;
    const tabLeft = tab.offsetLeft;
    const tabRight = tabLeft + tab.offsetWidth;
    const viewLeft = scroller.scrollLeft;
    const viewRight = viewLeft + scroller.clientWidth;
    if (tabLeft < viewLeft + 14) {
      scroller.scrollTo({ left: Math.max(0, tabLeft - 14), behavior: 'smooth' });
    } else if (tabRight > viewRight - 14) {
      scroller.scrollTo({ left: tabRight - scroller.clientWidth + 14, behavior: 'smooth' });
    }
  }, [activeSub]);

  // Drag-to-scroll on the substage strip — on touch this comes for free
  // via overflow-x, but on desktop (mouse) there's no built-in handler.
  // We watch mousedown/move/up on the scroller and translate drag delta
  // into scrollLeft, suppressing the click that would otherwise select a
  // tab if the user actually dragged (threshold: 5px).
  React.useEffect(() => {
    const el = substageScrollRef.current;
    if (!el) return;
    let down = false, startX = 0, startScroll = 0, moved = false;
    const onDown = (e) => {
      down = true; moved = false;
      startX = e.pageX; startScroll = el.scrollLeft;
      el.classList.add('is-dragging');
    };
    const onMove = (e) => {
      if (!down) return;
      const dx = e.pageX - startX;
      if (Math.abs(dx) > 5) moved = true;
      el.scrollLeft = startScroll - dx;
    };
    const stop = () => {
      down = false;
      el.classList.remove('is-dragging');
      // Clear `moved` on next tick so the click suppressor can still see it
      setTimeout(() => { moved = false; }, 0);
    };
    // Capture-phase click suppression — runs before the tab's own onClick
    const onClick = (e) => {
      if (moved) { e.preventDefault(); e.stopPropagation(); }
    };
    el.addEventListener('mousedown', onDown);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', stop);
    el.addEventListener('click', onClick, true);
    return () => {
      el.removeEventListener('mousedown', onDown);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', stop);
      el.removeEventListener('click', onClick, true);
    };
  }, []);

  const salary = '$185k – $240k';

  const meta = [
    { icon: 'location_on', label: 'US · Remote' },
    { icon: 'work', label: 'Full-time' },
    { icon: 'event', label: 'Posted 5/16' },
    { icon: 'open_in_new', label: 'Visit listing', link: true },
  ];

  return (
    <div className="m-app" data-theme={theme}>
      {/* ── Top app bar ── */}
      <div className="m-topbar">
        <button className="m-iconbtn" aria-label="Back">
          <Icon name="arrow_back" size={20} />
        </button>
        <div className="m-crumb">
          <span className="m-crumb-eyebrow">PRI Technology</span>
          <span className="m-crumb-name">Senior Lead Software Architect</span>
        </div>
        <button className="m-iconbtn" aria-label="More">
          <Icon name="more_vert" size={20} />
        </button>
      </div>

      {/* ── Scroll body ── */}
      <div className="m-scroll">

        {/* Header card */}
        <div className="m-header">
          <div className="m-header-top">
            <CompanyLogo size={46} initials="PRI" />
            <div className="flex-1" style={{ minWidth: 0 }}>
              <h1 className="m-header-title">Senior Lead Software Architect</h1>
              <div className="m-header-company">
                PRI Technology
                <Icon name="arrow_outward" size={12} className="arrow" />
              </div>
            </div>
            <ScoreRing score={86} size={48} />
          </div>

          {/* Status + salary + interest */}
          <div className="m-pill-row">
            <StatusPill status="Saved" />
            <span className="salary-chip">
              <Icon name="payments" size={12} fill />
              {salary}
            </span>
            <div className="row gap-2" style={{ marginLeft: 'auto', alignItems: 'center' }}>
              <span className="label" style={{ fontSize: 9 }}>Interest</span>
              <InterestStars value={interest} onChange={setInterest} size={14} />
            </div>
          </div>

          {/* Meta grid */}
          <div className="m-meta-grid">
            {meta.map((m, i) => (
              <div key={i} className={`m-meta-item ${m.link ? 'is-link' : ''}`}>
                <Icon name={m.icon} size={13} />
                <span>{m.label}</span>
              </div>
            ))}
          </div>

          <div className="m-header-divider" />

          {/* Docs — condensed: tinted icon + name + status dot. The card
              tint + dot color carry the state, so no separate label row. */}
          <div className="m-docs-row">
            {window.DOCS.map(d => (
              <button key={d.id} className={`m-doc is-${d.state}`} title={`${d.name} — ${d.detail}`}>
                <span className="m-doc-icon"><Icon name={d.icon} size={12} /></span>
                <span className="m-doc-name">{d.name}</span>
                <span className="m-doc-dot" />
              </button>
            ))}
          </div>

          <button className="m-view-details">
            <Icon name="article" size={14} /> View full job details
            <Icon name="chevron_right" size={14} />
          </button>
        </div>

        {/* Pipeline strip */}
        <div className="m-pipe">
          <div className="m-pipe-head">
            <div className="m-pipe-stage">
              <span className="m-pipe-stage-name">{currentStage.label}</span>
              <span className="m-pipe-stage-progress">
                Step {currentStageIdx + 1} of {window.STAGES.length}
              </span>
            </div>
            <button className="m-pipe-expand" onClick={() => setSheetOpen(true)}>
              All stages
              <Icon name="expand_more" size={12} />
            </button>
          </div>

          {/* Each dot segment is tappable — preview that stage. The fill
              always reflects currentStageIdx (objective truth); the ring
              shows what's being previewed. */}
          <div className="m-pipe-dots" role="tablist" aria-label="Pipeline stages">
            {window.STAGES.map((s, i) => {
              const passed = i < currentStageIdx;
              const current = i === currentStageIdx;
              const previewing = i === previewIdx && isPreviewing;
              const cls = [
                passed ? 'is-passed' : current ? 'is-current' : '',
                previewing ? 'is-previewing' : '',
              ].filter(Boolean).join(' ');
              return (
                <button key={s.id} className={`m-pipe-dot ${cls}`}
                  onClick={() => setPreviewIdx(i)}
                  aria-label={`${s.label} stage`}
                  aria-pressed={i === previewIdx} />
              );
            })}
          </div>

          {/* Secondary identity line — only when previewing. Sits BELOW the
              dots so tapping a dot doesn't push the dots themselves down.
              Greyed so the current stage stays the visual anchor. The ×
              dismisses the preview and snaps back to current. */}
          {isPreviewing && (
            <div className={`m-pipe-preview-line ${isPastPreview ? 'is-past' : 'is-future'}`}>
              <Icon name="visibility" size={12} />
              <span>Viewing <b>{previewStage.label}</b></span>
              <button className="m-pipe-preview-close"
                onClick={() => setPreviewIdx(currentStageIdx)}
                aria-label="Close preview">
                <Icon name="close" size={14} />
              </button>
            </div>
          )}

          {/* Substage tabs — only shown for the user's actual current stage,
              since we only have substage data + content for there. Other
              stages show a clean "preview only" message in the workspace. */}
          {!isPreviewing && (
            <div className="m-substage-tabs-wrap">
              <div className="m-substage-tabs" ref={substageScrollRef}>
                {window.SAVED_SUBSTAGES.map(ss => (
                  <button key={ss.id}
                    ref={el => substageTabRefs.current[ss.id] = el}
                    onClick={() => setActiveSub(ss.id)}
                    className={`m-substage-tab ${ss.id === activeSub ? 'is-active' : ''} ${ss.done ? 'is-done' : ''}`}>
                    <Icon name={ss.done ? 'check_circle' : ss.icon} size={12}
                      className={ss.done ? 'check' : ''} fill={ss.id === activeSub || ss.done} />
                    {ss.label.replace(' (parsed)', '')}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Workspace: live content for current stage, preview placeholder
            for any other stage. */}
        {!isPreviewing ? (
          <>
            {activeSub !== 'prioritize' && <NextHint activeSubId={activeSub} />}
            <SubStageContentMobile activeSubId={activeSub} />
          </>
        ) : (
          <StagePreviewCard
            stage={previewStage}
            isPast={isPastPreview}
            onBack={() => setPreviewIdx(currentStageIdx)}
            onRollback={askRollback}
          />
        )}

      </div>

      {/* ── Sticky bottom CTA ── */}
      <div className="m-cta-bar">
        <button className="btn btn-primary">
          <Icon name="auto_awesome" size={15} fill />
          Generate Application
        </button>
        <button className="btn" aria-label="More actions">
          <Icon name="more_horiz" size={16} />
        </button>
      </div>

      {/* ── Pipeline sheet ── */}
      {sheetOpen && (
        <>
          <div className="m-sheet-backdrop" onClick={() => setSheetOpen(false)} />
          <div className="m-sheet">
            <div className="m-sheet-handle" />
            <div className="m-sheet-head">
              <span className="m-sheet-title">Pipeline</span>
              <button className="m-iconbtn" onClick={() => setSheetOpen(false)} aria-label="Close">
                <Icon name="close" size={20} />
              </button>
            </div>
            <div className="m-sheet-body">
              <div className="vrail">
                {window.STAGES.map((s, i) => {
                  const passed = i < currentStageIdx;
                  const current = i === currentStageIdx;
                  const previewing = i === previewIdx;
                  const cls = [
                    passed ? 'is-passed' : current ? 'is-current' : '',
                    previewing && !current ? 'is-previewing' : '',
                  ].filter(Boolean).join(' ');
                  return (
                    <React.Fragment key={s.id}>
                      <div className={`vstep ${cls}`}
                        onClick={() => { setPreviewIdx(i); setSheetOpen(false); }}>
                        <div className="vnode" />
                        <div className="vname">{s.label}</div>
                        <div className="vsub">
                          {s.subDone}/{s.subCount}
                          {current ? ' · in progress' : passed ? ' · done' : ''}
                          {previewing && !current ? ' · previewing' : ''}
                        </div>
                      </div>
                      {current && (
                        <div className="vsubs">
                          {window.SAVED_SUBSTAGES.map(ss => (
                            <div key={ss.id}
                              onClick={(e) => { e.stopPropagation(); setActiveSub(ss.id); setPreviewIdx(currentStageIdx); setSheetOpen(false); }}
                              className={`vsub ${ss.id === activeSub ? 'is-active' : ''} ${ss.done ? 'is-done' : ''}`}>
                              <Icon name={ss.done ? 'check_circle' : ss.icon} size={13}
                                className={ss.done ? 'check' : ''} fill={ss.id === activeSub} />
                              <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {ss.label}
                              </span>
                              {ss.current && <span className="pip" style={{ color: 'var(--primary)' }}>•</span>}
                            </div>
                          ))}
                        </div>
                      )}
                    </React.Fragment>
                  );
                })}
              </div>

              <div className="rail-divider"><span>End states</span></div>
              <div className="col" style={{ gap: 2 }}>
                {window.BRANCH_STAGES.map(b => (
                  <button key={b.id} className="end-state" onClick={() => askEndState(b)}>
                    <Icon name={b.icon} size={14} />
                    <span style={{ flex: 1, textAlign: 'left' }}>{b.label}</span>
                    <Icon name="arrow_outward" size={12} className="end-state-arrow" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── Confirmation modal ── */}
      {confirm && (
        <ConfirmModal config={confirm} onCancel={() => setConfirm(null)} />
      )}
    </div>
  );
}

// ─── Stage preview card ────────────────────────────────────────
// Shown in the workspace when the user is previewing a stage other than
// their current one. Read-only: structure only, no fake data.
function StagePreviewCard({ stage, isPast, onBack, onRollback }) {
  return (
    <div className="m-card m-preview-card">
      <div className="m-preview-card-eyebrow">
        <Icon name="visibility" size={12} /> Preview
      </div>
      <div className="m-preview-card-head">
        <div className="m-preview-card-icon"><Icon name={stage.icon} size={22} /></div>
        <div style={{ minWidth: 0 }}>
          <h3 className="m-card-title">{stage.label}</h3>
          <div className="m-card-subtitle">
            {isPast
              ? `Completed earlier in your journey · ${stage.subCount} substages`
              : `Upcoming stage · ${stage.subCount} substages will activate when you reach it`}
          </div>
        </div>
      </div>
      <div className="m-preview-card-meta">
        {isPast
          ? 'You can move the pipeline back to this stage if you need to reopen earlier work. Any progress in later stages will be preserved.'
          : 'Substages and content will appear here once you advance the pipeline. Use the action below to reach this stage through the normal workflow.'}
      </div>
      <div className="m-preview-card-actions">
        <button className="btn btn-sm" onClick={onBack}>
          <Icon name="arrow_back" size={13} /> Back to your stage
        </button>
        {isPast && (
          <button className="btn btn-sm" onClick={onRollback}
            style={{ background: 'var(--warn-soft)', borderColor: 'rgba(245,158,11,0.3)', color: 'var(--warn)' }}>
            <Icon name="undo" size={13} /> Move pipeline back here
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Confirmation modal ────────────────────────────────────────
// Reused for both stage rollback and end-state commits. Same shape:
// destructive commit needs explicit acknowledgement.
function ConfirmModal({ config, onCancel }) {
  return (
    <>
      <div className="m-confirm-backdrop" onClick={onCancel} />
      <div className="m-confirm" role="dialog" aria-modal="true">
        <div className={`m-confirm-icon ${config.destructive ? 'is-destructive' : ''}`}>
          <Icon name={config.destructive ? 'warning' : 'help'} size={20} fill />
        </div>
        <div className="m-confirm-title">{config.title}</div>
        <div className="m-confirm-body">{config.body}</div>
        <div className="m-confirm-actions">
          <button className="btn" onClick={onCancel}>Cancel</button>
          <button
            className={`btn ${config.destructive ? 'btn-danger-solid' : 'btn-primary'}`}
            onClick={config.onConfirm}>
            {config.primary}
          </button>
        </div>
      </div>
    </>
  );
}

// ─── One-line hint above substage content ──────────────────────
// Per-substage status cue. Tells the user what state this stage is in
// and implicitly why the sticky bottom CTA is what it is. No buttons —
// the sticky bar is the action surface.
const NEXT_HINTS = {
  analysis: { icon: 'analytics',  tone: 'success', text: 'Match scored 86 · 3 above your average' },
  reviewed: { icon: 'fact_check', tone: 'success', text: '3 requirements flagged · ready to research' },
  network:  { icon: 'group',      tone: 'mute',    text: '0 known contacts · LinkedIn not connected' },
  research: { icon: 'task_alt',   tone: 'success', text: 'Research complete · ready to generate' },
};

function NextHint({ activeSubId }) {
  const h = NEXT_HINTS[activeSubId];
  if (!h) return null;
  const color = h.tone === 'success' ? 'var(--success)' : 'var(--txt-mute)';
  return (
    <div className="m-hint">
      <Icon name={h.icon} size={14} style={{ color }} />
      <span>{h.text}</span>
    </div>
  );
}

// ─── Mobile-specific Next Action card ──────────────────────────
// Kept for Prioritize, where the decision IS the work — two competing
// choices side-by-side need the full card treatment.
function NextActionMobile() {
  const a = window.NEXT_ACTION;
  return (
    <div className="m-next">
      <div className="head">
        <Icon name="bolt" size={11} fill />
        Next action
      </div>
      <h4>{a.title}</h4>
      <p>{a.body}</p>
      <div className="m-next-actions">
        <button className="btn btn-primary btn-sm">
          <Icon name="auto_awesome" size={13} fill /> {a.primaryCta}
        </button>
        <button className="btn btn-sm">{a.secondaryCta}</button>
      </div>
    </div>
  );
}

// ─── Mobile substage content ───────────────────────────────────
function SubStageContentMobile({ activeSubId }) {
  const meta = window.SUBSTAGE_CONTENT[activeSubId] || {};
  return (
    <div className="m-card">
      <div className="m-card-head">
        <div style={{ minWidth: 0 }}>
          <h3 className="m-card-title">{meta.title}</h3>
          <div className="m-card-subtitle">{meta.subtitle}</div>
        </div>
        {(meta.actions || []).slice(0, 1).map((act, i) => (
          <button key={i} className="btn btn-sm" aria-label={act.label}>
            <Icon name={act.icon} size={14} />
          </button>
        ))}
      </div>

      {activeSubId === 'analysis'   && <AnalysisContentMobile />}
      {activeSubId === 'reviewed'   && <ReviewedContentMobile />}
      {activeSubId === 'network'    && <NetworkContentMobile />}
      {activeSubId === 'research'   && <ResearchContentMobile />}
      {activeSubId === 'prioritize' && <PrioritizeContentMobile />}
    </div>
  );
}

function AnalysisContentMobile() {
  const dims = [
    { name: 'Core Role',    score: 17 },
    { name: 'Experience',   score: 19 },
    { name: 'Education',    score: 16 },
    { name: 'Culture',      score: 18 },
    { name: 'ATS Keywords', score: 16 },
  ];
  return (
    <>
      <div className="m-compat" style={{ marginBottom: 14 }}>
        <div className="m-compat-top">
          <ScoreRing score={86} size={64} />
          <div className="m-compat-stat" style={{ minWidth: 0 }}>
            <div className="lbl">Compatibility</div>
            <div className="msg">Excellent match for your profile</div>
            <span className="chip chip-green" style={{ marginTop: 6, width: 'fit-content' }}>
              <Icon name="arrow_upward" size={10} /> 3 pts above avg (83)
            </span>
          </div>
        </div>
        {dims.map(d => (
          <div key={d.name} className="m-dim-row">
            <div className="name">{d.name}</div>
            <div className="bar">
              <div style={{
                width: `${(d.score / 20) * 100}%`,
                background: d.score >= 18 ? 'var(--success)' : d.score >= 16 ? 'var(--primary)' : 'var(--warn)'
              }} />
            </div>
            <div className="val">{d.score}<span className="of">/20</span></div>
          </div>
        ))}
      </div>

      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--txt)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Job Summary
        </span>
        <button className="btn btn-ghost btn-sm" style={{ padding: '2px 6px' }}>
          <Icon name="expand_more" size={13} /> All
        </button>
      </div>
      <div className="m-summary">
        <SummaryFieldM label="Location" value="US · Remote" />
        <SummaryFieldM label="Type" value="Full-time" />
        <SummaryFieldM label="Seniority" value="Senior · 10+ yrs" />
        <SummaryFieldM label="Source" value="LinkedIn" />
      </div>
    </>
  );
}

function SummaryFieldM({ label, value }) {
  return (
    <div className="col" style={{ gap: 2, minWidth: 0 }}>
      <div className="label" style={{ fontSize: 9 }}>{label}</div>
      <div style={{ fontSize: 12.5, color: 'var(--txt)', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {value}
      </div>
    </div>
  );
}

function ReviewedContentMobile() {
  const flagged = [
    { tag: 'Must-have', text: 'Lead architecture migration from on-prem to SaaS at enterprise scale' },
    { tag: 'Must-have', text: 'Financial services experience preferred but not required' },
    { tag: 'Nice-to-have', text: 'Hands-on with AWS / Azure cloud-native patterns' },
  ];
  return (
    <div className="col gap-2">
      {flagged.map((f, i) => (
        <div key={i} className="m-flag-row">
          <span className={`chip ${f.tag === 'Must-have' ? 'chip-amber' : 'chip-blue'}`} style={{ flexShrink: 0 }}>
            {f.tag}
          </span>
          <div>{f.text}</div>
        </div>
      ))}
    </div>
  );
}

function NetworkContentMobile() {
  return (
    <div className="col gap-2" style={{ alignItems: 'center', padding: '12px 0' }}>
      <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--bg)',
        display: 'grid', placeItems: 'center', color: 'var(--txt-dim)' }}>
        <Icon name="group" size={22} />
      </div>
      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--txt)' }}>No known contacts yet</div>
      <div style={{ fontSize: 12, color: 'var(--txt-mute)', textAlign: 'center', maxWidth: 280 }}>
        Surface LinkedIn 1st/2nd-degree connections at PRI Technology.
      </div>
      <button className="btn btn-primary btn-sm" style={{ marginTop: 4 }}>
        <Icon name="link" size={14} /> Connect LinkedIn
      </button>
    </div>
  );
}

function ResearchContentMobile() {
  const sections = [
    { name: 'Company Overview', meta: 'Updated 5/20', icon: 'domain' },
    { name: 'Financials & Market', meta: '$2.4B · IT staffing', icon: 'trending_up' },
    { name: 'Competitor Matrix', meta: 'vs. TEKsystems, Insight', icon: 'compare_arrows' },
    { name: 'Career Matches', meta: '4 similar roles · 6 mo', icon: 'work' },
  ];
  return (
    <div className="col gap-2">
      {sections.map((s, i) => (
        <div key={i} className="m-research-row">
          <div className="m-research-icon"><Icon name={s.icon} size={14} /></div>
          <div className="flex-1" style={{ minWidth: 0 }}>
            <div className="m-research-name">{s.name}</div>
            <div className="m-research-meta">{s.meta}</div>
          </div>
          <Icon name="check_circle" size={16} fill style={{ color: 'var(--success)' }} />
        </div>
      ))}
    </div>
  );
}

function PrioritizeContentMobile() {
  return (
    <div className="col gap-3">
      <div className="m-next" style={{ margin: 0, boxShadow: 'none' }}>
        <div className="head"><Icon name="bolt" size={11} fill /> Recommended next step</div>
        <h4>Move to Generated phase</h4>
        <p>Saved-phase research is complete. Generate a tailored resume + cover letter now.</p>
        <div className="m-next-actions">
          <button className="btn btn-primary btn-sm">
            <Icon name="auto_awesome" size={13} fill /> Move to Generated
          </button>
          <button className="btn btn-sm">Skip & apply</button>
        </div>
      </div>
      <div className="row gap-2" style={{ padding: '10px 12px', background: 'var(--bg)', borderRadius: 10 }}>
        <Icon name="trending_up" size={14} style={{ color: 'var(--success)' }} />
        <div style={{ fontSize: 12.5 }}>Match score <b>86</b> · 3 above avg</div>
      </div>
      <div className="row gap-2" style={{ padding: '10px 12px', background: 'var(--bg)', borderRadius: 10 }}>
        <Icon name="group" size={14} className="dim" />
        <div style={{ fontSize: 12.5 }}>0 known contacts at PRI Technology</div>
      </div>
      <div className="row gap-2" style={{ padding: '10px 12px', background: 'var(--bg)', borderRadius: 10 }}>
        <Icon name="event" size={14} className="dim" />
        <div style={{ fontSize: 12.5 }}>No deadline · captured 5 days ago</div>
      </div>
    </div>
  );
}

window.VariationAMobile = VariationAMobile;
