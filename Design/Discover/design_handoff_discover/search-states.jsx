/* global React, Icon */

// ─── Discover · takeover states ─────────────────────────────────
// Empty (no query yet), No sources connected, Zero results.
// All reuse Profile's empty-state vocabulary: guidance hero,
// p-method source cards, ghost chips.

function ResultsTakeover({ state }) {
  if (state === 'nosources') return <StateNoSources />;
  if (state === 'zero') return <StateZero />;
  return <StateEmpty />;
}

// No query yet — first-run guidance + how to start
function StateEmpty() {
  return (
    <div className="dsc-state">
      <div className="dsc-state-hero">
        <div className="dsc-state-icon"><Icon name="travel_explore" size={28} /></div>
        <div>
          <h2>Find your next role</h2>
          <p>Search across your connected listing sources at once. Every result is scored
            against your Profile, so the strongest matches rise to the top.</p>
        </div>
      </div>

      <div className="dsc-methods">
        <button className="dsc-method is-primary">
          <span className="dsc-method-tag">Fastest</span>
          <div className="dsc-method-icon"><Icon name="search" size={18} /></div>
          <div className="dsc-method-title">Run a search</div>
          <div className="dsc-method-sub">Type a role or skill above and hit search to pull ranked listings from all sources.</div>
          <div className="dsc-method-foot">Start typing <Icon name="arrow_upward" size={12} /></div>
        </button>
        <button className="dsc-method">
          <div className="dsc-method-icon"><Icon name="bookmark" size={18} /></div>
          <div className="dsc-method-title">Open a saved search</div>
          <div className="dsc-method-sub">Re-run one of your saved queries — 9 fresh matches are waiting across them.</div>
          <div className="dsc-method-foot">View saved <Icon name="arrow_forward" size={12} /></div>
        </button>
        <button className="dsc-method">
          <div className="dsc-method-icon"><Icon name="bolt" size={18} /></div>
          <div className="dsc-method-title">Run all sources</div>
          <div className="dsc-method-sub">Sweep every connected source with your default filters in one click.</div>
          <div className="dsc-method-foot">Run all <Icon name="arrow_forward" size={12} /></div>
        </button>
      </div>

      {/* recent queries — ghost-chip styled */}
      <div style={{ maxWidth: 720, width: '100%', marginTop: 8 }}>
        <div className="dpane-sec-label" style={{ justifyContent: 'flex-start' }}><Icon name="history" size={13} /> Recent searches</div>
        <div className="row gap-2" style={{ flexWrap: 'wrap' }}>
          {['staff engineer · remote', 'product engineer · SF', 'platform · $220k+', 'backend · NYC'].map((q, i) => (
            <button key={i} className="chip" style={{ cursor: 'pointer', fontWeight: 600 }}>
              <Icon name="search" size={11} /> {q}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// No sources connected — link to Profile → Integrations
function StateNoSources() {
  const provs = [
    { id: 'adzuna', label: 'Adzuna', sub: 'Broad aggregator · global coverage', brand: '#00a3a1', abbr: 'Az' },
    { id: 'jsearch', label: 'JSearch', sub: 'Google-for-Jobs index', brand: '#6d5ae6', abbr: 'Js' },
    { id: 'themuse', label: 'TheMuse', sub: 'Curated company listings', brand: '#d6443c', abbr: 'Mu' },
    { id: 'remoteok', label: 'RemoteOK', sub: 'Remote-first roles', brand: '#2a2a2a', abbr: 'Ro' },
  ];
  return (
    <div className="dsc-state">
      <div className="dsc-state-hero" style={{ background: 'linear-gradient(180deg, var(--warn-soft), transparent 80%)', borderColor: 'rgba(217,119,6,0.30)' }}>
        <div className="dsc-state-icon is-warn"><Icon name="cloud_off" size={28} /></div>
        <div>
          <h2>Connect a source to start discovering</h2>
          <p>Discover pulls listings from external job APIs. Connect at least one in
            your Profile and we\u2019ll start ranking results against your match profile.</p>
        </div>
      </div>

      <div className="dsc-methods" style={{ gridTemplateColumns: 'repeat(2, 1fr)', maxWidth: 620 }}>
        {provs.map((p) => (
          <div key={p.id} className="dsc-method" style={{ cursor: 'default' }}>
            <div className="dsc-method-icon" style={{ background: p.brand, color: 'white', border: 0 }}>{p.abbr}</div>
            <div className="dsc-method-title">{p.label}</div>
            <div className="dsc-method-sub">{p.sub}</div>
            <div className="dsc-method-foot" style={{ justifyContent: 'space-between', display: 'flex', alignItems: 'center' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: 'var(--txt-dim)' }}>
                <span className="dot" style={{ background: 'var(--txt-faint)' }} /> Disconnected
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>Connect <Icon name="arrow_forward" size={12} /></span>
            </div>
          </div>
        ))}
      </div>

      <button className="btn btn-primary" style={{ marginTop: 6 }}>
        <Icon name="link" size={15} /> Manage integrations in Profile
      </button>
    </div>
  );
}

// Zero results — query ran, nothing matched
function StateZero() {
  return (
    <div className="dsc-state">
      <div className="dsc-state-icon is-empty" style={{ marginTop: 12 }}><Icon name="search_off" size={28} /></div>
      <h3>No jobs found for “software engineer” in Stamford, CT</h3>
      <p className="sub">All 4 sources responded — none matched this query and your current filters.
        Try widening the location, lowering the match threshold, or removing a filter.</p>
      <div className="row gap-2" style={{ flexWrap: 'wrap', justifyContent: 'center', marginTop: 4 }}>
        <button className="btn btn-sm"><Icon name="location_off" size={14} /> Clear location</button>
        <button className="btn btn-sm"><Icon name="speed" size={14} /> Lower match to ≥ 50</button>
        <button className="btn btn-sm"><Icon name="public" size={14} /> Include Remote</button>
        <button className="btn btn-sm btn-ghost"><Icon name="filter_list_off" size={14} /> Reset all filters</button>
      </div>

      <div style={{ maxWidth: 460, width: '100%', marginTop: 18 }}>
        <div className="why-note" style={{ background: 'var(--primary-soft)', borderColor: 'var(--primary-edge)' }}>
          <Icon name="lightbulb" size={14} fill style={{ color: 'var(--primary)' }} />
          <span><b>Tip:</b> broaden to “Remote (US)” — your other saved searches return
            21–38 results with the same keywords.</span>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { ResultsTakeover, StateEmpty, StateNoSources, StateZero });
