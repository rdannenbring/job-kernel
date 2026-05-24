import React, { useState, useRef, useEffect } from 'react';
import { KANBAN_COLUMNS, STAGE_ICONS } from '../Kanban/stages.js';

export default function BulkBar({ count, onMoveAll, onClear }) {
  const [moveOpen, setMoveOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const handle = (e) => { if (e.key === 'Escape') onClear(); };
    document.addEventListener('keydown', handle);
    return () => document.removeEventListener('keydown', handle);
  }, [onClear]);

  useEffect(() => {
    if (!moveOpen) return;
    const handle = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setMoveOpen(false); };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [moveOpen]);

  return (
    <div className="lbulk">
      <span className="lbulk-count">
        <span className="n">{count}</span> selected
      </span>

      <div style={{ position: 'relative' }} ref={menuRef}>
        <button className="lbulk-btn" onClick={() => setMoveOpen(o => !o)}>
          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>swap_horiz</span>
          Move stage
        </button>
        {moveOpen && (
          <div
            className="l-popover"
            style={{ bottom: 'calc(100% + 6px)', left: 0, top: 'auto', minWidth: 180 }}
          >
            <div className="l-popover-label">Move to</div>
            {KANBAN_COLUMNS.slice(1).map(s => (
              <div
                key={s}
                className="l-popover-item"
                onClick={() => { onMoveAll(s); setMoveOpen(false); }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>{STAGE_ICONS[s]}</span>
                {s}
              </div>
            ))}
          </div>
        )}
      </div>

      <button className="lbulk-btn">
        <span className="material-symbols-outlined" style={{ fontSize: 14 }}>local_offer</span>
        Add tag
      </button>
      <button className="lbulk-btn">
        <span className="material-symbols-outlined" style={{ fontSize: 14 }}>archive</span>
        Archive
      </button>
      <button className="lbulk-btn">
        <span className="material-symbols-outlined" style={{ fontSize: 14 }}>file_download</span>
        Export
      </button>

      <span className="lbulk-div" />
      <button className="lbulk-close" title="Clear selection" onClick={onClear}>
        <span className="material-symbols-outlined" style={{ fontSize: 14 }}>close</span>
      </button>
    </div>
  );
}
