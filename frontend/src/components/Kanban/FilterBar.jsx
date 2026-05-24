import React, { useState, useRef, useEffect } from 'react';

const SORT_OPTIONS = [
  { id: 'last_activity', label: 'Last activity' },
  { id: 'newest',        label: 'Newest first' },
  { id: 'oldest',        label: 'Oldest first' },
  { id: 'score_desc',    label: 'Score: High → Low' },
  { id: 'score_asc',     label: 'Score: Low → High' },
  { id: 'company_asc',   label: 'Company (A-Z)' },
  { id: 'company_desc',  label: 'Company (Z-A)' },
  { id: 'interest_desc', label: 'Interest Level' },
  { id: 'priority_desc', label: 'Priority Score' },
  { id: 'custom',        label: 'Custom order' },
];

export default function FilterBar({
  totalCount,
  filteredCount,
  searchTerm, setSearchTerm,
  sortBy, setSortBy,
  density, setDensity,
  filterMinScore, setFilterMinScore,
  filterHasConnections, setFilterHasConnections,
  onClearAll,
}) {
  const [sortOpen, setSortOpen] = useState(false);
  const sortRef = useRef(null);

  useEffect(() => {
    if (!sortOpen) return;
    const handleOut = (e) => { if (sortRef.current && !sortRef.current.contains(e.target)) setSortOpen(false); };
    document.addEventListener('mousedown', handleOut);
    return () => document.removeEventListener('mousedown', handleOut);
  }, [sortOpen]);

  const currentSort = SORT_OPTIONS.find(o => o.id === sortBy) || SORT_OPTIONS[0];
  const hasFilters = !!searchTerm || filterMinScore !== null || filterHasConnections;
  const isFiltered = filteredCount !== null && filteredCount !== totalCount;

  return (
    <div className="k-filter-bar">
      {/* Search */}
      <div className="k-search-wrap">
        <span className="material-symbols-outlined">search</span>
        <input
          placeholder={`Search ${totalCount} applications…`}
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
        />
        {searchTerm && (
          <button
            onClick={() => setSearchTerm('')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'grid', placeItems: 'center', color: 'var(--text-muted)' }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>close</span>
          </button>
        )}
        {!searchTerm && <span className="k-kbd">⌘K</span>}
      </div>

      {/* Score filter chip */}
      <button
        className={`k-fchip${filterMinScore !== null ? ' is-active' : ''}`}
        onClick={() => setFilterMinScore(filterMinScore === null ? 70 : null)}
        title="Filter by match score ≥ 70"
      >
        <span className="material-symbols-outlined">analytics</span>
        <span>Score{filterMinScore !== null ? ` · ≥${filterMinScore}` : ''}</span>
        {filterMinScore !== null && (
          <span
            className="material-symbols-outlined"
            style={{ fontSize: 12 }}
            onClick={e => { e.stopPropagation(); setFilterMinScore(null); }}
          >close</span>
        )}
      </button>

      {/* Connections chip */}
      <button
        className={`k-fchip${filterHasConnections ? ' is-active' : ''}`}
        onClick={() => setFilterHasConnections(!filterHasConnections)}
        title="Show only companies with LinkedIn connections"
      >
        <span className="material-symbols-outlined">group</span>
        <span>Connections</span>
        {filterHasConnections && (
          <span
            className="material-symbols-outlined"
            style={{ fontSize: 12 }}
            onClick={e => { e.stopPropagation(); setFilterHasConnections(false); }}
          >close</span>
        )}
      </button>

      <div className="k-bar-spacer" />

      {/* Filter count */}
      {isFiltered && (
        <span className="k-fclear">
          <b>{filteredCount}</b> of {totalCount} ·{' '}
          <u style={{ cursor: 'pointer' }} onClick={onClearAll}>clear</u>
        </span>
      )}

      {/* Sort */}
      <div style={{ position: 'relative' }} ref={sortRef}>
        <button className="k-sort-btn" onClick={() => setSortOpen(o => !o)}>
          <span className="material-symbols-outlined">swap_vert</span>
          Sort · {currentSort.label}
        </button>
        {sortOpen && (
          <div className="k-sort-menu">
            {SORT_OPTIONS.map(opt => (
              <button
                key={opt.id}
                className={`k-sort-item${sortBy === opt.id ? ' is-active' : ''}`}
                onClick={() => { setSortBy(opt.id); setSortOpen(false); }}
              >
                <span>{opt.label}</span>
                {sortBy === opt.id && <span className="material-symbols-outlined">check</span>}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Density toggle */}
      <div className="k-density-toggle" title="Card density">
        {[
          { id: 'compact', icon: 'density_small' },
          { id: 'comfy',   icon: 'density_medium' },
          { id: 'cozy',    icon: 'density_large' },
        ].map(d => (
          <button
            key={d.id}
            className={density === d.id ? 'is-active' : ''}
            title={d.id}
            onClick={() => setDensity(d.id)}
          >
            <span className="material-symbols-outlined">{d.icon}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
