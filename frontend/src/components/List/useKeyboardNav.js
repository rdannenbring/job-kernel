import { useEffect, useRef } from 'react';

export function useKeyboardNav({
  rowCount,
  focusedIdx,
  setFocusedIdx,
  flatRows,        // flat ordered list of app objects for current view
  selectedIds,
  toggleSelect,
  expandedId,
  toggleExpand,
  setStagePopover,
  onViewApp,
  setShowShortcuts,
  selectAll,
  clearSelection,
  setPreset,
}) {
  // g-key chord buffer
  const gPending = useRef(false);
  const gTimer = useRef(null);

  useEffect(() => {
    const onKey = (e) => {
      // Skip if typing in an input
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;
      if (e.target.isContentEditable) return;

      const key = e.key;

      // g-chord handling
      if (gPending.current) {
        gPending.current = false;
        clearTimeout(gTimer.current);
        if (key === 'a') { setPreset && setPreset('active'); return; }
        if (key === 'n') { setPreset && setPreset('needs'); return; }
        if (key === 'i') { setPreset && setPreset('interviewing'); return; }
        if (key === 'r') { setPreset && setPreset('closed'); return; }
        return;
      }

      if (key === 'g') {
        gPending.current = true;
        gTimer.current = setTimeout(() => { gPending.current = false; }, 800);
        return;
      }

      if (key === '?') { setShowShortcuts(prev => !prev); return; }
      if (key === 'Escape') { clearSelection(); setStagePopover(null); setShowShortcuts(false); return; }

      // Cmd/Ctrl+A
      if ((e.metaKey || e.ctrlKey) && key === 'a') {
        e.preventDefault();
        selectAll(flatRows.map(a => a.id));
        return;
      }

      if (key === '/') {
        e.preventDefault();
        document.querySelector('.jk-list .lbar-search input')?.focus();
        return;
      }

      if (key === 'j' || key === 'ArrowDown') {
        e.preventDefault();
        setFocusedIdx(prev => Math.min(prev + 1, rowCount - 1));
        return;
      }
      if (key === 'k' || key === 'ArrowUp') {
        e.preventDefault();
        setFocusedIdx(prev => Math.max(prev - 1, 0));
        return;
      }
      if (key === 'Enter') {
        const app = flatRows[focusedIdx];
        if (app) onViewApp(app);
        return;
      }
      if (key === 'x') {
        const app = flatRows[focusedIdx];
        if (app) toggleSelect(app.id);
        return;
      }
      if (key === 'e') {
        const app = flatRows[focusedIdx];
        if (app) setStagePopover({ appId: app.id, anchorIdx: focusedIdx });
        return;
      }
    };

    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      clearTimeout(gTimer.current);
    };
  }, [rowCount, focusedIdx, flatRows, selectedIds, toggleSelect, expandedId,
      toggleExpand, setStagePopover, onViewApp, setShowShortcuts, selectAll,
      clearSelection, setFocusedIdx, setPreset]);
}
