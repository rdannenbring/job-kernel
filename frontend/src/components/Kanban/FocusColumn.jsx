import React from 'react';
import { STAGE_ICONS } from './stages.js';
import Card from './Card.jsx';
import EmptyState from './EmptyState.jsx';

export default function FocusColumn({
  stage,
  apps,
  density,
  draggedOverCol,
  dragMoveType,
  dropPlaceholder,
  draggedAppId,
  selectedIds,
  onViewApp,
  onSelect,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
  onCardDragOver,
  onDragLeave,
}) {
  const isInbox = stage === 'Inbox';
  const icon = STAGE_ICONS[stage] || 'circle';

  let dropCls = '';
  if (draggedOverCol === stage) {
    if (dragMoveType === 'fwd')  dropCls = 'is-drop-fwd';
    if (dragMoveType === 'back') dropCls = 'is-drop-back';
    if (dragMoveType === 'end')  dropCls = 'is-drop-end';
  }

  return (
    <div className={`k-focus-col${isInbox ? ' is-pre' : ''} ${dropCls}`}>
      <div className="k-focus-head">
        <div className="k-focus-icon">
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>{icon}</span>
        </div>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <h3>{stage}</h3>
            {isInbox && <span className="k-sub-label is-warn">Triage</span>}
          </div>
          <div className="k-fh-sub">
            {isInbox
              ? `${apps.length} new capture${apps.length !== 1 ? 's' : ''} · awaiting triage`
              : `${apps.length} application${apps.length !== 1 ? 's' : ''} · focused stage`
            }
          </div>
        </div>
        <div className="k-fh-hint">
          <span className="material-symbols-outlined" style={{ color: isInbox ? 'var(--warning)' : 'var(--primary)' }}>bolt</span>
          {isInbox ? 'Run analysis, then move to Saved' : 'Drag cards to the spines to move stage'}
        </div>
      </div>

      <div
        className="k-focus-grid"
        onDragOver={(e) => onDragOver(e, stage)}
        onDrop={(e) => onDrop(e, stage)}
        onDragLeave={onDragLeave}
      >
        {apps.length === 0 && <EmptyState stage={stage} />}
        {apps.map((app, index) => {
          const isDragging = app.id === draggedAppId;
          return (
            <React.Fragment key={app.id}>
              {dropPlaceholder.column === stage && dropPlaceholder.index === index && (
                <div className="k-drop-placeholder">
                  <span className="k-drop-placeholder-label">Drop here</span>
                </div>
              )}
              <div
                draggable
                onDragStart={(e) => onDragStart(e, app.id)}
                onDragEnd={onDragEnd}
                onDragOver={(e) => onCardDragOver(e, stage, index)}
                onDrop={(e) => { e.preventDefault(); e.stopPropagation(); onDrop(e, stage); }}
              >
                <Card
                  app={app}
                  stage={stage}
                  density={density}
                  isSelected={selectedIds.has(app.id)}
                  isDragging={isDragging}
                  onClick={onViewApp}
                  onSelect={onSelect}
                />
              </div>
            </React.Fragment>
          );
        })}
        {dropPlaceholder.column === stage && dropPlaceholder.index === apps.length && apps.length > 0 && (
          <div className="k-drop-placeholder">
            <span className="k-drop-placeholder-label">Drop here</span>
          </div>
        )}
      </div>
    </div>
  );
}
