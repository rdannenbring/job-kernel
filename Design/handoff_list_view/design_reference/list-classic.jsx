/* global React, AppShell, Icon, ListToolbar, ViewSwitch, ListHead, ListRow */

// ─── Variation 1 — Classic Table ─────────────────────────────────
// Spreadsheet feel. Single-line rows, all columns, sticky header,
// sortable, no grouping. The reliable power-user surface.

function ListClassic({ density = 'comfy', theme = 'light', showClosed = true, forceHoverRow = null }) {
  // The full column set, in canonical order, minus 'role' (Two-line keeps it in 'company')
  const visibleIds = density === 'compact'
    ? ['check', 'company', 'role', 'stage', 'score', 'salary', 'stars', 'docs', 'loc', 'posted', 'hint']
    : ['check', 'company',         'stage', 'score', 'salary', 'stars', 'docs', 'loc', 'posted', 'hint'];

  const cols = window.L_FILTER_COLS(visibleIds).map(c => {
    // Two-line widens the company cluster (which now houses the role)
    if (c.id === 'company' && density !== 'compact') return { ...c, width: 280 };
    if (c.id === 'hint') return { ...c, width: density === 'compact' ? 220 : 240 };
    return c;
  });

  const twoLine = density !== 'compact';
  const rows = showClosed ? window.K_APPS : window.K_APPS.filter(a => !['rejected', 'declined', 'withdrawn'].includes(a.stage));

  return (
    <AppShell theme={theme} breadcrumb={["Dashboard", "All Applications"]}>
      <ClassicTopbarOverlay />
      <div className="list-shell">
        <ListToolbar active="needs" density={density} groupBy={false} />

        {/* Sticky header */}
        <div className="lt">
          <ListHead cols={cols} sortBy="score" sortDir="desc" indeterminate={false} />

          {/* Rows */}
          {rows.map((app, i) => (
            <ListRow key={app.id} app={app} cols={cols} density={density} twoLine={twoLine}
              hovered={forceHoverRow === i}
            />
          ))}
        </div>
      </div>
    </AppShell>
  );
}

// Small overlay that puts the View Switch into the topbar so the list view
// reads as a sibling to Kanban from the start.
function ClassicTopbarOverlay() {
  return (
    <div style={{
      position: 'absolute', top: 0, left: 60, right: 0, height: 48,
      pointerEvents: 'none', zIndex: 3, padding: '0 20px',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{ pointerEvents: 'auto' }}>
        <ViewSwitch value="list" />
      </div>
    </div>
  );
}

window.ListClassic = ListClassic;
window.ClassicTopbarOverlay = ClassicTopbarOverlay;
