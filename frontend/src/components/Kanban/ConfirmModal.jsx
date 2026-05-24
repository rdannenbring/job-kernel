import React from 'react';

export default function ConfirmModal({ kind, fromStage, toStage, app, count, onConfirm, onCancel }) {
  const isDanger = kind === 'end';
  const appCount = count || 1;
  const plural = appCount > 1;

  const title = isDanger
    ? plural
      ? `Mark ${appCount} applications as ${toStage}?`
      : `Mark this application as ${toStage}?`
    : 'Move pipeline back?';

  const body = isDanger
    ? `This is an end state — the card${plural ? 's' : ''} will leave the active pipeline. You can still find ${plural ? 'them' : 'it'} in the ${toStage} archive.`
    : `Moving from ${fromStage} back to ${toStage} will reset substage progress for any stages between them.`;

  return (
    <div className="k-overlay" onClick={onCancel}>
      <div className="k-modal" onClick={e => e.stopPropagation()}>
        <div className="k-modal-head">
          <div className={`k-modal-icon ${isDanger ? 'is-danger' : 'is-warn'}`}>
            <span className="material-symbols-outlined">{isDanger ? 'block' : 'arrow_back'}</span>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h3>{title}</h3>
            <p>{body}</p>
          </div>
        </div>

        <div className="k-modal-body">
          <div className="k-modal-summary">
            <div className="k-ms-from">
              <span className="k-ms-lbl">From</span>
              <span className="k-ms-val">{fromStage}</span>
            </div>
            <span className="material-symbols-outlined">arrow_forward</span>
            <div className="k-ms-to">
              <span className="k-ms-lbl">To</span>
              <span className={`k-ms-val ${isDanger ? 'is-danger' : 'is-warn'}`}>{toStage}</span>
            </div>
          </div>
          {app && (
            <div className="k-modal-card">
              <div className="kc-logo" style={{ width: 24, height: 24, fontSize: 9 }}>
                {(app.company || '?')[0].toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)' }}>{app.company}</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{app.job_title}</div>
              </div>
            </div>
          )}
        </div>

        <div className="k-modal-foot">
          <button className="k-modal-btn" onClick={onCancel}>Cancel</button>
          <button className={`k-modal-btn ${isDanger ? 'is-danger' : 'is-primary'}`} onClick={onConfirm}>
            {isDanger ? `Yes, mark as ${toStage}` : 'Move back'}
          </button>
        </div>
      </div>
    </div>
  );
}
