/* global React, Icon, ListCheckbox, ListHead, ListRow, ListToolbar,
   StageCell, ScoreCell, StarsInline, DocsCondensed, DocsTextForward, HintCell,
   QuickActions, PipelineStrip, ScoreMini, SalaryCell */

// ─── Mini-artboards: row densities + interaction states ─────────
// Each component is a tight slice meant to live inside a small
// DCArtboard, focusing on one anatomy or state. They share the
// same column model and primitives as the full layouts.

const ROW_COLS_FULL = [
  { id: 'check',   width: 36,  align: 'center' },
  { id: 'company', width: 240, align: 'left' },
  { id: 'stage',   width: 160, align: 'left' },
  { id: 'score',   width: 80,  align: 'left' },
  { id: 'salary',  width: 130, align: 'left' },
  { id: 'stars',   width: 70,  align: 'left' },
  { id: 'docs',    width: 110, align: 'left' },
  { id: 'hint',    width: 220, align: 'left' },
];

const ROW_COLS_COMPACT = [
  { id: 'check',   width: 36,  align: 'center' },
  { id: 'company', width: 200, align: 'left' },
  { id: 'role',    width: 200, align: 'left' },
  { id: 'stage',   width: 140, align: 'left' },
  { id: 'score',   width: 80,  align: 'left' },
  { id: 'stars',   width: 60,  align: 'left' },
  { id: 'docs',    width: 80,  align: 'left' },
  { id: 'hint',    width: 250, align: 'left' },
];

const ROW_COLS_PIPELINE = [
  { id: 'check',    width: 36,  align: 'center' },
  { id: 'company',  width: 240, align: 'left' },
  { id: 'pipeline', width: 240, align: 'left' },
  { id: 'score',    width: 80,  align: 'left' },
  { id: 'salary',   width: 130, align: 'left' },
  { id: 'docs',     width: 100, align: 'left' },
  { id: 'hint',     width: 220, align: 'left' },
];

const SAMPLE_APPS = ['a04', 'a05', 'a11', 'a14', 'a19'].map(id =>
  window.K_APPS.find(a => a.id === id)
);

// Generic frame around any state crop — provides the bg + theme switch hook.
function StateFrame({ theme = 'light', children, padded = false }) {
  return (
    <div className="app" data-theme={theme} style={{ position: 'relative', height: '100%', background: 'var(--bg)', overflow: 'hidden' }}>
      <div style={{
        padding: padded ? 20 : 0,
        height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0,
      }}>
        {children}
      </div>
    </div>
  );
}

// ─── Row variants — three densities ─────────────────────────────
function RowSingleLine({ theme = 'light' }) {
  return (
    <StateFrame theme={theme}>
      <div className="lt">
        <ListHead cols={ROW_COLS_COMPACT} sortBy="score" sortDir="desc" />
        {SAMPLE_APPS.slice(0, 3).map(a => (
          <ListRow key={a.id} app={a} cols={ROW_COLS_COMPACT} density="compact" twoLine={false} />
        ))}
      </div>
      <StateCaption>
        <b>Single-line · 36px</b> — Role gets its own column. Score is bar+number, docs as 3 small dots, stage as chip+sub. Best for 100+ application views.
      </StateCaption>
    </StateFrame>
  );
}

function RowTwoLine({ theme = 'light' }) {
  return (
    <StateFrame theme={theme}>
      <div className="lt">
        <ListHead cols={ROW_COLS_FULL} sortBy="score" sortDir="desc" />
        {SAMPLE_APPS.slice(0, 3).map(a => (
          <ListRow key={a.id} app={a} cols={ROW_COLS_FULL} density="comfy" twoLine={true} />
        ))}
      </div>
      <StateCaption>
        <b>Two-line · 52px</b> — Role sits under company name in the same cell, drops the role column. More room per cell, docs become text-forward ("3 ok · 2 todo"). The recommended default.
      </StateCaption>
    </StateFrame>
  );
}

function RowPipeline({ theme = 'light' }) {
  return (
    <StateFrame theme={theme}>
      <div className="lt">
        <PipelineRowHead cols={ROW_COLS_PIPELINE} />
        {SAMPLE_APPS.slice(0, 3).map(a => (
          <div key={a.id} className="lrow d-comfy" style={{ gridTemplateColumns: ROW_COLS_PIPELINE.map(c => `${c.width}px`).join(' ') }}>
            {ROW_COLS_PIPELINE.map(col => (
              <div key={col.id} className="lcell">
                {col.id === 'check' && <ListCheckbox />}
                {col.id === 'company' && (
                  <div className="lco">
                    <div className="lco-logo">{a.init}</div>
                    <div className="lco-text">
                      <span className="lco-name">{a.co}</span>
                      <span className="lco-role">{a.role}</span>
                    </div>
                  </div>
                )}
                {col.id === 'pipeline' && <PipelineStrip stage={a.stage} sub={a.sub} />}
                {col.id === 'score' && (
                  <span className="row gap-2"><ScoreMini score={a.score} /></span>
                )}
                {col.id === 'salary' && <SalaryCell value={a.salary} />}
                {col.id === 'docs' && <DocsTextForward docs={a.docs} />}
                {col.id === 'hint' && (
                  <>
                    <HintCell app={a} />
                    <span style={{ marginLeft: 'auto' }} />
                    <QuickActions />
                  </>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
      <StateCaption>
        <b>Pipeline-strip · 52px</b> — Stage column becomes a horizontal mini-stepper. Status visible at a glance for every row. Used in the Pulse variation.
      </StateCaption>
    </StateFrame>
  );
}

function PipelineRowHead({ cols }) {
  const labels = { check: '', company: 'Company · Role', pipeline: 'Journey', score: 'Score', salary: 'Salary', docs: 'Docs', hint: 'Next action' };
  return (
    <div className="lthead" style={{ gridTemplateColumns: cols.map(c => `${c.width}px`).join(' ') }}>
      {cols.map(c => (
        c.id === 'check' ? (
          <div key={c.id} className="lth lcheck" style={{ cursor: 'default' }}><ListCheckbox /></div>
        ) : (
          <div key={c.id} className="lth"><span>{labels[c.id]}</span></div>
        )
      ))}
    </div>
  );
}

function StateCaption({ children }) {
  return (
    <div style={{
      marginTop: 'auto',
      padding: '14px 16px',
      borderTop: '1px solid var(--line)',
      background: 'var(--bg)',
      fontSize: 11.5, color: 'var(--txt-mute)', lineHeight: 1.5,
    }}>{children}</div>
  );
}

// ─── Hover quick-actions ────────────────────────────────────────
function StateHover({ theme = 'light' }) {
  return (
    <StateFrame theme={theme}>
      <div className="lt">
        <ListHead cols={ROW_COLS_FULL} sortBy="score" sortDir="desc" />
        {SAMPLE_APPS.slice(0, 4).map((a, i) => (
          <ListRow key={a.id} app={a} cols={ROW_COLS_FULL} density="comfy" twoLine={true}
            hovered={i === 1}
          />
        ))}
      </div>
      <StateCaption>
        <b>Hover state</b> — Quick-actions appear at the end of the Next-action cell: open · change stage · archive · more. Click anywhere else on the row navigates to Job Details.
      </StateCaption>
    </StateFrame>
  );
}

// ─── Selection + bulk-action bar ─────────────────────────────────
function StateSelection({ theme = 'light' }) {
  const selectedIdx = new Set([0, 2, 3]);
  return (
    <StateFrame theme={theme}>
      <div className="lt" style={{ position: 'relative' }}>
        <ListHead cols={ROW_COLS_FULL} sortBy="score" sortDir="desc"
          indeterminate={true} selectAll={false}
        />
        {SAMPLE_APPS.map((a, i) => (
          <ListRow key={a.id} app={a} cols={ROW_COLS_FULL} density="comfy" twoLine={true}
            selected={selectedIdx.has(i)}
          />
        ))}
      </div>

      <BulkBar count={3} />
    </StateFrame>
  );
}

function BulkBar({ count = 3 }) {
  return (
    <div className="bulkbar">
      <span className="bulkbar-count">
        <span className="n">{count}</span> selected
      </span>
      <button className="bulkbar-btn"><Icon name="swap_horiz" size={14} /> Move stage</button>
      <button className="bulkbar-btn"><Icon name="local_offer" size={14} /> Add tag</button>
      <button className="bulkbar-btn"><Icon name="snooze" size={14} /> Snooze</button>
      <button className="bulkbar-btn"><Icon name="archive" size={14} /> Archive</button>
      <button className="bulkbar-btn"><Icon name="file_download" size={14} /> Export</button>
      <button className="bulkbar-btn is-danger"><Icon name="delete" size={14} /> Delete</button>
      <span style={{ width: 1, height: 18, background: 'rgba(255,255,255,0.15)', margin: '0 2px' }} />
      <button className="bulkbar-close" title="Clear selection">
        <Icon name="close" size={14} />
      </button>
    </div>
  );
}

// ─── Inline stage edit (popover open) ───────────────────────────
function StateStagePopover({ theme = 'light' }) {
  // Row 1 = the active one with the popover open below its stage cell.
  return (
    <StateFrame theme={theme}>
      <div className="lt" style={{ position: 'relative' }}>
        <ListHead cols={ROW_COLS_FULL} sortBy="score" sortDir="desc" />
        {SAMPLE_APPS.slice(0, 3).map((a, i) => (
          <ListRow key={a.id} app={a} cols={ROW_COLS_FULL} density="comfy" twoLine={true}
            focused={i === 0}
          />
        ))}

        {/* Stage cell sits at columns 1..3 — left offset = 36 + 240 (= 276) for the chip's left edge */}
        <div className="popover" style={{ left: 276, top: 88 }}>
          <div className="popover-label">Move to stage</div>
          {window.K_STAGES.slice(1).map(s => (
            <div key={s.id} className={`popover-item ${s.id === 'saved' ? 'is-current' : ''} ${s.id === 'generated' ? 'is-active' : ''}`}>
              <Icon name={s.icon} size={14} />
              <span style={{ flex: 1 }}>{s.label}</span>
              {s.id === 'saved' && <span style={{ fontSize: 10, color: 'var(--txt-dim)', fontWeight: 700 }}>Current</span>}
              {s.id === 'generated' && <span className="popover-shortcut">↵</span>}
            </div>
          ))}
          <div className="popover-divider" />
          <div className="popover-label">End state</div>
          {window.K_END_STAGES.map(s => (
            <div key={s.id} className="popover-item is-danger">
              <Icon name={s.icon} size={14} />
              <span style={{ flex: 1 }}>{s.label}</span>
            </div>
          ))}
        </div>
      </div>
    </StateFrame>
  );
}

// ─── Confirm modal — backward stage move ────────────────────────
function StateConfirmModal({ theme = 'light' }) {
  return (
    <StateFrame theme={theme}>
      <div className="lt">
        <ListHead cols={ROW_COLS_FULL} sortBy="score" sortDir="desc" />
        {SAMPLE_APPS.map((a, i) => (
          <ListRow key={a.id} app={a} cols={ROW_COLS_FULL} density="comfy" twoLine={true}
            focused={i === 1}
          />
        ))}
      </div>

      <div className="modal-bd">
        <div className="modal-card">
          <div className="modal-icon"><Icon name="undo" size={20} /></div>
          <h3 style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 800, color: 'var(--txt)' }}>
            Move back to <span style={{ color: 'var(--primary)' }}>Saved</span>?
          </h3>
          <p style={{ margin: '0 0 14px', fontSize: 13, color: 'var(--txt-mute)', lineHeight: 1.5 }}>
            <b style={{ color: 'var(--txt-2)' }}>Figma</b> is currently in Generated. Moving back to Saved will keep your generated resume and cover letter, but you'll restart the Generated checklist.
          </p>
          <div className="row gap-2" style={{ padding: '10px 12px', background: 'var(--bg)', borderRadius: 8, marginBottom: 14 }}>
            <Icon name="info" size={13} className="dim" />
            <span style={{ fontSize: 12, color: 'var(--txt-mute)' }}>Same confirmation as the Job Details rollback dialog.</span>
          </div>
          <div className="row gap-2" style={{ justifyContent: 'flex-end' }}>
            <button className="btn btn-sm">Cancel</button>
            <button className="btn btn-primary btn-sm">
              <Icon name="undo" size={13} /> Move to Saved
            </button>
          </div>
        </div>
      </div>
    </StateFrame>
  );
}

// ─── Column manager ─────────────────────────────────────────────
function StateColumnManager({ theme = 'light' }) {
  const colDefs = [
    { id: 'check', label: '— Select', visible: true, locked: true },
    { id: 'company', label: 'Company', visible: true, locked: true },
    { id: 'role', label: 'Role / Title', visible: false },
    { id: 'stage', label: 'Stage', visible: true },
    { id: 'score', label: 'Match score', visible: true },
    { id: 'salary', label: 'Salary', visible: true },
    { id: 'stars', label: 'Interest', visible: true },
    { id: 'docs', label: 'Docs', visible: true },
    { id: 'loc', label: 'Location', visible: true },
    { id: 'posted', label: 'Date added', visible: true },
    { id: 'hint', label: 'Next action', visible: true },
    { id: 'source', label: 'Source', visible: false },
    { id: 'lastact', label: 'Last activity', visible: false },
  ];

  return (
    <StateFrame theme={theme}>
      <div className="lt">
        <ListHead cols={ROW_COLS_FULL} sortBy="score" sortDir="desc" />
        {SAMPLE_APPS.slice(0, 3).map(a => (
          <ListRow key={a.id} app={a} cols={ROW_COLS_FULL} density="comfy" twoLine={true} />
        ))}
      </div>

      {/* Column manager popover anchored to the View-column button */}
      <div className="popover" style={{ right: 16, top: 8, width: 240, padding: 8 }}>
        <div className="popover-label" style={{ padding: '4px 8px 6px' }}>Columns · drag to reorder</div>
        {colDefs.map(c => (
          <div key={c.id} className={`cmgr-row ${c.locked ? 'is-locked' : ''}`}>
            <span className={`cmgr-grip ${c.locked ? 'is-locked' : ''}`}>
              <Icon name="drag_indicator" size={14} />
            </span>
            <ListCheckbox checked={c.visible} ariaLabel={c.label} />
            <span className="cmgr-name">{c.label}</span>
            <span style={{ fontSize: 10, color: 'var(--txt-dim)', fontWeight: 700, textAlign: 'right' }}>
              {c.locked ? 'Locked' : ''}
            </span>
          </div>
        ))}
        <div className="popover-divider" />
        <div className="row gap-2" style={{ padding: '4px 6px 2px' }}>
          <button className="btn btn-ghost btn-sm" style={{ flex: 1 }}>Reset to default</button>
          <button className="btn btn-primary btn-sm" style={{ flex: 1 }}>Done</button>
        </div>
      </div>

      {/* Visual cue: a dragged column header */}
      <div style={{ position: 'absolute', top: 84, left: 466, transform: 'rotate(-1.5deg)',
        boxShadow: '0 8px 24px rgba(15,23,42,0.20)', borderRadius: 6, overflow: 'hidden', zIndex: 30 }}>
        <div className="lth is-dragging" style={{ width: 80, height: 36, padding: '0 12px', display: 'flex', alignItems: 'center', gap: 6 }}>
          <Icon name="drag_indicator" size={12} />
          <span>SCORE</span>
        </div>
      </div>
    </StateFrame>
  );
}

// ─── Sticky header + virtualization "loading more" ──────────────
function StateStickyLoading({ theme = 'light' }) {
  return (
    <StateFrame theme={theme}>
      <div className="lt">
        {/* Sticky header floating with shadow */}
        <div className="lthead is-floating" style={{ gridTemplateColumns: ROW_COLS_FULL.map(c => `${c.width}px`).join(' ') }}>
          {ROW_COLS_FULL.map(c => (
            c.id === 'check' ? (
              <div key={c.id} className="lth lcheck"><ListCheckbox /></div>
            ) : (
              <div key={c.id} className={`lth ${c.id === 'score' ? 'is-sorted' : ''}`}>
                <span>{['', 'Company', '', 'Stage', 'Score', 'Salary', 'Interest', 'Docs', '', '', 'Next action'][window.L_COLUMNS.findIndex(x => x.id === c.id)]}</span>
                {c.id === 'score' && <span className="sort-arrow"><Icon name="arrow_downward" size={12} /></span>}
              </div>
            )
          ))}
        </div>

        {SAMPLE_APPS.map((a) => (
          <ListRow key={a.id} app={a} cols={ROW_COLS_FULL} density="comfy" twoLine={true} />
        ))}

        {/* Skeleton rows — virtualization affordance */}
        {[0,1,2].map(i => (
          <div key={i} className="lrow d-comfy is-skeleton" style={{ gridTemplateColumns: ROW_COLS_FULL.map(c => `${c.width}px`).join(' ') }}>
            <div className="lcell lcheck"><div className="skl" style={{ width: 14, height: 14, borderRadius: 3 }} /></div>
            <div className="lcell">
              <div className="skl is-circ" style={{ width: 28, height: 28 }} />
              <div className="col gap-1" style={{ flex: 1 }}>
                <div className="skl" style={{ width: '60%' }} />
                <div className="skl" style={{ width: '80%', height: 8 }} />
              </div>
            </div>
            <div className="lcell"><div className="skl" style={{ width: 100 }} /></div>
            <div className="lcell"><div className="skl" style={{ width: 60 }} /></div>
            <div className="lcell"><div className="skl" style={{ width: 80 }} /></div>
            <div className="lcell"><div className="skl" style={{ width: 50 }} /></div>
            <div className="lcell"><div className="skl" style={{ width: 70 }} /></div>
            <div className="lcell"><div className="skl" style={{ width: 90 }} /></div>
            <div className="lcell"><div className="skl" style={{ width: 180 }} /></div>
          </div>
        ))}

        <div className="lt-footer">
          <div className="row gap-2" style={{ alignItems: 'center', color: 'var(--primary)' }}>
            <div style={{ width: 12, height: 12, borderRadius: '50%', border: '2px solid var(--primary)', borderTopColor: 'transparent', animation: 'spin 1s linear infinite' }} />
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            <span>Loading 32 of 80</span>
          </div>
        </div>
      </div>
    </StateFrame>
  );
}

// ─── Empty state ────────────────────────────────────────────────
function StateEmpty({ theme = 'light' }) {
  return (
    <StateFrame theme={theme} padded={false}>
      <ListToolbar active="needs" density="comfy" />
      <div className="lt" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <ListHead cols={ROW_COLS_FULL} sortBy="score" sortDir="desc" />
        <div className="lempty">
          <div className="lempty-icon"><Icon name="filter_alt_off" size={28} /></div>
          <h3>No applications match these filters</h3>
          <p>You're filtering by <b>"Needs my action"</b> and there's nothing in your queue. Clear the filter to see your full pipeline, or capture a new posting with the JobKernel extension.</p>
          <div className="row gap-2" style={{ marginTop: 8 }}>
            <button className="btn btn-sm"><Icon name="filter_alt_off" size={14} /> Clear filters</button>
            <button className="btn btn-primary btn-sm">
              <Icon name="add" size={14} /> Add a job manually
            </button>
          </div>
        </div>
      </div>
    </StateFrame>
  );
}

// ─── Loading state (initial) ────────────────────────────────────
function StateLoading({ theme = 'light' }) {
  return (
    <StateFrame theme={theme}>
      <ListToolbar active="needs" density="comfy" />
      <div className="lt" style={{ flex: 1 }}>
        <ListHead cols={ROW_COLS_FULL} sortBy="score" sortDir="desc" />
        {[0,1,2,3,4,5,6,7,8].map(i => (
          <div key={i} className="lrow d-comfy is-skeleton" style={{ gridTemplateColumns: ROW_COLS_FULL.map(c => `${c.width}px`).join(' '), opacity: 1 - i * 0.08 }}>
            <div className="lcell lcheck"><div className="skl" style={{ width: 14, height: 14, borderRadius: 3 }} /></div>
            <div className="lcell">
              <div className="skl is-circ" style={{ width: 28, height: 28 }} />
              <div className="col gap-1" style={{ flex: 1 }}>
                <div className="skl" style={{ width: '60%' }} />
                <div className="skl" style={{ width: '80%', height: 8 }} />
              </div>
            </div>
            <div className="lcell"><div className="skl" style={{ width: 100 }} /></div>
            <div className="lcell"><div className="skl" style={{ width: 60 }} /></div>
            <div className="lcell"><div className="skl" style={{ width: 80 }} /></div>
            <div className="lcell"><div className="skl" style={{ width: 50 }} /></div>
            <div className="lcell"><div className="skl" style={{ width: 70 }} /></div>
            <div className="lcell"><div className="skl" style={{ width: 90 }} /></div>
            <div className="lcell"><div className="skl" style={{ width: 180 }} /></div>
          </div>
        ))}
      </div>
    </StateFrame>
  );
}

// ─── Error state ────────────────────────────────────────────────
function StateError({ theme = 'light' }) {
  return (
    <StateFrame theme={theme}>
      <ListToolbar active="needs" density="comfy" />
      <div className="lt" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <ListHead cols={ROW_COLS_FULL} sortBy="score" sortDir="desc" />
        <div className="lempty is-error">
          <div className="lempty-icon"><Icon name="cloud_off" size={28} /></div>
          <h3>Couldn't load your applications</h3>
          <p>Lost connection to the JobKernel API. Your local changes are saved — they'll sync when you're back online.</p>
          <div className="row gap-2" style={{ marginTop: 8 }}>
            <button className="btn btn-sm"><Icon name="refresh" size={14} /> Retry</button>
            <button className="btn btn-ghost btn-sm"><Icon name="cloud_done" size={14} /> Work offline</button>
          </div>
        </div>
      </div>
    </StateFrame>
  );
}

// ─── Shortcuts cheatsheet (the `?` overlay) ─────────────────────
function StateShortcuts({ theme = 'light' }) {
  const shortcuts = [
    { keys: ['j'], label: 'Next row' },
    { keys: ['k'], label: 'Previous row' },
    { keys: ['↵'], label: 'Open selected' },
    { keys: ['x'], label: 'Toggle select' },
    { keys: ['e'], label: 'Inline edit' },
    { keys: ['/'], label: 'Focus search' },
    { keys: ['g', 'a'], label: 'Jump to · Active' },
    { keys: ['g', 'n'], label: 'Jump to · Needs action' },
    { keys: ['g', 'i'], label: 'Jump to · Interviewing' },
    { keys: ['g', 'r'], label: 'Jump to · Closed' },
    { keys: ['⌘', 'A'], label: 'Select all visible' },
    { keys: ['?'], label: 'Show this sheet' },
  ];
  return (
    <StateFrame theme={theme}>
      <div className="lt" style={{ position: 'relative', flex: 1 }}>
        <ListHead cols={ROW_COLS_FULL} sortBy="score" sortDir="desc" />
        {SAMPLE_APPS.slice(0, 3).map(a => (
          <ListRow key={a.id} app={a} cols={ROW_COLS_FULL} density="comfy" twoLine={true} />
        ))}
      </div>

      <div className="modal-bd">
        <div className="modal-card" style={{ width: 540 }}>
          <div className="row gap-2" style={{ marginBottom: 4 }}>
            <Icon name="keyboard" size={18} style={{ color: 'var(--primary)' }} />
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: 'var(--txt)' }}>Keyboard shortcuts</h3>
            <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--txt-dim)', fontWeight: 700 }}>List view</span>
          </div>
          <div className="cheat">
            {shortcuts.map((s, i) => (
              <div key={i} className="cheat-row">
                <span>{s.label}</span>
                <span className="cheat-keys">
                  {s.keys.map((k, j) => <span key={j} className="cheat-key">{k}</span>)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </StateFrame>
  );
}

Object.assign(window, {
  RowSingleLine, RowTwoLine, RowPipeline,
  StateHover, StateSelection, StateStagePopover, StateConfirmModal,
  StateColumnManager, StateStickyLoading, StateEmpty, StateLoading,
  StateError, StateShortcuts,
});
