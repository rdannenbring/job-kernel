import { useState, useCallback, useMemo } from 'react';
import { makeSorter } from './columns.js';

const STORAGE_KEY = 'jk_list_state';

function loadState() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } catch { return {}; }
}

function saveState(patch) {
  try {
    const cur = loadState();
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...cur, ...patch }));
  } catch {}
}

// Group collapsed state persisted per groupBy mode
const GROUP_STORAGE_KEY = 'jk_list_groups';
function loadGroupState() {
  try { return JSON.parse(localStorage.getItem(GROUP_STORAGE_KEY) || '{}'); } catch { return {}; }
}
function saveGroupState(state) {
  try { localStorage.setItem(GROUP_STORAGE_KEY, JSON.stringify(state)); } catch {}
}

export function useListState(apps) {
  const saved = useMemo(loadState, []);

  const [density,       setDensityRaw]   = useState(saved.density       || 'comfy');
  const [groupBy,       setGroupByRaw]   = useState(saved.groupBy       || 'flat');
  const [sortBy,        setSortByRaw]    = useState(saved.sortBy        || 'score');
  const [sortDir,       setSortDirRaw]   = useState(saved.sortDir       || 'desc');
  const [hideClosed,    setHideClosedRaw]= useState(saved.hideClosed    ?? false);
  const [visibleCols,   setVisibleColsRaw] = useState(saved.visibleCols || null);

  const [selectedIds,   setSelectedIds]  = useState(new Set());
  const [focusedIdx,    setFocusedIdx]   = useState(-1);
  const [expandedId,    setExpandedId]   = useState(null);
  const [stagePopover,  setStagePopover] = useState(null); // { appId, anchorEl }
  const [showShortcuts, setShowShortcuts]= useState(false);
  const [showColMgr,    setShowColMgr]   = useState(false);
  const [groupCollapsed, setGroupCollapsed] = useState(loadGroupState);

  const persist = useCallback((patch) => saveState(patch), []);

  const setDensity = useCallback((v) => { setDensityRaw(v); persist({ density: v }); }, [persist]);
  const setGroupBy = useCallback((v) => { setGroupByRaw(v); persist({ groupBy: v }); }, [persist]);
  const setSortBy  = useCallback((v) => { setSortByRaw(v);  persist({ sortBy: v }); }, [persist]);
  const setSortDir = useCallback((v) => { setSortDirRaw(v); persist({ sortDir: v }); }, [persist]);
  const setHideClosed = useCallback((v) => { setHideClosedRaw(v); persist({ hideClosed: v }); }, [persist]);
  const setVisibleCols = useCallback((v) => { setVisibleColsRaw(v); persist({ visibleCols: v }); }, [persist]);

  const toggleSort = useCallback((colId) => {
    setSortBy(colId);
    setSortDir(prev => (sortBy === colId && prev === 'desc') ? 'asc' : 'desc');
  }, [sortBy, setSortBy, setSortDir]);

  const toggleSelect = useCallback((id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback((ids) => {
    setSelectedIds(new Set(ids));
  }, []);

  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

  const toggleExpand = useCallback((id) => {
    setExpandedId(prev => prev === id ? null : id);
  }, []);

  const toggleGroupCollapse = useCallback((bandId) => {
    setGroupCollapsed(prev => {
      const next = { ...prev, [bandId]: !prev[bandId] };
      saveGroupState(next);
      return next;
    });
  }, []);

  const sortedApps = useMemo(() => {
    return [...apps].sort(makeSorter(sortBy, sortDir));
  }, [apps, sortBy, sortDir]);

  return {
    density, setDensity,
    groupBy, setGroupBy,
    sortBy, setSortBy,
    sortDir, setSortDir,
    hideClosed, setHideClosed,
    visibleCols, setVisibleCols,
    selectedIds, setSelectedIds, toggleSelect, selectAll, clearSelection,
    focusedIdx, setFocusedIdx,
    expandedId, setExpandedId, toggleExpand,
    stagePopover, setStagePopover,
    showShortcuts, setShowShortcuts,
    showColMgr, setShowColMgr,
    groupCollapsed, toggleGroupCollapse,
    toggleSort,
    sortedApps,
  };
}
