import React, { useRef, useEffect } from 'react';
import { KANBAN_COLUMNS, TERMINAL_COLUMNS, STAGE_ICONS, isBack, isTerminal, deriveStage } from '../Kanban/stages.js';

export default function StageEditPopover({ app, anchorRect, onSelect, onClose }) {
  const ref = useRef(null);
  const currentStage = deriveStage(app);

  useEffect(() => {
    const handle = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [onClose]);

  // Position near anchor if provided
  const style = anchorRect
    ? { position: 'fixed', top: anchorRect.bottom + 4, left: anchorRect.left, zIndex: 200 }
    : { position: 'absolute', top: 40, left: 280, zIndex: 200 };

  return (
    <div className="l-popover" ref={ref} style={style}>
      <div className="l-popover-label">Move to stage</div>
      {KANBAN_COLUMNS.slice(1).map(s => (
        <div
          key={s}
          className={`l-popover-item${s === currentStage ? ' is-current' : ''}${isBack(currentStage, s) ? '' : ''}`}
          onClick={() => onSelect(s)}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>{STAGE_ICONS[s]}</span>
          <span style={{ flex: 1 }}>{s}</span>
          {s === currentStage && (
            <span style={{ fontSize: 10, color: 'var(--txt-dim)', fontWeight: 700 }}>Current</span>
          )}
          {isBack(currentStage, s) && (
            <span style={{ fontSize: 10, color: 'var(--warn)', fontWeight: 700 }}>Back</span>
          )}
        </div>
      ))}
      <div className="l-popover-divider" />
      <div className="l-popover-label">End state</div>
      {TERMINAL_COLUMNS.map(s => (
        <div
          key={s}
          className="l-popover-item is-danger"
          onClick={() => onSelect(s)}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>{STAGE_ICONS[s]}</span>
          <span style={{ flex: 1 }}>{s}</span>
        </div>
      ))}
    </div>
  );
}
