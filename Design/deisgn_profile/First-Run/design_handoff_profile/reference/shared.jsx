/* global React */

// ─── Mock job data shared across variations ─────────────────────
window.JOB = {
  title: "Senior Lead Software Architect",
  company: "PRI Technology",
  companyInitials: "PRI",
  logo: null, // placeholder
  location: "United States",
  workModel: "Remote",
  jobType: "Full-time",
  salary: "Not Listed",
  deadline: "—",
  posted: "2026-05-16",
  captured: "2026-05-20",
  commute: "Remote (No Commute)",
  relocation: "Not Required",
  jobLink: "Visit Listing",
  applyLink: "Direct Apply",
  interest: 0,
  score: 86,
  scoreVsAvg: 3,
  status: "Saved",   // current top-level stage
  currentStageIdx: 0, // index into STAGES
};

window.STAGES = [
  { id: "saved", label: "Saved", icon: "bookmark", subCount: 5, subDone: 4 },
  { id: "generated", label: "Generated", icon: "auto_awesome", subCount: 4, subDone: 0 },
  { id: "applied", label: "Applied", icon: "send", subCount: 4, subDone: 0 },
  { id: "interviewing", label: "Interviewing", icon: "forum", subCount: 5, subDone: 0 },
  { id: "decision", label: "Decision", icon: "gavel", subCount: 5, subDone: 0 },
  { id: "accepted", label: "Accepted", icon: "verified", subCount: 5, subDone: 0 },
];

// Branch stages — collapsed into a small pill, not the main flow
window.BRANCH_STAGES = [
  { id: "rejected", label: "Rejected", icon: "block" },
  { id: "declined", label: "Declined", icon: "do_not_disturb_on" },
  { id: "withdrawn", label: "Withdrawn", icon: "cancel" },
];

window.SAVED_SUBSTAGES = [
  { id: "analysis", label: "Job Analysis (parsed)", icon: "analytics", done: true,
    summary: "Structured data extracted from posting.", count: 0 },
  { id: "reviewed", label: "Reviewed", icon: "fact_check", done: true,
    summary: "Read job description, flagged 3 key requirements.", count: 0 },
  { id: "network",  label: "Network Contacts", icon: "group", done: true,
    summary: "0 known contacts at company.", count: 0 },
  { id: "research", label: "Company Research", icon: "domain", done: true,
    summary: "Overview, financials, competitor matrix complete.", count: 0 },
  { id: "prioritize", label: "Prioritize", icon: "flag", done: false, current: true,
    summary: "Decide whether to move this to Generated.", count: 0 },
];

// Real content shown in the workspace based on the active sub-stage,
// modelled on what the live app actually surfaces.
window.SUBSTAGE_CONTENT = {
  analysis: {
    title: 'Job Analysis (parsed)',
    subtitle: 'Structured data extracted from the job posting',
    actions: [{ label: 'Refresh Analysis', icon: 'refresh' }],
  },
  reviewed: {
    title: 'Reviewed',
    subtitle: 'Key requirements you flagged from the posting',
    actions: [{ label: 'Edit notes', icon: 'edit' }],
  },
  network: {
    title: 'Network Contacts',
    subtitle: 'People you know at PRI Technology',
    actions: [{ label: 'Find contacts', icon: 'search' }],
  },
  research: {
    title: 'Company Research',
    subtitle: 'Overview, financials, competitor matrix, career matches',
    actions: [{ label: 'Refresh research', icon: 'refresh' }],
  },
  prioritize: {
    title: 'Prioritize',
    subtitle: 'Decide whether to move this opportunity into Generated',
    actions: [{ label: 'Refresh', icon: 'refresh' }],
  },
};

window.NEXT_ACTION = {
  priority: "info",
  title: "Decide to move this to Generated",
  body: "All Saved-phase research is complete (4 of 5). The next move is to commit the application — start generating a tailored resume + cover letter.",
  primaryCta: "Generate Application",
  secondaryCta: "Skip & Apply Directly",
};

// ─── Tiny shared components ─────────────────────────────────────
function Icon({ name, size = 16, fill = false, className = "", style = {} }) {
  return (
    <span
      className={`icon icon-${size} ${fill ? 'fill' : ''} ${className}`}
      style={{ fontSize: `${size}px`, ...style }}
    >{name}</span>
  );
}

function ScoreRing({ score = 86, size = 56, vsAvg = 3 }) {
  const r = (size - 8) / 2;
  const c = 2 * Math.PI * r;
  const pct = score / 100;
  const color = score >= 80 ? '#059669' : score >= 60 ? '#d97706' : '#dc2626';
  return (
    <div className="score-ring" style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size/2} cy={size/2} r={r}
          fill="none" stroke="#e2e8f0" strokeWidth="4" />
        <circle cx={size/2} cy={size/2} r={r}
          fill="none" stroke={color} strokeWidth="4"
          strokeDasharray={c} strokeDashoffset={c * (1 - pct)}
          strokeLinecap="round" />
      </svg>
      <div className="score-num" style={{ fontSize: size > 60 ? 22 : 16, color }}>{score}</div>
    </div>
  );
}

function CompanyLogo({ size = 48, initials = "PRI" }) {
  return (
    <div className="brandbox" style={{ width: size, height: size, fontSize: size * 0.28 }}>
      {initials}
    </div>
  );
}

function StatusPill({ status }) {
  const c = {
    Saved: 'chip-blue', Generated: 'chip-blue', Applied: 'chip-blue',
    Interviewing: 'chip-amber', Decision: 'chip-amber',
    Accepted: 'chip-green', Offered: 'chip-green',
    Rejected: 'chip-red', Declined: 'chip-red', Withdrawn: 'chip-red',
  }[status] || 'chip-blue';
  return (
    <span className={`chip chip-status ${c}`}>
      <span className="dot is-pulse" />
      {status}
    </span>
  );
}

// Interest / priority — 3 stars, click any to set
function InterestStars({ value = 2, onChange, size = 14, label = false }) {
  const [hover, setHover] = React.useState(0);
  const v = hover || value;
  return (
    <div className="interest-stars" role="radiogroup" aria-label="Interest level">
      {[1, 2, 3].map(n => (
        <button key={n}
          onMouseEnter={() => setHover(n)}
          onMouseLeave={() => setHover(0)}
          onClick={() => onChange && onChange(n === value ? 0 : n)}
          className={`star ${n <= v ? 'is-on' : ''}`}>
          <Icon name="star" size={size} fill={n <= v} />
        </button>
      ))}
      {label && <span className="label" style={{ marginLeft: 4 }}>Interest</span>}
    </div>
  );
}

// Horizontal compact pipeline with collapsed branch indicator
function PipelineHoriz({ currentIdx = 0, showLabels = true, compact = false }) {
  return (
    <div className="row gap-3" style={{ width: '100%' }}>
      <div className="pipeline flex-1">
        {window.STAGES.map((s, i) => {
          const passed = i < currentIdx;
          const current = i === currentIdx;
          const cls = passed ? 'is-passed' : current ? 'is-current' : '';
          return (
            <div key={s.id} className={`pl-step ${cls}`}>
              <div className="pl-node" />
              {showLabels && (
                <div className="pl-text">
                  <div className="name">{s.label}</div>
                  {!compact && (
                    <div className="sub">{s.subDone}/{s.subCount}</div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="pl-branch" title="Branch stages">
        <Icon name="alt_route" size={12} />
        +3
      </div>
    </div>
  );
}

// Stage tabs (pills)
function StageTabs({ activeIdx = 0, onChange }) {
  return (
    <div className="tabs" style={{ flexWrap: 'wrap' }}>
      {window.STAGES.map((s, i) => {
        const isActive = i === activeIdx;
        const isDone = s.subDone === s.subCount && s.subCount > 0;
        return (
          <button key={s.id} className={`tab ${isActive ? 'is-active' : ''}`}
            onClick={() => onChange && onChange(i)}>
            {s.label}
            {isDone ? (
              <span className="pip"><Icon name="check" size={10} /></span>
            ) : s.subCount > 0 ? (
              <span className="pip" style={{ background: 'transparent', border: '1px solid var(--line-strong)', color: 'var(--txt-dim)' }}>
                {s.subDone}/{s.subCount}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

// Sub-stage card
function SubstageCard({ sub, compact = false }) {
  const state = sub.current ? 'is-current' : sub.done ? 'is-done' : 'is-pending';
  return (
    <div className={`substage ${state}`}>
      <div className="substage-node">
        <Icon name={sub.done ? 'check' : sub.icon} size={14} fill={sub.current} />
      </div>
      <div className="flex-1">
        <div className="row" style={{ justifyContent: 'space-between', marginBottom: 2 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: sub.done ? 'var(--txt-mute)' : 'var(--txt)' }}>
            {sub.label}
          </div>
          <span className="label" style={{ color: sub.current ? 'var(--primary)' : sub.done ? 'var(--success)' : 'var(--txt-dim)' }}>
            {sub.current ? 'Action needed' : sub.done ? 'Complete' : 'Pending'}
          </span>
        </div>
        {!compact && (
          <div style={{ fontSize: 12, color: 'var(--txt-mute)', lineHeight: 1.4 }}>
            {sub.summary}
          </div>
        )}
      </div>
    </div>
  );
}

// Document status — 3 logical states:
//   ok        → present and tailored / ready
//   attention → present but needs work (e.g. resume is still Base, not tailored for this job)
//   missing   → not yet added
window.DOCS = [
  { id: 'resume', name: 'Resume',       icon: 'description', state: 'attention',
    detail: 'Base only — not tailored for PRI', cta: 'Tailor now' },
  { id: 'cover',  name: 'Cover letter', icon: 'mail',        state: 'missing',
    detail: 'No cover letter yet', cta: 'Add' },
  { id: 'ctx',    name: 'Context',      icon: 'folder',      state: 'ok',
    detail: '0 additional docs (optional)', cta: 'Add' },
];

const DOC_STATE = {
  ok:        { color: 'var(--success)', soft: 'var(--success-soft)', icon: 'check_circle', word: 'OK',    chip: 'chip-green' },
  attention: { color: 'var(--warn)',    soft: 'var(--warn-soft)',    icon: 'priority_high', word: 'Tailor', chip: 'chip-amber' },
  missing:   { color: 'var(--danger)',  soft: 'var(--danger-soft)',  icon: 'add',           word: 'Missing', chip: 'chip-red' },
};

// Compact inline doc cluster — fits in the header.
// `variant`:
//   "chips"  → row of pill chips with name + status word
//   "dots"   → just icons + status dot (tightest)
//   "rows"   → full vertical list (used when expanded in right rail)
function DocsCluster({ variant = 'chips' }) {
  if (variant === 'dots') {
    return (
      <div className="docs-dots">
        {window.DOCS.map(d => {
          const s = DOC_STATE[d.state];
          return (
            <div key={d.id} className={`docs-dot is-${d.state}`} title={`${d.name} — ${d.detail}`}>
              <Icon name={d.icon} size={14} />
              <span className="docs-dot-bubble" style={{ background: s.color }}>
                <Icon name={s.icon} size={9} fill />
              </span>
            </div>
          );
        })}
      </div>
    );
  }

  if (variant === 'rows') {
    return (
      <div className="col gap-2">
        {window.DOCS.map(d => {
          const s = DOC_STATE[d.state];
          return (
            <div key={d.id} className={`docs-row is-${d.state}`}>
              <div className="docs-row-icon" style={{ color: s.color, background: s.soft }}>
                <Icon name={d.icon} size={14} />
              </div>
              <div className="flex-1" style={{ minWidth: 0 }}>
                <div className="docs-row-name">{d.name}</div>
                <div className="docs-row-detail">{d.detail}</div>
              </div>
              <button className={`btn btn-sm ${d.state === 'ok' ? '' : 'btn-primary'}`} style={{ padding: '4px 10px' }}>
                {d.state === 'ok' ? 'View' : d.cta}
              </button>
            </div>
          );
        })}
      </div>
    );
  }

  // chips (default)
  return (
    <div className="docs-chips">
      {window.DOCS.map(d => {
        const s = DOC_STATE[d.state];
        return (
          <button key={d.id} className={`docs-chip is-${d.state}`} title={d.detail}>
            <Icon name={d.icon} size={13} />
            <span className="docs-chip-name">{d.name}</span>
            <span className="docs-chip-status" style={{ color: s.color, background: s.soft }}>
              <Icon name={s.icon} size={10} fill />
              {s.word}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// Legacy alias — keeps any older references working
function DocsRow(props) { return <DocsCluster variant="rows" {...props} />; }

// Next action callout
function NextAction({ compact = false }) {
  const a = window.NEXT_ACTION;
  return (
    <div className="next-action">
      <div className="head">
        <Icon name="bolt" size={12} fill />
        Next action
      </div>
      <h4>{a.title}</h4>
      {!compact && <p>{a.body}</p>}
      <div className="row gap-2" style={{ marginTop: 4 }}>
        <button className="btn btn-primary btn-sm">
          <Icon name="auto_awesome" size={14} fill /> {a.primaryCta}
        </button>
        <button className="btn btn-sm">{a.secondaryCta}</button>
      </div>
    </div>
  );
}

// Tiny meta-pill row (header inline)
function MetaInline({ items, compact = false }) {
  return (
    <div className="meta-row" style={{ fontSize: compact ? 12 : 13 }}>
      {items.map((m, i) => (
        <React.Fragment key={i}>
          {i > 0 && <span style={{ color: 'var(--txt-faint)' }}>·</span>}
          <div className="meta-item">
            {m.icon && <Icon name={m.icon} size={14} />}
            {m.link ? <span className="meta-link">{m.label}</span> : <span>{m.label}</span>}
          </div>
        </React.Fragment>
      ))}
    </div>
  );
}

// ─── Sub-stage workspace content ───────────────────────────────
// Renders the right-side content for whichever sub-stage is active.
// Content is modelled on what the live app actually surfaces.

function SubStageContent({ activeSubId, compact = false }) {
  const meta = window.SUBSTAGE_CONTENT[activeSubId] || {};

  return (
    <div className="card card-pad">
      {/* Title + actions */}
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 14, alignItems: 'flex-start' }}>
        <div className="col gap-1">
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: 'var(--txt)' }}>{meta.title}</h3>
          <div style={{ fontSize: 12, color: 'var(--txt-mute)' }}>{meta.subtitle}</div>
        </div>
        <div className="row gap-2">
          {(meta.actions || []).map((a, i) => (
            <button key={i} className="btn btn-sm">
              <Icon name={a.icon} size={14} /> {a.label}
            </button>
          ))}
        </div>
      </div>

      {activeSubId === 'analysis'   && <AnalysisContent compact={compact} />}
      {activeSubId === 'reviewed'   && <ReviewedContent />}
      {activeSubId === 'network'    && <NetworkContent />}
      {activeSubId === 'research'   && <ResearchContent />}
      {activeSubId === 'prioritize' && <PrioritizeContent />}
    </div>
  );
}

function AnalysisContent({ compact = false }) {
  const dims = [
    { name: 'Core Role',    score: 17 },
    { name: 'Experience',   score: 19 },
    { name: 'Education',    score: 16 },
    { name: 'Culture',      score: 18 },
    { name: 'ATS Keywords', score: 16 },
  ];

  return (
    <>
      {/* Compatibility Score panel */}
      <div className="compat-panel" style={{ marginBottom: 14 }}>
        <div className="row" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
          <div className="row gap-2">
            <Icon name="analytics" size={16} style={{ color: 'var(--primary)' }} />
            <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--primary)' }}>Compatibility Score</span>
          </div>
        </div>

        <div className="row gap-4" style={{ marginBottom: 14, alignItems: 'center' }}>
          <ScoreRing score={86} size={72} />
          <div className="col gap-1" style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--txt)' }}>Excellent match for your profile!</div>
            <span className="chip chip-green" style={{ width: 'fit-content' }}>
              <Icon name="arrow_upward" size={11} /> 3 pts above your avg (83)
            </span>
          </div>
        </div>

        <div className="col gap-2">
          {dims.map(d => (
            <div key={d.name} className="row gap-3" style={{ alignItems: 'center' }}>
              <div style={{ flex: 1, fontSize: 13, color: 'var(--txt-2)', fontWeight: 600 }}>{d.name}</div>
              <div style={{ flex: 2, height: 6, background: 'var(--bg)', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ width: `${(d.score / 20) * 100}%`, height: '100%',
                  background: d.score >= 18 ? 'var(--success)' : d.score >= 16 ? 'var(--primary)' : 'var(--warn)',
                  borderRadius: 3 }} />
              </div>
              <div style={{ width: 50, textAlign: 'right', fontSize: 13, fontWeight: 700, color: 'var(--txt)' }}>
                {d.score}<span style={{ color: 'var(--txt-dim)', fontWeight: 600 }}>/20</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Job Summary — compact 2-col */}
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--txt)' }}>Job Summary</span>
        <button className="btn btn-ghost btn-sm"><Icon name="expand_more" size={14} /> Show all</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 4 }}>
        <SummaryField label="Location & Type" value="United States · Remote" />
        <SummaryField label="Job Type & Source" value="Full-time · LinkedIn" />
        <SummaryField label="Experience & Seniority" value="Senior · 10+ yrs" />
        <SummaryField label="Posted · Captured" value="2026-05-16 · 5/20" />
      </div>
    </>
  );
}

function SummaryField({ label, value }) {
  return (
    <div className="col" style={{ gap: 2 }}>
      <div className="label" style={{ fontSize: 9 }}>{label}</div>
      <div style={{ fontSize: 13, color: 'var(--txt)', fontWeight: 600 }}>{value}</div>
    </div>
  );
}

function ReviewedContent() {
  const flagged = [
    { tag: 'Must-have', text: 'Lead architecture migration from on-prem to SaaS at enterprise scale' },
    { tag: 'Must-have', text: 'Financial services experience preferred but not required' },
    { tag: 'Nice-to-have', text: 'Hands-on with AWS / Azure cloud-native patterns' },
  ];
  return (
    <div className="col gap-2">
      {flagged.map((f, i) => (
        <div key={i} className="row gap-3" style={{ padding: '10px 12px', background: 'var(--bg)', borderRadius: 8 }}>
          <span className={`chip ${f.tag === 'Must-have' ? 'chip-amber' : 'chip-blue'}`}>{f.tag}</span>
          <div style={{ fontSize: 13, color: 'var(--txt)' }}>{f.text}</div>
        </div>
      ))}
    </div>
  );
}

function NetworkContent() {
  return (
    <div className="col gap-2" style={{ alignItems: 'center', padding: '20px 0' }}>
      <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--bg)',
        display: 'grid', placeItems: 'center', color: 'var(--txt-dim)', marginBottom: 4 }}>
        <Icon name="group" size={24} />
      </div>
      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--txt)' }}>No known contacts yet</div>
      <div style={{ fontSize: 12, color: 'var(--txt-mute)', textAlign: 'center', maxWidth: 320 }}>
        We'll surface LinkedIn 1st/2nd-degree connections at PRI Technology when you connect your network.
      </div>
      <button className="btn btn-primary btn-sm" style={{ marginTop: 4 }}>
        <Icon name="link" size={14} /> Connect LinkedIn
      </button>
    </div>
  );
}

function ResearchContent() {
  const sections = [
    { name: 'Company Overview', meta: 'Updated 5/20', icon: 'domain', done: true },
    { name: 'Financials & Market', meta: '$2.4B revenue · IT staffing', icon: 'trending_up', done: true },
    { name: 'Competitor Matrix', meta: 'vs. TEKsystems, Insight, ASGN', icon: 'compare_arrows', done: true },
    { name: 'Career Matches', meta: '4 similar roles in past 6 mo', icon: 'work', done: true },
  ];
  return (
    <div className="col gap-2">
      {sections.map((s, i) => (
        <div key={i} className="row gap-3" style={{ padding: '10px 12px', background: 'var(--bg)', borderRadius: 8 }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: 'var(--primary-soft)',
            color: 'var(--primary)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
            <Icon name={s.icon} size={14} />
          </div>
          <div className="flex-1">
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--txt)' }}>{s.name}</div>
            <div style={{ fontSize: 11, color: 'var(--txt-mute)', marginTop: 1 }}>{s.meta}</div>
          </div>
          <Icon name="check_circle" size={16} fill style={{ color: 'var(--success)' }} />
        </div>
      ))}
    </div>
  );
}

function PrioritizeContent() {
  return (
    <div className="col gap-3">
      <div className="next-action" style={{ margin: 0 }}>
        <div className="head"><Icon name="bolt" size={12} fill /> Recommended next step</div>
        <h4>Move to Generated phase</h4>
        <p>Saved-phase research is complete. Generate a tailored resume + cover letter now.</p>
        <div className="row gap-2" style={{ marginTop: 4 }}>
          <button className="btn btn-primary btn-sm">
            <Icon name="auto_awesome" size={14} fill /> Move to Generated
          </button>
          <button className="btn btn-sm">Skip & apply directly</button>
        </div>
      </div>
      <div className="row gap-2" style={{ padding: '8px 10px', background: 'var(--bg)', borderRadius: 8 }}>
        <Icon name="trending_up" size={14} style={{ color: 'var(--success)' }} />
        <div style={{ fontSize: 12 }}>Match score <b>86</b> · 3 above your average</div>
      </div>
      <div className="row gap-2" style={{ padding: '8px 10px', background: 'var(--bg)', borderRadius: 8 }}>
        <Icon name="group" size={14} className="dim" />
        <div style={{ fontSize: 12 }}>0 known contacts at PRI Technology</div>
      </div>
      <div className="row gap-2" style={{ padding: '8px 10px', background: 'var(--bg)', borderRadius: 8 }}>
        <Icon name="event" size={14} className="dim" />
        <div style={{ fontSize: 12 }}>No deadline · captured 5 days ago</div>
      </div>
    </div>
  );
}

// Top app chrome (nav + topbar) wrapper
function AppShell({ children, theme = 'light', breadcrumb = ["Dashboard", "PRI Technology", "Senior Lead Software Architect"] }) {
  return (
    <div className="app" data-theme={theme}>
      <div className="nav">
        <div className="nav-logo">JK</div>
        <div className="nav-add"><Icon name="add" size={20} /></div>
        <div className="nav-item is-active"><Icon name="dashboard" size={20} fill /></div>
        <div className="nav-item"><Icon name="person" size={20} /></div>
        <div className="nav-item"><Icon name="analytics" size={20} /></div>
        <div className="nav-spacer" />
        <div className="nav-item"><Icon name="notifications" size={20} /></div>
        <div className="nav-item"><Icon name="settings" size={20} /></div>
        <div className="nav-avatar">A</div>
      </div>
      <div className="topbar">
        <div className="topbar-crumb">
          <Icon name="arrow_back" size={16} className="dim" />
          <a>Dashboard</a>
          <span className="sep">/</span>
          <span className="curr">{breadcrumb[breadcrumb.length - 1]}</span>
        </div>
        <div className="topbar-actions">
          <button className="btn btn-sm"><Icon name="edit" size={14} /> Edit Info</button>
          <button className="btn btn-sm"><Icon name="archive" size={14} /> Archive</button>
          <button className="btn btn-sm btn-danger"><Icon name="delete" size={14} /> Delete</button>
        </div>
      </div>
      <div className="stage">
        {children}
      </div>
    </div>
  );
}

// Fold marker shown across all variations at y=812 (where the original viewport
// fold would land relative to the artboard's chrome at ~860 tall)
function FoldMarker({ y }) {
  return (
    <>
      <div className="fold-line" style={{ top: y }} />
      <div className="fold-tag" style={{ top: y, right: 20 }}>Fold</div>
    </>
  );
}

Object.assign(window, {
  Icon, ScoreRing, CompanyLogo, StatusPill, InterestStars,
  PipelineHoriz, StageTabs, SubstageCard, DocsRow, DocsCluster, NextAction,
  MetaInline, AppShell, FoldMarker, SubStageContent,
});
