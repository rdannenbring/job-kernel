import { useState, useEffect, useRef, useCallback } from 'react';
import './Discover.css';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';

function getAuthHeaders() {
  const token = localStorage.getItem('token');
  return { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` };
}

// Source brand metadata
const SOURCE_META = {
  adzuna:   { label: 'Adzuna',   abbr: 'Az', color: '#00a3a1' },
  jsearch:  { label: 'JSearch',  abbr: 'Js', color: '#6d5ae6' },
  themuse:  { label: 'TheMuse',  abbr: 'Mu', color: '#d6443c' },
  remoteok: { label: 'RemoteOK', abbr: 'Ro', color: '#2a2a2a' },
};

function bandFor(score) {
  if (score >= 85) return { label: 'Strong match', cls: 'chip-green' };
  if (score >= 70) return { label: 'Good match',   cls: 'chip-blue' };
  return               { label: 'Stretch',          cls: 'chip-amber' };
}

function ringColor(score) {
  if (score == null) return 'var(--line)';
  if (score >= 80) return 'var(--success)';
  if (score >= 60) return 'var(--primary)';
  return 'var(--warn)';
}

function relativeTime(isoStr) {
  if (!isoStr) return '';
  const diff = Date.now() - new Date(isoStr).getTime();
  const h = Math.floor(diff / 3600000);
  if (h < 1) return 'just now';
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  return `${Math.floor(d / 7)}w`;
}

function formatSalary(min, max, cur) {
  if (!min && !max) return null;
  const fmt = n => `$${Number(n).toLocaleString()}`;
  if (min && max) return `${fmt(min)} – ${fmt(max)}`;
  if (min) return `${fmt(min)}+`;
  return `Up to ${fmt(max)}`;
}

// ── Detail-pane sizing ──
// The pane defaults to ~60% of the viewport but is clamped so the collapsed
// rail (60px) plus a usable center list (≥ PANE_MIN_CENTER) always fit.
const PANE_RAIL = 60;
const PANE_MIN_CENTER = 420;
const PANE_MIN = 360;
const PANE_DEFAULT_FRACTION = 0.6;
function clampPaneWidth(w) {
  const max = Math.max(PANE_MIN, window.innerWidth - PANE_RAIL - PANE_MIN_CENTER);
  return Math.round(Math.max(PANE_MIN, Math.min(w, max)));
}

// Normalize for client-side cross-provider dedup
function normKey(title, company) {
  const norm = s => (s || '').toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
  return `${norm(title)}|${norm(company)}`;
}

// Get company initials for logo placeholder
function initials(company) {
  return (company || '?').split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();
}

// ─── Small primitives ───────────────────────────────────────────

function Icon({ name, size = 16, fill = false, style, className }) {
  return (
    <span
      className={`material-symbols-outlined icon${className ? ' ' + className : ''}`}
      style={{ fontSize: size, fontVariationSettings: fill ? "'FILL' 1" : "'FILL' 0", lineHeight: 1, flexShrink: 0, userSelect: 'none', ...style }}
    >
      {name}
    </span>
  );
}

function ScoreRing({ score, size = 46 }) {
  const sw = size <= 38 ? 3 : 3.5;
  const r = (size - sw * 2) / 2;
  const circ = 2 * Math.PI * r;
  const pct = score != null ? Math.min(score, 100) / 100 : 0;
  const offset = circ * (1 - pct);
  const color = ringColor(score);
  return (
    <svg width={size} height={size} style={{ flexShrink: 0 }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--line)" strokeWidth={sw} />
      <circle cx={size/2} cy={size/2} r={r} fill="none"
        stroke={color} strokeWidth={sw}
        strokeDasharray={circ} strokeDashoffset={offset}
        strokeLinecap="round"
        transform={`rotate(-90 ${size/2} ${size/2})`}
        style={{ transition: 'stroke-dashoffset 0.6s ease' }}
      />
      {score != null && (
        <text x={size/2} y={size/2 + 4} textAnchor="middle"
          style={{ fontSize: size * 0.26, fontWeight: 800, fill: 'var(--txt)', fontVariantNumeric: 'tabular-nums' }}>
          {score}
        </text>
      )}
    </svg>
  );
}

function MatchChip({ size = 'sm' }) {
  return (
    <span className={`match-chip${size === 'tiny' ? ' is-tiny' : ''}`}>
      <Icon name="auto_awesome" size={size === 'tiny' ? 9 : 10} fill />
      Affects matching
    </span>
  );
}

function WorkModelBadge({ model }) {
  const cls = model === 'Remote' ? 'wm-remote' : model === 'Hybrid' ? 'wm-hybrid' : 'wm-onsite';
  return <span className={`wm-badge ${cls}`}>{model || 'Unknown'}</span>;
}

function SalaryChip({ min, max, currency }) {
  const value = formatSalary(min, max, currency);
  if (!value) return <span className="salary-chip is-unlisted"><Icon name="payments" size={11} /> Salary not listed</span>;
  return <span className="salary-chip"><Icon name="payments" size={11} fill /> {value}</span>;
}

function SourceChiclet({ id }) {
  const m = SOURCE_META[id] || { abbr: '?', color: '#666' };
  return (
    <span className={`src-chiclet src-${id}`} title={m.label}
      style={{ background: id === 'remoteok' ? 'var(--src-remoteok-bg, #2a2a2a)' : m.color }}>
      {m.abbr}
    </span>
  );
}

function SourceBadge({ source, also = [] }) {
  const all = [source, ...(also || []).filter(s => s !== source)];
  if (all.length === 1) {
    const m = SOURCE_META[source] || { label: source };
    return (
      <span className="src-badge">
        <SourceChiclet id={source} />
        {m.label}
      </span>
    );
  }
  const names = all.map(s => (SOURCE_META[s] || { label: s }).label).join(', ');
  return (
    <span className="src-badge" title={`Found on ${all.length} sources: ${names}`}>
      <span className="src-stack">
        {all.slice(0, 3).map(s => <SourceChiclet key={s} id={s} />)}
      </span>
      <span style={{ marginLeft: 2 }}>{all.length} sources</span>
    </span>
  );
}

// ─── ResultRow ──────────────────────────────────────────────────

function ResultRow({ job, density = 'comfy', active = false, saving = false, onSelect, onProcess, onSave, onDismiss, onRestore }) {
  if (saving) {
    return (
      <div className="dres d-comfy dsc-saving-row">
        <div className="dres-score"><Icon name="check_circle" size={28} fill style={{ color: 'var(--success)' }} /></div>
        <div className="dres-body">
          <div className="dres-line1">
            <span className="dres-logo">{initials(job.company)}</span>
            <span className="dres-title">{job.title}</span>
            <span className="dres-co">· {job.company}</span>
          </div>
          <div className="dres-line2">
            <span className="dsc-saving-badge"><Icon name="bookmark_added" size={13} fill /> Saved to pipeline</span>
            <span className="dres-meta" style={{ color: 'var(--success)' }}>Now tracked — opening analysis…</span>
          </div>
        </div>
        <div className="dres-right">
          <button className="btn btn-sm" onClick={() => onProcess && onProcess(job)}>
            <Icon name="open_in_new" size={13} /> View
          </button>
        </div>
      </div>
    );
  }

  const dismissed = job.is_dismissed;
  const saved = job.is_saved || job.is_imported;
  const band = bandFor(job.ai_match_score);
  const score = job.ai_match_score;
  const also = job._also_sources || [];

  return (
    <div
      className={`dres d-${density}${active ? ' is-active' : ''}${dismissed ? ' is-dismissed' : ''}`}
      onClick={() => !dismissed && onSelect && onSelect(job)}
    >
      <div className="dres-score">
        <ScoreRing score={score} size={density === 'compact' ? 38 : 46} />
      </div>

      <div className="dres-body">
        <div className="dres-line1">
          <span className="dres-logo">{initials(job.company)}</span>
          <span className="dres-title">{job.title || 'Untitled Role'}</span>
          <span className="dres-co">· {job.company || 'Unknown'}</span>
        </div>
        <div className="dres-line2">
          {job.remote_type && job.remote_type !== 'unknown' && (
            <WorkModelBadge model={job.remote_type.charAt(0).toUpperCase() + job.remote_type.slice(1)} />
          )}
          {job.location && (
            <span className="dres-meta"><Icon name="location_on" size={13} />{job.location}</span>
          )}
          <SalaryChip min={job.salary_min} max={job.salary_max} currency={job.salary_currency} />
          <SourceBadge source={job.source_provider} also={also} />
          {score != null && (
            <span className={`chip ${band.cls}`} style={{ fontSize: 10 }}>
              <Icon name="auto_awesome" size={10} fill /> {band.label}
            </span>
          )}
        </div>
        {density !== 'compact' && job.description && (
          <div className="dres-excerpt">
            {job.description.replace(/<[^>]*>/g, '').slice(0, 220)}
          </div>
        )}
      </div>

      <div className="dres-right" onClick={e => e.stopPropagation()}>
        <span className="dres-posted">{relativeTime(job.discovered_at)}</span>
        {dismissed ? (
          <button className="btn btn-sm" onClick={() => onRestore && onRestore(job)}>
            <Icon name="undo" size={13} /> Restore
          </button>
        ) : saved ? (
          <span className="dres-savedtag"><Icon name="check_circle" size={14} fill /> In pipeline</span>
        ) : (
          <div className="dres-actions">
            <button className="btn btn-primary btn-sm" title="Save & run analysis"
              onClick={() => onProcess && onProcess(job)}>
              <Icon name="bolt" size={13} fill /> Process
            </button>
            <button className="btn btn-sm" onClick={() => onSave && onSave(job)}>
              <Icon name="bookmark_add" size={14} /> Save
            </button>
            <button className="dres-dismiss" title="Dismiss" onClick={() => onDismiss && onDismiss(job)}>
              <Icon name="close" size={16} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── QueryBar ───────────────────────────────────────────────────

function QueryBar({ keywords, location, workModel, onKeywordsChange, onLocationChange, onWorkModelChange, onSearch, isLoading }) {
  const models = ['Any', 'Remote', 'Hybrid', 'Onsite'];
  const [showModelMenu, setShowModelMenu] = useState(false);

  return (
    <div className="dsc-query">
      <label className="dsc-field kw">
        <Icon name="search" size={16} />
        <input
          value={keywords}
          onChange={e => onKeywordsChange(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && onSearch()}
          placeholder="Keywords — role, skill, company"
        />
      </label>
      <label className="dsc-field loc">
        <Icon name="location_on" size={16} />
        <input
          value={location}
          onChange={e => onLocationChange(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && onSearch()}
          placeholder="Location (optional)"
        />
      </label>
      <div style={{ position: 'relative' }}>
        <button className="dsc-model" onClick={() => setShowModelMenu(m => !m)}>
          <Icon name="home_work" size={15} /> {workModel || 'Any'}
          <Icon name="expand_more" size={15} />
        </button>
        {showModelMenu && (
          <div className="popover" style={{ top: 'calc(100% + 4px)', left: 0, minWidth: 120, zIndex: 50 }}>
            {models.map(m => (
              <button key={m} className="popover-item" onClick={() => { onWorkModelChange(m); setShowModelMenu(false); }}>
                {workModel === m && <Icon name="check" size={14} style={{ color: 'var(--primary)' }} />}
                {m}
              </button>
            ))}
          </div>
        )}
      </div>
      <button className="btn btn-primary" style={{ height: 38 }} onClick={onSearch} disabled={isLoading}>
        <Icon name="search" size={16} /> {isLoading ? 'Searching…' : 'Search'}
      </button>
    </div>
  );
}

// ─── SourcesBar ─────────────────────────────────────────────────

function SourcesBar({ sources }) {
  return (
    <div className="dsc-sources">
      <span className="label" style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--txt-dim)' }}>
        Sources
      </span>
      {sources.map(s => (
        <span key={s.id} className={`dsc-src s-${s.state}`}
          title={`${s.label} · ${s.state}${s.latency ? ' · ' + s.latency : ''}`}>
          <span className="src-dot" />
          {s.label}
          {s.state === 'down' || s.state === 'limit'
            ? <span className="dsc-src-n">{s.error || s.state}</span>
            : <span className="dsc-src-n">{s.count ?? 0}</span>
          }
        </span>
      ))}
      <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 700, color: 'var(--txt-dim)',
        display: 'inline-flex', alignItems: 'center', gap: 5, cursor: 'pointer' }}>
        <Icon name="settings" size={13} /> Manage
      </span>
    </div>
  );
}

// ─── ThresholdPopover ───────────────────────────────────────────

function ThresholdPopover({ threshold, hiddenCount, onThresholdChange, onToggleHide, hideBelow }) {
  const trackRef = useRef(null);

  const handleTrackClick = e => {
    if (!trackRef.current) return;
    const rect = trackRef.current.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    onThresholdChange(Math.round(pct * 100));
  };

  const handleKnobDrag = e => {
    e.preventDefault();
    const track = trackRef.current;
    if (!track) return;
    const move = ev => {
      const rect = track.getBoundingClientRect();
      const pct = Math.max(0, Math.min(1, (ev.clientX - rect.left) / rect.width));
      onThresholdChange(Math.round(pct * 100));
    };
    const up = () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  };

  return (
    <div className="popover thresh-pop" style={{ top: 'calc(100% + 8px)', left: 0, zIndex: 60 }}>
      <div className="thresh-head">
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--txt-2)' }}>Minimum match score</span>
        <span className="thresh-val">{threshold}</span>
      </div>
      <div className="why-note is-up" style={{ marginBottom: 10 }}>
        <Icon name="auto_awesome" size={13} fill />
        <span>Scores come from your <b>Profile</b>. A stronger profile raises every result's score.</span>
      </div>
      <div className="thresh-track" ref={trackRef} onClick={handleTrackClick} style={{ cursor: 'pointer' }}>
        <div className="thresh-fill" style={{ width: `${threshold}%` }} />
        <div className="thresh-knob" style={{ left: `${threshold}%` }} onMouseDown={handleKnobDrag} />
      </div>
      <div className="thresh-scale"><span>0</span><span>Stretch</span><span>Good</span><span>Strong</span><span>100</span></div>
      <div style={{ height: 1, background: 'var(--line)', margin: '10px 0' }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
        <Icon name="visibility_off" size={14} />
        <span style={{ flex: 1 }}>Hide results below threshold</span>
        <input type="checkbox" checked={hideBelow} onChange={e => onToggleHide(e.target.checked)} />
        <span className="dsc-fresh" style={{ background: 'var(--txt-dim)' }}>{hiddenCount}</span>
      </div>
    </div>
  );
}

// ─── FilterBar ──────────────────────────────────────────────────

function FilterBar({ threshold, hiddenCount, resultCount, sort, onSortChange, onThresholdChange, onToggleHide, hideBelow, showDismissed, onToggleDismissed }) {
  const [showThresh, setShowThresh] = useState(false);
  const [showSortMenu, setShowSortMenu] = useState(false);
  const sortLabel = { match: 'Best match', date: 'Newest', salary: 'Salary' }[sort];

  return (
    <div className="dsc-filters">
      <div style={{ position: 'relative' }}>
        <button className={`dsc-filter${threshold > 0 ? ' has-value' : ''}`}
          onClick={() => setShowThresh(s => !s)}>
          <Icon name="speed" size={14} />
          Match ≥ {threshold}
          <MatchChip size="tiny" />
        </button>
        {showThresh && (
          <ThresholdPopover
            threshold={threshold}
            hiddenCount={hiddenCount}
            onThresholdChange={onThresholdChange}
            onToggleHide={onToggleHide}
            hideBelow={hideBelow}
          />
        )}
      </div>

      <button className={`dsc-filter${showDismissed ? ' has-value' : ''}`}
        onClick={() => onToggleDismissed(!showDismissed)}>
        <Icon name="visibility" size={14} />
        {showDismissed ? 'Hiding dismissed' : 'Show dismissed'}
      </button>

      <span className="dsc-result-count">
        <Icon name="check_circle" size={13} fill style={{ color: 'var(--success)' }} />
        {resultCount} results
      </span>

      <div style={{ position: 'relative', marginLeft: 'auto' }}>
        <button className="dsc-sort" onClick={() => setShowSortMenu(s => !s)}>
          <Icon name="sort" size={14} /> {sortLabel} <Icon name="expand_more" size={13} />
        </button>
        {showSortMenu && (
          <div className="popover" style={{ top: 'calc(100% + 4px)', right: 0, minWidth: 140, zIndex: 50 }}>
            {[['match', 'Best match'], ['date', 'Newest'], ['salary', 'Salary']].map(([val, label]) => (
              <button key={val} className="popover-item" onClick={() => { onSortChange(val); setShowSortMenu(false); }}>
                {sort === val && <Icon name="check" size={14} style={{ color: 'var(--primary)' }} />}
                {label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── SavedRail ──────────────────────────────────────────────────

function SavedRail({ savedSearches, activeId, onPick, onNewSearch, onRunAll, onToggleAlerts, isRunningAll, collapsed }) {
  // Instant hover tooltip for the collapsed (icon-only) rail. Positioned with
  // fixed viewport coords so it's never clipped by the rail's overflow.
  const [tip, setTip] = useState(null); // { label, top }
  const showTip = (label, e) => {
    const r = e.currentTarget.getBoundingClientRect();
    setTip({ label, left: r.right + 8, top: r.top + r.height / 2 });
  };
  const hideTip = () => setTip(null);

  if (collapsed) {
    return (
      <aside className="dsc-rail is-collapsed">
        <button className="dsc-rail-cnew" onClick={onNewSearch}
          onMouseEnter={e => showTip('New search', e)} onMouseLeave={hideTip}>
          <Icon name="add" size={18} />
        </button>
        <div className="dsc-rail-clist">
          <button
            className={`dsc-rail-citem${activeId === null ? ' is-active' : ''}`}
            onClick={() => onPick(null)}
            onMouseEnter={e => showTip('All results', e)} onMouseLeave={hideTip}
          >
            <Icon name="list" size={18} fill={activeId === null} />
          </button>
          {savedSearches.map(s => (
            <button
              key={s.id}
              className={`dsc-rail-citem${activeId === s.id ? ' is-active' : ''}`}
              onClick={() => onPick(s.id)}
              onMouseEnter={e => showTip(s.name, e)} onMouseLeave={hideTip}
            >
              <Icon name="travel_explore" size={18} fill={activeId === s.id} />
            </button>
          ))}
        </div>
        <button className="dsc-rail-crun" onClick={onRunAll} disabled={isRunningAll}
          onMouseEnter={e => showTip('Run all now', e)} onMouseLeave={hideTip}>
          <Icon name="bolt" size={18} fill className={isRunningAll ? 'spin' : ''} />
        </button>
        {tip && (
          <div className="dsc-rail-tip" style={{ left: tip.left, top: tip.top }}>
            {tip.label}
          </div>
        )}
      </aside>
    );
  }

  return (
    <aside className="dsc-rail">
      <div className="dsc-rail-head">
        <span className="label" style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--txt-dim)' }}>
          Saved Searches
        </span>
        <button className="dsc-rail-new" title="New search" onClick={onNewSearch}>
          <Icon name="add" size={16} />
        </button>
      </div>
      <div className="dsc-rail-list">
        {/* "All results" item */}
        <div className={`dsc-saved${activeId === null ? ' is-active' : ''}`} onClick={() => onPick(null)}>
          <Icon name="list" size={16} className="ds-ic" fill={activeId === null} />
          <div className="dsc-saved-main">
            <div className="dsc-saved-name">All results</div>
          </div>
          <div className="dsc-saved-right" />
        </div>
        {savedSearches.map(s => (
          <div key={s.id} className={`dsc-saved${activeId === s.id ? ' is-active' : ''}`}
            onClick={() => onPick(s.id)}>
            <Icon name="travel_explore" size={16} className="ds-ic" fill={activeId === s.id} />
            <div className="dsc-saved-main">
              <div className="dsc-saved-name">{s.name}</div>
              <div className="dsc-saved-meta">
                {s.keywords && <span className="dsc-mini"><Icon name="search" size={11} />{s.keywords}</span>}
                {s.location && <span className="dsc-mini"><Icon name="location_on" size={11} />{s.location}</span>}
                {s.remote_filter && s.remote_filter !== 'any' && (
                  <span className="dsc-mini">{s.remote_filter.charAt(0).toUpperCase() + s.remote_filter.slice(1)}</span>
                )}
              </div>
              {s.last_run_at && (
                <div className="dsc-saved-last">Last run {relativeTime(s.last_run_at)}</div>
              )}
            </div>
            <div className="dsc-saved-right">
              <Icon
                name={s.alerts ? 'notifications_active' : 'notifications_off'} size={14}
                className={s.alerts ? 'dsc-alert-on' : 'dsc-alert-off'}
                fill={s.alerts}
                onClick={e => { e.stopPropagation(); onToggleAlerts(s.id, !s.alerts); }}
                title={s.alerts ? 'Alerts on' : 'Alerts off'}
                style={{ cursor: 'pointer' }}
              />
            </div>
          </div>
        ))}
      </div>
      <div className="dsc-rail-foot">
        <button className="dsc-runall" onClick={onRunAll} disabled={isRunningAll}>
          <Icon name="bolt" size={14} fill />
          {isRunningAll ? 'Running…' : 'Run all now'}
        </button>
      </div>
    </aside>
  );
}

// ─── WhyMatch ───────────────────────────────────────────────────

function WhyMatch({ job, profileAvg }) {
  // TODO: backend — matchDimensions, whyTop, whyGap not yet returned by score endpoint.
  // The score endpoint returns overall_score only. Show ring + band + a coaching note.
  const score = job.ai_match_score;
  const band = score != null ? bandFor(score) : null;

  return (
    <div>
      <div className="dpane-sec-label">
        <Icon name="insights" size={13} /> Why this matches you <MatchChip size="tiny" />
      </div>

      {score != null ? (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
            <ScoreRing score={score} size={56} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--txt)' }}>{band.label}</div>
              {profileAvg != null && (
                <span className={`chip ${score >= profileAvg ? 'chip-green' : 'chip-amber'}`}
                  style={{ fontSize: 10, marginTop: 4, display: 'inline-flex' }}>
                  <Icon name={score >= profileAvg ? 'arrow_upward' : 'arrow_downward'} size={10} />
                  {score >= profileAvg ? `+${score - profileAvg}` : score - profileAvg} vs your avg ({profileAvg})
                </span>
              )}
            </div>
          </div>
          <div className="why-note" style={{ background: 'var(--primary-soft)', borderColor: 'var(--primary-edge)', marginBottom: 10 }}>
            <Icon name="tips_and_updates" size={14} fill style={{ color: 'var(--primary)' }} />
            <span style={{ fontSize: 12 }}>
              Process this job to see a full match breakdown and get a tailored resume.{' '}
              <span style={{ color: 'var(--txt-dim)', fontSize: 11 }}>(Detailed dimensions coming soon)</span>
            </span>
          </div>
        </>
      ) : (
        <div className="why-note" style={{ marginBottom: 10 }}>
          <Icon name="auto_awesome" size={14} />
          <span style={{ fontSize: 12 }}>Score calculated after processing. Hit <b>Process</b> to see how well this matches your profile.</span>
        </div>
      )}
    </div>
  );
}

// ─── DetailPane ─────────────────────────────────────────────────

function DetailPane({ job, width, onClose, onProcess, onSave, onDismiss, onWidthChange, onDescriptionFetched }) {
  const ref = useRef(null);
  const [fetchingDesc, setFetchingDesc] = useState(false);

  // Auto-fetch description for Adzuna (always truncated) or any job with short desc
  useEffect(() => {
    if (!job) return;
    const isShort = !job.description || job.description.length < 400;
    const needsFetch = job.url && (job.source_provider !== 'adzuna' ? isShort : job.description?.length < 3000);
    if (!needsFetch) return;
    setFetchingDesc(true);
    fetch(`${API_URL}/api/job-discovery/discovered-jobs/${job.id}/fetch-description`, {
      method: 'POST', headers: getAuthHeaders(),
    })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.description) onDescriptionFetched && onDescriptionFetched(job.id, data.description); })
      .finally(() => setFetchingDesc(false));
  }, [job?.id]);

  // Drag-to-resize (left edge → drag left = wider)
  const startResize = e => {
    if (!onWidthChange) return;
    e.preventDefault();
    const startX = e.clientX;
    const startW = width;
    const move = ev => onWidthChange(clampPaneWidth(startW + (startX - ev.clientX)));
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

  if (!job) return null;
  const salary = formatSalary(job.salary_min, job.salary_max, job.salary_currency);
  const also = job._also_sources || [];
  const allSources = [job.source_provider, ...also.filter(s => s !== job.source_provider)];

  return (
    <aside className="dpane" ref={ref} style={{ width }}>
      <div className="dpane-resize" onMouseDown={startResize} title="Drag to resize">
        <span className="dpane-resize-grip"><Icon name="drag_indicator" size={14} /></span>
      </div>

      <div className="dpane-top">
        <div className="dpane-head">
          <span className="dpane-logo">{initials(job.company)}</span>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="dpane-title">{job.title || 'Untitled Role'}</div>
            <div className="dpane-co">{job.company || 'Unknown'}</div>
          </div>
          <button className="dpane-close" onClick={onClose} title="Close">
            <Icon name="close" size={18} />
          </button>
        </div>
        <div className="dpane-meta">
          {job.remote_type && job.remote_type !== 'unknown' && (
            <WorkModelBadge model={job.remote_type.charAt(0).toUpperCase() + job.remote_type.slice(1)} />
          )}
          {job.location && <span className="dres-meta"><Icon name="location_on" size={13} />{job.location}</span>}
          {salary && <span className="salary-chip"><Icon name="payments" size={11} fill /> {salary}</span>}
          <span className="chip"><Icon name="schedule" size={11} /> {relativeTime(job.discovered_at)} ago</span>
        </div>
      </div>

      <div className="dpane-body">
        <WhyMatch job={job} profileAvg={null} />

        <div style={{ height: 16 }} />
        <div className="dpane-sec-label"><Icon name="hub" size={13} /> Listing source</div>
        <div className="dpane-prov">
          <span className="src-stack">{allSources.map(s => <SourceChiclet key={s} id={s} />)}</span>
          <span className="dpane-prov-label">
            {allSources.length > 1 ? `Found on ${allSources.length} sources — ` : 'Via '}
            {allSources.map(s => (SOURCE_META[s] || { label: s }).label).join(', ')}
          </span>
          {job.url && (
            <a href={job.url} target="_blank" rel="noopener noreferrer"
              style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 700, color: 'var(--primary)',
                display: 'inline-flex', alignItems: 'center', gap: 4, textDecoration: 'none' }}>
              <Icon name="open_in_new" size={12} /> Original
            </a>
          )}
        </div>

        <div style={{ height: 16 }} />
        <div className="dpane-sec-label">
          <Icon name="article" size={13} /> Job description
          {fetchingDesc && <span style={{ fontWeight: 400, textTransform: 'none', fontSize: 11, color: 'var(--txt-dim)', marginLeft: 6 }}>fetching…</span>}
        </div>
        {job.source_provider === 'adzuna' && (
          <div className="why-note" style={{ marginBottom: 10 }}>
            <Icon name="info" size={14} />
            <span style={{ fontSize: 12 }}>Adzuna provides a preview only.{' '}
              {job.url && <a href={job.url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)' }}>View full listing →</a>}
            </span>
          </div>
        )}
        <div className="dpane-desc"
          dangerouslySetInnerHTML={{ __html: job.description
            ? job.description.replace(/\n/g, '<br/>')
            : fetchingDesc ? '<em style="color:var(--txt-dim)">Loading…</em>' : '<em style="color:var(--txt-dim)">No description available.</em>'
          }}
        />
      </div>

      <div className="dpane-foot">
        <button className="btn btn-primary" onClick={() => onProcess(job)}>
          <Icon name="bolt" size={15} fill /> Process Now
        </button>
        <button className="btn" onClick={() => onSave(job)}>
          <Icon name="bookmark_add" size={14} /> Save
        </button>
        <button className="btn btn-icon" title="Dismiss" onClick={() => onDismiss(job)}>
          <Icon name="close" size={16} />
        </button>
      </div>
    </aside>
  );
}

// ─── Ghost / streaming / partial state components ────────────────

function GhostRows({ n = 3 }) {
  return Array.from({ length: n }).map((_, i) => (
    <div key={i} className="dsc-ghost">
      <div className="gk circ" style={{ width: 44, height: 44 }} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
        <div className="gk" style={{ height: 13, width: `${55 - i * 8}%` }} />
        <div className="gk" style={{ height: 10, width: `${78 - i * 6}%` }} />
      </div>
      <div className="gk" style={{ height: 28, width: 90 }} />
    </div>
  ));
}

function StreamBanner({ sources }) {
  return (
    <div className="dsc-stream">
      <Icon name="bolt" size={14} fill style={{ color: 'var(--primary)' }} />
      <span style={{ color: 'var(--txt-2)' }}>Searching {sources.length} sources…</span>
      {sources.map(s => (
        <span key={s.id} className={`dsc-stream-src${s.done ? ' is-done' : ''}`}>
          {s.done
            ? <Icon name="check_circle" size={14} fill />
            : <Icon name="progress_activity" size={14} className="spin" />}
          {s.label}{s.done ? ` · ${s.count}` : '…'}
        </span>
      ))}
    </div>
  );
}

function PartialBanner({ failedSources, onRetry }) {
  if (!failedSources?.length) return null;
  return (
    <div className="dsc-stream" style={{ background: 'var(--warn-soft)' }}>
      <Icon name="warning" size={14} fill style={{ color: 'var(--warn)' }} />
      <span style={{ color: 'var(--warn)', fontWeight: 700 }}>{failedSources[0]} is down</span>
      <span style={{ color: 'var(--txt-2)' }}> — showing results from other sources.</span>
      <button className="btn btn-sm" style={{ marginLeft: 'auto' }} onClick={onRetry}>
        <Icon name="refresh" size={13} /> Retry
      </button>
    </div>
  );
}

// ─── Takeover state components ───────────────────────────────────

function StateEmpty({ onNewSearch, onRunAll }) {
  return (
    <div className="dsc-state">
      <div className="dsc-state-hero">
        <div className="dsc-state-icon"><Icon name="travel_explore" size={28} /></div>
        <div>
          <h2>Find your next role</h2>
          <p>Search across your connected sources at once. Every result is scored against your Profile, so the strongest matches rise to the top.</p>
        </div>
      </div>
      <div className="dsc-methods">
        <button className="dsc-method is-primary" onClick={onNewSearch}>
          <span className="dsc-method-tag">Start here</span>
          <div className="dsc-method-icon"><Icon name="search" size={18} /></div>
          <div className="dsc-method-title">Run a search</div>
          <div className="dsc-method-sub">Type a role or skill above and hit Search.</div>
          <div className="dsc-method-foot">Type above <Icon name="arrow_upward" size={12} /></div>
        </button>
        <button className="dsc-method" onClick={onNewSearch}>
          <div className="dsc-method-icon"><Icon name="bookmark" size={18} /></div>
          <div className="dsc-method-title">Open a saved search</div>
          <div className="dsc-method-sub">Re-run one of your saved queries from the rail.</div>
          <div className="dsc-method-foot">View saved <Icon name="arrow_forward" size={12} /></div>
        </button>
        <button className="dsc-method" onClick={onRunAll}>
          <div className="dsc-method-icon"><Icon name="bolt" size={18} /></div>
          <div className="dsc-method-title">Run all sources</div>
          <div className="dsc-method-sub">Sweep every connected source with your saved searches.</div>
          <div className="dsc-method-foot">Run all <Icon name="arrow_forward" size={12} /></div>
        </button>
      </div>
    </div>
  );
}

function StateZero({ keywords, location }) {
  return (
    <div className="dsc-state">
      <div className="dsc-state-icon is-empty" style={{ marginTop: 12 }}>
        <Icon name="search_off" size={28} />
      </div>
      <h3>No jobs found{keywords ? ` for "${keywords}"` : ''}{location ? ` in ${location}` : ''}</h3>
      <p className="sub">All sources responded — none matched this query and your current filters.</p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', marginTop: 4 }}>
        <button className="btn btn-sm"><Icon name="location_off" size={14} /> Clear location</button>
        <button className="btn btn-sm"><Icon name="speed" size={14} /> Lower match to ≥ 50</button>
        <button className="btn btn-sm"><Icon name="public" size={14} /> Include Remote</button>
        <button className="btn btn-sm btn-ghost"><Icon name="filter_list_off" size={14} /> Reset filters</button>
      </div>
    </div>
  );
}

function ProfileNudge({ setScreen }) {
  return (
    <div className="dsc-profile-nudge">
      <Icon name="auto_awesome" size={18} fill />
      <div className="dsc-profile-nudge-text">
        These scores reflect your <b>Profile</b>. A stronger profile surfaces better matches.
      </div>
      <button className="btn btn-sm btn-primary" onClick={() => setScreen && setScreen('profile')}>
        <Icon name="tune" size={13} /> Improve Profile
      </button>
    </div>
  );
}

// ─── Main Discover component ─────────────────────────────────────

export default function Discover({ user, setScreen, onPaneOpenChange, onApplicationsChanged }) {
  // ── Query state ──
  const [keywords, setKeywords] = useState('');
  const [location, setLocation] = useState('');
  const [workModel, setWorkModel] = useState('Any');

  // ── Results state ──
  const [discoveredJobs, setDiscoveredJobs] = useState([]);
  const [providerStatus, setProviderStatus] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [streamSources, setStreamSources] = useState([]);

  // ── Filter/sort state ──
  const [sort, setSort] = useState('match');
  const [threshold, setThreshold] = useState(0);
  const [hideBelow, setHideBelow] = useState(false);
  const [showDismissed, setShowDismissed] = useState(false);
  const [density] = useState('comfy');

  // ── Saved searches state ──
  const [savedSearches, setSavedSearches] = useState([]);
  const [selectedSearchId, setSelectedSearchId] = useState(null);
  const [isRunningAll, setIsRunningAll] = useState(false);

  // ── Detail pane state ──
  const [selectedJob, setSelectedJob] = useState(null);
  // Has the user manually dragged the pane? If not, it tracks 60% of the window.
  const paneManuallySized = useRef(localStorage.getItem('dsc_pane_width') != null);
  const [paneWidth, setPaneWidth] = useState(() => {
    const saved = localStorage.getItem('dsc_pane_width');
    const initial = saved ? parseInt(saved, 10) : window.innerWidth * PANE_DEFAULT_FRACTION;
    return clampPaneWidth(initial);
  });

  // On window resize: if the user hasn't dragged it, keep it pinned to 60% of
  // the viewport; otherwise just clamp their chosen width so the center list is
  // never crushed. Either way other views can't break.
  useEffect(() => {
    const onResize = () => setPaneWidth(w =>
      paneManuallySized.current ? clampPaneWidth(w) : clampPaneWidth(window.innerWidth * PANE_DEFAULT_FRACTION)
    );
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // ── Row-level saving animation ──
  const [savingIds, setSavingIds] = useState(new Set());

  // ── Toast ──
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);

  // ── New search modal ──
  const [showNewSearch, setShowNewSearch] = useState(false);

  // ── Duplicate-save confirmation ── { job, existing } when a save hit a dupe
  const [dupConfirm, setDupConfirm] = useState(null);

  const showToast = msg => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3000);
  };

  const handlePaneWidthChange = w => {
    paneManuallySized.current = true;
    setPaneWidth(w);
    localStorage.setItem('dsc_pane_width', w);
  };

  // ── Load initial data ──
  useEffect(() => {
    fetchSavedSearches();
    fetchProviderStatus();
    fetchDiscoveredJobs(null);
  }, []);

  // ── Tell the shell to collapse the main sidebar while a detail pane is open ──
  useEffect(() => {
    onPaneOpenChange && onPaneOpenChange(selectedJob != null);
  }, [selectedJob != null]);
  useEffect(() => () => onPaneOpenChange && onPaneOpenChange(false), []);

  const fetchSavedSearches = async () => {
    try {
      const r = await fetch(`${API_URL}/api/job-discovery/saved-searches`, { headers: getAuthHeaders() });
      if (r.ok) setSavedSearches(await r.json());
    } catch {}
  };

  const fetchProviderStatus = async () => {
    try {
      const r = await fetch(`${API_URL}/api/job-discovery/provider-status`, { headers: getAuthHeaders() });
      if (r.ok) setProviderStatus(await r.json());
    } catch {}
  };

  const fetchDiscoveredJobs = async (searchId) => {
    setIsLoading(true);
    try {
      const url = searchId
        ? `${API_URL}/api/job-discovery/discovered-jobs?search_id=${searchId}`
        : `${API_URL}/api/job-discovery/discovered-jobs`;
      const r = await fetch(url, { headers: getAuthHeaders() });
      if (r.ok) {
        const data = await r.json();
        setDiscoveredJobs(Array.isArray(data) ? data : []);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // ── Client-side cross-provider dedup ──
  // Group by normalized (title, company) — keep highest score, attach alsoSources
  const deduped = (() => {
    const map = new Map();
    for (const job of discoveredJobs) {
      const key = normKey(job.title, job.company);
      if (!map.has(key)) {
        map.set(key, { ...job, _also_sources: [job.source_provider] });
      } else {
        const existing = map.get(key);
        existing._also_sources.push(job.source_provider);
        // Keep higher score as canonical
        if ((job.ai_match_score ?? -1) > (existing.ai_match_score ?? -1)) {
          map.set(key, { ...job, _also_sources: existing._also_sources });
        }
      }
    }
    return Array.from(map.values());
  })();

  // ── Filtering ──
  const filtered = deduped.filter(j => {
    if (!showDismissed && j.is_dismissed) return false;
    if (hideBelow && threshold > 0 && j.ai_match_score != null && j.ai_match_score < threshold) return false;
    return true;
  });

  const hiddenCount = deduped.filter(j =>
    !j.is_dismissed && hideBelow && threshold > 0 && j.ai_match_score != null && j.ai_match_score < threshold
  ).length;

  // ── Sorting ──
  const sorted = [...filtered].sort((a, b) => {
    if (sort === 'match') return (b.ai_match_score ?? -1) - (a.ai_match_score ?? -1);
    if (sort === 'date') return new Date(b.discovered_at) - new Date(a.discovered_at);
    if (sort === 'salary') return (b.salary_max ?? b.salary_min ?? 0) - (a.salary_max ?? a.salary_min ?? 0);
    return 0;
  });

  // ── Sources health strip ──
  const sources = Object.entries(providerStatus).map(([id, info]) => ({
    id,
    label: (SOURCE_META[id] || { label: id }).label,
    state: !info.configured ? 'down' : !info.available ? 'limit' : 'ok',
    count: discoveredJobs.filter(j => j.source_provider === id).length,
    error: !info.configured ? 'No key' : info.exhausted_window ? 'Rate-limited' : null,
  }));

  // ── Search ──
  const handleSearch = async () => {
    if (!keywords.trim()) return;
    setIsLoading(true);
    setSelectedJob(null);
    setSelectedSearchId(null);
    // Show streaming banner
    const srcList = sources.filter(s => s.state === 'ok').map(s => ({ ...s, done: false }));
    setStreamSources(srcList);
    try {
      const r = await fetch(`${API_URL}/api/job-discovery/search`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          keywords,
          location,
          remote_filter: workModel === 'Any' ? 'any' : workModel.toLowerCase(),
        }),
      });
      if (r.ok) {
        const data = await r.json();
        const newCount = data.new_count ?? 0;
        const dupeCount = data.dupe_count ?? 0;
        await fetchDiscoveredJobs(null);
        await fetchProviderStatus();
        if (newCount === 0 && dupeCount === 0) showToast('No results found');
        else if (newCount === 0) showToast(`${dupeCount} results — all already in your list`);
        else showToast(`${newCount} new job${newCount !== 1 ? 's' : ''} added${dupeCount > 0 ? ` · ${dupeCount} already seen` : ''}`);
      }
    } finally {
      setIsLoading(false);
      setStreamSources([]);
    }
  };

  // ── Saved search selection ──
  const handleSelectSearch = id => {
    setSelectedSearchId(id);
    setSelectedJob(null);
    fetchDiscoveredJobs(id);
    if (id !== null) {
      const s = savedSearches.find(x => x.id === id);
      if (s) {
        setKeywords(s.keywords || '');
        setLocation(s.location || '');
        setWorkModel(s.remote_filter === 'any' ? 'Any' : (s.remote_filter?.charAt(0).toUpperCase() + s.remote_filter?.slice(1)) || 'Any');
      }
    }
  };

  // ── Run all now ──
  const handleRunAll = async () => {
    const active = savedSearches.filter(s => s.is_active !== 0 && s.is_active !== false);
    if (!active.length) return;
    setIsRunningAll(true);
    for (const s of active) {
      try {
        await fetch(`${API_URL}/api/job-discovery/saved-searches/${s.id}/run`, {
          method: 'POST', headers: getAuthHeaders(),
        });
      } catch {}
    }
    await fetchDiscoveredJobs(selectedSearchId);
    await fetchSavedSearches();
    showToast(`${active.length} search${active.length !== 1 ? 'es' : ''} refreshed`);
    setIsRunningAll(false);
  };

  // ── Alerts toggle ──
  const handleToggleAlerts = async (id, newVal) => {
    try {
      const r = await fetch(`${API_URL}/api/job-discovery/saved-searches/${id}/alerts`, {
        method: 'PUT', headers: getAuthHeaders(),
      });
      if (r.ok) {
        setSavedSearches(prev => prev.map(s => s.id === id ? { ...s, alerts: newVal } : s));
      }
    } catch {}
  };

  // ── Job actions ──
  const handleProcess = async job => {
    setSavingIds(prev => new Set([...prev, job.id]));
    try {
      const r = await fetch(`${API_URL}/api/job-discovery/discovered-jobs/${job.id}/import`, {
        method: 'POST', headers: getAuthHeaders(),
      });
      if (r.ok) {
        const data = await r.json();
        if (data.job) localStorage.setItem('discover_import_prefill', JSON.stringify(data.job));
        setDiscoveredJobs(prev => prev.map(j => j.id === job.id ? { ...j, is_imported: true } : j));
        if (selectedJob?.id === job.id) setSelectedJob(prev => ({ ...prev, is_imported: true }));
        setTimeout(() => {
          setSavingIds(prev => { const n = new Set(prev); n.delete(job.id); return n; });
          setScreen && setScreen('new_app');
        }, 1200);
      }
    } catch {
      setSavingIds(prev => { const n = new Set(prev); n.delete(job.id); return n; });
    }
  };

  const doSave = async (job, force = false) => {
    try {
      const url = `${API_URL}/api/job-discovery/discovered-jobs/${job.id}/save-to-pipeline${force ? '?force=true' : ''}`;
      const r = await fetch(url, { method: 'POST', headers: getAuthHeaders() });
      if (!r.ok) return;
      const data = await r.json();
      // Backend found an existing application for this job — ask before saving again.
      if (data.duplicate) {
        setDupConfirm({ job, existing: data.existing });
        return;
      }
      setDiscoveredJobs(prev => prev.map(j => j.id === job.id ? { ...j, is_saved: true, is_imported: true } : j));
      if (selectedJob?.id === job.id) setSelectedJob(prev => ({ ...prev, is_saved: true, is_imported: true }));
      showToast(`"${job.title}" saved to pipeline`);
      // Refresh the shared application list so the new card shows up in the dashboard
      onApplicationsChanged && onApplicationsChanged();
    } catch {}
  };

  const handleSave = job => doSave(job, false);

  const handleDismiss = async job => {
    try {
      const r = await fetch(`${API_URL}/api/job-discovery/discovered-jobs/${job.id}/dismiss`, {
        method: 'PUT', headers: getAuthHeaders(),
      });
      if (r.ok) {
        setDiscoveredJobs(prev => prev.map(j => j.id === job.id ? { ...j, is_dismissed: true } : j));
        if (selectedJob?.id === job.id) setSelectedJob(prev => ({ ...prev, is_dismissed: true }));
        if (selectedJob?.id === job.id && !showDismissed) setSelectedJob(null);
      }
    } catch {}
  };

  const handleRestore = async job => {
    try {
      const r = await fetch(`${API_URL}/api/job-discovery/discovered-jobs/${job.id}/restore`, {
        method: 'PUT', headers: getAuthHeaders(),
      });
      if (r.ok) {
        setDiscoveredJobs(prev => prev.map(j => j.id === job.id ? { ...j, is_dismissed: false } : j));
      }
    } catch {}
  };

  // ── View state derivation ──
  const hasQuery = keywords.trim().length > 0;
  const allDown = sources.length > 0 && sources.every(s => s.state !== 'ok');
  const viewState = allDown ? 'nosources'
    : isLoading ? 'streaming'
    : !hasQuery && sorted.length === 0 ? 'empty'
    : hasQuery && sorted.filter(j => !j.is_dismissed).length === 0 && !isLoading ? 'zero'
    : 'results';

  const takeover = ['empty', 'nosources', 'zero'].includes(viewState);
  const hasPane = selectedJob != null;

  // ── Grid columns ── collapse the saved-searches rail to an icon strip
  // when a detail pane is open so the listing gets more room.
  const gridStyle = hasPane
    ? { gridTemplateColumns: `60px minmax(0,1fr) ${paneWidth}px` }
    : {};

  return (
    <div className={`dsc${hasPane ? ' has-pane' : ''}`} style={gridStyle}>
      {/* Left rail */}
      <SavedRail
        savedSearches={savedSearches}
        activeId={selectedSearchId}
        onPick={handleSelectSearch}
        onNewSearch={() => setShowNewSearch(true)}
        onRunAll={handleRunAll}
        onToggleAlerts={handleToggleAlerts}
        isRunningAll={isRunningAll}
        collapsed={hasPane}
      />

      {/* Center column */}
      <div className="dsc-main">
        <QueryBar
          keywords={keywords} location={location} workModel={workModel}
          onKeywordsChange={setKeywords} onLocationChange={setLocation} onWorkModelChange={setWorkModel}
          onSearch={handleSearch} isLoading={isLoading}
        />

        {sources.length > 0 && <SourcesBar sources={sources} />}

        {!takeover && (
          <FilterBar
            threshold={threshold} hiddenCount={hiddenCount}
            resultCount={sorted.filter(j => !j.is_dismissed).length}
            sort={sort} onSortChange={setSort}
            onThresholdChange={setThreshold} onToggleHide={setHideBelow} hideBelow={hideBelow}
            showDismissed={showDismissed} onToggleDismissed={setShowDismissed}
          />
        )}

        {streamSources.length > 0 && <StreamBanner sources={streamSources} />}

        <div className="dsc-results">
          {isLoading && <GhostRows n={3} />}

          {!isLoading && viewState === 'empty' && (
            <StateEmpty onNewSearch={() => document.querySelector('.dsc-field.kw input')?.focus()} onRunAll={handleRunAll} />
          )}
          {!isLoading && viewState === 'nosources' && <StateEmpty onNewSearch={() => {}} onRunAll={handleRunAll} />}
          {!isLoading && viewState === 'zero' && <StateZero keywords={keywords} location={location} />}

          {!isLoading && viewState === 'results' && sorted.map(job => (
            <ResultRow
              key={job.id}
              job={job}
              density={density}
              active={selectedJob?.id === job.id}
              saving={savingIds.has(job.id)}
              onSelect={setSelectedJob}
              onProcess={handleProcess}
              onSave={handleSave}
              onDismiss={handleDismiss}
              onRestore={handleRestore}
            />
          ))}

          {!isLoading && viewState === 'results' && sorted.length > 0 && (
            <ProfileNudge setScreen={setScreen} />
          )}
        </div>
      </div>

      {/* Detail pane */}
      {hasPane && (
        <DetailPane
          job={selectedJob}
          width={paneWidth}
          onClose={() => setSelectedJob(null)}
          onProcess={handleProcess}
          onSave={handleSave}
          onDismiss={handleDismiss}
          onWidthChange={handlePaneWidthChange}
          onDescriptionFetched={(jobId, desc) => {
            setDiscoveredJobs(prev => prev.map(j => j.id === jobId ? { ...j, description: desc } : j));
            setSelectedJob(prev => prev?.id === jobId ? { ...prev, description: desc } : prev);
          }}
        />
      )}

      {/* New Search Modal — simple inline form */}
      {showNewSearch && (
        <NewSearchModal
          providerStatus={providerStatus}
          onClose={() => setShowNewSearch(false)}
          onSaved={created => {
            setSavedSearches(prev => [...prev, created]);
            setShowNewSearch(false);
            showToast(`"${created.name}" saved`);
          }}
        />
      )}

      {/* Duplicate-save confirmation */}
      {dupConfirm && (
        <DuplicateSaveModal
          job={dupConfirm.job}
          existing={dupConfirm.existing}
          onCancel={() => setDupConfirm(null)}
          onConfirm={() => {
            const job = dupConfirm.job;
            setDupConfirm(null);
            doSave(job, true);
          }}
        />
      )}

      {/* Toast */}
      {toast && <div className="inline-toast">{toast}</div>}
    </div>
  );
}

// ─── Duplicate Save Confirmation Modal ───────────────────────────

function DuplicateSaveModal({ job, existing, onCancel, onConfirm }) {
  const statusLabel = existing?.status ? ` (currently in ${existing.status})` : '';
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onCancel()}>
      <div className="modal-card" style={{ maxWidth: 440 }}>
        <h2 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Icon name="content_copy" size={20} /> Already in your pipeline
        </h2>
        <p style={{ color: 'var(--txt-2)', fontSize: 14, lineHeight: 1.5, margin: '4px 0 6px' }}>
          <b>{existing?.job_title || job.title}</b>
          {existing?.company ? <> at <b>{existing.company}</b></> : null} is already saved to your
          pipeline{statusLabel}. Saving again will create a second copy.
        </p>
        <div className="modal-actions">
          <button type="button" className="btn" onClick={onCancel}>Cancel</button>
          <button type="button" className="btn btn-primary" onClick={onConfirm}>
            <Icon name="bookmark_add" size={14} /> Save again
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── New Search Modal (kept from original) ───────────────────────

function NewSearchModal({ onClose, onSaved, providerStatus }) {
  const [form, setForm] = useState({
    name: '',
    keywords: '',
    location: '',
    remote_filter: 'any',
    ai_scoring: false,
    providers: Object.keys(providerStatus || {}).filter(k => providerStatus[k]?.available),
  });
  const [saving, setSaving] = useState(false);

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const handleSubmit = async e => {
    e.preventDefault();
    if (!form.name.trim() || !form.keywords.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/api/job-discovery/saved-searches`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(form),
      });
      if (res.ok) {
        const created = await res.json();
        onSaved(created);
      }
    } catch (err) {
      console.error('Failed to create saved search', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-card">
        <h2>New Saved Search</h2>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          <div className="modal-field">
            <label>Search Name</label>
            <input type="text" placeholder="e.g. Senior Backend Chicago"
              value={form.name} onChange={e => set('name', e.target.value)} required autoFocus />
          </div>
          <div className="modal-field">
            <label>Keywords</label>
            <input type="text" placeholder="e.g. software engineer python"
              value={form.keywords} onChange={e => set('keywords', e.target.value)} required />
          </div>
          <div className="modal-field">
            <label>Location</label>
            <input type="text" placeholder="e.g. Chicago, IL (leave blank for any)"
              value={form.location} onChange={e => set('location', e.target.value)} />
          </div>
          <div className="modal-field">
            <label>Remote Filter</label>
            <select value={form.remote_filter} onChange={e => set('remote_filter', e.target.value)}>
              <option value="any">Any</option>
              <option value="remote">Remote only</option>
              <option value="local">Local / Onsite</option>
              <option value="hybrid">Hybrid</option>
            </select>
          </div>
          <div className="modal-actions">
            <button type="button" className="btn" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving…' : 'Save Search'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
