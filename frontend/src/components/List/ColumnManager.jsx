import React, { useRef, useEffect } from 'react';
import { DEFAULT_COLUMNS } from './columns.js';

export default function ColumnManager({ cols, onChange, onClose }) {
  const ref = useRef(null);

  useEffect(() => {
    const handle = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [onClose]);

  const toggle = (id) => {
    onChange(cols.map(c => c.id === id ? { ...c, visible: !c.visible } : c));
  };

  const reset = () => {
    onChange(DEFAULT_COLUMNS.map(c => ({ ...c })));
    onClose();
  };

  return (
    <div
      className="l-popover"
      ref={ref}
      style={{ top: 'calc(100% + 6px)', right: 0, width: 240, zIndex: 60 }}
    >
      <div className="l-popover-label" style={{ padding: '4px 8px 6px' }}>Columns · toggle to show/hide</div>
      {cols.map(c => {
        const isOn = c.visible !== false;
        return (
          <div
            key={c.id}
            className={`cmgr-row${c.locked ? ' is-locked' : ''}${isOn ? ' is-on' : ''}`}
            onClick={() => !c.locked && toggle(c.id)}
          >
            <span className={`cmgr-grip${c.locked ? ' is-locked' : ''}`}>
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>drag_indicator</span>
            </span>
            <span className="cmgr-name">{c.label || '—'}</span>
            <span
              className="material-symbols-outlined cmgr-eye"
              style={{ fontVariationSettings: isOn ? "'FILL' 1" : "'FILL' 0" }}
            >
              {isOn ? 'visibility' : 'visibility_off'}
            </span>
          </div>
        );
      })}
      <div className="l-popover-divider" />
      <div className="l-row" style={{ padding: '4px 6px 2px' }}>
        <button
          style={{
            flex: 1, padding: '5px 8px', borderRadius: 6,
            background: 'transparent', border: '1px solid var(--line)',
            font: 'inherit', fontSize: 12, fontWeight: 600, cursor: 'pointer',
            color: 'var(--txt-2)',
          }}
          onClick={reset}
        >
          Reset to default
        </button>
        <button
          style={{
            flex: 1, padding: '5px 8px', borderRadius: 6,
            background: 'var(--primary)', border: '1px solid var(--primary)',
            font: 'inherit', fontSize: 12, fontWeight: 600, cursor: 'pointer',
            color: 'white',
          }}
          onClick={onClose}
        >
          Done
        </button>
      </div>
    </div>
  );
}
