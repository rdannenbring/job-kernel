import React from 'react';

const DOC_ICONS = {
  resume: 'description',
  cover:  'mail',
  ctx:    'folder',
};

export function DocsCondensed({ docs }) {
  return (
    <span className="ldocs">
      {Object.entries(DOC_ICONS).map(([key, icon]) => {
        const state = docs?.[key] || 'missing';
        return (
          <span key={key} className={`ldoc-dot s-${state}`} title={`${key}: ${state}`}>
            <span className="material-symbols-outlined" style={{ fontSize: 12 }}>{icon}</span>
          </span>
        );
      })}
    </span>
  );
}

export function DocsTextForward({ docs }) {
  const entries = Object.values(docs || {});
  const ok    = entries.filter(v => v === 'ok').length;
  const total = 3;
  const needs = total - ok;

  if (needs === 0) {
    return (
      <span className="ldoc-summary" style={{ color: 'var(--success)' }}>
        <span className="material-symbols-outlined" style={{ fontSize: 13, fontVariationSettings: "'FILL' 1" }}>check_circle</span>
        All ready
      </span>
    );
  }
  const hasRed = (docs?.resume === 'missing' || docs?.cover === 'missing');
  return (
    <span className="ldoc-summary">
      <span style={{ color: 'var(--success)' }}>{ok} ok</span>
      <span className="ldoc-gap" />
      <span style={{ color: hasRed ? 'var(--danger)' : 'var(--warn)' }}>{needs} todo</span>
    </span>
  );
}
