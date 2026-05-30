/* global React, AppShell, Icon, ListToolbar, ListHead, ListRow, ListCheckbox,
   ScoreMini, PipelineStrip, StarsInline, HintCell, DocsTextForward,
   SalaryCell, QuickActions, ClassicTopbarOverlay */

// ─── Variation 3 — Pulse ─────────────────────────────────────────
// Three departures from the classic table, all re-using the Job
// Details visual DNA:
//
//   1. The Stage cell becomes a full horizontal mini-pipeline
//      strip — at-a-glance journey for every row, not a chip.
//   2. Rows default to a FLAT sort but the user can opt into
//      grouping by any of: urgency, stage, interest, location,
//      next-action, source.
//   3. Clicking a row expands inline to a compressed Job Details
//      preview — header card equivalent, no navigation needed.
//
// Same column model underneath; this is a re-imagined surface, not
// a different data layer.

// Group-by modes — labels used in the toolbar + popover.
window.PULSE_GROUPINGS = [
  { id: 'flat',       label: 'No grouping',       icon: 'horizontal_rule' },
  { id: 'urgency',    label: 'Urgency · today / week / closed', icon: 'bolt' },
  { id: 'stage',      label: 'Stage',             icon: 'route' },
  { id: 'interest',   label: 'Interest',          icon: 'star' },
  { id: 'location',   label: 'Location',          icon: 'location_on' },
  { id: 'nextaction', label: 'Next action',       icon: 'task_alt' },
  { id: 'source',     label: 'Source',            icon: 'public' },
];

// Hand-bucketed urgency assignments (real impl would compute from due dates).
const URGENCY = {
  overdue:  new Set(['a14']),
  today:    new Set(['a04', 'a05', 'a11', 'a19']),
  week:     new Set(['a06', 'a07', 'a09', 'a10', 'a12', 'a20', 'a22']),
  awaiting: new Set(['a08', 'a13', 'a15', 'a16', 'a17', 'a18', 'a21', 'a23',
                     'a01', 'a02', 'a03', 'a24']),
  closed:   new Set(['a25', 'a26', 'a27', 'a28']),
};
const URGENCY_RANK = { overdue: 0, today: 1, week: 2, awaiting: 3, closed: 4 };
function urgencyOf(id) {
  for (const k of Object.keys(URGENCY)) if (URGENCY[k].has(id)) return k;
  return 'awaiting';
}

// Location keyword extraction — collapses similar strings.
function locationKey(loc) {
  const s = loc.toLowerCase();
  if (s.includes('remote')) return 'Remote';
  if (s.includes('sf') || s.includes('san francisco') || s.includes('menlo') || s.includes('mountain')) return 'Bay Area';
  if (s.includes('nyc') || s.includes('new york')) return 'New York';
  if (s.includes('stockholm') || s.includes('eu')) return 'Europe';
  return 'Other';
}

// Next-action keyword extraction.
function hintKey(hint) {
  const h = hint.toLowerCase();
  if (h.startsWith('run analysis')) return 'Analyze posting';
  if (h.includes('research'))       return 'Research company';
  if (h.includes('tailor'))         return 'Tailor resume';
  if (h.includes('cover'))          return 'Write cover letter';
  if (h.includes('generate'))       return 'Generate materials';
  if (h.includes('ready to'))       return 'Ready to submit';
  if (h.includes('submit'))         return 'Submit application';
  if (h.includes('follow'))         return 'Follow up';
  if (h.includes('recruiter'))      return 'Recruiter contact';
  if (h.includes('tech') || h.includes('onsite') || h.includes('screen') || h.includes('prep'))
                                    return 'Interview prep';
  if (h.includes('negotiat') || h.includes('offer') || h.includes('verbal'))
                                    return 'Decision';
  if (h.includes('onboarding') || h.includes('start')) return 'Onboarding';
  if (h.includes('decide'))         return 'Decide priority';
  if (h.includes('confirmed') || h.includes('response'))
                                    return 'Awaiting reply';
  return 'Other';
}

// Group + sort the full app list into [{id, label, sub?, kind?, apps[]}, ...]
// — order is meaningful (urgency rank, stage order, star desc, etc.).
function groupApps(apps, groupBy, showClosed) {
  if (!showClosed) apps = apps.filter(a => urgencyOf(a.id) !== 'closed');

  if (groupBy === 'flat') {
    const sorted = [...apps].sort((a, b) => {
      const ra = URGENCY_RANK[urgencyOf(a.id)], rb = URGENCY_RANK[urgencyOf(b.id)];
      if (ra !== rb) return ra - rb;
      return b.score - a.score;
    });
    return [{ id: '_flat', kind: null, apps: sorted }];
  }

  const buckets = new Map();
  const add = (key, app) => {
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(app);
  };

  if (groupBy === 'urgency') {
    for (const a of apps) add(urgencyOf(a.id), a);
    const out = [];
    const META = {
      overdue:  { label: 'Overdue',           kind: 'overdue', sub: 'Follow-ups past due' },
      today:    { label: 'Today',             kind: 'now',     sub: 'Apps waiting on your move' },
      week:     { label: 'This week',         kind: 'week',    sub: null },
      awaiting: { label: 'Awaiting response', kind: 'awaiting', sub: 'Their move — no action from you' },
      closed:   { label: 'Closed',            kind: 'closed',  sub: 'Rejected · declined · withdrawn' },
    };
    for (const k of ['overdue', 'today', 'week', 'awaiting', 'closed']) {
      if (buckets.has(k)) out.push({ id: k, ...META[k], apps: buckets.get(k) });
    }
    return out;
  }

  if (groupBy === 'stage') {
    for (const a of apps) add(a.stage, a);
    const out = [];
    for (const s of [...window.K_STAGES, ...window.K_END_STAGES]) {
      if (buckets.has(s.id)) {
        const isEnd = ['rejected', 'declined', 'withdrawn'].includes(s.id);
        out.push({
          id: s.id, label: s.label, kind: isEnd ? 'closed' : 'week',
          sub: null, icon: s.icon, apps: buckets.get(s.id),
        });
      }
    }
    return out;
  }

  if (groupBy === 'interest') {
    for (const a of apps) add(a.stars, a);
    const out = [];
    for (const n of [3, 2, 1, 0]) {
      if (buckets.has(n)) {
        out.push({
          id: `i${n}`,
          label: n === 0 ? 'No interest set' : `${'★'.repeat(n)}${'☆'.repeat(3 - n)} · ${n} star${n === 1 ? '' : 's'}`,
          kind: n >= 2 ? 'now' : null,
          sub: null, apps: buckets.get(n),
        });
      }
    }
    return out;
  }

  if (groupBy === 'location') {
    for (const a of apps) add(locationKey(a.loc), a);
    const ORDER = ['Remote', 'Bay Area', 'New York', 'Europe', 'Other'];
    return ORDER.filter(k => buckets.has(k)).map(k => ({
      id: `l-${k}`, label: k, kind: null, sub: null, apps: buckets.get(k),
    }));
  }

  if (groupBy === 'nextaction') {
    for (const a of apps) add(hintKey(a.hint), a);
    const ORDER = ['Follow up', 'Decide priority', 'Tailor resume', 'Generate materials',
                   'Submit application', 'Interview prep', 'Decision', 'Onboarding',
                   'Analyze posting', 'Research company', 'Awaiting reply', 'Other'];
    return ORDER.filter(k => buckets.has(k)).map(k => ({
      id: `h-${k}`, label: k, kind: null, sub: null, apps: buckets.get(k),
    }));
  }

  if (groupBy === 'source') {
    for (const a of apps) add(a.source, a);
    return [...buckets.keys()].sort().map(k => ({
      id: `s-${k}`, label: k, kind: null, sub: null, apps: buckets.get(k),
    }));
  }

  return [{ id: '_flat', kind: null, apps }];
}

// ─── Main component ─────────────────────────────────────────────
function ListPulse({
  density = 'comfy',
  theme = 'light',
  expandedId = 'a04',
  showClosed = true,
  groupBy = 'flat',
  showGroupMenu = false,
}) {
  const cols = [
    { id: 'check',    width: 36,  align: 'center', locked: true },
    { id: 'company',  width: 260, align: 'left' },
    { id: 'pipeline', width: 240, align: 'left' },
    { id: 'score',    width: 80,  align: 'left' },
    { id: 'salary',   width: 130, align: 'left' },
    { id: 'stars',    width: 70,  align: 'left' },
    { id: 'docs',     width: 110, align: 'left' },
    { id: 'hint',     width: 260, align: 'left' },
  ];

  const byId = Object.fromEntries(window.K_APPS.map(a => [a.id, a]));
  const expand = byId[expandedId];
  const groups = groupApps(window.K_APPS, groupBy, showClosed);

  return (
    <AppShell theme={theme} breadcrumb={["Dashboard", "Pulse"]}>
      <ClassicTopbarOverlay />
      <div className="list-shell">
        <PulseToolbar density={density} groupBy={groupBy} showMenu={showGroupMenu} />

        <div className="lt">
          <PulseHead cols={cols} groupBy={groupBy} />

          {groups.map((g, gi) => (
            <React.Fragment key={g.id}>
              {g.kind !== null && (
                <DayBand kind={g.kind || 'week'} label={g.label} count={g.apps.length} sub={g.sub} icon={g.icon} />
              )}
              {/* When groupBy='flat', no band; when 'stage' we still show the band even though kind defaults */}
              {groupBy !== 'flat' && g.kind === null && (
                <DayBand kind="week" label={g.label} count={g.apps.length} sub={null} icon={g.icon} />
              )}
              {g.apps.map(app => (
                <PulseRow key={app.id} app={app} cols={cols} density={density}
                  expanded={app.id === expandedId} expandPanel={app.id === expandedId && expand}
                  urgency={urgencyOf(app.id)}
                />
              ))}
            </React.Fragment>
          ))}
        </div>
      </div>
    </AppShell>
  );
}

// Custom toolbar that surfaces the Group-by selector prominently, with the
// active grouping shown. When `showMenu` is true the popover renders open so
// it's visible on the canvas.
function PulseToolbar({ density, groupBy, showMenu }) {
  const active = window.PULSE_GROUPINGS.find(g => g.id === groupBy) || window.PULSE_GROUPINGS[0];
  return (
    <div className="lbar" style={{ position: 'relative' }}>
      <div className="lbar-search">
        <Icon name="search" size={14} />
        <input placeholder="Search companies, roles, notes…" />
        <span className="lbar-kbd">/</span>
      </div>

      <div className="lbar-divider" />

      <button className="preset is-active">
        <Icon name="bolt" size={12} fill /> Needs my action <span className="count">8</span>
      </button>
      <button className="preset">Active <span className="count">22</span></button>
      <button className="preset">Awaiting response <span className="count">5</span></button>
      <button className="preset is-pinned" title="Your saved filter">
        <Icon name="push_pin" size={11} fill /> High-score remote <span className="count">11</span>
      </button>
      <button className="preset-add">
        <Icon name="add" size={12} /> Save filter
      </button>

      <div className="lbar-spacer" />

      <button className="fbtn"><Icon name="filter_list" size={13} /> Filters</button>

      <div style={{ position: 'relative' }}>
        <button className={`fbtn ${groupBy !== 'flat' ? 'has-value' : ''}`}>
          <Icon name="splitscreen" size={13} />
          <span>Group by:</span>
          <b style={{ fontWeight: 700 }}>{active.label.split(' · ')[0]}</b>
          <Icon name="expand_more" size={13} />
        </button>

        {showMenu && (
          <div className="popover" style={{ top: 'calc(100% + 6px)', right: 0, minWidth: 240, zIndex: 60 }}>
            <div className="popover-label">Group by</div>
            {window.PULSE_GROUPINGS.map(g => (
              <div key={g.id} className={`popover-item ${g.id === groupBy ? 'is-active' : ''}`}>
                <Icon name={g.icon} size={14} />
                <span style={{ flex: 1 }}>{g.label}</span>
                {g.id === groupBy && <Icon name="check" size={14} style={{ color: 'var(--primary)' }} />}
              </div>
            ))}
            <div className="popover-divider" />
            <div className="popover-item" style={{ fontSize: 11, color: 'var(--txt-mute)' }}>
              <Icon name="info" size={12} />
              <span style={{ flex: 1 }}>Saved per view, syncs across devices.</span>
            </div>
          </div>
        )}
      </div>

      <button className="fbtn" title="Columns"><Icon name="view_column" size={13} /></button>
      <button className="fbtn" title="Density">
        <Icon name={density === 'compact' ? 'density_small' : density === 'relaxed' ? 'density_large' : 'density_medium'} size={13} />
      </button>
      <button className="btn btn-primary btn-sm">
        <Icon name="add" size={14} /> Add job
      </button>
    </div>
  );
}

function PulseHead({ cols, groupBy }) {
  const labels = {
    check: '',
    company: 'Company · Role',
    pipeline: 'Journey',
    score: 'Score',
    salary: 'Salary',
    stars: 'Interest',
    docs: 'Docs',
    hint: 'Next action',
  };
  // Sort hint: when flat, sort is by urgency; otherwise by the active sort col.
  const sortedId = groupBy === 'flat' ? 'hint' : 'score';
  return (
    <div className="lthead" style={{ gridTemplateColumns: cols.map(c => `${c.width}px`).join(' ') }}>
      {cols.map(c => (
        c.id === 'check' ? (
          <div key={c.id} className="lth lcheck" style={{ cursor: 'default' }}>
            <ListCheckbox checked={false} ariaLabel="Select all" />
          </div>
        ) : (
          <div key={c.id} className={`lth ${c.id === sortedId ? 'is-sorted' : ''}`}>
            <span>{labels[c.id]}</span>
            {c.id === sortedId && <span className="sort-arrow">
              <Icon name={sortedId === 'hint' ? 'bolt' : 'arrow_downward'} size={12} />
            </span>}
          </div>
        )
      ))}
    </div>
  );
}

function DayBand({ kind, label, count, sub, icon }) {
  return (
    <div className={`pulse-day is-${kind}`}>
      {icon && <Icon name={icon} size={12} />}
      <span>{label}</span>
      <span className="pulse-day-count">{count}</span>
      {sub && (
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.04, textTransform: 'none', opacity: 0.85, marginLeft: 4 }}>
          · {sub}
        </span>
      )}
    </div>
  );
}

function PulseRow({ app, cols, density, expanded, expandPanel, urgency }) {
  const isClosed = ['rejected', 'declined', 'withdrawn'].includes(app.stage);
  return (
    <>
      <div className={`lrow d-${density} ${expanded ? 'is-expanded' : ''} ${isClosed ? 'is-closed' : ''}`}
        style={{ gridTemplateColumns: cols.map(c => `${c.width}px`).join(' ') }}
      >
        {cols.map(col => (
          <div key={col.id} className="lcell">
            {col.id === 'check' && <ListCheckbox ariaLabel="Select" />}
            {col.id === 'company' && (
              <div className="lco">
                <div className="lco-logo">{app.init}</div>
                <div className="lco-text">
                  <span className="lco-name">{app.co}</span>
                  <span className="lco-role">{app.role}</span>
                </div>
              </div>
            )}
            {col.id === 'pipeline' && <PipelineStrip stage={app.stage} sub={app.sub} />}
            {col.id === 'score' && (
              <div className="row gap-2">
                <ScoreMini score={app.score} />
                <span className="lmeta" style={{ fontSize: 11 }}>
                  vs avg {app.score >= 83 ? `+${app.score - 83}` : app.score - 83}
                </span>
              </div>
            )}
            {col.id === 'salary' && <SalaryCell value={app.salary} />}
            {col.id === 'stars' && <StarsInline value={app.stars} />}
            {col.id === 'docs' && <DocsTextForward docs={app.docs} />}
            {col.id === 'hint' && (
              <>
                <HintCell app={app} urgent={urgency === 'overdue' || urgency === 'today'} />
                <span style={{ marginLeft: 'auto' }} />
                <span className="row gap-1" style={{ marginRight: 4, alignItems: 'center' }}>
                  <Icon name={expanded ? 'expand_less' : 'expand_more'} size={16} style={{ color: 'var(--txt-dim)' }} />
                </span>
                <QuickActions />
              </>
            )}
          </div>
        ))}
      </div>

      {expanded && expandPanel && <PulseExpand app={expandPanel} />}
    </>
  );
}

// Compressed Job Details preview — header card equivalent inline.
function PulseExpand({ app }) {
  return (
    <div className="lexpand">
      <div className="lex-card">
        <div className="lex-label">Compatibility</div>
        <div className="row gap-3" style={{ alignItems: 'center' }}>
          <ScoreMini score={app.score} size={48} />
          <div className="col" style={{ gap: 2 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--txt)' }}>Excellent match</div>
            <span className="chip chip-green" style={{ width: 'fit-content', fontSize: 10 }}>
              <Icon name="arrow_upward" size={10} /> {app.score - 83 > 0 ? `+${app.score - 83}` : app.score - 83} vs avg
            </span>
          </div>
        </div>
        <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 11, color: 'var(--txt-mute)' }}>
          <div><span style={{ color: 'var(--txt)' }}>Core role</span> · 17/20</div>
          <div><span style={{ color: 'var(--txt)' }}>Experience</span> · 19/20</div>
          <div><span style={{ color: 'var(--txt)' }}>Culture</span> · 18/20</div>
          <div><span style={{ color: 'var(--txt)' }}>ATS</span> · 16/20</div>
        </div>
      </div>

      <div className="lex-card">
        <div className="lex-label">Saved phase · 4 of 5</div>
        <div className="col gap-2" style={{ marginTop: 4 }}>
          {['Job analysis · parsed', 'Reviewed', 'Network contacts · 0', 'Company research'].map((s, i) => (
            <div key={i} className="row gap-2" style={{ fontSize: 12 }}>
              <Icon name="check_circle" size={13} fill style={{ color: 'var(--success)' }} />
              <span style={{ color: 'var(--txt-2)' }}>{s}</span>
            </div>
          ))}
          <div className="row gap-2" style={{ fontSize: 12 }}>
            <Icon name="flag" size={13} fill style={{ color: 'var(--primary)' }} />
            <span style={{ color: 'var(--primary)', fontWeight: 700 }}>Prioritize — your turn</span>
          </div>
        </div>
      </div>

      <div className="next-action" style={{ margin: 0 }}>
        <div className="head"><Icon name="bolt" size={12} fill /> Next action</div>
        <h4 style={{ fontSize: 14 }}>Decide to move this to Generated</h4>
        <p style={{ fontSize: 12 }}>All Saved-phase research is complete. Start generating a tailored resume + cover letter.</p>
        <div className="row gap-2" style={{ marginTop: 4 }}>
          <button className="btn btn-primary btn-sm">
            <Icon name="auto_awesome" size={13} fill /> Generate
          </button>
          <button className="btn btn-sm">Skip & apply</button>
          <button className="btn btn-ghost btn-sm" style={{ marginLeft: 'auto' }}>
            <Icon name="open_in_new" size={13} /> Open
          </button>
        </div>
      </div>
    </div>
  );
}

window.ListPulse = ListPulse;
