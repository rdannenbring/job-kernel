import React from 'react';
import InterestStars from '../components/InterestStars';
import { STAGE_TO_STATUS } from '../components/PipelineProgressBar';
import { computeStageProgress, GeneratedSubStagePanel, AppliedSubStagePanel, InterviewingSubStagePanel, DecisionSubStagePanel, AcceptedSubStagePanel } from './ApplicationLifecycle';
import { useAuth } from '../context/AuthContext';
import './ApplicationDetailMobile.css';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';

const safeParseJSON = (data, fallback = {}) => {
  if (!data) return fallback;
  if (typeof data === 'object') return data;
  try { return JSON.parse(data) || fallback; }
  catch { return fallback; }
};

// ─── Stage data ──────────────────────────────────────────────────

const LINEAR_STAGES = [
  { id: 'saved',        label: 'Saved',        icon: 'bookmark',     subCount: 5 },
  { id: 'generated',    label: 'Generated',    icon: 'auto_awesome', subCount: 4 },
  { id: 'applied',      label: 'Applied',      icon: 'send',         subCount: 4 },
  { id: 'interviewing', label: 'Interviewing', icon: 'forum',        subCount: 5 },
  { id: 'decision',     label: 'Decision',     icon: 'gavel',        subCount: 5 },
  { id: 'accepted',     label: 'Accepted',     icon: 'verified',     subCount: 5 },
];

const BRANCH_STAGES = [
  { id: 'rejected',  label: 'Rejected',  icon: 'block' },
  { id: 'declined',  label: 'Declined',  icon: 'do_not_disturb_on' },
  { id: 'withdrawn', label: 'Withdrawn', icon: 'cancel' },
];

// Terminal stages map to the last-known linear stage index
const TERMINAL_TO_IDX = { rejected: 2, declined: 4, withdrawn: 2 };

const MOBILE_SUBSTAGES = {
  saved:        [
    { id: 'parsed',      label: 'Job Analysis', icon: 'analytics' },
    { id: 'reviewed',    label: 'Reviewed',     icon: 'fact_check' },
    { id: 'network',     label: 'Network',      icon: 'group' },
    { id: 'company',     label: 'Research',     icon: 'domain' },
    { id: 'prioritized', label: 'Prioritize',   icon: 'flag' },
  ],
  generated:    [
    { id: 'resume',       label: 'Resume',       icon: 'description' },
    { id: 'cover_letter', label: 'Cover Letter', icon: 'mail' },
    { id: 'answers',      label: 'Answers',      icon: 'question_answer' },
    { id: 'prep',         label: 'Prep',         icon: 'inventory_2' },
  ],
  applied:      [
    { id: 'submitted',     label: 'Submitted',    icon: 'check_circle' },
    { id: 'confirmed',     label: 'Confirmed',    icon: 'verified' },
    { id: 'follow_up_due', label: 'Follow-up Due',icon: 'schedule' },
    { id: 'follow_up_sent',label: 'Follow-up Sent',icon:'send' },
  ],
  interviewing: [
    { id: 'recruiter_screen', label: 'Recruiter', icon: 'person_search' },
    { id: 'hiring_manager',   label: 'Hiring Mgr',icon: 'psychology' },
    { id: 'technical',        label: 'Technical', icon: 'code' },
    { id: 'panel',            label: 'Panel',     icon: 'account_tree' },
    { id: 'final_round',      label: 'Final Round',icon:'stars' },
  ],
  decision: [
    { id: 'awaiting_decision',    label: 'Awaiting',    icon: 'hourglass_empty' },
    { id: 'references',           label: 'References',  icon: 'quick_reference_all' },
    { id: 'verbal_offer',         label: 'Verbal Offer',icon: 'chat' },
    { id: 'written_offer_pending',label: 'Written Offer',icon:'description' },
    { id: 'likely_reject',        label: 'Likely Reject',icon:'thumb_down' },
  ],
  accepted: [
    { id: 'offer_received',  label: 'Offer Received', icon: 'receipt_long' },
    { id: 'offer_reviewed',  label: 'Offer Reviewed', icon: 'fact_check' },
    { id: 'formal_acceptance',label:'Accepted',       icon: 'handshake' },
    { id: 'close_pipelines', label: 'Close Pipelines',icon:'cancel_presentation' },
    { id: 'pre_onboarding',  label: 'Pre-onboarding', icon: 'assignment_ind' },
  ],
};

// Forward CTA definition per stage
const STAGE_CTA = {
  saved:        { label: 'Generate Application', icon: 'auto_awesome' },
  generated:    { label: 'Mark as Applied',       icon: 'send' },
  applied:      { label: 'Move to Interviewing',  icon: 'chat_bubble' },
  interviewing: { label: 'Move to Decision',      icon: 'gavel' },
  decision:     { label: 'Mark as Accepted',      icon: 'verified' },
};

// ─── Small shared primitives ─────────────────────────────────────

const MIcon = ({ name, size = 16, fill = false, style = {}, className = '' }) => (
  <span
    className={`material-symbols-outlined${fill ? ' fill' : ''}${className ? ' ' + className : ''}`}
    style={{ fontSize: size, ...style }}
  >
    {name}
  </span>
);

const ScoreRing = ({ score, size = 56 }) => {
  const s = score || 0;
  const r = (size - 8) / 2;
  const c = 2 * Math.PI * r;
  const pct = s / 100;
  const color = s >= 80 ? 'var(--success)' : s >= 60 ? 'var(--warning)' : 'var(--error)';
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--border-color)" strokeWidth={4} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={4}
          strokeDasharray={`${pct * c} ${c * (1 - pct)}`} strokeLinecap="round" />
      </svg>
      <div style={{
        position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
        justifyContent: 'center', fontSize: size * 0.28, fontWeight: 800, color,
      }}>
        {s || '–'}
      </div>
    </div>
  );
};

const CompanyLogo = ({ app, size = 46 }) => {
  if (app?.company_logo) {
    return (
      <img src={app.company_logo} alt={app.company || ''}
        style={{ width: size, height: size, borderRadius: 10, objectFit: 'contain',
          background: 'rgba(255,255,255,0.06)', flexShrink: 0, border: '1px solid var(--border-color)' }}
      />
    );
  }
  const initials = (app?.company || 'JB').split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
  return (
    <div style={{
      width: size, height: size, borderRadius: 10, background: 'rgba(37,106,244,0.12)',
      border: '1px solid rgba(37,106,244,0.25)', display: 'flex', alignItems: 'center',
      justifyContent: 'center', fontSize: size * 0.3, fontWeight: 800, color: 'var(--primary)', flexShrink: 0,
    }}>
      {initials}
    </div>
  );
};

const StatusPill = ({ stage }) => {
  const label = STAGE_TO_STATUS[stage] || stage || 'Saved';
  const cls = ['saved', 'generated', 'applied'].includes(stage) ? 'chip chip-blue'
    : ['interviewing', 'decision'].includes(stage) ? 'chip chip-amber'
    : ['accepted'].includes(stage) ? 'chip chip-green'
    : 'chip';
  return <span className={cls}>{label}</span>;
};

// Derive docs row state from app
const getDocState = (app) => {
  const hasTailored = !!app?.tailored_resume_path;
  const hasBase = !!app?.original_resume_path;
  const hasCL = !!app?.cover_letter_path;
  const stage = (app?.pipeline_stage || 'saved').toLowerCase();
  const isBeforeSaved = stage === 'saved';
  return [
    {
      id: 'resume',
      name: 'Resume',
      icon: 'description',
      state: hasTailored ? 'ok' : hasBase ? 'attention' : 'missing',
      detail: hasTailored ? 'Tailored resume ready' : hasBase ? 'Base resume only' : 'No resume',
    },
    {
      id: 'cover_letter',
      name: 'Cover Letter',
      icon: 'mail',
      state: hasCL ? 'ok' : isBeforeSaved ? 'missing' : 'attention',
      detail: hasCL ? 'Cover letter ready' : 'Not generated yet',
    },
    {
      id: 'ctx',
      name: 'Context',
      icon: 'folder',
      state: 'ok',
      detail: 'Profile context available',
    },
  ];
};

// ─── useIsMobile hook ─────────────────────────────────────────────

export function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = React.useState(() => window.innerWidth <= breakpoint);
  React.useEffect(() => {
    const handle = () => setIsMobile(window.innerWidth <= breakpoint);
    window.addEventListener('resize', handle);
    return () => window.removeEventListener('resize', handle);
  }, [breakpoint]);
  return isMobile;
}

// ─── Focus trap for sheet / modal ────────────────────────────────

function useFocusTrap(containerRef, enabled, onEscape) {
  React.useEffect(() => {
    if (!enabled || !containerRef.current) return;
    const el = containerRef.current;
    const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
    const focusable = () => Array.from(el.querySelectorAll(FOCUSABLE)).filter(n => !n.disabled);

    const onKeyDown = (e) => {
      if (e.key === 'Escape') { onEscape?.(); return; }
      if (e.key !== 'Tab') return;
      const nodes = focusable();
      if (!nodes.length) return;
      const first = nodes[0], last = nodes[nodes.length - 1];
      if (e.shiftKey ? document.activeElement === first : document.activeElement === last) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    // Move focus into the container
    const nodes = focusable();
    if (nodes.length) nodes[0].focus();
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [enabled, containerRef, onEscape]);
}

// ─── ConfirmModal ─────────────────────────────────────────────────

function ConfirmModal({ config, onCancel }) {
  const ref = React.useRef(null);
  // Focus the Cancel button (not the destructive one) on open
  React.useEffect(() => {
    ref.current?.querySelector('.m-cancel-btn')?.focus();
  }, []);
  useFocusTrap(ref, true, onCancel);

  return (
    <>
      <div className="m-confirm-backdrop" onClick={onCancel} />
      <div className="m-confirm" role="dialog" aria-modal="true"
        aria-labelledby="m-confirm-title" ref={ref}>
        <div className={`m-confirm-icon${config.destructive ? ' is-destructive' : ''}`}>
          <MIcon name={config.destructive ? 'warning' : 'help'} size={20} fill />
        </div>
        <div className="m-confirm-title" id="m-confirm-title">{config.title}</div>
        <div className="m-confirm-body">{config.body}</div>
        <div className="m-confirm-actions">
          <button className="m-app-btn m-cancel-btn" onClick={onCancel}>Cancel</button>
          <button
            className={config.destructive ? 'm-app-btn-danger-solid' : 'm-app-btn-primary'}
            onClick={config.onConfirm}
          >
            {config.primary}
          </button>
        </div>
      </div>
    </>
  );
}

// ─── StagePreviewCard ─────────────────────────────────────────────

function StagePreviewCard({ stage, isPast, onBack, onRollback }) {
  return (
    <div className="m-card m-preview-card">
      <div className="m-preview-card-eyebrow">
        <MIcon name="visibility" size={12} /> Preview
      </div>
      <div className="m-preview-card-head">
        <div className="m-preview-card-icon">
          <MIcon name={stage.icon} size={22} />
        </div>
        <div style={{ minWidth: 0 }}>
          <h3 className="m-card-title">{stage.label}</h3>
          <div className="m-card-subtitle">
            {isPast
              ? `Completed earlier · ${stage.subCount} substages`
              : `Upcoming stage · ${stage.subCount} substages will activate when you reach it`}
          </div>
        </div>
      </div>
      <div className="m-preview-card-meta">
        {isPast
          ? 'You can move the pipeline back to this stage if you need to reopen earlier work. Progress in later stages will be preserved.'
          : 'Substages and content will appear here once you advance the pipeline.'}
      </div>
      <div className="m-preview-card-actions">
        <button className="m-app-btn m-app-btn-sm" onClick={onBack}>
          <MIcon name="arrow_back" size={13} /> Back to your stage
        </button>
        {isPast && (
          <button className="m-app-btn m-app-btn-sm" onClick={onRollback}
            style={{ background: 'var(--warn-soft)', borderColor: 'rgba(245,158,11,0.3)', color: 'var(--warn)' }}>
            <MIcon name="undo" size={13} /> Move pipeline back here
          </button>
        )}
      </div>
    </div>
  );
}

// ─── NextHint ─────────────────────────────────────────────────────

const HINT_CONFIG = {
  parsed:      { icon: 'analytics',  tone: 'success' },
  reviewed:    { icon: 'fact_check', tone: 'success' },
  network:     { icon: 'group',      tone: 'mute' },
  company:     { icon: 'business',   tone: 'success' },
};

function NextHint({ app, activeSubId, stageProgress }) {
  const cfg = HINT_CONFIG[activeSubId];
  if (!cfg) return null;

  const color = cfg.tone === 'success' ? 'var(--success)' : 'var(--text-muted)';

  const score = app?.match_score;
  const textMap = {
    parsed:   score != null ? `Match scored ${score}` : 'Analysis complete',
    reviewed: 'Requirements flagged · ready to research',
    network:  '0 known contacts · LinkedIn not connected',
    company:  'Research complete · ready to generate',
  };

  return (
    <div className="m-hint">
      <MIcon name={cfg.icon} size={14} style={{ color, flexShrink: 0 }} />
      <span>{textMap[activeSubId] || 'In progress'}</span>
    </div>
  );
}

// ─── SubStage content blocks ──────────────────────────────────────

function SummaryField({ label, value }) {
  return (
    <div className="m-summary-field">
      <div className="sf-label">{label}</div>
      <div className="sf-value">{value || '–'}</div>
    </div>
  );
}

function AnalysisContentMobile({ app }) {
  const matchDetails = safeParseJSON(app?.match_details, null);
  const score = app?.match_score || 0;
  const avgScore = app?.avg_score;

  const dims = matchDetails?.dimensions || [
    { name: 'Core Role',    score: null },
    { name: 'Experience',   score: null },
    { name: 'Education',    score: null },
    { name: 'Culture',      score: null },
    { name: 'ATS Keywords', score: null },
  ];

  const cmpDiff = avgScore != null ? score - avgScore : null;

  return (
    <>
      <div className="m-compat" style={{ marginBottom: 14 }}>
        <div className="m-compat-top">
          <ScoreRing score={score} size={64} />
          <div className="m-compat-stat" style={{ minWidth: 0 }}>
            <div className="lbl">Compatibility</div>
            <div className="msg">
              {score >= 80 ? 'Excellent match' : score >= 60 ? 'Good match' : 'Below average match'}
            </div>
            {cmpDiff != null && (
              <span className={`chip ${cmpDiff >= 0 ? 'chip-green' : 'chip-red'}`}
                style={{ marginTop: 6, width: 'fit-content', fontSize: 10 }}>
                <MIcon name={cmpDiff >= 0 ? 'arrow_upward' : 'arrow_downward'} size={10} />
                {Math.abs(Math.round(cmpDiff))} pts {cmpDiff >= 0 ? 'above' : 'below'} avg
              </span>
            )}
          </div>
        </div>
        {dims.map((d, i) => {
          const pct = d.score != null ? d.score : 0;
          const color = pct >= 18 ? 'var(--success)' : pct >= 14 ? 'var(--primary)' : 'var(--warning)';
          return (
            <div key={i} className="m-dim-row">
              <div className="name">{d.name}</div>
              <div className="bar">
                <div style={{ width: d.score != null ? `${(d.score / 20) * 100}%` : '0%', background: color }} />
              </div>
              <div className="val">
                {d.score != null ? <>{d.score}<span className="of">/20</span></> : '–'}
              </div>
            </div>
          );
        })}
      </div>

      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Job Summary
        </span>
      </div>
      <div className="m-summary">
        <SummaryField label="Location"   value={app?.job_location} />
        <SummaryField label="Type"       value={app?.job_type} />
        <SummaryField label="Seniority"  value={app?.experience_level} />
        <SummaryField label="Source"     value={app?.job_source} />
      </div>
    </>
  );
}

function ReviewedContentMobile({ app }) {
  const reqs = safeParseJSON(app?.parsed_requirements, []);
  const flagged = reqs.filter(r => r.is_flagged || r.type === 'must-have' || r.type === 'nice-to-have');

  if (!flagged.length && !reqs.length) {
    return (
      <div style={{ padding: '12px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
        No requirements flagged yet.
      </div>
    );
  }

  const items = flagged.length ? flagged : reqs.slice(0, 5);
  return (
    <div className="col gap-2">
      {items.map((r, i) => {
        const tag = r.type === 'must-have' ? 'Must-have' : r.type === 'nice-to-have' ? 'Nice-to-have' : 'Requirement';
        const chipCls = tag === 'Must-have' ? 'chip chip-amber' : 'chip chip-blue';
        return (
          <div key={i} className="m-flag-row">
            <span className={chipCls} style={{ flexShrink: 0 }}>{tag}</span>
            <div>{r.text || r.requirement || String(r)}</div>
          </div>
        );
      })}
    </div>
  );
}

function NetworkContentMobile({ connections }) {
  if (connections && connections.length > 0) {
    return (
      <div className="col gap-2">
        {connections.slice(0, 4).map((c, i) => (
          <div key={i} className="m-research-row">
            <div className="m-research-icon"><MIcon name="person" size={14} /></div>
            <div className="flex-1" style={{ minWidth: 0 }}>
              <div className="m-research-name">{c.name || c.fullName || 'Contact'}</div>
              <div className="m-research-meta">{c.title || c.headline || ''}</div>
            </div>
            <MIcon name="check_circle" size={16} fill style={{ color: 'var(--success)' }} />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="col gap-2" style={{ alignItems: 'center', padding: '12px 0' }}>
      <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--bg)',
        display: 'grid', placeItems: 'center', color: 'var(--text-muted)' }}>
        <MIcon name="group" size={22} />
      </div>
      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>No known contacts yet</div>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', maxWidth: 280 }}>
        Surface LinkedIn 1st/2nd-degree connections at this company.
      </div>
    </div>
  );
}

function ResearchContentMobile({ app }) {
  const research = safeParseJSON(app?.company_research, null);

  const sections = research ? [
    { name: 'Company Overview', icon: 'domain',         done: !!research.overview },
    { name: 'Financials & Market', icon: 'trending_up', done: !!research.financials },
    { name: 'Competitor Matrix', icon: 'compare_arrows',done: !!research.competitors },
    { name: 'Career Matches', icon: 'work',             done: !!research.career_matches },
  ] : [
    { name: 'Company Overview', icon: 'domain',          done: false },
    { name: 'Financials & Market', icon: 'trending_up',  done: false },
    { name: 'Competitor Matrix', icon: 'compare_arrows', done: false },
    { name: 'Career Matches', icon: 'work',              done: false },
  ];

  return (
    <div className="col gap-2">
      {sections.map((s, i) => (
        <div key={i} className="m-research-row">
          <div className="m-research-icon"><MIcon name={s.icon} size={14} /></div>
          <div className="flex-1" style={{ minWidth: 0 }}>
            <div className="m-research-name">{s.name}</div>
          </div>
          {s.done
            ? <MIcon name="check_circle" size={16} fill style={{ color: 'var(--success)' }} />
            : <MIcon name="radio_button_unchecked" size={16} style={{ color: 'var(--text-muted)' }} />
          }
        </div>
      ))}
    </div>
  );
}

function PrioritizeContentMobile({ app, onForwardCTA }) {
  const score = app?.match_score;
  const stage = (app?.pipeline_stage || 'saved').toLowerCase();

  return (
    <div className="col gap-3">
      <div className="m-next" style={{ margin: 0, boxShadow: 'none' }}>
        <div className="head"><MIcon name="bolt" size={11} fill /> Recommended next step</div>
        <h4>Move to Generated phase</h4>
        <p>Saved-phase research is complete. Generate a tailored resume + cover letter now.</p>
        <div className="m-next-actions">
          <button className="m-app-btn-primary m-app-btn-sm" onClick={onForwardCTA}>
            <MIcon name="auto_awesome" size={13} fill /> Move to Generated
          </button>
        </div>
      </div>
      {score != null && (
        <div className="row gap-2" style={{ padding: '10px 12px', background: 'var(--bg)', borderRadius: 10 }}>
          <MIcon name="trending_up" size={14} style={{ color: 'var(--success)' }} />
          <div style={{ fontSize: 12.5 }}>Match score <b>{score}</b></div>
        </div>
      )}
      <div className="row gap-2" style={{ padding: '10px 12px', background: 'var(--bg)', borderRadius: 10 }}>
        <MIcon name="event" size={14} className="dim" />
        <div style={{ fontSize: 12.5 }}>
          {stage === 'saved' ? 'In Saved phase' : `Current stage: ${stage}`}
        </div>
      </div>
    </div>
  );
}

// Generic substage placeholder for non-Saved stages
function GenericSubStageContent({ substage, app }) {
  const label = substage?.label || 'Content';
  const progress = safeParseJSON(app?.substage_progress, {});
  const done = progress?.[substage?.id] === true;

  return (
    <div style={{ padding: '12px 0', display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-start' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <MIcon name={substage?.icon || 'circle'} size={16} style={{ color: done ? 'var(--success)' : 'var(--text-muted)' }} />
        <span style={{ fontSize: 13, color: done ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
          {done ? `${label} complete` : `${label} in progress`}
        </span>
      </div>
    </div>
  );
}

const SAVED_SUBSTAGES = new Set(['parsed','reviewed','network','company','prioritized']);

function SubStageContentMobile({ app, activeSubId, currentStageId, connections, onForwardCTA, onRefresh, onStageChange, onStartFullGeneration }) {
  const stageSubstages = MOBILE_SUBSTAGES[currentStageId] || [];
  const substage = stageSubstages.find(s => s.id === activeSubId);

  // For non-saved stages use the real desktop panels (nav hidden, substage driven by pill tabs)
  if (currentStageId === 'generated') {
    return (
      <div className="m-desktop-panel">
        <GeneratedSubStagePanel
          app={app} onRefresh={onRefresh} onStageChange={onStageChange}
          onStartFullGeneration={onStartFullGeneration}
          initialSubStage={activeSubId} hideNav navCollapsed={false} onToggleNav={() => {}}
        />
      </div>
    );
  }
  if (currentStageId === 'applied') {
    return (
      <div className="m-desktop-panel">
        <AppliedSubStagePanel
          app={app} onRefresh={onRefresh} onStageChange={onStageChange}
          initialSubStage={activeSubId} hideNav navCollapsed={false} onToggleNav={() => {}}
        />
      </div>
    );
  }
  if (currentStageId === 'interviewing') {
    return (
      <div className="m-desktop-panel">
        <InterviewingSubStagePanel
          app={app} onRefresh={onRefresh} onStageChange={onStageChange}
          initialSubStage={activeSubId} hideNav navCollapsed={false} onToggleNav={() => {}}
        />
      </div>
    );
  }
  if (currentStageId === 'decision') {
    return (
      <div className="m-desktop-panel">
        <DecisionSubStagePanel
          app={app} onRefresh={onRefresh} onStageChange={onStageChange}
          initialSubStage={activeSubId} hideNav navCollapsed={false} onToggleNav={() => {}}
        />
      </div>
    );
  }
  if (currentStageId === 'accepted') {
    return (
      <div className="m-desktop-panel">
        <AcceptedSubStagePanel
          app={app} onRefresh={onRefresh} onStageChange={onStageChange}
          initialSubStage={activeSubId} hideNav navCollapsed={false} onToggleNav={() => {}}
        />
      </div>
    );
  }

  // Saved stage — use existing mobile-native content
  const TITLES = {
    parsed:      { title: 'Job Analysis', subtitle: 'Structured data extracted from the job posting' },
    reviewed:    { title: 'Reviewed',     subtitle: 'Key requirements you flagged from the posting' },
    network:     { title: 'Network Contacts', subtitle: `People you know at ${app?.company || 'this company'}` },
    company:     { title: 'Company Research', subtitle: 'Overview, financials, competitors, career matches' },
    prioritized: { title: 'Prioritize',   subtitle: 'Decide whether to move this opportunity forward' },
  };
  const meta = TITLES[activeSubId] || { title: substage?.label || 'Content', subtitle: '' };

  return (
    <div className="m-card">
      <div className="m-card-head">
        <div style={{ minWidth: 0 }}>
          <h3 className="m-card-title">{meta.title}</h3>
          <div className="m-card-subtitle">{meta.subtitle}</div>
        </div>
      </div>

      {activeSubId === 'parsed'      && <AnalysisContentMobile app={app} />}
      {activeSubId === 'reviewed'    && <ReviewedContentMobile app={app} />}
      {activeSubId === 'network'     && <NetworkContentMobile connections={connections} />}
      {activeSubId === 'company'     && <ResearchContentMobile app={app} />}
      {activeSubId === 'prioritized' && <PrioritizeContentMobile app={app} onForwardCTA={onForwardCTA} />}
      {!SAVED_SUBSTAGES.has(activeSubId) && (
        <GenericSubStageContent substage={substage} app={app} />
      )}
    </div>
  );
}

// ─── MobileDocSheet ──────────────────────────────────────────────

function MobileDocSheet({ app, docType, fetchWithAuth, onUpdate, onClose }) {
  const isResume = docType === 'resume';
  const tailoredPath = isResume ? app?.tailored_resume_path : app?.cover_letter_path;
  const overridePath = isResume ? app?.override_resume_path : app?.override_cover_letter_path;
  const activeType   = isResume ? (app?.active_resume_type || 'generated') : (app?.active_cover_letter_type || 'generated');
  const [regenerating, setRegenerating] = React.useState(false);
  const [uploading, setUploading]       = React.useState(false);
  const fileInputRef = React.useRef(null);
  const ref = React.useRef(null);
  useFocusTrap(ref, true, onClose);

  const buildPdfUrl = (path) => {
    if (!path) return null;
    const pdfPath = path.toLowerCase().endsWith('.pdf') ? path : path.replace(/\.\w+$/, '.pdf');
    return `${API_URL}/api/download/${pdfPath}`;
  };

  const openPreview = (path) => {
    const url = buildPdfUrl(path);
    if (url) window.open(url, '_blank', 'noopener');
  };

  const handleRegenerate = async () => {
    if (!window.confirm(`Regenerate this ${isResume ? 'resume' : 'cover letter'} using the current job description?`)) return;
    setRegenerating(true);
    try {
      if (isResume) {
        const body = new FormData();
        body.append('job_description', app.job_description || '');
        body.append('use_default_resume', 'true');
        const res = await fetchWithAuth(`${API_URL}/api/tailor-resume`, { method: 'POST', body });
        if (res.ok) {
          const data = await res.json();
          const update = { tailored_resume_path: data.files?.pdf?.split('/').pop() };
          await fetchWithAuth(`${API_URL}/api/applications/${app.id}`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(update),
          });
          onUpdate?.(app.id, update);
        }
      } else {
        const resumeData = safeParseJSON(app.resume_data, {});
        const body = new FormData();
        body.append('job_description', app.job_description || '');
        body.append('resume_text', resumeData?.full_text?.join('\n') || '');
        const res = await fetchWithAuth(`${API_URL}/api/generate-cover-letter`, { method: 'POST', body });
        if (res.ok) {
          const data = await res.json();
          const update = { cover_letter_path: data.files?.pdf?.split('/').pop() };
          await fetchWithAuth(`${API_URL}/api/applications/${app.id}`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(update),
          });
          onUpdate?.(app.id, update);
        }
      }
    } catch (e) { console.error(e); }
    finally { setRegenerating(false); }
  };

  const handleUpload = async (file) => {
    if (!file) return;
    setUploading(true);
    const endpoint = isResume ? 'override-resume' : 'override-cover-letter';
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetchWithAuth(`${API_URL}/api/applications/${app.id}/${endpoint}`, { method: 'POST', body: fd });
      if (res.ok) {
        const result = await res.json();
        const field = isResume ? 'override_resume_path' : 'override_cover_letter_path';
        const activeField = isResume ? 'active_resume_type' : 'active_cover_letter_type';
        onUpdate?.(app.id, { [field]: result.path, [activeField]: 'override' });
      }
    } catch (e) { console.error(e); }
    finally { setUploading(false); }
  };

  const handleDeleteOverride = async () => {
    if (!window.confirm('Delete this custom version?')) return;
    const type = isResume ? 'resume' : 'cover_letter';
    const res = await fetchWithAuth(`${API_URL}/api/applications/${app.id}/override/${type}`, { method: 'DELETE' });
    if (res.ok) {
      const field = isResume ? 'override_resume_path' : 'override_cover_letter_path';
      const activeField = isResume ? 'active_resume_type' : 'active_cover_letter_type';
      onUpdate?.(app.id, { [field]: null, [activeField]: 'generated' });
    }
  };

  const handleToggleActive = async (active) => {
    const type = isResume ? 'resume' : 'cover_letter';
    const res = await fetchWithAuth(`${API_URL}/api/applications/${app.id}/toggle-active`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, active }),
    });
    if (res.ok) {
      const field = isResume ? 'active_resume_type' : 'active_cover_letter_type';
      onUpdate?.(app.id, { [field]: active });
    }
  };

  const title = isResume ? 'Resume' : 'Cover Letter';
  const icon  = isResume ? 'description' : 'mail';

  const DocRow = ({ label, path, versionKey, previewType }) => {
    const isActive = activeType === versionKey;
    return (
      <div className="m-doc-sheet-row">
        <div className="m-doc-sheet-row-info">
          <span className="m-doc-sheet-label">{label}</span>
          {isActive && <span className="chip chip-green" style={{ fontSize: 10, padding: '1px 6px' }}>Active</span>}
        </div>
        <div className="m-doc-sheet-row-actions">
          <button className="m-app-btn m-app-btn-sm" onClick={() => openPreview(path)} disabled={!path}>
            <MIcon name="visibility" size={13} /> View
          </button>
          {!isActive && path && (
            <button className="m-app-btn m-app-btn-sm" onClick={() => handleToggleActive(versionKey)}>
              <MIcon name="check_circle" size={13} /> Set active
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <>
      <div className="m-sheet-backdrop" onClick={onClose} />
      <div className="m-sheet" role="dialog" aria-modal="true"
        aria-label={`${title} options`} ref={ref}>
        <div className="m-sheet-handle" />
        <div className="m-sheet-head">
          <span className="m-sheet-title">
            <MIcon name={icon} size={16} /> {title}
          </span>
          <button className="m-iconbtn" onClick={onClose} aria-label={`Close ${title}`}>
            <MIcon name="close" size={20} />
          </button>
        </div>
        <div className="m-sheet-body col gap-3">

          {/* Tailored / generated version */}
          {tailoredPath ? (
            <div className="m-doc-sheet-section">
              <div className="m-doc-sheet-section-label">AI Generated</div>
              <DocRow label="Generated version" path={tailoredPath} versionKey="generated" />
              <button className="m-app-btn m-app-btn-sm" onClick={handleRegenerate} disabled={regenerating}
                style={{ alignSelf: 'flex-start', marginTop: 4 }}>
                <MIcon name="refresh" size={13} /> {regenerating ? 'Regenerating…' : 'Regenerate'}
              </button>
            </div>
          ) : (
            <div className="m-doc-sheet-section">
              <div className="m-doc-sheet-section-label">AI Generated</div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', padding: '8px 0' }}>Not generated yet</div>
              <button className="m-app-btn-primary m-app-btn-sm" onClick={handleRegenerate} disabled={regenerating}
                style={{ alignSelf: 'flex-start' }}>
                <MIcon name="auto_awesome" size={13} fill /> {regenerating ? 'Generating…' : `Generate ${title}`}
              </button>
            </div>
          )}

          {/* Custom override version */}
          <div className="m-doc-sheet-section">
            <div className="m-doc-sheet-section-label">Custom Upload</div>
            {overridePath ? (
              <>
                <DocRow label={overridePath.split('/').pop()} path={overridePath} versionKey="override" />
                <button className="m-app-btn m-app-btn-sm" onClick={handleDeleteOverride}
                  style={{ alignSelf: 'flex-start', marginTop: 4, color: 'var(--error)', borderColor: 'rgba(239,68,68,0.3)' }}>
                  <MIcon name="delete" size={13} /> Remove custom
                </button>
              </>
            ) : (
              <button className="m-app-btn m-app-btn-sm" onClick={() => fileInputRef.current?.click()}
                disabled={uploading} style={{ alignSelf: 'flex-start' }}>
                <MIcon name="upload" size={13} /> {uploading ? 'Uploading…' : 'Upload custom'}
              </button>
            )}
          </div>

          <input ref={fileInputRef} type="file" accept=".pdf,.docx" style={{ display: 'none' }}
            onChange={e => { handleUpload(e.target.files[0]); e.target.value = ''; }} />
        </div>
      </div>
    </>
  );
}

// ─── JobDescSheet ─────────────────────────────────────────────────

function JobDescSheet({ app, onClose }) {
  const ref = React.useRef(null);
  useFocusTrap(ref, true, onClose);
  const text = app?.job_description || '';

  return (
    <>
      <div className="m-sheet-backdrop" onClick={onClose} />
      <div className="m-sheet m-sheet-tall" role="dialog" aria-modal="true"
        aria-label="Full job details" ref={ref}>
        <div className="m-sheet-handle" />
        <div className="m-sheet-head">
          <span className="m-sheet-title">Full Job Details</span>
          <button className="m-iconbtn" onClick={onClose} aria-label="Close job details">
            <MIcon name="close" size={20} />
          </button>
        </div>
        <div className="m-sheet-body">
          <div style={{ marginBottom: 12 }}>
            <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>{app?.job_title}</h2>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>{app?.company}</div>
          </div>
          {app?.job_location && (
            <div className="row gap-1" style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
              <MIcon name="location_on" size={13} /> {app.job_location}
            </div>
          )}
          {text ? (
            <pre style={{
              whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: 13,
              lineHeight: 1.6, color: 'var(--text-secondary)', margin: 0,
              fontFamily: 'inherit',
            }}>{text}</pre>
          ) : (
            <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>No job description available.</div>
          )}
        </div>
      </div>
    </>
  );
}

// ─── MobileLogoPickerSheet ───────────────────────────────────────

function MobileLogoPickerSheet({ companyName, onSelect, onClose }) {
  const [tab, setTab] = React.useState('search');
  const [query, setQuery] = React.useState(companyName || '');
  const [results, setResults] = React.useState([]);
  const [searching, setSearching] = React.useState(false);
  const [urlValue, setUrlValue] = React.useState('');
  const fileInputRef = React.useRef(null);
  const debounceRef = React.useRef(null);
  const ref = React.useRef(null);
  useFocusTrap(ref, true, onClose);

  const performSearch = React.useCallback(async (q) => {
    if (!q.trim()) { setResults([]); return; }
    setSearching(true);
    try {
      const res = await fetch(`https://autocomplete.clearbit.com/v1/companies/suggest?query=${encodeURIComponent(q)}`);
      setResults(res.ok ? (await res.json()).slice(0, 12) : []);
    } catch { setResults([]); }
    finally { setSearching(false); }
  }, []);

  React.useEffect(() => { if (companyName) performSearch(companyName); }, []);

  const handleQueryChange = (e) => {
    const val = e.target.value;
    setQuery(val);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => performSearch(val), 400);
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => onSelect(ev.target.result);
    reader.readAsDataURL(file);
  };

  const TABS = [
    { id: 'search', label: 'Search',    icon: 'search' },
    { id: 'url',    label: 'Paste URL', icon: 'link' },
    { id: 'upload', label: 'Upload',    icon: 'upload' },
  ];

  return (
    <>
      <div className="m-sheet-backdrop" onClick={onClose} />
      <div className="m-sheet m-sheet-tall" role="dialog" aria-modal="true"
        aria-label="Set company logo" ref={ref}>
        <div className="m-sheet-handle" />
        <div className="m-sheet-head">
          <span className="m-sheet-title"><MIcon name="corporate_fare" size={16} /> Set Company Logo</span>
          <button className="m-iconbtn" onClick={onClose} aria-label="Close logo picker">
            <MIcon name="close" size={20} />
          </button>
        </div>
        <div className="m-logo-tabs">
          {TABS.map(t => (
            <button key={t.id}
              className={`m-logo-tab${tab === t.id ? ' is-active' : ''}`}
              onClick={() => setTab(t.id)}>
              <MIcon name={t.icon} size={13} /> {t.label}
            </button>
          ))}
        </div>
        <div className="m-sheet-body">
          {tab === 'search' && (
            <div className="col gap-3">
              <input
                className="m-logo-input"
                type="text" value={query} onChange={handleQueryChange}
                placeholder="Search by company name…" autoFocus
              />
              {searching && (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '20px 0' }}>
                  <div className="m-spin" />
                </div>
              )}
              {!searching && results.length === 0 && query.trim() && (
                <div style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', padding: '20px 0' }}>
                  No logos found for "{query}"
                </div>
              )}
              {!searching && results.length === 0 && !query.trim() && (
                <div style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', padding: '20px 0' }}>
                  Type a company name to search logos
                </div>
              )}
              {!searching && results.length > 0 && (
                <div className="m-logo-grid">
                  {results.map((r, i) => (
                    <button key={i} className="m-logo-item"
                      onClick={() => onSelect(`https://www.google.com/s2/favicons?domain=${r.domain}&sz=128`)}
                      title={r.name || r.domain}>
                      <img src={`https://www.google.com/s2/favicons?domain=${r.domain}&sz=64`}
                        alt={r.name || r.domain} style={{ width: 40, height: 40, objectFit: 'contain' }}
                        onError={e => { e.target.style.display = 'none'; }} />
                      <span className="m-logo-name">{r.name || r.domain}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          {tab === 'url' && (
            <div className="col gap-3">
              <input className="m-logo-input" type="url" value={urlValue}
                onChange={e => setUrlValue(e.target.value)}
                placeholder="https://example.com/logo.png" autoFocus />
              <button className="m-app-btn-primary m-app-btn-sm"
                onClick={() => { try { new URL(urlValue); onSelect(urlValue.trim()); } catch {} }}>
                <MIcon name="check" size={14} /> Use this URL
              </button>
            </div>
          )}
          {tab === 'upload' && (
            <div className="col gap-3" style={{ alignItems: 'flex-start' }}>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>
                Choose an image file from your device.
              </p>
              <button className="m-app-btn m-app-btn-sm" onClick={() => fileInputRef.current?.click()}>
                <MIcon name="upload" size={14} /> Choose file
              </button>
              <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }}
                onChange={handleFileChange} />
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ─── ApplicationDetailMobile ──────────────────────────────────────

export default function ApplicationDetailMobile({
  app,
  onBack,
  onUpdate,
  onPersist,
  onStartFullGeneration,
}) {
  const { fetchWithAuth } = useAuth();
  const pipelineStage = (app?.pipeline_stage || 'saved').toLowerCase();
  const isTerminal = pipelineStage in TERMINAL_TO_IDX;

  const currentStageIdx = LINEAR_STAGES.findIndex(s => s.id === pipelineStage) !== -1
    ? LINEAR_STAGES.findIndex(s => s.id === pipelineStage)
    : (TERMINAL_TO_IDX[pipelineStage] ?? 0);

  const currentStage = LINEAR_STAGES[currentStageIdx];
  const stageProgress = computeStageProgress(app);
  const substageProgress = safeParseJSON(app?.substage_progress, {});

  const getDefaultSub = (stageId) => (MOBILE_SUBSTAGES[stageId]?.[0]?.id || 'parsed');

  const [previewIdx, setPreviewIdx] = React.useState(currentStageIdx);
  const [activeSub, setActiveSub] = React.useState(() => getDefaultSub(pipelineStage));
  const [sheetOpen, setSheetOpen] = React.useState(false);
  const [confirm, setConfirm] = React.useState(null);
  const [connections, setConnections] = React.useState([]);
  const [docSheet, setDocSheet] = React.useState(null);   // null | 'resume' | 'cover_letter'
  const [jobDescOpen, setJobDescOpen] = React.useState(false);
  const [showLogoPicker, setShowLogoPicker] = React.useState(false);

  // Reset preview when the real stage changes
  React.useEffect(() => {
    setPreviewIdx(currentStageIdx);
    setActiveSub(getDefaultSub(pipelineStage));
  }, [app?.pipeline_stage]);

  // Fetch LinkedIn contacts for the Network tab
  React.useEffect(() => {
    if (!app?.id || !fetchWithAuth) return;
    fetchWithAuth(`${API_URL}/api/applications/${app.id}/linkedin-connections`)
      .then(res => res.ok ? res.json() : { matches: [] })
      .then(data => setConnections(data.matches || []))
      .catch(() => {});
  }, [app?.id]);

  const isPreviewing = previewIdx !== currentStageIdx;
  const isPastPreview = previewIdx < currentStageIdx;
  const previewStage = LINEAR_STAGES[previewIdx];

  // Substage tab scroll
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

  // Drag-to-scroll on substage strip (mouse only — touch uses native CSS overflow scroll)
  React.useEffect(() => {
    const el = substageScrollRef.current;
    if (!el) return;
    let down = false, startX = 0, startScroll = 0, moved = false;
    const onDown = (e) => {
      if (e.pointerType === 'touch') return;
      down = true; moved = false; startX = e.clientX; startScroll = el.scrollLeft;
      // Don't add is-dragging here — pointer-events:none on buttons would prevent
      // mouseup reaching the button, breaking click synthesis
    };
    const onMove = (e) => {
      if (!down || e.pointerType === 'touch') return;
      const dx = e.clientX - startX;
      if (Math.abs(dx) > 8) {
        moved = true;
        el.classList.add('is-dragging'); // only set after confirmed drag
      }
      el.scrollLeft = startScroll - dx;
    };
    const stop = () => { down = false; el.classList.remove('is-dragging'); setTimeout(() => { moved = false; }, 0); };
    const onClick = (e) => { if (moved) { e.preventDefault(); e.stopPropagation(); } };
    el.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', stop);
    el.addEventListener('click', onClick, true);
    return () => {
      el.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', stop);
      el.removeEventListener('click', onClick, true);
    };
  }, []);

  // Keyboard arrow navigation for substage tabs
  const handleSubKeyDown = (e, subId) => {
    const subs = MOBILE_SUBSTAGES[currentStage.id] || [];
    const idx = subs.findIndex(s => s.id === subId);
    if (e.key === 'ArrowRight' && idx < subs.length - 1) {
      e.preventDefault();
      setActiveSub(subs[idx + 1].id);
      substageTabRefs.current[subs[idx + 1].id]?.focus();
    } else if (e.key === 'ArrowLeft' && idx > 0) {
      e.preventDefault();
      setActiveSub(subs[idx - 1].id);
      substageTabRefs.current[subs[idx - 1].id]?.focus();
    }
  };

  // Stage mutation (rollback + end state)
  const handleStageChange = React.useCallback(async (newStage) => {
    const newStatus = STAGE_TO_STATUS[newStage] || app.status;
    try {
      const res = await fetchWithAuth(`${API_URL}/api/applications/${app.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...app, pipeline_stage: newStage, status: newStatus, force: true }),
      });
      if (res.ok && onUpdate) onUpdate(app.id, { pipeline_stage: newStage, status: newStatus });
    } catch (e) {
      console.error('Failed to update pipeline stage', e);
    }
  }, [app, fetchWithAuth, onUpdate]);

  // Rollback confirm
  const askRollback = () => setConfirm({
    title: 'Move pipeline back?',
    body: `This moves the application from "${currentStage.label}" back to "${previewStage.label}". Progress in later stages will be preserved.`,
    primary: `Move back to ${previewStage.label}`,
    destructive: true,
    onConfirm: async () => {
      await handleStageChange(previewStage.id);
      setConfirm(null);
    },
  });

  // End state confirm
  const askEndState = (branch) => setConfirm({
    title: `Mark as ${branch.label}?`,
    body: `Move this application to ${branch.label}. This is a terminal state — the pipeline will close.`,
    primary: `Mark as ${branch.label}`,
    destructive: true,
    onConfirm: async () => {
      await handleStageChange(branch.id);
      setConfirm(null);
      setSheetOpen(false);
    },
  });

  // Forward CTA (no confirm)
  const cta = STAGE_CTA[currentStage.id];
  const handleForwardCTA = () => {
    if (currentStage.id === 'saved') {
      onStartFullGeneration?.(app, '', '');
      return;
    }
    const nextStage = LINEAR_STAGES[currentStageIdx + 1];
    if (nextStage) handleStageChange(nextStage.id);
  };

  // Logo select handler
  const handleLogoSelect = React.useCallback(async (logoValue) => {
    setShowLogoPicker(false);
    onUpdate?.(app.id, { company_logo: logoValue });
    try {
      await fetchWithAuth(`${API_URL}/api/applications/${app.id}/logo`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company_logo: logoValue }),
      });
    } catch (e) { console.warn('Logo save failed', e); }
  }, [app?.id, fetchWithAuth, onUpdate]);

  // Refresh handler passed to desktop substage panels
  const handleRefresh = React.useCallback(async () => {
    if (!app?.id || !fetchWithAuth) return;
    try {
      const res = await fetchWithAuth(`${API_URL}/api/applications/${app.id}`);
      if (res.ok) onUpdate?.(app.id, await res.json());
    } catch (e) { console.error(e); }
  }, [app?.id, fetchWithAuth, onUpdate]);

  // Substage "done" check
  const isSubDone = (stageId, subId) => {
    if (stageId === 'saved' && subId === 'parsed') return true;
    if (stageId === 'generated') {
      if (subId === 'resume')       return !!app?.tailored_resume_path;
      if (subId === 'cover_letter') return !!app?.cover_letter_path;
    }
    return substageProgress?.[subId] === true;
  };

  const stageSubstages = MOBILE_SUBSTAGES[currentStage.id] || [];
  const sp = stageProgress?.[currentStage.id];
  const stepLabel = sp ? `${sp.completed}/${sp.total}` : `Step ${currentStageIdx + 1} of ${LINEAR_STAGES.length}`;

  const docs = getDocState(app);
  const salary = app?.salary_range && app.salary_range !== 'Not Listed' ? app.salary_range : null;

  const listingUrl = app?.job_url || app?.apply_url || null;
  const companyUrl = app?.company_url
    ? (app.company_url.startsWith('http') ? app.company_url : `https://${app.company_url}`)
    : null;

  const metaItems = [
    app?.job_location    && { icon: 'location_on', label: app.job_location },
    app?.job_type        && { icon: 'work',        label: app.job_type },
    app?.job_posted_date && { icon: 'event',       label: `Posted ${app.job_posted_date}` },
    listingUrl           && { icon: 'open_in_new', label: 'Visit listing', href: listingUrl },
  ].filter(Boolean);

  // ── Sheet focus trap ref
  const sheetRef = React.useRef(null);
  useFocusTrap(sheetRef, sheetOpen, () => setSheetOpen(false));

  return (
    <div className="m-app">

      {/* ── Top app bar ── */}
      <div className="m-topbar">
        <button className="m-iconbtn" aria-label="Back" onClick={onBack}>
          <MIcon name="arrow_back" size={20} />
        </button>
        <div className="m-crumb">
          <span className="m-crumb-eyebrow">{app?.company || '—'}</span>
          <span className="m-crumb-name">{app?.job_title || 'Job Details'}</span>
        </div>
        <button className="m-iconbtn" aria-label="More options">
          <MIcon name="more_vert" size={20} />
        </button>
      </div>

      {/* ── Scroll body ── */}
      <div className="m-scroll">

        {/* ── Header card ── */}
        <div className="m-header">
          <div className="m-header-top">
            <button className="m-logo-btn" onClick={() => setShowLogoPicker(true)} aria-label="Change company logo">
              <CompanyLogo app={app} size={46} />
            </button>
            <div className="flex-1" style={{ minWidth: 0 }}>
              <h1 className="m-header-title">{app?.job_title || 'Job Title'}</h1>
              {companyUrl ? (
                <a href={companyUrl} target="_blank" rel="noopener noreferrer"
                  className="m-header-company" style={{ textDecoration: 'none' }}>
                  {app?.company || '—'}
                  <MIcon name="arrow_outward" size={12} className="m-arrow" />
                </a>
              ) : (
                <div className="m-header-company">{app?.company || '—'}</div>
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, flexShrink: 0 }}>
              <ScoreRing score={app?.match_score} size={48} />
              {app?.match_score != null && (
                <span style={{ fontSize: 9, color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>Match</span>
              )}
            </div>
          </div>

          {/* Status + salary + interest */}
          <div className="m-pill-row">
            <StatusPill stage={pipelineStage} />
            {salary && (
              <span className="salary-chip">
                <MIcon name="payments" size={12} fill />
                {salary}
              </span>
            )}
            <div className="row gap-2" style={{ marginLeft: 'auto', alignItems: 'center' }}>
              <span className="label" style={{ fontSize: 9 }}>Interest</span>
              <InterestStars level={app?.interest_level} size="14px"
                onChange={(level) => onPersist?.(app.id, { interest_level: level })} />
            </div>
          </div>

          {/* Meta 2-col grid */}
          {metaItems.length > 0 && (
            <div className="m-meta-grid">
              {metaItems.map((m, i) => m.href ? (
                <a key={i} href={m.href} target="_blank" rel="noopener noreferrer"
                  className="m-meta-item is-link" style={{ textDecoration: 'none' }}>
                  <MIcon name={m.icon} size={13} />
                  <span>{m.label}</span>
                </a>
              ) : (
                <div key={i} className="m-meta-item">
                  <MIcon name={m.icon} size={13} />
                  <span>{m.label}</span>
                </div>
              ))}
            </div>
          )}

          <div className="m-header-divider" />

          {/* Docs row */}
          <div className="m-docs-row">
            {docs.map(d => (
              <button key={d.id}
                className={`m-doc is-${d.state}`}
                title={`${d.name} — ${d.detail}`}
                onClick={() => d.id !== 'ctx' ? setDocSheet(d.id) : undefined}
              >
                <span className="m-doc-icon"><MIcon name={d.icon} size={12} /></span>
                <span className="m-doc-name">{d.name}</span>
                <span className="m-doc-dot" />
              </button>
            ))}
          </div>

          <button className="m-view-details" onClick={() => setJobDescOpen(true)}>
            <MIcon name="article" size={14} /> View full job details
            <MIcon name="chevron_right" size={14} className="m-arrow-r" />
          </button>
        </div>

        {/* ── Pipeline strip ── */}
        <div className="m-pipe">
          <div className="m-pipe-head">
            <div className="m-pipe-stage">
              <span className="m-pipe-stage-name">
                {isTerminal ? pipelineStage.charAt(0).toUpperCase() + pipelineStage.slice(1) : currentStage.label}
              </span>
              <span className="m-pipe-stage-progress">{stepLabel}</span>
            </div>
            <button className="m-pipe-expand" onClick={() => setSheetOpen(true)}>
              All stages <MIcon name="expand_more" size={12} />
            </button>
          </div>

          {/* Progress dots — role="tablist" per design spec */}
          <div className="m-pipe-dots" role="tablist" aria-label="Pipeline stages">
            {LINEAR_STAGES.map((s, i) => {
              const passed = i < currentStageIdx;
              const current = i === currentStageIdx;
              const previewing = i === previewIdx && isPreviewing;
              const cls = [
                passed ? 'is-passed' : current ? 'is-current' : '',
                previewing ? 'is-previewing' : '',
              ].filter(Boolean).join(' ');
              return (
                <button
                  key={s.id}
                  className={`m-pipe-dot${cls ? ' ' + cls : ''}`}
                  onClick={() => setPreviewIdx(i)}
                  role="tab"
                  aria-label={`${s.label} stage`}
                  aria-selected={i === previewIdx}
                />
              );
            })}
          </div>

          {/* Preview sub-line — below dots per design decision #7 */}
          {isPreviewing && (
            <div className={`m-pipe-preview-line${isPastPreview ? ' is-past' : ' is-future'}`}>
              <MIcon name="visibility" size={12} />
              <span>Viewing <b>{previewStage.label}</b></span>
              <button className="m-pipe-preview-close"
                onClick={() => setPreviewIdx(currentStageIdx)}
                aria-label="Close preview">
                <MIcon name="close" size={14} />
              </button>
            </div>
          )}

          {/* Substage tabs — only when on current stage */}
          {!isPreviewing && stageSubstages.length > 0 && (
            <div className="m-substage-tabs-wrap">
              <div className="m-substage-tabs" ref={substageScrollRef} role="tablist" aria-label="Substages">
                {stageSubstages.map(ss => {
                  const done = isSubDone(currentStage.id, ss.id);
                  const active = ss.id === activeSub;
                  return (
                    <button
                      key={ss.id}
                      ref={el => substageTabRefs.current[ss.id] = el}
                      onClick={() => setActiveSub(ss.id)}
                      onKeyDown={(e) => handleSubKeyDown(e, ss.id)}
                      role="tab"
                      aria-selected={active}
                      className={`m-substage-tab${active ? ' is-active' : ''}${done ? ' is-done' : ''}`}
                    >
                      <MIcon
                        name={done ? 'check_circle' : ss.icon}
                        size={12}
                        fill={active || done}
                        className={done ? 'check' : ''}
                      />
                      {ss.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* ── Workspace ── */}
        {!isPreviewing ? (
          <>
            {activeSub !== 'prioritized' && (
              <NextHint app={app} activeSubId={activeSub} stageProgress={stageProgress} />
            )}
            <SubStageContentMobile
              app={app}
              activeSubId={activeSub}
              currentStageId={currentStage.id}
              connections={connections}
              onForwardCTA={handleForwardCTA}
              onRefresh={handleRefresh}
              onStageChange={handleStageChange}
              onStartFullGeneration={onStartFullGeneration}
            />
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
      {cta && !isTerminal && (
        <div className="m-cta-bar">
          <button className="m-app-btn-primary m-cta-bar-primary" onClick={handleForwardCTA}>
            <MIcon name={cta.icon} size={15} fill />
            {cta.label}
          </button>
          <button className="m-app-btn" aria-label="More actions">
            <MIcon name="more_horiz" size={16} />
          </button>
        </div>
      )}

      {/* ── Pipeline bottom sheet ── */}
      {sheetOpen && (
        <>
          <div className="m-sheet-backdrop" onClick={() => setSheetOpen(false)} />
          <div className="m-sheet" aria-modal="true" role="dialog"
            aria-label="Pipeline stages" ref={sheetRef}>
            <div className="m-sheet-handle" />
            <div className="m-sheet-head">
              <span className="m-sheet-title">Pipeline</span>
              <button className="m-iconbtn" onClick={() => setSheetOpen(false)} aria-label="Close pipeline">
                <MIcon name="close" size={20} />
              </button>
            </div>
            <div className="m-sheet-body">
              <div className="vrail">
                {LINEAR_STAGES.map((s, i) => {
                  const passed = i < currentStageIdx;
                  const current = i === currentStageIdx;
                  const previewing = i === previewIdx;
                  const cls = [
                    passed ? 'is-passed' : current ? 'is-current' : '',
                    previewing && !current ? 'is-previewing' : '',
                  ].filter(Boolean).join(' ');
                  const sp2 = stageProgress?.[s.id];
                  return (
                    <React.Fragment key={s.id}>
                      <div className={`vstep${cls ? ' ' + cls : ''}`}
                        onClick={() => { setPreviewIdx(i); setSheetOpen(false); }}
                        role="button" tabIndex={0}
                        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { setPreviewIdx(i); setSheetOpen(false); } }}>
                        <div className="vnode" />
                        <div className="vname">{s.label}</div>
                        <div className="vsub">
                          {sp2 ? `${sp2.completed}/${sp2.total}` : ''}
                          {current ? ' · in progress' : passed ? ' · done' : ''}
                          {previewing && !current ? ' · previewing' : ''}
                        </div>
                      </div>
                      {current && stageSubstages.length > 0 && (
                        <div className="vsubs">
                          {stageSubstages.map(ss => {
                            const done = isSubDone(currentStage.id, ss.id);
                            const active = ss.id === activeSub;
                            return (
                              <div key={ss.id}
                                role="button" tabIndex={0}
                                onClick={(e) => { e.stopPropagation(); setActiveSub(ss.id); setPreviewIdx(currentStageIdx); setSheetOpen(false); }}
                                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); setActiveSub(ss.id); setPreviewIdx(currentStageIdx); setSheetOpen(false); } }}
                                className={`vsub${active ? ' is-active' : ''}${done ? ' is-done' : ''}`}>
                                <MIcon name={done ? 'check_circle' : ss.icon} size={13}
                                  className={done ? 'check' : ''} fill={active} />
                                <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {ss.label}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </React.Fragment>
                  );
                })}
              </div>

              <div className="rail-divider"><span>End states</span></div>
              <div className="col" style={{ gap: 2 }}>
                {BRANCH_STAGES.map(b => (
                  <button key={b.id} className="end-state" onClick={() => askEndState(b)}>
                    <MIcon name={b.icon} size={14} />
                    <span style={{ flex: 1, textAlign: 'left' }}>{b.label}</span>
                    <MIcon name="arrow_outward" size={12} className="end-state-arrow" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── Confirm modal ── */}
      {confirm && <ConfirmModal config={confirm} onCancel={() => setConfirm(null)} />}

      {/* ── Document bottom sheet ── */}
      {docSheet && (
        <MobileDocSheet
          app={app}
          docType={docSheet}
          fetchWithAuth={fetchWithAuth}
          onUpdate={onUpdate}
          onClose={() => setDocSheet(null)}
        />
      )}

      {/* ── Job description sheet ── */}
      {jobDescOpen && <JobDescSheet app={app} onClose={() => setJobDescOpen(false)} />}

      {/* ── Logo picker sheet ── */}
      {showLogoPicker && (
        <MobileLogoPickerSheet
          companyName={app?.company}
          onSelect={handleLogoSelect}
          onClose={() => setShowLogoPicker(false)}
        />
      )}

    </div>
  );
}
