import React from 'react';
import { deriveStage, SUBSTAGE_COUNTS } from '../Kanban/stages.js';
import { deriveHint, deriveDocs } from './columns.js';
import ScoreMini from './ScoreMini.jsx';

function SubstageProgress({ stage, subProgress }) {
  const total = SUBSTAGE_COUNTS[stage] || 0;
  if (total === 0) return null;
  const items = Array.from({ length: total }, (_, i) => ({
    done: i < subProgress,
    label: `Step ${i + 1}`,
  }));
  return (
    <div className="l-col" style={{ gap: 6, marginTop: 4 }}>
      {items.map((item, i) => (
        <div key={i} className="l-row" style={{ fontSize: 12 }}>
          <span
            className="material-symbols-outlined"
            style={{
              fontSize: 13,
              color: item.done ? 'var(--success)' : 'var(--primary)',
              fontVariationSettings: item.done ? "'FILL' 1" : "'FILL' 0",
            }}
          >
            {item.done ? 'check_circle' : 'radio_button_unchecked'}
          </span>
          <span style={{ color: item.done ? 'var(--txt-mute)' : 'var(--txt-2)' }}>
            {item.label}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function PulseExpand({ app, avgScore, onViewApp }) {
  const stage      = deriveStage(app);
  const hint       = deriveHint(app);
  const rawProgress = app.substage_progress ?? app.pipeline_substage ?? 0;
  const subProgress = rawProgress !== null && typeof rawProgress === 'object'
    ? Object.values(rawProgress).filter(Boolean).length
    : (parseInt(rawProgress) || 0);
  const total      = SUBSTAGE_COUNTS[stage] || 0;
  const diff       = app.match_score != null && avgScore != null
    ? Math.round(app.match_score - avgScore) : null;

  return (
    <div className="lexpand">
      {/* Card 1 — Compatibility */}
      <div className="lex-card">
        <div className="lex-label">Compatibility</div>
        {app.match_score != null ? (
          <div className="l-row" style={{ gap: 12 }}>
            <ScoreMini score={app.match_score} size={48} />
            <div className="l-col" style={{ gap: 4 }}>
              <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--txt)' }}>
                {app.match_score >= 85 ? 'Excellent' : app.match_score >= 70 ? 'Good' : 'Fair'} match
              </span>
              {diff != null && (
                <span
                  style={{
                    fontSize: 11, fontWeight: 700,
                    color: diff >= 0 ? 'var(--success)' : 'var(--warn)',
                    display: 'flex', alignItems: 'center', gap: 2,
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 12 }}>
                    {diff >= 0 ? 'arrow_upward' : 'arrow_downward'}
                  </span>
                  {Math.abs(diff)} vs avg
                </span>
              )}
            </div>
          </div>
        ) : (
          <span style={{ fontSize: 12, color: 'var(--txt-mute)' }}>No analysis yet</span>
        )}
      </div>

      {/* Card 2 — Stage progress */}
      <div className="lex-card">
        <div className="lex-label">{stage} phase · {subProgress} of {total || '?'}</div>
        <SubstageProgress stage={stage} subProgress={subProgress} />
        {total === 0 && (
          <span style={{ fontSize: 12, color: 'var(--txt-mute)' }}>No substages for this stage</span>
        )}
      </div>

      {/* Card 3 — Next action */}
      <div className="lex-next-action">
        <div className="lex-next-head">
          <span className="material-symbols-outlined" style={{ fontSize: 12, fontVariationSettings: "'FILL' 1" }}>bolt</span>
          Next action
        </div>
        <div className="lex-next-title">{hint}</div>
        <div className="lex-next-body">
          {app.job_title && app.company
            ? `${app.job_title} at ${app.company}`
            : 'Review your application pipeline for this role.'}
        </div>
        <div className="lex-actions">
          <button className="lex-btn is-primary" onClick={e => { e.stopPropagation(); onViewApp(app); }}>
            <span className="material-symbols-outlined" style={{ fontSize: 13 }}>open_in_new</span>
            Open
          </button>
          <button className="lex-btn is-ghost" style={{ marginLeft: 'auto' }}>
            <span className="material-symbols-outlined" style={{ fontSize: 13 }}>close</span>
          </button>
        </div>
      </div>
    </div>
  );
}
