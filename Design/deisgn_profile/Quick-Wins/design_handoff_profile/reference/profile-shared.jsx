/* global React */
/* Profile redesign — shared primitives + mock user data */

// ─── Mock user ────────────────────────────────────────────────
window.PROFILE = {
  firstName: "Robert",
  lastName: "Dannenbring",
  displayName: "Robert Dannenbring",
  headline: "Senior Solutions Architect · AI & Data Engineering",
  email: "robert.dannenbring@gmail.com",
  phone: "917-693-8433",
  location: "Stamford, CT",
  remote: "Remote-first · open to hybrid",
  workAuth: "US Citizen",
  bio: "Strategic technology leader with 20+ years experience architecting enterprise-scale systems across aviation, healthcare, and transportation. Expert in LLM orchestration and high-frequency data systems.",
  links: {
    linkedin: "linkedin.com/in/rob-dannenbring",
    github:   "github.com/rdannenbring",
    portfolio:"robdannenbring.com",
  },
  avatar: null,
  initials: "RD",

  // Match-profile data
  targetRoles: ["Senior Solutions Architect", "Staff Engineer", "Engineering Manager", "Principal Engineer"],
  seniority: "Senior / Staff (10+ yrs)",
  yearsExp: 20,
  relocation: "Not available",
  remotePref: ["Remote", "Hybrid"],
  comp: { min: 160000, max: 250000, currency: "USD", equity: "Open", negotiable: true },

  // Skills with weights (1=nice-to-have, 2=strong, 3=expert/core)
  skills: [
    { name: "Solutions Architecture", w: 3 },
    { name: "LLM Orchestration", w: 3 },
    { name: "Azure", w: 3 },
    { name: "Python", w: 3 },
    { name: "C#/.NET", w: 2 },
    { name: "Kubernetes", w: 2 },
    { name: "Event-driven Design", w: 2 },
    { name: "Azure SQL", w: 2 },
    { name: "Microservices", w: 2 },
    { name: "Vector DBs", w: 2 },
    { name: "Prompt Engineering", w: 2 },
    { name: "GitHub Actions", w: 1 },
    { name: "PowerShell", w: 1 },
    { name: "SQL Server", w: 1 },
    { name: "Docker", w: 2 },
    { name: "Azure DevOps", w: 1 },
  ],

  // Docs
  docs: [
    { id: 'master-resume', name: "Master Resume", kind: "resume",
      state: "ok", isDefault: true, updated: "May 18, 2026",
      usedOn: 14, sizeHint: "PDF · 2 pages" },
    { id: 'long-resume', name: "Long-form Resume", kind: "resume",
      state: "ok", isDefault: false, updated: "Apr 02, 2026",
      usedOn: 3, sizeHint: "PDF · 4 pages" },
    { id: 'base-cover', name: "Base Cover Letter", kind: "cover",
      state: "ok", isDefault: true, updated: "May 02, 2026",
      usedOn: 11, sizeHint: "DOCX · 1 page" },
    { id: 'arch-case', name: "Architecture Case Study", kind: "context",
      state: "ok", isDefault: false, updated: "Mar 22, 2026",
      usedOn: 6, sizeHint: "PDF · 8 pages" },
    { id: 'transcripts', name: "Transcripts", kind: "context",
      state: "attention", isDefault: false, updated: "—",
      usedOn: 0, sizeHint: "Not yet uploaded" },
  ],

  // AI prefs
  ai: {
    formality: 0.65, // 0=casual, 1=formal
    detail:    0.40, // 0=concise, 1=detailed
    voiceSamples: [
      "I prefer to lead with the constraint, not the feature. If the system can't fail safely, no amount of polish matters.",
      "Most architecture problems aren't technical — they're disagreements about which trade-offs we're willing to live with.",
    ],
    avoid: ["synergy", "rockstar", "10x", "guru", "passionate", "ninja"],
    coverLetterStyle: "story-first",
  },

  // Integrations
  integrations: [
    { id: 'linkedin', name: "LinkedIn", initials: "in",
      state: "connected", sub: "Posts, 1st/2nd-degree contacts, profile sync · since Apr 12" },
    { id: 'gmail', name: "Gmail", initials: "M",
      state: "connected", sub: "Outreach replies · 142 threads tracked" },
    { id: 'calendar', name: "Google Calendar", initials: "C",
      state: "disconnected", sub: "Auto-schedule interview prep blocks" },
    { id: 'greenhouse', name: "Greenhouse ATS", initials: "GH",
      state: "disconnected", sub: "Application status sync" },
    { id: 'extension', name: "Browser Extension", initials: "JK",
      state: "connecting", sub: "Capture jobs from LinkedIn, Indeed, Otta with one click" },
  ],

  // Plan
  plan: { name: "Pro", price: "$29/mo",
    used: { applications: 38, gens: 142, contextBank: 6 },
    cap:  { applications: 100, gens: 500, contextBank: 25 },
  },

  // Completeness (computed in real life)
  completeness: 78,
  completenessChecks: [
    { done: true,  label: "Identity (name, email, location)", impact: "+15" },
    { done: true,  label: "Headline / bio", impact: "+8" },
    { done: true,  label: "Master resume uploaded", impact: "+20" },
    { done: true,  label: "Skills with weights (16)", impact: "+15" },
    { done: true,  label: "Target roles + seniority", impact: "+10" },
    { done: true,  label: "Compensation expectations", impact: "+10" },
    { done: false, label: "Voice samples for AI generation", impact: "+8" },
    { done: false, label: "Cover letter scaffolding", impact: "+6" },
    { done: false, label: "Calendar integration", impact: "+4" },
    { done: false, label: "Long-form context bank (3+ docs)", impact: "+4" },
  ],
};

// ─── Profile sections registry ───────────────────────────────
window.PROFILE_SECTIONS = [
  { id: "identity",     label: "Identity",      icon: "person",
    sub: "Name, contact, headline, bio", affectsMatching: false },
  { id: "match",        label: "Match profile", icon: "auto_awesome",
    sub: "What feeds your score", affectsMatching: true },
  { id: "ai",           label: "AI generation", icon: "neurology",
    sub: "Tone, voice, things to avoid", affectsMatching: false },
  { id: "documents",    label: "Documents",     icon: "folder",
    sub: "Resumes, cover letters, context bank", affectsMatching: false, attention: 1 },
  { id: "integrations", label: "Integrations",  icon: "link",
    sub: "LinkedIn, calendar, ATS, extension", affectsMatching: false },
  { id: "account",      label: "Account",       icon: "credit_card",
    sub: "Plan, usage, notifications, danger zone", affectsMatching: false },
];

// ─── 'Affects matching' chip ─────────────────────────────────
function MatchChip({ size = 'sm' }) {
  return (
    <span className={`match-chip ${size === 'tiny' ? 'is-tiny' : ''}`}>
      <Icon name="auto_awesome" size={size === 'tiny' ? 9 : 10} fill />
      Affects matching
    </span>
  );
}

// ─── Section card ────────────────────────────────────────────
function PSection({ id, icon, title, sub, actions, affectsMatching, children, defaultOpen = true, headerBorder = true }) {
  return (
    <section id={id} className="p-section">
      <header className={`p-section-head ${!headerBorder ? 'is-borderless' : ''}`}>
        <div className="p-section-icon"><Icon name={icon} size={16} /></div>
        <div className="p-section-text">
          <div className="p-section-title">
            {title}
            {affectsMatching && <MatchChip />}
          </div>
          {sub && <div className="p-section-sub">{sub}</div>}
        </div>
        <div className="p-section-actions">{actions}</div>
      </header>
      <div className="p-section-body">{children}</div>
    </section>
  );
}

// ─── Field row (read mode) ───────────────────────────────────
function PField({ label, value, affectsMatching, multi, muted, children }) {
  return (
    <div className="p-field">
      <div className="p-field-label">
        {label}
        {affectsMatching && <MatchChip size="tiny" />}
      </div>
      <div className={`p-field-value ${multi ? 'is-multi' : ''}`}>
        {children || (value ? <span className={muted ? 'is-muted' : ''}>{value}</span> :
          <span className="is-muted">Not set</span>)}
      </div>
    </div>
  );
}

function PFieldInput({ label, value, affectsMatching, multi, placeholder, disabled }) {
  return (
    <div className="p-field">
      <div className="p-field-label">
        {label}
        {affectsMatching && <MatchChip size="tiny" />}
      </div>
      {multi ? (
        <textarea className={`p-field-input is-multi ${disabled ? 'is-disabled' : ''}`}
          defaultValue={value} placeholder={placeholder} readOnly={disabled} />
      ) : (
        <input className={`p-field-input ${disabled ? 'is-disabled' : ''}`}
          type="text" defaultValue={value} placeholder={placeholder} readOnly={disabled} />
      )}
    </div>
  );
}

// ─── Skill chip ──────────────────────────────────────────────
function PSkill({ name, w, onClick, removable }) {
  const lbl = ['', 'Like', 'Strong', 'Core'][w] || '';
  return (
    <span className={`p-skill w-${w}`} onClick={onClick}>
      <span className="p-skill-name">{name}</span>
      <span className="p-skill-weight">{lbl}</span>
      {removable && <Icon name="close" size={12} style={{ color: 'var(--txt-dim)', marginRight: 4 }} />}
    </span>
  );
}

// ─── Doc tile ────────────────────────────────────────────────
function PDoc({ doc, onClick, uploading }) {
  const stateIcon = {
    ok: 'description',
    attention: 'description',
    missing: 'add',
  }[doc.state] || 'description';
  const iconCls =
    doc.state === 'missing' ? 'is-missing' :
    doc.state === 'attention' ? 'is-attention' : '';
  return (
    <div className="p-doc" onClick={onClick}>
      <div className="p-doc-head">
        <div className={`p-doc-icon ${iconCls}`}>
          <Icon name={doc.kind === 'cover' ? 'mail' : doc.kind === 'context' ? 'folder' : 'description'} size={16} />
        </div>
        <div className="p-doc-text">
          <div className="p-doc-name">{doc.name}</div>
          <div className="p-doc-sub">{doc.sizeHint}</div>
        </div>
      </div>
      {uploading && (
        <div className="p-doc-upload"><i style={{ width: `${uploading}%` }} /></div>
      )}
      <div className="p-doc-foot">
        {doc.isDefault && <span className="p-doc-default"><Icon name="bookmark" size={9} fill /> Default</span>}
        {doc.state === 'attention' && <span className="chip chip-amber" style={{ fontSize: 9, padding: '2px 6px' }}>
          Action needed
        </span>}
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
          <Icon name="schedule" size={11} /> {doc.updated}
        </span>
        {doc.usedOn > 0 && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
          · used on {doc.usedOn} jobs
        </span>}
      </div>
    </div>
  );
}

function PDocEmpty({ label = "Add document", sub = "PDF, DOCX up to 10MB", icon = "add" }) {
  return (
    <div className="p-doc p-doc-empty-cta">
      <div className="p-doc-head" style={{ flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 8 }}>
        <div className="p-doc-icon"><Icon name={icon} size={18} /></div>
        <div className="p-doc-text" style={{ textAlign: 'center' }}>
          <div className="p-doc-name">{label}</div>
          <div className="p-doc-sub">{sub}</div>
        </div>
      </div>
    </div>
  );
}

// ─── Integration row ─────────────────────────────────────────
function PIntegration({ integration }) {
  const s = integration.state;
  const actionLabel = s === 'connected' ? 'Manage' : s === 'connecting' ? 'Cancel' : 'Connect';
  return (
    <div className="p-int">
      <div className="p-int-icon">{integration.initials}</div>
      <div className="p-int-text">
        <div className="p-int-name">{integration.name}</div>
        <div className="p-int-sub">{integration.sub}</div>
      </div>
      <div className={`p-int-status is-${s}`}>
        <span className="dot" />
        {s === 'connected' ? 'Connected' : s === 'connecting' ? 'Connecting…' : 'Disconnected'}
      </div>
      <button className={`btn btn-sm ${s === 'disconnected' ? 'btn-primary' : ''}`}>
        {actionLabel}
      </button>
    </div>
  );
}

// ─── Score impact preview ────────────────────────────────────
function ScoreDelta({ delta }) {
  return (
    <span className={`score-delta ${delta < 0 ? 'is-down' : ''} score-pop`}>
      <Icon name={delta < 0 ? 'arrow_downward' : 'arrow_upward'} size={11} />
      {delta > 0 ? '+' : ''}{delta}
    </span>
  );
}

// ─── Hero (top identity card) ────────────────────────────────
function ProfileHero({ showDelta }) {
  return (
    <div className="p-hero">
      <div className="p-avatar is-xl">{window.PROFILE.initials}</div>
      <div className="p-hero-text">
        <h1 className="p-hero-name">{window.PROFILE.displayName}</h1>
        <div className="p-hero-headline">{window.PROFILE.headline}</div>
        <div className="p-hero-meta">
          <span className="meta"><Icon name="place" size={13} /> {window.PROFILE.location}</span>
          <span className="meta"><Icon name="mail" size={13} /> {window.PROFILE.email}</span>
          <span className="meta"><Icon name="badge" size={13} /> {window.PROFILE.workAuth}</span>
          <span className="meta" style={{ color: 'var(--primary)' }}>
            <Icon name="link" size={13} /> 3 links
          </span>
        </div>
      </div>
      <div className="p-hero-aside">
        <ScoreRing score={window.PROFILE.completeness} size={64} />
        <div className="p-hero-comp">
          <div className="p-hero-comp-lab">Profile readiness</div>
          <div className="p-hero-comp-pct">{window.PROFILE.completeness}<span style={{ fontSize: 14, color: 'var(--txt-mute)' }}>%</span></div>
          {showDelta && <ScoreDelta delta={3} />}
        </div>
      </div>
    </div>
  );
}

// ─── Completion checklist (full or summarized) ───────────────
function PChecklist({ limit, forceTodo }) {
  const items = limit ? window.PROFILE.completenessChecks.slice(0, limit) : window.PROFILE.completenessChecks;
  return (
    <div className="p-checklist">
      {items.map((raw, i) => {
        const it = forceTodo ? { ...raw, done: false } : raw;
        return (
          <div key={i} className={`p-checklist-item ${it.done ? 'is-done' : 'is-todo'}`}>
            <Icon name={it.done ? 'check_circle' : 'radio_button_unchecked'} size={16} fill={it.done} />
            <span className="cl-label">{it.label}</span>
            <span className="impact">{it.impact}</span>
            {!it.done && (
              <span className="go">
                <span className="label-go">Complete</span>
                <Icon name="chevron_right" size={16} />
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Sticky band header (Match profile / Other) ──────────────
function PBand({ icon, label, count, kind }) {
  return (
    <div className={`p-band ${kind === 'match' ? 'is-match' : ''}`}>
      <Icon name={icon} size={12} fill={kind === 'match'} />
      {label}
      {count && <span className="p-band-count">{count}</span>}
    </div>
  );
}

// Tone slider (visual only — uses 0..1)
function ToneSlider({ left, right, value }) {
  const pct = value * 100;
  return (
    <div className="p-slider-row">
      <span className="lbl-l">{left}</span>
      <div className="p-slider-track">
        <div className="p-slider-fill" style={{ width: `${pct}%` }} />
        <div className="p-slider-thumb" style={{ left: `${pct}%` }} />
      </div>
      <span className="lbl-r">{right}</span>
    </div>
  );
}

// Voice sample card
function VoiceSample({ text, source }) {
  return (
    <div className="p-voice">
      "{text}"
      <div className="p-voice-foot"><Icon name="record_voice_over" size={11} /> Source: {source}</div>
    </div>
  );
}

// Tag input (banned phrases / target roles)
function PTagInput({ tags, placeholder = "Add…" }) {
  return (
    <div className="p-tag-input">
      {tags.map((t, i) => (
        <span key={i} className="chip" style={{ fontSize: 11 }}>
          {t}
          <Icon name="close" size={11} style={{ color: 'var(--txt-dim)' }} />
        </span>
      ))}
      <input className="ghost" placeholder={placeholder} />
    </div>
  );
}

// Artboard caption pill — used on the top-left of each artboard
function PCap({ icon, children }) {
  return (
    <div className="p-cap">
      {icon && <Icon name={icon} size={11} />}
      {children}
    </div>
  );
}

// ─── Profile topbar (replaces breadcrumb actions on the Profile route) ───
function ProfileTopbar({ theme = 'light', isEditing }) {
  return (
    <div className="topbar">
      <div className="topbar-crumb">
        <Icon name="person" size={16} className="dim" />
        <span className="curr">Profile</span>
      </div>
      <div className="topbar-actions">
        <button className="btn btn-sm">
          <Icon name="link" size={14} /> Import from LinkedIn
        </button>
        <button className="btn btn-sm">
          <Icon name="file_upload" size={14} /> Import resume
        </button>
        {isEditing ? (
          <>
            <button className="btn btn-sm">Cancel</button>
            <button className="btn btn-sm btn-primary"><Icon name="check" size={14} /> Save</button>
          </>
        ) : (
          <button className="btn btn-sm btn-primary"><Icon name="edit" size={14} /> Edit profile</button>
        )}
      </div>
    </div>
  );
}

// Profile-aware app shell — same as AppShell but with the right
// topbar and nav active state
function ProfileShell({ children, theme = 'light', isEditing, navOpen }) {
  return (
    <div className="app" data-theme={theme}>
      <div className="nav">
        <div className="nav-logo">JK</div>
        <div className="nav-add"><Icon name="add" size={20} /></div>
        <div className="nav-item"><Icon name="dashboard" size={20} /></div>
        <div className="nav-item is-active"><Icon name="person" size={20} fill /></div>
        <div className="nav-item"><Icon name="analytics" size={20} /></div>
        <div className="nav-spacer" />
        <div className="nav-item"><Icon name="notifications" size={20} /></div>
        <div className="nav-item"><Icon name="settings" size={20} /></div>
        <div className="nav-avatar">{window.PROFILE.initials.charAt(0)}</div>
      </div>
      <ProfileTopbar theme={theme} isEditing={isEditing} />
      <div className="stage">{children}</div>
    </div>
  );
}

// Popover wrapper — uses base .popover but positioned manually inside the artboard
function PPopover({ top, left, children, style }) {
  return (
    <div className="popover" style={{ top, left, ...style }}>
      {children}
    </div>
  );
}

Object.assign(window, {
  MatchChip, PSection, PField, PFieldInput, PSkill,
  PDoc, PDocEmpty, PIntegration, ScoreDelta, ProfileHero,
  PChecklist, PBand, ToneSlider, VoiceSample, PTagInput,
  PCap, ProfileTopbar, ProfileShell, PPopover,
});
