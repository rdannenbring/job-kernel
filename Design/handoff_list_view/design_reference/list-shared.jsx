/* global React, Icon, CompanyLogo, InterestStars */

// ─── Shared primitives for the List view ────────────────────────
// Builds on the components in shared.jsx (Icon, CompanyLogo, InterestStars,
// StatusPill, DocsCluster) and the mock dataset in kanban-data.jsx (K_APPS,
// K_STAGES, K_END_STAGES, K_STAGE_INDEX, K_SCORE_TINT).

// Default column model. Order is canonical; visible/width tweakable per
// variation. Mobile-aware: each column declares a `primary` flag — primary
// columns are the ones we'd keep on the mobile list later.
window.L_COLUMNS = [
  { id: 'check',   label: '',           width: 36,  primary: true,  align: 'center', locked: true,  sortable: false },
  { id: 'company', label: 'Company',    width: 240, primary: true,  align: 'left',   locked: true,  sortable: true },
  { id: 'role',    label: 'Role',       width: 240, primary: false, align: 'left',                  sortable: true },
  { id: 'stage',   label: 'Stage',      width: 180, primary: true,  align: 'left',                  sortable: true },
  { id: 'score',   label: 'Score',      width: 90,  primary: true,  align: 'left',                  sortable: true },
  { id: 'salary',  label: 'Salary',     width: 130, primary: false, align: 'left',                  sortable: true },
  { id: 'stars',   label: 'Interest',   width: 80,  primary: false, align: 'left',                  sortable: true },
  { id: 'docs',    label: 'Docs',       width: 96,  primary: false, align: 'left',                  sortable: false },
  { id: 'loc',     label: 'Location',   width: 140, primary: false, align: 'left',                  sortable: true },
  { id: 'posted',  label: 'Added',      width: 78,  primary: false, align: 'left',                  sortable: true },
  { id: 'hint',    label: 'Next action', width: 220, primary: true, align: 'left',                  sortable: false },
];

// What "Needs my action" means per stage (drives the preset filter and the
// .is-urgent treatment on Next action). When the row's stage matches and the
// substage isn't complete, we flag it as urgent.
window.L_ACTION_STAGES = new Set(['inbox', 'saved', 'generated']);

// Score helper — reuses K_SCORE_TINT but adds a bar fraction.
window.L_SCORE_CLASS = (s) => s >= 85 ? 's-high' : s >= 70 ? 's-mid' : 's-low';

// ─── ListCheckbox ───────────────────────────────────────────────
function ListCheckbox({ checked, indeterminate, onChange, ariaLabel }) {
  const ref = React.useRef(null);
  React.useEffect(() => { if (ref.current) ref.current.indeterminate = !!indeterminate; }, [indeterminate]);
  return (
    <input ref={ref} type="checkbox"
      className={`lcb ${indeterminate ? 'is-indeterminate' : ''}`}
      checked={!!checked} onChange={onChange}
      onClick={(e) => e.stopPropagation()}
      aria-label={ariaLabel} />
  );
}

// ─── ScoreCell — bar + number (compact) ─────────────────────────
function ScoreCell({ score, vsAvg }) {
  const cls = window.L_SCORE_CLASS(score);
  return (
    <span className={`lscore ${cls}`}>
      <span className="lscore-bar"><i style={{ width: `${score}%` }} /></span>
      <span style={{ minWidth: 22 }}>{score}</span>
    </span>
  );
}

// ─── Tiny score ring (used in Pulse / two-line) ─────────────────
function ScoreMini({ score, size = 28 }) {
  const r = (size - 4) / 2;
  const c = 2 * Math.PI * r;
  const pct = score / 100;
  const color = score >= 85 ? 'var(--success)' : score >= 70 ? 'var(--primary)' : 'var(--warn)';
  return (
    <span className="lscore-mini" style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--line)" strokeWidth="2" />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth="2"
          strokeDasharray={c} strokeDashoffset={c * (1 - pct)} strokeLinecap="round" />
      </svg>
      <span className="n" style={{ color }}>{score}</span>
    </span>
  );
}

// ─── StageCell — chip + substage chip ───────────────────────────
function StageCell({ stage, sub, compact = false }) {
  const def = [...window.K_STAGES, ...window.K_END_STAGES].find(s => s.id === stage) || {};
  const label = def.label || stage;
  const total = def.subCount || 0;
  return (
    <span className={`lstage s-${stage}`}>
      <span className="lstage-dot" />
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
      {!compact && total > 0 && (
        <span className="lstage-sub">{sub}/{total}</span>
      )}
    </span>
  );
}

// ─── PipelineStrip — the inline mini stepper (Variation 3) ──────
// Compact horizontal bar showing where this row's app is across all 6 stages.
function PipelineStrip({ stage, sub, showLabel = true }) {
  const isEnd = ['rejected', 'declined', 'withdrawn'].includes(stage);
  const idx = isEnd ? -1 : (window.K_STAGE_INDEX[stage] - 1); // -1 for 'inbox', 0..5 for active
  const stages = window.K_STAGES.slice(1); // drop 'inbox' — it's pre-pipeline
  const def = [...window.K_STAGES, ...window.K_END_STAGES].find(s => s.id === stage) || {};
  return (
    <div className="lpipe">
      <div style={{ display: 'flex', flex: 1, gap: 2 }}>
        {stages.map((s, i) => {
          const passed = i < idx;
          const current = i === idx;
          let cls = '';
          if (passed) cls = 'is-passed';
          else if (current) cls = 'is-current';
          if (isEnd && i === 0) cls = `s-${stage}`;
          return <span key={s.id} className={`lpipe-step ${cls}`} title={s.label} />;
        })}
      </div>
      {showLabel && (
        <span className="lpipe-label" style={{
          color: isEnd ? 'var(--danger)' : (current => current ? 'var(--primary)' : 'var(--txt-mute)')(idx >= 0),
        }}>
          {def.label}
          {def.subCount > 0 && !isEnd && ` ${sub}/${def.subCount}`}
        </span>
      )}
    </div>
  );
}

// ─── DocsCondensed — 3 small dots, color-coded ──────────────────
function DocsCondensed({ docs }) {
  const meta = [
    { id: 'resume', icon: 'description' },
    { id: 'cover',  icon: 'mail' },
    { id: 'ctx',    icon: 'folder' },
  ];
  return (
    <span className="ldocs">
      {meta.map(m => {
        const state = docs[m.id] || 'missing';
        return (
          <span key={m.id} className={`ldoc-dot s-${state}`} title={`${m.id}: ${state}`}>
            <Icon name={m.icon} size={12} />
          </span>
        );
      })}
    </span>
  );
}

// Text-forward alternative for docs (used in two-line / relaxed density)
function DocsTextForward({ docs }) {
  const ok = Object.values(docs).filter(v => v === 'ok').length;
  const total = 3;
  const needs = total - ok;
  if (needs === 0) {
    return (
      <span className="ldoc-summary" style={{ color: 'var(--success)' }}>
        <Icon name="check_circle" size={13} fill /> All ready
      </span>
    );
  }
  return (
    <span className="ldoc-summary">
      <span style={{ color: 'var(--success)' }}>{ok}</span>
      <span className="gap" />
      <span style={{ color: docs.resume === 'missing' || docs.cover === 'missing' ? 'var(--danger)' : 'var(--warn)' }}>
        {needs} todo
      </span>
    </span>
  );
}

// ─── StarsInline — 3 stars, tap to set ──────────────────────────
function StarsInline({ value, onChange, size = 13 }) {
  return (
    <span className="lstars" onClick={(e) => e.stopPropagation()}>
      {[1, 2, 3].map(n => (
        <Icon key={n} name="star" size={size} fill={n <= value}
          className={n <= value ? 'is-on' : ''}
          style={{ cursor: 'pointer' }}
        />
      ))}
    </span>
  );
}

// ─── HintCell — next-action one-liner ───────────────────────────
function HintCell({ app, urgent }) {
  const isUrgent = urgent ?? (window.L_ACTION_STAGES.has(app.stage));
  return (
    <span className={`lhint ${isUrgent ? 'is-urgent' : ''}`}>
      <Icon name={isUrgent ? 'bolt' : 'schedule'} size={13} fill={isUrgent} />
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{app.hint}</span>
    </span>
  );
}

// ─── QuickActions — hover row tail ──────────────────────────────
function QuickActions({ onOpen, onArchive, onStage }) {
  return (
    <span className="lqa" onClick={(e) => e.stopPropagation()}>
      <button className="lqa-btn" title="Open" onClick={onOpen}>
        <Icon name="open_in_new" size={14} />
      </button>
      <button className="lqa-btn" title="Change stage" onClick={onStage}>
        <Icon name="swap_horiz" size={14} />
      </button>
      <button className="lqa-btn" title="Archive" onClick={onArchive}>
        <Icon name="archive" size={14} />
      </button>
      <button className="lqa-btn" title="More">
        <Icon name="more_vert" size={14} />
      </button>
    </span>
  );
}

// ─── List filter / toolbar — used above the table ──────────────
function ListToolbar({
  active = 'needs',
  onPreset,
  density = 'comfy', onDensity,
  groupBy = false, onGroupBy,
  selectionMode = false,
}) {
  return (
    <div className="lbar">
      <div className="lbar-search">
        <Icon name="search" size={14} />
        <input placeholder="Search companies, roles, notes…" />
        <span className="lbar-kbd">/</span>
      </div>

      <div className="lbar-divider" />

      <button className={`preset ${active === 'needs' ? 'is-active' : ''}`} onClick={() => onPreset && onPreset('needs')}>
        <Icon name="bolt" size={12} fill /> Needs my action <span className="count">8</span>
      </button>
      <button className={`preset ${active === 'active' ? 'is-active' : ''}`} onClick={() => onPreset && onPreset('active')}>
        Active <span className="count">22</span>
      </button>
      <button className={`preset ${active === 'await' ? 'is-active' : ''}`} onClick={() => onPreset && onPreset('await')}>
        Awaiting response <span className="count">5</span>
      </button>
      <button className={`preset is-pinned ${active === 'high' ? 'is-active' : ''}`} title="Your saved filter">
        <Icon name="push_pin" size={11} fill /> High-score remote <span className="count">11</span>
      </button>
      <button className={`preset ${active === 'closed' ? 'is-active' : ''}`} onClick={() => onPreset && onPreset('closed')}>
        Closed <span className="count">4</span>
      </button>
      <button className="preset-add" title="Save current filters as a preset">
        <Icon name="add" size={12} /> Save filter
      </button>

      <div className="lbar-spacer" />

      <button className="fbtn"><Icon name="filter_list" size={13} /> Filters</button>
      <button className="fbtn" title="Group by">
        <Icon name="splitscreen" size={13} /> {groupBy ? 'Stage' : 'Flat'}
      </button>
      <button className="fbtn" title="Columns">
        <Icon name="view_column" size={13} />
      </button>
      <button className="fbtn" title="Density">
        <Icon name={density === 'compact' ? 'density_small' : density === 'relaxed' ? 'density_large' : 'density_medium'} size={13} />
      </button>
      <button className="btn btn-primary btn-sm">
        <Icon name="add" size={14} /> Add job
      </button>
    </div>
  );
}

// ─── ViewSwitch — Kanban / List (sits in the topbar area) ──────
function ViewSwitch({ value = 'list' }) {
  return (
    <div className="view-switch">
      <button className={value === 'kanban' ? 'is-active' : ''}>
        <Icon name="view_kanban" size={13} fill={value === 'kanban'} /> Kanban
      </button>
      <button className={value === 'list' ? 'is-active' : ''}>
        <Icon name="view_list" size={13} fill={value === 'list'} /> List
      </button>
    </div>
  );
}

// ─── Reusable table header given a column list ─────────────────
function ListHead({ cols, sortBy = 'score', sortDir = 'desc', selectAll = false, indeterminate = false, onSelectAll }) {
  return (
    <div className="lthead" style={{ gridTemplateColumns: cols.map(c => `${c.width}px`).join(' ') }}>
      {cols.map((c, i) => {
        const sorted = c.id === sortBy;
        if (c.id === 'check') {
          return (
            <div key={c.id} className="lth lcheck" style={{ cursor: 'default' }}>
              <ListCheckbox checked={selectAll} indeterminate={indeterminate} onChange={onSelectAll} ariaLabel="Select all" />
            </div>
          );
        }
        return (
          <div key={c.id}
            className={`lth ${sorted ? 'is-sorted' : ''} ${c.align === 'right' ? 'is-right' : ''}`}
            style={{ justifyContent: c.align === 'right' ? 'flex-end' : 'flex-start' }}
          >
            <span>{c.label}</span>
            <span className="sort-arrow">
              <Icon name={sorted && sortDir === 'asc' ? 'arrow_upward' : 'arrow_downward'} size={12} />
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ─── A standard one-line row given a column list ───────────────
function ListRow({ app, cols, density = 'comfy', selected, focused, hovered, expanded, closed, onClick, onCheck, twoLine = false }) {
  const isClosed = ['rejected', 'declined', 'withdrawn'].includes(app.stage);
  return (
    <div
      className={`lrow d-${density}
        ${selected ? 'is-selected' : ''} ${focused ? 'is-focused' : ''} ${hovered ? 'is-hovered' : ''}
        ${expanded ? 'is-expanded' : ''} ${closed ?? isClosed ? 'is-closed' : ''}`}
      style={{ gridTemplateColumns: cols.map(c => `${c.width}px`).join(' ') }}
      onClick={onClick}
    >
      {cols.map(col => (
        <div key={col.id} className={`lcell ${col.align === 'right' ? 'is-right' : ''}`}>
          <RowCell col={col} app={app} density={density} twoLine={twoLine} onCheck={onCheck} selected={selected} />
        </div>
      ))}
    </div>
  );
}

function RowCell({ col, app, density, twoLine, onCheck, selected }) {
  switch (col.id) {
    case 'check':
      return <ListCheckbox checked={selected} onChange={onCheck} ariaLabel={`Select ${app.co}`} />;
    case 'company':
      return (
        <div className="lco">
          <div className="lco-logo">{app.init}</div>
          <div className="lco-text">
            <span className="lco-name">{app.co}</span>
            {twoLine && <span className="lco-role">{app.role}</span>}
          </div>
        </div>
      );
    case 'role':
      return <span className="lrole">{app.role}</span>;
    case 'stage':
      return <StageCell stage={app.stage} sub={app.sub} compact={density === 'compact'} />;
    case 'score':
      return <ScoreCell score={app.score} />;
    case 'salary':
      return <SalaryCell value={app.salary} />;
    case 'stars':
      return <StarsInline value={app.stars} />;
    case 'docs':
      return density === 'compact' ? <DocsCondensed docs={app.docs} /> : <DocsTextForward docs={app.docs} />;
    case 'loc':
      return <span className="lmeta" style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{app.loc}</span>;
    case 'posted':
      return <span className="lmeta">{app.posted}</span>;
    case 'hint':
      return (
        <>
          <HintCell app={app} />
          <span style={{ marginLeft: 'auto' }} />
          <QuickActions />
        </>
      );
    default:
      return null;
  }
}

function SalaryCell({ value }) {
  if (!value || value === '—' || value === 'Not Listed') {
    return <span className="salary-chip is-unlisted">—</span>;
  }
  return (
    <span className="salary-chip" style={{ fontSize: 11, padding: '2px 8px' }}>
      <Icon name="payments" size={11} fill /> {value.replace('–', '–').replace('Not Listed', '—')}
    </span>
  );
}

// ─── Visible column filtering helper ────────────────────────────
window.L_FILTER_COLS = (visibleIds) => window.L_COLUMNS.filter(c => visibleIds.includes(c.id));

// ─── Export to window ───────────────────────────────────────────
Object.assign(window, {
  ListCheckbox, ScoreCell, ScoreMini, StageCell, PipelineStrip,
  DocsCondensed, DocsTextForward, StarsInline, HintCell, QuickActions,
  ListToolbar, ViewSwitch, ListHead, ListRow, RowCell, SalaryCell,
});
