import React, { useRef, useMemo, useState, useCallback } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { DEFAULT_COLUMNS, deriveHint } from './columns.js';
import { useListState } from './useListState.js';
import { useGrouping, GROUPINGS } from './useGrouping.js';
import { useKeyboardNav } from './useKeyboardNav.js';
import ListHeader from './ListHeader.jsx';
import ListRow from './ListRow.jsx';
import GroupBand from './GroupBand.jsx';
import PulseExpand from './PulseExpand.jsx';
import BulkBar from './BulkBar.jsx';
import StageEditPopover from './StageEditPopover.jsx';
import GroupByMenu from './GroupByMenu.jsx';
import ColumnManager from './ColumnManager.jsx';
import ShortcutsCheatsheet from './ShortcutsCheatsheet.jsx';
import EmptyState from './EmptyState.jsx';
import LoadingState from './LoadingState.jsx';
import ErrorState from './ErrorState.jsx';
import ConfirmModal from '../Kanban/ConfirmModal.jsx';
import { deriveStage, isBack, isTerminal } from '../Kanban/stages.js';
import './List.css';

const DENSITY_ICON = {
  compact: 'density_small',
  comfy:   'density_medium',
  relaxed: 'density_large',
};
const ROW_HEIGHTS = { compact: 36, comfy: 52, relaxed: 64 };
const BAND_H   = 36;
const EXPAND_H = 188;

export default function ListView({ apps = [], onViewApp, onUpdate, isLoading, isError, onRetry, onStartNew }) {
  const scrollRef   = useRef(null);
  const [scrolled,  setScrolled]   = useState(false);
  const [showGroupMenu, setShowGroupMenu] = useState(false);
  const [moveConfirm,   setMoveConfirm]  = useState(null);
  const [search,    setSearch]     = useState('');

  // Pre-filter apps by local search before handing to state
  const filteredApps = useMemo(() => {
    if (!search.trim()) return apps;
    const q = search.toLowerCase();
    return apps.filter(a =>
      (a.company   || '').toLowerCase().includes(q) ||
      (a.job_title || '').toLowerCase().includes(q) ||
      (a.location  || '').toLowerCase().includes(q)
    );
  }, [apps, search]);

  const {
    density, setDensity,
    groupBy, setGroupBy,
    sortBy, sortDir, toggleSort,
    hideClosed, setHideClosed,
    visibleCols, setVisibleCols,
    selectedIds, toggleSelect, selectAll, clearSelection,
    focusedIdx, setFocusedIdx,
    expandedId, toggleExpand,
    stagePopover, setStagePopover,
    showShortcuts, setShowShortcuts,
    showColMgr,   setShowColMgr,
    groupCollapsed, toggleGroupCollapse,
    sortedApps,
  } = useListState(filteredApps);

  // Column model
  const effectiveCols = visibleCols || DEFAULT_COLUMNS;

  // Avg score across all apps (not just filtered)
  const avgScore = useMemo(() => {
    const ws = apps.filter(a => a.match_score != null);
    return ws.length ? ws.reduce((s, a) => s + a.match_score, 0) / ws.length : null;
  }, [apps]);

  // Grouped & sorted data
  const groups = useGrouping(sortedApps, groupBy, hideClosed, deriveHint);

  // Flat virtual items: band? → rows → expand?
  const items = useMemo(() => {
    const flat = [];
    for (const group of groups) {
      if (groupBy !== 'flat') {
        flat.push({ type: 'band', group });
      }
      if (!groupCollapsed[group.id]) {
        for (const app of group.apps) {
          flat.push({ type: 'row', app });
          if (expandedId === app.id) flat.push({ type: 'expand', app });
        }
      }
    }
    return flat;
  }, [groups, groupBy, groupCollapsed, expandedId]);

  const flatRows = useMemo(() => items.filter(it => it.type === 'row').map(it => it.app), [items]);

  // Virtualizer
  const rowH = ROW_HEIGHTS[density] || 52;
  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: (i) => {
      const it = items[i];
      if (it.type === 'band')   return BAND_H;
      if (it.type === 'expand') return EXPAND_H;
      return rowH;
    },
    overscan: 8,
  });

  const onScroll = useCallback(() => {
    setScrolled((scrollRef.current?.scrollTop ?? 0) > 2);
  }, []);

  // Stage move flow.
  // Send `status` (the Title-Case KANBAN_COLUMNS value), not `pipeline_stage`.
  // The API uses a supplied pipeline_stage verbatim but *derives* the canonical
  // lowercase stage from status — so posting pipeline_stage here would store
  // "Applied" instead of "applied" and leave status stale. Kanban does the same.
  const handleStageSelect = useCallback((newStage) => {
    const { appId, anchorRect } = stagePopover || {};
    if (!appId) return;
    const app = apps.find(a => a.id === appId);
    setStagePopover(null);
    if (!app) return;

    const fromStage = deriveStage(app);
    if (isTerminal(newStage)) {
      setMoveConfirm({ app, fromStage, toStage: newStage, kind: 'end' });
    } else if (isBack(fromStage, newStage)) {
      setMoveConfirm({ app, fromStage, toStage: newStage, kind: 'back' });
    } else {
      onUpdate(app.id, { status: newStage });
    }
  }, [stagePopover, apps, onUpdate, setStagePopover]);

  const handleBulkMove = useCallback((newStage) => {
    selectedIds.forEach(id => onUpdate(id, { status: newStage }));
    clearSelection();
  }, [selectedIds, onUpdate, clearSelection]);

  // Keyboard navigation
  useKeyboardNav({
    rowCount: flatRows.length,
    focusedIdx,
    setFocusedIdx,
    flatRows,
    selectedIds,
    toggleSelect,
    expandedId,
    toggleExpand,
    setStagePopover,
    onViewApp,
    setShowShortcuts,
    selectAll,
    clearSelection,
    setPreset: null,
  });

  const stagePopoverApp = stagePopover ? apps.find(a => a.id === stagePopover.appId) : null;
  const activeGrouping  = GROUPINGS.find(g => g.id === groupBy) || GROUPINGS[0];

  return (
    <div className="jk-list">

      {/* ── Toolbar ── */}
      <div className="lbar">
        <div className="lbar-search">
          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>search</span>
          <input
            placeholder="Search companies, roles, location…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <button
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', color: 'var(--txt-dim)' }}
              onClick={() => setSearch('')}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>close</span>
            </button>
          )}
          {!search && <span className="lbar-kbd">/</span>}
        </div>

        <div className="lbar-divider" />
        <div className="lbar-spacer" />

        {/* Group by */}
        <div style={{ position: 'relative' }}>
          <button
            className={`fbtn${groupBy !== 'flat' ? ' has-value' : ''}`}
            onClick={() => setShowGroupMenu(v => !v)}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 13 }}>splitscreen</span>
            <span>{groupBy !== 'flat' ? activeGrouping.label.split(' · ')[0] : 'Group by'}</span>
            <span className="material-symbols-outlined" style={{ fontSize: 13 }}>expand_more</span>
          </button>
          {showGroupMenu && (
            <GroupByMenu groupBy={groupBy} onSelect={setGroupBy} onClose={() => setShowGroupMenu(false)} />
          )}
        </div>

        {/* Columns */}
        <div style={{ position: 'relative' }}>
          <button className="fbtn" onClick={() => setShowColMgr(v => !v)}>
            <span className="material-symbols-outlined" style={{ fontSize: 13 }}>view_column</span>
          </button>
          {showColMgr && (
            <ColumnManager cols={effectiveCols} onChange={setVisibleCols} onClose={() => setShowColMgr(false)} />
          )}
        </div>

        {/* Hide closed toggle */}
        <button
          className={`fbtn${hideClosed ? ' has-value' : ''}`}
          title={hideClosed ? 'Show closed' : 'Hide closed'}
          onClick={() => setHideClosed(v => !v)}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 13 }}>
            {hideClosed ? 'visibility_off' : 'visibility'}
          </span>
        </button>

        {/* Density selector */}
        {(['compact', 'comfy', 'relaxed']).map(d => (
          <button
            key={d}
            className={`fbtn${density === d ? ' has-value' : ''}`}
            title={d}
            onClick={() => setDensity(d)}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 13 }}>{DENSITY_ICON[d]}</span>
          </button>
        ))}

        {/* Keyboard shortcuts hint */}
        <button className="fbtn" title="Keyboard shortcuts (?)" onClick={() => setShowShortcuts(true)}>
          <span className="material-symbols-outlined" style={{ fontSize: 13 }}>keyboard</span>
        </button>
      </div>

      {/* ── Scroll area ── */}
      <div className="lt-scroll" ref={scrollRef} onScroll={onScroll}>
        <div className="lt">

          {/* Sticky column header */}
          <ListHeader
            cols={effectiveCols}
            sortBy={sortBy}
            sortDir={sortDir}
            onSort={toggleSort}
            allSelected={flatRows.length > 0 && selectedIds.size === flatRows.length}
            someSelected={selectedIds.size > 0 && selectedIds.size < flatRows.length}
            onSelectAll={() =>
              selectedIds.size === flatRows.length
                ? clearSelection()
                : selectAll(flatRows.map(a => a.id))
            }
            floating={scrolled}
          />

          {/* Loading skeletons */}
          {isLoading && <LoadingState cols={effectiveCols} density={density} />}

          {/* Error state */}
          {isError && !isLoading && <ErrorState onRetry={onRetry} />}

          {/* Empty state */}
          {!isLoading && !isError && flatRows.length === 0 && (
            <EmptyState
              filterLabel={search.trim() || null}
              onClearFilters={search ? () => setSearch('') : null}
              onAddJob={onStartNew}
            />
          )}

          {/* Virtualized rows */}
          {!isLoading && !isError && items.length > 0 && (
            <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
              {virtualizer.getVirtualItems().map(vi => {
                const item = items[vi.index];
                const isFocused = item.type === 'row' &&
                  flatRows.findIndex(a => a.id === item.app.id) === focusedIdx;

                return (
                  <div
                    key={vi.key}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      transform: `translateY(${vi.start}px)`,
                    }}
                  >
                    {item.type === 'band' && (
                      <GroupBand
                        {...item.group}
                        collapsed={!!groupCollapsed[item.group.id]}
                        onToggle={() => toggleGroupCollapse(item.group.id)}
                      />
                    )}

                    {item.type === 'row' && (
                      <ListRow
                        app={item.app}
                        cols={effectiveCols}
                        density={density}
                        focused={isFocused}
                        selected={selectedIds.has(item.app.id)}
                        expanded={expandedId === item.app.id}
                        avgScore={avgScore}
                        onSelect={() => toggleSelect(item.app.id)}
                        onViewApp={() => onViewApp(item.app)}
                        onToggleExpand={() => toggleExpand(item.app.id)}
                        onSetInterest={(level) => onUpdate(item.app.id, { interest_level: level })}
                        onOpenStagePopover={(app, el) => {
                          const rect = el.getBoundingClientRect();
                          setStagePopover({ appId: app.id, anchorRect: rect });
                        }}
                      />
                    )}

                    {item.type === 'expand' && (
                      <PulseExpand app={item.app} avgScore={avgScore} onViewApp={onViewApp} />
                    )}
                  </div>
                );
              })}
            </div>
          )}

        </div>
      </div>

      {/* ── Overlays ── */}

      {selectedIds.size > 0 && (
        <BulkBar count={selectedIds.size} onMoveAll={handleBulkMove} onClear={clearSelection} />
      )}

      {stagePopover && stagePopoverApp && (
        <StageEditPopover
          app={stagePopoverApp}
          anchorRect={stagePopover.anchorRect}
          onSelect={handleStageSelect}
          onClose={() => setStagePopover(null)}
        />
      )}

      {showShortcuts && <ShortcutsCheatsheet onClose={() => setShowShortcuts(false)} />}

      {moveConfirm && (
        <ConfirmModal
          kind={moveConfirm.kind}
          fromStage={moveConfirm.fromStage}
          toStage={moveConfirm.toStage}
          app={moveConfirm.app}
          onConfirm={() => {
            onUpdate(moveConfirm.app.id, { status: moveConfirm.toStage });
            setMoveConfirm(null);
          }}
          onCancel={() => setMoveConfirm(null)}
        />
      )}

    </div>
  );
}
