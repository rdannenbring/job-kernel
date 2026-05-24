import React from 'react';
import { DEFAULT_COLUMNS } from './columns.js';

export default function LoadingState({ cols, density = 'comfy' }) {
  const activeCols = (cols || DEFAULT_COLUMNS).filter(c => c.visible !== false);
  const gridTemplate = activeCols.map(c => c.id === 'hint' ? '1fr' : `${c.width}px`).join(' ');

  return (
    <>
      {Array.from({ length: 9 }, (_, i) => (
        <div
          key={i}
          className={`lrow d-${density} is-skeleton`}
          style={{ gridTemplateColumns: gridTemplate, opacity: 1 - i * 0.08 }}
        >
          {activeCols.map(col => (
            <div key={col.id} className={`lcell${col.id === 'check' ? ' lcheck' : ''}`}>
              {col.id === 'check' && (
                <div className="skl" style={{ width: 14, height: 14, borderRadius: 3 }} />
              )}
              {col.id === 'company' && (
                <>
                  <div className="skl is-circ" style={{ width: 28, height: 28 }} />
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
                    <div className="skl" style={{ width: '60%' }} />
                    <div className="skl" style={{ width: '80%', height: 8 }} />
                  </div>
                </>
              )}
              {col.id === 'pipeline' && <div className="skl" style={{ width: '85%' }} />}
              {col.id === 'score'    && <div className="skl" style={{ width: 56, height: 22, borderRadius: 6 }} />}
              {col.id === 'salary'   && <div className="skl" style={{ width: 80 }} />}
              {col.id === 'stars'    && <div className="skl" style={{ width: 52 }} />}
              {col.id === 'docs'     && <div className="skl" style={{ width: 68 }} />}
              {col.id === 'loc'      && <div className="skl" style={{ width: 90 }} />}
              {col.id === 'posted'   && <div className="skl" style={{ width: 40 }} />}
              {col.id === 'hint'     && <div className="skl" style={{ width: 200 }} />}
            </div>
          ))}
        </div>
      ))}
    </>
  );
}
