import React, { useState, useEffect, useRef, useCallback } from 'react';
import './Kanban.kanban.css';
import {
  KANBAN_COLUMNS, TERMINAL_COLUMNS,
  deriveStage, isTerminal, isBack, isForward, stageIndex,
} from './stages.js';
import FilterBar from './FilterBar.jsx';
import Spine from './Spine.jsx';
import EndStateSpine from './EndStateSpine.jsx';
import FocusColumn from './FocusColumn.jsx';
import EndStateFocus from './EndStateFocus.jsx';
import ConfirmModal from './ConfirmModal.jsx';
import UndoToast from './UndoToast.jsx';
import BulkBar from './BulkBar.jsx';

const DENSITY_KEY = 'kanban_density';

export default function Kanban({
  apps,             // pre-filtered/sorted by Dashboard
  allAppsCount,     // total unfiltered count for filter bar display
  onUpdate,
  onViewApp,
  onStartNew,
  updateAppOrders,
  connectionCounts,
  avgScore,
  sortBy, setSortBy,
  searchTerm, setSearchTerm,
  filterMinScore, setFilterMinScore,
  filterHasConnections, setFilterHasConnections,
  onClearAllFilters,
}) {
  // Focus state
  const [focusStage, setFocusStage] = useState('Inbox');
  const [activeTerminal, setActiveTerminal] = useState('Rejected');

  // Density (persisted)
  const [density, setDensityRaw] = useState(() => localStorage.getItem(DENSITY_KEY) || 'comfy');
  const setDensity = (d) => { setDensityRaw(d); localStorage.setItem(DENSITY_KEY, d); };

  // Multi-select
  const [selectedIds, setSelectedIds] = useState(new Set());

  // DnD state
  const [draggedAppId, setDraggedAppId] = useState(null);
  const [draggedOverCol, setDraggedOverCol] = useState(null);
  const [dropPlaceholder, setDropPlaceholder] = useState({ column: null, index: null });

  // Modals / toasts
  const [pendingDrop, setPendingDrop] = useState(null); // { appId, fromStage, toStage, targetIndex, kind }
  const [undoToast, setUndoToast]     = useState(null); // { message, revert: fn }
  const [bulkConfirm, setBulkConfirm] = useState(null); // { ids, toStage }

  // Panning
  const boardRef = useRef(null);
  const panState = useRef({ active: false, startX: 0, startY: 0, scrollLeft: 0, scrollTop: 0 });

  // Keyboard: Esc clears selection & closes modals
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') {
        setSelectedIds(new Set());
        setPendingDrop(null);
        setBulkConfirm(null);
        setUndoToast(null);
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, []);

  // ── Derived data ─────────────────────────────────────────────────
  const focusIsEnd = TERMINAL_COLUMNS.includes(focusStage);

  const appsByStage = React.useMemo(() => {
    const map = {};
    [...KANBAN_COLUMNS, ...TERMINAL_COLUMNS].forEach(s => { map[s] = []; });
    apps.forEach(app => {
      const stage = deriveStage(app);
      if (map[stage]) map[stage].push(app);
      else map['Saved'].push(app); // fallback
    });
    return map;
  }, [apps]);

  const dragMoveType = React.useMemo(() => {
    if (!draggedAppId || !draggedOverCol) return null;
    const sourceApp = apps.find(a => a.id === draggedAppId);
    if (!sourceApp) return null;
    const from = deriveStage(sourceApp);
    const to = draggedOverCol === '__end__' ? 'Rejected' : draggedOverCol;
    if (isTerminal(to)) return 'end';
    if (isBack(from, to)) return 'back';
    if (isForward(from, to)) return 'fwd';
    return null;
  }, [draggedAppId, draggedOverCol, apps]);

  // ── DnD handlers ─────────────────────────────────────────────────
  const onDragStart = useCallback((e, appId) => {
    e.dataTransfer.setData('appId', String(appId));
    e.dataTransfer.effectAllowed = 'move';
    const img = e.currentTarget.cloneNode(true);
    img.style.cssText = 'position:absolute;top:-9999px;left:-9999px;opacity:0.85;width:' + e.currentTarget.offsetWidth + 'px';
    document.body.appendChild(img);
    e.dataTransfer.setDragImage(img, 20, 20);
    setTimeout(() => document.body.removeChild(img), 0);
    setTimeout(() => setDraggedAppId(appId), 0);
  }, []);

  const onDragEnd = useCallback(() => {
    setDraggedAppId(null);
    setDraggedOverCol(null);
    setDropPlaceholder({ column: null, index: null });
  }, []);

  const onDragOver = useCallback((e, col) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (draggedOverCol !== col) setDraggedOverCol(col);
    if (e.target === e.currentTarget || e.target.classList.contains('k-focus-grid')) {
      const currentApps = appsByStage[col] || [];
      setDropPlaceholder({ column: col, index: currentApps.length });
    }
  }, [draggedOverCol, appsByStage]);

  const onCardDragOver = useCallback((e, col, index) => {
    e.preventDefault();
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    const isAbove = e.clientY < rect.top + rect.height / 2;
    const newIndex = isAbove ? index : index + 1;
    if (dropPlaceholder.column !== col || dropPlaceholder.index !== newIndex) {
      setDropPlaceholder({ column: col, index: newIndex });
    }
    if (draggedOverCol !== col) setDraggedOverCol(col);
  }, [dropPlaceholder, draggedOverCol]);

  const onDragLeave = useCallback((e) => {
    if (!e.currentTarget.contains(e.nativeEvent.relatedTarget)) {
      setDraggedOverCol(null);
    }
  }, []);

  const onDrop = useCallback((e, targetStage) => {
    e.preventDefault();
    const appId = parseInt(e.dataTransfer.getData('appId'), 10) || draggedAppId;
    onDragEnd();
    if (!appId) return;

    const sourceApp = apps.find(a => a.id === appId);
    if (!sourceApp) return;

    const fromStage = deriveStage(sourceApp);
    const resolvedTarget = targetStage === '__end__' ? 'Rejected' : targetStage;
    if (fromStage === resolvedTarget) return; // no-op same-column

    // Compute target index
    const colApps = (appsByStage[resolvedTarget] || []).filter(a => a.id !== appId);
    const targetIndex = (dropPlaceholder.column === resolvedTarget && dropPlaceholder.index !== null)
      ? Math.min(dropPlaceholder.index, colApps.length)
      : colApps.length;

    if (isTerminal(resolvedTarget)) {
      // Show confirm modal before committing
      setPendingDrop({ appId, fromStage, toStage: resolvedTarget, targetIndex, kind: 'end', sourceApp });
      return;
    }

    if (isBack(fromStage, resolvedTarget)) {
      // Optimistic commit + show undo toast
      const finalApps = [...colApps];
      finalApps.splice(targetIndex, 0, { ...sourceApp, status: resolvedTarget });
      updateAppOrders(finalApps, resolvedTarget);

      const revert = () => {
        const revertCol = (appsByStage[fromStage] || []).filter(a => a.id !== appId);
        updateAppOrders([...revertCol, { ...sourceApp, status: fromStage }], fromStage);
        setUndoToast(null);
      };
      setUndoToast({
        message: `Moved ${sourceApp.company} back to ${resolvedTarget}`,
        revert,
      });
      return;
    }

    // Forward move — commit immediately
    const finalApps = [...colApps];
    finalApps.splice(targetIndex, 0, { ...sourceApp, status: resolvedTarget });
    updateAppOrders(finalApps, resolvedTarget);

    // Auto-focus the destination stage if not already focused
    if (!TERMINAL_COLUMNS.includes(resolvedTarget)) setFocusStage(resolvedTarget);
  }, [draggedAppId, apps, appsByStage, dropPlaceholder, onDragEnd, updateAppOrders]);

  // ── Confirm modal actions ─────────────────────────────────────────
  const confirmDrop = useCallback(() => {
    if (!pendingDrop) return;
    const { appId, toStage, targetIndex, sourceApp } = pendingDrop;
    const colApps = (appsByStage[toStage] || []).filter(a => a.id !== appId);
    const finalApps = [...colApps];
    finalApps.splice(targetIndex, 0, { ...sourceApp, status: toStage });
    updateAppOrders(finalApps, toStage);
    if (TERMINAL_COLUMNS.includes(toStage)) setFocusStage(toStage);
    setPendingDrop(null);
  }, [pendingDrop, appsByStage, updateAppOrders]);

  const confirmBulk = useCallback(() => {
    if (!bulkConfirm) return;
    const { ids, toStage } = bulkConfirm;
    const colApps = (appsByStage[toStage] || []).filter(a => !ids.has(a.id));
    const movers = apps.filter(a => ids.has(a.id)).map(a => ({ ...a, status: toStage }));
    updateAppOrders([...colApps, ...movers], toStage);
    setSelectedIds(new Set());
    setBulkConfirm(null);
  }, [bulkConfirm, appsByStage, apps, updateAppOrders]);

  // ── Multi-select ──────────────────────────────────────────────────
  const onSelect = useCallback((appId, e) => {
    if (e.metaKey || e.ctrlKey) {
      e.stopPropagation();
      setSelectedIds(prev => {
        const next = new Set(prev);
        if (next.has(appId)) next.delete(appId);
        else next.add(appId);
        return next;
      });
    } else {
      // Normal click — open detail
      const app = apps.find(a => a.id === appId);
      if (app) onViewApp(app);
    }
  }, [apps, onViewApp]);

  const handleBulkMoveAll = useCallback((toStage) => {
    if (isTerminal(toStage)) {
      setBulkConfirm({ ids: selectedIds, toStage });
    } else {
      const ids = selectedIds;
      const colApps = (appsByStage[toStage] || []).filter(a => !ids.has(a.id));
      const movers = apps.filter(a => ids.has(a.id)).map(a => ({ ...a, status: toStage }));
      updateAppOrders([...colApps, ...movers], toStage);
      setSelectedIds(new Set());
    }
  }, [selectedIds, appsByStage, apps, updateAppOrders]);

  const handleBulkReject = useCallback(() => {
    setBulkConfirm({ ids: selectedIds, toStage: 'Rejected' });
  }, [selectedIds]);

  // ── Panning ───────────────────────────────────────────────────────
  const onMouseDown = useCallback((e) => {
    if (e.target.closest('.kc') || e.target.closest('button') || e.target.closest('input') || e.target.closest('.k-focus-grid')) return;
    panState.current = {
      active: true, startX: e.pageX, startY: e.pageY,
      scrollLeft: boardRef.current?.scrollLeft || 0,
      scrollTop:  boardRef.current?.scrollTop  || 0,
    };
  }, []);

  const onMouseMove = useCallback((e) => {
    if (!panState.current.active) return;
    e.preventDefault();
    const el = boardRef.current;
    if (!el) return;
    el.scrollLeft = panState.current.scrollLeft - (e.pageX - panState.current.startX);
    el.scrollTop  = panState.current.scrollTop  - (e.pageY - panState.current.startY);
  }, []);

  const onMouseUp = useCallback(() => { panState.current.active = false; }, []);

  // ── Render ────────────────────────────────────────────────────────
  const filteredCount = apps.length;

  return (
    <div
      className="k-board-root"
      style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden', position: 'relative' }}
    >
      <FilterBar
        totalCount={allAppsCount}
        filteredCount={filteredCount !== allAppsCount ? filteredCount : null}
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        sortBy={sortBy}
        setSortBy={setSortBy}
        density={density}
        setDensity={setDensity}
        filterMinScore={filterMinScore}
        setFilterMinScore={setFilterMinScore}
        filterHasConnections={filterHasConnections}
        setFilterHasConnections={setFilterHasConnections}
        onClearAll={onClearAllFilters}
      />

      <div
        ref={boardRef}
        className="k-focus-row"
        style={{ cursor: panState.current.active ? 'grabbing' : 'default' }}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
      >
        {/* Active stage spines and focus column */}
        {KANBAN_COLUMNS.map(stage => {
          const stageApps = appsByStage[stage] || [];
          const isFocused = !focusIsEnd && focusStage === stage;

          if (isFocused) {
            return (
              <FocusColumn
                key={stage}
                stage={stage}
                apps={stageApps}
                density={density}
                draggedOverCol={draggedOverCol}
                dragMoveType={dragMoveType}
                dropPlaceholder={dropPlaceholder}
                draggedAppId={draggedAppId}
                selectedIds={selectedIds}
                onViewApp={onViewApp}
                onSelect={onSelect}
                onDragStart={onDragStart}
                onDragEnd={onDragEnd}
                onDragOver={onDragOver}
                onDrop={onDrop}
                onCardDragOver={onCardDragOver}
                onDragLeave={onDragLeave}
              />
            );
          }

          return (
            <Spine
              key={stage}
              stage={stage}
              apps={stageApps}
              isFocused={isFocused}
              draggedOverCol={draggedOverCol}
              dragMoveType={dragMoveType}
              onClick={setFocusStage}
              onDragOver={onDragOver}
              onDrop={onDrop}
              onDragLeave={onDragLeave}
            />
          );
        })}

        {/* End-states: spine or focus column */}
        {focusIsEnd ? (
          <EndStateFocus
            activeTerminal={activeTerminal}
            appsByTerminal={{ Rejected: appsByStage.Rejected, Declined: appsByStage.Declined, Withdrawn: appsByStage.Withdrawn }}
            density={density}
            selectedIds={selectedIds}
            draggedAppId={draggedAppId}
            draggedOverCol={draggedOverCol}
            dropPlaceholder={dropPlaceholder}
            onViewApp={onViewApp}
            onSelect={onSelect}
            onSetTerminal={(s) => { setActiveTerminal(s); setFocusStage(s); }}
            onClose={() => setFocusStage('Inbox')}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            onDragOver={onDragOver}
            onDrop={onDrop}
            onCardDragOver={onCardDragOver}
            onDragLeave={onDragLeave}
          />
        ) : (
          <EndStateSpine
            appsByTerminal={{ Rejected: appsByStage.Rejected, Declined: appsByStage.Declined, Withdrawn: appsByStage.Withdrawn }}
            draggedOverCol={draggedOverCol}
            onClickStage={(s) => { setActiveTerminal(s); setFocusStage(s); }}
            onDragOver={onDragOver}
            onDrop={onDrop}
            onDragLeave={onDragLeave}
          />
        )}
      </div>

      {/* Overlays */}
      {pendingDrop && (
        <ConfirmModal
          kind={pendingDrop.kind}
          fromStage={pendingDrop.fromStage}
          toStage={pendingDrop.toStage}
          app={pendingDrop.sourceApp}
          onConfirm={confirmDrop}
          onCancel={() => setPendingDrop(null)}
        />
      )}

      {bulkConfirm && (
        <ConfirmModal
          kind="end"
          fromStage="mixed"
          toStage={bulkConfirm.toStage}
          count={bulkConfirm.ids.size}
          onConfirm={confirmBulk}
          onCancel={() => setBulkConfirm(null)}
        />
      )}

      {undoToast && (
        <UndoToast
          message={undoToast.message}
          onUndo={() => { undoToast.revert(); setUndoToast(null); }}
          onDismiss={() => setUndoToast(null)}
        />
      )}

      {selectedIds.size > 0 && !pendingDrop && !bulkConfirm && (
        <BulkBar
          count={selectedIds.size}
          onMoveAll={handleBulkMoveAll}
          onMarkRejected={handleBulkReject}
          onClear={() => setSelectedIds(new Set())}
        />
      )}
    </div>
  );
}
