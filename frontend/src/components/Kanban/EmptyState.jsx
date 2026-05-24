import React from 'react';
import { EMPTY_STATE_COPY } from './stages.js';

export default function EmptyState({ stage }) {
  const m = EMPTY_STATE_COPY[stage] || { icon: 'inbox', title: 'Empty', body: '', cta: null };
  return (
    <div className="k-empty">
      <div className="k-empty-icon">
        <span className="material-symbols-outlined">{m.icon}</span>
      </div>
      <div className="k-empty-title">{m.title}</div>
      <div className="k-empty-body">{m.body}</div>
      {m.cta && <button className="k-empty-cta">{m.cta} →</button>}
    </div>
  );
}
