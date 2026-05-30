/* global React, ReactDOM, DesignCanvas, DCSection, DCArtboard, DCPostIt,
   TweaksPanel, useTweaks, TweakSection, TweakRadio, TweakSelect, TweakToggle,
   KanbanClassic, KanbanHierarchy, KanbanFocus,
   KCardA, KCardB, KCardC, KColHead, KEmpty, KBulkBar, KConfirmModal, KToast */

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "theme": "light",
  "density": "comfy",
  "showStates": true,
  "showCards": true,
  "layoutFocus": "focus"
}/*EDITMODE-END*/;

// ─── Single-column preview for card-variant artboards ────────────
function KColumnPreview({ Card, theme, label, sub, apps }) {
  const stage = window.K_STAGES.find(s => s.id === 'applied');
  return (
    <div className="app" data-theme={theme} style={{ background: 'var(--bg)', height: '100%' }}>
      <div style={{ padding: '14px 16px', height: '100%', display: 'flex', flexDirection: 'column' }}>
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 0.08,
            textTransform: 'uppercase', color: 'var(--txt-mute)' }}>{label}</div>
          <div style={{ fontSize: 12, color: 'var(--txt-mute)', marginTop: 2 }}>{sub}</div>
        </div>
        <div className="k-col" style={{ width: '100%', flex: 1, minHeight: 0 }}>
          <KColHead stage={stage} count={apps.length} />
          <div className="k-col-body">
            {apps.map(a => <Card key={a.id} app={a} />)}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Drag preview floater ───
function KDragPreview({ app, top, left, theme }) {
  return (
    <div className="k-ghost" style={{ top, left, width: 260 }}>
      <div className="app" data-theme={theme} style={{ background: 'transparent' }}>
        <KCardA app={app} hint={true} />
      </div>
    </div>
  );
}

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const apps = window.K_APPS;
  const appliedApps = (window.K_BY_STAGE())['applied'];

  const showAll  = t.layoutFocus === 'all';
  const showA = showAll || t.layoutFocus === 'classic';
  const showB = showAll || t.layoutFocus === 'hierarchy';
  const showC = showAll || t.layoutFocus === 'focus';

  return (
    <>
      <DesignCanvas storageKey="jobkernel-kanban-v1">
        {/* ── Section 1 · Board layouts ─────────────────────── */}
        <DCSection id="layouts"
          title="Kanban · Board layouts"
          subtitle="Three takes on stage hierarchy. Same tokens, same primitives, different opinions.">
          {showA && (
            <DCArtboard id="A-classic" label="A · Classic columns + end-state shelf" width={1480} height={920}>
              <KanbanClassic theme={t.theme} density={t.density} />
            </DCArtboard>
          )}
          {showB && (
            <DCArtboard id="B-hierarchy" label="B · Population-weighted + drawer" width={1480} height={920}>
              <KanbanHierarchy theme={t.theme} density={t.density} />
            </DCArtboard>
          )}
          {showC && (
            <DCArtboard id="C-focus" label="C · Focus stage + spines (novel)" width={1480} height={920}>
              <KanbanFocus theme={t.theme} density={t.density} />
            </DCArtboard>
          )}
        </DCSection>

        {/* ── Section 2 · Card variants ────────────────────── */}
        {t.showCards && (
          <DCSection id="cards"
            title="Card · density variants"
            subtitle="Same column, same data — three densities for users with 25, 75, or 200+ open apps.">
            <DCArtboard id="card-a" label="Standard · most users" width={360} height={760}>
              <KColumnPreview Card={KCardA} theme={t.theme}
                label="Card A — Standard"
                sub="Substage as dot row, score chip, next-action hint footer. Default."
                apps={appliedApps} />
            </DCArtboard>
            <DCArtboard id="card-b" label="Score-forward · low volume" width={360} height={760}>
              <KColumnPreview Card={KCardB} theme={t.theme}
                label="Card B — Score-forward"
                sub="ScoreRing on the left. Substage as a thin segmented bar."
                apps={appliedApps} />
            </DCArtboard>
            <DCArtboard id="card-c" label="Compact · 200+ apps" width={360} height={760}>
              <KColumnPreview Card={KCardC} theme={t.theme}
                label="Card C — Compact"
                sub="Single dense row. No hint footer — hover or open the card for detail."
                apps={appliedApps} />
            </DCArtboard>
          </DCSection>
        )}

        {/* ── Section 3 · Interaction states ────────────────── */}
        {t.showStates && (
          <DCSection id="states"
            title="Interaction states"
            subtitle="Drop targets, the confirm modal moment, optimistic back-moves, multi-select.">
            {/* drag forward + drop target lit */}
            <DCArtboard id="drag-forward" label="Drag forward · drop target lit" width={1480} height={920}>
              <KanbanClassic theme={t.theme} density={t.density} overlay="dragforward" />
              <KDragPreview app={window.K_APPS.find(a => a.id === 'a06')} top={300} left={460} theme={t.theme} />
            </DCArtboard>

            {/* end-state confirm modal */}
            <DCArtboard id="modal-end" label="End-state confirm · modal" width={1480} height={920}>
              <KanbanClassic theme={t.theme} density={t.density} overlay="modal-end" />
            </DCArtboard>

            {/* back-move toast (optimistic + undo) */}
            <DCArtboard id="toast-back" label="Back-move · optimistic + undo" width={1480} height={920}>
              <KanbanClassic theme={t.theme} density={t.density} overlay="toast" />
            </DCArtboard>

            {/* multi-select */}
            <DCArtboard id="multi-select" label="Multi-select · bulk action bar" width={1480} height={920}>
              <KanbanClassicMultiSelect theme={t.theme} density={t.density} />
            </DCArtboard>

            {/* high-volume / overflow */}
            <DCArtboard id="overflow" label="200+ apps · compact density" width={1480} height={920}>
              <KanbanClassic theme={t.theme} density="compact" />
            </DCArtboard>
          </DCSection>
        )}
      </DesignCanvas>

      <TweaksPanel title="Tweaks">
        <TweakSection label="Theme">
          <TweakRadio label="Mode"
            value={t.theme}
            options={['light', 'dark']}
            onChange={(v) => setTweak('theme', v)} />
        </TweakSection>

        <TweakSection label="Density">
          <TweakRadio label="Cards"
            value={t.density}
            options={['compact', 'comfy', 'cozy']}
            onChange={(v) => setTweak('density', v)} />
        </TweakSection>

        <TweakSection label="Layouts">
          <TweakSelect label="Show"
            value={t.layoutFocus}
            options={[
              { value: 'all',         label: 'All 3 layouts' },
              { value: 'classic',     label: 'Classic only' },
              { value: 'hierarchy',   label: 'Hierarchy only' },
              { value: 'focus',       label: 'Focus stage only' },
            ]}
            onChange={(v) => setTweak('layoutFocus', v)} />
        </TweakSection>

        <TweakSection label="Sections">
          <TweakToggle label="Card density variants"
            value={t.showCards}
            onChange={(v) => setTweak('showCards', v)} />
          <TweakToggle label="Interaction states"
            value={t.showStates}
            onChange={(v) => setTweak('showStates', v)} />
        </TweakSection>
      </TweaksPanel>
    </>
  );
}

// Multi-select demo — selectedIds is threaded straight through KanbanClassic
// to the card components, so the selection ring renders on first paint.
function KanbanClassicMultiSelect({ theme, density }) {
  const selected = React.useMemo(() => new Set(['a05', 'a06', 'a08']), []);
  return (
    <KanbanClassic theme={theme} density={density} overlay="bulk" selectedIds={selected} />
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
