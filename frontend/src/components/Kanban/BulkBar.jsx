import React, { useState, useEffect, useRef } from 'react';
import { KANBAN_COLUMNS, STAGE_ICONS } from './stages.js';

export default function BulkBar({ count, onMoveAll, onMarkRejected, onClear }) {
  const [moveOpen, setMoveOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const handleKey = (e) => { if (e.key === 'Escape') onClear(); };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClear]);

  useEffect(() => {
    if (!moveOpen) return;
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMoveOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [moveOpen]);

  return (
    <div className="k-bulk">
      <span className="k-bulk-ct">{count} selected</span>
      <div className="k-bulk-div" />

      <div style={{ position: 'relative' }} ref={menuRef}>
        <button className="k-bulk-btn" onClick={() => setMoveOpen(o => !o)}>
          <span className="material-symbols-outlined">arrow_forward</span>
          Move to…
        </button>
        {moveOpen && (
          <div className="k-move-menu">
            {KANBAN_COLUMNS.filter(s => s !== 'Inbox').map(s => (
              <button
                key={s}
                className="k-move-item"
                onClick={() => { onMoveAll(s); setMoveOpen(false); }}
              >
                <span className="material-symbols-outlined">{STAGE_ICONS[s]}</span>
                {s}
              </button>
            ))}
          </div>
        )}
      </div>

      <button className="k-bulk-btn is-danger" onClick={onMarkRejected}>
        <span className="material-symbols-outlined">block</span>
        Mark rejected
      </button>

      <div className="k-bulk-div" />
      <button className="k-bulk-close" onClick={onClear} title="Clear selection">
        <span className="material-symbols-outlined">close</span>
      </button>
    </div>
  );
}
