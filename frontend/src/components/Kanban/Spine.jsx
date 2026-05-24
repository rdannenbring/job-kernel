import React from 'react';
import { STAGE_ICONS, getScoreTint } from './stages.js';

function Thumbnail({ app }) {
  const tint = getScoreTint(app.match_score);
  return (
    <div className="k-thumb" title={`${app.company} · ${app.job_title}`}>
      <div className="k-t-nm">{app.company || 'Unknown'}</div>
      <div className="k-t-meta">
        {app.match_score != null && (
          <>
            <span className="k-t-dot" style={{ background: tint.color }} />
            <span>{app.match_score}</span>
          </>
        )}
        {(app.interest_level === 'High' || app.interest_level === 'Medium') && (
          <span style={{ color: '#f59e0b', marginLeft: 2 }}>★</span>
        )}
      </div>
    </div>
  );
}

export default function Spine({
  stage,
  apps,
  isFocused,
  draggedOverCol,
  dragMoveType,  // 'fwd' | 'back' | 'end' | null
  onClick,
  onDragOver,
  onDrop,
  onDragLeave,
}) {
  const isInbox = stage === 'Inbox';
  const isEnd = false; // regular spines are never end-state
  const icon = STAGE_ICONS[stage] || 'circle';
  const MAX_THUMBS = 8;
  const visible = apps.slice(0, MAX_THUMBS);
  const overflow = Math.max(0, apps.length - MAX_THUMBS);

  let dropCls = '';
  if (draggedOverCol === stage) {
    if (dragMoveType === 'fwd')  dropCls = 'is-drop-fwd';
    if (dragMoveType === 'back') dropCls = 'is-drop-back';
    if (dragMoveType === 'end')  dropCls = 'is-drop-end';
  }

  return (
    <div
      className={`k-spine${isInbox ? ' is-pre' : ''}${isEnd ? ' is-end' : ''} ${dropCls}`}
      onClick={() => !isFocused && onClick(stage)}
      onDragOver={(e) => {
        if (isInbox) {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'none';
          return;
        }
        onDragOver(e, stage);
      }}
      onDrop={(e) => {
        if (isInbox) { e.preventDefault(); return; }
        onDrop(e, stage);
      }}
      onDragLeave={onDragLeave}
      style={{ cursor: isInbox ? 'default' : undefined }}
      title={isInbox ? 'Inbox — move cards out by dragging to a spine' : stage}
    >
      <div className="k-spine-head">
        <span className="material-symbols-outlined k-s-icon">{icon}</span>
        <div className="k-s-ct">{apps.length}</div>
        <div className="k-s-nm">{stage}</div>
      </div>
      <div className="k-spine-stack">
        {visible.map(app => (
          <Thumbnail key={app.id} app={app} />
        ))}
        {overflow > 0 && (
          <div className="k-spine-overflow">+{overflow}</div>
        )}
      </div>
    </div>
  );
}
