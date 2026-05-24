import React, { useRef, useEffect } from 'react';
import { GROUPINGS } from './useGrouping.js';

export default function GroupByMenu({ groupBy, onSelect, onClose }) {
  const ref = useRef(null);

  useEffect(() => {
    const handle = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [onClose]);

  return (
    <div className="l-popover" ref={ref} style={{ top: 'calc(100% + 6px)', right: 0, minWidth: 240, zIndex: 60 }}>
      <div className="l-popover-label">Group by</div>
      {GROUPINGS.map(g => (
        <div
          key={g.id}
          className={`l-popover-item${g.id === groupBy ? ' is-active' : ''}`}
          onClick={() => { onSelect(g.id); onClose(); }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>{g.icon}</span>
          <span style={{ flex: 1 }}>{g.label}</span>
          {g.id === groupBy && (
            <span className="material-symbols-outlined" style={{ fontSize: 14, color: 'var(--primary)' }}>check</span>
          )}
        </div>
      ))}
    </div>
  );
}
