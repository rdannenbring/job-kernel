import React from 'react';
import { SUBSTAGE_COUNTS, getScoreTint } from './stages.js';
import InterestStars from '../InterestStars.jsx';

// Derive doc status from app fields
function getDocStatus(app) {
  return {
    resume:  app.resume_changes_summary ? 'ok' : app.match_score != null ? 'attention' : 'missing',
    cover:   app.cover_letter_changes_summary ? 'ok' : app.match_score != null ? 'attention' : 'missing',
    ctx:     (app.job_description && app.job_description.length > 100) ? 'ok' : 'missing',
  };
}

function DocDots({ app }) {
  const docs = getDocStatus(app);
  const items = [
    { id: 'resume', icon: 'description', label: 'Resume' },
    { id: 'cover',  icon: 'mail',        label: 'Cover letter' },
    { id: 'ctx',    icon: 'folder',      label: 'Context' },
  ];
  return (
    <div className="kc-docs">
      {items.map(m => (
        <span key={m.id} className={`kc-doc-dot is-${docs[m.id]}`} title={`${m.label} · ${docs[m.id]}`}>
          {m.icon}
        </span>
      ))}
    </div>
  );
}

function SubstageDots({ stage, sub }) {
  const total = SUBSTAGE_COUNTS[stage] || 0;
  if (!total) return null;
  const dots = [];
  for (let i = 0; i < total; i++) {
    let cls = '';
    if (i < sub) cls = 'is-done';
    else if (i === sub) cls = 'is-current';
    dots.push(<span key={i} className={`kc-sub-dot ${cls}`} />);
  }
  return (
    <div className="kc-subs" title={`${sub}/${total} substages complete`}>
      {dots}
      <span className="kc-sub-label">{sub}/{total}</span>
    </div>
  );
}

function SubstageBar({ stage, sub }) {
  const total = SUBSTAGE_COUNTS[stage] || 0;
  if (!total) return null;
  const segs = [];
  for (let i = 0; i < total; i++) {
    let cls = '';
    if (i < sub) cls = 'is-done';
    else if (i === sub) cls = 'is-current';
    segs.push(<i key={i} className={cls} />);
  }
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flex: 1 }}>
      <div className="kc-segbar">{segs}</div>
      <span className="kc-sub-label" style={{ marginLeft: 0 }}>{sub}/{total}</span>
    </div>
  );
}

function CompanyLogo({ app }) {
  const [imgError, setImgError] = React.useState(false);
  const initial = (app.company || '?')[0].toUpperCase();
  return (
    <div className="kc-logo">
      {app.company_logo && !imgError
        ? <img src={app.company_logo} alt={app.company} onError={() => setImgError(true)} />
        : <span style={{ fontSize: 11, fontWeight: 800 }}>{initial}</span>
      }
    </div>
  );
}

function ScoreChip({ score }) {
  if (score == null) return null;
  const tint = getScoreTint(score);
  return <span className={`kc-score-chip ${tint.cls}`}>{score}</span>;
}

// ── Standard card (comfy density) ──
function CardStandard({ app, stage, isSelected, isDragging, onClick, onSelect }) {
  // TODO: use app.sub_stage_index when the data model exposes it
  const sub = app.sub_stage_index ?? 0;
  const salary = app.salary_range;
  const isUnlisted = !salary || salary === '—' || salary === 'Not Listed';

  return (
    <div
      className={`kc${isSelected ? ' is-selected' : ''}${isDragging ? ' is-dragging' : ''}`}
      draggable
      onClick={(e) => onSelect ? onSelect(app.id, e) : onClick && onClick(app)}
      onDoubleClick={() => onClick && onClick(app)}
    >
      <div className="kc-row">
        <CompanyLogo app={app} />
        <span className="kc-co">{app.company || 'Unknown'}</span>
        <ScoreChip score={app.match_score} />
      </div>
      <div className="kc-title">{app.job_title || 'Unknown Role'}</div>
      <div className="kc-meta">
        <span className={`kc-salary${isUnlisted ? ' is-unlisted' : ''}`}>
          {!isUnlisted && <span className="material-symbols-outlined">payments</span>}
          {isUnlisted ? 'Not listed' : salary}
        </span>
        <span className="k-sep">·</span>
        <InterestStars level={app.interest_level} size="0.9rem" />
      </div>
      <div className="kc-row" style={{ justifyContent: 'space-between' }}>
        <SubstageDots stage={stage} sub={sub} />
        <DocDots app={app} />
      </div>
      {app.next_action && (
        <div className="kc-hint">
          <span className="material-symbols-outlined">bolt</span>
          <span className="kc-hint-text">{app.next_action}</span>
        </div>
      )}
    </div>
  );
}

// ── Score-forward card (cozy density) ──
function CardCozy({ app, stage, isSelected, isDragging, onClick, onSelect }) {
  const sub = app.sub_stage_index ?? 0;
  const salary = app.salary_range;
  const isUnlisted = !salary || salary === '—' || salary === 'Not Listed';

  return (
    <div
      className={`kc${isSelected ? ' is-selected' : ''}${isDragging ? ' is-dragging' : ''}`}
      draggable
      onClick={(e) => onSelect ? onSelect(app.id, e) : onClick && onClick(app)}
      onDoubleClick={() => onClick && onClick(app)}
    >
      <div className="kc-row" style={{ alignItems: 'flex-start', gap: 10 }}>
        <CompanyLogo app={app} />
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span className="kc-co">{app.company || 'Unknown'}</span>
          <div className="kc-title">{app.job_title || 'Unknown Role'}</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
          <ScoreChip score={app.match_score} />
          <InterestStars level={app.interest_level} size="0.8rem" />
        </div>
      </div>
      <div className="kc-meta">
        <span className={`kc-salary${isUnlisted ? ' is-unlisted' : ''}`}>
          {!isUnlisted && <span className="material-symbols-outlined">payments</span>}
          {isUnlisted ? 'Not listed' : salary}
        </span>
      </div>
      <div className="kc-row" style={{ gap: 8 }}>
        <SubstageBar stage={stage} sub={sub} />
        <DocDots app={app} />
      </div>
      {app.next_action && (
        <div className="kc-hint">
          <span className="material-symbols-outlined">bolt</span>
          <span className="kc-hint-text">{app.next_action}</span>
        </div>
      )}
    </div>
  );
}

// ── Compact card (compact density) ──
function CardCompact({ app, stage, isSelected, isDragging, onClick, onSelect }) {
  const sub = app.sub_stage_index ?? 0;
  return (
    <div
      className={`kc kc-compact${isSelected ? ' is-selected' : ''}${isDragging ? ' is-dragging' : ''}`}
      draggable
      onClick={(e) => onSelect ? onSelect(app.id, e) : onClick && onClick(app)}
      onDoubleClick={() => onClick && onClick(app)}
    >
      <CompanyLogo app={app} />
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
        <div className="kc-title">{app.job_title || 'Unknown Role'}</div>
        <div className="kc-meta" style={{ gap: 5 }}>
          <span className="kc-co" style={{ textTransform: 'none', letterSpacing: 0, fontSize: 10 }}>{app.company}</span>
          <span className="k-sep">·</span>
          <SubstageDots stage={stage} sub={sub} />
        </div>
      </div>
      <InterestStars level={app.interest_level} size="0.75rem" />
      <ScoreChip score={app.match_score} />
    </div>
  );
}

export default function Card({ app, stage, density = 'comfy', isSelected, isDragging, onClick, onSelect }) {
  const props = { app, stage, isSelected, isDragging, onClick, onSelect };
  if (density === 'compact') return <CardCompact {...props} />;
  if (density === 'cozy')    return <CardCozy {...props} />;
  return <CardStandard {...props} />;
}
