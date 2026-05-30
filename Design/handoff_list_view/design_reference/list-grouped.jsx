/* global React, AppShell, Icon, ListToolbar, ListHead, ListRow, ClassicTopbarOverlay */

// ─── Variation 2 — Grouped by Stage ──────────────────────────────
// The opinionated pipeline-aware default. Apps cluster under sticky
// stage group-headers showing count, median score, and a collapse
// chevron. Same row anatomy as Classic; same column controls.

function ListGrouped({ density = 'comfy', theme = 'light', showClosed = true, collapsedStages = new Set(['rejected', 'declined', 'withdrawn']) }) {
  const visibleIds = density === 'compact'
    ? ['check', 'company', 'role', 'score', 'salary', 'stars', 'docs', 'loc', 'posted', 'hint']
    : ['check', 'company',         'score', 'salary', 'stars', 'docs', 'loc', 'posted', 'hint'];

  // Note: Stage column is hidden — group header already shows it.
  const cols = window.L_FILTER_COLS(visibleIds).map(c => {
    if (c.id === 'company' && density !== 'compact') return { ...c, width: 280 };
    if (c.id === 'hint') return { ...c, width: density === 'compact' ? 260 : 280 };
    return c;
  });
  const twoLine = density !== 'compact';

  // Bucket apps by stage
  const buckets = window.K_BY_STAGE();
  const activeStages = window.K_STAGES.filter(s => buckets[s.id]?.length > 0);
  const endStages = window.K_END_STAGES.filter(s => buckets[s.id]?.length > 0);

  return (
    <AppShell theme={theme} breadcrumb={["Dashboard", "All Applications"]}>
      <ClassicTopbarOverlay />
      <div className="list-shell">
        <ListToolbar active="needs" density={density} groupBy={true} />

        <div className="lt">
          <ListHead cols={cols} sortBy="score" sortDir="desc" />

          {activeStages.map((s) => (
            <StageGroup key={s.id} stage={s} apps={buckets[s.id]} cols={cols}
              density={density} twoLine={twoLine}
              collapsed={collapsedStages.has(s.id)}
            />
          ))}
          {showClosed && endStages.map((s) => (
            <StageGroup key={s.id} stage={s} apps={buckets[s.id]} cols={cols}
              density={density} twoLine={twoLine}
              collapsed={collapsedStages.has(s.id)} isEnd
            />
          ))}
        </div>
      </div>
    </AppShell>
  );
}

function StageGroup({ stage, apps, cols, density, twoLine, collapsed, isEnd = false }) {
  const median = apps.length
    ? [...apps].map(a => a.score).sort((a, b) => a - b)[Math.floor(apps.length / 2)]
    : null;
  const stageColor = {
    inbox: 'var(--txt-dim)',
    saved: 'var(--info)',
    generated: 'var(--primary)',
    applied: 'var(--primary)',
    interviewing: 'var(--warn)',
    decision: 'var(--warn)',
    accepted: 'var(--success)',
    rejected: 'var(--danger)',
    declined: 'var(--danger)',
    withdrawn: 'var(--txt-dim)',
  }[stage.id];

  // Aggregated needs-action count for the header
  const needsAction = apps.filter(a => window.L_ACTION_STAGES.has(a.stage)).length;

  return (
    <>
      <div className="lgroup" style={isEnd ? { opacity: 0.7 } : null}>
        <div className="lgroup-l">
          <span className={`lgroup-chev ${collapsed ? 'is-collapsed' : ''}`}>
            <Icon name="expand_more" size={16} />
          </span>
          <span className="lg-dot" style={{ background: stageColor }} />
          <span className="lgroup-name">
            <Icon name={stage.icon} size={13} /> {stage.label}
          </span>
          <span style={{ color: 'var(--txt-dim)', fontWeight: 700 }}>{apps.length}</span>
        </div>
        <div className="lgroup-r">
          {median != null && <span><Icon name="straighten" size={11} /> median {median}</span>}
          {needsAction > 0 && !isEnd && (
            <span style={{ color: 'var(--primary)' }}>
              <Icon name="bolt" size={11} fill /> {needsAction} need action
            </span>
          )}
          <button className="lgroup-chev" title="Add to stage">
            <Icon name="add" size={14} />
          </button>
        </div>
      </div>

      {!collapsed && apps.map((app) => (
        <ListRow key={app.id} app={app} cols={cols} density={density} twoLine={twoLine}
          closed={isEnd}
        />
      ))}
    </>
  );
}

window.ListGrouped = ListGrouped;
