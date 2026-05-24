import React from 'react';

export default function ErrorState({ onRetry }) {
  return (
    <div className="lempty is-error">
      <div className="lempty-icon">
        <span className="material-symbols-outlined" style={{ fontSize: 28 }}>cloud_off</span>
      </div>
      <h3>Couldn't load your applications</h3>
      <p>
        Lost connection to the API. Your local changes are saved — they'll sync when you're back online.
      </p>
      <div className="lempty-actions">
        <button
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '6px 14px', borderRadius: 8,
            background: 'transparent', border: '1px solid var(--line)',
            font: 'inherit', fontSize: 13, fontWeight: 600, cursor: 'pointer',
            color: 'var(--txt-2)',
          }}
          onClick={onRetry}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>refresh</span>
          Retry
        </button>
        <button
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '6px 14px', borderRadius: 8,
            background: 'transparent', border: '1px solid var(--line)',
            font: 'inherit', fontSize: 13, fontWeight: 600, cursor: 'pointer',
            color: 'var(--txt-2)',
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>cloud_done</span>
          Work offline
        </button>
      </div>
    </div>
  );
}
