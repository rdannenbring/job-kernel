import React from 'react';
import { TERMINAL_COLUMNS, STAGE_ICONS } from './stages.js';
import Card from './Card.jsx';

export default function EndStateFocus({
  activeTerminal,
  appsByTerminal,
  density,
  selectedIds,
  draggedAppId,
  draggedOverCol,
  dropPlaceholder,
  onViewApp,
  onSelect,
  onSetTerminal,
  onClose,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
  onCardDragOver,
  onDragLeave,
}) {
  const apps = appsByTerminal[activeTerminal] || [];
  const total = TERMINAL_COLUMNS.reduce((n, s) => n + (appsByTerminal[s] || []).length, 0);
  const isDropTarget = draggedOverCol === activeTerminal || draggedOverCol === '__end__';

  return (
    <div className={`k-focus-col is-end${isDropTarget ? ' is-drop-end' : ''}`}>
      <div className="k-focus-head">
        <div className="k-focus-icon">
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>{STAGE_ICONS[activeTerminal]}</span>
        </div>
        <div style={{ flex: 0, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <h3>End states</h3>
            <span className="k-sub-label is-end">Closed</span>
          </div>
          <div className="k-fh-sub">
            {total} closed application{total !== 1 ? 's' : ''} · archive
          </div>
        </div>

        <div className="k-end-tabs">
          {TERMINAL_COLUMNS.map(s => (
            <button
              key={s}
              className={`k-end-tab${activeTerminal === s ? ' is-active' : ''}`}
              onClick={() => onSetTerminal(s)}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 12 }}>{STAGE_ICONS[s]}</span>
              {s}
              <span className="k-tab-pip">{(appsByTerminal[s] || []).length}</span>
            </button>
          ))}
          <button
            className="k-end-close"
            onClick={onClose}
            title="Return to Inbox"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 15 }}>close</span>
          </button>
        </div>
      </div>

      <div
        className="k-focus-grid"
        onDragOver={(e) => onDragOver(e, activeTerminal)}
        onDrop={(e) => onDrop(e, activeTerminal)}
        onDragLeave={onDragLeave}
      >
        {apps.length === 0 && (
          <div className="k-empty" style={{ gridColumn: '1 / -1' }}>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', padding: '20px 0' }}>
              No applications marked {activeTerminal.toLowerCase()}.
            </div>
          </div>
        )}
        {apps.map((app, index) => {
          const isDragging = app.id === draggedAppId;
          return (
            <React.Fragment key={app.id}>
              {dropPlaceholder.column === activeTerminal && dropPlaceholder.index === index && (
                <div className="k-drop-placeholder">
                  <span className="k-drop-placeholder-label">Drop here</span>
                </div>
              )}
              <div
                draggable
                onDragStart={(e) => onDragStart(e, app.id)}
                onDragEnd={onDragEnd}
                onDragOver={(e) => onCardDragOver(e, activeTerminal, index)}
                onDrop={(e) => { e.preventDefault(); e.stopPropagation(); onDrop(e, activeTerminal); }}
              >
                <Card
                  app={app}
                  stage={activeTerminal}
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
      </div>
    </div>
  );
}
