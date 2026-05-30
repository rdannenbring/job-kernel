/* global React, Icon, KCardA, KCardB, KCardC, KColHead, KEmpty, KFilterBar, KPageHead,
   KEndShelf, KEndDrawer, KConfirmModal, KToast, KBulkBar */

// ─── Kanban app shell — like AppShell but topbar shows "Pipeline" ──
function KShell({ children, theme = 'light' }) {
  return (
    <div className="app" data-theme={theme}>
      <div className="nav">
        <div className="nav-logo">JK</div>
        <div className="nav-add"><Icon name="add" size={20} /></div>
        <div className="nav-item is-active"><Icon name="dashboard" size={20} fill /></div>
        <div className="nav-item"><Icon name="person" size={20} /></div>
        <div className="nav-item"><Icon name="analytics" size={20} /></div>
        <div className="nav-spacer" />
        <div className="nav-item"><Icon name="notifications" size={20} /></div>
        <div className="nav-item"><Icon name="settings" size={20} /></div>
        <div className="nav-avatar">A</div>
      </div>
      <div className="topbar">
        <div className="topbar-crumb">
          <Icon name="dashboard" size={16} className="dim" />
          <span className="curr">Pipeline</span>
          <span className="sep">·</span>
          <a>Board</a>
          <span className="sep">·</span>
          <a>List</a>
          <span className="sep">·</span>
          <a>Calendar</a>
        </div>
        <div className="topbar-actions">
          <button className="btn btn-sm">
            <Icon name="extension" size={14} /> Capture
          </button>
          <button className="btn btn-sm btn-primary">
            <Icon name="add" size={14} /> New
          </button>
        </div>
      </div>
      <div className="stage" style={{ display: 'flex', flexDirection: 'column' }}>
        {children}
      </div>
    </div>
  );
}

// Pick the card component for a density
function pickCard(density) {
  if (density === 'compact') return KCardC;
  if (density === 'cozy')    return KCardB;
  return KCardA;
}

// ─── Common: render a kanban column ──
function KColumn({ stage, apps, density, dropState, cardType, maxVisible, showHint = true, selectedIds, onSelect }) {
  const Card = cardType || pickCard(density);
  const visible = maxVisible ? apps.slice(0, maxVisible) : apps;
  const overflow = maxVisible ? Math.max(0, apps.length - maxVisible) : 0;
  const sel = selectedIds || new Set();
  const isInbox = stage.kind === 'pre';
  const isEnd = stage.kind === 'end';
  return (
    <div className={`k-col ${isInbox ? 'is-pre' : ''} ${isEnd ? 'is-end' : ''} ${density === 'compact' ? 'is-compact' : density === 'cozy' ? 'is-comfy' : ''} ${dropState ? `is-drop${dropState === 'back' ? '-back' : dropState === 'danger' ? '-danger' : ''}` : ''}`}>
      <KColHead stage={stage} count={apps.length}
        subLabel={isInbox ? 'Triage' : isEnd ? 'Closed' : null}
        tone={isInbox ? 'warn' : isEnd ? 'end' : null} />
      <div className="k-col-body">
        {visible.length === 0 && <KEmpty stage={stage} />}
        {visible.map(a => (
          <Card key={a.id} app={a}
                hint={showHint}
                isSelected={sel.has(a.id)}
                onSelect={onSelect} />
        ))}
        {overflow > 0 && (
          <button className="k-col-overflow">
            <Icon name="expand_more" size={13} />
            Show {overflow} more
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Layout A — Classic ───────────────────────────────────────────
// All active stages in a horizontal scroll with Inbox at the left.
// End states collapse into a single shelf below.
function KanbanClassic({ theme = 'light', density = 'comfy', overlay = null, selectedIds }) {
  const [shelfOpen, setShelfOpen] = React.useState(true);
  const grouped = window.K_BY_STAGE();
  const stages = window.K_STAGES;

  // Demo drag state: dragging a06 ("Linear") forward into "Generated"
  const dropMap = overlay === 'dragforward' ? { generated: 'ok' } :
                  overlay === 'dragback'    ? { saved: 'back' } :
                  overlay === 'dragend'     ? null : {};

  return (
    <KShell theme={theme}>
      <KPageHead />
      <KFilterBar density={density} totalCount={window.K_APPS.length} compact={density === 'compact'} />
      <div className="k-board is-scroll-x">
        {stages.map(s => (
          <KColumn key={s.id} stage={s}
                   apps={grouped[s.id] || []}
                   density={density}
                   dropState={dropMap?.[s.id]}
                   selectedIds={selectedIds}
                   maxVisible={density === 'compact' ? 12 : 5} />
        ))}
      </div>
      <KEndShelf apps={window.K_APPS} open={shelfOpen} onToggle={() => setShelfOpen(o => !o)} />
      {overlay === 'modal-end' && (
        <KConfirmModal kind="end"
          fromStage={window.K_STAGES.find(s => s.id === 'applied')}
          toStage={window.K_END_STAGES.find(s => s.id === 'rejected')}
          app={window.K_APPS.find(a => a.id === 'a16')}
          onConfirm={() => {}} onCancel={() => {}} />
      )}
      {overlay === 'toast' && (
        <KToast message="Moved Linear · Senior Frontend back to Saved" secondsLeft={3} />
      )}
      {overlay === 'bulk' && (
        <KBulkBar count={3} fromStage={window.K_STAGES.find(s => s.id === 'saved')} />
      )}
    </KShell>
  );
}

// ─── Layout B — Hierarchy ─────────────────────────────────────────
// Active stages fill all the width; column widths flex with their card
// count. End states tucked into a slide-out drawer pinned to the right.
function KanbanHierarchy({ theme = 'light', density = 'comfy', overlay = null }) {
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [drawerStage, setDrawerStage] = React.useState('rejected');
  const grouped = window.K_BY_STAGE();
  // Skip the "inbox" pre-stage in this layout — it gets a fold-down on top instead
  const stages = window.K_STAGES.filter(s => s.id !== 'inbox');

  // weight each column by population — heaviest gets more visual space
  const total = stages.reduce((n, s) => n + (grouped[s.id] || []).length, 0) || 1;
  const widthFor = (s) => {
    const ct = (grouped[s.id] || []).length;
    const baseline = density === 'compact' ? 200 : 240;
    const bonus = Math.round((ct / total) * 240);
    return baseline + bonus;
  };

  const inboxCount = (grouped.inbox || []).length;

  const dropMap = overlay === 'dragforward' ? { interviewing: 'ok' } : {};

  return (
    <KShell theme={theme}>
      <KPageHead />
      <KFilterBar density={density} totalCount={window.K_APPS.length} />
      {/* Inbox banner — captures awaiting triage live above the board */}
      <div style={{ padding: '8px 18px 0', display: 'flex', gap: 10, alignItems: 'center' }}>
        <div className="row gap-2" style={{
          padding: '8px 12px',
          background: 'linear-gradient(180deg, rgba(245,158,11,0.10), rgba(245,158,11,0.02))',
          border: '1px solid rgba(245,158,11,0.28)',
          borderLeft: '3px solid var(--warn)',
          borderRadius: 10,
          color: 'var(--warn)', fontSize: 12, fontWeight: 700, flex: 1,
        }}>
          <Icon name="inbox" size={14} fill />
          <span><b>{inboxCount} new captures</b> in your inbox · Stripe, Anthropic, Datadog · <span style={{ color: 'var(--txt-mute)', fontWeight: 600 }}>triage to start the pipeline</span></span>
          <button className="btn btn-sm" style={{ marginLeft: 'auto',
            background: 'var(--bg-card)', color: 'var(--warn)',
            borderColor: 'rgba(245,158,11,0.30)' }}>
            <Icon name="open_in_new" size={13} /> Triage
          </button>
        </div>
      </div>
      <div style={{ position: 'relative', flex: 1, minHeight: 0 }}>
        <div className="k-board" style={{ paddingRight: 60 }}>
          {stages.map(s => (
            <div key={s.id} style={{ width: widthFor(s), flexShrink: 0 }}>
              <KColumn stage={s}
                       apps={grouped[s.id] || []}
                       density={density}
                       dropState={dropMap?.[s.id]}
                       maxVisible={density === 'compact' ? 14 : 6} />
            </div>
          ))}
        </div>
        <KEndDrawer apps={window.K_APPS} open={drawerOpen} activeStageId={drawerStage}
                    onToggle={() => setDrawerOpen(o => !o)}
                    onActivate={(id) => { setDrawerStage(id); setDrawerOpen(true); }} />
      </div>
      {overlay === 'modal-back' && (
        <KConfirmModal kind="back"
          fromStage={window.K_STAGES.find(s => s.id === 'interviewing')}
          toStage={window.K_STAGES.find(s => s.id === 'applied')}
          app={window.K_APPS.find(a => a.id === 'a21')}
          onConfirm={() => {}} onCancel={() => {}} />
      )}
    </KShell>
  );
}

// ─── Layout C — Focus stage (novel) ───────────────────────────────
// One stage is the focus column with rich cards. The other stages
// collapse to vertical "spines" — tiny stacked card thumbnails you can
// drag from / into. Click a spine to refocus.
function KanbanFocus({ theme = 'light', density = 'comfy', overlay = null }) {
  const [focusId, setFocusId] = React.useState('inbox');
  const grouped = window.K_BY_STAGE();
  const stages = window.K_STAGES;
  const endIds = window.K_END_STAGES.map(s => s.id);
  const focusIsEnd = endIds.includes(focusId);
  const focusStage = stages.find(s => s.id === focusId)
    || window.K_END_STAGES.find(s => s.id === focusId)
    || stages[2];

  // Spine thumbnail — score dot + company name + tiny substage pip
  const Thumb = ({ app }) => {
    const t = window.K_SCORE_TINT(app.score);
    return (
      <div className="k-thumb" title={`${app.co} · ${app.role}`}>
        <div className="nm">{app.co}</div>
        <div className="meta">
          <span className="dot" style={{ background: t.c }} />
          <span>{app.score}</span>
          {app.stars > 0 && <span style={{ color: '#f59e0b' }}>★{app.stars}</span>}
        </div>
      </div>
    );
  };

  return (
    <KShell theme={theme}>
      <KPageHead />
      <KFilterBar density={density} totalCount={window.K_APPS.length} />
      <div className="k-focus-row" style={{ flex: 1, minHeight: 0 }}>
        {stages.map(s => {
          if (!focusIsEnd && s.id === focusId) {
            const apps = grouped[s.id] || [];
            const Card = pickCard(density);
            const isInbox = s.kind === 'pre';
            return (
              <div key={s.id} className={`k-focus-col ${isInbox ? 'is-pre' : ''}`}>
                <div className="k-focus-head">
                  <div className="k-col-icon"><Icon name={s.icon} size={16} fill /></div>
                  <div className="col" style={{ gap: 2 }}>
                    <div className="row gap-2" style={{ alignItems: 'center' }}>
                      <h3>{s.label}</h3>
                      {isInbox && (
                        <span className="k-col-sub is-warn" style={{ marginLeft: 0 }}>Triage</span>
                      )}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--txt-mute)', fontWeight: 600 }}>
                      {apps.length} {isInbox ? 'new capture' : 'application'}{apps.length === 1 ? '' : 's'} · {isInbox ? 'awaiting triage' : 'focused stage'}
                    </div>
                  </div>
                  <div className="sub">
                    {isInbox ? (
                      <span className="row gap-2">
                        <Icon name="bolt" size={12} fill style={{ color: 'var(--warn)' }} />
                        Run analysis, then move to Saved
                      </span>
                    ) : (
                      <span className="row gap-2">
                        <Icon name="bolt" size={12} fill style={{ color: 'var(--primary)' }} />
                        Drag cards to the spines to move stage
                      </span>
                    )}
                  </div>
                </div>
                <div className="k-focus-grid">
                  {apps.map(a => <Card key={a.id} app={a} />)}
                  {apps.length === 0 && (
                    <div style={{ gridColumn: '1 / -1' }}>
                      <KEmpty stage={s} />
                    </div>
                  )}
                </div>
              </div>
            );
          }
          // Spine
          const apps = grouped[s.id] || [];
          const isInbox = s.kind === 'pre';
          return (
            <div key={s.id} className={`k-spine ${isInbox ? 'is-pre' : ''}`} onClick={() => setFocusId(s.id)}>
              <div className="k-spine-head">
                <Icon name={s.icon} size={16} />
                <div className="ct">{apps.length}</div>
                <div className="nm">{s.label}</div>
              </div>
              <div className="k-spine-stack">
                {apps.slice(0, 8).map(a => <Thumb key={a.id} app={a} />)}
                {apps.length > 8 && (
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--txt-dim)',
                    textAlign: 'center', padding: '2px 0' }}>+{apps.length - 8}</div>
                )}
              </div>
            </div>
          );
        })}
        {/* end states — spine if not focused, in-place focus column if focused */}
        {focusIsEnd ? (() => {
          const apps = grouped[focusId] || [];
          const totalClosed = window.K_END_STAGES.reduce((n, s) => n + (grouped[s.id] || []).length, 0);
          const Card = pickCard(density);
          return (
            <div className="k-focus-col is-end">
              <div className="k-focus-head">
                <div className="k-col-icon"><Icon name={focusStage.icon} size={16} fill /></div>
                <div className="col" style={{ gap: 2 }}>
                  <div className="row gap-2" style={{ alignItems: 'center' }}>
                    <h3>End states</h3>
                    <span className="k-col-sub is-end" style={{ marginLeft: 0 }}>Closed</span>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--txt-mute)', fontWeight: 600 }}>
                    {totalClosed} closed application{totalClosed === 1 ? '' : 's'} · archive
                  </div>
                </div>
                <div className="tabs" style={{ marginLeft: 'auto', gap: 4 }}>
                  {window.K_END_STAGES.map(s => (
                    <button key={s.id}
                      className={`tab ${focusId === s.id ? 'is-active' : ''}`}
                      onClick={() => setFocusId(s.id)}>
                      <Icon name={s.icon} size={12} />
                      {s.label}
                      <span className="pip" style={{
                        background: focusId === s.id ? 'var(--danger)' : 'var(--bg)',
                        color: focusId === s.id ? 'white' : 'var(--txt-mute)',
                        border: focusId === s.id ? '0' : '1px solid var(--line-strong)',
                      }}>{(grouped[s.id] || []).length}</span>
                    </button>
                  ))}
                  <button className="tab" onClick={() => setFocusId('inbox')} title="Close end states focus"
                    style={{ marginLeft: 4 }}>
                    <Icon name="close" size={12} />
                  </button>
                </div>
              </div>
              <div className="k-focus-grid">
                {apps.map(a => <Card key={a.id} app={a} hint={false} />)}
                {apps.length === 0 && (
                  <div style={{ gridColumn: '1 / -1', padding: '40px 20px', textAlign: 'center',
                    color: 'var(--txt-mute)', fontSize: 13 }}>
                    No applications marked {focusStage.label.toLowerCase()}.
                  </div>
                )}
              </div>
            </div>
          );
        })() : (
          <div className="k-spine is-end" style={{ width: 96, cursor: 'pointer' }}
               onClick={() => setFocusId('rejected')}>
            <div className="k-spine-head">
              <Icon name="alt_route" size={14} />
              <div className="ct" style={{ fontSize: 14 }}>
                {window.K_END_STAGES.reduce((n, s) => n + (grouped[s.id] || []).length, 0)}
              </div>
              <div className="nm">End states</div>
            </div>
            <div className="k-spine-stack">
              {window.K_END_STAGES.map(s => (
                <button key={s.id}
                  onClick={(e) => { e.stopPropagation(); setFocusId(s.id); }}
                  style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center',
                    padding: '6px 4px', fontSize: 10, fontWeight: 700,
                    color: 'var(--txt-mute)',
                    gap: 2, borderRadius: 7,
                    background: 'var(--bg-card)',
                    border: '1px solid var(--line)',
                    cursor: 'pointer', fontFamily: 'inherit',
                  }}>
                  <Icon name={s.icon} size={12} style={{ color: 'var(--danger)' }} />
                  <span>{(grouped[s.id] || []).length}</span>
                  <span style={{ fontSize: 8, letterSpacing: 0.04, textTransform: 'uppercase' }}>
                    {s.label.slice(0, 4)}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
      {overlay === 'modal-end' && (
        <KConfirmModal kind="end"
          fromStage={focusStage}
          toStage={window.K_END_STAGES.find(s => s.id === 'rejected')}
          app={(grouped[focusStage.id] || [])[0]}
          onConfirm={() => {}} onCancel={() => {}} />
      )}
    </KShell>
  );
}

window.KanbanClassic = KanbanClassic;
window.KanbanHierarchy = KanbanHierarchy;
window.KanbanFocus = KanbanFocus;
