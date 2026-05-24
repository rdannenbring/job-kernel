import React from 'react';

export default function EmptyState({ filterLabel, onClearFilters, onAddJob }) {
  return (
    <div className="lempty">
      <div className="lempty-icon">
        <span className="material-symbols-outlined" style={{ fontSize: 28 }}>
          {filterLabel ? 'filter_alt_off' : 'inbox'}
        </span>
      </div>
      <h3>
        {filterLabel ? 'No applications match these filters' : 'No applications yet'}
      </h3>
      <p>
        {filterLabel
          ? `You're filtering by "${filterLabel}" and nothing shows up. Clear the filter to see your full pipeline.`
          : 'Capture your first job posting with the extension, or add one manually.'}
      </p>
      <div className="lempty-actions">
        {filterLabel && onClearFilters && (
          <button
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '6px 14px', borderRadius: 8,
              background: 'transparent', border: '1px solid var(--line)',
              font: 'inherit', fontSize: 13, fontWeight: 600, cursor: 'pointer',
              color: 'var(--txt-2)',
            }}
            onClick={onClearFilters}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>filter_alt_off</span>
            Clear filters
          </button>
        )}
        {onAddJob && (
          <button
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '6px 14px', borderRadius: 8,
              background: 'var(--primary)', border: '1px solid var(--primary)',
              font: 'inherit', fontSize: 13, fontWeight: 600, cursor: 'pointer',
              color: 'white',
            }}
            onClick={onAddJob}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>add</span>
            Add a job manually
          </button>
        )}
      </div>
    </div>
  );
}
