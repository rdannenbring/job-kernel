/* global React, Icon, SavedRail, QueryBar, SourcesBar, FilterBar,
   ResultRow, DetailPane, ProfileNudge, WhyMatch */

// ─── Discover · the 3-column surface ────────────────────────────
// Reuses the JobKernel app chrome (60px icon nav + 48px topbar) but
// with Discover-appropriate nav state + actions. Three layout
// variants share one results engine.

function DiscoverShell({ theme = 'light', children, view = 'list' }) {
  return (
    <div className="app" data-theme={theme}>
      <div className="nav">
        <div className="nav-logo">JK</div>
        <div className="nav-add"><Icon name="add" size={20} /></div>
        <div className="nav-item"><Icon name="dashboard" size={20} /></div>
        <div className="nav-item is-active"><Icon name="travel_explore" size={20} fill /></div>
        <div className="nav-item"><Icon name="person" size={20} /></div>
        <div className="nav-item"><Icon name="analytics" size={20} /></div>
        <div className="nav-spacer" />
        <div className="nav-item"><Icon name="notifications" size={20} /></div>
        <div className="nav-item"><Icon name="settings" size={20} /></div>
        <div className="nav-avatar">A</div>
      </div>
      <div className="topbar">
        <div className="topbar-crumb">
          <a>Dashboard</a>
          <span className="sep">/</span>
          <span className="curr">Discover</span>
        </div>
        <div className="topbar-actions">
          <div className="view-switch">
            <button className={view === 'list' ? 'is-active' : ''}><Icon name="view_list" size={13} fill={view === 'list'} /> List</button>
            <button className={view === 'split' ? 'is-active' : ''}><Icon name="splitscreen" size={13} fill={view === 'split'} /> Split</button>
          </div>
          <button className="btn btn-sm"><Icon name="density_medium" size={14} /></button>
          <button className="btn btn-sm"><Icon name="notifications_active" size={14} /> Alerts</button>
        </div>
      </div>
      <div className="stage" style={{ overflow: 'hidden' }}>
        {children}
      </div>
    </div>
  );
}

// Group results into match bands (Variation C)
function bandGroups(jobs) {
  const order = [
    { id: 'strong', label: 'Strong match', sub: '85 and up · ready to pursue', kind: 'now', min: 85 },
    { id: 'good', label: 'Good match', sub: 'Worth a closer look', kind: 'week', min: 70 },
    { id: 'stretch', label: 'Stretch', sub: 'Below your average — a reach', kind: null, min: 0 },
  ];
  return order.map((g, i) => {
    const max = i === 0 ? 101 : order[i - 1].min;
    return { ...g, jobs: jobs.filter((j) => j.score >= g.min && j.score < max) };
  }).filter((g) => g.jobs.length);
}

function MatchBand({ g }) {
  return (
    <div className={`pulse-day is-${g.kind || 'week'}`} style={{ top: 0 }}>
      <Icon name={g.id === 'strong' ? 'verified' : g.id === 'good' ? 'thumb_up' : 'trending_flat'} size={12} />
      <span>{g.label}</span>
      <span className="pulse-day-count">{g.jobs.length}</span>
      <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'none', opacity: 0.85, marginLeft: 4 }}>· {g.sub}</span>
    </div>
  );
}

// ── The Discover surface ──
function Discover({
  theme = 'light',
  density = 'comfy',
  variant = 'slidein',     // slidein | split | grouped
  state = 'results',       // results | streaming | empty | nosources | partial | zero | saving
  activeId = null,
  expandedId = null,
  threshold = 70,
  showThreshPop = false,
  sort = 'match',
  showRail = true,
}) {
  // States that take over the whole results region are delegated.
  const takeover = ['empty', 'nosources', 'zero'].includes(state);

  const [paneW, setPaneW] = React.useState(variant === 'split' ? 440 : 396);

  const jobs = window.S_JOBS.filter((j) => j.state !== 'dismissed' || true); // keep dismissed visible (greyed)
  const visible = jobs.filter((j) => j.score >= 0);
  const sources = state === 'partial' ? window.S_SOURCES_PARTIAL : window.S_SOURCES;

  const paneJob = (variant === 'split' || activeId) && state === 'results'
    ? window.S_JOBS.find((j) => j.id === (activeId || 'j01'))
    : null;

  const gridCls = `dsc ${showRail ? '' : 'no-rail'} ${variant === 'split' ? 'is-split has-pane' : (paneJob ? 'has-pane' : '')}`;
  const gridCols = paneJob
    ? `${showRail ? '232px ' : ''}minmax(0,1fr) ${paneW}px`
    : undefined;

  return (
    <DiscoverShell theme={theme} view={variant === 'split' ? 'split' : 'list'}>
      <div className={gridCls} style={gridCols ? { gridTemplateColumns: gridCols } : undefined}>
        {showRail && <SavedRail activeId={state === 'zero' ? 'test' : 'all'} />}

        <div className="dsc-main">
          <QueryBar
            kw={state === 'zero' ? 'software engineer' : ''}
            loc={state === 'zero' ? 'Stamford, CT' : ''}
            model={state === 'zero' ? 'Onsite' : 'Any'}
          />

          {state !== 'nosources' && state !== 'empty' && (
            <SourcesBar sources={sources} />
          )}

          {!takeover && (
            <FilterBar threshold={threshold} count={visible.length} showThreshPop={showThreshPop} sort={sort} />
          )}

          {state === 'partial' && <PartialBanner />}
          {state === 'streaming' && <StreamBanner />}

          {/* Results region */}
          {takeover ? (
            <ResultsTakeover state={state} />
          ) : (
            <div className="dsc-results">
              {state === 'streaming' && <GhostRows n={3} />}

              {variant === 'grouped' && state === 'results' ? (
                bandGroups(visible).map((g) => (
                  <React.Fragment key={g.id}>
                    <MatchBand g={g} />
                    {g.jobs.map((j) => (
                      <ResultRow key={j.id} job={j} density={density}
                        active={j.id === activeId}
                        onClick={() => {}} />
                    ))}
                  </React.Fragment>
                ))
              ) : (
                visible.map((j, i) => {
                  const isSaving = state === 'saving' && j.id === (activeId || 'j02');
                  return (
                    <SavingOrRow key={j.id} job={j} density={density}
                      active={j.id === activeId}
                      expanded={variant === 'slidein' && expandedId === j.id}
                      saving={isSaving} />
                  );
                })
              )}

              {state === 'results' && variant !== 'grouped' && <ProfileNudge />}
            </div>
          )}
        </div>

        {paneJob && <DetailPane job={paneJob} resizable width={paneW} onWidthChange={setPaneW} />}
      </div>
    </DiscoverShell>
  );
}

// Row that can render its "saving → tracked" confirmation in place.
function SavingOrRow({ job, density, active, expanded, saving }) {
  if (saving) {
    return (
      <div className="dres d-comfy dsc-saving-row">
        <div className="dres-score"><Icon name="check_circle" size={28} fill style={{ color: 'var(--success)' }} /></div>
        <div className="dres-body">
          <div className="dres-line1">
            <span className="dres-logo">{job.init}</span>
            <span className="dres-title">{job.title}</span>
            <span className="dres-co">· {job.co}</span>
          </div>
          <div className="dres-line2">
            <span className="dsc-saving-badge"><Icon name="bookmark_added" size={13} fill /> Saved to pipeline · Inbox</span>
            <span className="dres-meta" style={{ color: 'var(--success)' }}>Now tracked — running analysis…</span>
          </div>
        </div>
        <div className="dres-right">
          <button className="btn btn-sm"><Icon name="open_in_new" size={13} /> View in pipeline</button>
        </div>
      </div>
    );
  }
  return <ResultRow job={job} density={density} active={active} expanded={expanded} onClick={() => {}} />;
}

// ── Streaming ghost rows ──
function GhostRows({ n = 3 }) {
  return (
    <>
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} className="dsc-ghost">
          <div className="gk circ" style={{ width: 44, height: 44 }} />
          <div className="col gap-2" style={{ minWidth: 0 }}>
            <div className="gk" style={{ height: 13, width: `${55 - i * 8}%` }} />
            <div className="gk" style={{ height: 10, width: `${78 - i * 6}%` }} />
          </div>
          <div className="gk" style={{ height: 28, width: 90 }} />
        </div>
      ))}
    </>
  );
}

// ── Streaming / partial banners ──
function StreamBanner() {
  const prog = [
    { id: 'adzuna', label: 'Adzuna', done: true, n: 41 },
    { id: 'remoteok', label: 'RemoteOK', done: true, n: 12 },
    { id: 'themuse', label: 'TheMuse', done: false },
    { id: 'jsearch', label: 'JSearch', done: false },
  ];
  return (
    <div className="dsc-stream">
      <Icon name="bolt" size={14} fill style={{ color: 'var(--primary)' }} />
      <span style={{ color: 'var(--txt-2)' }}>Searching 4 sources…</span>
      {prog.map((p) => (
        <span key={p.id} className={`dsc-stream-src ${p.done ? 'is-done' : ''}`}>
          {p.done
            ? <Icon name="check_circle" size={14} fill />
            : <Icon name="progress_activity" size={14} className="spin" />}
          {p.label}{p.done ? ` · ${p.n}` : '…'}
        </span>
      ))}
      <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--txt-dim)' }}>53 results so far</span>
    </div>
  );
}

function PartialBanner() {
  return (
    <div className="dsc-stream" style={{ background: 'var(--warn-soft)' }}>
      <Icon name="warning" size={14} fill style={{ color: 'var(--warn)' }} />
      <span style={{ color: 'var(--warn)', fontWeight: 700 }}>JSearch is down</span>
      <span style={{ color: 'var(--txt-2)' }}>— showing 63 results from 3 of 4 sources. RemoteOK is rate-limited (partial).</span>
      <button className="btn btn-sm" style={{ marginLeft: 'auto' }}><Icon name="refresh" size={13} /> Retry JSearch</button>
    </div>
  );
}

Object.assign(window, { DiscoverShell, Discover, GhostRows, StreamBanner, PartialBanner, bandGroups });
