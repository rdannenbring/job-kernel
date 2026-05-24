import React from 'react';
import { TERMINAL_COLUMNS, STAGE_ICONS } from './stages.js';

export default function EndStateSpine({
  appsByTerminal,
  draggedOverCol,
  onClickStage,
  onDragOver,
  onDrop,
  onDragLeave,
}) {
  const total = TERMINAL_COLUMNS.reduce((n, s) => n + (appsByTerminal[s] || []).length, 0);
  const isDropTarget = TERMINAL_COLUMNS.some(s => draggedOverCol === s) || draggedOverCol === '__end__';

  return (
    <div
      className={`k-spine is-end${isDropTarget ? ' is-drop-end' : ''}`}
      style={{ width: 96, cursor: 'pointer' }}
      onClick={() => onClickStage('Rejected')}
      onDragOver={(e) => onDragOver(e, '__end__')}
      onDrop={(e) => onDrop(e, 'Rejected')}
      onDragLeave={onDragLeave}
      title="End states — Rejected, Declined, Withdrawn"
    >
      <div className="k-spine-head">
        <span className="material-symbols-outlined k-s-icon">alt_route</span>
        <div className="k-s-ct">{total}</div>
        <div className="k-s-nm">End states</div>
      </div>
      <div className="k-spine-stack">
        {TERMINAL_COLUMNS.map(s => (
          <button
            key={s}
            className="k-end-tile"
            onClick={(e) => { e.stopPropagation(); onClickStage(s); }}
          >
            <span className="material-symbols-outlined k-et-icon">{STAGE_ICONS[s]}</span>
            <span className="k-et-ct">{(appsByTerminal[s] || []).length}</span>
            <span className="k-et-nm">{s.slice(0, 4)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
