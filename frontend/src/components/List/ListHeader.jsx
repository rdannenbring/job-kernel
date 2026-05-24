import React from 'react';

export default function ListHeader({ cols, sortBy, sortDir, allSelected, someSelected, onSelectAll, onSort, floating = false }) {
  const visibleCols = cols.filter(c => c.visible !== false);

  return (
    <div
      className={`lthead${floating ? ' is-floating' : ''}`}
      style={{ gridTemplateColumns: visibleCols.map(c => c.id === 'hint' ? '1fr' : `${c.width}px`).join(' ') }}
    >
      {visibleCols.map(col => {
        const sorted = col.id === sortBy;
        if (col.id === 'check') {
          return (
            <div key={col.id} className="lth lcheck">
              <input
                type="checkbox"
                className={`lcb${someSelected && !allSelected ? ' is-indeterminate' : ''}`}
                checked={!!allSelected}
                onChange={onSelectAll}
                aria-label="Select all"
              />
            </div>
          );
        }
        return (
          <div
            key={col.id}
            className={`lth${sorted ? ' is-sorted' : ''}`}
            onClick={() => col.sortable !== false && onSort && onSort(col.id)}
            style={{ cursor: col.sortable === false ? 'default' : 'pointer' }}
          >
            <span>{col.label}</span>
            {col.sortable !== false && (
              <span className="sort-arrow">
                <span className="material-symbols-outlined" style={{ fontSize: 12 }}>
                  {sorted && sortDir === 'asc' ? 'arrow_upward' : 'arrow_downward'}
                </span>
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
