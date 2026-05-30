/* global React, Icon, ScoreRing, CompanyLogo, InterestStars */

// ─── Stars (compact, read-only with hover-able variant when given onChange) ──
function KStars({ value = 0, size = 11 }) {
  return (
    <div className="kc-stars" title={`${value} of 3`}>
      {[1,2,3].map(n => (
        <span key={n} className={`icon icon-${size} ${n <= value ? '' : 'dim'}`}
              style={{ fontSize: size }}>
          {n <= value ? 'star' : 'star_outline'}
        </span>
      ))}
    </div>
  );
}

// ─── Doc dots — micro version (3 icons with state tint) ──
function KDocs({ docs }) {
  const map = [
    { id: 'resume', icon: 'description', label: 'Resume' },
    { id: 'cover',  icon: 'mail',        label: 'Cover letter' },
    { id: 'ctx',    icon: 'folder',      label: 'Context' },
  ];
  return (
    <div className="kc-docs">
      {map.map(m => (
        <span key={m.id}
              className={`kc-doc-dot is-${docs[m.id]}`}
              title={`${m.label} · ${docs[m.id]}`}>
          {m.icon}
        </span>
      ))}
    </div>
  );
}

// ─── Substage dot row ──
function KSubsRow({ stage, sub }) {
  const total = (window.K_SUBSTAGES[stage] || []).length;
  if (!total) return null;
  const items = [];
  for (let i = 0; i < total; i++) {
    let cls = '';
    if (i < sub) cls = 'is-done';
    else if (i === sub) cls = 'is-current';
    items.push(<span key={i} className={`kc-sub-dot ${cls}`} />);
  }
  return (
    <div className="kc-subs" title={`${sub}/${total} substages complete`}>
      {items}
      <span className="kc-sub-label">{sub}/{total}</span>
    </div>
  );
}

// ─── Substage segmented bar ──
function KSegBar({ stage, sub }) {
  const total = (window.K_SUBSTAGES[stage] || []).length;
  if (!total) return null;
  const items = [];
  for (let i = 0; i < total; i++) {
    let cls = '';
    if (i < sub) cls = 'is-done';
    else if (i === sub) cls = 'is-current';
    items.push(<i key={i} className={cls} />);
  }
  return <div className="kc-segbar">{items}</div>;
}

// ─── Score chip (compact) ──
function KScoreChip({ score }) {
  const t = window.K_SCORE_TINT(score);
  return (
    <span className={`kc-score-chip chip ${t.cls}`}>
      {score}
    </span>
  );
}

// ─── Card · Variant A — Standard ─────────────────────────────────
// Logo+co row, title, salary/stars meta, score chip + substage dots,
// hint footer with next-action.
function KCardA({ app, isSelected, isDragging, hint = true, onSelect }) {
  return (
    <div className={`kc ${isSelected ? 'is-selected' : ''} ${isDragging ? 'is-dragging' : ''}`}
         onClick={(e) => onSelect && onSelect(app.id, e)}>
      <div className="kc-row">
        <div className="kc-logo">{app.init}</div>
        <div className="kc-co">{app.co}</div>
        <div style={{ marginLeft: 'auto' }}>
          <KScoreChip score={app.score} />
        </div>
      </div>
      <div className="kc-title">{app.role}</div>
      <div className="kc-meta">
        <span className={`kc-salary ${app.salary === '—' || app.salary === 'Not Listed' ? 'is-unlisted' : ''}`}>
          <Icon name="payments" size={11} fill={app.salary !== '—' && app.salary !== 'Not Listed'} />
          {app.salary === '—' || app.salary === 'Not Listed' ? 'Not listed' : app.salary}
        </span>
        <span className="sep">·</span>
        <KStars value={app.stars} />
      </div>
      <div className="kc-row" style={{ justifyContent: 'space-between' }}>
        <KSubsRow stage={app.stage} sub={app.sub} />
        <KDocs docs={app.docs} />
      </div>
      {hint && app.hint && (
        <div className="kc-hint">
          <Icon name="bolt" size={11} fill />
          <span className="text">{app.hint}</span>
        </div>
      )}
    </div>
  );
}

// ─── Card · Variant B — Score-forward ─────────────────────────────
// Score ring on the left dominates, info packs to the right, substage
// rendered as a thin segmented progress bar with label.
function KCardB({ app, isSelected, isDragging, hint = true, onSelect }) {
  const total = (window.K_SUBSTAGES[app.stage] || []).length;
  return (
    <div className={`kc ${isSelected ? 'is-selected' : ''} ${isDragging ? 'is-dragging' : ''}`}
         onClick={(e) => onSelect && onSelect(app.id, e)}>
      <div className="kc-row" style={{ alignItems: 'flex-start', gap: 10 }}>
        <ScoreRing score={app.score} size={42} />
        <div className="col gap-1" style={{ flex: 1, minWidth: 0 }}>
          <div className="kc-co">{app.co} · <span style={{ color: 'var(--txt-dim)' }}>{app.posted}</span></div>
          <div className="kc-title">{app.role}</div>
        </div>
        <KStars value={app.stars} />
      </div>
      <div className="kc-meta">
        <span className={`kc-salary ${app.salary === '—' || app.salary === 'Not Listed' ? 'is-unlisted' : ''}`}>
          <Icon name="payments" size={11} fill={app.salary !== '—' && app.salary !== 'Not Listed'} />
          {app.salary === '—' || app.salary === 'Not Listed' ? 'Not listed' : app.salary}
        </span>
        <span className="sep">·</span>
        <span>{app.loc}</span>
      </div>
      <div className="kc-row" style={{ gap: 10 }}>
        <KSegBar stage={app.stage} sub={app.sub} />
        <span className="kc-sub-label" style={{ marginLeft: 0 }}>{app.sub}/{total}</span>
        <KDocs docs={app.docs} />
      </div>
      {hint && app.hint && (
        <div className="kc-hint">
          <Icon name="bolt" size={11} fill />
          <span className="text">{app.hint}</span>
        </div>
      )}
    </div>
  );
}

// ─── Card · Variant C — Compact ──────────────────────────────────
// Single dense row for power users. No hint footer.
function KCardC({ app, isSelected, isDragging, onSelect }) {
  return (
    <div className={`kc kc-compact ${isSelected ? 'is-selected' : ''} ${isDragging ? 'is-dragging' : ''}`}
         onClick={(e) => onSelect && onSelect(app.id, e)}>
      <div className="kc-logo">{app.init}</div>
      <div className="col" style={{ flex: 1, minWidth: 0, gap: 1 }}>
        <div className="kc-title">{app.role}</div>
        <div className="kc-meta" style={{ gap: 5 }}>
          <span>{app.co}</span>
          <span className="sep">·</span>
          <KSubsRow stage={app.stage} sub={app.sub} />
        </div>
      </div>
      <KStars value={app.stars} size={10} />
      <KScoreChip score={app.score} />
    </div>
  );
}

// ─── Column header ──
function KColHead({ stage, count, subLabel, tone }) {
  return (
    <div className="k-col-head">
      <div className="k-col-icon"><Icon name={stage.icon} size={14} /></div>
      <div className="k-col-name">{stage.label}</div>
      {subLabel && (
        <span className={`k-col-sub ${tone === 'warn' ? 'is-warn' : tone === 'end' ? 'is-end' : ''}`}>
          {subLabel}
        </span>
      )}
      <div className="k-col-count">{count}</div>
      <button className="btn btn-ghost btn-icon" style={{ padding: 3, marginLeft: -4 }}
              title="Add or import">
        <Icon name="more_horiz" size={14} />
      </button>
    </div>
  );
}

// ─── Empty state per column ──
function KEmpty({ stage }) {
  const map = {
    inbox:        { icon: 'inbox', title: 'No new captures', body: 'Use the browser extension to scrape jobs directly into your inbox.', cta: 'Install extension' },
    saved:        { icon: 'bookmark_border', title: 'Nothing saved yet', body: 'Drop interesting jobs here from your inbox to start research.', cta: null },
    generated:    { icon: 'auto_awesome', title: 'No materials drafted', body: 'Move a saved job here to generate tailored resume + cover letter.', cta: null },
    applied:      { icon: 'send', title: 'No applications sent', body: 'Once you submit, drag the card here to start tracking responses.', cta: null },
    interviewing: { icon: 'forum', title: 'No active interviews', body: 'Cards arrive here when recruiters reach out or you book a screen.', cta: null },
    decision:     { icon: 'gavel', title: 'No offers in flight', body: 'Cards land here when an offer comes in or final-round happens.', cta: null },
    accepted:     { icon: 'verified', title: 'Nothing accepted yet', body: 'When you sign, the role moves here for onboarding tracking.', cta: null },
  };
  const m = map[stage.id] || { icon: 'inbox', title: 'Empty', body: '', cta: null };
  return (
    <div className="k-empty">
      <div className="k-empty-icon"><Icon name={m.icon} size={16} /></div>
      <div className="k-empty-title">{m.title}</div>
      <div className="k-empty-body">{m.body}</div>
      {m.cta && <button className="k-empty-cta">{m.cta} →</button>}
    </div>
  );
}

// ─── Filter / sort bar ──
function KFilterBar({ density = 'comfy', onDensity, totalCount = 0, filteredCount = null, compact = false }) {
  const filters = [
    { id: 'co',     icon: 'apartment',   label: 'Company',    active: false },
    { id: 'score',  icon: 'analytics',   label: 'Score · 70+', active: true },
    { id: 'stars',  icon: 'star',        label: 'Interest',   active: false },
    { id: 'date',   icon: 'event',       label: 'Last 30 days', active: true },
    { id: 'src',    icon: 'travel_explore', label: 'Source', active: false },
  ];
  return (
    <div className="k-bar">
      <div className="k-search">
        <Icon name="search" size={14} />
        <input placeholder={`Search ${totalCount} applications…`} />
        <span style={{ fontSize: 11, color: 'var(--txt-dim)' }}>⌘K</span>
      </div>
      {!compact && filters.map(f => (
        <button key={f.id} className={`k-fchip ${f.active ? 'is-active' : ''}`}>
          <Icon name={f.icon} size={13} />
          <span>{f.label}</span>
          {f.active && <Icon name="close" size={12} />}
        </button>
      ))}
      {!compact && (
        <button className="k-fchip" style={{ background: 'transparent', borderStyle: 'dashed' }}>
          <Icon name="add" size={13} />
          <span>Add filter</span>
        </button>
      )}
      <div className="spacer" />
      {filteredCount !== null && filteredCount !== totalCount && (
        <span className="k-fclear">
          <b style={{ color: 'var(--primary)' }}>{filteredCount}</b> of {totalCount} · <u style={{ cursor: 'pointer' }}>clear</u>
        </span>
      )}
      <button className="btn btn-sm">
        <Icon name="swap_vert" size={13} />
        <span>Sort · Last activity</span>
      </button>
      <div className="k-density-toggle" title="Density">
        {['compact', 'comfy', 'cozy'].map(d => (
          <button key={d} className={density === d ? 'is-active' : ''} title={d}
                  onClick={() => onDensity && onDensity(d)}>
            <Icon name={d === 'compact' ? 'density_small' : d === 'cozy' ? 'density_large' : 'density_medium'} size={14} />
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Page head with stats ──
function KPageHead({ apps = window.K_APPS }) {
  const grouped = window.K_BY_STAGE(apps);
  const totalActive = window.K_STAGES.reduce((n, s) => n + (grouped[s.id] || []).length, 0);
  const interviewing = (grouped.interviewing || []).length;
  const offers = (grouped.decision || []).length + (grouped.accepted || []).length;
  const lostThis = (grouped.rejected || []).length + (grouped.declined || []).length + (grouped.withdrawn || []).length;
  return (
    <div className="k-pagehead">
      <h1>Pipeline</h1>
      <div className="chip chip-blue" style={{ marginLeft: 4 }}>
        <Icon name="dashboard" size={11} />
        {totalActive} active
      </div>
      <div className="stats-row">
        <div className="stat"><div className="lbl">Saved</div><div className="val">{(grouped.saved || []).length}<span className="ghost"> / {totalActive}</span></div></div>
        <div className="stat"><div className="lbl">Applied</div><div className="val">{(grouped.applied || []).length}</div></div>
        <div className="stat"><div className="lbl">Interviewing</div><div className="val" style={{ color: 'var(--primary)' }}>{interviewing}</div></div>
        <div className="stat"><div className="lbl">Offers</div><div className="val" style={{ color: 'var(--success)' }}>{offers}</div></div>
        <div className="stat"><div className="lbl">Closed</div><div className="val" style={{ color: 'var(--txt-dim)' }}>{lostThis}</div></div>
      </div>
    </div>
  );
}

// ─── Confirm modal — drop into past stage or end-state ──
function KConfirmModal({ kind, fromStage, toStage, app, onConfirm, onCancel }) {
  const isDanger = kind === 'end';
  return (
    <div className="k-overlay" onClick={onCancel}>
      <div className="k-modal" onClick={(e) => e.stopPropagation()}>
        <div className="k-modal-head">
          <div className={`k-modal-icon ${isDanger ? 'is-danger' : 'is-warn'}`}>
            <Icon name={isDanger ? 'block' : 'arrow_back'} size={18} fill />
          </div>
          <div style={{ flex: 1 }}>
            <h3>{isDanger ? `Mark this application as ${toStage.label}?` : 'Move pipeline back?'}</h3>
            <p>{isDanger
              ? `This is an end state — the card will leave the active pipeline. You can still find it in the ${toStage.label} archive.`
              : `Moving from ${fromStage.label} back to ${toStage.label} will reset substage progress for any stages between them.`}</p>
          </div>
        </div>
        <div className="k-modal-body">
          <div className="k-modal-summary">
            <div className="from">
              <span className="label">From</span>
              <span className="val">{fromStage.label}</span>
            </div>
            <Icon name="arrow_forward" size={16} />
            <div className="to">
              <span className="label">To</span>
              <span className={`val ${isDanger ? 'is-danger' : 'is-warn'}`}>{toStage.label}</span>
            </div>
          </div>
          {app && (
            <div className="row gap-2" style={{ marginTop: 10, padding: '8px 10px',
              background: 'var(--bg)', borderRadius: 8 }}>
              <div className="kc-logo" style={{ width: 24, height: 24, fontSize: 10 }}>{app.init}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--txt-mute)' }}>{app.co}</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--txt)',
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{app.role}</div>
              </div>
            </div>
          )}
        </div>
        <div className="k-modal-foot">
          <button className="btn btn-sm" onClick={onCancel}>Cancel</button>
          <button className={`btn btn-sm ${isDanger ? 'btn-danger' : 'btn-primary'}`} onClick={onConfirm}>
            {isDanger ? `Yes, mark as ${toStage.label}` : 'Move back'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Undo toast — for back-moves done optimistically ──
function KToast({ message, secondsLeft = 5 }) {
  return (
    <div className="k-toast">
      <div className="k-toast-prog">
        <svg width="32" height="32" viewBox="0 0 32 32">
          <circle cx="16" cy="16" r="13" stroke="rgba(255,255,255,0.18)" strokeWidth="2" fill="none" />
          <circle cx="16" cy="16" r="13" stroke="#93b8fb" strokeWidth="2" fill="none"
                  strokeDasharray={2*Math.PI*13} strokeDashoffset={2*Math.PI*13 * (1 - secondsLeft/5)}
                  strokeLinecap="round" transform="rotate(-90 16 16)" />
        </svg>
      </div>
      <span>{message}</span>
      <button className="k-toast-undo">
        <Icon name="undo" size={13} /> Undo
      </button>
    </div>
  );
}

// ─── Bulk selection bar ──
function KBulkBar({ count = 1, fromStage }) {
  return (
    <div className="k-bulk">
      <span className="ct">{count} selected · {fromStage ? `${fromStage.label}` : 'mixed stages'}</span>
      <div className="div" />
      <button className="k-bulk-btn">
        <Icon name="arrow_forward" size={13} /> Move to…
      </button>
      <button className="k-bulk-btn">
        <Icon name="label" size={13} /> Tag
      </button>
      <button className="k-bulk-btn is-danger">
        <Icon name="block" size={13} /> Mark rejected
      </button>
      <div className="div" />
      <button className="k-bulk-close" title="Clear selection">
        <Icon name="close" size={14} />
      </button>
    </div>
  );
}

// ─── End-state shelf (Layout A) ──
function KEndShelf({ apps, open = true, onToggle }) {
  const grouped = window.K_BY_STAGE(apps);
  const total = window.K_END_STAGES.reduce((n, s) => n + (grouped[s.id] || []).length, 0);
  return (
    <div className={`k-endshelf ${open ? 'is-open' : ''}`}>
      <div className="k-endshelf-head" onClick={onToggle}>
        <Icon name="alt_route" size={14} className="dim" />
        <span className="label">End states</span>
        <span className="count">{total}</span>
        <span style={{ marginLeft: 'auto', display: 'flex', gap: 14, alignItems: 'center' }}>
          {window.K_END_STAGES.map(s => (
            <span key={s.id} className="row gap-2" style={{ fontSize: 11, color: 'var(--txt-mute)' }}>
              <Icon name={s.icon} size={12} style={{ color: 'var(--danger)' }} />
              {s.label} · <b style={{ color: 'var(--txt-2)' }}>{(grouped[s.id] || []).length}</b>
            </span>
          ))}
          <Icon name="expand_more" size={16} className="chev" />
        </span>
      </div>
      {open && (
        <div className="k-endshelf-body">
          {window.K_END_STAGES.map(s => (
            <div key={s.id} className="k-endshelf-cell">
              <div className="head">
                <Icon name={s.icon} size={13} />
                <span className="nm">{s.label}</span>
                <span className="ct">{(grouped[s.id] || []).length}</span>
              </div>
              <div className="items">
                {(grouped[s.id] || []).slice(0, 3).map(a => (
                  <KCardC key={a.id} app={a} />
                ))}
                {(grouped[s.id] || []).length > 3 && (
                  <button className="k-col-overflow" style={{ border: 0, background: 'var(--bg)' }}>
                    <Icon name="expand_more" size={13} />
                    Show {(grouped[s.id] || []).length - 3} more
                  </button>
                )}
                {(grouped[s.id] || []).length === 0 && (
                  <div style={{ fontSize: 11, color: 'var(--txt-dim)', fontWeight: 600,
                    padding: '8px 4px', textAlign: 'center' }}>—</div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Drawer rail + drawer (Layout B) ──
function KEndDrawer({ apps, open, activeStageId, onToggle, onActivate }) {
  const grouped = window.K_BY_STAGE(apps);
  return (
    <>
      <div className="k-drawer-rail">
        <button className="k-drawer-tab" onClick={onToggle} title="Toggle drawer"
                style={{ color: 'var(--txt)', background: open ? 'var(--bg-hover)' : 'transparent' }}>
          <Icon name={open ? 'chevron_right' : 'chevron_left'} size={16} />
          <span className="nm">{open ? 'Close' : 'End'}</span>
        </button>
        {window.K_END_STAGES.map(s => (
          <button key={s.id} className="k-drawer-tab"
                  onClick={() => onActivate(s.id)}
                  style={{ background: open && activeStageId === s.id ? 'var(--primary-soft)' : 'transparent' }}>
            <Icon name={s.icon} size={16} />
            <span className="ct">{(grouped[s.id] || []).length}</span>
            <span className="nm">{s.label.slice(0,3)}</span>
          </button>
        ))}
      </div>
      {open && (
        <div className="k-drawer">
          <div className="k-drawer-head">
            <Icon name={window.K_END_STAGES.find(s => s.id === activeStageId)?.icon} size={16}
                  style={{ color: 'var(--danger)' }} />
            <h3>{window.K_END_STAGES.find(s => s.id === activeStageId)?.label}</h3>
            <span className="chip chip-red" style={{ marginLeft: 'auto' }}>{(grouped[activeStageId] || []).length}</span>
          </div>
          <div className="k-drawer-body">
            {(grouped[activeStageId] || []).map(a => <KCardA key={a.id} app={a} hint={false} />)}
            {(grouped[activeStageId] || []).length === 0 && (
              <div style={{ fontSize: 12, color: 'var(--txt-mute)', textAlign: 'center', padding: 20 }}>
                None yet.
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

Object.assign(window, {
  KStars, KDocs, KSubsRow, KSegBar, KScoreChip,
  KCardA, KCardB, KCardC,
  KColHead, KEmpty, KFilterBar, KPageHead,
  KConfirmModal, KToast, KBulkBar,
  KEndShelf, KEndDrawer,
});
