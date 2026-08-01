/* global React, Icon, ScoreRing */

// ─── Discover · shared primitives ───────────────────────────────
// Builds on shared.jsx (Icon, ScoreRing) and reuses the Pulse row
// DNA + Profile "Affects matching" chip. No new tokens.

// ── "Affects matching" chip (same as Profile) ──
function MatchChip({ size = 'sm' }) {
  return (
    <span className={`match-chip ${size === 'tiny' ? 'is-tiny' : ''}`}>
      <Icon name="auto_awesome" size={size === 'tiny' ? 9 : 10} fill />
      Affects matching
    </span>
  );
}

// ── Source chiclet + badge ──
function SourceChiclet({ id }) {
  const m = window.S_SOURCE_META[id] || { abbr: '?' };
  return <span className={`src-chiclet src-${id}`} title={m.label}>{m.abbr}</span>;
}

// Single source badge (one origin) or stacked (deduped across sources)
function SourceBadge({ source, also = [] }) {
  const all = [source, ...also.filter((s) => s !== source)];
  if (all.length === 1) {
    const m = window.S_SOURCE_META[source];
    return (
      <span className="src-badge">
        <SourceChiclet id={source} />
        {m.label}
      </span>
    );
  }
  // Deduped — stack chiclets + "on N sources"
  return (
    <span className="src-badge" title={`Found on ${all.length} sources: ${all.map((s) => window.S_SOURCE_META[s].label).join(', ')}`}>
      <span className="src-stack">
        {all.slice(0, 3).map((s) => <SourceChiclet key={s} id={s} />)}
      </span>
      <span style={{ marginLeft: 2 }}>{all.length} sources</span>
    </span>
  );
}

// ── Work-model badge ──
function WorkModelBadge({ model }) {
  const cls = model === 'Remote' ? 'wm-remote' : model === 'Hybrid' ? 'wm-hybrid' : 'wm-onsite';
  return <span className={`wm-badge ${cls}`}>{model}</span>;
}

// ── Salary chip (reuses the design-system salary-chip) ──
function SalaryChip({ value, size = 'sm' }) {
  if (!value || value === 'Not Listed' || value === '—') {
    return <span className="salary-chip is-unlisted">Salary not listed</span>;
  }
  return (
    <span className="salary-chip" style={size === 'lg' ? {} : { fontSize: 11, padding: '3px 9px' }}>
      <Icon name="payments" size={11} fill /> {value}
    </span>
  );
}

// ── Sources health strip ──
function SourcesBar({ sources, compact = false }) {
  const labelName = { ok: 'Connected', degraded: 'Degraded', limit: 'Rate-limited', down: 'Down' };
  return (
    <div className="dsc-sources">
      <span className="label">Sources</span>
      {sources.map((s) => (
        <span key={s.id} className={`dsc-src s-${s.state}`} title={`${s.label} · ${labelName[s.state]}${s.latency && s.state !== 'down' ? ' · ' + s.latency : ''}`}>
          <span className="src-dot" />
          {s.label}
          {!compact && (
            s.state === 'down' || s.state === 'limit'
              ? <span className="dsc-src-n">{s.error || labelName[s.state]}</span>
              : <span className="dsc-src-n">{s.count}</span>
          )}
        </span>
      ))}
      <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 700, color: 'var(--txt-dim)',
        display: 'inline-flex', alignItems: 'center', gap: 5, cursor: 'pointer' }}>
        <Icon name="settings" size={13} /> Manage in Profile
      </span>
    </div>
  );
}

// ── Saved-search rail item ──
function SavedSearchItem({ s, active, onClick }) {
  const modelLabel = { any: 'Any', remote: 'Remote', hybrid: 'Hybrid', onsite: 'Onsite' }[s.model];
  return (
    <div className={`dsc-saved ${active ? 'is-active' : ''}`} onClick={onClick}>
      <Icon name={s.icon} size={16} className="ds-ic" fill={active} />
      <div className="dsc-saved-main">
        <div className="dsc-saved-name">{s.name}</div>
        {!s.isAll && (
          <div className="dsc-saved-meta">
            {s.kw && <span className="dsc-mini"><Icon name="search" size={11} />{s.kw}</span>}
            {s.loc && <span className="dsc-mini"><Icon name="location_on" size={11} />{s.loc}</span>}
            {s.model !== 'any' && <span className="dsc-mini">{modelLabel}</span>}
          </div>
        )}
        {s.last && <div className="dsc-saved-last">Last run {s.last}</div>}
        {s.isAll && <div className="dsc-saved-last">{s.count} listings across all sources</div>}
      </div>
      <div className="dsc-saved-right">
        {s.fresh > 0 && <span className="dsc-fresh">{s.fresh}</span>}
        {!s.isAll && (
          <Icon name={s.alerts ? 'notifications_active' : 'notifications_off'} size={14}
            className={s.alerts ? 'dsc-alert-on' : 'dsc-alert-off'}
            fill={s.alerts} title={s.alerts ? 'Alerts on — notify on new matches' : 'Alerts off'} />
        )}
      </div>
    </div>
  );
}

function SavedRail({ activeId = 'all', onPick }) {
  return (
    <aside className="dsc-rail">
      <div className="dsc-rail-head">
        <span className="label">Saved searches</span>
        <button className="dsc-rail-new" title="New search"><Icon name="add" size={16} /></button>
      </div>
      <div className="dsc-rail-list">
        {window.S_SAVED.map((s) => (
          <SavedSearchItem key={s.id} s={s} active={s.id === activeId} onClick={() => onPick && onPick(s.id)} />
        ))}
      </div>
      <div className="dsc-rail-foot">
        <button className="dsc-runall"><Icon name="bolt" size={14} fill /> Run all now</button>
      </div>
    </aside>
  );
}

// ── Query bar (keywords + location + work-model) ──
function QueryBar({ kw = '', loc = '', model = 'Any' }) {
  return (
    <div className="dsc-query">
      <label className="dsc-field kw">
        <Icon name="search" size={16} />
        <input defaultValue={kw} placeholder="Keywords — role, skill, company" />
      </label>
      <label className="dsc-field loc">
        <Icon name="location_on" size={16} />
        <input defaultValue={loc} placeholder="Location (optional)" />
      </label>
      <button className="dsc-model">
        <Icon name="home_work" size={15} /> {model} <Icon name="expand_more" size={15} />
      </button>
      <button className="btn btn-primary" style={{ height: 38 }}>
        <Icon name="search" size={16} /> Search
      </button>
    </div>
  );
}

// ── Filter chip bar (+ threshold) ──
function FilterBar({ threshold = 70, count = 104, showThreshPop = false, sort = 'match' }) {
  const filters = [
    { id: 'role', label: 'Senior+', icon: 'badge', active: true },
    { id: 'salary', label: '$180k+', icon: 'payments', active: true },
    { id: 'date', label: 'Past 7 days', icon: 'schedule', active: false },
    { id: 'source', label: 'All sources', icon: 'hub', active: false },
  ];
  const sortLabel = { match: 'Best match', date: 'Newest', salary: 'Salary' }[sort];
  return (
    <div className="dsc-filters">
      <button className="dsc-filter"><Icon name="tune" size={14} /> More filters</button>
      <div className="lbar-divider" />
      {filters.map((f) => (
        <button key={f.id} className={`dsc-filter ${f.active ? 'has-value' : ''}`}>
          <Icon name={f.icon} size={14} /> {f.label}
          {f.active && <Icon name="close" size={13} className="x" />}
        </button>
      ))}

      {/* Match-score threshold — ties back to Profile */}
      <div style={{ position: 'relative' }}>
        <button className={`dsc-filter ${threshold > 0 ? 'has-value' : ''}`}>
          <Icon name="speed" size={14} /> Match ≥ {threshold}
          <MatchChip size="tiny" />
        </button>
        {showThreshPop && <ThresholdPopover threshold={threshold} />}
      </div>

      <span className="dsc-result-count">
        <Icon name="check_circle" size={13} fill style={{ color: 'var(--success)' }} />
        {count} results
      </span>
      <button className="dsc-sort">
        <Icon name="sort" size={14} /> {sortLabel} <Icon name="expand_more" size={13} />
      </button>
    </div>
  );
}

function ThresholdPopover({ threshold }) {
  const pct = threshold; // 0..100
  return (
    <div className="popover thresh-pop" style={{ top: 'calc(100% + 8px)', left: 0, zIndex: 60 }}>
      <div className="thresh-head">
        <span className="popover-label" style={{ padding: 0 }}>Minimum match score</span>
        <span className="thresh-val">{threshold}</span>
      </div>
      <div className="why-note is-up" style={{ marginBottom: 10 }}>
        <Icon name="auto_awesome" size={13} fill />
        <span>Scores come from your <b>Profile</b>. A stronger profile raises every result\u2019s score.</span>
      </div>
      <div className="thresh-track">
        <div className="thresh-fill" style={{ width: `${pct}%` }} />
        <div className="thresh-knob" style={{ left: `${pct}%` }} />
      </div>
      <div className="thresh-scale"><span>0</span><span>Stretch</span><span>Good</span><span>Strong</span><span>100</span></div>
      <div className="popover-divider" />
      <div className="popover-item" style={{ fontSize: 12 }}>
        <Icon name="visibility_off" size={14} />
        <span style={{ flex: 1 }}>Hide results below threshold</span>
        <span className="dsc-fresh" style={{ background: 'var(--txt-dim)' }}>12</span>
      </div>
    </div>
  );
}

// ── Result row — the Pulse sibling ──
function ResultRow({ job, density = 'comfy', active = false, expanded = false, onClick }) {
  const band = window.S_BAND(job.score);
  const dismissed = job.state === 'dismissed';
  const saved = job.state === 'saved';
  return (
    <>
      <div className={`dres d-${density} ${active ? 'is-active' : ''} ${dismissed ? 'is-dismissed' : ''}`} onClick={onClick}>
        <div className="dres-score">
          <ScoreRing score={job.score} size={density === 'compact' ? 38 : 46} />
        </div>

        <div className="dres-body">
          <div className="dres-line1">
            <span className="dres-logo">{job.init}</span>
            <span className="dres-title">{job.title}</span>
            <span className="dres-co">· {job.co}</span>
          </div>
          <div className="dres-line2">
            <WorkModelBadge model={job.model} />
            <span className="dres-meta"><Icon name="location_on" size={13} />{job.loc}</span>
            <SalaryChip value={job.salary} />
            <SourceBadge source={job.source} also={job.also} />
            <span className={`chip ${band.cls}`} style={{ fontSize: 10 }}>
              <Icon name="auto_awesome" size={10} fill /> {band.label}
            </span>
          </div>
          {density !== 'compact' && <div className="dres-excerpt">{job.excerpt}</div>}
        </div>

        <div className="dres-right">
          <span className="dres-posted">{job.posted}</span>
          {dismissed ? (
            <button className="btn btn-sm"><Icon name="undo" size={13} /> Restore</button>
          ) : saved ? (
            <span className="dres-savedtag"><Icon name="check_circle" size={14} fill /> In pipeline</span>
          ) : (
            <div className="dres-actions">
              <button className="btn btn-primary btn-sm" title="Save & run analysis"><Icon name="bolt" size={13} fill /> Process</button>
              <button className="btn btn-sm"><Icon name="bookmark_add" size={14} /> Save</button>
              <button className="dres-dismiss" title="Dismiss"><Icon name="close" size={16} /></button>
            </div>
          )}
        </div>
      </div>

      {expanded && <ResultExpand job={job} />}
    </>
  );
}

// ── Inline expand (alternate to the slide-in pane) ──
function ResultExpand({ job }) {
  return (
    <div className="dres-expand">
      <div>
        <div className="dpane-sec-label"><Icon name="article" size={13} /> Listing</div>
        <div className="dpane-desc" style={{ fontSize: 12 }}>{job.excerpt}</div>
        <div className="row gap-2" style={{ marginTop: 10 }}>
          <button className="btn btn-primary btn-sm"><Icon name="bolt" size={13} fill /> Process Now</button>
          <button className="btn btn-sm"><Icon name="bookmark_add" size={14} /> Save to pipeline</button>
          <button className="btn btn-ghost btn-sm"><Icon name="open_in_new" size={13} /> View source</button>
        </div>
      </div>
      <WhyMatch job={job} compact />
    </div>
  );
}

// ── Why-this-matches breakdown ──
function WhyMatch({ job, compact = false }) {
  const band = window.S_BAND(job.score);
  return (
    <div>
      <div className="dpane-sec-label">
        <Icon name="insights" size={13} /> Why this matches you <MatchChip size="tiny" />
      </div>
      <div className="row gap-3" style={{ alignItems: 'center', marginBottom: 12 }}>
        <ScoreRing score={job.score} size={compact ? 48 : 56} />
        <div className="col gap-1" style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--txt)' }}>{band.label}</div>
          <span className={`chip ${job.score >= window.S_PROFILE.avg ? 'chip-green' : 'chip-amber'}`} style={{ width: 'fit-content', fontSize: 10 }}>
            <Icon name={job.score >= window.S_PROFILE.avg ? 'arrow_upward' : 'arrow_downward'} size={10} />
            {job.score >= window.S_PROFILE.avg ? `+${job.score - window.S_PROFILE.avg}` : job.score - window.S_PROFILE.avg} vs your avg ({window.S_PROFILE.avg})
          </span>
        </div>
      </div>
      <div className="col gap-2" style={{ marginBottom: 12 }}>
        {job.why.map((d) => {
          const c = d.score >= 18 ? 'var(--success)' : d.score >= 14 ? 'var(--primary)' : 'var(--warn)';
          return (
            <div key={d.name} className="why-dim">
              <span className="why-dim-name">{d.name}</span>
              <span className="why-dim-bar"><i style={{ width: `${(d.score / 20) * 100}%`, background: c }} /></span>
              <span className="why-dim-num">{d.score}<span style={{ color: 'var(--txt-dim)', fontWeight: 600 }}>/20</span></span>
            </div>
          );
        })}
      </div>
      <div className="col gap-2">
        <div className="why-note is-up"><Icon name="thumb_up" size={14} fill /><span>{job.whyTop}</span></div>
        <div className="why-note is-gap"><Icon name="error" size={14} fill /><span>{job.whyGap}</span></div>
      </div>
      {!compact && (
        <div className="why-note" style={{ marginTop: 10, background: 'var(--primary-soft)', borderColor: 'var(--primary-edge)' }}>
          <Icon name="tips_and_updates" size={14} fill style={{ color: 'var(--primary)' }} />
          <span>Add <b>cloud architecture</b> to your Profile skills to raise this match.
            <a className="meta-link" style={{ marginLeft: 4 }}>Edit Profile →</a></span>
        </div>
      )}
    </div>
  );
}

// ── Detail pane (slide-in, right) ──
function DetailPane({ job, resizable = false, width = 396, onWidthChange }) {
  const all = [job.source, ...job.also.filter((s) => s !== job.source)];
  const ref = React.useRef(null);

  // Drag the left edge to resize. Accounts for canvas zoom by deriving the
  // current scale from the rendered vs. layout width of the pane.
  const startResize = (e) => {
    if (!onWidthChange) return;
    e.preventDefault(); e.stopPropagation();
    const aside = ref.current;
    const scale = aside ? (aside.getBoundingClientRect().width / aside.offsetWidth) || 1 : 1;
    const startX = e.clientX;
    const startW = width;
    const move = (ev) => {
      const dx = (startX - ev.clientX) / scale;   // drag left ⇒ wider pane
      onWidthChange(Math.max(320, Math.min(620, Math.round(startW + dx))));
    };
    const up = () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  return (
    <aside className="dpane" ref={ref}>
      {resizable && (
        <div className="dpane-resize" onMouseDown={startResize} title="Drag to resize">
          <span className="dpane-resize-grip"><Icon name="drag_indicator" size={14} /></span>
        </div>
      )}
      <div className="dpane-top">
        <div className="dpane-head">
          <span className="dpane-logo">{job.init}</span>
          <div style={{ minWidth: 0 }}>
            <div className="dpane-title">{job.title}</div>
            <div className="dpane-co">{job.co}</div>
          </div>
          <button className="dpane-close" title="Close"><Icon name="close" size={18} /></button>
        </div>
        <div className="dpane-meta">
          <WorkModelBadge model={job.model} />
          <span className="dres-meta"><Icon name="location_on" size={13} />{job.loc}</span>
          <SalaryChip value={job.salary} />
          <span className="chip"><Icon name="schedule" size={11} /> Posted {job.posted} ago</span>
        </div>
      </div>

      <div className="dpane-body">
        <WhyMatch job={job} />

        <div style={{ height: 16 }} />
        <div className="dpane-sec-label"><Icon name="hub" size={13} /> Listing source</div>
        <div className="dpane-prov">
          <span className="src-stack">{all.map((s) => <SourceChiclet key={s} id={s} />)}</span>
          <span className="dpane-prov-label">
            {all.length > 1 ? `Found on ${all.length} sources — ` : 'Via '}
            {all.map((s) => window.S_SOURCE_META[s].label).join(', ')}
          </span>
          <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 700, color: 'var(--primary)',
            display: 'inline-flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
            <Icon name="open_in_new" size={12} /> Original
          </span>
        </div>

        <div style={{ height: 16 }} />
        <div className="dpane-sec-label"><Icon name="article" size={13} /> Job description</div>
        <div className="dpane-desc">
          <p>{job.excerpt}</p>
          <p>Responsibilities include owning systems end-to-end, partnering across product and design, and mentoring other engineers. You\u2019ll work in a fast-moving environment with high autonomy.</p>
          <p style={{ color: 'var(--txt-mute)' }}>Requirements: 7+ years of experience, strong fundamentals in distributed systems, and a track record of shipping. Full description on the original listing.</p>
        </div>
      </div>

      <div className="dpane-foot">
        <button className="btn btn-primary"><Icon name="bolt" size={15} fill /> Save to pipeline</button>
        <button className="btn"><Icon name="open_in_new" size={14} /> Open</button>
        <button className="btn btn-icon" title="Dismiss"><Icon name="close" size={16} /></button>
      </div>
    </aside>
  );
}

// ── Profile nudge banner (ties scores back to Profile) ──
function ProfileNudge() {
  return (
    <div className="dsc-profile-nudge">
      <Icon name="auto_awesome" size={18} fill />
      <div className="dsc-profile-nudge-text">
        These scores reflect your <b>Profile</b> ({window.S_PROFILE.readiness}% complete).
        Adding target compensation and 3 more skills could surface <b>~18 stronger matches</b>.
      </div>
      <button className="btn btn-sm btn-primary"><Icon name="tune" size={13} /> Improve Profile</button>
    </div>
  );
}

Object.assign(window, {
  MatchChip, SourceChiclet, SourceBadge, WorkModelBadge, SalaryChip,
  SourcesBar, SavedSearchItem, SavedRail, QueryBar, FilterBar, ThresholdPopover,
  ResultRow, ResultExpand, WhyMatch, DetailPane, ProfileNudge,
});
